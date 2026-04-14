import express from "express";
import cors from "cors";
import "dotenv/config";

// Ініціалізація сервера
const app = express();
const PORT = process.env.PORT || 5000;

// Middleware (проміжні обробники)
app.use(cors()); // Дозволяє запити з інших доменів (від React)
app.use(express.json()); // Дозволяє серверу читати JSON з тіла запиту

// Тестовий маршрут (ендпоінт)
app.get("/api", (req, res) => {
  res.status(200).json({
    status: "success",
    message: "Сервер для диплома успішно працює!",
    timestamp: new Date().toISOString(),
  });
});

// Запуск сервера
app.listen(PORT, () => {
  console.log(`🚀 Сервер запущено на http://localhost:${PORT}`);
});
