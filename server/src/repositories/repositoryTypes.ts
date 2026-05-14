import type { Prisma, PrismaClient } from "../../prisma/generated/client/index.js";

export type DbClient = PrismaClient | Prisma.TransactionClient;
