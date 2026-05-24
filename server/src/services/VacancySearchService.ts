import type { estypes } from "@elastic/elasticsearch";
import {
  LanguageLevel,
  ListingStatus,
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
import {
  getElasticsearchClient,
  isElasticsearchAvailable,
  vacanciesIndexName,
} from "../search/elasticsearchClient.js";

type SearchMode = "regular" | "personalized";
type ParsedSearchQuery = {
  normalizedText: string | null;
  softTerms: string[];
  requiredTerms: string[];
};

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
  locationIds?: unknown;
  workFormatIds?: unknown;
  workFormats?: unknown;
  employmentTypeIds?: unknown;
  employmentTypes?: unknown;
  workScheduleIds?: unknown;
  workSchedules?: unknown;
  languageId?: unknown;
  languageLevel?: unknown;
  minLanguageLevel?: unknown;
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
const ignoredSearchTerms = new Set(["в", "у", "і", "й", "та", "на", "з", "до", "для", "a", "an", "the", "and", "in", "for", "of"]);

export class VacancySearchService {
  /** Creates the search service with database-backed vacancy and student access. */
  constructor(
    private readonly vacancies: VacancyRepository = vacancyRepository,
    private readonly students: StudentProfileRepository = studentProfileRepository,
  ) {}

  /** Searches student-visible vacancies through Elasticsearch with Prisma fallback. */
  async searchVacancies(query: VacancySearchRequest = {}, clerkUserId?: string | null) {
    const mode = this.normalizeMode(query.mode);
    const params = await this.buildSearchParams(query, mode, clerkUserId);
    const result = await this.searchWithPreferredBackend(params);

    return {
      ...result,
      items: result.items.map((vacancy) => ({
        vacancy,
        matchScore: null,
        matchExplanation: null,
      } satisfies VacancySearchItem<typeof vacancy>)),
    };
  }

  /** Returns one student-visible vacancy for the public preview. */
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

  /** Returns dynamic company options available in the vacancy catalog. */
  async getPublicFilterOptions() {
    return {
      companies: await this.vacancies.listPublicActiveVacancyCompanies(this.todayDateOnly()),
    };
  }

  /** Describes denormalized fields held by the vacancy search document. */
  getIndexMappingDraft() {
    return {
      index: vacanciesIndexName(),
      fields: [
        "id",
        "title",
        "description",
        "status",
        "professionId",
        "professionName",
        "companyId",
        "companyName",
        "sphereIds",
        "sphereNames",
        "workFormats",
        "employmentTypes",
        "workSchedules",
        "languageRequirements",
        "salaryFrom",
        "salaryTo",
        "closingDate",
        "updatedAt",
        "createdAt",
        "skillNames",
        "criticalSkillNames",
        "importantSkillNames",
        "plusSkillNames",
        "locationIds",
        "countryIds",
        "regionIds",
        "cityIds",
      ],
    };
  }

  /** Normalizes query values and applies personalized profile constraints. */
  private async buildSearchParams(
    query: VacancySearchRequest,
    mode: SearchMode,
    clerkUserId?: string | null,
  ): Promise<PublicVacancyListParams> {
    const parsedSearch = this.parseSearchQuery(query.search);
    const params: PublicVacancyListParams = {
      page: this.clampPositiveInt(query.page, 1, 1, 10_000),
      pageSize: this.clampPositiveInt(query.pageSize, 10, 5, 20),
      search: parsedSearch.normalizedText,
      softSearchTerms: parsedSearch.softTerms,
      requiredSearchTerms: parsedSearch.requiredTerms,
      professionId: this.optionalNumber(query.professionId),
      professionIds: this.numberList(query.professionIds),
      companyIds: this.stringList(query.companyIds),
      sphereIds: this.numberList(query.sphereIds),
      countryIds: this.numberList(query.countryIds),
      regionIds: this.numberList(query.regionIds),
      cityIds: this.numberList(query.cityIds),
      locationIds: this.stringList(query.locationIds),
      workFormatIds: this.numberList(query.workFormatIds, query.workFormats),
      employmentTypeIds: this.numberList(query.employmentTypeIds, query.employmentTypes),
      workScheduleIds: this.numberList(query.workScheduleIds, query.workSchedules),
      languageFilters: this.languageFilters(query.languageId, query.minLanguageLevel ?? query.languageLevel),
      minSalary: this.optionalNumber(query.minSalary),
      sortBy: this.normalizeSortBy(query.sortBy, parsedSearch.normalizedText !== null),
      sortDirection: query.sortBy === "relevance" && parsedSearch.normalizedText === null
        ? "desc"
        : query.sortDirection === "asc" ? "asc" : "desc",
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

  /** Uses Elasticsearch when available and recovers through Prisma otherwise. */
  private async searchWithPreferredBackend(params: PublicVacancyListParams) {
    if (await isElasticsearchAvailable()) {
      try {
        return await this.searchWithElasticsearch(params);
      } catch (error) {
        console.warn("Elasticsearch vacancy search failed, falling back to Prisma.", error);
      }
    }

    return this.vacancies.listPublicActiveVacancies(params);
  }

  /** Runs index search and hydrates ordered result ids with current Prisma records. */
  private async searchWithElasticsearch(params: PublicVacancyListParams) {
    const response = await getElasticsearchClient().search<{ id: string }>({
      index: vacanciesIndexName(),
      from: (params.page - 1) * params.pageSize,
      size: params.pageSize,
      track_total_hits: true,
      query: this.elasticsearchQuery(params),
      sort: this.elasticsearchSort(params),
      _source: ["id"],
    });
    const ids = response.hits.hits
      .map((hit) => hit._source?.id)
      .filter((id): id is string => Boolean(id));
    const vacancies = await this.vacancies.findPublicActiveVacanciesByIds(ids, params.today);
    const vacancyById = new Map(vacancies.map((vacancy) => [vacancy.id, vacancy]));
    const items = ids.flatMap((id) => {
      const vacancy = vacancyById.get(id);
      return vacancy ? [vacancy] : [];
    });
    const totalItems = typeof response.hits.total === "number"
      ? response.hits.total
      : response.hits.total?.value ?? items.length;

    return {
      items,
      page: params.page,
      pageSize: params.pageSize,
      totalItems,
      totalPages: Math.max(1, Math.ceil(totalItems / params.pageSize)),
    };
  }

  /** Builds strict filters plus boosted soft and required full-text clauses. */
  private elasticsearchQuery(params: PublicVacancyListParams): estypes.QueryDslQueryContainer {
    const filter: estypes.QueryDslQueryContainer[] = [
      { term: { status: ListingStatus.ACTIVE } },
      { range: { closingDate: { gte: params.today.toISOString() } } },
    ];

    if (params.professionIds?.length) filter.push({ terms: { professionId: params.professionIds } });
    else if (params.professionId) filter.push({ term: { professionId: params.professionId } });
    if (params.companyIds?.length) filter.push({ terms: { companyId: params.companyIds } });
    if (params.sphereIds?.length) filter.push({ terms: { sphereIds: params.sphereIds } });
    if (params.countryIds?.length || params.regionIds?.length || params.cityIds?.length) {
      filter.push({
        bool: {
          should: [
            ...(params.countryIds?.length ? [{ terms: { countryIds: params.countryIds } }] : []),
            ...(params.regionIds?.length ? [{ terms: { regionIds: params.regionIds } }] : []),
            ...(params.cityIds?.length ? [{ terms: { cityIds: params.cityIds } }] : []),
          ],
          minimum_should_match: 1,
        },
      });
    }
    if (params.locationIds?.length) filter.push({ terms: { locationIds: params.locationIds } });
    if (params.workFormatIds?.length) filter.push({ terms: { workFormats: params.workFormatIds } });
    if (params.employmentTypeIds?.length) filter.push({ terms: { employmentTypes: params.employmentTypeIds } });
    if (params.workScheduleIds?.length) filter.push({ terms: { workSchedules: params.workScheduleIds } });
    if (params.minSalary !== null && params.minSalary !== undefined) {
      filter.push({
        bool: {
          should: [
            { range: { salaryFrom: { gte: params.minSalary } } },
            { range: { salaryTo: { gte: params.minSalary } } },
          ],
          minimum_should_match: 1,
        },
      });
    }
    params.languageFilters?.forEach((languageFilter) => {
      filter.push({
        nested: {
          path: "languageRequirements",
          query: {
            bool: {
              filter: [
                { term: { "languageRequirements.languageId": languageFilter.languageId } },
                { range: { "languageRequirements.levelRank": { gte: this.languageLevelRank(languageFilter.levels[0] ?? LanguageLevel.A1) } } },
              ],
            },
          },
        },
      });
    });

    const softTerms = params.softSearchTerms ?? [];
    const requiredTerms = params.requiredSearchTerms ?? [];
    if (softTerms.length === 0 && requiredTerms.length === 0) {
      return { bool: { must: [{ match_all: {} }], filter } };
    }

    return {
      bool: {
        filter,
        ...(requiredTerms.length ? { must: requiredTerms.map((term) => this.elasticsearchTermQuery(term)) } : {}),
        ...(softTerms.length ? { should: softTerms.map((term) => this.elasticsearchTermQuery(term)) } : {}),
        ...(softTerms.length && !requiredTerms.length ? { minimum_should_match: 1 } : {}),
      },
    };
  }

  /** Builds relevance-first or explicitly requested Elasticsearch sorting. */
  private elasticsearchSort(params: PublicVacancyListParams): estypes.Sort {
    if (params.sortBy === "relevance" && params.search) {
      return [{ _score: { order: "desc" } }, { updatedAt: { order: "desc" } }];
    }
    const sortField = params.sortBy === "salaryFrom" ? "salaryFrom" : "updatedAt";
    return [
      { [sortField]: { order: params.sortDirection, missing: "_last" } } as estypes.SortCombinations,
      ...(params.search ? [{ _score: { order: "desc" as const } }] : []),
    ];
  }

  /** Resolves catalog mode to its supported value. */
  private normalizeMode(value: unknown): SearchMode {
    return value === "personalized" ? "personalized" : "regular";
  }

  /** Resolves sort mode, using relevance only for non-empty text queries. */
  private normalizeSortBy(value: unknown, hasSearch: boolean): PublicVacancySortBy {
    const allowed: PublicVacancySortBy[] = ["relevance", "updatedAt", "salaryFrom"];
    if (typeof value === "string" && allowed.includes(value as PublicVacancySortBy)) {
      return value === "relevance" && !hasSearch ? "updatedAt" : value as PublicVacancySortBy;
    }
    return hasSearch ? "relevance" : "updatedAt";
  }

  /** Splits free text into deduplicated soft and `*`-required search terms. */
  private parseSearchQuery(value: unknown): ParsedSearchQuery {
    if (typeof value !== "string") return { normalizedText: null, softTerms: [], requiredTerms: [] };

    const parsedTerms = value
      .split(/[\s,+;]+/u)
      .map((token) => {
        const required = token.startsWith("*") && token.length > 1;
        const term = required ? token.slice(1) : token;
        return { required, term: term.trim() };
      })
      .filter(({ term }) => Boolean(term));
    const effectiveTerms = parsedTerms.filter(({ term }) => !ignoredSearchTerms.has(term.toLocaleLowerCase()));
    const deduplicated = new Map<string, { term: string; required: boolean }>();

    effectiveTerms
      .forEach(({ term, required }) => {
        const key = term.toLocaleLowerCase();
        const existing = deduplicated.get(key);
        deduplicated.set(key, { term: existing?.term ?? term, required: Boolean(existing?.required || required) });
      });

    const terms = [...deduplicated.values()];
    const requiredTerms = terms.filter(({ required }) => required).map(({ term }) => term);
    const softTerms = terms.filter(({ required }) => !required).map(({ term }) => term);
    const normalizedText = terms
      .map(({ term, required }) => `${required ? "*" : ""}${term}`)
      .join(" ");

    return {
      normalizedText: normalizedText || null,
      softTerms,
      requiredTerms,
    };
  }

  /** Creates one boosted multi-field relevance clause for a term. */
  private elasticsearchTermQuery(term: string): estypes.QueryDslQueryContainer {
    return {
      multi_match: {
        query: term,
        type: "best_fields",
        fuzziness: "AUTO",
        fields: [
          "title^6",
          "criticalSkillNames^5",
          "importantSkillNames^4",
          "plusSkillNames^3",
          "skillNames^3",
          "professionName^2.5",
          "sphereNames^2",
          "description^1",
          "companyName^0.75",
        ],
      },
    };
  }

  /** Parses an optional positive integer query parameter. */
  private optionalNumber(value: unknown): number | null {
    if (Array.isArray(value)) return this.optionalNumber(value[0]);
    if (value === undefined || value === null || value === "") return null;
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
  }

  /** Parses and deduplicates positive integer query-list parameters. */
  private numberList(...values: unknown[]) {
    const raw = values.flatMap((value) => Array.isArray(value) ? value : typeof value === "string" ? value.split(",") : []);
    return [...new Set(raw.map((item) => Number(item)).filter((item) => Number.isInteger(item) && item > 0))];
  }

  /** Parses and deduplicates non-empty string query-list parameters. */
  private stringList(value: unknown) {
    const raw = Array.isArray(value) ? value : typeof value === "string" ? value.split(",") : [];
    return [...new Set(raw.map((item) => String(item).trim()).filter(Boolean))];
  }

  /** Pairs language ids with accepted proficiency levels at or above minimums. */
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

  /** Resolves a language-level input to a supported CEFR value. */
  private normalizeLanguageLevel(value: unknown) {
    return typeof value === "string" && Object.values(LanguageLevel).includes(value as LanguageLevel)
      ? value as LanguageLevel
      : LanguageLevel.A1;
  }

  /** Returns all language levels satisfying the requested minimum. */
  private levelsAtLeast(level: LanguageLevel) {
    return languageRank.slice(languageRank.indexOf(level));
  }

  /** Converts language level into its sortable numeric rank. */
  private languageLevelRank(level: LanguageLevel) {
    return languageRank.indexOf(level) + 1;
  }

  /** Combines numeric filter selections without duplicate ids. */
  private mergeNumbers(first: number[] = [], second: number[] = []) {
    return [...new Set([...first, ...second])];
  }

  /** Extracts country, region and city constraints from saved locations. */
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

  /** Bounds pagination integers to supported request limits. */
  private clampPositiveInt(value: unknown, fallback: number, min: number, max: number) {
    const parsed = Number(value);
    if (!Number.isInteger(parsed)) return fallback;
    return Math.min(Math.max(parsed, min), max);
  }

  /** Returns today's local date at midnight for vacancy expiry checks. */
  private todayDateOnly() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
  }
}

export const vacancySearchService = new VacancySearchService();
