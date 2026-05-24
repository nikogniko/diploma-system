import {
  ListingStatus,
  Prisma,
  type LanguageLevel,
  type RequirementWeight,
  type SalaryPeriod,
} from "../../prisma/generated/client/index.js";
import { prisma } from "../config/db.js";
import type { DbClient } from "./repositoryTypes.js";

export type VacancyCreateData = {
  hrProfileId: string;
  companyId: string;
  title: string;
  description: string;
  professionId: number;
  isLocationCritical: boolean;
  minSalary?: number | null;
  maxSalary?: number | null;
  salaryPeriod?: SalaryPeriod | null;
  status: ListingStatus;
  publishedAt?: Date | null;
  closingDate: Date;
};

export type VacancyUpdateData = Omit<VacancyCreateData, "hrProfileId" | "companyId">;

export type VacancySkillData = {
  skillId: number;
  weight: RequirementWeight;
};

export type VacancyLanguageData = {
  languageId: number;
  level: LanguageLevel;
};

export type VacancyListSortBy = "title" | "status" | "closingDate" | "updatedAt" | "createdAt";
export type PublicVacancySortBy = "relevance" | "updatedAt" | "salaryFrom";

export type VacancyListParams = {
  page: number;
  pageSize: number;
  search?: string | null;
  status?: ListingStatus | null;
  sortBy: VacancyListSortBy;
  sortDirection: Prisma.SortOrder;
};

export type PublicVacancyLanguageFilter = {
  languageId: number;
  levels: LanguageLevel[];
};

export type PublicVacancyListParams = {
  page: number;
  pageSize: number;
  search?: string | null;
  softSearchTerms?: string[];
  requiredSearchTerms?: string[];
  professionId?: number | null;
  professionIds?: number[];
  companyIds?: string[];
  sphereIds?: number[];
  countryIds?: number[];
  regionIds?: number[];
  cityIds?: number[];
  workFormatIds?: number[];
  employmentTypeIds?: number[];
  workScheduleIds?: number[];
  locationIds?: string[];
  languageFilters?: PublicVacancyLanguageFilter[];
  minSalary?: number | null;
  sortBy: PublicVacancySortBy;
  sortDirection: Prisma.SortOrder;
  today: Date;
};

export const vacancyInclude = {
  profession: true,
  spheres: { include: { sphere: true } },
  employmentTypes: { include: { employmentType: true } },
  workSchedules: { include: { workSchedule: true } },
  workFormats: { include: { workFormat: true } },
  locations: { include: { location: true } },
  skills: { include: { skill: true } },
  languages: { include: { language: true } },
  hrProfile: { include: { user: true, links: true } },
  company: true,
} satisfies Prisma.VacancyInclude;

export class VacancyRepository {
  /** Creates a vacancy persistence adapter over the provided Prisma client. */
  constructor(private readonly db: DbClient = prisma) {}

  /** Створює базовий запис вакансії без M:N зв'язків. */
  async createVacancy(data: VacancyCreateData) {
    return this.db.vacancy.create({ data, include: vacancyInclude });
  }

  /** Оновлює базові поля вакансії без M:N зв'язків. */
  async updateVacancy(vacancyId: string, data: VacancyUpdateData) {
    return this.db.vacancy.update({
      where: { id: vacancyId },
      data,
      include: vacancyInclude,
    });
  }

  /** Повертає вакансію за id з усіма даними для редагування та перегляду. */
  async findVacancyById(vacancyId: string) {
    return this.db.vacancy.findUnique({
      where: { id: vacancyId },
      include: vacancyInclude,
    });
  }

  /** Повертає вакансію компанії за id, щоб перевірити право HR на редагування. */
  async findCompanyVacancy(vacancyId: string, companyId: string) {
    return this.db.vacancy.findFirst({
      where: { id: vacancyId, companyId },
      include: vacancyInclude,
    });
  }

  /** Повертає всі вакансії компанії поточного рекрутера. */
  async listCompanyVacancies(companyId: string, params: VacancyListParams) {
    const where: Prisma.VacancyWhereInput = {
      companyId,
      ...(params.status ? { status: params.status } : {}),
      ...(params.search
        ? {
            OR: [
              { title: { contains: params.search, mode: "insensitive" } },
              { profession: { name: { contains: params.search, mode: "insensitive" } } },
            ],
          }
        : {}),
    };
    const skip = (params.page - 1) * params.pageSize;
    const orderBy = [{ [params.sortBy]: params.sortDirection }, { createdAt: "desc" }] as Prisma.VacancyOrderByWithRelationInput[];
    const [items, totalItems] = await Promise.all([
      this.db.vacancy.findMany({
        where,
        skip,
        take: params.pageSize,
        orderBy,
        include: vacancyInclude,
      }),
      this.db.vacancy.count({ where }),
    ]);

    return {
      items,
      page: params.page,
      pageSize: params.pageSize,
      totalItems,
      totalPages: Math.max(1, Math.ceil(totalItems / params.pageSize)),
    };
  }

  /** Повертає активні вакансії для студентського каталогу з фільтрами, сортуванням і пагінацією. */
  async listPublicActiveVacancies(params: PublicVacancyListParams) {
    const where = this.buildPublicVacancyWhere(params);
    const skip = (params.page - 1) * params.pageSize;
    const sortBy = params.sortBy === "relevance" ? "updatedAt" : params.sortBy;
    const orderField = sortBy === "salaryFrom" ? "minSalary" : sortBy;
    const sortDirection = params.sortBy === "relevance" ? "desc" : params.sortDirection;
    const orderBy = [{ [orderField]: sortDirection }, { updatedAt: "desc" }] as Prisma.VacancyOrderByWithRelationInput[];
    const [items, totalItems] = await Promise.all([
      this.db.vacancy.findMany({
        where,
        skip,
        take: params.pageSize,
        orderBy,
        include: vacancyInclude,
      }),
      this.db.vacancy.count({ where }),
    ]);

    return {
      items,
      page: params.page,
      pageSize: params.pageSize,
      totalItems,
      totalPages: Math.max(1, Math.ceil(totalItems / params.pageSize)),
    };
  }

  /** Returns full vacancy records for search-index rebuilds. */
  async listVacanciesForSearchIndex() {
    return this.db.vacancy.findMany({
      orderBy: { updatedAt: "desc" },
      include: vacancyInclude,
    });
  }

  /** Returns public vacancies by ids; caller restores external ranking order. */
  async findPublicActiveVacanciesByIds(vacancyIds: string[], today: Date) {
    if (vacancyIds.length === 0) return [];
    return this.db.vacancy.findMany({
      where: {
        id: { in: vacancyIds },
        status: ListingStatus.ACTIVE,
        closingDate: { gte: today },
      },
      include: vacancyInclude,
    });
  }

  /** Повертає активні та призупинені вакансії для публічної сторінки компанії. */
  async listPublicCompanyVacancies(companyId: string) {
    return this.db.vacancy.findMany({
      where: {
        companyId,
        status: { in: [ListingStatus.ACTIVE, ListingStatus.PAUSED] },
      },
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
      include: vacancyInclude,
    });
  }

  /** Повертає компанії, що мають активні вакансії з актуальним дедлайном, для фільтра каталогу. */
  async listPublicActiveVacancyCompanies(today: Date) {
    return this.db.company.findMany({
      where: {
        vacancies: {
          some: {
            status: ListingStatus.ACTIVE,
            closingDate: { gte: today },
          },
        },
      },
      select: { id: true, publicName: true },
      orderBy: { publicName: "asc" },
    });
  }

  /** Повертає одну публічно видиму вакансію для перегляду. */
  async findPublicVisibleVacancyById(vacancyId: string, today: Date) {
    return this.db.vacancy.findFirst({
      where: {
        id: vacancyId,
        OR: [
          { status: ListingStatus.ACTIVE, closingDate: { gte: today } },
          { status: ListingStatus.PAUSED },
        ],
      },
      include: vacancyInclude,
    });
  }

  /** Оновлює статус вакансії та дату публікації, якщо вакансія активується вперше. */
  async updateVacancyStatus(vacancyId: string, status: ListingStatus) {
    return this.db.vacancy.update({
      where: { id: vacancyId },
      data: {
        status,
        publishedAt: status === ListingStatus.ACTIVE ? new Date() : undefined,
      },
      include: vacancyInclude,
    });
  }

  /** Будує Prisma-фільтр студентського каталогу. */
  private buildPublicVacancyWhere(params: PublicVacancyListParams): Prisma.VacancyWhereInput {
    const andFilters: Prisma.VacancyWhereInput[] = [
      { status: ListingStatus.ACTIVE },
      { closingDate: { gte: params.today } },
    ];

    if (params.softSearchTerms?.length && !params.requiredSearchTerms?.length) {
      andFilters.push({
        OR: params.softSearchTerms.flatMap((term) => this.searchFieldConditions(term)),
      });
    }
    params.requiredSearchTerms?.forEach((term) => {
      andFilters.push({ OR: this.searchFieldConditions(term) });
    });

    if (params.professionIds?.length) andFilters.push({ professionId: { in: params.professionIds } });
    else if (params.professionId) andFilters.push({ professionId: params.professionId });
    if (params.companyIds?.length) andFilters.push({ companyId: { in: params.companyIds } });
    if (params.sphereIds?.length) andFilters.push({ spheres: { some: { sphereId: { in: params.sphereIds } } } });
    if (params.countryIds?.length || params.cityIds?.length || params.regionIds?.length) {
      andFilters.push({
        OR: [
          ...(params.countryIds?.length
            ? [{ locations: { some: { location: { countryId: { in: params.countryIds } } } } }]
            : []),
          ...(params.regionIds?.length
            ? [{ locations: { some: { location: { regionId: { in: params.regionIds } } } } }]
            : []),
          ...(params.cityIds?.length
            ? [{ locations: { some: { location: { cityId: { in: params.cityIds } } } } }]
            : []),
        ],
      });
    }
    if (params.workFormatIds?.length) andFilters.push({ workFormats: { some: { workFormatId: { in: params.workFormatIds } } } });
    if (params.employmentTypeIds?.length) andFilters.push({ employmentTypes: { some: { employmentTypeId: { in: params.employmentTypeIds } } } });
    if (params.workScheduleIds?.length) andFilters.push({ workSchedules: { some: { workScheduleId: { in: params.workScheduleIds } } } });
    if (params.locationIds?.length) andFilters.push({ locations: { some: { locationId: { in: params.locationIds } } } });
    if (params.minSalary !== null && params.minSalary !== undefined) {
      andFilters.push({
        OR: [
          { minSalary: { gte: params.minSalary } },
          { maxSalary: { gte: params.minSalary } },
        ],
      });
    }
    params.languageFilters?.forEach((filter) => {
      andFilters.push({
        languages: {
          some: {
            languageId: filter.languageId,
            level: { in: filter.levels },
          },
        },
      });
    });

    return { AND: andFilters };
  }

  /** Builds OR-able Prisma conditions for one normalized text search term. */
  private searchFieldConditions(term: string): Prisma.VacancyWhereInput[] {
    return [
      { title: { contains: term, mode: "insensitive" } },
      { description: { contains: term, mode: "insensitive" } },
      { profession: { name: { contains: term, mode: "insensitive" } } },
      { company: { publicName: { contains: term, mode: "insensitive" } } },
      { spheres: { some: { sphere: { name: { contains: term, mode: "insensitive" } } } } },
      { skills: { some: { skill: { name: { contains: term, mode: "insensitive" } } } } },
    ];
  }

  /** Архівує активні вакансії компанії, у яких минув closingDate. */
  async archiveExpiredActiveVacancies(companyId: string, today: Date) {
    return this.db.vacancy.updateMany({
      where: {
        companyId,
        status: ListingStatus.ACTIVE,
        closingDate: { lt: today },
      },
      data: { status: ListingStatus.ARCHIVED },
    });
  }

  /** Замінює сфери вакансії. */
  async replaceSpheres(vacancyId: string, sphereIds: number[]) {
    await this.db.vacancySphere.deleteMany({ where: { vacancyId } });
    if (sphereIds.length === 0) return;
    await this.db.vacancySphere.createMany({
      data: sphereIds.map((sphereId) => ({ vacancyId, sphereId })),
      skipDuplicates: true,
    });
  }

  /** Замінює типи зайнятості вакансії. */
  async replaceEmploymentTypes(vacancyId: string, employmentTypeIds: number[]) {
    await this.db.vacancyEmploymentType.deleteMany({ where: { vacancyId } });
    if (employmentTypeIds.length === 0) return;
    await this.db.vacancyEmploymentType.createMany({
      data: employmentTypeIds.map((employmentTypeId) => ({ vacancyId, employmentTypeId })),
      skipDuplicates: true,
    });
  }

  /** Замінює графіки роботи вакансії. */
  async replaceWorkSchedules(vacancyId: string, workScheduleIds: number[]) {
    await this.db.vacancyWorkSchedule.deleteMany({ where: { vacancyId } });
    if (workScheduleIds.length === 0) return;
    await this.db.vacancyWorkSchedule.createMany({
      data: workScheduleIds.map((workScheduleId) => ({ vacancyId, workScheduleId })),
      skipDuplicates: true,
    });
  }

  /** Замінює формати роботи вакансії. */
  async replaceWorkFormats(vacancyId: string, workFormatIds: number[]) {
    await this.db.vacancyWorkFormat.deleteMany({ where: { vacancyId } });
    if (workFormatIds.length === 0) return;
    await this.db.vacancyWorkFormat.createMany({
      data: workFormatIds.map((workFormatId) => ({ vacancyId, workFormatId })),
      skipDuplicates: true,
    });
  }

  /** Замінює офісні локації вакансії. */
  async replaceLocations(vacancyId: string, locationIds: string[]) {
    await this.db.vacancyLocation.deleteMany({ where: { vacancyId } });
    if (locationIds.length === 0) return;
    await this.db.vacancyLocation.createMany({
      data: locationIds.map((locationId) => ({ vacancyId, locationId })),
      skipDuplicates: true,
    });
  }

  /** Замінює навички вакансії разом із вагою для майбутнього скорингу. */
  async replaceSkills(vacancyId: string, skills: VacancySkillData[]) {
    await this.db.vacancySkill.deleteMany({ where: { vacancyId } });
    if (skills.length === 0) return;
    await this.db.vacancySkill.createMany({
      data: skills.map((skill) => ({ vacancyId, skillId: skill.skillId, weight: skill.weight })),
      skipDuplicates: true,
    });
  }

  /** Замінює мовні вимоги вакансії. */
  async replaceLanguages(vacancyId: string, languages: VacancyLanguageData[]) {
    await this.db.vacancyLanguage.deleteMany({ where: { vacancyId } });
    if (languages.length === 0) return;
    await this.db.vacancyLanguage.createMany({
      data: languages.map((language) => ({
        vacancyId,
        languageId: language.languageId,
        level: language.level,
      })),
      skipDuplicates: true,
    });
  }
}

export const vacancyRepository = new VacancyRepository();
