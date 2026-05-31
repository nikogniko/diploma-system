import { OutboxEventType, type Prisma } from "../../prisma/generated/client/index.js";
import { OutboxEventRepository } from "../repositories/OutboxEventRepository.js";
import type { DbClient } from "../repositories/repositoryTypes.js";

export class OutboxEventService {
  /** Записує мінімальну outbox-подію всередині активної бізнес-транзакції. */
  async record(
    tx: DbClient,
    aggregateType: string,
    aggregateId: string,
    eventType: OutboxEventType,
    context?: Record<string, string>,
  ) {
    const repository = new OutboxEventRepository(tx);
    const payload = {
      aggregateType,
      aggregateId,
      eventType,
      ...(context ? { context } : {}),
    } satisfies Prisma.InputJsonObject;
    return repository.createEvent({ aggregateType, aggregateId, eventType, payload });
  }

  /** Створює подію створення Application для подальшої асинхронної обробки. */
  async applicationCreated(tx: DbClient, applicationId: string, vacancyId: string) {
    return this.record(tx, "Application", applicationId, OutboxEventType.CREATED, { vacancyId });
  }

  /** Створює подію оновлення Application після переходу його статусу. */
  async applicationUpdated(tx: DbClient, applicationId: string, status: string) {
    return this.record(tx, "Application", applicationId, OutboxEventType.UPDATED, { status });
  }

  /** Створює подію оновлення Vacancy, коли найм закриває оголошення. */
  async vacancyClosedByHire(tx: DbClient, vacancyId: string) {
    return this.record(tx, "Vacancy", vacancyId, OutboxEventType.UPDATED, { reason: "HIRED" });
  }

  /** Створює подію створення Vacancy для асинхронної синхронізації пошукового індексу. */
  async vacancyCreated(tx: DbClient, vacancyId: string) {
    return this.record(tx, "Vacancy", vacancyId, OutboxEventType.CREATED);
  }

  /** Створює подію оновлення Vacancy для асинхронної синхронізації пошукового індексу. */
  async vacancyUpdated(tx: DbClient, vacancyId: string, reason: string) {
    return this.record(tx, "Vacancy", vacancyId, OutboxEventType.UPDATED, { reason });
  }
}

export const outboxEventService = new OutboxEventService();
