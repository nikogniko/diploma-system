import {
  ApplicationStatus,
  Prisma,
  UserRole,
} from "../../prisma/generated/client/index.js";
import { BusinessLogicError, HttpStatus } from "../errors/BusinessLogicError.js";
import {
  ApplicationRepository,
  applicationRepository,
} from "../repositories/ApplicationRepository.js";
import {
  HrProfileRepository,
  hrProfileRepository,
} from "../repositories/HrProfileRepository.js";
import {
  StudentProfileRepository,
  studentProfileRepository,
} from "../repositories/StudentProfileRepository.js";
import { TransactionManager, transactionManager } from "../repositories/TransactionManager.js";
import { UserRepository, userRepository } from "../repositories/UserRepository.js";
import {
  VacancyRepository,
  vacancyRepository,
} from "../repositories/VacancyRepository.js";
import { EligibilityService, eligibilityService } from "./EligibilityService.js";
import { MatchingScoreService, matchingScoreService } from "./MatchingScoreService.js";
import { OutboxEventService, outboxEventService } from "./OutboxEventService.js";

export type ApplicationCreateRequest = {
  vacancyId?: string;
  coverLetter?: string | null;
};

export class ApplicationService {
  /** Створює сервіс application flow із залежностями репозиторіїв і транзакцій. */
  constructor(
    private readonly applications: ApplicationRepository = applicationRepository,
    private readonly vacancies: VacancyRepository = vacancyRepository,
    private readonly students: StudentProfileRepository = studentProfileRepository,
    private readonly hrs: HrProfileRepository = hrProfileRepository,
    private readonly users: UserRepository = userRepository,
    private readonly eligibility: EligibilityService = eligibilityService,
    private readonly matching: MatchingScoreService = matchingScoreService,
    private readonly transactions: TransactionManager = transactionManager,
    private readonly outbox: OutboxEventService = outboxEventService,
  ) {}

  /** Повертає детальну eligibility-відповідь для поточного студента. */
  async checkEligibility(clerkUserId: string, vacancyId: string) {
    const student = await this.getStudentActorOrThrow(clerkUserId);
    return this.eligibility.checkCanApply(student.profile.id, vacancyId);
  }

  /** Створює Application, початкову історію та outbox event у єдиній транзакції. */
  async createApplication(clerkUserId: string, body: ApplicationCreateRequest) {
    const vacancyId = this.requiredVacancyId(body.vacancyId);
    const student = await this.getStudentActorOrThrow(clerkUserId);
    const eligibility = await this.eligibility.checkCanApply(student.profile.id, vacancyId);
    if (!eligibility.canApply) {
      throw new BusinessLogicError(
        "Application eligibility check failed",
        HttpStatus.BAD_REQUEST,
        "APPLICATION_NOT_ELIGIBLE",
        eligibility,
      );
    }
    const matchPreview = await this.matching.calculateApplicationMatch(vacancyId, student.profile.id);
    const coverLetter = typeof body.coverLetter === "string" && body.coverLetter.trim()
      ? body.coverLetter.trim()
      : null;

    return this.transactions.run(async (tx) => {
      const applications = new ApplicationRepository(tx);
      const created = await applications.createApplication({
        vacancyId,
        studentProfileId: student.profile.id,
        coverLetter,
        // TODO: записувати matchScore після погодження фінальної прозорої формули.
        matchScore: null,
        matchDetails: matchPreview as Prisma.InputJsonValue,
      });
      await applications.createStatusHistory({
        applicationId: created.id,
        fromStatus: null,
        toStatus: ApplicationStatus.SENT,
        changedByUserId: student.user.id,
      });
      await this.outbox.applicationCreated(tx, created.id, vacancyId);
      return applications.findApplicationById(created.id);
    });
  }

  /** Повертає лише відгуки поточного студента. */
  async listMyApplications(clerkUserId: string) {
    const student = await this.getStudentActorOrThrow(clerkUserId);
    return this.applications.listStudentApplications(student.profile.id);
  }

  /** Повертає applications вакансії лише HR з компанії-власника вакансії. */
  async listVacancyApplications(clerkUserId: string, vacancyId: string) {
    const hr = await this.getHrActorOrThrow(clerkUserId);
    const vacancy = await this.vacancies.findVacancyById(vacancyId);
    if (!vacancy || vacancy.companyId !== hr.profile.companyId) {
      throw new BusinessLogicError("Vacancy not found", HttpStatus.NOT_FOUND, "VACANCY_NOT_FOUND");
    }
    return this.applications.listVacancyApplicationsForCompany(vacancyId, hr.profile.companyId);
  }

  /** Змінює статус Application із role-based доступом, history та outbox-подіями. */
  async changeStatus(clerkUserId: string, applicationId: string, requestedStatus: unknown) {
    const actor = await this.getActorOrThrow(clerkUserId);
    const status = this.normalizeApplicationStatus(requestedStatus);
    const current = await this.getApplicationOrThrow(applicationId);
    this.assertCanChangeStatus(actor, current, status);
    if (current.status === status) return current;

    return this.transactions.run(async (tx) => {
      const applications = new ApplicationRepository(tx);
      const vacancies = new VacancyRepository(tx);
      const lockedCurrent = await applications.findApplicationById(applicationId);
      if (!lockedCurrent) {
        throw new BusinessLogicError("Application not found", HttpStatus.NOT_FOUND, "APPLICATION_NOT_FOUND");
      }
      this.assertCanChangeStatus(actor, lockedCurrent, status);
      if (lockedCurrent.status === status) return lockedCurrent;

      if (status === ApplicationStatus.HIRED
        && await applications.hasOtherHiredApplication(lockedCurrent.vacancyId, lockedCurrent.id)) {
        throw new BusinessLogicError(
          "Vacancy already has a hired application",
          HttpStatus.CONFLICT,
          "VACANCY_ALREADY_HAS_HIRED_APPLICATION",
        );
      }

      await applications.updateStatus(applicationId, status);
      await applications.createStatusHistory({
        applicationId,
        fromStatus: lockedCurrent.status,
        toStatus: status,
        changedByUserId: actor.id,
      });
      await this.outbox.applicationUpdated(tx, applicationId, status);

      if (status === ApplicationStatus.HIRED) {
        await vacancies.closeVacancyAsHired(lockedCurrent.vacancyId);
        await this.outbox.vacancyClosedByHire(tx, lockedCurrent.vacancyId);
      }

      return applications.findApplicationById(applicationId);
    });
  }

  /** Знаходить application або повертає контрольовану помилку API. */
  private async getApplicationOrThrow(applicationId: string) {
    const application = await this.applications.findApplicationById(applicationId);
    if (!application) {
      throw new BusinessLogicError("Application not found", HttpStatus.NOT_FOUND, "APPLICATION_NOT_FOUND");
    }
    return application;
  }

  /** Завантажує поточного користувача з його role/profile зв'язками. */
  private async getActorOrThrow(clerkUserId: string) {
    const user = await this.users.findUserByClerkId(clerkUserId);
    if (!user) {
      throw new BusinessLogicError("User not found", HttpStatus.UNAUTHORIZED, "UNAUTHORIZED");
    }
    return user;
  }

  /** Завантажує поточного студента та гарантує наявність student profile. */
  private async getStudentActorOrThrow(clerkUserId: string) {
    const user = await this.getActorOrThrow(clerkUserId);
    if (user.role !== UserRole.STUDENT || !user.studentProfile) {
      throw new BusinessLogicError("Student access required", HttpStatus.FORBIDDEN, "STUDENT_ACCESS_REQUIRED");
    }
    const profile = await this.students.findById(user.studentProfile.id);
    if (!profile) {
      throw new BusinessLogicError("Student profile not found", HttpStatus.NOT_FOUND, "STUDENT_PROFILE_NOT_FOUND");
    }
    return { user, profile };
  }

  /** Завантажує поточного HR та гарантує наявність hr profile. */
  private async getHrActorOrThrow(clerkUserId: string) {
    const user = await this.getActorOrThrow(clerkUserId);
    if (user.role !== UserRole.HR || !user.hrProfile) {
      throw new BusinessLogicError("HR access required", HttpStatus.FORBIDDEN, "HR_ACCESS_REQUIRED");
    }
    const profile = await this.hrs.findById(user.hrProfile.id);
    if (!profile) {
      throw new BusinessLogicError("HR profile not found", HttpStatus.NOT_FOUND, "HR_PROFILE_NOT_FOUND");
    }
    return { user, profile };
  }

  /** Перевіряє право HR або студента виконати запитаний status transition. */
  private assertCanChangeStatus(
    actor: Awaited<ReturnType<ApplicationService["getActorOrThrow"]>>,
    application: Awaited<ReturnType<ApplicationService["getApplicationOrThrow"]>>,
    status: ApplicationStatus,
  ) {
    if (actor.role === UserRole.STUDENT) {
      if (actor.studentProfile?.id !== application.studentProfileId || status !== ApplicationStatus.WITHDRAWN) {
        throw new BusinessLogicError("Student can only withdraw own application", HttpStatus.FORBIDDEN, "STATUS_CHANGE_FORBIDDEN");
      }
      return;
    }
    if (actor.role === UserRole.HR && actor.hrProfile?.id === application.vacancy.hrProfileId) return;
    throw new BusinessLogicError("Application status change is forbidden", HttpStatus.FORBIDDEN, "STATUS_CHANGE_FORBIDDEN");
  }

  /** Валідує id вакансії у body eligibility/create запиту. */
  private requiredVacancyId(value: unknown) {
    if (typeof value !== "string" || !value.trim()) {
      throw new BusinessLogicError("vacancyId is required", HttpStatus.BAD_REQUEST, "VACANCY_ID_REQUIRED");
    }
    return value.trim();
  }

  /** Перетворює вхідний статус на підтримуваний ApplicationStatus enum. */
  private normalizeApplicationStatus(value: unknown) {
    if (typeof value !== "string" || !Object.values(ApplicationStatus).includes(value as ApplicationStatus)) {
      throw new BusinessLogicError("Invalid application status", HttpStatus.BAD_REQUEST, "INVALID_APPLICATION_STATUS");
    }
    return value as ApplicationStatus;
  }
}

export const applicationService = new ApplicationService();
