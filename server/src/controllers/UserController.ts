import type { NextFunction, Request, Response } from "express";
import { getAuth } from "@clerk/express";
import { UserStatus } from "../../prisma/generated/client/index.js";
import { BusinessLogicError, HttpStatus } from "../errors/BusinessLogicError.js";
import { userService } from "../services/UserService.js";

export const completeOnboarding = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { userId } = getAuth(req);

    if (!userId) {
      throw new BusinessLogicError(
        "Unauthorized. Clerk user id is missing.",
        HttpStatus.UNAUTHORIZED,
        "UNAUTHORIZED",
      );
    }

    const result = await userService.completeOnboarding(userId, req.body);

    res.status(HttpStatus.OK).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const handleClerkWebhook = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const result = await userService.handleClerkWebhook(req.body);

    res.status(HttpStatus.OK).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

/** Повертає роль і статус поточного користувача для переходу після входу. */
export const getMyAuthSnapshot = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { userId } = getAuth(req);

    if (!userId) {
      throw new BusinessLogicError(
        "Unauthorized. Clerk user id is missing.",
        HttpStatus.UNAUTHORIZED,
        "UNAUTHORIZED",
      );
    }

    const result = await userService.getMyAuthSnapshot(userId);
    res.status(HttpStatus.OK).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

export const updateUserStatus = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const rawUserId = req.params.userId;
    const userId = Array.isArray(rawUserId) ? rawUserId[0] : rawUserId;
    const { status } = req.body;
    const { userId: actorClerkUserId } = getAuth(req);

    if (!userId) {
      throw new BusinessLogicError(
        "userId route parameter is required",
        HttpStatus.BAD_REQUEST,
        "USER_ID_REQUIRED",
      );
    }

    if (!actorClerkUserId) {
      throw new BusinessLogicError(
        "Unauthorized. Clerk user id is missing.",
        HttpStatus.UNAUTHORIZED,
        "UNAUTHORIZED",
      );
    }

    const user = await userService.updateUserStatus(
      actorClerkUserId,
      userId,
      status as UserStatus,
    );

    res.status(HttpStatus.OK).json({
      success: true,
      data: user,
    });
  } catch (error) {
    next(error);
  }
};

/** Повертає публічну інформацію користувача для блоків профілів. */
export const getPublicUserInfo = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const rawUserId = req.params.userId;
    const userId = Array.isArray(rawUserId) ? rawUserId[0] : rawUserId;

    if (!userId) {
      throw new BusinessLogicError(
        "userId route parameter is required",
        HttpStatus.BAD_REQUEST,
        "USER_ID_REQUIRED",
      );
    }

    const result = await userService.getPublicUserInfo(userId);
    res.status(HttpStatus.OK).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

/** Оновлює email поточного користувача в Clerk і локальній БД. */
export const updateMyEmail = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { userId } = getAuth(req);

    if (!userId) {
      throw new BusinessLogicError(
        "Unauthorized. Clerk user id is missing.",
        HttpStatus.UNAUTHORIZED,
        "UNAUTHORIZED",
      );
    }

    const result = await userService.updateMyEmail(userId, req.body.email);
    res.status(HttpStatus.OK).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};
