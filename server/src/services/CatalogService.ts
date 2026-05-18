import { BusinessLogicError, HttpStatus } from "../errors/BusinessLogicError.js";
import { CatalogRepository, catalogRepository } from "../repositories/CatalogRepository.js";
import { SkillRepository, skillRepository } from "../repositories/SkillRepository.js";

export class CatalogService {
  constructor(
    private readonly catalogs: CatalogRepository = catalogRepository,
    private readonly skills: SkillRepository = skillRepository,
  ) {}

  /** Повертає довідники, потрібні для заповнення кабінету студента. */
  async getStudentCabinetCatalogs() {
    const [
      languages,
      employmentTypes,
      workSchedules,
      workFormats,
      professions,
      spheres,
      countries,
      regions,
      cities,
      skills,
    ] = await Promise.all([
      this.catalogs.listLanguages(),
      this.catalogs.listEmploymentTypes(),
      this.catalogs.listWorkSchedules(),
      this.catalogs.listWorkFormats(),
      this.catalogs.searchProfessions(),
      this.catalogs.searchSpheres(),
      this.catalogs.searchCountries(),
      this.catalogs.listRegions(),
      this.catalogs.listCities(),
      this.skills.searchSkills(),
    ]);

    return {
      languages,
      employmentTypes,
      workSchedules,
      workFormats,
      professions,
      spheres,
      countries,
      regions,
      cities,
      skillsByCategory: this.groupSkillsByCategory(skills),
    };
  }

  /** Шукає навички для розумного вводу у картках компетенцій. */
  async searchSkills(query?: string) {
    const skills = await this.skills.searchSkills(query);
    return this.groupSkillsByCategory(skills);
  }

  /** Шукає університети для автодоповнення або повертає перші записи. */
  async searchUniversities(query?: string) {
    return this.catalogs.searchUniversities(query);
  }

  /** Шукає професії для бажаної позиції або досвіду роботи. */
  async searchProfessions(query?: string) {
    return this.catalogs.searchProfessions(query);
  }

  /** Шукає сфери діяльності для досвіду роботи. */
  async searchSpheres(query?: string) {
    return this.catalogs.searchSpheres(query);
  }

  /** Шукає країни для вибору бажаних локацій. */
  async searchCountries(query?: string) {
    return this.catalogs.searchCountries(query);
  }

  /** Шукає регіони в межах країни для вибору локації. */
  async searchRegions(countryId: number, query?: string) {
    return this.catalogs.searchRegions(this.requiredNumber(countryId, "countryId"), query);
  }

  /** Шукає міста в межах регіону для вибору локації. */
  async searchCities(regionId: number, query?: string) {
    return this.catalogs.searchCities(this.requiredNumber(regionId, "regionId"), query);
  }

  /** Групує навички за категоріями для frontend UI. */
  private groupSkillsByCategory(skills: Awaited<ReturnType<SkillRepository["searchSkills"]>>) {
    return skills.reduce<Record<string, typeof skills>>((groupedSkills, skill) => {
      groupedSkills[skill.category] ??= [];
      groupedSkills[skill.category].push(skill);
      return groupedSkills;
    }, {});
  }

  /** Повертає число або кидає бізнес-помилку для числового параметра. */
  private requiredNumber(value: unknown, fieldName: string): number {
    const numberValue = typeof value === "string" ? Number(value) : value;

    if (typeof numberValue !== "number" || Number.isNaN(numberValue)) {
      throw new BusinessLogicError(
        `${fieldName} must be a valid number`,
        HttpStatus.BAD_REQUEST,
        "INVALID_NUMBER",
        { fieldName },
      );
    }

    return numberValue;
  }
}

export const catalogService = new CatalogService();
