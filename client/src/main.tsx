import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles/global.scss";
import App from "./App.tsx";
import { ClerkProvider } from "@clerk/react";
import { ukUA } from "@clerk/localizations"; // 1. Імпортуємо українську локалізацію

// Зчитуємо ключ з нашого .env.local файлу
const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

// Захист від помилок: якщо забули додати ключ, додаток не запуститься
if (!PUBLISHABLE_KEY) {
  throw new Error("Missing Publishable Key");
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ClerkProvider
      localization={ukUA}
      publishableKey={PUBLISHABLE_KEY}
      afterSignOutUrl="/"
      //signInFallbackRedirectUrl="/onboarding" //- якщо захочеш глобально всі входи направляти туди
    >
      <App />
    </ClerkProvider>
  </StrictMode>,
);
