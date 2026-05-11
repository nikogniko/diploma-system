/*
  Warnings:

  - Made the column `about` on table `Company` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "Company" ALTER COLUMN "corporateDomain" DROP NOT NULL,
ALTER COLUMN "employeeCount" DROP NOT NULL,
ALTER COLUMN "about" SET NOT NULL;
