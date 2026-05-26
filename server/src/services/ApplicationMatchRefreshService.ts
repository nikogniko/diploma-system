import { Prisma } from "../../prisma/generated/client/index.js";
import {
  ApplicationRepository,
  applicationRepository,
} from "../repositories/ApplicationRepository.js";
import {
  MatchingScoreService,
  matchingScoreService,
} from "./MatchingScoreService.js";

export class ApplicationMatchRefreshService {
  /** Створює сервіс актуалізації збережених результатів аналізу applications. */
  constructor(
    private readonly applications: ApplicationRepository = applicationRepository,
    private readonly matching: MatchingScoreService = matchingScoreService,
  ) {}

  /** Перераховує всі applications студента після зміни його matching-даних. */
  async recalculateForStudent(studentProfileId: string) {
    const applications = await this.applications.listStudentApplications(studentProfileId);
    return Promise.all(applications.map((application) => this.recalculateApplication(
      application.id,
      application.vacancyId,
      application.studentProfileId,
    )));
  }

  /** Перераховує всі applications вакансії після зміни її вимог. */
  async recalculateForVacancy(vacancyId: string) {
    const applications = await this.applications.listByVacancyId(vacancyId);
    return Promise.all(applications.map((application) => this.recalculateApplication(
      application.id,
      application.vacancyId,
      application.studentProfileId,
    )));
  }

  /** Обчислює та зберігає актуальні totalScore і matchDetails одного відгуку. */
  private async recalculateApplication(applicationId: string, vacancyId: string, studentProfileId: string) {
    const result = await this.matching.calculateApplicationMatch(vacancyId, studentProfileId);
    return this.applications.updateMatchResult(applicationId, result.score, result as Prisma.InputJsonValue);
  }
}

export const applicationMatchRefreshService = new ApplicationMatchRefreshService();
