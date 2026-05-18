import { UserRole, UserStatus } from "../../prisma/generated/client/index.js";
import { BusinessLogicError, HttpStatus } from "../errors/BusinessLogicError.js";
import {
  StudentProfileRepository,
  studentProfileRepository,
} from "../repositories/StudentProfileRepository.js";
import { transactionManager, TransactionManager } from "../repositories/TransactionManager.js";
import {
  type BaseUserData,
  UserRepository,
  userRepository,
} from "../repositories/UserRepository.js";
import { EmailValidator } from "../utils/EmailValidator.js";
import {
  ClerkUserSyncService,
  clerkUserSyncService,
} from "./ClerkUserSyncService.js";
import {
  type ExistingCompanyHrOnboardingRequest,
  HrProfileService,
  hrProfileService,
  type NewCompanyHrOnboardingRequest,
} from "./HrProfileService.js";

type ClerkEmailAddress = {
  id?: string;
  email_address?: string;
};

type ClerkUserPayload = {
  id?: string;
  email_addresses?: ClerkEmailAddress[];
  primary_email_address_id?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  image_url?: string | null;
  profile_image_url?: string | null;
};

type ClerkWebhookPayload = {
  type?: string;
  data?: ClerkUserPayload;
};

export type StudentOnboardingRequest = {
  role: "STUDENT";
  email?: string;
  firstName: string;
  lastName: string;
  middleName?: string | null;
  photoUrl?: string | null;
  birthDate: string;
  contactEmail?: string;
  primaryPhone: string;
  secondaryPhone?: string | null;
  about?: string | null;
};

export type OnboardingRequest =
  | StudentOnboardingRequest
  | ExistingCompanyHrOnboardingRequest
  | NewCompanyHrOnboardingRequest;

export class UserService {
  constructor(
    private readonly users: UserRepository = userRepository,
    private readonly students: StudentProfileRepository = studentProfileRepository,
    private readonly txManager: TransactionManager = transactionManager,
    private readonly clerkSync: ClerkUserSyncService = clerkUserSyncService,
    private readonly hrProfiles: HrProfileService = hrProfileService,
  ) {}

  /** Обробляє Clerk webhook для синхронізації створення, оновлення та видалення користувача. */
  async handleClerkWebhook(payload: ClerkWebhookPayload) {
    const eventType = payload.type;
    const userData = payload.data;

    if (!eventType || !userData?.id) {
      throw new BusinessLogicError(
        "Invalid Clerk webhook payload",
        HttpStatus.BAD_REQUEST,
        "INVALID_CLERK_WEBHOOK",
      );
    }

    if (eventType === "user.deleted") {
      const existingUser = await this.users.findUserByClerkId(userData.id);
      if (!existingUser) return { action: "ignored", reason: "user_not_found" };

      const user = await this.users.markDeletedByClerkId(userData.id);
      return { action: "soft_deleted", user };
    }

    if (eventType !== "user.created" && eventType !== "user.updated") {
      return { action: "ignored", reason: "unsupported_event" };
    }

    const baseUser = this.mapClerkUserToBaseUser(userData);

    if (eventType === "user.created") {
      const user = await this.users.upsertBaseUser(baseUser);
      return { action: "upserted", user };
    }

    const existingUser = await this.users.findUserByClerkId(userData.id);

    if (!existingUser) {
      const user = await this.users.upsertBaseUser(baseUser);
      return { action: "created_from_update", user };
    }

    const user = await this.users.updateClerkSyncedUser(userData.id, baseUser);
    return { action: "updated", user };
  }

  /** Завершує onboarding відповідно до ролі, яку користувач обрав на фронтенді. */
  async completeOnboarding(clerkUserId: string, body: OnboardingRequest) {
    if (body.role === "STUDENT") {
      return this.completeStudentOnboarding(clerkUserId, body);
    }

    if (body.role === "HR") {
      return this.completeHrOnboarding(clerkUserId, body);
    }

    throw new BusinessLogicError(
      "Unsupported onboarding role",
      HttpStatus.BAD_REQUEST,
      "UNSUPPORTED_ROLE",
    );
  }

  /** Завершує student onboarding: перевіряє academic email, оновлює User і створює StudentProfile. */
  async completeStudentOnboarding(
    clerkUserId: string,
    body: StudentOnboardingRequest,
  ) {
    const user = await this.ensureBaseUserExists(clerkUserId, body);
    const email = EmailValidator.normalizeEmail(body.email ?? user.email);

    if (!EmailValidator.isAcademic(email)) {
      await this.users.markDeletedByClerkId(clerkUserId);
      await this.deleteClerkUserBestEffort(clerkUserId);

      throw new BusinessLogicError(
        "Student registration is allowed only for academic email domains",
        HttpStatus.FORBIDDEN,
        "NON_ACADEMIC_EMAIL",
      );
    }

    this.ensureUserCanOnboard(user);
    this.ensureNoProfileExists(user.studentProfile, "Student profile already exists");

    const result = await this.txManager.run(async (tx) => {
      const txUsers = new UserRepository(tx);
      const txStudents = new StudentProfileRepository(tx);

      const updatedUser = await txUsers.updateUserIdentity(user.id, {
        firstName: this.requiredString(body.firstName, "firstName"),
        lastName: this.requiredString(body.lastName, "lastName"),
        middleName: body.middleName ?? null,
        photoUrl: body.photoUrl ?? user.photoUrl,
      });

      await txUsers.updateUserRole(user.id, UserRole.STUDENT);
      await txUsers.updateUserStatus(user.id, UserStatus.ACTIVE);

      const studentProfile = await txStudents.createProfile({
        userId: user.id,
        birthDate: this.parseDate(body.birthDate, "birthDate"),
        contactEmail: EmailValidator.normalizeEmail(body.contactEmail ?? email),
        primaryPhone: this.requiredString(body.primaryPhone, "primaryPhone"),
        secondaryPhone: body.secondaryPhone ?? null,
        about: body.about ?? null,
      });

      return { user: updatedUser, studentProfile };
    });

    await this.syncClerkPublicMetadataBestEffort(clerkUserId, {
      role: UserRole.STUDENT,
      status: UserStatus.ACTIVE,
    });

    return result;
  }

  /** Завершує HR onboarding для існуючої або нової компанії. */
  async completeHrOnboarding(
    clerkUserId: string,
    body: ExistingCompanyHrOnboardingRequest | NewCompanyHrOnboardingRequest,
  ) {
    await this.ensureBaseUserExists(clerkUserId, body);
    return this.hrProfiles.completeHrOnboarding(clerkUserId, body);
  }

  /** Дозволяє SYS_ADMIN змінити статус іншого користувача. */
  async updateUserStatus(
    actorClerkUserId: string,
    targetUserId: string,
    status: UserStatus,
  ) {
    const actor = await this.users.findUserByClerkId(actorClerkUserId);

    if (!actor || actor.role !== UserRole.SYS_ADMIN) {
      throw new BusinessLogicError(
        "Only system administrators can update user statuses",
        HttpStatus.FORBIDDEN,
        "SYS_ADMIN_REQUIRED",
      );
    }

    if (!Object.values(UserStatus).includes(status)) {
      throw new BusinessLogicError(
        "Invalid user status",
        HttpStatus.BAD_REQUEST,
        "INVALID_USER_STATUS",
      );
    }

    return this.users.updateUserStatus(targetUserId, status);
  }

  /** Повертає публічну інформацію користувача для відображення у профілях. */
  async getPublicUserInfo(userId: string) {
    const publicInfo = await this.users.findPublicInfoById(userId);

    if (!publicInfo) {
      throw new BusinessLogicError(
        "User not found",
        HttpStatus.NOT_FOUND,
        "USER_NOT_FOUND",
      );
    }

    return publicInfo;
  }

  /** Повертає роль і статус поточного користувача для клієнтського redirect після входу. */
  async getMyAuthSnapshot(clerkUserId: string) {
    const user = await this.users.findAuthSnapshotByClerkId(clerkUserId);

    if (!user) {
      throw new BusinessLogicError(
        "User is not synced from Clerk yet",
        HttpStatus.NOT_FOUND,
        "USER_NOT_SYNCED",
      );
    }

    return user;
  }

  /** Оновлює email поточного користувача в Clerk і локальній БД з валідацією за роллю. */
  async updateMyEmail(clerkUserId: string, email: string) {
    const user = await this.users.findUserByClerkId(clerkUserId);

    if (!user) {
      throw new BusinessLogicError(
        "User not found",
        HttpStatus.NOT_FOUND,
        "USER_NOT_FOUND",
      );
    }

    const normalizedEmail = EmailValidator.normalizeEmail(
      this.requiredString(email, "email"),
    );

    if (user.role === UserRole.STUDENT && !EmailValidator.isAcademic(normalizedEmail)) {
      throw new BusinessLogicError(
        "Student email must use an academic domain",
        HttpStatus.FORBIDDEN,
        "NON_ACADEMIC_EMAIL",
      );
    }

    if (
      user.role === UserRole.HR &&
      user.hrProfile?.company?.corporateDomain &&
      !EmailValidator.isValidRecruiterDomain(
        normalizedEmail,
        user.hrProfile.company.corporateDomain,
      )
    ) {
      throw new BusinessLogicError(
        "HR email domain does not match company domain",
        HttpStatus.FORBIDDEN,
        "INVALID_RECRUITER_DOMAIN",
      );
    }

    await this.clerkSync.setPrimaryEmail(clerkUserId, normalizedEmail);
    return this.users.updateEmail(user.id, normalizedEmail);
  }

  /** Перетворює payload Clerk user на внутрішні поля User. */
  private mapClerkUserToBaseUser(userData: ClerkUserPayload): BaseUserData {
    const email = this.extractPrimaryEmail(userData);

    return {
      clerkUserId: this.requiredString(userData.id, "data.id"),
      email,
      firstName: userData.first_name,
      lastName: userData.last_name,
      photoUrl: userData.image_url ?? userData.profile_image_url ?? null,
      status: UserStatus.PENDING_VERIFICATION,
    };
  }

  /** Витягує primary email з Clerk payload. */
  private extractPrimaryEmail(userData: ClerkUserPayload): string {
    const primaryEmail =
      userData.email_addresses?.find(
        (email) => email.id === userData.primary_email_address_id,
      ) ?? userData.email_addresses?.[0];

    if (!primaryEmail?.email_address) {
      throw new BusinessLogicError(
        "Clerk user has no email address",
        HttpStatus.BAD_REQUEST,
        "CLERK_EMAIL_MISSING",
      );
    }

    return EmailValidator.normalizeEmail(primaryEmail.email_address);
  }

  /** Гарантує, що локальний User існує перед onboarding. */
  private async ensureBaseUserExists(
    clerkUserId: string,
    body: { email?: string; firstName?: string; lastName?: string; photoUrl?: string | null },
  ) {
    const existingUser = await this.users.findUserByClerkId(clerkUserId);
    if (existingUser) return existingUser;

    if (!body.email) {
      throw new BusinessLogicError(
        "User is not synced from Clerk yet and email was not provided",
        HttpStatus.BAD_REQUEST,
        "BASE_USER_MISSING",
      );
    }

    return this.users.upsertBaseUser({
      clerkUserId,
      email: body.email,
      firstName: body.firstName,
      lastName: body.lastName,
      photoUrl: body.photoUrl,
    });
  }

  /** Перевіряє, що користувач може проходити публічний onboarding. */
  private ensureUserCanOnboard(user: { status: UserStatus; role: UserRole }) {
    if (user.status === UserStatus.DELETED) {
      throw new BusinessLogicError(
        "Deleted user cannot complete onboarding",
        HttpStatus.FORBIDDEN,
        "USER_DELETED",
      );
    }

    if (user.status === UserStatus.BLOCKED) {
      throw new BusinessLogicError(
        "Blocked user cannot complete onboarding",
        HttpStatus.FORBIDDEN,
        "USER_BLOCKED",
      );
    }

    if (user.role === UserRole.SYS_ADMIN) {
      throw new BusinessLogicError(
        "System administrators cannot onboard through public registration",
        HttpStatus.FORBIDDEN,
        "SYS_ADMIN_PUBLIC_ONBOARDING_FORBIDDEN",
      );
    }
  }

  /** Перевіряє, що відповідний профіль ще не створений. */
  private ensureNoProfileExists(profile: unknown, message: string) {
    if (profile) {
      throw new BusinessLogicError(message, HttpStatus.CONFLICT, "PROFILE_EXISTS");
    }
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

  /** Повертає число або кидає бізнес-помилку для обов'язкового числового поля. */
  private requiredNumber(value: unknown, fieldName: string): number {
    if (typeof value !== "number" || Number.isNaN(value)) {
      throw new BusinessLogicError(
        `${fieldName} is required`,
        HttpStatus.BAD_REQUEST,
        "REQUIRED_FIELD_MISSING",
        { fieldName },
      );
    }

    return value;
  }

  /** Парсить ISO дату і перевіряє її валідність. */
  private parseDate(value: string, fieldName: string): Date {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      throw new BusinessLogicError(
        `${fieldName} must be a valid date`,
        HttpStatus.BAD_REQUEST,
        "INVALID_DATE",
        { fieldName },
      );
    }

    return date;
  }

  /** Пробує видалити Clerk user, якщо студент не пройшов перевірку email. */
  private async deleteClerkUserBestEffort(clerkUserId: string) {
    try {
      await this.clerkSync.deleteUser(clerkUserId);
    } catch (error) {
      console.error("Failed to delete Clerk user after rejected onboarding", error);
    }
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

export const userService = new UserService();
