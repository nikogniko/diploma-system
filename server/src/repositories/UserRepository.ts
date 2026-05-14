import { UserRole, UserStatus } from "../../prisma/generated/client/index.js";
import { prisma } from "../config/db.js";
import type { DbClient } from "./repositoryTypes.js";

export type BaseUserData = {
  clerkUserId: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  middleName?: string | null;
  photoUrl?: string | null;
  role?: UserRole;
  status?: UserStatus;
};

export class UserRepository {
  constructor(private readonly db: DbClient = prisma) {}

  /** Створює або оновлює базовий запис користувача після події Clerk. */
  async upsertBaseUser(data: BaseUserData) {
    const email = data.email.toLowerCase();

    return this.db.user.upsert({
      where: { clerkUserId: data.clerkUserId },
      include: { studentProfile: true, hrProfile: true },
      update: {
        email,
        firstName: data.firstName ?? undefined,
        lastName: data.lastName ?? undefined,
        middleName: data.middleName ?? undefined,
        photoUrl: data.photoUrl ?? undefined,
      },
      create: {
        clerkUserId: data.clerkUserId,
        email,
        role: data.role ?? UserRole.STUDENT,
        status: data.status ?? UserStatus.PENDING_VERIFICATION,
        firstName: data.firstName?.trim() || "Pending",
        lastName: data.lastName?.trim() || "User",
        middleName: data.middleName ?? null,
        photoUrl: data.photoUrl ?? null,
      },
    });
  }

  /** Шукає користувача за внутрішнім UUID. */
  async findUserById(userId: string) {
    return this.db.user.findUnique({
      where: { id: userId },
      include: { studentProfile: true, hrProfile: true },
    });
  }

  /** Повертає публічну інформацію користувача для блоків профілю. */
  async findPublicInfoById(userId: string) {
    return this.db.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        middleName: true,
        photoUrl: true,
        status: true,
      },
    });
  }

  /** Шукає користувача за Clerk user id. */
  async findUserByClerkId(clerkUserId: string) {
    return this.db.user.findUnique({
      where: { clerkUserId },
      include: { studentProfile: true, hrProfile: { include: { company: true } } },
    });
  }

  /** Шукає користувача за email. */
  async findUserByEmail(email: string) {
    return this.db.user.findUnique({
      where: { email: email.toLowerCase() },
      include: { studentProfile: true, hrProfile: true },
    });
  }

  /** Оновлює роль користувача. */
  async updateUserRole(userId: string, role: UserRole) {
    return this.db.user.update({
      where: { id: userId },
      data: { role },
    });
  }

  /** Оновлює статус користувача. */
  async updateUserStatus(userId: string, status: UserStatus) {
    return this.db.user.update({
      where: { id: userId },
      data: { status },
    });
  }

  /** Оновлює базову персональну інформацію користувача. */
  async updateUserIdentity(
    userId: string,
    data: {
      firstName?: string;
      lastName?: string;
      middleName?: string | null;
      photoUrl?: string | null;
    },
  ) {
    return this.db.user.update({
      where: { id: userId },
      data,
    });
  }

  /** Позначає користувача як видаленого за Clerk user id. */
  async markDeletedByClerkId(clerkUserId: string) {
    return this.db.user.update({
      where: { clerkUserId },
      data: { status: UserStatus.DELETED },
    });
  }

  /** Оновлює email користувача у локальній БД. */
  async updateEmail(userId: string, email: string) {
    return this.db.user.update({
      where: { id: userId },
      data: { email: email.toLowerCase() },
    });
  }

  /** Синхронізує поля, які приходять із Clerk user.updated. */
  async updateClerkSyncedUser(clerkUserId: string, data: Partial<BaseUserData>) {
    return this.db.user.update({
      where: { clerkUserId },
      data: {
        email: data.email?.toLowerCase(),
        firstName: data.firstName ?? undefined,
        lastName: data.lastName ?? undefined,
        middleName: data.middleName ?? undefined,
        photoUrl: data.photoUrl ?? undefined,
      },
    });
  }
}

export const userRepository = new UserRepository();
