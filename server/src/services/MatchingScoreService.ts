import {
  LanguageLevel,
  RequirementWeight,
} from "../../prisma/generated/client/index.js";
import { BusinessLogicError, HttpStatus } from "../errors/BusinessLogicError.js";
import {
  StudentProfileRepository,
  studentProfileRepository,
} from "../repositories/StudentProfileRepository.js";
import {
  VacancyRepository,
  vacancyRepository,
} from "../repositories/VacancyRepository.js";

const languageRank: Record<LanguageLevel, number> = {
  A1: 1,
  A2: 2,
  B1: 3,
  B2: 4,
  C1: 5,
  C2: 6,
  NATIVE: 7,
};

type MatchStudent = NonNullable<Awaited<ReturnType<StudentProfileRepository["findForApplicationMatchById"]>>>;
type MatchVacancy = NonNullable<Awaited<ReturnType<VacancyRepository["findVacancyById"]>>>;

export class MatchingScoreService {
  /** Створює сервіс фактологічного match preview на основі даних PostgreSQL. */
  constructor(
    private readonly vacancies: VacancyRepository = vacancyRepository,
    private readonly students: StudentProfileRepository = studentProfileRepository,
  ) {}

  /** Обчислює стабільний preview відповідності без фінального рейтингового score. */
  async calculateApplicationMatch(vacancyId: string, studentProfileId: string) {
    const [vacancy, student] = await Promise.all([
      this.vacancies.findVacancyById(vacancyId),
      this.students.findForApplicationMatchById(studentProfileId),
    ]);
    if (!vacancy) {
      throw new BusinessLogicError("Vacancy not found", HttpStatus.NOT_FOUND, "VACANCY_NOT_FOUND");
    }
    if (!student) {
      throw new BusinessLogicError("Student profile not found", HttpStatus.NOT_FOUND, "STUDENT_PROFILE_NOT_FOUND");
    }

    return this.buildMatchExplanation(vacancy, student);
  }

  /** Формує пояснення збігів і невиконаних базових вимог без ES `_score`. */
  buildMatchExplanation(vacancy: MatchVacancy, student: MatchStudent) {
    const profileSkillIds = this.collectStudentSkillIds(student);
    const skillsByWeight = (weight: RequirementWeight) => vacancy.skills.filter((item) => item.weight === weight);
    const matchedSkills = (weight: RequirementWeight) => skillsByWeight(weight)
      .filter((item) => profileSkillIds.has(item.skillId))
      .map((item) => ({ id: item.skillId, name: item.skill.name }));
    const missingCriticalSkills = skillsByWeight(RequirementWeight.CRITICAL)
      .filter((item) => !profileSkillIds.has(item.skillId))
      .map((item) => ({ id: item.skillId, name: item.skill.name }));
    const languageById = new Map(student.languages.map((item) => [item.languageId, item]));
    const missingLanguages = vacancy.languages.flatMap((requirement) => {
      const actual = languageById.get(requirement.languageId);
      const matches = actual && languageRank[actual.level] >= languageRank[requirement.level];
      return matches ? [] : [{
        id: requirement.languageId,
        name: requirement.language.name,
        requiredLevel: requirement.level,
        currentLevel: actual?.level ?? null,
      }];
    });
    const desiredLocationIds = new Set(student.desiredLocations.map((item) => item.locationId));
    const locationMismatch = vacancy.isLocationCritical
      && !vacancy.locations.some((item) => desiredLocationIds.has(item.locationId));
    const mandatoryTotal = skillsByWeight(RequirementWeight.CRITICAL).length
      + vacancy.languages.length
      + (vacancy.isLocationCritical ? 1 : 0);
    const mandatoryMissing = missingCriticalSkills.length + missingLanguages.length + (locationMismatch ? 1 : 0);
    const baseRequirementsPercent = mandatoryTotal === 0
      ? 100
      : Math.round(((mandatoryTotal - mandatoryMissing) / mandatoryTotal) * 100);

    return {
      score: null,
      baseRequirementsPercent,
      detailedScore: {
        formulaStatus: "PENDING",
        mandatorySatisfiedCount: mandatoryTotal - mandatoryMissing,
        mandatoryTotal,
      },
      explanation: {
        source: "POSTGRESQL_PRISMA",
        finalScoreCalculated: false,
        reason: "FINAL_MATCH_FORMULA_TODO",
      },
      matchedCriticalSkills: matchedSkills(RequirementWeight.CRITICAL),
      missingCriticalSkills,
      matchedImportantSkills: matchedSkills(RequirementWeight.IMPORTANT),
      matchedPlusSkills: matchedSkills(RequirementWeight.NICE_TO_HAVE),
      missingLanguages,
      locationMismatch,
    };
  }

  /** Збирає унікальні skills студента з досвіду, проєктів і курсів поточної моделі. */
  private collectStudentSkillIds(student: MatchStudent) {
    return new Set([
      ...student.experiences.flatMap((item) => item.skills.map((skill) => skill.skillId)),
      ...student.projects.flatMap((item) => item.skills.map((skill) => skill.skillId)),
      ...student.courses.flatMap((item) => item.skills.map((skill) => skill.skillId)),
    ]);
  }
}

export const matchingScoreService = new MatchingScoreService();
