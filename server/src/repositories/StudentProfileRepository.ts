import {
  type Degree,
  type Gender,
  type LanguageLevel,
  Prisma,
  type ProfileVisibility,
} from "../../prisma/generated/client/index.js";
import { prisma } from "../config/db.js";
import type { DbClient } from "./repositoryTypes.js";

export type StudentProfileCreateData = {
  userId: string;
  birthDate: Date;
  contactEmail: string;
  primaryPhone: string;
  secondaryPhone?: string | null;
  about?: string | null;
};

export type StudentProfileBaseData = {
  birthDate?: Date;
  gender?: Gender | null;
  contactEmail?: string;
  primaryPhone?: string;
  secondaryPhone?: string | null;
  about?: string;
};

export type StudentSearchSettingsData = {
  desiredPosition?: string | null;
  minSalary?: number | null;
  isActiveSearch?: boolean;
  visibility?: ProfileVisibility;
};

export type EducationData = {
  universityId?: number | null;
  customUniversityName?: string | null;
  degree: Degree;
  specialty: string;
  startYear: number;
  endYear?: number | null;
  diplomaUrl?: string | null;
};

export type LanguageSkillData = {
  languageId: number;
  level: LanguageLevel;
  certificateUrl?: string | null;
};

export type CourseData = {
  title: string;
  startDate: Date;
  endDate?: Date | null;
  certificateUrl?: string | null;
};

export type ProjectData = {
  title: string;
  description: string;
  projectUrl?: string | null;
};

export type ExperienceData = {
  professionId: number;
  sphereId: number;
  companyName: string;
  position: string;
  startDate: Date;
  endDate?: Date | null;
  achievements: string;
};

export type LocationKey = {
  countryId: number;
  regionId?: number | null;
  cityId?: number | null;
};

const studentResumeInclude = {
  user: true,
  links: true,
  education: { include: { university: true } },
  languages: { include: { language: true } },
  courses: { include: { skills: { include: { skill: true } } } },
  projects: { include: { skills: { include: { skill: true } } } },
  experiences: {
    include: {
      profession: true,
      sphere: true,
      skills: { include: { skill: true } },
    },
  },
  desiredProfessions: { include: { profession: true } },
  employmentTypes: { include: { employmentType: true } },
  workSchedules: { include: { workSchedule: true } },
  workFormats: { include: { workFormat: true } },
  desiredLocations: { include: { location: true } },
} satisfies Prisma.StudentProfileInclude;

const hrApplicationResumeInclude = {
  ...studentResumeInclude,
  user: {
    select: {
      firstName: true,
      lastName: true,
      middleName: true,
      photoUrl: true,
      createdAt: true,
    },
  },
} satisfies Prisma.StudentProfileInclude;

export class StudentProfileRepository {
  constructor(private readonly db: DbClient = prisma) {}

  /** Створює студентський профіль після онбордингу. */
  async createProfile(data: StudentProfileCreateData) {
    return this.db.studentProfile.create({
      data: {
        userId: data.userId,
        birthDate: data.birthDate,
        contactEmail: data.contactEmail.toLowerCase(),
        primaryPhone: data.primaryPhone,
        secondaryPhone: data.secondaryPhone ?? null,
        about: data.about ?? null,
      },
    });
  }

  /** Шукає профіль студента за Clerk user id власника. */
  async findByClerkUserId(clerkUserId: string) {
    return this.db.studentProfile.findFirst({
      where: { user: { clerkUserId } },
      include: studentResumeInclude,
    });
  }

  /** Повертає повне резюме студента для авторизованого сценарію перегляду application. */
  async findResumeById(profileId: string) {
    return this.db.studentProfile.findUnique({
      where: { id: profileId },
      include: hrApplicationResumeInclude,
    });
  }

  /** Шукає профіль студента за id профілю. */
  async findById(profileId: string) {
    return this.db.studentProfile.findUnique({ where: { id: profileId } });
  }

  /** Завантажує дані профілю, які беруть участь у перевірці вимог вакансії та match preview. */
  async findForApplicationMatchById(profileId: string) {
    return this.db.studentProfile.findUnique({
      where: { id: profileId },
      include: {
        links: true,
        education: true,
        languages: { include: { language: true } },
        desiredProfessions: { include: { profession: true } },
        employmentTypes: { include: { employmentType: true } },
        workSchedules: { include: { workSchedule: true } },
        workFormats: { include: { workFormat: true } },
        desiredLocations: { include: { location: true } },
        courses: { include: { skills: { include: { skill: true } } } },
        projects: { include: { skills: { include: { skill: true } } } },
        experiences: {
          include: {
            skills: { include: { skill: true } },
          },
        },
      },
    });
  }

  /** Оновлює базові контактні та анкетні дані профілю. */
  async updateBaseData(profileId: string, data: StudentProfileBaseData) {
    return this.db.studentProfile.update({
      where: { id: profileId },
      data: {
        birthDate: data.birthDate,
        gender: data.gender,
        contactEmail: data.contactEmail?.toLowerCase(),
        primaryPhone: data.primaryPhone,
        secondaryPhone: data.secondaryPhone,
        about: data.about,
      },
    });
  }

  /** Оновлює налаштування пошуку роботи та видимості профілю. */
  async updateSearchSettings(profileId: string, data: StudentSearchSettingsData) {
    return this.db.studentProfile.update({
      where: { id: profileId },
      data,
    });
  }

  /** Замінює набір бажаних професій студента. */
  async replaceDesiredProfessions(profileId: string, professionIds: number[]) {
    await this.db.studentDesiredProfession.deleteMany({ where: { profileId } });
    if (professionIds.length === 0) return;

    await this.db.studentDesiredProfession.createMany({
      data: professionIds.map((professionId) => ({ profileId, professionId })),
      skipDuplicates: true,
    });
  }

  /** Замінює набір бажаних типів зайнятості студента. */
  async replaceEmploymentTypes(profileId: string, employmentTypeIds: number[]) {
    await this.db.studentEmploymentType.deleteMany({ where: { profileId } });
    if (employmentTypeIds.length === 0) return;

    await this.db.studentEmploymentType.createMany({
      data: employmentTypeIds.map((employmentTypeId) => ({
        profileId,
        employmentTypeId,
      })),
      skipDuplicates: true,
    });
  }

  /** Замінює набір бажаних графіків роботи студента. */
  async replaceWorkSchedules(profileId: string, workScheduleIds: number[]) {
    await this.db.studentWorkSchedule.deleteMany({ where: { profileId } });
    if (workScheduleIds.length === 0) return;

    await this.db.studentWorkSchedule.createMany({
      data: workScheduleIds.map((workScheduleId) => ({ profileId, workScheduleId })),
      skipDuplicates: true,
    });
  }

  /** Замінює набір бажаних форматів роботи студента. */
  async replaceWorkFormats(profileId: string, workFormatIds: number[]) {
    await this.db.studentWorkFormat.deleteMany({ where: { profileId } });
    if (workFormatIds.length === 0) return;

    await this.db.studentWorkFormat.createMany({
      data: workFormatIds.map((workFormatId) => ({ profileId, workFormatId })),
      skipDuplicates: true,
    });
  }

  /** Створює або знаходить нормалізовану локацію. */
  async upsertLocation(data: LocationKey) {
    const existingLocation = await this.db.location.findFirst({
      where: {
        countryId: data.countryId,
        regionId: data.regionId ?? null,
        cityId: data.cityId ?? null,
      },
    });

    if (existingLocation) return existingLocation;

    return this.db.location.create({
      data: {
        countryId: data.countryId,
        regionId: data.regionId ?? null,
        cityId: data.cityId ?? null,
      },
    });
  }

  /** Замінює бажані локації студента. */
  async replaceDesiredLocations(profileId: string, locationIds: string[]) {
    await this.db.studentDesiredLocation.deleteMany({ where: { profileId } });
    if (locationIds.length === 0) return;

    await this.db.studentDesiredLocation.createMany({
      data: locationIds.map((locationId) => ({ profileId, locationId })),
      skipDuplicates: true,
    });
  }

  /** Замінює посилання/соцмережі студентського профілю. */
  async replaceLinks(profileId: string, links: Prisma.LinkCreateManyInput[]) {
    await this.db.link.deleteMany({ where: { studentProfileId: profileId } });
    if (links.length === 0) return;

    await this.db.link.createMany({
      data: links.map((link) => ({ ...link, studentProfileId: profileId })),
    });
  }

  /** Створює запис формальної освіти. */
  async createEducation(profileId: string, data: EducationData) {
    return this.db.education.create({ data: { ...data, studentProfileId: profileId } });
  }

  /** Шукає запис освіти студента для перевірки власності. */
  async findEducationById(profileId: string, educationId: string) {
    return this.db.education.findFirst({ where: { id: educationId, studentProfileId: profileId } });
  }

  /** Оновлює запис формальної освіти. */
  async updateEducation(educationId: string, data: EducationData) {
    return this.db.education.update({ where: { id: educationId }, data });
  }

  /** Видаляє запис формальної освіти. */
  async deleteEducation(educationId: string) {
    return this.db.education.delete({ where: { id: educationId } });
  }

  /** Створює або оновлює запис володіння мовою. */
  async upsertLanguageSkill(profileId: string, data: LanguageSkillData) {
    return this.db.languageSkill.upsert({
      where: {
        studentProfileId_languageId: {
          studentProfileId: profileId,
          languageId: data.languageId,
        },
      },
      create: { ...data, studentProfileId: profileId },
      update: { level: data.level, certificateUrl: data.certificateUrl ?? null },
    });
  }

  /** Шукає мовну навичку студента для перевірки власності. */
  async findLanguageSkillById(profileId: string, languageSkillId: string) {
    return this.db.languageSkill.findFirst({
      where: { id: languageSkillId, studentProfileId: profileId },
    });
  }

  /** Оновлює запис володіння мовою. */
  async updateLanguageSkill(languageSkillId: string, data: LanguageSkillData) {
    return this.db.languageSkill.update({ where: { id: languageSkillId }, data });
  }

  /** Видаляє запис володіння мовою. */
  async deleteLanguageSkill(languageSkillId: string) {
    return this.db.languageSkill.delete({ where: { id: languageSkillId } });
  }

  /** Створює курс без прив'язок до навичок. */
  async createCourse(profileId: string, data: CourseData) {
    return this.db.course.create({ data: { ...data, studentProfileId: profileId } });
  }

  /** Шукає курс студента для перевірки власності. */
  async findCourseById(profileId: string, courseId: string) {
    return this.db.course.findFirst({ where: { id: courseId, studentProfileId: profileId } });
  }

  /** Оновлює курс без зміни навичок. */
  async updateCourse(courseId: string, data: CourseData) {
    return this.db.course.update({ where: { id: courseId }, data });
  }

  /** Видаляє курс студента. */
  async deleteCourse(courseId: string) {
    return this.db.course.delete({ where: { id: courseId } });
  }

  /** Повністю замінює навички, пов'язані з курсом. */
  async replaceCourseSkills(courseId: string, skillIds: number[]) {
    await this.db.courseSkill.deleteMany({ where: { courseId } });
    if (skillIds.length === 0) return;

    await this.db.courseSkill.createMany({
      data: skillIds.map((skillId) => ({ courseId, skillId })),
      skipDuplicates: true,
    });
  }

  /** Створює проєкт без прив'язок до навичок. */
  async createProject(profileId: string, data: ProjectData) {
    return this.db.project.create({ data: { ...data, studentProfileId: profileId } });
  }

  /** Шукає проєкт студента для перевірки власності. */
  async findProjectById(profileId: string, projectId: string) {
    return this.db.project.findFirst({ where: { id: projectId, studentProfileId: profileId } });
  }

  /** Оновлює проєкт без зміни навичок. */
  async updateProject(projectId: string, data: ProjectData) {
    return this.db.project.update({ where: { id: projectId }, data });
  }

  /** Видаляє проєкт студента. */
  async deleteProject(projectId: string) {
    return this.db.project.delete({ where: { id: projectId } });
  }

  /** Повністю замінює навички, пов'язані з проєктом. */
  async replaceProjectSkills(projectId: string, skillIds: number[]) {
    await this.db.projectSkill.deleteMany({ where: { projectId } });
    if (skillIds.length === 0) return;

    await this.db.projectSkill.createMany({
      data: skillIds.map((skillId) => ({ projectId, skillId })),
      skipDuplicates: true,
    });
  }

  /** Створює запис досвіду без прив'язок до навичок. */
  async createExperience(profileId: string, data: ExperienceData) {
    return this.db.experience.create({ data: { ...data, studentProfileId: profileId } });
  }

  /** Шукає досвід студента для перевірки власності. */
  async findExperienceById(profileId: string, experienceId: string) {
    return this.db.experience.findFirst({
      where: { id: experienceId, studentProfileId: profileId },
    });
  }

  /** Оновлює досвід без зміни навичок. */
  async updateExperience(experienceId: string, data: ExperienceData) {
    return this.db.experience.update({ where: { id: experienceId }, data });
  }

  /** Видаляє запис досвіду студента. */
  async deleteExperience(experienceId: string) {
    return this.db.experience.delete({ where: { id: experienceId } });
  }

  /** Повністю замінює навички, пов'язані з досвідом. */
  async replaceExperienceSkills(experienceId: string, skillIds: number[]) {
    await this.db.experienceSkill.deleteMany({ where: { experienceId } });
    if (skillIds.length === 0) return;

    await this.db.experienceSkill.createMany({
      data: skillIds.map((skillId) => ({ experienceId, skillId })),
      skipDuplicates: true,
    });
  }
}

export const studentProfileRepository = new StudentProfileRepository();
