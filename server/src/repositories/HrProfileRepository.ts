import { Prisma } from "../../prisma/generated/client/index.js";
import { prisma } from "../config/db.js";
import type { DbClient } from "./repositoryTypes.js";

export type HrProfileCreateData = {
  userId: string;
  companyId: string;
  position: string;
};

export type HrProfileUpdateData = {
  position?: string;
};

export class HrProfileRepository {
  constructor(private readonly db: DbClient = prisma) {}

  /** Створює профіль рекрутера після HR onboarding. */
  async createHrProfile(data: HrProfileCreateData) {
    return this.db.hrProfile.create({ data });
  }

  /** Шукає HR профіль за Clerk user id власника. */
  async findByClerkUserId(clerkUserId: string) {
    return this.db.hrProfile.findFirst({
      where: { user: { clerkUserId } },
      include: { user: true, company: true, links: true },
    });
  }

  /** Шукає HR профіль за id. */
  async findById(hrProfileId: string) {
    return this.db.hrProfile.findUnique({
      where: { id: hrProfileId },
      include: { user: true, company: true, links: true },
    });
  }

  /** Оновлює персональну візитку рекрутера. */
  async updateHrProfile(hrProfileId: string, data: HrProfileUpdateData) {
    return this.db.hrProfile.update({
      where: { id: hrProfileId },
      data,
    });
  }

  /** Замінює додаткові контакти та соцмережі HR профілю. */
  async replaceLinks(hrProfileId: string, links: Prisma.LinkCreateManyInput[]) {
    await this.db.link.deleteMany({ where: { hrProfileId } });
    if (links.length === 0) return;

    await this.db.link.createMany({
      data: links.map((link) => ({ ...link, hrProfileId })),
    });
  }
}

export const hrProfileRepository = new HrProfileRepository();
