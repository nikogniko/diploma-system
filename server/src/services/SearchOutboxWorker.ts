import {
  OutboxEventRepository,
  outboxEventRepository,
} from "../repositories/OutboxEventRepository.js";
import {
  VacancyRepository,
  vacancyRepository,
} from "../repositories/VacancyRepository.js";
import {
  getElasticsearchClient,
  isElasticsearchAvailable,
  isElasticsearchEnabled,
  vacanciesIndexName,
} from "../search/elasticsearchClient.js";
import {
  ensureVacanciesIndex,
  upsertVacancySearchDocument,
} from "../search/vacancySearchIndex.js";

class SearchOutboxTransientError extends Error {}

export class SearchOutboxWorker {
  private timer: NodeJS.Timeout | null = null;
  private isProcessing = false;

  /** Створює worker, який обробляє outbox без участі бізнес-транзакцій API. */
  constructor(
    private readonly events: OutboxEventRepository = outboxEventRepository,
    private readonly vacancies: VacancyRepository = vacancyRepository,
  ) {}

  /** Запускає періодичну фонову обробку outbox-подій для пошукового індексу. */
  start(intervalMs = 5_000) {
    if (this.timer || !isElasticsearchEnabled()) return;

    this.timer = setInterval(() => {
      void this.processPendingEvents().catch((error) => {
        console.error("Помилка циклу search outbox worker", error);
      });
    }, intervalMs);

    void this.processPendingEvents().catch((error) => {
      console.error("Помилка першого циклу search outbox worker", error);
    });
  }

  /** Зупиняє фонову обробку outbox-подій, якщо процес завершується контрольовано. */
  stop() {
    if (!this.timer) return;

    clearInterval(this.timer);
    this.timer = null;
  }

  /** Обробляє одну пачку PENDING подій і ізолює помилки зовнішнього search сервісу. */
  async processPendingEvents(limit = 25) {
    if (this.isProcessing || !isElasticsearchEnabled()) return 0;

    this.isProcessing = true;

    try {
      const events = await this.events.listPendingEvents(limit);
      for (const event of events) {
        try {
          await this.processEvent(event.aggregateType, event.aggregateId);
          await this.events.markProcessed(event.id);
        } catch (error) {
          if (error instanceof SearchOutboxTransientError) {
            console.warn(`Outbox-подія ${event.id} буде повторена`, error.message);
            continue;
          }

          console.error(`Outbox-подія ${event.id} завершилась помилкою`, error);
          await this.events.markFailed(event.id);
        }
      }
      return events.length;
    } finally {
      this.isProcessing = false;
    }
  }

  /** Обробляє підтримуваний aggregate type або відхиляє невідомий тип події. */
  private async processEvent(aggregateType: string, aggregateId: string) {
    if (aggregateType === "Application") {
      // MVP зберігає Application events для майбутніх consumers, без ES application index.
      return;
    }
    if (aggregateType === "Vacancy") {
      await this.syncVacancy(aggregateId);
      return;
    }
    throw new Error(`Unsupported outbox aggregate type: ${aggregateType}`);
  }

  /** Синхронізує vacancy document лише коли Elasticsearch явно увімкнений. */
  private async syncVacancy(vacancyId: string) {
    if (!isElasticsearchEnabled()) return;
    if (!await isElasticsearchAvailable()) {
      throw new SearchOutboxTransientError("Elasticsearch недоступний");
    }

    const vacancy = await this.vacancies.findVacancyById(vacancyId);
    if (!vacancy) {
      await ensureVacanciesIndex();
      await getElasticsearchClient().delete({
        index: vacanciesIndexName(),
        id: vacancyId,
      }, { ignore: [404] });
      return;
    }

    await upsertVacancySearchDocument(vacancy);
  }
}

export const searchOutboxWorker = new SearchOutboxWorker();
