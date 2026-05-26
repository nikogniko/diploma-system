import {
  Degree,
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

export const requirementWeightRank: Record<RequirementWeight, number> = {
  CRITICAL: 3,
  IMPORTANT: 2,
  NICE_TO_HAVE: 1,
};

export const languageLevelRank: Record<LanguageLevel, number> = {
  A1: 1,
  A2: 2,
  B1: 3,
  B2: 4,
  C1: 5,
  C2: 6,
  NATIVE: 7,
};

const educationBonusRank: Record<Degree, number> = {
  JUNIOR_BACHELOR: 4,
  BACHELOR: 6,
  MASTER: 8,
  PHD: 10,
  OTHER: 0,
};

type MatchStudent = NonNullable<Awaited<ReturnType<StudentProfileRepository["findForApplicationMatchById"]>>>;
type MatchVacancy = NonNullable<Awaited<ReturnType<VacancyRepository["findVacancyById"]>>>;
type RequirementCategory =
  | "PROFESSION"
  | "SKILL"
  | "LANGUAGE"
  | "LOCATION"
  | "EMPLOYMENT_TYPE"
  | "WORK_SCHEDULE"
  | "WORK_FORMAT"
  | "SALARY";
type LocationMatchType = "EXACT" | "BROAD" | "NONE";

export type RequirementItem = {
  key: string;
  label: string;
  category: RequirementCategory;
  weight: number;
  matched: boolean;
  isBlocking: boolean;
  blockingReason: string | null;
  details?: Record<string, unknown>;
};

export class MatchingScoreService {
  /** Створює сервіс детермінованої оцінки відповідності на даних PostgreSQL. */
  constructor(
    private readonly vacancies: VacancyRepository = vacancyRepository,
    private readonly students: StudentProfileRepository = studentProfileRepository,
  ) {}

  /** Завантажує дані вакансії й профілю та обчислює повний application match. */
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

  /** Формує дві метрики, деталізацію джерел балів та eligibility snapshot. */
  buildMatchExplanation(vacancy: MatchVacancy, student: MatchStudent) {
    const skillBreakdown = vacancy.skills.map((skill) => this.calculateSkillBreakdown(skill, student));
    const skillById = new Map(skillBreakdown.map((skill) => [skill.skillId, skill]));
    const matchedCriticalSkills = this.skillsByMatch(vacancy, skillById, RequirementWeight.CRITICAL, true);
    const missingCriticalSkills = this.skillsByMatch(vacancy, skillById, RequirementWeight.CRITICAL, false);
    const matchedImportantSkills = this.skillsByMatch(vacancy, skillById, RequirementWeight.IMPORTANT, true);
    const missingImportantSkills = this.skillsByMatch(vacancy, skillById, RequirementWeight.IMPORTANT, false);
    const matchedPlusSkills = this.skillsByMatch(vacancy, skillById, RequirementWeight.NICE_TO_HAVE, true);
    const missingPlusSkills = this.skillsByMatch(vacancy, skillById, RequirementWeight.NICE_TO_HAVE, false);
    const languageBreakdown = this.buildLanguageBreakdown(vacancy, student);
    const missingLanguages = languageBreakdown
      .filter((item) => !item.matched)
      .map((item) => ({
        id: item.languageId,
        name: item.languageName,
        requiredLevel: item.requiredLevel,
        currentLevel: item.studentLevel,
      }));
    const locationBreakdown = this.buildLocationBreakdown(vacancy, student);
    const locationMismatch = vacancy.isLocationCritical && locationBreakdown.matchType === "NONE";
    const educationBreakdown = this.buildEducationBreakdown(student);
    const activeSearchBonus = student.isActiveSearch ? 5 : 0;
    const requirements = this.buildRequirementItems(vacancy, student, skillById, languageBreakdown, locationBreakdown);
    const baseRequirements = this.summarizeRequirements(requirements);
    const missingBlockingRequirements = requirements.filter((item) => item.isBlocking && !item.matched);
    const blockingReasons = [...new Set(missingBlockingRequirements
      .map((item) => item.blockingReason)
      .filter((reason): reason is string => Boolean(reason)))];
    const matchesBlockingRequirements = missingBlockingRequirements.length === 0;
    const skillDepthScore = this.round(skillBreakdown.reduce((sum, item) => sum + item.skillScore, 0));
    const additionalCriteriaScore = this.round(
      languageBreakdown.reduce((sum, item) => sum + item.languageBonus, 0)
      + locationBreakdown.locationBonus
      + educationBreakdown.educationBonus
      + activeSearchBonus,
    );
    const totalScore = this.round(skillDepthScore + additionalCriteriaScore);
    return {
      score: totalScore,
      baseRequirementsPercent: baseRequirements.baseRequirementsPercent,
      detailedScore: {
        skillDepthScore,
        additionalCriteriaScore,
        totalScore,
      },
      explanation: this.buildExplanation({
        baseRequirementsPercent: baseRequirements.baseRequirementsPercent,
        matchesBlockingRequirements,
        missingCriticalSkills,
        missingImportantSkills,
        missingLanguages,
        locationBreakdown,
        skillBreakdown,
        languageBreakdown,
        educationBreakdown,
        activeSearchBonus,
      }),
      matchedCriticalSkills,
      missingCriticalSkills,
      matchedImportantSkills,
      missingImportantSkills,
      matchedPlusSkills,
      missingPlusSkills,
      missingLanguages,
      locationMismatch,
      requirementEligibility: {
        matchesBlockingRequirements,
        blockingReasons,
        missingBlockingRequirements,
      },
      details: {
        baseRequirements,
        skillBreakdown,
        languageBreakdown,
        locationBreakdown,
        educationBreakdown,
        activeSearchBonus,
        warnings: [],
      },
    };
  }

  /** Будує weighted items для покриття вимог і допуску за критичними навичками та обов'язковими умовами. */
  private buildRequirementItems(
    vacancy: MatchVacancy,
    student: MatchStudent,
    skillById: Map<number, ReturnType<MatchingScoreService["calculateSkillBreakdown"]>>,
    languageBreakdown: ReturnType<MatchingScoreService["buildLanguageBreakdown"]>,
    locationBreakdown: ReturnType<MatchingScoreService["buildLocationBreakdown"]>,
  ): RequirementItem[] {
    const professionMatched = student.desiredProfessions.some((item) => item.professionId === vacancy.professionId);
    const items: RequirementItem[] = [{
      key: `profession:${vacancy.professionId}`,
      label: vacancy.profession.name,
      category: "PROFESSION",
      weight: requirementWeightRank.CRITICAL,
      matched: professionMatched,
      isBlocking: true,
      blockingReason: professionMatched ? null : "MISSING_REQUIRED_CONDITIONS",
      details: {
        studentValues: student.desiredProfessions.map((item) => item.profession.name),
      },
    }];
    items.push(...vacancy.skills.map((item) => {
      const matched = Boolean(skillById.get(item.skillId)?.matched);
      const isBlocking = item.weight === RequirementWeight.CRITICAL;
      return {
        key: `skill:${item.skillId}`,
        label: item.skill.name,
        category: "SKILL" as const,
        weight: requirementWeightRank[item.weight],
        matched,
        isBlocking,
        blockingReason: isBlocking && !matched ? "MISSING_CRITICAL_SKILLS" : null,
        details: { requirementWeight: item.weight },
      };
    }));
    items.push(...languageBreakdown.map((item) => ({
      key: `language:${item.languageId}`,
      label: item.languageName,
      category: "LANGUAGE" as const,
      weight: requirementWeightRank.CRITICAL,
      matched: item.matched,
      isBlocking: true,
      blockingReason: item.matched ? null : "MISSING_REQUIRED_LANGUAGES",
      details: { requiredLevel: item.requiredLevel, studentLevel: item.studentLevel },
    })));
    if (vacancy.locations.length > 0) {
      items.push({
        key: "location",
        label: "LOCATION",
        category: "LOCATION",
        weight: vacancy.isLocationCritical ? requirementWeightRank.CRITICAL : requirementWeightRank.NICE_TO_HAVE,
        matched: locationBreakdown.matchType !== "NONE",
        isBlocking: vacancy.isLocationCritical,
        blockingReason: vacancy.isLocationCritical && locationBreakdown.matchType === "NONE" ? "LOCATION_MISMATCH" : null,
        details: { matchType: locationBreakdown.matchType },
      });
    }
    this.pushOverlapRequirement(
      items,
      "EMPLOYMENT_TYPE",
      vacancy.employmentTypes.map((item) => ({ id: item.employmentTypeId, label: item.employmentType.name })),
      student.employmentTypes.map((item) => ({ id: item.employmentTypeId, label: item.employmentType.name })),
    );
    this.pushOverlapRequirement(
      items,
      "WORK_SCHEDULE",
      vacancy.workSchedules.map((item) => ({ id: item.workScheduleId, label: item.workSchedule.name })),
      student.workSchedules.map((item) => ({ id: item.workScheduleId, label: item.workSchedule.name })),
    );
    this.pushOverlapRequirement(
      items,
      "WORK_FORMAT",
      vacancy.workFormats.map((item) => ({ id: item.workFormatId, label: item.workFormat.name })),
      student.workFormats.map((item) => ({ id: item.workFormatId, label: item.workFormat.name })),
    );
    if (vacancy.minSalary !== null || vacancy.maxSalary !== null) {
      const salaryLimit = vacancy.maxSalary ?? vacancy.minSalary;
      const matched = student.minSalary === null || (salaryLimit !== null && student.minSalary <= salaryLimit);
      items.push({
        key: "salary",
        label: "SALARY",
        category: "SALARY",
        weight: requirementWeightRank.CRITICAL,
        matched,
        isBlocking: true,
        blockingReason: matched ? null : "MISSING_REQUIRED_CONDITIONS",
        details: {
          studentMinSalary: student.minSalary,
          vacancyMinSalary: vacancy.minSalary,
          vacancyMaxSalary: vacancy.maxSalary,
          salaryPeriod: vacancy.salaryPeriod,
        },
      });
    }
    return items;
  }

  /** Додає одну grouped-вимогу для налаштувань роботи, якщо вона задана у вакансії. */
  private pushOverlapRequirement(
    items: RequirementItem[],
    category: Extract<RequirementCategory, "EMPLOYMENT_TYPE" | "WORK_SCHEDULE" | "WORK_FORMAT">,
    vacancyValues: Array<{ id: number; label: string }>,
    studentValues: Array<{ id: number; label: string }>,
  ) {
    if (vacancyValues.length === 0) return;
    const studentIds = new Set(studentValues.map((item) => item.id));
    const matched = vacancyValues.some((item) => studentIds.has(item.id));
    items.push({
      key: category.toLowerCase(),
      label: category,
      category,
      weight: requirementWeightRank.CRITICAL,
      matched,
      isBlocking: true,
      blockingReason: matched ? null : "MISSING_REQUIRED_CONDITIONS",
      details: {
        requiredValues: vacancyValues.map((item) => item.label),
        studentValues: studentValues.map((item) => item.label),
        matchedValues: vacancyValues.filter((item) => studentIds.has(item.id)).map((item) => item.label),
      },
    });
  }

  /** Підсумовує кількість, ваги та відсотки всіх і blocking-вимог. */
  private summarizeRequirements(items: RequirementItem[]) {
    const maxRequirementScore = items.reduce((sum, item) => sum + item.weight, 0);
    const matchedRequirementScore = items.filter((item) => item.matched).reduce((sum, item) => sum + item.weight, 0);
    const blockingItems = items.filter((item) => item.isBlocking);
    const matchedBlockingItems = blockingItems.filter((item) => item.matched);
    return {
      totalRequirementsCount: items.length,
      matchedRequirementsCount: items.filter((item) => item.matched).length,
      maxRequirementScore,
      matchedRequirementScore,
      baseRequirementsPercent: maxRequirementScore > 0
        ? this.round((matchedRequirementScore / maxRequirementScore) * 100)
        : 100,
      blockingRequirements: {
        totalCount: blockingItems.length,
        matchedCount: matchedBlockingItems.length,
        percent: blockingItems.length > 0 ? this.round((matchedBlockingItems.length / blockingItems.length) * 100) : 100,
      },
      items,
    };
  }

  /** Рахує глибину однієї навички за курсами, проєктами та досвідом. */
  private calculateSkillBreakdown(vacancySkill: MatchVacancy["skills"][number], student: MatchStudent) {
    const courses = student.courses.filter((course) => course.skills.some((skill) => skill.skillId === vacancySkill.skillId))
      .map((course) => ({
        id: course.id,
        title: course.title,
        hasCertificate: Boolean(course.certificateUrl),
        points: course.certificateUrl ? 4 : 2,
      }));
    const projects = student.projects.filter((project) => project.skills.some((skill) => skill.skillId === vacancySkill.skillId))
      .map((project) => ({
        id: project.id,
        title: project.title,
        hasProjectUrl: Boolean(project.projectUrl),
        points: project.projectUrl ? 8 : 6,
      }));
    const experiences = student.experiences.filter((experience) => experience.skills.some((skill) => skill.skillId === vacancySkill.skillId))
      .map((experience) => {
        const months = this.fullMonthsBetween(experience.startDate, experience.endDate ?? new Date());
        return {
          id: experience.id,
          position: experience.position,
          companyName: experience.companyName,
          months,
          points: months < 1 ? 1 : months * 2,
        };
      });
    const coursePoints = courses.reduce((sum, item) => sum + item.points, 0);
    const projectPoints = projects.reduce((sum, item) => sum + item.points, 0);
    const experiencePoints = experiences.reduce((sum, item) => sum + item.points, 0);
    const sourceSum = coursePoints + projectPoints + experiencePoints;
    const vacancyWeight = requirementWeightRank[vacancySkill.weight];
    return {
      skillId: vacancySkill.skillId,
      skillName: vacancySkill.skill.name,
      vacancyWeight,
      requirementWeight: vacancySkill.weight,
      matched: sourceSum > 0,
      coursePoints,
      projectPoints,
      experiencePoints,
      sourceSum,
      skillScore: this.round(vacancyWeight * sourceSum),
      sources: { courses, projects, experiences },
    };
  }

  /** Рахує бонус і достатність рівня для кожної мовної вимоги. */
  private buildLanguageBreakdown(vacancy: MatchVacancy, student: MatchStudent) {
    const studentLanguages = new Map(student.languages.map((item) => [item.languageId, item]));
    return vacancy.languages.map((requirement) => {
      const actual = studentLanguages.get(requirement.languageId);
      const levelDelta = actual ? languageLevelRank[actual.level] - languageLevelRank[requirement.level] : null;
      const matched = levelDelta !== null && levelDelta >= 0;
      const levelBonus = !matched ? 0 : levelDelta === 0 ? 2 : levelDelta === 1 ? 4 : 6;
      const baseLanguageBonus = levelBonus + (matched && actual?.certificateUrl ? 2 : 0);
      const weight = requirementWeightRank.CRITICAL;
      return {
        languageId: requirement.languageId,
        languageName: requirement.language.name,
        requiredLevel: requirement.level,
        studentLevel: actual?.level ?? null,
        levelDelta,
        matched,
        hasCertificate: Boolean(actual?.certificateUrl),
        baseLanguageBonus,
        weight,
        languageBonus: baseLanguageBonus * weight,
      };
    });
  }

  /** Визначає exact або broader збіг локації та нараховує bonus. */
  private buildLocationBreakdown(vacancy: MatchVacancy, student: MatchStudent) {
    const exact = vacancy.locations.some((required) =>
      student.desiredLocations.some((desired) => required.locationId === desired.locationId));
    const broad = !exact && !vacancy.isLocationCritical && vacancy.locations.some((required) =>
      student.desiredLocations.some((desired) => this.isBroaderLocationMatch(required.location, desired.location)));
    const matchType: LocationMatchType = exact ? "EXACT" : broad ? "BROAD" : "NONE";
    const baseLocationBonus = vacancy.isLocationCritical ? 0 : matchType === "EXACT" ? 4 : matchType === "BROAD" ? 2 : 0;
    const weight = vacancy.isLocationCritical ? requirementWeightRank.CRITICAL : requirementWeightRank.NICE_TO_HAVE;
    return {
      matchType,
      baseLocationBonus,
      weight,
      locationBonus: baseLocationBonus,
      bonusRule: vacancy.isLocationCritical ? "BLOCKING_LOCATION_NO_BONUS" : "OPTIONAL_LOCATION_BONUS",
    };
  }

  /** Порівнює нестрогі локації на один адміністративний рівень ширше. */
  private isBroaderLocationMatch(required: MatchVacancy["locations"][number]["location"], desired: MatchStudent["desiredLocations"][number]["location"]) {
    if (required.cityId !== null) {
      return desired.countryId === required.countryId && desired.regionId === required.regionId;
    }
    if (required.regionId !== null) return desired.countryId === required.countryId;
    return desired.countryId === required.countryId;
  }

  /** Знаходить найвищу освіту студента та її підтверджувальний бонус. */
  private buildEducationBreakdown(student: MatchStudent) {
    const highest = [...student.education].sort((first, second) =>
      educationBonusRank[second.degree] - educationBonusRank[first.degree])[0];
    if (!highest) return { highestDegree: null, hasDiplomaUrl: false, educationBonus: 0 };
    return {
      highestDegree: highest.degree,
      hasDiplomaUrl: Boolean(highest.diplomaUrl),
      educationBonus: educationBonusRank[highest.degree] + (highest.diplomaUrl ? 2 : 0),
    };
  }

  /** Відбирає matched або missing skills заданої ваги у стабільному DTO. */
  private skillsByMatch(
    vacancy: MatchVacancy,
    skillById: Map<number, ReturnType<MatchingScoreService["calculateSkillBreakdown"]>>,
    weight: RequirementWeight,
    matched: boolean,
  ) {
    return vacancy.skills.filter((item) => item.weight === weight && skillById.get(item.skillId)?.matched === matched)
      .map((item) => ({ id: item.skillId, name: item.skill.name }));
  }

  /** Формує текстові коди пояснення, сильних і слабких сторін без AI. */
  private buildExplanation(input: {
    baseRequirementsPercent: number;
    matchesBlockingRequirements: boolean;
    missingCriticalSkills: Array<{ id: number; name: string }>;
    missingImportantSkills: Array<{ id: number; name: string }>;
    missingLanguages: Array<{ name: string }>;
    locationBreakdown: ReturnType<MatchingScoreService["buildLocationBreakdown"]>;
    skillBreakdown: Array<ReturnType<MatchingScoreService["calculateSkillBreakdown"]>>;
    languageBreakdown: ReturnType<MatchingScoreService["buildLanguageBreakdown"]>;
    educationBreakdown: ReturnType<MatchingScoreService["buildEducationBreakdown"]>;
    activeSearchBonus: number;
  }) {
    const summaryCode = !input.matchesBlockingRequirements
      ? "MATCH_BLOCKING_MISSING"
      : input.baseRequirementsPercent < 70
        ? "MATCH_BLOCKING_PASSED_PARTIAL"
        : "MATCH_BLOCKING_PASSED_BASE";
    const strongestAreas = [
      ...(input.skillBreakdown.some((item) => item.projectPoints > 0) ? ["PROJECTS"] : []),
      ...(input.skillBreakdown.some((item) => item.coursePoints > 0) ? ["COURSES"] : []),
      ...(input.skillBreakdown.some((item) => item.experiencePoints > 0) ? ["EXPERIENCE"] : []),
      ...(input.languageBreakdown.some((item) => item.languageBonus > 0) ? ["LANGUAGES"] : []),
      ...(input.educationBreakdown.educationBonus > 0 ? ["EDUCATION"] : []),
      ...(input.locationBreakdown.locationBonus > 0 ? ["LOCATION"] : []),
      ...(input.activeSearchBonus > 0 ? ["ACTIVE_SEARCH"] : []),
    ];
    const weakestAreas = [
      ...input.missingCriticalSkills.map((item) => ({ code: "MISSING_CRITICAL_SKILL", label: item.name })),
      ...input.missingImportantSkills.map((item) => ({ code: "MISSING_IMPORTANT_SKILL", label: item.name })),
      ...input.missingLanguages.map((item) => ({ code: "MISSING_LANGUAGE", label: item.name })),
      ...(input.locationBreakdown.matchType === "NONE" ? [{ code: "NO_LOCATION_MATCH", label: null }] : []),
      ...(input.skillBreakdown.every((item) => item.sourceSum === 0) ? [{ code: "NO_SKILL_SOURCES", label: null }] : []),
    ];
    return {
      summary: summaryCode,
      strongestAreas,
      weakestAreas,
      recommendation: input.matchesBlockingRequirements ? "IMPROVE_SCORE" : "COVER_BLOCKING_REQUIREMENTS",
    };
  }

  /** Рахує повні місяці між датами для внеску підтвердженого досвіду. */
  private fullMonthsBetween(startDate: Date, endDate: Date) {
    let months = (endDate.getFullYear() - startDate.getFullYear()) * 12 + endDate.getMonth() - startDate.getMonth();
    if (endDate.getDate() < startDate.getDate()) months -= 1;
    return Math.max(0, months);
  }

  /** Округлює метрики до двох знаків після коми. */
  private round(value: number) {
    return Math.round(value * 100) / 100;
  }
}

export const matchingScoreService = new MatchingScoreService();
