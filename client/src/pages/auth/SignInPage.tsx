import { SignIn } from "@clerk/react";
import { AuthShell } from "../../components/auth/AuthShell";

/** Сторінка входу з єдиним оформленням auth-флоу. */
export default function SignInPage() {
  return (
    <AuthShell
      title="Платформа для студентів та роботодавців"
      subtitle="Створюйте профілі, вказуйте компетенції, знаходьте релевантні вакансії чи кандидатів для своєї команди, переглядайте зручну аналітику. Увійдіть, щоб перейти до свого робочого простору."
    >
      <SignIn
        signUpUrl="/start"
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
