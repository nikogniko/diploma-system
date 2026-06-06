import {
  CompanySize,
  LinkType,
  RegistrationType,
  UserRole,
} from "../../prisma/generated/client/index.js";
import { BusinessLogicError, HttpStatus } from "../errors/BusinessLogicError.js";
import {
  CompanyRepository,
  type CompanyUpdateData,
  companyRepository,
} from "../repositories/CompanyRepository.js";
import {
  HrProfileRepository,
  hrProfileRepository,
} from "../repositories/HrProfileRepository.js";
import {
  StudentProfileRepository,
  studentProfileRepository,
  type LocationKey,
} from "../repositories/StudentProfileRepository.js";
import { transactionManager, TransactionManager } from "../repositories/TransactionManager.js";
import { VacancyRepository, vacancyRepository } from "../repositories/VacancyRepository.js";
import { ApplicationRepository, applicationRepository } from "../repositories/ApplicationRepository.js";
import { EmailValidator } from "../utils/EmailValidator.js";
import { applyHrContactPolicy, applyVacancyRecruiterContactPolicy } from "../utils/ContactAccessPolicy.js";
import {
  ensureArrayLength,
  normalizeEmail,
  optionalDomain,
  optionalText,
  optionalUrl,
  requireText,
  requireUrl,
  validationLimits,
} from "../utils/InputValidation.js";

type LinkInput = {
  linkType: LinkType;
  linkName: string;
  value: string;
};

export type UpdateCompanyRequest = {
  registrationType?: RegistrationType;
  registrationNumber?: string;
  legalName?: string;
  corporateDomain?: string | null;
  logoUrl?: string | null;
  publicName?: string;
  websiteUrl?: string | null;
  foundationYear?: number;
  employeeCount?: CompanySize | null;
  about: string;
  publicEmail?: string;
  publicPhone?: string | null;
  sphereIds?: number[];
  locations?: LocationKey[];
  links?: LinkInput[];
};

export class CompanyService {
  constructor(
    private readonly companies: CompanyRepository = companyRepository,
    private readonly hrs: HrProfileRepository = hrProfileRepository,
    private readonly txManager: TransactionManager = transactionManager,
    private readonly vacancies: VacancyRepository = vacancyRepository,
    private readonly applications: ApplicationRepository = applicationRepository,
    private readonly students: StudentProfileRepository = studentProfileRepository,
  ) {}

  /** Повертає компанію, до якої належить поточний HR. */
  async getMyCompany(clerkUserId: string) {
    return this.getCompanyForHrOrThrow(clerkUserId);
  }

  /** Шукає компанії для вибору під час onboarding роботодавця. */
  async searchCompanies(query?: string) {
    return this.companies.searchCompanies(query);
  }

  /** Повертає публічну сторінку компанії за id. */
  async getPublicCompany(companyId: string, clerkUserId?: string | null) {
    const company = await this.companies.findCompanyById(companyId);
    if (!company) {
      throw new BusinessLogicError(
        "Company not found",
        HttpStatus.NOT_FOUND,
        "COMPANY_NOT_FOUND",
      );
    }

    const [companyHrs, vacancyPage, student] = await Promise.all([
      this.companies.listCompanyHrs(companyId),
      this.vacancies.listPublicCompanyVacancies(companyId),
      clerkUserId ? this.students.findByClerkUserId(clerkUserId) : Promise.resolve(null),
    ]);

    const [appliedVacancyIds, appliedHrProfileIds] = student
      ? await Promise.all([
          this.applications.listAppliedVacancyIds(student.id),
          this.applications.listAppliedHrProfileIdsForCompany(student.id, companyId),
        ])
      : [[], []];
    const visibleVacancies = new Set(appliedVacancyIds);
    const visibleHrs = new Set(appliedHrProfileIds);

    return {
      company,
      companyHrs: companyHrs.map((hr) => applyHrContactPolicy(hr, visibleHrs.has(hr.id))),
      vacancies: vacancyPage.map((vacancy) =>
        applyVacancyRecruiterContactPolicy(vacancy, visibleVacancies.has(vacancy.id))),
    };
  }

  /** Повертає список HR профілів компанії поточного HR. */
  async getMyCompanyHrs(clerkUserId: string) {
    const hrProfile = await this.getHrProfileOrThrow(clerkUserId);
    return this.companies.listCompanyHrs(hrProfile.companyId);
  }

  /** Оновлює публічну візитку компанії, сфери, локації та посилання. */
  async updateMyCompany(clerkUserId: string, body: UpdateCompanyRequest) {
    const hrProfile = await this.getHrProfileOrThrow(clerkUserId);
    this.ensureHrCanManageCompany(hrProfile);
    const about = requireText(body.about, "about", validationLimits.companyAbout);

    return this.txManager.run(async (tx) => {
      const txCompanies = new CompanyRepository(tx);
      const updatedCompany = await txCompanies.updateCompany(hrProfile.companyId, {
        registrationType: body.registrationType
          ? this.requiredEnum(body.registrationType, RegistrationType, "registrationType")
          : undefined,
        registrationNumber: body.registrationNumber !== undefined
          ? requireText(body.registrationNumber, "registrationNumber", validationLimits.companyRegistrationNumber)
          : undefined,
        legalName: body.legalName !== undefined
          ? requireText(body.legalName, "legalName", validationLimits.companyLegalName)
          : undefined,
        corporateDomain: "corporateDomain" in body
          ? optionalDomain(body.corporateDomain, "corporateDomain", validationLimits.companyDomain)
          : undefined,
        logoUrl: "logoUrl" in body
          ? optionalUrl(body.logoUrl, "logoUrl", validationLimits.resourceUrl)
          : undefined,
        publicName: body.publicName !== undefined
          ? requireText(body.publicName, "publicName", validationLimits.companyPublicName)
          : undefined,
        websiteUrl: "websiteUrl" in body
          ? optionalUrl(body.websiteUrl, "websiteUrl", validationLimits.resourceUrl)
          : undefined,
        foundationYear: body.foundationYear,
        employeeCount: "employeeCount" in body ? body.employeeCount : undefined,
        about,
        publicEmail: body.publicEmail
          ? normalizeEmail(EmailValidator.normalizeEmail(body.publicEmail), "publicEmail")
          : undefined,
        publicPhone: "publicPhone" in body
          ? optionalText(body.publicPhone, "publicPhone", validationLimits.phone)
          : undefined,
      } satisfies CompanyUpdateData);

      if (body.sphereIds) {
        await txCompanies.replaceCompanySpheres(
          hrProfile.companyId,
          this.uniqueNumbers(body.sphereIds),
        );
      }

      if (body.locations) {
        const locations = await Promise.all(
          body.locations.map((location) => txCompanies.upsertLocation(location)),
        );
        await txCompanies.replaceCompanyLocations(
          hrProfile.companyId,
          locations.map((location) => location.id),
        );
      }

      if (body.links) {
        await txCompanies.replaceLinks(hrProfile.companyId, this.mapLinks(body.links));
      }

      return updatedCompany;
    });
  }

  /** Перевіряє, що HR існує і має профіль. */
  private async getHrProfileOrThrow(clerkUserId: string) {
    const hrProfile = await this.hrs.findByClerkUserId(clerkUserId);

    if (!hrProfile || hrProfile.user.role !== UserRole.HR) {
      throw new BusinessLogicError(
        "HR profile not found for current user",
        HttpStatus.NOT_FOUND,
        "HR_PROFILE_NOT_FOUND",
      );
    }

    return hrProfile;
  }

  /** Повертає компанію HR або кидає помилку, якщо зв'язку немає. */
  private async getCompanyForHrOrThrow(clerkUserId: string) {
    const company = await this.companies.findCompanyByHrClerkId(clerkUserId);

    if (!company) {
      throw new BusinessLogicError(
        "Company not found for current HR",
        HttpStatus.NOT_FOUND,
        "COMPANY_NOT_FOUND",
      );
    }

    return company;
  }

  /** Перевіряє право HR редагувати компанію. */
  private ensureHrCanManageCompany(hrProfile: { companyId: string }) {
    // TODO: додати поле/таблицю для company admin role і перевіряти саме адміністратора компанії.
    // Наразі будь-який HR, прив'язаний до компанії, може редагувати її візитку.
    if (!hrProfile.companyId) {
      throw new BusinessLogicError(
        "HR is not attached to company",
        HttpStatus.FORBIDDEN,
        "HR_COMPANY_REQUIRED",
      );
    }
  }

  private mapLinks(links: LinkInput[]) {
    ensureArrayLength(links, "links", 0, validationLimits.companyLinks);

    return links.map((link) => ({
      linkType: this.requiredEnum(link.linkType, LinkType, "linkType"),
      linkName: requireText(link.linkName, "linkName", validationLimits.linkName),
      value: requireUrl(link.value, "value", validationLimits.linkValue),
    }));
  }

  /** Нормалізує масив чисел і прибирає дублікати. */
  private uniqueNumbers(values: number[] = []) {
    return [...new Set(values.map((value) => this.requiredNumber(value, "id")))];
  }

  /** Повертає trim-рядок або кидає бізнес-помилку для обов'язкового поля. */
  private requiredString(value: unknown, fieldName: string): string {
    if (typeof value !== "string" || value.trim().length === 0) {
      throw new BusinessLogicError(
        `${fieldName} is required`,
        HttpStatus.BAD_REQUEST,
        "REQUIRED_FIELD_MISSING",
        { fieldName },
      );
    }

    return value.trim();
  }

  /** Повертає число або кидає бізнес-помилку для числового поля. */
  private requiredNumber(value: unknown, fieldName: string): number {
    if (typeof value !== "number" || Number.isNaN(value)) {
      throw new BusinessLogicError(
        `${fieldName} must be a valid number`,
        HttpStatus.BAD_REQUEST,
        "INVALID_NUMBER",
        { fieldName },
      );
    }

    return value;
  }

  /** Перевіряє значення enum. */
  private requiredEnum<T extends Record<string, string>>(
    value: unknown,
    enumObject: T,
    fieldName: string,
  ): T[keyof T] {
    if (typeof value !== "string" || !Object.values(enumObject).includes(value)) {
      throw new BusinessLogicError(
        `${fieldName} has invalid value`,
        HttpStatus.BAD_REQUEST,
        "INVALID_ENUM_VALUE",
        { fieldName },
      );
    }

    return value as T[keyof T];
  }
}

export const companyService = new CompanyService();
