import { getAuth } from "@clerk/express";
import type { NextFunction, Request, Response } from "express";
import { BusinessLogicError, HttpStatus } from "../errors/BusinessLogicError.js";
import { hrProfileService } from "../services/HrProfileService.js";

/** Витягує Clerk user id з авторизованого запиту рекрутера. */
const requireHrActorId = (req: Request) => {
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

/** Повертає HR профіль поточного рекрутера. */
export const getMyHrProfile = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await hrProfileService.getMyHrProfile(requireHrActorId(req));
    res.status(HttpStatus.OK).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

/** Оновлює HR профіль поточного рекрутера. */
export const updateMyHrProfile = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await hrProfileService.updateMyHrProfile(requireHrActorId(req), req.body);
    res.status(HttpStatus.OK).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};
