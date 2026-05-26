import {
  LanguageLevel,
  ListingStatus,
  RequirementWeight,
  SalaryPeriod,
} from "../../prisma/generated/client/index.js";
import { prisma } from "../config/db.js";
import { BusinessLogicError, HttpStatus } from "../errors/BusinessLogicError.js";
import { CatalogRepository, catalogRepository } from "../repositories/CatalogRepository.js";
import { CompanyRepository, companyRepository } from "../repositories/CompanyRepository.js";
import { HrProfileRepository, hrProfileRepository } from "../repositories/HrProfileRepository.js";
import { SkillRepository, skillRepository } from "../repositories/SkillRepository.js";
import {
  VacancyRepository,
  vacancyRepository,
  type VacancyCreateData,
  type VacancyListParams,
  type VacancyListSortBy,
  type VacancyUpdateData,
} from "../repositories/VacancyRepository.js";
import { normalizeVacancyRequirements } from "./VacancyMatchingService.js";
import { ApplicationMatchRefreshService, applicationMatchRefreshService } from "./ApplicationMatchRefreshService.js";

export type VacancySkillRequest = {
  skillId: number;
  weight: RequirementWeight;
};

export type VacancyLanguageRequest = {
  languageId: number;
  level: LanguageLevel;
};

export type VacancyUpsertRequest = {
  title?: string;
  professionId?: number;
  sphereIds?: number[];
  description?: string;
  skills?: VacancySkillRequest[];
  languages?: VacancyLanguageRequest[];
  officeLocationIds?: string[];
  isLocationStrict?: boolean;
  workFormatIds?: number[];
  employmentTypeIds?: number[];
  workScheduleIds?: number[];
  salaryFrom?: number | null;
  salaryTo?: number | null;
  salaryPeriod?: SalaryPeriod | null;
  closingDate?: string;
  status?: ListingStatus;
};

export type VacancyListRequest = {
  page?: unknown;
  pageSize?: unknown;
  search?: unknown;
  status?: unknown;
  sortBy?: unknown;
  sortDirection?: unknown;
};

export class VacancyService {
  constructor(
    private readonly vacancies: VacancyRepository = vacancyRepository,
    private readonly hrs: HrProfileRepository = hrProfileRepository,
    private readonly companies: CompanyRepository = companyRepository,
    private readonly catalogs: CatalogRepository = catalogRepository,
    private readonly skills: SkillRepository = skillRepository,
    private readonly matchRefresh: ApplicationMatchRefreshService = applicationMatchRefreshService,
  ) {}

  /** Повертає довідники та офісні локації компанії для форми вакансії. */
  async getVacancyCatalogs(clerkUserId: string) {
    const hrProfile = await this.getHrProfileOrThrow(clerkUserId);
    const [languages, employmentTypes, workSchedules, workFormats, professions, spheres, skills, countries, regions, cities, company] = await Promise.all([
      this.catalogs.listLanguages(),
      this.catalogs.listEmploymentTypes(),
      this.catalogs.listWorkSchedules(),
      this.catalogs.listWorkFormats(),
      this.catalogs.searchProfessions(),
      this.catalogs.searchSpheres(),
      this.skills.searchSkills(),
      this.catalogs.searchCountries(),
      this.catalogs.listRegions(),
      this.catalogs.listCities(),
      this.companies.findCompanyById(hrProfile.companyId),
    ]);

    return {
      languages,
      employmentTypes,
      workSchedules,
      workFormats,
      professions,
      spheres,
      countries,
      regions,
      cities,
      skillsByCategory: this.groupSkillsByCategory(skills),
      officeLocations: company?.locations ?? [],
    };
  }

  /** Повертає вакансії компанії поточного рекрутера з урахуванням автоархівації. */
  async listMyVacancies(clerkUserId: string, query: VacancyListRequest = {}) {
    const hrProfile = await this.getHrProfileOrThrow(clerkUserId);
    await this.archiveExpiredVacancies(hrProfile.companyId);
    const params = this.normalizeListQuery(query);
    const result = await this.vacancies.listCompanyVacancies(hrProfile.companyId, params);
    return {
      ...result,
      items: result.items.map((vacancy) => this.mapVacancy(vacancy)).filter(Boolean),
    };
  }

  /** Повертає одну вакансію компанії поточного рекрутера. */
  async getMyVacancy(clerkUserId: string, vacancyId: string) {
    const hrProfile = await this.getHrProfileOrThrow(clerkUserId);
    await this.archiveExpiredVacancies(hrProfile.companyId);
    const vacancy = await this.getOwnedVacancyOrThrow(vacancyId, hrProfile.companyId);
    return this.mapVacancy(vacancy);
  }

  /** Створює вакансію та всі M:N зв'язки в межах однієї транзакції. */
  async createVacancy(clerkUserId: string, body: VacancyUpsertRequest) {
    const hrProfile = await this.getHrProfileOrThrow(clerkUserId);
    const normalized = await this.validateVacancyBody(body, hrProfile.companyId);

    return prisma.$transaction(async (tx) => {
      const txVacancies = new VacancyRepository(tx);
      const vacancy = await txVacancies.createVacancy({
        ...this.mapBaseCreateData(normalized, hrProfile.id, hrProfile.companyId),
      });

      await this.replaceRelations(txVacancies, vacancy.id, normalized);
      const completeVacancy = await txVacancies.findVacancyById(vacancy.id);
      return this.mapVacancy(completeVacancy);
    });
  }

  /** Оновлює вакансію та повністю синхронізує її зв'язки в межах транзакції. */
  async updateVacancy(clerkUserId: string, vacancyId: string, body: VacancyUpsertRequest) {
    const hrProfile = await this.getHrProfileOrThrow(clerkUserId);
    await this.getOwnedVacancyOrThrow(vacancyId, hrProfile.companyId);
    const normalized = await this.validateVacancyBody(body, hrProfile.companyId);

    const updated = await prisma.$transaction(async (tx) => {
      const txVacancies = new VacancyRepository(tx);
      await txVacancies.updateVacancy(vacancyId, this.mapBaseUpdateData(normalized));
      await this.replaceRelations(txVacancies, vacancyId, normalized);
      const completeVacancy = await txVacancies.findVacancyById(vacancyId);
      return this.mapVacancy(completeVacancy);
    });
    await this.matchRefresh.recalculateForVacancy(vacancyId);
    return updated;
  }

  /** Змінює статус вакансії після перевірки права власності. */
  async changeVacancyStatus(clerkUserId: string, vacancyId: string, status: ListingStatus) {
    const hrProfile = await this.getHrProfileOrThrow(clerkUserId);
    await this.getOwnedVacancyOrThrow(vacancyId, hrProfile.companyId);
    this.ensureAllowedStatus(status);
    const updated = await this.vacancies.updateVacancyStatus(vacancyId, status);
    return this.mapVacancy(updated);
  }

  /** Переводить вакансію в архів вручну. */
  async archiveVacancy(clerkUserId: string, vacancyId: string) {
    return this.changeVacancyStatus(clerkUserId, vacancyId, ListingStatus.ARCHIVED);
  }

  /** Архівує прострочені активні вакансії компанії. */
  private async archiveExpiredVacancies(companyId: string) {
    await this.vacancies.archiveExpiredActiveVacancies(companyId, this.todayDateOnly());
  }

  /** Нормалізує query-параметри списку вакансій для репозиторію. */
  private normalizeListQuery(query: VacancyListRequest): VacancyListParams {
    const allowedSortFields: VacancyListSortBy[] = ["title", "status", "closingDate", "updatedAt", "createdAt"];
    const page = this.clampPositiveInt(query.page, 1, 1, 10_000);
    const pageSize = this.clampPositiveInt(query.pageSize, 10, 5, 20);
    const search = typeof query.search === "string" && query.search.trim() ? query.search.trim() : null;
    const status = typeof query.status === "string" && Object.values(ListingStatus).includes(query.status as ListingStatus)
      ? query.status as ListingStatus
      : null;
    const sortBy = typeof query.sortBy === "string" && allowedSortFields.includes(query.sortBy as VacancyListSortBy)
      ? query.sortBy as VacancyListSortBy
      : "updatedAt";
    const sortDirection = query.sortDirection === "asc" ? "asc" : "desc";

    return { page, pageSize, search, status, sortBy, sortDirection };
  }

  /** Повертає ціле число в дозволених межах або значення за замовчуванням. */
  private clampPositiveInt(value: unknown, fallback: number, min: number, max: number) {
    const parsed = Number(value);
    if (!Number.isInteger(parsed)) return fallback;
    return Math.min(Math.max(parsed, min), max);
  }

  /** Перевіряє DTO вакансії та нормалізує масиви. */
  private async validateVacancyBody(body: VacancyUpsertRequest, companyId: string) {
    const title = this.requiredText(body.title, "Назва вакансії обов'язкова.");
    const description = this.requiredText(body.description, "Опис вакансії обов'язковий.");
    const professionId = this.requiredNumber(body.professionId, "Професія обов'язкова.");
    const sphereIds = this.uniqueNumbers(body.sphereIds ?? []);
    const skills = this.uniqueSkills(body.skills ?? []);
    const languages = this.uniqueLanguages(body.languages ?? []);
    const officeLocationIds = this.uniqueStrings(body.officeLocationIds ?? []);
    const workFormatIds = this.uniqueNumbers(body.workFormatIds ?? []);
    const employmentTypeIds = this.uniqueNumbers(body.employmentTypeIds ?? []);
    const workScheduleIds = this.uniqueNumbers(body.workScheduleIds ?? []);
    const closingDate = this.requiredFutureDate(body.closingDate);
    const status = body.status ?? ListingStatus.DRAFT;
    const salaryFrom = body.salaryFrom ?? null;
    const salaryTo = body.salaryTo ?? null;
    const salaryPeriod = salaryFrom === null ? null : (body.salaryPeriod ?? SalaryPeriod.PER_MONTH);

    if (sphereIds.length < 1 || sphereIds.length > 3) this.throwValidation("Оберіть від 1 до 3 сфер проєкту.");
    if (skills.length < 1) this.throwValidation("Додайте щонайменше одну навичку.");
    if (officeLocationIds.length < 1) this.throwValidation("Додайте щонайменше одну офісну локацію.");
    if (workFormatIds.length < 1) this.throwValidation("Оберіть хоча б один формат роботи.");
    if (employmentTypeIds.length < 1) this.throwValidation("Оберіть хоча б один тип зайнятості.");
    if (workScheduleIds.length < 1) this.throwValidation("Оберіть хоча б один графік роботи.");
    if (salaryTo !== null && salaryFrom === null) this.throwValidation("Поле зарплати 'до' доступне тільки після заповнення 'від'.");
    if (salaryFrom !== null && salaryFrom < 0) this.throwValidation("Мінімальна зарплата не може бути від'ємною.");
    if (salaryTo !== null && salaryTo < salaryFrom!) this.throwValidation("Максимальна зарплата не може бути меншою за мінімальну.");
    this.ensureAllowedStatus(status);
    if (salaryPeriod) this.ensureAllowedSalaryPeriod(salaryPeriod);

    await this.ensureSkillsExist(skills.map((skill) => skill.skillId));
    await this.ensureCompanyLocations(companyId, officeLocationIds);

    return {
      title,
      description,
      professionId,
      sphereIds,
      skills,
      languages,
      officeLocationIds,
      workFormatIds,
      employmentTypeIds,
      workScheduleIds,
      closingDate,
      status,
      salaryFrom,
      salaryTo,
      salaryPeriod,
      isLocationStrict: Boolean(body.isLocationStrict),
    };
  }

  /** Створює базові дані вакансії для create. */
  private mapBaseCreateData(
    body: Awaited<ReturnType<VacancyService["validateVacancyBody"]>>,
    hrProfileId: string,
    companyId: string,
  ): VacancyCreateData {
    return {
      ...this.mapBaseUpdateData(body),
      hrProfileId,
      companyId,
    };
  }

  /** Створює базові дані вакансії для update. */
  private mapBaseUpdateData(body: Awaited<ReturnType<VacancyService["validateVacancyBody"]>>): VacancyUpdateData {
    return {
      title: body.title,
      description: body.description,
      professionId: body.professionId,
      isLocationCritical: body.isLocationStrict,
      minSalary: body.salaryFrom,
      maxSalary: body.salaryTo,
      salaryPeriod: body.salaryPeriod,
      status: body.status,
      publishedAt: body.status === ListingStatus.ACTIVE ? new Date() : null,
      closingDate: body.closingDate,
    };
  }

  /** Замінює всі M:N зв'язки вакансії. */
  private async replaceRelations(
    repository: VacancyRepository,
    vacancyId: string,
    body: Awaited<ReturnType<VacancyService["validateVacancyBody"]>>,
  ) {
    await Promise.all([
      repository.replaceSpheres(vacancyId, body.sphereIds),
      repository.replaceSkills(vacancyId, body.skills),
      repository.replaceLanguages(vacancyId, body.languages),
      repository.replaceLocations(vacancyId, body.officeLocationIds),
      repository.replaceWorkFormats(vacancyId, body.workFormatIds),
      repository.replaceEmploymentTypes(vacancyId, body.employmentTypeIds),
      repository.replaceWorkSchedules(vacancyId, body.workScheduleIds),
    ]);
  }

  /** Повертає HR профіль або кидає помилку авторизації/доступу. */
  private async getHrProfileOrThrow(clerkUserId: string) {
    const hrProfile = await this.hrs.findByClerkUserId(clerkUserId);
    if (!hrProfile) {
      throw new BusinessLogicError("HR profile not found", HttpStatus.FORBIDDEN, "HR_PROFILE_NOT_FOUND");
    }
    return hrProfile;
  }

  /** Повертає вакансію компанії або кидає помилку доступу. */
  private async getOwnedVacancyOrThrow(vacancyId: string, companyId: string) {
    const vacancy = await this.vacancies.findCompanyVacancy(vacancyId, companyId);
    if (!vacancy) {
      throw new BusinessLogicError("Vacancy not found", HttpStatus.NOT_FOUND, "VACANCY_NOT_FOUND");
    }
    return vacancy;
  }

  /** Перевіряє, що всі локації вакансії належать компанії HR. */
  private async ensureCompanyLocations(companyId: string, locationIds: string[]) {
    const company = await this.companies.findCompanyById(companyId);
    const allowedLocationIds = new Set(company?.locations.map((item) => item.locationId) ?? []);
    const hasForeignLocation = locationIds.some((locationId) => !allowedLocationIds.has(locationId));
    if (hasForeignLocation) {
      throw new BusinessLogicError("Office location does not belong to current company", HttpStatus.FORBIDDEN, "FOREIGN_OFFICE_LOCATION");
    }
  }

  /** Перевіряє, що всі навички є в довіднику. */
  private async ensureSkillsExist(skillIds: number[]) {
    const existingCount = await this.skills.countExistingSkills(skillIds);
    if (existingCount !== skillIds.length) {
      throw new BusinessLogicError("One or more skills do not exist", HttpStatus.BAD_REQUEST, "SKILLS_NOT_FOUND");
    }
  }

  /** Групує навички за категоріями для frontend. */
  private groupSkillsByCategory(skills: Awaited<ReturnType<SkillRepository["searchSkills"]>>) {
    return skills.reduce<Record<string, typeof skills>>((grouped, skill) => {
      grouped[skill.category] ??= [];
      grouped[skill.category].push(skill);
      return grouped;
    }, {});
  }

  /** Мапить вакансію в DTO з блоком для майбутнього метчингу. */
  private mapVacancy(vacancy: Awaited<ReturnType<VacancyRepository["findVacancyById"]>>) {
    if (!vacancy) return null;
    return {
      ...vacancy,
      status: this.getEffectiveStatus(vacancy.status, vacancy.closingDate),
      matchingRequirements: normalizeVacancyRequirements({
        skills: vacancy.skills.map((item) => ({ skillId: item.skillId, weight: item.weight })),
        languages: vacancy.languages.map((item) => ({ languageId: item.languageId, level: item.level })),
        locations: vacancy.locations.map((item) => ({ locationId: item.locationId })),
        isLocationCritical: vacancy.isLocationCritical,
        workFormats: vacancy.workFormats.map((item) => ({ workFormatId: item.workFormatId })),
        employmentTypes: vacancy.employmentTypes.map((item) => ({ employmentTypeId: item.employmentTypeId })),
        workSchedules: vacancy.workSchedules.map((item) => ({ workScheduleId: item.workScheduleId })),
        minSalary: vacancy.minSalary,
        maxSalary: vacancy.maxSalary,
        salaryPeriod: vacancy.salaryPeriod,
      }),
    };
  }

  /** Повертає ефективний статус без очікування cron, якщо closingDate вже минула. */
  private getEffectiveStatus(status: ListingStatus, closingDate: Date) {
    if (status === ListingStatus.ACTIVE && closingDate < this.todayDateOnly()) return ListingStatus.ARCHIVED;
    return status;
  }

  /** Перевіряє допустимість статусу для HR-флоу. */
  private ensureAllowedStatus(status: ListingStatus) {
    const allowedStatuses: ListingStatus[] = [
      ListingStatus.DRAFT,
      ListingStatus.ACTIVE,
      ListingStatus.PAUSED,
      ListingStatus.CLOSED,
      ListingStatus.ARCHIVED,
    ];
    if (!allowedStatuses.includes(status)) {
      throw new BusinessLogicError("Unsupported vacancy status", HttpStatus.BAD_REQUEST, "UNSUPPORTED_VACANCY_STATUS");
    }
  }

  /** Перевіряє допустимість періоду зарплати для збереження вакансії. */
  private ensureAllowedSalaryPeriod(period: SalaryPeriod) {
    if (!Object.values(SalaryPeriod).includes(period)) {
      throw new BusinessLogicError("Unsupported salary period", HttpStatus.BAD_REQUEST, "UNSUPPORTED_SALARY_PERIOD");
    }
  }

  /** Повертає обрізаний обов'язковий текст. */
  private requiredText(value: unknown, message: string) {
    if (typeof value !== "string" || !value.trim()) this.throwValidation(message);
    return value.trim();
  }

  /** Повертає обов'язкове число. */
  private requiredNumber(value: unknown, message: string) {
    if (typeof value !== "number" || Number.isNaN(value)) this.throwValidation(message);
    return value;
  }

  /** Повертає дату майбутнього дедлайну. */
  private requiredFutureDate(value: unknown) {
    if (typeof value !== "string" || !value) this.throwValidation("Дата завершення вакансії обов'язкова.");
    const date = new Date(value);
    if (Number.isNaN(date.getTime()) || date <= this.todayDateOnly()) {
      this.throwValidation("Дата завершення вакансії має бути в майбутньому.");
    }
    return date;
  }

  /** Прибирає дублікати числових id. */
  private uniqueNumbers(values: number[]) {
    return [...new Set(values.filter((value) => Number.isInteger(value)))];
  }

  /** Прибирає дублікати рядкових id. */
  private uniqueStrings(values: string[]) {
    return [...new Set(values.filter((value) => typeof value === "string" && value.trim()).map((value) => value.trim()))];
  }

  /** Прибирає дублікати навичок, залишаючи останню обрану вагу. */
  private uniqueSkills(skills: VacancySkillRequest[]) {
    const map = new Map<number, VacancySkillRequest>();
    skills.forEach((skill) => {
      if (Number.isInteger(skill.skillId) && Object.values(RequirementWeight).includes(skill.weight)) {
        map.set(skill.skillId, skill);
      }
    });
    return [...map.values()];
  }

  /** Прибирає дублікати мов, залишаючи останній обраний рівень. */
  private uniqueLanguages(languages: VacancyLanguageRequest[]) {
    const map = new Map<number, VacancyLanguageRequest>();
    languages.forEach((language) => {
      if (Number.isInteger(language.languageId) && Object.values(LanguageLevel).includes(language.level)) {
        map.set(language.languageId, language);
      }
    });
    return [...map.values()];
  }

  /** Кидає бізнес-помилку валідації вакансії. */
  private throwValidation(message: string): never {
    throw new BusinessLogicError(message, HttpStatus.BAD_REQUEST, "VACANCY_VALIDATION_ERROR");
  }

  /** Повертає сьогоднішню дату без часу для порівняння з @db.Date. */
  private todayDateOnly() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
  }
}

export const vacancyService = new VacancyService();
