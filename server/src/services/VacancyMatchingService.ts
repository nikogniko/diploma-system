import { RequirementWeight } from "../../prisma/generated/client/index.js";

type VacancyForMatching = {
  skills: Array<{ skillId: number; weight: RequirementWeight }>;
  languages: Array<{ languageId: number; level: string }>;
  locations: Array<{ locationId: string }>;
  isLocationCritical: boolean;
  workFormats: Array<{ workFormatId: number }>;
  employmentTypes: Array<{ employmentTypeId: number }>;
  workSchedules: Array<{ workScheduleId: number }>;
  minSalary?: number | null;
  maxSalary?: number | null;
  salaryPeriod?: string | null;
};

export const requirementWeightScore: Record<RequirementWeight, number> = {
  CRITICAL: 3,
  IMPORTANT: 2,
  NICE_TO_HAVE: 1,
};

/** Готує вимоги вакансії у стабільному форматі для майбутнього алгоритму метчингу. */
export function normalizeVacancyRequirements(vacancy: VacancyForMatching) {
  const groupSkillIds = (weight: RequirementWeight) =>
    vacancy.skills.filter((item) => item.weight === weight).map((item) => item.skillId);

  return {
    criticalSkills: groupSkillIds(RequirementWeight.CRITICAL),
    importantSkills: groupSkillIds(RequirementWeight.IMPORTANT),
    plusSkills: groupSkillIds(RequirementWeight.NICE_TO_HAVE),
    skillWeights: Object.fromEntries(
      vacancy.skills.map((item) => [item.skillId, requirementWeightScore[item.weight]]),
    ),
    languageRequirements: vacancy.languages.map((item) => ({
      languageId: item.languageId,
      level: item.level,
    })),
    locationRequirement: {
      mode: vacancy.isLocationCritical ? "strict" : "bonus",
      locationIds: vacancy.locations.map((item) => item.locationId),
    },
    workConditions: {
      workFormatIds: vacancy.workFormats.map((item) => item.workFormatId),
      employmentTypeIds: vacancy.employmentTypes.map((item) => item.employmentTypeId),
      workScheduleIds: vacancy.workSchedules.map((item) => item.workScheduleId),
    },
    salaryRange: {
      from: vacancy.minSalary ?? null,
      to: vacancy.maxSalary ?? null,
      period: vacancy.salaryPeriod ?? null,
    },
  };
}
