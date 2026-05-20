import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { clerkMiddleware } from "@clerk/express";
import userRoutes from "./routes/authRoutes.js";
import studentProfileRoutes from "./routes/studentProfileRoutes.js";
import companyRoutes from "./routes/companyRoutes.js";
import hrProfileRoutes from "./routes/hrProfileRoutes.js";
import catalogRoutes from "./routes/catalogRoutes.js";
import vacancyRoutes from "./routes/vacancyRoutes.js";
import { BusinessLogicError, HttpStatus } from "./errors/BusinessLogicError.js";
import { Prisma } from "../prisma/generated/client/index.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// 1. Налаштування проміжного ПЗ
app.use(cors());
app.use(express.json());

// 2. Глобальний middleware Clerk.
// Він розшифровує токен
app.use(clerkMiddleware());

// Тестовий роут залишаємо для перевірки, чи живий сервер
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", message: "UniJob API is running" });
});

// 3. Підключаємо всі маршрути користувачів, які лежать у userRoutes
app.use("/api/users", userRoutes);
app.use("/api/students", studentProfileRoutes);
app.use("/api/companies", companyRoutes);
app.use("/api/hr-profiles", hrProfileRoutes);
app.use("/api/catalogs", catalogRoutes);
app.use("/api/vacancies", vacancyRoutes);

app.use(
  (
    error: unknown,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction,
  ) => {
    if (res.headersSent) {
      next(error);
      return;
    }

    if (error instanceof BusinessLogicError) {
      res.status(error.statusCode).json({
        success: false,
        error: {
          code: error.code,
          message: error.message,
          details: error.details,
        },
      });
      return;
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        res.status(HttpStatus.CONFLICT).json({
          success: false,
          error: {
            code: "UNIQUE_CONSTRAINT_VIOLATION",
            message: "A record with this unique field already exists",
            details: error.meta,
          },
        });
        return;
      }

      if (error.code === "P2025") {
        res.status(HttpStatus.NOT_FOUND).json({
          success: false,
          error: {
            code: "RECORD_NOT_FOUND",
            message: "Requested record was not found",
            details: error.meta,
          },
        });
        return;
      }
    }

    console.error("Unhandled server error", error);
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Internal server error",
      },
    });
  },
);

app.listen(PORT, () => {
  console.log(`🚀 Сервер UniJob запущено на http://localhost:${PORT}`);
});
