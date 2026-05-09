-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('STUDENT', 'HR', 'SYS_ADMIN');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('PENDING_VERIFICATION', 'ACTIVE', 'BLOCKED', 'DELETED');

-- CreateEnum
CREATE TYPE "OutboxEventType" AS ENUM ('CREATED', 'UPDATED', 'DELETED');

-- CreateEnum
CREATE TYPE "RegistrationType" AS ENUM ('COMPANY', 'FOP');

-- CreateEnum
CREATE TYPE "CompanySize" AS ENUM ('SIZE_1_10', 'SIZE_11_20', 'SIZE_21_50', 'SIZE_51_100', 'SIZE_101_200', 'SIZE_201_500', 'SIZE_501_1000', 'SIZE_1000_PLUS');

-- CreateEnum
CREATE TYPE "ProfileVisibility" AS ENUM ('PUBLIC', 'APPLIED_ONLY', 'HIDDEN');

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE');

-- CreateEnum
CREATE TYPE "ModerationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "SkillCategory" AS ENUM ('HARD_SKILL', 'SOFT_SKILL', 'TOOL');

-- CreateEnum
CREATE TYPE "LanguageLevel" AS ENUM ('A1', 'A2', 'B1', 'B2', 'C1', 'C2', 'NATIVE');

-- CreateEnum
CREATE TYPE "Degree" AS ENUM ('JUNIOR_BACHELOR', 'BACHELOR', 'MASTER', 'PHD', 'OTHER');

-- CreateEnum
CREATE TYPE "LinkType" AS ENUM ('WEBSITE', 'MESSENGER', 'SOCIAL', 'PORTFOLIO', 'OTHER');

-- CreateEnum
CREATE TYPE "SalaryPeriod" AS ENUM ('PER_MONTH', 'PER_HOUR');

-- CreateEnum
CREATE TYPE "ListingStatus" AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED', 'CLOSED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "RequirementWeight" AS ENUM ('CRITICAL', 'IMPORTANT', 'NICE_TO_HAVE');

-- CreateTable
CREATE TABLE "OutboxEvent" (
    "id" TEXT NOT NULL,
    "aggregateType" VARCHAR(100) NOT NULL,
    "aggregateId" VARCHAR(100) NOT NULL,
    "eventType" "OutboxEventType" NOT NULL,
    "payload" JSONB NOT NULL,
    "status" VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OutboxEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Link" (
    "id" TEXT NOT NULL,
    "linkType" "LinkType" NOT NULL,
    "linkName" VARCHAR(100) NOT NULL,
    "value" VARCHAR(255) NOT NULL,
    "studentProfileId" TEXT,
    "companyId" TEXT,
    "hrProfileId" TEXT,

    CONSTRAINT "Link_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Skill" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "category" "SkillCategory" NOT NULL,

    CONSTRAINT "Skill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Language" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(50) NOT NULL,

    CONSTRAINT "Language_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "University" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(200) NOT NULL,

    CONSTRAINT "University_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Profession" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(150) NOT NULL,

    CONSTRAINT "Profession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sphere" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(150) NOT NULL,

    CONSTRAINT "Sphere_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmploymentType" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,

    CONSTRAINT "EmploymentType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkSchedule" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,

    CONSTRAINT "WorkSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkFormat" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,

    CONSTRAINT "WorkFormat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Country" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,

    CONSTRAINT "Country_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Region" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "countryId" INTEGER NOT NULL,

    CONSTRAINT "Region_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "City" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "regionId" INTEGER NOT NULL,

    CONSTRAINT "City_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Location" (
    "id" TEXT NOT NULL,
    "countryId" INTEGER NOT NULL,
    "regionId" INTEGER,
    "cityId" INTEGER,

    CONSTRAINT "Location_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "clerkUserId" VARCHAR(255) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "role" "UserRole" NOT NULL,
    "status" "UserStatus" NOT NULL DEFAULT 'PENDING_VERIFICATION',
    "firstName" VARCHAR(100) NOT NULL,
    "lastName" VARCHAR(100) NOT NULL,
    "middleName" VARCHAR(100),
    "photoUrl" VARCHAR(255),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL,
    "registrationType" "RegistrationType" NOT NULL,
    "registrationNumber" VARCHAR(50) NOT NULL,
    "legalName" VARCHAR(200) NOT NULL,
    "corporateDomain" VARCHAR(100) NOT NULL,
    "verificationStatus" "ModerationStatus" NOT NULL DEFAULT 'PENDING',
    "logoUrl" VARCHAR(255),
    "publicName" VARCHAR(100) NOT NULL,
    "websiteUrl" VARCHAR(255),
    "foundationYear" SMALLINT NOT NULL,
    "employeeCount" "CompanySize" NOT NULL,
    "about" TEXT,
    "publicEmail" VARCHAR(255) NOT NULL,
    "publicPhone" VARCHAR(50),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HrProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "position" VARCHAR(150) NOT NULL,

    CONSTRAINT "HrProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "gender" "Gender",
    "birthDate" DATE NOT NULL,
    "about" VARCHAR(500),
    "contactEmail" VARCHAR(255) NOT NULL,
    "primaryPhone" VARCHAR(50) NOT NULL,
    "secondaryPhone" VARCHAR(50),
    "desiredPosition" VARCHAR(150),
    "minSalary" INTEGER,
    "isActiveSearch" BOOLEAN NOT NULL DEFAULT true,
    "visibility" "ProfileVisibility" NOT NULL DEFAULT 'APPLIED_ONLY',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vacancy" (
    "id" TEXT NOT NULL,
    "hrProfileId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "description" TEXT NOT NULL,
    "professionId" INTEGER NOT NULL,
    "isLocationCritical" BOOLEAN NOT NULL DEFAULT false,
    "minSalary" INTEGER,
    "maxSalary" INTEGER,
    "salaryPeriod" "SalaryPeriod",
    "status" "ListingStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "publishedAt" TIMESTAMP(3),
    "closingDate" DATE NOT NULL,

    CONSTRAINT "Vacancy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Education" (
    "id" TEXT NOT NULL,
    "studentProfileId" TEXT NOT NULL,
    "universityId" INTEGER,
    "customUniversityName" VARCHAR(200),
    "degree" "Degree" NOT NULL,
    "specialty" VARCHAR(200) NOT NULL,
    "startYear" SMALLINT NOT NULL,
    "endYear" SMALLINT,
    "diplomaUrl" VARCHAR(255),

    CONSTRAINT "Education_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LanguageSkill" (
    "id" TEXT NOT NULL,
    "studentProfileId" TEXT NOT NULL,
    "languageId" INTEGER NOT NULL,
    "level" "LanguageLevel" NOT NULL,
    "certificateUrl" VARCHAR(255),

    CONSTRAINT "LanguageSkill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Experience" (
    "id" TEXT NOT NULL,
    "studentProfileId" TEXT NOT NULL,
    "professionId" INTEGER NOT NULL,
    "sphereId" INTEGER NOT NULL,
    "companyName" VARCHAR(200) NOT NULL,
    "position" VARCHAR(200) NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE,
    "achievements" TEXT NOT NULL,

    CONSTRAINT "Experience_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "studentProfileId" TEXT NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "description" TEXT NOT NULL,
    "projectUrl" VARCHAR(255),

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Course" (
    "id" TEXT NOT NULL,
    "studentProfileId" TEXT NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE,
    "certificateUrl" VARCHAR(255),

    CONSTRAINT "Course_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExperienceSkill" (
    "experienceId" TEXT NOT NULL,
    "skillId" INTEGER NOT NULL,

    CONSTRAINT "ExperienceSkill_pkey" PRIMARY KEY ("experienceId","skillId")
);

-- CreateTable
CREATE TABLE "ProjectSkill" (
    "projectId" TEXT NOT NULL,
    "skillId" INTEGER NOT NULL,

    CONSTRAINT "ProjectSkill_pkey" PRIMARY KEY ("projectId","skillId")
);

-- CreateTable
CREATE TABLE "CourseSkill" (
    "courseId" TEXT NOT NULL,
    "skillId" INTEGER NOT NULL,

    CONSTRAINT "CourseSkill_pkey" PRIMARY KEY ("courseId","skillId")
);

-- CreateTable
CREATE TABLE "StudentDesiredProfession" (
    "profileId" TEXT NOT NULL,
    "professionId" INTEGER NOT NULL,

    CONSTRAINT "StudentDesiredProfession_pkey" PRIMARY KEY ("profileId","professionId")
);

-- CreateTable
CREATE TABLE "StudentEmploymentType" (
    "profileId" TEXT NOT NULL,
    "employmentTypeId" INTEGER NOT NULL,

    CONSTRAINT "StudentEmploymentType_pkey" PRIMARY KEY ("profileId","employmentTypeId")
);

-- CreateTable
CREATE TABLE "StudentWorkSchedule" (
    "profileId" TEXT NOT NULL,
    "workScheduleId" INTEGER NOT NULL,

    CONSTRAINT "StudentWorkSchedule_pkey" PRIMARY KEY ("profileId","workScheduleId")
);

-- CreateTable
CREATE TABLE "StudentWorkFormat" (
    "profileId" TEXT NOT NULL,
    "workFormatId" INTEGER NOT NULL,

    CONSTRAINT "StudentWorkFormat_pkey" PRIMARY KEY ("profileId","workFormatId")
);

-- CreateTable
CREATE TABLE "StudentDesiredLocation" (
    "profileId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,

    CONSTRAINT "StudentDesiredLocation_pkey" PRIMARY KEY ("profileId","locationId")
);

-- CreateTable
CREATE TABLE "CompanySphere" (
    "companyId" TEXT NOT NULL,
    "sphereId" INTEGER NOT NULL,

    CONSTRAINT "CompanySphere_pkey" PRIMARY KEY ("companyId","sphereId")
);

-- CreateTable
CREATE TABLE "CompanyLocation" (
    "companyId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,

    CONSTRAINT "CompanyLocation_pkey" PRIMARY KEY ("companyId","locationId")
);

-- CreateTable
CREATE TABLE "VacancySphere" (
    "vacancyId" TEXT NOT NULL,
    "sphereId" INTEGER NOT NULL,

    CONSTRAINT "VacancySphere_pkey" PRIMARY KEY ("vacancyId","sphereId")
);

-- CreateTable
CREATE TABLE "VacancyEmploymentType" (
    "vacancyId" TEXT NOT NULL,
    "employmentTypeId" INTEGER NOT NULL,

    CONSTRAINT "VacancyEmploymentType_pkey" PRIMARY KEY ("vacancyId","employmentTypeId")
);

-- CreateTable
CREATE TABLE "VacancyWorkSchedule" (
    "vacancyId" TEXT NOT NULL,
    "workScheduleId" INTEGER NOT NULL,

    CONSTRAINT "VacancyWorkSchedule_pkey" PRIMARY KEY ("vacancyId","workScheduleId")
);

-- CreateTable
CREATE TABLE "VacancyWorkFormat" (
    "vacancyId" TEXT NOT NULL,
    "workFormatId" INTEGER NOT NULL,

    CONSTRAINT "VacancyWorkFormat_pkey" PRIMARY KEY ("vacancyId","workFormatId")
);

-- CreateTable
CREATE TABLE "VacancyLocation" (
    "vacancyId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,

    CONSTRAINT "VacancyLocation_pkey" PRIMARY KEY ("vacancyId","locationId")
);

-- CreateTable
CREATE TABLE "VacancySkill" (
    "vacancyId" TEXT NOT NULL,
    "skillId" INTEGER NOT NULL,
    "weight" "RequirementWeight" NOT NULL,

    CONSTRAINT "VacancySkill_pkey" PRIMARY KEY ("vacancyId","skillId")
);

-- CreateTable
CREATE TABLE "VacancyLanguage" (
    "vacancyId" TEXT NOT NULL,
    "languageId" INTEGER NOT NULL,
    "level" "LanguageLevel" NOT NULL,

    CONSTRAINT "VacancyLanguage_pkey" PRIMARY KEY ("vacancyId","languageId")
);

-- CreateTable
CREATE TABLE "ProposedSkill" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "status" "ModerationStatus" NOT NULL DEFAULT 'PENDING',

    CONSTRAINT "ProposedSkill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExperienceProposedSkill" (
    "experienceId" TEXT NOT NULL,
    "proposedSkillId" INTEGER NOT NULL,

    CONSTRAINT "ExperienceProposedSkill_pkey" PRIMARY KEY ("experienceId","proposedSkillId")
);

-- CreateTable
CREATE TABLE "ProjectProposedSkill" (
    "projectId" TEXT NOT NULL,
    "proposedSkillId" INTEGER NOT NULL,

    CONSTRAINT "ProjectProposedSkill_pkey" PRIMARY KEY ("projectId","proposedSkillId")
);

-- CreateTable
CREATE TABLE "CourseProposedSkill" (
    "courseId" TEXT NOT NULL,
    "proposedSkillId" INTEGER NOT NULL,

    CONSTRAINT "CourseProposedSkill_pkey" PRIMARY KEY ("courseId","proposedSkillId")
);

-- CreateTable
CREATE TABLE "VacancyProposedSkill" (
    "vacancyId" TEXT NOT NULL,
    "proposedSkillId" INTEGER NOT NULL,
    "weight" "RequirementWeight" NOT NULL,

    CONSTRAINT "VacancyProposedSkill_pkey" PRIMARY KEY ("vacancyId","proposedSkillId")
);

-- CreateIndex
CREATE INDEX "OutboxEvent_status_createdAt_idx" ON "OutboxEvent"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Skill_name_key" ON "Skill"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Language_name_key" ON "Language"("name");

-- CreateIndex
CREATE UNIQUE INDEX "University_name_key" ON "University"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Profession_name_key" ON "Profession"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Sphere_name_key" ON "Sphere"("name");

-- CreateIndex
CREATE UNIQUE INDEX "EmploymentType_name_key" ON "EmploymentType"("name");

-- CreateIndex
CREATE UNIQUE INDEX "WorkSchedule_name_key" ON "WorkSchedule"("name");

-- CreateIndex
CREATE UNIQUE INDEX "WorkFormat_name_key" ON "WorkFormat"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Country_name_key" ON "Country"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Region_name_countryId_key" ON "Region"("name", "countryId");

-- CreateIndex
CREATE UNIQUE INDEX "City_name_regionId_key" ON "City"("name", "regionId");

-- CreateIndex
CREATE UNIQUE INDEX "Location_countryId_regionId_cityId_key" ON "Location"("countryId", "regionId", "cityId");

-- CreateIndex
CREATE UNIQUE INDEX "User_clerkUserId_key" ON "User"("clerkUserId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Company_registrationNumber_key" ON "Company"("registrationNumber");

-- CreateIndex
CREATE UNIQUE INDEX "HrProfile_userId_key" ON "HrProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "StudentProfile_userId_key" ON "StudentProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "LanguageSkill_studentProfileId_languageId_key" ON "LanguageSkill"("studentProfileId", "languageId");

-- CreateIndex
CREATE UNIQUE INDEX "ProposedSkill_name_key" ON "ProposedSkill"("name");

-- AddForeignKey
ALTER TABLE "Link" ADD CONSTRAINT "Link_studentProfileId_fkey" FOREIGN KEY ("studentProfileId") REFERENCES "StudentProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Link" ADD CONSTRAINT "Link_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Link" ADD CONSTRAINT "Link_hrProfileId_fkey" FOREIGN KEY ("hrProfileId") REFERENCES "HrProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Region" ADD CONSTRAINT "Region_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "Country"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "City" ADD CONSTRAINT "City_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "Region"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HrProfile" ADD CONSTRAINT "HrProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HrProfile" ADD CONSTRAINT "HrProfile_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentProfile" ADD CONSTRAINT "StudentProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vacancy" ADD CONSTRAINT "Vacancy_hrProfileId_fkey" FOREIGN KEY ("hrProfileId") REFERENCES "HrProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vacancy" ADD CONSTRAINT "Vacancy_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vacancy" ADD CONSTRAINT "Vacancy_professionId_fkey" FOREIGN KEY ("professionId") REFERENCES "Profession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Education" ADD CONSTRAINT "Education_studentProfileId_fkey" FOREIGN KEY ("studentProfileId") REFERENCES "StudentProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Education" ADD CONSTRAINT "Education_universityId_fkey" FOREIGN KEY ("universityId") REFERENCES "University"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LanguageSkill" ADD CONSTRAINT "LanguageSkill_studentProfileId_fkey" FOREIGN KEY ("studentProfileId") REFERENCES "StudentProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LanguageSkill" ADD CONSTRAINT "LanguageSkill_languageId_fkey" FOREIGN KEY ("languageId") REFERENCES "Language"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Experience" ADD CONSTRAINT "Experience_studentProfileId_fkey" FOREIGN KEY ("studentProfileId") REFERENCES "StudentProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Experience" ADD CONSTRAINT "Experience_professionId_fkey" FOREIGN KEY ("professionId") REFERENCES "Profession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Experience" ADD CONSTRAINT "Experience_sphereId_fkey" FOREIGN KEY ("sphereId") REFERENCES "Sphere"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_studentProfileId_fkey" FOREIGN KEY ("studentProfileId") REFERENCES "StudentProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Course" ADD CONSTRAINT "Course_studentProfileId_fkey" FOREIGN KEY ("studentProfileId") REFERENCES "StudentProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExperienceSkill" ADD CONSTRAINT "ExperienceSkill_experienceId_fkey" FOREIGN KEY ("experienceId") REFERENCES "Experience"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExperienceSkill" ADD CONSTRAINT "ExperienceSkill_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "Skill"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectSkill" ADD CONSTRAINT "ProjectSkill_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectSkill" ADD CONSTRAINT "ProjectSkill_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "Skill"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseSkill" ADD CONSTRAINT "CourseSkill_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseSkill" ADD CONSTRAINT "CourseSkill_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "Skill"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentDesiredProfession" ADD CONSTRAINT "StudentDesiredProfession_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "StudentProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentDesiredProfession" ADD CONSTRAINT "StudentDesiredProfession_professionId_fkey" FOREIGN KEY ("professionId") REFERENCES "Profession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentEmploymentType" ADD CONSTRAINT "StudentEmploymentType_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "StudentProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentEmploymentType" ADD CONSTRAINT "StudentEmploymentType_employmentTypeId_fkey" FOREIGN KEY ("employmentTypeId") REFERENCES "EmploymentType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentWorkSchedule" ADD CONSTRAINT "StudentWorkSchedule_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "StudentProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentWorkSchedule" ADD CONSTRAINT "StudentWorkSchedule_workScheduleId_fkey" FOREIGN KEY ("workScheduleId") REFERENCES "WorkSchedule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentWorkFormat" ADD CONSTRAINT "StudentWorkFormat_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "StudentProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentWorkFormat" ADD CONSTRAINT "StudentWorkFormat_workFormatId_fkey" FOREIGN KEY ("workFormatId") REFERENCES "WorkFormat"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentDesiredLocation" ADD CONSTRAINT "StudentDesiredLocation_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "StudentProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentDesiredLocation" ADD CONSTRAINT "StudentDesiredLocation_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanySphere" ADD CONSTRAINT "CompanySphere_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanySphere" ADD CONSTRAINT "CompanySphere_sphereId_fkey" FOREIGN KEY ("sphereId") REFERENCES "Sphere"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyLocation" ADD CONSTRAINT "CompanyLocation_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyLocation" ADD CONSTRAINT "CompanyLocation_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VacancySphere" ADD CONSTRAINT "VacancySphere_vacancyId_fkey" FOREIGN KEY ("vacancyId") REFERENCES "Vacancy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VacancySphere" ADD CONSTRAINT "VacancySphere_sphereId_fkey" FOREIGN KEY ("sphereId") REFERENCES "Sphere"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VacancyEmploymentType" ADD CONSTRAINT "VacancyEmploymentType_vacancyId_fkey" FOREIGN KEY ("vacancyId") REFERENCES "Vacancy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VacancyEmploymentType" ADD CONSTRAINT "VacancyEmploymentType_employmentTypeId_fkey" FOREIGN KEY ("employmentTypeId") REFERENCES "EmploymentType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VacancyWorkSchedule" ADD CONSTRAINT "VacancyWorkSchedule_vacancyId_fkey" FOREIGN KEY ("vacancyId") REFERENCES "Vacancy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VacancyWorkSchedule" ADD CONSTRAINT "VacancyWorkSchedule_workScheduleId_fkey" FOREIGN KEY ("workScheduleId") REFERENCES "WorkSchedule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VacancyWorkFormat" ADD CONSTRAINT "VacancyWorkFormat_vacancyId_fkey" FOREIGN KEY ("vacancyId") REFERENCES "Vacancy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VacancyWorkFormat" ADD CONSTRAINT "VacancyWorkFormat_workFormatId_fkey" FOREIGN KEY ("workFormatId") REFERENCES "WorkFormat"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VacancyLocation" ADD CONSTRAINT "VacancyLocation_vacancyId_fkey" FOREIGN KEY ("vacancyId") REFERENCES "Vacancy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VacancyLocation" ADD CONSTRAINT "VacancyLocation_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VacancySkill" ADD CONSTRAINT "VacancySkill_vacancyId_fkey" FOREIGN KEY ("vacancyId") REFERENCES "Vacancy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VacancySkill" ADD CONSTRAINT "VacancySkill_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "Skill"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VacancyLanguage" ADD CONSTRAINT "VacancyLanguage_vacancyId_fkey" FOREIGN KEY ("vacancyId") REFERENCES "Vacancy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VacancyLanguage" ADD CONSTRAINT "VacancyLanguage_languageId_fkey" FOREIGN KEY ("languageId") REFERENCES "Language"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExperienceProposedSkill" ADD CONSTRAINT "ExperienceProposedSkill_experienceId_fkey" FOREIGN KEY ("experienceId") REFERENCES "Experience"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExperienceProposedSkill" ADD CONSTRAINT "ExperienceProposedSkill_proposedSkillId_fkey" FOREIGN KEY ("proposedSkillId") REFERENCES "ProposedSkill"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectProposedSkill" ADD CONSTRAINT "ProjectProposedSkill_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectProposedSkill" ADD CONSTRAINT "ProjectProposedSkill_proposedSkillId_fkey" FOREIGN KEY ("proposedSkillId") REFERENCES "ProposedSkill"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseProposedSkill" ADD CONSTRAINT "CourseProposedSkill_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseProposedSkill" ADD CONSTRAINT "CourseProposedSkill_proposedSkillId_fkey" FOREIGN KEY ("proposedSkillId") REFERENCES "ProposedSkill"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VacancyProposedSkill" ADD CONSTRAINT "VacancyProposedSkill_vacancyId_fkey" FOREIGN KEY ("vacancyId") REFERENCES "Vacancy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VacancyProposedSkill" ADD CONSTRAINT "VacancyProposedSkill_proposedSkillId_fkey" FOREIGN KEY ("proposedSkillId") REFERENCES "ProposedSkill"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
