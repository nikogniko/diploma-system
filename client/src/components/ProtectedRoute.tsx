import { useUser } from "@clerk/react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { AppLoader } from "./common/AppLoader";

type AllowedRoles = "STUDENT" | "HR" | "SYS_ADMIN";

interface ProtectedRouteProps {
  allowedRoles?: AllowedRoles[];
}

/** Захищає приватні сторінки та спрямовує користувача до кабінету його ролі. */
export default function ProtectedRoute({ allowedRoles }: ProtectedRouteProps) {
  const { isLoaded, isSignedIn, user } = useUser();
  const location = useLocation();

  if (!isLoaded) {
    return <AppLoader text="Відчиняємо двері кабінету..." />;
  }

  if (!isSignedIn) {
    return <Navigate to="/" replace />;
  }

  const localRole =
    typeof window !== "undefined" && user?.id
      ? (localStorage.getItem(`currentRole:${user.id}`) as AllowedRoles | null)
      : null;
  const userRole =
    (user?.publicMetadata?.role as AllowedRoles | undefined) ?? localRole ?? undefined;

  if (
    !userRole &&
    location.pathname !== "/onboarding" &&
    location.pathname !== "/auth/redirect"
  ) {
    return <Navigate to="/onboarding" replace />;
  }

  if (allowedRoles && userRole && !allowedRoles.includes(userRole)) {
    if (userRole === "STUDENT") return <Navigate to="/student" replace />;
    if (userRole === "HR") return <Navigate to="/hr" replace />;
    if (userRole === "SYS_ADMIN") return <Navigate to="/admin" replace />;
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
