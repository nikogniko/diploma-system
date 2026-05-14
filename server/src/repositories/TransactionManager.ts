import { prisma } from "../config/db.js";
import type { DbClient } from "./repositoryTypes.js";

export class TransactionManager {
  /** Виконує переданий сценарій всередині однієї Prisma transaction. */
  async run<T>(callback: (tx: DbClient) => Promise<T>) {
    return prisma.$transaction((tx) => callback(tx));
  }
}

export const transactionManager = new TransactionManager();
