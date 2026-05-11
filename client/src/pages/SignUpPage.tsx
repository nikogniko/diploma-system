import { SignUp } from "@clerk/react";

export default function SignUpPage() {
  // Читаємо значення синхронно прямо під час рендеру. Без стейту і ефектів.
  const role =
    typeof window !== "undefined" ? localStorage.getItem("intendedRole") : null;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        marginTop: "2rem",
      }}
    >
      {role === "STUDENT" && (
        <div
          style={{
            maxWidth: "400px",
            padding: "1rem",
            backgroundColor: "#fee2e2",
            color: "#dc2626",
            borderRadius: "8px",
            marginBottom: "1rem",
            textAlign: "center",
            border: "1px solid #f87171",
          }}
        >
          <strong>Важливо:</strong> Для студентів доступна реєстрація{" "}
          <u>виключно</u> за корпоративною поштою вашого університету (домен{" "}
          <b>.edu.ua</b>). Звичайні пошти (напр. Gmail) будуть відхилені
          системою.
        </div>
      )}

      {role === "HR" && (
        <div
          style={{
            maxWidth: "400px",
            padding: "1rem",
            backgroundColor: "#e0f2fe",
            color: "#0369a1",
            borderRadius: "8px",
            marginBottom: "1rem",
            textAlign: "center",
            border: "1px solid #7dd3fc",
          }}
        >
          Реєстрація профілю роботодавця. На наступному кроці вам потрібно буде
          вказати дані вашої компанії (ЄДРПОУ).
        </div>
      )}

      <SignUp signInUrl="/sign-in" fallbackRedirectUrl="/onboarding" />
    </div>
  );
}
