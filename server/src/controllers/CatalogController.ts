import type { NextFunction, Request, Response } from "express";
import { HttpStatus } from "../errors/BusinessLogicError.js";
import { catalogService } from "../services/CatalogService.js";

/** Повертає рядковий query-параметр з URL. */
const queryParam = (req: Request, name: string) => {
  const value = req.query[name];
  return typeof value === "string" ? value : undefined;
};

/** Повертає довідники, потрібні для студентського кабінету. */
export const getStudentCabinetCatalogs = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const result = await catalogService.getStudentCabinetCatalogs();
    res.status(HttpStatus.OK).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

/** Шукає навички для розумного вводу. */
export const searchSkills = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await catalogService.searchSkills(queryParam(req, "q"));
    res.status(HttpStatus.OK).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

/** Шукає університети для автодоповнення. */
export const searchUniversities = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await catalogService.searchUniversities(queryParam(req, "q"));
    res.status(HttpStatus.OK).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

/** Шукає професії для профілю студента. */
export const searchProfessions = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await catalogService.searchProfessions(queryParam(req, "q"));
    res.status(HttpStatus.OK).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

/** Шукає сфери діяльності для досвіду роботи. */
export const searchSpheres = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await catalogService.searchSpheres(queryParam(req, "q"));
    res.status(HttpStatus.OK).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

/** Шукає країни для вибору бажаних локацій. */
export const searchCountries = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await catalogService.searchCountries(queryParam(req, "q"));
    res.status(HttpStatus.OK).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

/** Шукає регіони в межах країни. */
export const searchRegions = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await catalogService.searchRegions(
      Number(req.params.countryId),
      queryParam(req, "q"),
    );
    res.status(HttpStatus.OK).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

/** Шукає міста в межах регіону. */
export const searchCities = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await catalogService.searchCities(
      Number(req.params.regionId),
      queryParam(req, "q"),
    );
    res.status(HttpStatus.OK).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};
