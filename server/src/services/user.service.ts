import { clerkClient } from "@clerk/express";
import { UserRole, UserStatus } from "@prisma/client";
import { prisma } from "../config/db.js";

export const onboardUser = async (
  clerkUserId: string,
  email: string,
  role: UserRole,
  firstName?: string,
  lastName?: string,
) => {
  await prisma.$transaction(async (tx) => {
    // 1. Створюємо базового користувача
    const newUser = await tx.user.create({
      data: {
        clerkUserId,
        email,
        role,
        firstName: firstName || "",
        lastName: lastName || "",
        status:
          role === "HR" ? UserStatus.PENDING_VERIFICATION : UserStatus.ACTIVE,
      },
    });

    // 2. Якщо це студент, створюємо йому порожній профіль
    if (role === "STUDENT") {
      await tx.studentProfile.create({
        data: {
          userId: newUser.id,
          contactEmail: email,
          primaryPhone: "",
          birthDate: new Date("2000-01-01"), // Тимчасова заглушка
          isActiveSearch: true,
        },
      });
    }
  });

  // 3. Синхронізуємо роль з Clerk
  await clerkClient.users.updateUserMetadata(clerkUserId, {
    publicMetadata: { role, onboardingComplete: true },
  });
};
