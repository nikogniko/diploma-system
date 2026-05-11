import { Request, Response } from "express";
import { getAuth } from "@clerk/express";
import * as userService from "../services/user.service.js";
import { UserRole } from "@prisma/client";

export const completeOnboarding = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    // Використовуємо офіційний хелпер замість req.auth
    const auth = getAuth(req);
    const userId = auth.userId;

    if (!userId) {
      res.status(401).json({ error: "Неавторизовано. Токен відсутній." });
      return;
    }

    const { role, email, firstName, lastName } = req.body;

    if (!role || !email) {
      res
        .status(400)
        .json({ error: "Недостатньо даних для завершення реєстрації" });
      return;
    }

    // Передаємо дані в сервіс
    await userService.onboardUser(
      userId,
      email,
      role as UserRole,
      firstName,
      lastName,
    );

    res
      .status(200)
      .json({ success: true, message: "Профіль успішно створено" });
  } catch (error) {
    console.error("Помилка в контролері Onboarding:", error);
    res.status(500).json({ error: "Внутрішня помилка сервера" });
  }
};
