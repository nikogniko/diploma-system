import { SignIn } from "@clerk/react";

export default function SignInPage() {
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
          <strong>Вхід для студентів:</strong> Використовуйте <u>тільки</u>{" "}
          корпоративну пошту (<b>.edu.ua</b>).
        </div>
      )}

      {/* Кажемо віджету: якщо тиснуть "Зареєструватись", йди на наш кастомний роут */}
      <SignIn signUpUrl="/sign-up" fallbackRedirectUrl="/onboarding" />
    </div>
  );
}
