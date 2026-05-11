import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { clerkMiddleware } from "@clerk/express";
import userRoutes from "./routes/auth.routes.js";

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

app.listen(PORT, () => {
  console.log(`🚀 Сервер UniJob запущено на http://localhost:${PORT}`);
});
