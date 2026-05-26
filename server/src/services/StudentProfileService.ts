import {
  Degree,
  Gender,
  LanguageLevel,
  LinkType,
  ProfileVisibility,
} from "../../prisma/generated/client/index.js";
import { BusinessLogicError, HttpStatus } from "../errors/BusinessLogicError.js";
import {
  type CourseData,
  type EducationData,
  type ExperienceData,
  type LanguageSkillData,
  type LocationKey,
  type ProjectData,
  StudentProfileRepository,
  studentProfileRepository,
} from "../repositories/StudentProfileRepository.js";
import { SkillRepository, skillRepository } from "../repositories/SkillRepository.js";
import { transactionManager, TransactionManager } from "../repositories/TransactionManager.js";
import { UserRepository } from "../repositories/UserRepository.js";
import { EmailValidator } from "../utils/EmailValidator.js";
import { ApplicationMatchRefreshService, applicationMatchRefreshService } from "./ApplicationMatchRefreshService.js";

type LinkInput = {
  linkType: LinkType;
  linkName: string;
  value: string;
};

export type UpdateStudentBaseDataRequest = {
  firstName?: string;
  lastName?: string;
  middleName?: string | null;
  photoUrl?: string | null;
  birthDate?: string;
  gender?: Gender | null;
  contactEmail?: string;
  primaryPhone?: string;
  secondaryPhone?: string | null;
  about: string;
  links?: LinkInput[];
};

export type UpdateStudentSearchSettingsRequest = {
  desiredPosition?: string | null;
  minSalary?: number | null;
  isActiveSearch?: boolean;
  visibility?: ProfileVisibility;
  desiredProfessionIds?: number[];
  employmentTypeIds?: number[];
  workScheduleIds?: number[];
  workFormatIds?: number[];
  desiredLocations?: LocationKey[];
};

export type EducationRequest = {
  universityId?: number | null;
  customUniversityName?: string | null;
  degree: Degree;
  specialty: string;
  startYear: number;
  endYear?: number | null;
  diplomaUrl?: string | null;
};

export type LanguageSkillRequest = {
  languageId: number;
  level: LanguageLevel;
  certificateUrl?: string | null;
};

export type CourseRequest = {
  title: string;
  startDate: string;
  endDate?: string | null;
  certificateUrl?: string | null;
  skillIds: number[];
};

export type ProjectRequest = {
  title: string;
  description: string;
  projectUrl?: string | null;
  skillIds: number[];
};

export type ExperienceRequest = {
  professionId: number;
  sphereId: number;
  companyName: string;
  position: string;
  startDate: string;
  endDate?: string | null;
  achievements: string;
  skillIds: number[];
};

export class StudentProfileService {
  constructor(
    private readonly profiles: StudentProfileRepository = studentProfileRepository,
    private readonly skills: SkillRepository = skillRepository,
    private readonly txManager: TransactionManager = transactionManager,
    private readonly matchRefresh: ApplicationMatchRefreshService = applicationMatchRefreshService,
  ) {}

  /** Повертає студентський профіль поточного користувача. */
  async getMyProfile(clerkUserId: string) {
    return this.getOwnedProfileOrThrow(clerkUserId);
  }

  /** Повертає всі поля, потрібні для персоналізованого пошуку вакансій. */
  async getSearchPreferences(clerkUserId: string) {
    const profile = await this.getOwnedProfileOrThrow(clerkUserId);

    return {
      desiredPosition: profile.desiredPosition,
      minSalary: profile.minSalary,
      isActiveSearch: profile.isActiveSearch,
      visibility: profile.visibility,
      desiredProfessions: profile.desiredProfessions,
      employmentTypes: profile.employmentTypes,
      workSchedules: profile.workSchedules,
      workFormats: profile.workFormats,
      desiredLocations: profile.desiredLocations,
    };
  }

  /** Оновлює базові дані студента та його посилання/соцмережі. */
  async updateBaseData(clerkUserId: string, body: UpdateStudentBaseDataRequest) {
    const profile = await this.getOwnedProfileOrThrow(clerkUserId);
    const about = this.requiredString(body.about, "about");
    const primaryPhone =
      body.primaryPhone === undefined
        ? profile.primaryPhone
        : this.requiredString(body.primaryPhone, "primaryPhone");

    const updated = await this.txManager.run(async (tx) => {
      const txProfiles = new StudentProfileRepository(tx);
      const txUsers = new UserRepository(tx);

      if (
        body.firstName !== undefined ||
        body.lastName !== undefined ||
        body.middleName !== undefined ||
        body.photoUrl !== undefined
      ) {
        await txUsers.updateUserIdentity(profile.userId, {
          firstName:
            body.firstName !== undefined
              ? this.requiredString(body.firstName, "firstName")
              : undefined,
          lastName:
            body.lastName !== undefined
              ? this.requiredString(body.lastName, "lastName")
              : undefined,
          middleName: body.middleName,
          photoUrl: body.photoUrl,
        });
      }

      const updatedProfile = await txProfiles.updateBaseData(profile.id, {
        birthDate: body.birthDate ? this.parseDate(body.birthDate, "birthDate") : undefined,
        gender: body.gender,
        contactEmail: body.contactEmail
          ? EmailValidator.normalizeEmail(body.contactEmail)
          : undefined,
        primaryPhone,
        secondaryPhone: body.secondaryPhone,
        about,
      });

      if (body.links) {
        await txProfiles.replaceLinks(profile.id, this.mapLinks(body.links));
      }

      return updatedProfile;
    });
    await this.matchRefresh.recalculateForStudent(profile.id);
    return updated;
  }

  /** Оновлює видимість, активний пошук і бажані параметри пошуку роботи. */
  async updateSearchSettings(
    clerkUserId: string,
    body: UpdateStudentSearchSettingsRequest,
  ) {
    const profile = await this.getOwnedProfileOrThrow(clerkUserId);

    return this.refreshAfter(profile.id, this.txManager.run(async (tx) => {
      const txProfiles = new StudentProfileRepository(tx);
      const updatedProfile = await txProfiles.updateSearchSettings(profile.id, {
        desiredPosition: body.desiredPosition,
        minSalary: body.minSalary,
        isActiveSearch: body.isActiveSearch,
        visibility: body.visibility,
      });

      if (body.desiredProfessionIds) {
        await txProfiles.replaceDesiredProfessions(
          profile.id,
          this.uniqueNumbers(body.desiredProfessionIds),
        );
      }

      if (body.employmentTypeIds) {
        await txProfiles.replaceEmploymentTypes(profile.id, this.uniqueNumbers(body.employmentTypeIds));
      }

      if (body.workScheduleIds) {
        await txProfiles.replaceWorkSchedules(profile.id, this.uniqueNumbers(body.workScheduleIds));
      }

      if (body.workFormatIds) {
        await txProfiles.replaceWorkFormats(profile.id, this.uniqueNumbers(body.workFormatIds));
      }

      if (body.desiredLocations) {
        const uniqueLocationKeys = this.uniqueLocationKeys(body.desiredLocations);
        if (uniqueLocationKeys.length > 5) {
          throw new BusinessLogicError(
            "Student can save up to 5 desired locations",
            HttpStatus.BAD_REQUEST,
            "TOO_MANY_DESIRED_LOCATIONS",
          );
        }

        const locations = await Promise.all(
          uniqueLocationKeys.map((location) => txProfiles.upsertLocation(location)),
        );
        await txProfiles.replaceDesiredLocations(
          profile.id,
          locations.map((location) => location.id),
        );
      }

      return updatedProfile;
    }));
  }

  /** Створює запис формальної освіти у резюме студента. */
  async createEducation(clerkUserId: string, body: EducationRequest) {
    const profile = await this.getOwnedProfileOrThrow(clerkUserId);
    return this.refreshAfter(profile.id, this.profiles.createEducation(profile.id, this.mapEducation(body)));
  }

  /** Оновлює запис освіти після перевірки, що він належить студенту. */
  async updateEducation(clerkUserId: string, educationId: string, body: EducationRequest) {
    const profile = await this.getOwnedProfileOrThrow(clerkUserId);
    await this.ensureEducationOwned(profile.id, educationId);
    return this.refreshAfter(profile.id, this.profiles.updateEducation(educationId, this.mapEducation(body)));
  }

  /** Видаляє запис освіти після перевірки власності. */
  async deleteEducation(clerkUserId: string, educationId: string) {
    const profile = await this.getOwnedProfileOrThrow(clerkUserId);
    await this.ensureEducationOwned(profile.id, educationId);
    return this.refreshAfter(profile.id, this.profiles.deleteEducation(educationId));
  }

  /** Створює або оновлює запис іноземної мови у резюме. */
  async upsertLanguageSkill(clerkUserId: string, body: LanguageSkillRequest) {
    const profile = await this.getOwnedProfileOrThrow(clerkUserId);
    return this.refreshAfter(profile.id, this.profiles.upsertLanguageSkill(profile.id, this.mapLanguageSkill(body)));
  }

  /** Оновлює запис мови після перевірки власності. */
  async updateLanguageSkill(
    clerkUserId: string,
    languageSkillId: string,
    body: LanguageSkillRequest,
  ) {
    const profile = await this.getOwnedProfileOrThrow(clerkUserId);
    await this.ensureLanguageSkillOwned(profile.id, languageSkillId);
    return this.refreshAfter(profile.id, this.profiles.updateLanguageSkill(languageSkillId, this.mapLanguageSkill(body)));
  }

  /** Видаляє запис мови після перевірки власності. */
  async deleteLanguageSkill(clerkUserId: string, languageSkillId: string) {
    const profile = await this.getOwnedProfileOrThrow(clerkUserId);
    await this.ensureLanguageSkillOwned(profile.id, languageSkillId);
    return this.refreshAfter(profile.id, this.profiles.deleteLanguageSkill(languageSkillId));
  }

  /** Створює курс і прив'язує до нього навички у transaction. */
  async createCourse(clerkUserId: string, body: CourseRequest) {
    const profile = await this.getOwnedProfileOrThrow(clerkUserId);
    const skillIds = this.uniqueNumbers(body.skillIds);

    return this.refreshAfter(profile.id, this.txManager.run(async (tx) => {
      const txProfiles = new StudentProfileRepository(tx);
      await this.ensureSkillsExist(skillIds, new SkillRepository(tx));
      const course = await txProfiles.createCourse(profile.id, this.mapCourse(body));
      await txProfiles.replaceCourseSkills(course.id, skillIds);
      return course;
    }));
  }

  /** Оновлює курс і повністю замінює його навички у transaction. */
  async updateCourse(clerkUserId: string, courseId: string, body: CourseRequest) {
    const profile = await this.getOwnedProfileOrThrow(clerkUserId);
    const skillIds = this.uniqueNumbers(body.skillIds);

    return this.refreshAfter(profile.id, this.txManager.run(async (tx) => {
      const txProfiles = new StudentProfileRepository(tx);
      await this.ensureCourseOwned(profile.id, courseId, txProfiles);
      await this.ensureSkillsExist(skillIds, new SkillRepository(tx));
      const course = await txProfiles.updateCourse(courseId, this.mapCourse(body));
      await txProfiles.replaceCourseSkills(courseId, skillIds);
      return course;
    }));
  }

  /** Видаляє курс після перевірки власності. */
  async deleteCourse(clerkUserId: string, courseId: string) {
    const profile = await this.getOwnedProfileOrThrow(clerkUserId);
    await this.ensureCourseOwned(profile.id, courseId);
    return this.refreshAfter(profile.id, this.profiles.deleteCourse(courseId));
  }

  /** Створює проєкт і прив'язує до нього навички у transaction. */
  async createProject(clerkUserId: string, body: ProjectRequest) {
    const profile = await this.getOwnedProfileOrThrow(clerkUserId);
    const skillIds = this.uniqueNumbers(body.skillIds);

    return this.refreshAfter(profile.id, this.txManager.run(async (tx) => {
      const txProfiles = new StudentProfileRepository(tx);
      await this.ensureSkillsExist(skillIds, new SkillRepository(tx));
      const project = await txProfiles.createProject(profile.id, this.mapProject(body));
      await txProfiles.replaceProjectSkills(project.id, skillIds);
      return project;
    }));
  }

  /** Оновлює проєкт і повністю замінює його навички у transaction. */
  async updateProject(clerkUserId: string, projectId: string, body: ProjectRequest) {
    const profile = await this.getOwnedProfileOrThrow(clerkUserId);
    const skillIds = this.uniqueNumbers(body.skillIds);

    return this.refreshAfter(profile.id, this.txManager.run(async (tx) => {
      const txProfiles = new StudentProfileRepository(tx);
      await this.ensureProjectOwned(profile.id, projectId, txProfiles);
      await this.ensureSkillsExist(skillIds, new SkillRepository(tx));
      const project = await txProfiles.updateProject(projectId, this.mapProject(body));
      await txProfiles.replaceProjectSkills(projectId, skillIds);
      return project;
    }));
  }

  /** Видаляє проєкт після перевірки власності. */
  async deleteProject(clerkUserId: string, projectId: string) {
    const profile = await this.getOwnedProfileOrThrow(clerkUserId);
    await this.ensureProjectOwned(profile.id, projectId);
    return this.refreshAfter(profile.id, this.profiles.deleteProject(projectId));
  }

  /** Створює досвід роботи і прив'язує до нього навички у transaction. */
  async createExperience(clerkUserId: string, body: ExperienceRequest) {
    const profile = await this.getOwnedProfileOrThrow(clerkUserId);
    const skillIds = this.uniqueNumbers(body.skillIds);

    return this.refreshAfter(profile.id, this.txManager.run(async (tx) => {
      const txProfiles = new StudentProfileRepository(tx);
      await this.ensureSkillsExist(skillIds, new SkillRepository(tx));
      const experience = await txProfiles.createExperience(profile.id, this.mapExperience(body));
      await txProfiles.replaceExperienceSkills(experience.id, skillIds);
      return experience;
    }));
  }

  /** Оновлює досвід роботи і повністю замінює його навички у transaction. */
  async updateExperience(clerkUserId: string, experienceId: string, body: ExperienceRequest) {
    const profile = await this.getOwnedProfileOrThrow(clerkUserId);
    const skillIds = this.uniqueNumbers(body.skillIds);

    return this.refreshAfter(profile.id, this.txManager.run(async (tx) => {
      const txProfiles = new StudentProfileRepository(tx);
      await this.ensureExperienceOwned(profile.id, experienceId, txProfiles);
      await this.ensureSkillsExist(skillIds, new SkillRepository(tx));
      const experience = await txProfiles.updateExperience(experienceId, this.mapExperience(body));
      await txProfiles.replaceExperienceSkills(experienceId, skillIds);
      return experience;
    }));
  }

  /** Видаляє досвід роботи після перевірки власності. */
  async deleteExperience(clerkUserId: string, experienceId: string) {
    const profile = await this.getOwnedProfileOrThrow(clerkUserId);
    await this.ensureExperienceOwned(profile.id, experienceId);
    return this.refreshAfter(profile.id, this.profiles.deleteExperience(experienceId));
  }

  /** Готує місце для майбутнього створення ProposedSkill зі статусом PENDING. */
  async proposeSkill() {
    // TODO: додати ProposedSkillRepository і зв'язки course/project/experience proposed skills,
    // коли погодимо UX модерації запропонованих навичок.
    throw new BusinessLogicError(
      "Skill proposal flow is not implemented yet",
      HttpStatus.BAD_REQUEST,
      "SKILL_PROPOSAL_NOT_IMPLEMENTED",
    );
  }

  /** Повертає профіль студента або кидає помилку, якщо користувач не студент/onboarding не завершено. */
  private async getOwnedProfileOrThrow(clerkUserId: string) {
    const profile = await this.profiles.findByClerkUserId(clerkUserId);

    if (!profile) {
      throw new BusinessLogicError(
        "Student profile not found for current user",
        HttpStatus.NOT_FOUND,
        "STUDENT_PROFILE_NOT_FOUND",
      );
    }

    return profile;
  }

  /** Повертає результат mutation після оновлення match snapshots усіх відгуків студента. */
  private async refreshAfter<T>(profileId: string, operation: Promise<T>) {
    const result = await operation;
    await this.matchRefresh.recalculateForStudent(profileId);
    return result;
  }

  /** Перевіряє, що всі передані skillIds існують у довіднику. */
  private async ensureSkillsExist(skillIds: number[], repository = this.skills) {
    if (skillIds.length === 0) return;

    const existingCount = await repository.countExistingSkills(skillIds);
    if (existingCount !== skillIds.length) {
      throw new BusinessLogicError(
        "One or more skills do not exist",
        HttpStatus.BAD_REQUEST,
        "SKILLS_NOT_FOUND",
      );
    }
  }

  /** Перевіряє належність запису освіти поточному студенту. */
  private async ensureEducationOwned(profileId: string, educationId: string) {
    const education = await this.profiles.findEducationById(profileId, educationId);
    if (!education) this.throwOwnershipError("Education record not found");
  }

  /** Перевіряє належність мовної навички поточному студенту. */
  private async ensureLanguageSkillOwned(profileId: string, languageSkillId: string) {
    const languageSkill = await this.profiles.findLanguageSkillById(profileId, languageSkillId);
    if (!languageSkill) this.throwOwnershipError("Language skill record not found");
  }

  /** Перевіряє належність курсу поточному студенту. */
  private async ensureCourseOwned(
    profileId: string,
    courseId: string,
    repository = this.profiles,
  ) {
    const course = await repository.findCourseById(profileId, courseId);
    if (!course) this.throwOwnershipError("Course record not found");
  }

  /** Перевіряє належність проєкту поточному студенту. */
  private async ensureProjectOwned(
    profileId: string,
    projectId: string,
    repository = this.profiles,
  ) {
    const project = await repository.findProjectById(profileId, projectId);
    if (!project) this.throwOwnershipError("Project record not found");
  }

  /** Перевіряє належність досвіду поточному студенту. */
  private async ensureExperienceOwned(
    profileId: string,
    experienceId: string,
    repository = this.profiles,
  ) {
    const experience = await repository.findExperienceById(profileId, experienceId);
    if (!experience) this.throwOwnershipError("Experience record not found");
  }

  /** Кидає однакову помилку для відсутнього або чужого дочірнього запису. */
  private throwOwnershipError(message: string): never {
    throw new BusinessLogicError(message, HttpStatus.NOT_FOUND, "PROFILE_RECORD_NOT_FOUND");
  }

  /** Перетворює body освіти на дані репозиторію. */
  private mapEducation(body: EducationRequest): EducationData {
    return {
      universityId: body.universityId ?? null,
      customUniversityName: body.customUniversityName ?? null,
      degree: this.requiredEnum(body.degree, Degree, "degree"),
      specialty: this.requiredString(body.specialty, "specialty"),
      startYear: this.requiredNumber(body.startYear, "startYear"),
      endYear: body.endYear ?? null,
      diplomaUrl: body.diplomaUrl ?? null,
    };
  }

  /** Перетворює body мови на дані репозиторію. */
  private mapLanguageSkill(body: LanguageSkillRequest): LanguageSkillData {
    return {
      languageId: this.requiredNumber(body.languageId, "languageId"),
      level: this.requiredEnum(body.level, LanguageLevel, "level"),
      certificateUrl: body.certificateUrl ?? null,
    };
  }

  /** Перетворює body курсу на дані репозиторію. */
  private mapCourse(body: CourseRequest): CourseData {
    return {
      title: this.requiredString(body.title, "title"),
      startDate: this.parseDate(body.startDate, "startDate"),
      endDate: body.endDate ? this.parseDate(body.endDate, "endDate") : null,
      certificateUrl: body.certificateUrl ?? null,
    };
  }

  /** Перетворює body проєкту на дані репозиторію. */
  private mapProject(body: ProjectRequest): ProjectData {
    return {
      title: this.requiredString(body.title, "title"),
      description: this.requiredString(body.description, "description"),
      projectUrl: body.projectUrl ?? null,
    };
  }

  /** Перетворює body досвіду на дані репозиторію. */
  private mapExperience(body: ExperienceRequest): ExperienceData {
    return {
      professionId: this.requiredNumber(body.professionId, "professionId"),
      sphereId: this.requiredNumber(body.sphereId, "sphereId"),
      companyName: this.requiredString(body.companyName, "companyName"),
      position: this.requiredString(body.position, "position"),
      startDate: this.parseDate(body.startDate, "startDate"),
      endDate: body.endDate ? this.parseDate(body.endDate, "endDate") : null,
      achievements: this.requiredString(body.achievements, "achievements"),
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

  /** Нормалізує масив чисел і прибирає дублікати. */
  private uniqueNumbers(values: number[] = []) {
    return [...new Set(values.map((value) => this.requiredNumber(value, "id")))];
  }

  /** Нормалізує бажані локації та прибирає дублікати. */
  private uniqueLocationKeys(locations: LocationKey[]) {
    const seen = new Set<string>();
    const uniqueLocations: LocationKey[] = [];

    for (const location of locations) {
      const normalizedLocation = {
        countryId: this.requiredNumber(location.countryId, "countryId"),
        regionId: location.regionId ?? null,
        cityId: location.cityId ?? null,
      };
      const key = `${normalizedLocation.countryId}:${normalizedLocation.regionId ?? ""}:${normalizedLocation.cityId ?? ""}`;

      if (!seen.has(key)) {
        seen.add(key);
        uniqueLocations.push(normalizedLocation);
      }
    }

    return uniqueLocations;
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
}

export const studentProfileService = new StudentProfileService();
