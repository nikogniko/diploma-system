import {
  LanguageLevel,
  type Prisma,
} from "../../prisma/generated/client/index.js";
import { BusinessLogicError, HttpStatus } from "../errors/BusinessLogicError.js";
import {
  type PublicVacancyListParams,
  type PublicVacancySortBy,
  VacancyRepository,
  vacancyRepository,
} from "../repositories/VacancyRepository.js";
import {
  StudentProfileRepository,
  studentProfileRepository,
} from "../repositories/StudentProfileRepository.js";

type SearchMode = "regular" | "personalized";
type SortDirection = Prisma.SortOrder;

export type VacancySearchRequest = {
  page?: unknown;
  pageSize?: unknown;
  search?: unknown;
  professionId?: unknown;
  professionIds?: unknown;
  companyIds?: unknown;
  sphereIds?: unknown;
  countryIds?: unknown;
  regionIds?: unknown;
  cityIds?: unknown;
  workFormatIds?: unknown;
  employmentTypeIds?: unknown;
  workScheduleIds?: unknown;
  languageId?: unknown;
  languageLevel?: unknown;
  minSalary?: unknown;
  sortBy?: unknown;
  sortDirection?: unknown;
  mode?: unknown;
};

export type VacancySearchItem<TVacancy> = {
  vacancy: TVacancy;
  matchScore: number | null;
  matchExplanation: Record<string, unknown> | null;
};

const languageRank: LanguageLevel[] = [
  LanguageLevel.A1,
  LanguageLevel.A2,
  LanguageLevel.B1,
  LanguageLevel.B2,
  LanguageLevel.C1,
  LanguageLevel.C2,
  LanguageLevel.NATIVE,
];

/** Пошук активних вакансій для студентів. Поки використовує БД fallback, але має стабільний інтерфейс для Elasticsearch. */
export class VacancySearchService {
  constructor(
    private readonly vacancies: VacancyRepository = vacancyRepository,
    private readonly students: StudentProfileRepository = studentProfileRepository,
  ) {}

  /** Повертає список активних вакансій для звичайного або персоналізованого режиму. */
  async searchVacancies(query: VacancySearchRequest = {}, clerkUserId?: string | null) {
    const mode = this.normalizeMode(query.mode);
    const params = await this.buildSearchParams(query, mode, clerkUserId);
    const result = await this.vacancies.listPublicActiveVacancies(params);

    return {
      ...result,
      items: result.items.map((vacancy) => ({
        vacancy,
        matchScore: null,
        matchExplanation: null,
      } satisfies VacancySearchItem<typeof vacancy>)),
    };
  }

  /** Повертає одну публічно видиму вакансію для перегляду. */
  async getActiveVacancy(vacancyId: string) {
    const vacancy = await this.vacancies.findPublicVisibleVacancyById(vacancyId, this.todayDateOnly());
    if (!vacancy) {
      throw new BusinessLogicError("Vacancy not found", HttpStatus.NOT_FOUND, "VACANCY_NOT_FOUND");
    }
    return {
      vacancy,
      matchScore: null,
      matchExplanation: null,
    };
  }

  /** Повертає додаткові опції фільтрів для публічного каталогу вакансій. */
  async getPublicFilterOptions() {
    return {
      companies: await this.vacancies.listPublicActiveVacancyCompanies(this.todayDateOnly()),
    };
  }

  /** Опис полів майбутнього Elasticsearch-індексу без підключення інфраструктури в MVP. */
  getIndexMappingDraft() {
    return {
      index: "vacancies",
      fields: [
        "id",
        "title",
        "description",
        "status",
        "closingDate",
        "updatedAt",
        "professionId",
        "professionName",
        "sphereIds",
        "workFormatIds",
        "employmentTypeIds",
        "workScheduleIds",
        "languageRequirements",
        "skillRequirements",
        "minSalary",
        "maxSalary",
        "companyId",
        "companyName",
        "locationIds",
      ],
    };
  }

  /** Готує параметри пошуку; у personalized mode додає фільтри з профілю студента. */
  private async buildSearchParams(
    query: VacancySearchRequest,
    mode: SearchMode,
    clerkUserId?: string | null,
  ): Promise<PublicVacancyListParams> {
    const params: PublicVacancyListParams = {
      page: this.clampPositiveInt(query.page, 1, 1, 10_000),
      pageSize: this.clampPositiveInt(query.pageSize, 10, 5, 20),
      search: this.optionalText(query.search),
      professionId: this.optionalNumber(query.professionId),
      professionIds: this.numberList(query.professionIds),
      companyIds: this.stringList(query.companyIds),
      sphereIds: this.numberList(query.sphereIds),
      countryIds: this.numberList(query.countryIds),
      regionIds: this.numberList(query.regionIds),
      cityIds: this.numberList(query.cityIds),
      workFormatIds: this.numberList(query.workFormatIds),
      employmentTypeIds: this.numberList(query.employmentTypeIds),
      workScheduleIds: this.numberList(query.workScheduleIds),
      languageFilters: this.languageFilters(query.languageId, query.languageLevel),
      minSalary: this.optionalNumber(query.minSalary),
      sortBy: this.normalizeSortBy(query.sortBy),
      sortDirection: query.sortDirection === "asc" ? "asc" : "desc",
      today: this.todayDateOnly(),
    };

    if (mode === "personalized") {
      if (!clerkUserId) {
        throw new BusinessLogicError("Personalized search requires authentication", HttpStatus.UNAUTHORIZED, "UNAUTHORIZED");
      }
      const profile = await this.students.findByClerkUserId(clerkUserId);
      if (!profile) {
        throw new BusinessLogicError("Student profile not found", HttpStatus.NOT_FOUND, "STUDENT_PROFILE_NOT_FOUND");
      }

      params.professionIds = this.mergeNumbers(params.professionIds, profile.desiredProfessions.map((item) => item.professionId));
      params.professionId ??= params.professionIds[0] ?? null;
      params.employmentTypeIds = this.mergeNumbers(params.employmentTypeIds, profile.employmentTypes.map((item) => item.employmentTypeId));
      params.workScheduleIds = this.mergeNumbers(params.workScheduleIds, profile.workSchedules.map((item) => item.workScheduleId));
      params.workFormatIds = this.mergeNumbers(params.workFormatIds, profile.workFormats.map((item) => item.workFormatId));
      const profileLocations = this.locationFiltersFromProfile(profile.desiredLocations);
      params.countryIds = this.mergeNumbers(params.countryIds, profileLocations.countryIds);
      params.regionIds = this.mergeNumbers(params.regionIds, profileLocations.regionIds);
      params.cityIds = this.mergeNumbers(params.cityIds, profileLocations.cityIds);
      params.minSalary ??= profile.minSalary ?? null;
    }

    return params;
  }

  private normalizeMode(value: unknown): SearchMode {
    return value === "personalized" ? "personalized" : "regular";
  }

  private normalizeSortBy(value: unknown): PublicVacancySortBy {
    const allowed: PublicVacancySortBy[] = ["updatedAt", "closingDate", "title", "salaryFrom"];
    return typeof value === "string" && allowed.includes(value as PublicVacancySortBy)
      ? value as PublicVacancySortBy
      : "updatedAt";
  }

  private optionalText(value: unknown) {
    return typeof value === "string" && value.trim() ? value.trim() : null;
  }

  private optionalNumber(value: unknown): number | null {
    if (Array.isArray(value)) return this.optionalNumber(value[0]);
    if (value === undefined || value === null || value === "") return null;
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
  }

  private numberList(value: unknown) {
    const raw = Array.isArray(value) ? value : typeof value === "string" ? value.split(",") : [];
    return [...new Set(raw.map((item) => Number(item)).filter((item) => Number.isInteger(item) && item > 0))];
  }

  private stringList(value: unknown) {
    const raw = Array.isArray(value) ? value : typeof value === "string" ? value.split(",") : [];
    return [...new Set(raw.map((item) => String(item).trim()).filter(Boolean))];
  }

  private languageFilters(languageIds: unknown, minimumLevels: unknown) {
    const ids = this.numberList(languageIds);
    const levels = Array.isArray(minimumLevels)
      ? minimumLevels
      : typeof minimumLevels === "string"
        ? minimumLevels.split(",")
        : [];

    return ids.map((languageId, index) => {
      const level = this.normalizeLanguageLevel(levels[index] ?? levels[0]);
      return {
        languageId,
        levels: this.levelsAtLeast(level),
      };
    });
  }

  private normalizeLanguageLevel(value: unknown) {
    return typeof value === "string" && Object.values(LanguageLevel).includes(value as LanguageLevel)
      ? value as LanguageLevel
      : LanguageLevel.A1;
  }

  private levelsAtLeast(level: LanguageLevel) {
    return languageRank.slice(languageRank.indexOf(level));
  }

  private mergeNumbers(first: number[] = [], second: number[] = []) {
    return [...new Set([...first, ...second])];
  }

  private locationFiltersFromProfile(
    desiredLocations: Array<{
      location: {
        countryId: number;
        regionId?: number | null;
        cityId?: number | null;
      };
    }>,
  ) {
    return desiredLocations.reduce(
      (filters, item) => {
        const location = item.location;
        if (location.cityId) filters.cityIds.push(location.cityId);
        else if (location.regionId) filters.regionIds.push(location.regionId);
        else filters.countryIds.push(location.countryId);
        return filters;
      },
      {
        countryIds: [] as number[],
        regionIds: [] as number[],
        cityIds: [] as number[],
      },
    );
  }

  private clampPositiveInt(value: unknown, fallback: number, min: number, max: number) {
    const parsed = Number(value);
    if (!Number.isInteger(parsed)) return fallback;
    return Math.min(Math.max(parsed, min), max);
  }

  private todayDateOnly() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
  }
}

export const vacancySearchService = new VacancySearchService();
