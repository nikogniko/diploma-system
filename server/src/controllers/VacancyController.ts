import { getAuth } from "@clerk/express";
import type { NextFunction, Request, Response } from "express";
import { ListingStatus } from "../../prisma/generated/client/index.js";
import { BusinessLogicError, HttpStatus } from "../errors/BusinessLogicError.js";
import { vacancyService } from "../services/VacancyService.js";
import { vacancySearchService } from "../services/VacancySearchService.js";

/** Витягує Clerk user id з авторизованого HR-запиту. */
const requireHrActorId = (req: Request) => {
  const { userId } = getAuth(req);
  if (!userId) {
    throw new BusinessLogicError("Unauthorized. Clerk user id is missing.", HttpStatus.UNAUTHORIZED, "UNAUTHORIZED");
  }
  return userId;
};

/** Повертає id вакансії з параметрів маршруту. */
const vacancyIdParam = (req: Request) => {
  const rawVacancyId = req.params.vacancyId;
  const vacancyId = Array.isArray(rawVacancyId) ? rawVacancyId[0] : rawVacancyId;
  if (!vacancyId) {
    throw new BusinessLogicError("vacancyId route parameter is required", HttpStatus.BAD_REQUEST, "VACANCY_ID_REQUIRED");
  }
  return vacancyId;
};

/** Повертає довідники для форми створення вакансії. */
export const getVacancyCatalogs = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await vacancyService.getVacancyCatalogs(requireHrActorId(req));
    res.status(HttpStatus.OK).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

/** Повертає активні вакансії для студентського каталогу. */
export const searchVacancies = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId } = getAuth(req);
    const result = await vacancySearchService.searchVacancies(req.query, userId);
    res.status(HttpStatus.OK).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

/** Повертає одну публічно видиму вакансію для перегляду. */
export const getStudentVacancy = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await vacancySearchService.getActiveVacancy(vacancyIdParam(req));
    res.status(HttpStatus.OK).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

/** Повертає додаткові опції фільтрів для публічного каталогу вакансій. */
export const getStudentVacancyFilterOptions = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await vacancySearchService.getPublicFilterOptions();
    res.status(HttpStatus.OK).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

/** Повертає список вакансій компанії поточного рекрутера. */
export const listMyVacancies = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await vacancyService.listMyVacancies(requireHrActorId(req), req.query);
    res.status(HttpStatus.OK).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

/** Повертає одну вакансію компанії поточного рекрутера. */
export const getMyVacancy = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await vacancyService.getMyVacancy(requireHrActorId(req), vacancyIdParam(req));
    res.status(HttpStatus.OK).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

/** Створює вакансію компанії поточного рекрутера. */
export const createVacancy = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await vacancyService.createVacancy(requireHrActorId(req), req.body);
    res.status(HttpStatus.CREATED).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

/** Оновлює вакансію компанії поточного рекрутера. */
export const updateVacancy = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await vacancyService.updateVacancy(requireHrActorId(req), vacancyIdParam(req), req.body);
    res.status(HttpStatus.OK).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

/** Змінює статус вакансії компанії поточного рекрутера. */
export const changeVacancyStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await vacancyService.changeVacancyStatus(
      requireHrActorId(req),
      vacancyIdParam(req),
      req.body.status as ListingStatus,
    );
    res.status(HttpStatus.OK).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

/** Архівує вакансію компанії поточного рекрутера. */
export const archiveVacancy = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await vacancyService.archiveVacancy(requireHrActorId(req), vacancyIdParam(req));
    res.status(HttpStatus.OK).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};
