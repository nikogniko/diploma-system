import { SignUp } from "@clerk/react";
import { AuthShell } from "../../components/auth/AuthShell";

/** Сторінка реєстрації з підказками для кандидатів і роботодавців. */
export default function SignUpPage() {
  const role =
    typeof window !== "undefined" ? localStorage.getItem("intendedRole") : null;

  const isEmployer = role === "HR";

  return (
    <AuthShell
      title={
        isEmployer
          ? "Створіть профіль роботодавця"
          : "Створіть профіль кандидата"
      }
      subtitle={
        isEmployer
          ? "Після реєстрації ви зможете прив'язати або додати компанію, заповнити профіль і підготувати основу для вакансій."
          : "Після реєстрації ми допоможемо зібрати профіль, який покаже ваші навички, освіту та проєкти роботодавцям."
      }
      note={
        role === "STUDENT"
          ? "Кандидатам потрібно реєструватися через корпоративну пошту навчального закладу."
          : role === "HR"
            ? "Після створення акаунта потрібно буде обрати наявну компанію або додати нову."
            : null
      }
      tone={role === "STUDENT" ? "warning" : "info"}
    >
      <SignUp
        signInUrl="/sign-in"
        fallbackRedirectUrl="/onboarding"
        appearance={{
          variables: {
            colorPrimary: "var(--color-primary)",
            borderRadius: "var(--radius-md)",
          },
        }}
      />
    </AuthShell>
  );
}
