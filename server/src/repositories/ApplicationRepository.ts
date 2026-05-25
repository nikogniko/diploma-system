import {
  ApplicationStatus,
  Prisma,
} from "../../prisma/generated/client/index.js";
import { prisma } from "../config/db.js";
import { vacancyInclude } from "./VacancyRepository.js";
import type { DbClient } from "./repositoryTypes.js";

export type CreateApplicationData = {
  vacancyId: string;
  studentProfileId: string;
  coverLetter?: string | null;
  matchScore?: number | null;
  matchDetails?: Prisma.InputJsonValue;
};

export const applicationInclude = {
  vacancy: { include: vacancyInclude },
  studentProfile: { include: { user: true } },
  statusHistory: { orderBy: { createdAt: "asc" as const } },
} satisfies Prisma.ApplicationInclude;

export class ApplicationRepository {
  /** Створює persistence adapter для відгуків поверх переданого Prisma client. */
  constructor(private readonly db: DbClient = prisma) {}

  /** Знаходить відгук студента на конкретну вакансію для перевірки дублювання. */
  async findByVacancyAndStudent(vacancyId: string, studentProfileId: string) {
    return this.db.application.findUnique({
      where: { vacancyId_studentProfileId: { vacancyId, studentProfileId } },
      include: applicationInclude,
    });
  }

  /** Створює новий відгук кандидата зі snapshot даними відповідності. */
  async createApplication(data: CreateApplicationData) {
    return this.db.application.create({
      data,
      include: applicationInclude,
    });
  }

  /** Додає незмінний запис аудиту переходу статусу Application. */
  async createStatusHistory(data: {
    applicationId: string;
    fromStatus: ApplicationStatus | null;
    toStatus: ApplicationStatus;
    changedByUserId: string;
  }) {
    return this.db.applicationStatusHistory.create({ data });
  }

  /** Повертає відгуки, створені поточним студентом. */
  async listStudentApplications(studentProfileId: string) {
    return this.db.application.findMany({
      where: { studentProfileId },
      orderBy: { createdAt: "desc" },
      include: applicationInclude,
    });
  }

  /** Повертає відгуки лише для вакансії компанії поточного HR. */
  async listVacancyApplicationsForCompany(vacancyId: string, companyId: string) {
    return this.db.application.findMany({
      where: { vacancyId, vacancy: { companyId } },
      orderBy: { createdAt: "desc" },
      include: applicationInclude,
    });
  }

  /** Знаходить відгук із даними власності для перевірки переходу статусу. */
  async findApplicationById(applicationId: string) {
    return this.db.application.findUnique({
      where: { id: applicationId },
      include: applicationInclude,
    });
  }

  /** Оновлює поточний статус відгуку після авторизаційних перевірок сервісу. */
  async updateStatus(applicationId: string, status: ApplicationStatus) {
    return this.db.application.update({
      where: { id: applicationId },
      data: { status },
      include: applicationInclude,
    });
  }

  /** Перевіряє, чи вакансія вже має іншого найнятого кандидата. */
  async hasOtherHiredApplication(vacancyId: string, applicationId: string) {
    const count = await this.db.application.count({
      where: {
        vacancyId,
        id: { not: applicationId },
        status: ApplicationStatus.HIRED,
      },
    });
    return count > 0;
  }
}

export const applicationRepository = new ApplicationRepository();
