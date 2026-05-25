import { getAuth } from "@clerk/express";
import type { NextFunction, Request, Response } from "express";
import { BusinessLogicError, HttpStatus } from "../errors/BusinessLogicError.js";
import { applicationService } from "../services/ApplicationService.js";

/** Повертає Clerk user id для захищених application operations. */
const requireActorId = (req: Request) => {
  const { userId } = getAuth(req);
  if (!userId) {
    throw new BusinessLogicError("Unauthorized. Clerk user id is missing.", HttpStatus.UNAUTHORIZED, "UNAUTHORIZED");
  }
  return userId;
};

/** Зчитує обов'язковий application id з параметрів маршруту. */
const applicationIdParam = (req: Request) => {
  const value = req.params.id;
  const applicationId = Array.isArray(value) ? value[0] : value;
  if (!applicationId) {
    throw new BusinessLogicError("Application id is required", HttpStatus.BAD_REQUEST, "APPLICATION_ID_REQUIRED");
  }
  return applicationId;
};

/** Зчитує обов'язковий vacancy id з параметрів маршруту. */
const vacancyIdParam = (req: Request) => {
  const value = req.params.id;
  const vacancyId = Array.isArray(value) ? value[0] : value;
  if (!vacancyId) {
    throw new BusinessLogicError("Vacancy id is required", HttpStatus.BAD_REQUEST, "VACANCY_ID_REQUIRED");
  }
  return vacancyId;
};

/** Перевіряє, чи поточний студент може подати заявку на вакансію. */
export const checkApplicationEligibility = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await applicationService.checkEligibility(requireActorId(req), req.body.vacancyId);
    res.status(HttpStatus.OK).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

/** Створює application поточного студента після eligibility check. */
export const createApplication = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await applicationService.createApplication(requireActorId(req), req.body);
    res.status(HttpStatus.CREATED).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

/** Повертає власні applications поточного студента. */
export const listMyApplications = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await applicationService.listMyApplications(requireActorId(req));
    res.status(HttpStatus.OK).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

/** Повертає applications вакансії її автору-HR. */
export const listVacancyApplications = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await applicationService.listVacancyApplications(requireActorId(req), vacancyIdParam(req));
    res.status(HttpStatus.OK).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

/** Оновлює статус application із перевіркою ролі та ownership. */
export const changeApplicationStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await applicationService.changeStatus(requireActorId(req), applicationIdParam(req), req.body.status);
    res.status(HttpStatus.OK).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};
