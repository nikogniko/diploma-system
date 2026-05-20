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

const vacancyInclude = {
  profession: true,
  spheres: { include: { sphere: true } },
  employmentTypes: { include: { employmentType: true } },
  workSchedules: { include: { workSchedule: true } },
  workFormats: { include: { workFormat: true } },
  locations: { include: { location: true } },
  skills: { include: { skill: true } },
  languages: { include: { language: true } },
  hrProfile: { include: { user: true } },
  company: true,
} satisfies Prisma.VacancyInclude;

export class VacancyRepository {
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
  async listCompanyVacancies(companyId: string) {
    return this.db.vacancy.findMany({
      where: { companyId },
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
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
