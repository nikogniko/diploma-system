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
  buildVacancySearchDocument,
  ensureVacanciesIndex,
} from "../search/vacancySearchIndex.js";

export class SearchOutboxWorker {
  /** Створює worker, який обробляє outbox без участі бізнес-транзакцій API. */
  constructor(
    private readonly events: OutboxEventRepository = outboxEventRepository,
    private readonly vacancies: VacancyRepository = vacancyRepository,
  ) {}

  /** Обробляє одну пачку PENDING подій і ізолює помилки зовнішнього search сервісу. */
  async processPendingEvents(limit = 25) {
    const events = await this.events.listPendingEvents(limit);
    for (const event of events) {
      try {
        await this.processEvent(event.aggregateType, event.aggregateId);
        await this.events.markProcessed(event.id);
      } catch (error) {
        console.error(`Outbox event ${event.id} failed`, error);
        await this.events.markFailed(event.id);
      }
    }
    return events.length;
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
      throw new Error("Elasticsearch is unavailable");
    }
    const vacancy = await this.vacancies.findVacancyById(vacancyId);
    if (!vacancy) {
      await getElasticsearchClient().delete({
        index: vacanciesIndexName(),
        id: vacancyId,
      }, { ignore: [404] });
      return;
    }
    await ensureVacanciesIndex();
    await getElasticsearchClient().index({
      index: vacanciesIndexName(),
      id: vacancy.id,
      document: buildVacancySearchDocument(vacancy),
    });
  }
}

export const searchOutboxWorker = new SearchOutboxWorker();
