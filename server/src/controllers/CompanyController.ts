import { getAuth } from "@clerk/express";
import type { NextFunction, Request, Response } from "express";
import { BusinessLogicError, HttpStatus } from "../errors/BusinessLogicError.js";
import { companyService } from "../services/CompanyService.js";

/** Витягує Clerk user id з авторизованого запиту. */
const requireClerkUserId = (req: Request) => {
  const { userId } = getAuth(req);

  if (!userId) {
    throw new BusinessLogicError(
      "Unauthorized. Clerk user id is missing.",
      HttpStatus.UNAUTHORIZED,
      "UNAUTHORIZED",
    );
  }

  return userId;
};

/** Шукає компанії для onboarding роботодавця. */
export const searchCompanies = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const query = typeof req.query.q === "string" ? req.query.q : undefined;
    const result = await companyService.searchCompanies(query);
    res.status(HttpStatus.OK).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

/** Повертає публічну сторінку компанії за id. */
export const getPublicCompany = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = Array.isArray(req.params.companyId) ? req.params.companyId[0] : req.params.companyId;
    const { userId } = getAuth(req);
    const result = await companyService.getPublicCompany(companyId, userId);
    res.status(HttpStatus.OK).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

/** Повертає компанію поточного HR. */
export const getMyCompany = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await companyService.getMyCompany(requireClerkUserId(req));
    res.status(HttpStatus.OK).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

/** Повертає список HR поточної компанії. */
export const getMyCompanyHrs = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await companyService.getMyCompanyHrs(requireClerkUserId(req));
    res.status(HttpStatus.OK).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

/** Оновлює компанію поточного HR. */
export const updateMyCompany = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await companyService.updateMyCompany(requireClerkUserId(req), req.body);
    res.status(HttpStatus.OK).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};
