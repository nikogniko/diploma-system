import { SignIn } from "@clerk/react";
import { AuthShell } from "../../components/auth/AuthShell";

/** Сторінка входу з єдиним оформленням auth-флоу. */
export default function SignInPage() {
  const role =
    typeof window !== "undefined" ? localStorage.getItem("intendedRole") : null;

  const isEmployer = role === "HR";

  return (
    <AuthShell
      title={
        isEmployer
          ? "Поверніться до кабінету роботодавця"
          : "Поверніться до свого кар'єрного простору"
      }
      subtitle={
        isEmployer
          ? "Увійдіть, щоб працювати з профілем компанії, вакансіями та відгуками кандидатів."
          : "Увійдіть, щоб продовжити профіль, відстежувати відгуки та бачити персональні можливості."
      }
      note={
        role === "STUDENT"
          ? "Для кандидатів доступ дозволений лише з корпоративної пошти навчального закладу."
          : null
      }
    >
      <SignIn
        signUpUrl="/sign-up"
        fallbackRedirectUrl="/auth/redirect"
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
