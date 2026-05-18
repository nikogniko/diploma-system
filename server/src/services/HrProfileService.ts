import {
  CompanySize,
  LinkType,
  ModerationStatus,
  RegistrationType,
  UserRole,
  UserStatus,
} from "../../prisma/generated/client/index.js";
import { BusinessLogicError, HttpStatus } from "../errors/BusinessLogicError.js";
import {
  CompanyRepository,
  type CompanyCreateData,
  companyRepository,
} from "../repositories/CompanyRepository.js";
import {
  HrProfileRepository,
  hrProfileRepository,
} from "../repositories/HrProfileRepository.js";
import { transactionManager, TransactionManager } from "../repositories/TransactionManager.js";
import { UserRepository, userRepository } from "../repositories/UserRepository.js";
import { EmailValidator } from "../utils/EmailValidator.js";
import {
  ClerkUserSyncService,
  clerkUserSyncService,
} from "./ClerkUserSyncService.js";

type LinkInput = {
  linkType: LinkType;
  linkName: string;
  value: string;
};

export type ExistingCompanyHrOnboardingRequest = {
  role: "HR";
  email?: string;
  firstName: string;
  lastName: string;
  middleName?: string | null;
  photoUrl?: string | null;
  position: string;
  companyId: string;
};

export type NewCompanyHrOnboardingRequest = {
  role: "HR";
  email?: string;
  firstName: string;
  lastName: string;
  middleName?: string | null;
  photoUrl?: string | null;
  position: string;
  company: {
    registrationType: RegistrationType;
    registrationNumber: string;
    legalName: string;
    corporateDomain?: string | null;
    logoUrl?: string | null;
    publicName: string;
    websiteUrl?: string | null;
    foundationYear: number;
    employeeCount?: CompanySize | null;
    about: string;
    publicEmail: string;
    publicPhone?: string | null;
  };
};

export type UpdateHrProfileRequest = {
  position?: string;
  links?: LinkInput[];
};

export class HrProfileService {
  constructor(
    private readonly users: UserRepository = userRepository,
    private readonly companies: CompanyRepository = companyRepository,
    private readonly hrs: HrProfileRepository = hrProfileRepository,
    private readonly txManager: TransactionManager = transactionManager,
    private readonly clerkSync: ClerkUserSyncService = clerkUserSyncService,
  ) {}

  /** Завершує HR onboarding: компанія створюється першою, потім оновлюється User, потім створюється HrProfile. */
  async completeHrOnboarding(
    clerkUserId: string,
    body: ExistingCompanyHrOnboardingRequest | NewCompanyHrOnboardingRequest,
  ) {
    const user = await this.users.findUserByClerkId(clerkUserId);

    if (!user) {
      throw new BusinessLogicError(
        "Base user must exist before HR onboarding",
        HttpStatus.BAD_REQUEST,
        "BASE_USER_MISSING",
      );
    }

    if (user.status === UserStatus.DELETED || user.status === UserStatus.BLOCKED) {
      throw new BusinessLogicError(
        "User cannot complete HR onboarding",
        HttpStatus.FORBIDDEN,
        "USER_CANNOT_ONBOARD",
      );
    }

    if (user.hrProfile) {
      throw new BusinessLogicError(
        "HR profile already exists",
        HttpStatus.CONFLICT,
        "PROFILE_EXISTS",
      );
    }

    const result = await this.txManager.run(async (tx) => {
      const txUsers = new UserRepository(tx);
      const txCompanies = new CompanyRepository(tx);
      const txHrs = new HrProfileRepository(tx);
      const email = EmailValidator.normalizeEmail(body.email ?? user.email);

      const company =
        "company" in body
          ? await txCompanies.createCompany(this.mapCompanyCreateData(body.company))
          : await txCompanies.findCompanyById(body.companyId);

      if (!company) {
        throw new BusinessLogicError(
          "Company not found",
          HttpStatus.NOT_FOUND,
          "COMPANY_NOT_FOUND",
        );
      }

      if (!EmailValidator.isValidRecruiterDomain(email, company.corporateDomain)) {
        throw new BusinessLogicError(
          "Recruiter email domain does not match company corporate domain",
          HttpStatus.FORBIDDEN,
          "INVALID_RECRUITER_DOMAIN",
        );
      }

      const updatedUser = await txUsers.updateUserIdentity(user.id, {
        firstName: this.requiredString(body.firstName, "firstName"),
        lastName: this.requiredString(body.lastName, "lastName"),
        middleName: body.middleName ?? null,
        photoUrl: body.photoUrl ?? user.photoUrl,
      });

      await txUsers.updateUserRole(user.id, UserRole.HR);
      await txUsers.updateUserStatus(user.id, UserStatus.PENDING_VERIFICATION);

      const hrProfile = await txHrs.createHrProfile({
        userId: user.id,
        companyId: company.id,
        position: this.requiredString(body.position, "position"),
      });

      // HR має пройти модерацію, але роль потрібна фронтенду для переходу в кабінет.
      return { user: updatedUser, company, hrProfile };
    });

    await this.syncClerkPublicMetadataBestEffort(clerkUserId, {
      role: UserRole.HR,
      status: UserStatus.PENDING_VERIFICATION,
    });

    return result;
  }

  /** Повертає HR профіль поточного рекрутера. */
  async getMyHrProfile(clerkUserId: string) {
    return this.getHrProfileOrThrow(clerkUserId);
  }

  /** Оновлює візитку HR і його додаткові контакти. */
  async updateMyHrProfile(clerkUserId: string, body: UpdateHrProfileRequest) {
    const hrProfile = await this.getHrProfileOrThrow(clerkUserId);

    return this.txManager.run(async (tx) => {
      const txHrs = new HrProfileRepository(tx);
      const updatedHrProfile = await txHrs.updateHrProfile(hrProfile.id, {
        position: body.position ? this.requiredString(body.position, "position") : undefined,
      });

      if (body.links) {
        await txHrs.replaceLinks(hrProfile.id, this.mapLinks(body.links));
      }

      return updatedHrProfile;
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

  /** Перетворює DTO нової компанії на дані для CompanyRepository. */
  private mapCompanyCreateData(company: NewCompanyHrOnboardingRequest["company"]): CompanyCreateData {
    return {
      registrationType: company.registrationType,
      registrationNumber: this.requiredString(company.registrationNumber, "company.registrationNumber"),
      legalName: this.requiredString(company.legalName, "company.legalName"),
      corporateDomain: company.corporateDomain ?? null,
      verificationStatus: ModerationStatus.PENDING,
      logoUrl: company.logoUrl ?? null,
      publicName: this.requiredString(company.publicName, "company.publicName"),
      websiteUrl: company.websiteUrl ?? null,
      foundationYear: this.requiredNumber(company.foundationYear, "company.foundationYear"),
      employeeCount: company.employeeCount ?? null,
      about: this.requiredString(company.about, "company.about"),
      publicEmail: EmailValidator.normalizeEmail(
        this.requiredString(company.publicEmail, "company.publicEmail"),
      ),
      publicPhone: company.publicPhone ?? null,
    };
  }

  /** Перетворює посилання з API у формат createMany. */
  private mapLinks(links: LinkInput[]) {
    return links.map((link) => ({
      linkType: this.requiredEnum(link.linkType, LinkType, "linkType"),
      linkName: this.requiredString(link.linkName, "linkName"),
      value: this.requiredString(link.value, "value"),
    }));
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

  /** Синхронізує роль/статус у Clerk без відкату локальної транзакції при зовнішній помилці. */
  private async syncClerkPublicMetadataBestEffort(
    clerkUserId: string,
    metadata: Record<string, string>,
  ) {
    try {
      await this.clerkSync.updatePublicMetadata(clerkUserId, metadata);
    } catch (error) {
      console.error("Failed to update Clerk public metadata", error);
    }
  }
}

export const hrProfileService = new HrProfileService();
