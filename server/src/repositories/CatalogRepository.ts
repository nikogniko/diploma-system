import { prisma } from "../config/db.js";
import type { DbClient } from "./repositoryTypes.js";

export class CatalogRepository {
  constructor(private readonly db: DbClient = prisma) {}

  /** Шукає університети для автодоповнення в освіті студента. */
  async searchUniversities(query?: string) {
    return this.db.university.findMany({
      where: query ? { name: { contains: query, mode: "insensitive" } } : undefined,
      orderBy: { name: "asc" },
      take: 20,
    });
  }

  /** Повертає список мов для вибору в резюме. */
  async listLanguages() {
    return this.db.language.findMany({ orderBy: { name: "asc" } });
  }

  /** Шукає професії для бажаної позиції та досвіду роботи. */
  async searchProfessions(query?: string) {
    return this.db.profession.findMany({
      where: query ? { name: { contains: query, mode: "insensitive" } } : undefined,
      orderBy: { name: "asc" },
      take: 30,
    });
  }

  /** Шукає сфери для досвіду роботи та компаній. */
  async searchSpheres(query?: string) {
    return this.db.sphere.findMany({
      where: query ? { name: { contains: query, mode: "insensitive" } } : undefined,
      orderBy: { name: "asc" },
      take: 30,
    });
  }

  /** Повертає довідник типів зайнятості. */
  async listEmploymentTypes() {
    return this.db.employmentType.findMany({ orderBy: { name: "asc" } });
  }

  /** Повертає довідник графіків роботи. */
  async listWorkSchedules() {
    return this.db.workSchedule.findMany({ orderBy: { name: "asc" } });
  }

  /** Повертає довідник форматів роботи. */
  async listWorkFormats() {
    return this.db.workFormat.findMany({ orderBy: { name: "asc" } });
  }

  /** Шукає країни для вибору бажаних локацій. */
  async searchCountries(query?: string) {
    return this.db.country.findMany({
      where: query ? { name: { contains: query, mode: "insensitive" } } : undefined,
      orderBy: { name: "asc" },
      take: 30,
    });
  }

  /** Шукає регіони в межах країни. */
  async searchRegions(countryId: number, query?: string) {
    return this.db.region.findMany({
      where: {
        countryId,
        ...(query ? { name: { contains: query, mode: "insensitive" } } : {}),
      },
      orderBy: { name: "asc" },
      take: 30,
    });
  }

  /** Повертає всі регіони для побудови назв збережених локацій на фронтенді. */
  async listRegions() {
    return this.db.region.findMany({ orderBy: { name: "asc" } });
  }

  /** Шукає міста в межах регіону. */
  async searchCities(regionId: number, query?: string) {
    return this.db.city.findMany({
      where: {
        regionId,
        ...(query ? { name: { contains: query, mode: "insensitive" } } : {}),
      },
      orderBy: { name: "asc" },
      take: 30,
    });
  }

  /** Повертає всі міста для побудови назв збережених локацій на фронтенді. */
  async listCities() {
    return this.db.city.findMany({ orderBy: { name: "asc" } });
  }
}

export const catalogRepository = new CatalogRepository();
