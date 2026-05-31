import { prisma } from "../config/db.js";
import type { DbClient } from "./repositoryTypes.js";

export class SkillRepository {
  constructor(private readonly db: DbClient = prisma) {}

  /** Рахує, скільки навичок із переданого списку існує в довіднику. */
  async countExistingSkills(skillIds: number[]) {
    return this.db.skill.count({ where: { id: { in: skillIds } } });
  }

  /** Шукає навички за списком id. */
  async findSkillsByIds(skillIds: number[]) {
    return this.db.skill.findMany({ where: { id: { in: skillIds } } });
  }

  /** Шукає навички за назвою та повертає їх із категоріями для розумного вводу. */
  async searchSkills(query?: string) {
    return this.db.skill.findMany({
      where: query ? { name: { contains: query, mode: "insensitive" } } : undefined,
      orderBy: [{ category: "asc" }, { name: "asc" }],
    });
  }
}

export const skillRepository = new SkillRepository();
