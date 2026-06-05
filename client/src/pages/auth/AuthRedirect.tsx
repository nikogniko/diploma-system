import { useAuth, useUser } from "@clerk/react";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { apiRequest } from "../../api/apiClient";
import { AppLoader } from "../../components/common/AppLoader";

type UserRole = "STUDENT" | "HR" | "SYS_ADMIN";

type AuthSnapshot = {
  role: UserRole;
  status: string;
  studentProfile?: { id: string } | null;
  hrProfile?: { id: string } | null;
};

const blockedStatuses = new Set(["BLOCKED", "DELETED"]);

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
      const clerkStatus = user?.publicMetadata?.status as string | undefined;

      if (clerkStatus && blockedStatuses.has(clerkStatus)) {
        navigate("/", { replace: true });
        return;
      }

      if (clerkRole) {
        if (user?.id) localStorage.setItem(`currentRole:${user.id}`, clerkRole);
        localStorage.removeItem("intendedRole");
        navigate(cabinetPathByRole(clerkRole), { replace: true });
        return;
      }

      try {
        const token = await getToken();
        const snapshot = await apiRequest<AuthSnapshot>(
          "/users/my-cabinet/auth",
          token,
        );
        if (blockedStatuses.has(snapshot.status)) {
          navigate("/", { replace: true });
          return;
        }

        const hasCompletedProfile =
          (snapshot.role === "STUDENT" && Boolean(snapshot.studentProfile)) ||
          (snapshot.role === "HR" && Boolean(snapshot.hrProfile)) ||
          snapshot.role === "SYS_ADMIN";

        if (hasCompletedProfile) {
          if (user?.id) localStorage.setItem(`currentRole:${user.id}`, snapshot.role);
          localStorage.removeItem("intendedRole");
          navigate(cabinetPathByRole(snapshot.role), { replace: true });
          return;
        }

        navigate("/start", { replace: true });
      } catch {
        navigate("/start", { replace: true });
      }
    };

    void redirect();
  }, [getToken, isLoaded, navigate, user?.id, user?.publicMetadata?.role, user?.publicMetadata?.status]);

  return <AppLoader text="Готуємо ваш кабінет..." />;
}
