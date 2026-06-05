// Run from the server directory: npm run backup

import "dotenv/config";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { PrismaClient } from "./generated/client/index.js";
import type { City, Country, Location, Region } from "./generated/client/index.js";

type BackupOptions = {
  outDir: string;
  timestamp: string;
  prefix: string;
  candidatesFile: string;
  employersFile: string;
  applicationsFile: string;
  pretty: boolean;
};

const scriptDir = path.dirname(fileURLToPath(import.meta.url));

function buildTimestamp(date = new Date()) {
  return date.toISOString().replace(/[:.]/g, "-");
}

function parseArgs(args: string[]): BackupOptions {
  const timestamp = buildTimestamp();
  const options: BackupOptions = {
    outDir: path.join(scriptDir, "backups"),
    timestamp,
    prefix: "diploma-system",
    candidatesFile: `diploma-system-candidates-backup-${timestamp}.json`,
    employersFile: `diploma-system-employers-backup-${timestamp}.json`,
    applicationsFile: `diploma-system-applications-backup-${timestamp}.json`,
    pretty: true,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    const next = args[index + 1];

    if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    }

    if (arg === "--no-pretty") {
      options.pretty = false;
      continue;
    }

    if (!next) {
      throw new Error(`Missing value for ${arg}`);
    }

    switch (arg) {
      case "--out-dir":
        options.outDir = path.resolve(process.cwd(), next);
        index += 1;
        break;
      case "--timestamp":
        options.timestamp = next;
        options.candidatesFile = `${options.prefix}-candidates-backup-${next}.json`;
        options.employersFile = `${options.prefix}-employers-backup-${next}.json`;
        options.applicationsFile = `${options.prefix}-applications-backup-${next}.json`;
        index += 1;
        break;
      case "--prefix":
        options.prefix = next;
        options.candidatesFile = `${next}-candidates-backup-${options.timestamp}.json`;
        options.employersFile = `${next}-employers-backup-${options.timestamp}.json`;
        options.applicationsFile = `${next}-applications-backup-${options.timestamp}.json`;
        index += 1;
        break;
      case "--candidates-file":
        options.candidatesFile = next;
        index += 1;
        break;
      case "--employers-file":
        options.employersFile = next;
        index += 1;
        break;
      case "--applications-file":
        options.applicationsFile = next;
        index += 1;
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return options;
}

function printHelp() {
  console.log(`
Usage:
  npm run backup
  npm run backup -- --prefix before-demo

Options:
  --out-dir <path>          Directory for generated backup files. Defaults to prisma/backups.
  --prefix <value>          Informative prefix for generated file names. Defaults to diploma-system.
  --timestamp <value>       Suffix used in generated file names.
  --candidates-file <name>  Custom candidates backup file name.
  --employers-file <name>   Custom employers backup file name.
  --applications-file <name> Custom applications backup file name.
  --no-pretty              Write compact JSON.
`);
}

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

async function getLocationLookup(prisma: PrismaClient) {
  const [countries, regions, cities] = await Promise.all([
    prisma.country.findMany(),
    prisma.region.findMany(),
    prisma.city.findMany(),
  ]);

  return {
    countries: new Map(countries.map((country) => [country.id, country])),
    regions: new Map(regions.map((region) => [region.id, region])),
    cities: new Map(cities.map((city) => [city.id, city])),
  };
}

function enrichLocation(
  location: Location,
  lookup: {
    countries: Map<number, Country>;
    regions: Map<number, Region>;
    cities: Map<number, City>;
  },
) {
  return {
    ...location,
    country: lookup.countries.get(location.countryId) ?? null,
    region: location.regionId ? normalizeRegion(lookup.regions.get(location.regionId) ?? null) : null,
    city: location.cityId ? normalizeCity(lookup.cities.get(location.cityId) ?? null) : null,
  };
}

function omit<T extends Record<string, unknown>, K extends keyof T>(value: T, keys: K[]) {
  const copy = { ...value };

  for (const key of keys) {
    delete copy[key];
  }

  return copy as Omit<T, K>;
}

function normalizeLink<T extends Record<string, unknown>>(link: T) {
  return omit(link, ["studentProfileId", "companyId", "hrProfileId"] as (keyof T)[]);
}

function normalizeLocation(location: ReturnType<typeof enrichLocation>) {
  return omit(location, ["countryId", "regionId", "cityId"]);
}

function normalizeRegion(region: Region | null) {
  return region ? omit(region, ["countryId"]) : null;
}

function normalizeCity(city: City | null) {
  return city ? omit(city, ["regionId"]) : null;
}

function normalizeDictionaryJoin<T extends Record<string, unknown>>(
  join: T,
  parentKeys: (keyof T)[],
  relatedIdKeys: (keyof T)[],
) {
  return omit(join, [...parentKeys, ...relatedIdKeys]);
}

function normalizeSkillJoin<T extends Record<string, unknown>>(join: T, parentKey: keyof T) {
  return normalizeDictionaryJoin(join, [parentKey], ["skillId" as keyof T]);
}

function normalizeProposedSkillJoin<T extends Record<string, unknown>>(join: T, parentKey: keyof T) {
  return normalizeDictionaryJoin(join, [parentKey], ["proposedSkillId" as keyof T]);
}

async function getCandidates(prisma: PrismaClient) {
  const locationLookup = await getLocationLookup(prisma);
  const candidates = await prisma.studentProfile.findMany({
    orderBy: { createdAt: "asc" },
    include: {
      user: true,
      links: true,
      education: {
        orderBy: { startYear: "desc" },
        include: { university: true },
      },
      languages: {
        include: { language: true },
      },
      experiences: {
        orderBy: { startDate: "desc" },
        include: {
          profession: true,
          sphere: true,
          skills: { include: { skill: true } },
          experienceProposedSkills: { include: { proposedSkill: true } },
        },
      },
      projects: {
        include: {
          skills: { include: { skill: true } },
          projectProposedSkills: { include: { proposedSkill: true } },
        },
      },
      courses: {
        orderBy: { startDate: "desc" },
        include: {
          skills: { include: { skill: true } },
          courseProposedSkills: { include: { proposedSkill: true } },
        },
      },
      desiredProfessions: { include: { profession: true } },
      employmentTypes: { include: { employmentType: true } },
      workSchedules: { include: { workSchedule: true } },
      workFormats: { include: { workFormat: true } },
      desiredLocations: {
        include: {
          location: true,
        },
      },
      applications: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          vacancyId: true,
          status: true,
          matchScore: true,
          createdAt: true,
          updatedAt: true,
        },
      },
    },
  });

  return candidates.map((candidate) => ({
    ...omit(candidate, ["userId"] as (keyof typeof candidate)[]),
    links: candidate.links.map(normalizeLink),
    education: candidate.education.map((education) =>
      omit(education, ["studentProfileId", "universityId"] as (keyof typeof education)[]),
    ),
    languages: candidate.languages.map((language) =>
      normalizeDictionaryJoin(language, ["studentProfileId"], ["languageId"]),
    ),
    experiences: candidate.experiences.map((experience) => ({
      ...omit(experience, ["studentProfileId", "professionId", "sphereId"] as (keyof typeof experience)[]),
      skills: experience.skills.map((skill) => normalizeSkillJoin(skill, "experienceId")),
      experienceProposedSkills: experience.experienceProposedSkills.map((proposedSkill) =>
        normalizeProposedSkillJoin(proposedSkill, "experienceId"),
      ),
    })),
    projects: candidate.projects.map((project) => ({
      ...omit(project, ["studentProfileId"] as (keyof typeof project)[]),
      skills: project.skills.map((skill) => normalizeSkillJoin(skill, "projectId")),
      projectProposedSkills: project.projectProposedSkills.map((proposedSkill) =>
        normalizeProposedSkillJoin(proposedSkill, "projectId"),
      ),
    })),
    courses: candidate.courses.map((course) => ({
      ...omit(course, ["studentProfileId"] as (keyof typeof course)[]),
      skills: course.skills.map((skill) => normalizeSkillJoin(skill, "courseId")),
      courseProposedSkills: course.courseProposedSkills.map((proposedSkill) =>
        normalizeProposedSkillJoin(proposedSkill, "courseId"),
      ),
    })),
    desiredProfessions: candidate.desiredProfessions.map((profession) =>
      normalizeDictionaryJoin(profession, ["profileId"], ["professionId"]),
    ),
    employmentTypes: candidate.employmentTypes.map((employmentType) =>
      normalizeDictionaryJoin(employmentType, ["profileId"], ["employmentTypeId"]),
    ),
    workSchedules: candidate.workSchedules.map((workSchedule) =>
      normalizeDictionaryJoin(workSchedule, ["profileId"], ["workScheduleId"]),
    ),
    workFormats: candidate.workFormats.map((workFormat) =>
      normalizeDictionaryJoin(workFormat, ["profileId"], ["workFormatId"]),
    ),
    desiredLocations: candidate.desiredLocations.map((desiredLocation) => ({
      ...omit(desiredLocation, ["profileId", "locationId"] as (keyof typeof desiredLocation)[]),
      location: normalizeLocation(enrichLocation(desiredLocation.location, locationLookup)),
    })),
    appliedVacancyIds: candidate.applications.map((application) => application.vacancyId),
  }));
}

async function getEmployers(prisma: PrismaClient) {
  const locationLookup = await getLocationLookup(prisma);
  const employers = await prisma.company.findMany({
    orderBy: { createdAt: "asc" },
    include: {
      links: true,
      spheres: { include: { sphere: true } },
      locations: {
        include: {
          location: true,
        },
      },
      hrProfiles: {
        include: {
          user: true,
          links: true,
        },
      },
      vacancies: {
        orderBy: { createdAt: "desc" },
        include: {
          profession: true,
          spheres: { include: { sphere: true } },
          employmentTypes: { include: { employmentType: true } },
          workSchedules: { include: { workSchedule: true } },
          workFormats: { include: { workFormat: true } },
          locations: {
            include: {
              location: true,
            },
          },
          skills: { include: { skill: true } },
          languages: { include: { language: true } },
          vacancyProposedSkills: { include: { proposedSkill: true } },
          applications: {
            orderBy: { createdAt: "desc" },
            select: {
              id: true,
              vacancyId: true,
              studentProfileId: true,
              status: true,
              matchScore: true,
            },
          },
        },
      },
    },
  });

  return employers.map((employer) => ({
    ...employer,
    links: employer.links.map(normalizeLink),
    spheres: employer.spheres.map((sphere) => normalizeDictionaryJoin(sphere, ["companyId"], ["sphereId"])),
    locations: employer.locations.map((companyLocation) => ({
      ...omit(companyLocation, ["companyId", "locationId"] as (keyof typeof companyLocation)[]),
      location: normalizeLocation(enrichLocation(companyLocation.location, locationLookup)),
    })),
    hrProfiles: employer.hrProfiles.map((hrProfile) => ({
      ...omit(hrProfile, ["companyId", "userId"] as (keyof typeof hrProfile)[]),
      links: hrProfile.links.map(normalizeLink),
    })),
    vacancies: employer.vacancies.map((vacancy) => ({
      ...omit(vacancy, ["companyId", "hrProfileId", "professionId"] as (keyof typeof vacancy)[]),
      spheres: vacancy.spheres.map((sphere) => normalizeDictionaryJoin(sphere, ["vacancyId"], ["sphereId"])),
      employmentTypes: vacancy.employmentTypes.map((employmentType) =>
        normalizeDictionaryJoin(employmentType, ["vacancyId"], ["employmentTypeId"]),
      ),
      workSchedules: vacancy.workSchedules.map((workSchedule) =>
        normalizeDictionaryJoin(workSchedule, ["vacancyId"], ["workScheduleId"]),
      ),
      workFormats: vacancy.workFormats.map((workFormat) =>
        normalizeDictionaryJoin(workFormat, ["vacancyId"], ["workFormatId"]),
      ),
      locations: vacancy.locations.map((vacancyLocation) => ({
        ...omit(vacancyLocation, ["vacancyId", "locationId"] as (keyof typeof vacancyLocation)[]),
        location: normalizeLocation(enrichLocation(vacancyLocation.location, locationLookup)),
      })),
      skills: vacancy.skills.map((skill) => normalizeSkillJoin(skill, "vacancyId")),
      languages: vacancy.languages.map((language) =>
        normalizeDictionaryJoin(language, ["vacancyId"], ["languageId"]),
      ),
      vacancyProposedSkills: vacancy.vacancyProposedSkills.map((proposedSkill) =>
        normalizeProposedSkillJoin(proposedSkill, "vacancyId"),
      ),
      applications: vacancy.applications.map((application) => omit(application, ["vacancyId"])),
      applicantStudentProfileIds: vacancy.applications.map((application) => application.studentProfileId),
    })),
  }));
}

async function getApplications(prisma: PrismaClient) {
  const applications = await prisma.application.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      statusHistory: {
        orderBy: { createdAt: "asc" },
        include: { changedByUser: true },
      },
      vacancy: {
        select: {
          id: true,
          title: true,
          companyId: true,
          hrProfileId: true,
          status: true,
        },
      },
      studentProfile: {
        select: {
          id: true,
          user: true,
        },
      },
    },
  });

  return applications.map(normalizeApplicationDetails);
}

function normalizeApplicationDetails<T extends Record<string, unknown>>(application: T) {
  const statusHistory = Array.isArray(application.statusHistory)
    ? application.statusHistory.map((history) =>
        omit(history as Record<string, unknown>, ["applicationId", "changedByUserId"]),
      )
    : application.statusHistory;

  return {
    ...application,
    statusHistory,
  };
}

function buildPayload<T>(entityName: string, records: T[], timestamp: string) {
  return {
    metadata: {
      entity: entityName,
      exportedAt: new Date().toISOString(),
      timestamp,
      count: records.length,
    },
    data: records,
  };
}

async function writeJson(filePath: string, payload: unknown, pretty: boolean) {
  const json = JSON.stringify(payload, null, pretty ? 2 : 0);
  await writeFile(filePath, `${json}\n`, "utf8");
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const { prisma, pool } = createPrismaClient();

  try {
    await mkdir(options.outDir, { recursive: true });

    const [candidates, employers, applications] = await Promise.all([
      getCandidates(prisma),
      getEmployers(prisma),
      getApplications(prisma),
    ]);

    const candidatesPath = path.join(options.outDir, options.candidatesFile);
    const employersPath = path.join(options.outDir, options.employersFile);
    const applicationsPath = path.join(options.outDir, options.applicationsFile);

    await Promise.all([
      writeJson(candidatesPath, buildPayload("candidates", candidates, options.timestamp), options.pretty),
      writeJson(employersPath, buildPayload("employers", employers, options.timestamp), options.pretty),
      writeJson(applicationsPath, buildPayload("applications", applications, options.timestamp), options.pretty),
    ]);

    console.log("Backup created successfully:");
    console.log(`- Candidates: ${candidatesPath}`);
    console.log(`- Employers: ${employersPath}`);
    console.log(`- Applications: ${applicationsPath}`);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((error) => {
  console.error("Backup failed:", error);
  process.exit(1);
});
