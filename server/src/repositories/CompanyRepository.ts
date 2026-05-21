import {
  type CompanySize,
  type ModerationStatus,
  Prisma,
  type RegistrationType,
} from "../../prisma/generated/client/index.js";
import { prisma } from "../config/db.js";
import type { DbClient } from "./repositoryTypes.js";
import type { LocationKey } from "./StudentProfileRepository.js";

export type CompanyCreateData = {
  registrationType: RegistrationType;
  registrationNumber: string;
  legalName: string;
  corporateDomain?: string | null;
  verificationStatus?: ModerationStatus;
  logoUrl?: string | null;
  publicName: string;
  websiteUrl?: string | null;
  foundationYear: number;
  employeeCount?: CompanySize | null;
  about: string;
  publicEmail: string;
  publicPhone?: string | null;
};

export type CompanyUpdateData = Partial<CompanyCreateData>;

export class CompanyRepository {
  constructor(private readonly db: DbClient = prisma) {}

  /** Створює компанію або ФОП під час HR onboarding. */
  async createCompany(data: CompanyCreateData) {
    return this.db.company.create({ data });
  }

  /** Шукає компанію за id. */
  async findCompanyById(companyId: string) {
    return this.db.company.findUnique({
      where: { id: companyId },
      include: {
        spheres: { include: { sphere: true } },
        locations: { include: { location: true } },
        links: true,
      },
    });
  }

  /** Шукає компанію, до якої належить HR за Clerk user id. */
  async findCompanyByHrClerkId(clerkUserId: string) {
    return this.db.company.findFirst({
      where: { hrProfiles: { some: { user: { clerkUserId } } } },
      include: {
        spheres: { include: { sphere: true } },
        locations: { include: { location: true } },
        links: true,
      },
    });
  }

  /** Шукає компанії за публічною або юридичною назвою для HR onboarding. */
  async searchCompanies(query?: string) {
    return this.db.company.findMany({
      where: query
        ? {
            OR: [
              { publicName: { contains: query, mode: "insensitive" } },
              { legalName: { contains: query, mode: "insensitive" } },
            ],
          }
        : undefined,
      select: {
        id: true,
        registrationType: true,
        publicName: true,
        legalName: true,
        corporateDomain: true,
        verificationStatus: true,
      },
      orderBy: { publicName: "asc" },
      take: 20,
    });
  }

  /** Повертає список HR профілів компанії. */
  async listCompanyHrs(companyId: string) {
    return this.db.hrProfile.findMany({
      where: { companyId },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            middleName: true,
            photoUrl: true,
            status: true,
            email: true,
            createdAt: true,
          },
        },
        links: true,
      },
    });
  }

  /** Оновлює публічну візитку компанії. */
  async updateCompany(companyId: string, data: CompanyUpdateData) {
    return this.db.company.update({
      where: { id: companyId },
      data: {
        registrationType: data.registrationType,
        registrationNumber: data.registrationNumber,
        legalName: data.legalName,
        corporateDomain: data.corporateDomain,
        verificationStatus: data.verificationStatus,
        logoUrl: data.logoUrl,
        publicName: data.publicName,
        websiteUrl: data.websiteUrl,
        foundationYear: data.foundationYear,
        employeeCount: data.employeeCount,
        about: data.about,
        publicEmail: data.publicEmail?.toLowerCase(),
        publicPhone: data.publicPhone,
      },
    });
  }

  /** Замінює сфери діяльності компанії. */
  async replaceCompanySpheres(companyId: string, sphereIds: number[]) {
    await this.db.companySphere.deleteMany({ where: { companyId } });
    if (sphereIds.length === 0) return;

    await this.db.companySphere.createMany({
      data: sphereIds.map((sphereId) => ({ companyId, sphereId })),
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

  /** Замінює офісні локації компанії. */
  async replaceCompanyLocations(companyId: string, locationIds: string[]) {
    await this.db.companyLocation.deleteMany({ where: { companyId } });
    if (locationIds.length === 0) return;

    await this.db.companyLocation.createMany({
      data: locationIds.map((locationId) => ({ companyId, locationId })),
      skipDuplicates: true,
    });
  }

  /** Замінює публічні посилання компанії. */
  async replaceLinks(companyId: string, links: Prisma.LinkCreateManyInput[]) {
    await this.db.link.deleteMany({ where: { companyId } });
    if (links.length === 0) return;

    await this.db.link.createMany({
      data: links.map((link) => ({ ...link, companyId })),
    });
  }
}

export const companyRepository = new CompanyRepository();
