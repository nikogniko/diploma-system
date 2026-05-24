import {
  LanguageLevel,
  RequirementWeight,
  type Prisma,
} from "../../prisma/generated/client/index.js";
import {
  getElasticsearchClient,
  vacanciesIndexName,
} from "./elasticsearchClient.js";
import { vacancyInclude } from "../repositories/VacancyRepository.js";

export type VacancyForSearchIndex = Prisma.VacancyGetPayload<{
  include: typeof vacancyInclude;
}>;

export type VacancySearchDocument = {
  id: string;
  title: string;
  description: string;
  status: string;
  professionId: number;
  professionName: string;
  companyId: string;
  companyName: string;
  sphereIds: number[];
  sphereNames: string[];
  workFormats: number[];
  workFormatNames: string[];
  employmentTypes: number[];
  employmentTypeNames: string[];
  workSchedules: number[];
  workScheduleNames: string[];
  locationIds: string[];
  countryIds: number[];
  regionIds: number[];
  cityIds: number[];
  locationNames: string[];
  languageRequirements: Array<{
    languageId: number;
    languageName: string;
    level: LanguageLevel;
    levelRank: number;
  }>;
  skillIds: number[];
  skillNames: string[];
  criticalSkillNames: string[];
  importantSkillNames: string[];
  plusSkillNames: string[];
  salaryFrom: number | null;
  salaryTo: number | null;
  salaryPeriod: string | null;
  closingDate: string;
  updatedAt: string;
  createdAt: string;
};

const languageRank: Record<LanguageLevel, number> = {
  [LanguageLevel.A1]: 1,
  [LanguageLevel.A2]: 2,
  [LanguageLevel.B1]: 3,
  [LanguageLevel.B2]: 4,
  [LanguageLevel.C1]: 5,
  [LanguageLevel.C2]: 6,
  [LanguageLevel.NATIVE]: 7,
};

const textField = {
  type: "text",
  analyzer: "standard",
  fields: {
    keyword: { type: "keyword", ignore_above: 256 },
  },
} as const;

/** Creates the denormalized vacancy index and mapping when it is absent. */
export const ensureVacanciesIndex = async () => {
  const client = getElasticsearchClient();
  const index = vacanciesIndexName();
  const exists = await client.indices.exists({ index });

  if (exists) return index;

  await client.indices.create({
    index,
    mappings: {
      dynamic: "strict",
      properties: {
        id: { type: "keyword" },
        title: textField,
        description: { type: "text", analyzer: "standard" },
        status: { type: "keyword" },
        professionId: { type: "integer" },
        professionName: textField,
        companyId: { type: "keyword" },
        companyName: textField,
        sphereIds: { type: "integer" },
        sphereNames: textField,
        workFormats: { type: "integer" },
        workFormatNames: textField,
        employmentTypes: { type: "integer" },
        employmentTypeNames: textField,
        workSchedules: { type: "integer" },
        workScheduleNames: textField,
        locationIds: { type: "keyword" },
        countryIds: { type: "integer" },
        regionIds: { type: "integer" },
        cityIds: { type: "integer" },
        locationNames: textField,
        languageRequirements: {
          type: "nested",
          properties: {
            languageId: { type: "integer" },
            languageName: textField,
            level: { type: "keyword" },
            levelRank: { type: "integer" },
          },
        },
        skillIds: { type: "integer" },
        skillNames: textField,
        criticalSkillNames: textField,
        importantSkillNames: textField,
        plusSkillNames: textField,
        salaryFrom: { type: "integer" },
        salaryTo: { type: "integer" },
        salaryPeriod: { type: "keyword" },
        closingDate: { type: "date" },
        updatedAt: { type: "date" },
        createdAt: { type: "date" },
      },
    },
  });

  return index;
};

/** Converts a relational Prisma vacancy record into one search-index document. */
export const buildVacancySearchDocument = (vacancy: VacancyForSearchIndex): VacancySearchDocument => {
  const skillNames = vacancy.skills.map((item) => item.skill.name);

  return {
    id: vacancy.id,
    title: vacancy.title,
    description: vacancy.description,
    status: vacancy.status,
    professionId: vacancy.professionId,
    professionName: vacancy.profession.name,
    companyId: vacancy.companyId,
    companyName: vacancy.company.publicName,
    sphereIds: vacancy.spheres.map((item) => item.sphereId),
    sphereNames: vacancy.spheres.map((item) => item.sphere.name),
    workFormats: vacancy.workFormats.map((item) => item.workFormatId),
    workFormatNames: vacancy.workFormats.map((item) => item.workFormat.name),
    employmentTypes: vacancy.employmentTypes.map((item) => item.employmentTypeId),
    employmentTypeNames: vacancy.employmentTypes.map((item) => item.employmentType.name),
    workSchedules: vacancy.workSchedules.map((item) => item.workScheduleId),
    workScheduleNames: vacancy.workSchedules.map((item) => item.workSchedule.name),
    locationIds: vacancy.locations.map((item) => item.locationId),
    countryIds: vacancy.locations.map((item) => item.location.countryId),
    regionIds: vacancy.locations.flatMap((item) => item.location.regionId ? [item.location.regionId] : []),
    cityIds: vacancy.locations.flatMap((item) => item.location.cityId ? [item.location.cityId] : []),
    locationNames: [],
    languageRequirements: vacancy.languages.map((item) => ({
      languageId: item.languageId,
      languageName: item.language.name,
      level: item.level,
      levelRank: languageRank[item.level],
    })),
    skillIds: vacancy.skills.map((item) => item.skillId),
    skillNames,
    criticalSkillNames: skillNamesByWeight(vacancy, RequirementWeight.CRITICAL),
    importantSkillNames: skillNamesByWeight(vacancy, RequirementWeight.IMPORTANT),
    plusSkillNames: skillNamesByWeight(vacancy, RequirementWeight.NICE_TO_HAVE),
    salaryFrom: vacancy.minSalary,
    salaryTo: vacancy.maxSalary,
    salaryPeriod: vacancy.salaryPeriod,
    closingDate: vacancy.closingDate.toISOString(),
    updatedAt: vacancy.updatedAt.toISOString(),
    createdAt: vacancy.createdAt.toISOString(),
  };
};

/** Selects names of vacancy skills assigned to a requirement priority. */
const skillNamesByWeight = (
  vacancy: VacancyForSearchIndex,
  weight: RequirementWeight,
) => vacancy.skills
  .filter((item) => item.weight === weight)
  .map((item) => item.skill.name);
