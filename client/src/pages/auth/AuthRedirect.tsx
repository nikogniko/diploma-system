import { useAuth, useUser } from "@clerk/react";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { apiRequest } from "../../api/apiClient";
import { AppLoader } from "../../components/common/AppLoader";

type UserRole = "STUDENT" | "HR" | "SYS_ADMIN";

type AuthSnapshot = {
  role: UserRole;
  status: string;
};

/** Визначає адресу кабінету за роллю користувача. */
const cabinetPathByRole = (role?: UserRole) => {
  if (role === "STUDENT") return "/student";
  if (role === "HR") return "/hr";
  if (role === "SYS_ADMIN") return "/admin";
  return "/onboarding";
};

/** Проміжна сторінка після входу: бере роль із Clerk або backend і перекидає в кабінет. */
export default function AuthRedirect() {
  const { user, isLoaded } = useUser();
  const { getToken } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoaded) return;

    const redirect = async () => {
      const clerkRole = user?.publicMetadata?.role as UserRole | undefined;
      if (clerkRole) {
        if (user?.id) localStorage.setItem(`currentRole:${user.id}`, clerkRole);
        navigate(cabinetPathByRole(clerkRole), { replace: true });
        return;
      }

      try {
        const token = await getToken();
        const snapshot = await apiRequest<AuthSnapshot>(
          "/users/my-cabinet/auth",
          token,
        );
        if (user?.id)
          localStorage.setItem(`currentRole:${user.id}`, snapshot.role);
        navigate(cabinetPathByRole(snapshot.role), { replace: true });
      } catch {
        navigate("/onboarding", { replace: true });
      }
    };

    void redirect();
  }, [getToken, isLoaded, navigate, user?.id, user?.publicMetadata?.role]);

  return <AppLoader text="Готуємо ваш кабінет..." />;
}
