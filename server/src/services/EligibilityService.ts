import { ListingStatus, ProfileVisibility } from "../../prisma/generated/client/index.js";
import { BusinessLogicError, HttpStatus } from "../errors/BusinessLogicError.js";
import {
  ApplicationRepository,
  applicationRepository,
} from "../repositories/ApplicationRepository.js";
import {
  StudentProfileRepository,
  studentProfileRepository,
} from "../repositories/StudentProfileRepository.js";
import {
  VacancyRepository,
  vacancyRepository,
} from "../repositories/VacancyRepository.js";
import {
  MatchingScoreService,
  matchingScoreService,
} from "./MatchingScoreService.js";

export class EligibilityService {
  /** Створює сервіс blocking-перевірок можливості подати відгук. */
  constructor(
    private readonly vacancies: VacancyRepository = vacancyRepository,
    private readonly students: StudentProfileRepository = studentProfileRepository,
    private readonly applications: ApplicationRepository = applicationRepository,
    private readonly matching: MatchingScoreService = matchingScoreService,
  ) {}

  /** Перевіряє всі блокуючі умови, що підтримуються поточною моделлю даних. */
  async checkCanApply(studentProfileId: string, vacancyId: string) {
    const [vacancy, student, existingApplication, matchPreview] = await Promise.all([
      this.vacancies.findVacancyById(vacancyId),
      this.students.findForApplicationMatchById(studentProfileId),
      this.applications.findByVacancyAndStudent(vacancyId, studentProfileId),
      this.matching.calculateApplicationMatch(vacancyId, studentProfileId),
    ]);
    if (!vacancy) {
      throw new BusinessLogicError("Vacancy not found", HttpStatus.NOT_FOUND, "VACANCY_NOT_FOUND");
    }
    if (!student) {
      throw new BusinessLogicError("Student profile not found", HttpStatus.NOT_FOUND, "STUDENT_PROFILE_NOT_FOUND");
    }

    const blockingReasons: string[] = [];
    if (vacancy.status !== ListingStatus.ACTIVE) blockingReasons.push("VACANCY_NOT_ACTIVE");
    if (vacancy.closingDate < this.todayDateOnly()) blockingReasons.push("VACANCY_EXPIRED");
    if (existingApplication) blockingReasons.push("APPLICATION_ALREADY_EXISTS");
    if (student.visibility === ProfileVisibility.HIDDEN) blockingReasons.push("PROFILE_HIDDEN");
    if (matchPreview.missingCriticalSkills.length > 0) blockingReasons.push("MISSING_CRITICAL_SKILLS");
    if (matchPreview.missingLanguages.length > 0) blockingReasons.push("MISSING_REQUIRED_LANGUAGES");
    if (matchPreview.locationMismatch) blockingReasons.push("LOCATION_MISMATCH");

    return {
      canApply: blockingReasons.length === 0,
      blockingReasons,
      missingCriticalSkills: matchPreview.missingCriticalSkills,
      missingLanguages: matchPreview.missingLanguages,
      locationMismatch: matchPreview.locationMismatch,
      profileWarnings: this.profileWarnings(student),
      matchPreview,
    };
  }

  /** Повертає рекомендації щодо профілю, які не блокують створення Application. */
  private profileWarnings(student: NonNullable<Awaited<ReturnType<StudentProfileRepository["findForApplicationMatchById"]>>>) {
    const warnings: string[] = [];
    if (!student.about?.trim()) warnings.push("PROFILE_ABOUT_EMPTY");
    if (student.links.length === 0) warnings.push("PROFILE_LINKS_EMPTY");
    return warnings;
  }

  /** Повертає початок поточної локальної дати для перевірки дедлайну вакансії. */
  private todayDateOnly() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
  }
}

export const eligibilityService = new EligibilityService();
