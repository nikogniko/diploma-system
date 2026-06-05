// Run from the repository root:
// cd server
// npx tsx prisma/importDemoStudents.ts

import "dotenv/config";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  Degree,
  Gender,
  LanguageLevel,
  LinkType,
  Prisma,
  PrismaClient,
  ProfileVisibility,
  UserRole,
  UserStatus,
} from "./generated/client/index.js";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { StudentProfileRepository } from "../src/repositories/StudentProfileRepository.js";
import { UserRepository } from "../src/repositories/UserRepository.js";
import type { DbClient } from "../src/repositories/repositoryTypes.js";
import { EmailValidator } from "../src/utils/EmailValidator.js";

type DemoData = {
  students?: DemoStudent[];
};

type DemoStudent = {
  auth: {
    clerkUserId: string;
    email: string;
  };
  user: {
    firstName: string;
    lastName: string;
    middleName?: string | null;
    photoUrl?: string | null;
  };
  profile: {
    gender?: string | null;
    birthDate: string;
    about?: string | null;
    contactEmail: string;
    primaryPhone: string;
    secondaryPhone?: string | null;
    desiredPosition?: string | null;
    minSalary?: number | null;
    isActiveSearch?: boolean;
    visibility?: string;
    desiredProfessions?: string[];
    employmentTypes?: string[];
    workSchedules?: string[];
    workFormats?: string[];
    desiredLocations?: DemoLocation[];
  };
  links?: DemoLink[];
  education?: DemoEducation[];
  languages?: DemoLanguage[];
  courses?: DemoCourse[];
  projects?: DemoProject[];
  experiences?: DemoExperience[];
};

type DemoLink = {
  linkType: string;
  linkName: string;
  value: string;
};

type DemoEducation = {
  university: string;
  degree: string;
  specialty: string;
  startYear: number;
  endYear?: number | null;
  diplomaUrl?: string | null;
};

type DemoLanguage = {
  language: string;
  level: string;
  certificateUrl?: string | null;
};

type DemoCourse = {
  title: string;
  startDate: string;
  endDate?: string | null;
  certificateUrl?: string | null;
  skills?: string[];
};

type DemoProject = {
  title: string;
  description: string;
  projectUrl?: string | null;
  skills?: string[];
};

type DemoExperience = {
  companyName: string;
  position: string;
  profession: string;
  sphere: string;
  startDate: string;
  endDate?: string | null;
  achievements: string;
  skills?: string[];
};

type DemoLocation = {
  country: string;
  region?: string | null;
  city?: string | null;
};

type DictionaryLookups = Awaited<ReturnType<typeof loadDictionaryLookups>>;

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const defaultInputPath = path.join(scriptDir, "demo-student-profiles-for-nextwave-vacancy.json");

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL is not configured");
  }

  const pool = new Pool({ connectionString });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  return { prisma, pool };
}

async function loadDemoStudents(inputPath: string) {
  const raw = await readFile(inputPath, "utf8");
  const data = JSON.parse(raw) as DemoData;

  if (!Array.isArray(data.students)) {
    throw new Error(`Expected "students" array in ${inputPath}`);
  }

  return data.students;
}

async function loadDictionaryLookups(db: DbClient) {
  const [
    skills,
    professions,
    spheres,
    universities,
    languages,
    employmentTypes,
    workSchedules,
    workFormats,
    countries,
    regions,
    cities,
    locations,
  ] = await Promise.all([
    db.skill.findMany(),
    db.profession.findMany(),
    db.sphere.findMany(),
    db.university.findMany(),
    db.language.findMany(),
    db.employmentType.findMany(),
    db.workSchedule.findMany(),
    db.workFormat.findMany(),
    db.country.findMany(),
    db.region.findMany(),
    db.city.findMany(),
    db.location.findMany(),
  ]);

  return {
    skillsByName: toNameMap(skills, "skill"),
    professionsByName: toNameMap(professions, "profession"),
    spheresByName: toNameMap(spheres, "sphere"),
    universitiesByName: toNameMap(universities, "university"),
    languagesByName: toNameMap(languages, "language"),
    employmentTypesByName: toNameMap(employmentTypes, "employment type"),
    workSchedulesByName: toNameMap(workSchedules, "work schedule"),
    workFormatsByName: toNameMap(workFormats, "work format"),
    countriesByName: toNameMap(countries, "country"),
    regionsByCountryAndName: new Map(regions.map((region) => [locationPartKey(region.countryId, region.name), region])),
    citiesByRegionAndName: new Map(cities.map((city) => [locationPartKey(city.regionId, city.name), city])),
    locationsByKey: new Map(locations.map((location) => [locationKey(location.countryId, location.regionId, location.cityId), location])),
  };
}

function toNameMap<T extends { name: string }>(items: T[], label: string) {
  const map = new Map<string, T>();

  for (const item of items) {
    const key = normalizeName(item.name);
    if (map.has(key)) {
      throw new Error(`Duplicate ${label} dictionary value found: ${item.name}`);
    }
    map.set(key, item);
  }

  return map;
}

async function importStudent(db: DbClient, student: DemoStudent, lookups: DictionaryLookups) {
  const users = new UserRepository(db);
  const profiles = new StudentProfileRepository(db);
  const email = EmailValidator.normalizeEmail(requiredString(student.auth.email, "auth.email"));
  const clerkUserId = requiredString(student.auth.clerkUserId, "auth.clerkUserId");

  const user = await upsertStudentUser(db, users, student, clerkUserId, email);
  let profile = user.studentProfile;

  if (!profile) {
    profile = await profiles.createProfile({
      userId: user.id,
      birthDate: parseDate(student.profile.birthDate, "profile.birthDate"),
      contactEmail: EmailValidator.normalizeEmail(requiredString(student.profile.contactEmail, "profile.contactEmail")),
      primaryPhone: requiredString(student.profile.primaryPhone, "profile.primaryPhone"),
      secondaryPhone: student.profile.secondaryPhone ?? null,
      about: student.profile.about ?? null,
    });
  }

  await clearStudentChildren(db, profile.id);

  await profiles.updateBaseData(profile.id, {
    birthDate: parseDate(student.profile.birthDate, "profile.birthDate"),
    gender: optionalEnum(student.profile.gender, Gender, "profile.gender"),
    contactEmail: EmailValidator.normalizeEmail(requiredString(student.profile.contactEmail, "profile.contactEmail")),
    primaryPhone: requiredString(student.profile.primaryPhone, "profile.primaryPhone"),
    secondaryPhone: student.profile.secondaryPhone ?? null,
    about: student.profile.about ?? "",
  });

  await profiles.updateSearchSettings(profile.id, {
    desiredPosition: student.profile.desiredPosition ?? null,
    minSalary: student.profile.minSalary ?? null,
    isActiveSearch: student.profile.isActiveSearch ?? true,
    visibility: optionalEnum(student.profile.visibility, ProfileVisibility, "profile.visibility") ?? ProfileVisibility.PUBLIC,
  });

  await profiles.replaceLinks(profile.id, mapLinks(student.links ?? []));
  await profiles.replaceDesiredProfessions(profile.id, uniqueIds(resolveAll(student.profile.desiredProfessions ?? [], lookups.professionsByName, "desired profession").map((item) => item.id)));
  await profiles.replaceEmploymentTypes(profile.id, uniqueIds(resolveAll(student.profile.employmentTypes ?? [], lookups.employmentTypesByName, "employment type").map((item) => item.id)));
  await profiles.replaceWorkSchedules(profile.id, uniqueIds(resolveAll(student.profile.workSchedules ?? [], lookups.workSchedulesByName, "work schedule").map((item) => item.id)));
  await profiles.replaceWorkFormats(profile.id, uniqueIds(resolveAll(student.profile.workFormats ?? [], lookups.workFormatsByName, "work format").map((item) => item.id)));
  await profiles.replaceDesiredLocations(profile.id, uniqueStrings(resolveLocations(student.profile.desiredLocations ?? [], lookups).map((location) => location.id)));

  for (const education of student.education ?? []) {
    await profiles.createEducation(profile.id, {
      universityId: resolveByName(education.university, lookups.universitiesByName, "university").id,
      customUniversityName: null,
      degree: requiredEnum(education.degree, Degree, "education.degree"),
      specialty: requiredString(education.specialty, "education.specialty"),
      startYear: requiredNumber(education.startYear, "education.startYear"),
      endYear: education.endYear ?? null,
      diplomaUrl: education.diplomaUrl ?? null,
    });
  }

  for (const language of student.languages ?? []) {
    await profiles.upsertLanguageSkill(profile.id, {
      languageId: resolveByName(language.language, lookups.languagesByName, "language").id,
      level: requiredEnum(language.level, LanguageLevel, "language.level"),
      certificateUrl: language.certificateUrl ?? null,
    });
  }

  for (const courseData of student.courses ?? []) {
    const course = await profiles.createCourse(profile.id, {
      title: requiredString(courseData.title, "course.title"),
      startDate: parseDate(courseData.startDate, "course.startDate"),
      endDate: courseData.endDate ? parseDate(courseData.endDate, "course.endDate") : null,
      certificateUrl: courseData.certificateUrl ?? null,
    });
    await profiles.replaceCourseSkills(course.id, resolveSkillIds(courseData.skills ?? [], lookups));
  }

  for (const projectData of student.projects ?? []) {
    const project = await profiles.createProject(profile.id, {
      title: requiredString(projectData.title, "project.title"),
      description: requiredString(projectData.description, "project.description"),
      projectUrl: projectData.projectUrl ?? null,
    });
    await profiles.replaceProjectSkills(project.id, resolveSkillIds(projectData.skills ?? [], lookups));
  }

  for (const experienceData of student.experiences ?? []) {
    const experience = await profiles.createExperience(profile.id, {
      professionId: resolveByName(experienceData.profession, lookups.professionsByName, "experience profession").id,
      sphereId: resolveByName(experienceData.sphere, lookups.spheresByName, "experience sphere").id,
      companyName: requiredString(experienceData.companyName, "experience.companyName"),
      position: requiredString(experienceData.position, "experience.position"),
      startDate: parseDate(experienceData.startDate, "experience.startDate"),
      endDate: experienceData.endDate ? parseDate(experienceData.endDate, "experience.endDate") : null,
      achievements: requiredString(experienceData.achievements, "experience.achievements"),
    });
    await profiles.replaceExperienceSkills(experience.id, resolveSkillIds(experienceData.skills ?? [], lookups));
  }

  return { clerkUserId, email, profileId: profile.id };
}

async function upsertStudentUser(
  db: DbClient,
  users: UserRepository,
  student: DemoStudent,
  clerkUserId: string,
  email: string,
) {
  const existingByClerk = await users.findUserByClerkId(clerkUserId);
  const existingByEmail = existingByClerk ? null : await users.findUserByEmail(email);
  const existingUser = existingByClerk ?? existingByEmail;

  if (existingUser) {
    return db.user.update({
      where: { id: existingUser.id },
      include: { studentProfile: true, hrProfile: true },
      data: {
        clerkUserId,
        email,
        role: UserRole.STUDENT,
        status: UserStatus.ACTIVE,
        firstName: requiredString(student.user.firstName, "user.firstName"),
        lastName: requiredString(student.user.lastName, "user.lastName"),
        middleName: student.user.middleName ?? null,
        photoUrl: student.user.photoUrl ?? null,
      },
    });
  }

  const createdUser = await users.upsertBaseUser({
    clerkUserId,
    email,
    role: UserRole.STUDENT,
    status: UserStatus.ACTIVE,
    firstName: student.user.firstName,
    lastName: student.user.lastName,
    middleName: student.user.middleName ?? null,
    photoUrl: student.user.photoUrl ?? null,
  });

  const hydratedUser = await users.findUserById(createdUser.id);
  if (!hydratedUser) {
    throw new Error(`Failed to load created user ${createdUser.id}`);
  }

  return hydratedUser;
}

async function clearStudentChildren(db: DbClient, profileId: string) {
  await Promise.all([
    db.education.deleteMany({ where: { studentProfileId: profileId } }),
    db.languageSkill.deleteMany({ where: { studentProfileId: profileId } }),
    db.course.deleteMany({ where: { studentProfileId: profileId } }),
    db.project.deleteMany({ where: { studentProfileId: profileId } }),
    db.experience.deleteMany({ where: { studentProfileId: profileId } }),
    db.link.deleteMany({ where: { studentProfileId: profileId } }),
    db.studentDesiredProfession.deleteMany({ where: { profileId } }),
    db.studentEmploymentType.deleteMany({ where: { profileId } }),
    db.studentWorkSchedule.deleteMany({ where: { profileId } }),
    db.studentWorkFormat.deleteMany({ where: { profileId } }),
    db.studentDesiredLocation.deleteMany({ where: { profileId } }),
  ]);
}

function mapLinks(links: DemoLink[]): Prisma.LinkCreateManyInput[] {
  return links.map((link) => ({
    linkType: requiredEnum(link.linkType, LinkType, "link.linkType"),
    linkName: requiredString(link.linkName, "link.linkName"),
    value: requiredString(link.value, "link.value"),
  }));
}

function resolveLocations(locations: DemoLocation[], lookups: DictionaryLookups) {
  return locations.map((location) => {
    const country = resolveByName(location.country, lookups.countriesByName, "country");
    const region = location.region
      ? resolveByKey(locationPartKey(country.id, location.region), lookups.regionsByCountryAndName, `region "${location.region}" in country "${location.country}"`)
      : null;
    const city = location.city
      ? resolveByKey(locationPartKey(region?.id ?? 0, location.city), lookups.citiesByRegionAndName, `city "${location.city}" in region "${location.region}"`)
      : null;
    const existingLocation = resolveByKey(
      locationKey(country.id, region?.id ?? null, city?.id ?? null),
      lookups.locationsByKey,
      `location ${location.country}${location.region ? ` / ${location.region}` : ""}${location.city ? ` / ${location.city}` : ""}`,
    );

    return existingLocation;
  });
}

function resolveSkillIds(skillNames: string[], lookups: DictionaryLookups) {
  return uniqueIds(resolveAll(skillNames, lookups.skillsByName, "skill").map((skill) => skill.id));
}

function resolveAll<T>(names: string[], map: Map<string, T>, label: string) {
  return names.map((name) => resolveByName(name, map, label));
}

function resolveByName<T>(name: string, map: Map<string, T>, label: string) {
  return resolveByKey(normalizeName(name), map, `${label} "${name}"`);
}

function resolveByKey<T>(key: string, map: Map<string, T>, label: string) {
  const item = map.get(key);
  if (!item) {
    throw new Error(`Dictionary value not found: ${label}`);
  }
  return item;
}

function uniqueIds(values: number[]) {
  return [...new Set(values)];
}

function uniqueStrings(values: string[]) {
  return [...new Set(values)];
}

function normalizeName(value: string) {
  return requiredString(value, "dictionary value").trim().toLowerCase();
}

function locationPartKey(parentId: number, name: string) {
  return `${parentId}:${normalizeName(name)}`;
}

function locationKey(countryId: number, regionId?: number | null, cityId?: number | null) {
  return `${countryId}:${regionId ?? ""}:${cityId ?? ""}`;
}

function requiredString(value: unknown, fieldName: string) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${fieldName} is required`);
  }
  return value.trim();
}

function requiredNumber(value: unknown, fieldName: string) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    throw new Error(`${fieldName} must be a valid number`);
  }
  return value;
}

function requiredEnum<T extends Record<string, string>>(value: unknown, enumObject: T, fieldName: string) {
  if (typeof value !== "string" || !Object.values(enumObject).includes(value)) {
    throw new Error(`${fieldName} has invalid value: ${String(value)}`);
  }
  return value as T[keyof T];
}

function optionalEnum<T extends Record<string, string>>(value: unknown, enumObject: T, fieldName: string) {
  if (value === undefined || value === null) return null;
  return requiredEnum(value, enumObject, fieldName);
}

function parseDate(value: string, fieldName: string) {
  const date = new Date(requiredString(value, fieldName));

  if (Number.isNaN(date.getTime())) {
    throw new Error(`${fieldName} must be a valid date`);
  }

  return date;
}

async function main() {
  const inputPath = process.argv[2] ? path.resolve(process.cwd(), process.argv[2]) : defaultInputPath;
  const students = await loadDemoStudents(inputPath);
  const { prisma, pool } = createPrismaClient();

  try {
    const imported = [];

    for (const student of students) {
      const result = await prisma.$transaction(async (tx) => {
        const lookups = await loadDictionaryLookups(tx);
        return importStudent(tx, student, lookups);
      });
      imported.push(result);
      console.log(`Imported student profile: ${result.email} (${result.profileId})`);
    }

    console.log(`Demo student import complete. Imported ${imported.length} students from ${inputPath}.`);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((error) => {
  console.error("Demo student import failed:", error);
  process.exit(1);
});
