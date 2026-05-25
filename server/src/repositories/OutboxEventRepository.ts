import {
  type OutboxEventType,
  Prisma,
} from "../../prisma/generated/client/index.js";
import { prisma } from "../config/db.js";
import type { DbClient } from "./repositoryTypes.js";

export type OutboxEventData = {
  aggregateType: string;
  aggregateId: string;
  eventType: OutboxEventType;
  payload: Prisma.InputJsonValue;
};

export class OutboxEventRepository {
  /** Створює persistence adapter для transactional outbox. */
  constructor(private readonly db: DbClient = prisma) {}

  /** Записує подію в outbox у тій самій транзакції, що й бізнес-зміна. */
  async createEvent(data: OutboxEventData) {
    return this.db.outboxEvent.create({ data });
  }

  /** Повертає найстаріші необроблені події для одного циклу worker-а. */
  async listPendingEvents(limit: number) {
    return this.db.outboxEvent.findMany({
      where: { status: "PENDING" },
      orderBy: { createdAt: "asc" },
      take: limit,
    });
  }

  /** Позначає подію як успішно оброблену worker-ом. */
  async markProcessed(eventId: string) {
    return this.db.outboxEvent.update({
      where: { id: eventId },
      data: { status: "PROCESSED" },
    });
  }

  /** Позначає подію як невдалу без розширення поточної MVP schema. */
  async markFailed(eventId: string) {
    return this.db.outboxEvent.update({
      where: { id: eventId },
      data: { status: "FAILED" },
    });
  }
}

export const outboxEventRepository = new OutboxEventRepository();
