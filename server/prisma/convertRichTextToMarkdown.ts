// Run from the server directory: npm run rich-text:markdown

import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import TurndownService from "turndown";
import { PrismaClient } from "./generated/client/index.js";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});

const prisma = new PrismaClient({ adapter });
const turndown = new TurndownService({
  bulletListMarker: "-",
  codeBlockStyle: "fenced",
  headingStyle: "atx",
});

const htmlPattern = /<\/?[a-z][\s\S]*>/i;

function toMarkdown(value: string | null | undefined) {
  if (!value || !htmlPattern.test(value)) return null;
  return turndown.turndown(value).trim();
}

async function convertCompanies() {
  let count = 0;
  const rows = await prisma.company.findMany({ select: { id: true, about: true } });
  for (const row of rows) {
    const about = toMarkdown(row.about);
    if (about === null || about === row.about) continue;
    await prisma.company.update({ where: { id: row.id }, data: { about } });
    count += 1;
  }
  return count;
}

async function convertStudentProfiles() {
  let count = 0;
  const rows = await prisma.studentProfile.findMany({ select: { id: true, about: true } });
  for (const row of rows) {
    const about = toMarkdown(row.about);
    if (about === null || about === row.about) continue;
    await prisma.studentProfile.update({ where: { id: row.id }, data: { about } });
    count += 1;
  }
  return count;
}

async function convertVacancies() {
  let count = 0;
  const rows = await prisma.vacancy.findMany({ select: { id: true, description: true } });
  for (const row of rows) {
    const description = toMarkdown(row.description);
    if (description === null || description === row.description) continue;
    await prisma.vacancy.update({ where: { id: row.id }, data: { description } });
    count += 1;
  }
  return count;
}

async function convertExperiences() {
  let count = 0;
  const rows = await prisma.experience.findMany({ select: { id: true, achievements: true } });
  for (const row of rows) {
    const achievements = toMarkdown(row.achievements);
    if (achievements === null || achievements === row.achievements) continue;
    await prisma.experience.update({ where: { id: row.id }, data: { achievements } });
    count += 1;
  }
  return count;
}

async function convertProjects() {
  let count = 0;
  const rows = await prisma.project.findMany({ select: { id: true, description: true } });
  for (const row of rows) {
    const description = toMarkdown(row.description);
    if (description === null || description === row.description) continue;
    await prisma.project.update({ where: { id: row.id }, data: { description } });
    count += 1;
  }
  return count;
}

async function main() {
  const [companies, studentProfiles, vacancies, experiences, projects] = await Promise.all([
    convertCompanies(),
    convertStudentProfiles(),
    convertVacancies(),
    convertExperiences(),
    convertProjects(),
  ]);

  console.log("Rich text converted to Markdown:");
  console.log(`- Companies: ${companies}`);
  console.log(`- Student profiles: ${studentProfiles}`);
  console.log(`- Vacancies: ${vacancies}`);
  console.log(`- Experiences: ${experiences}`);
  console.log(`- Projects: ${projects}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
