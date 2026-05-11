import { useUser } from "@clerk/react";
import { Navigate, Outlet, useLocation } from "react-router-dom";

// Типізуємо можливі ролі, які ми визначили в БД
type AllowedRoles = "STUDENT" | "HR" | "SYS_ADMIN";

interface ProtectedRouteProps {
  allowedRoles?: AllowedRoles[];
}

export default function ProtectedRoute({ allowedRoles }: ProtectedRouteProps) {
  const { isLoaded, isSignedIn, user } = useUser();
  const location = useLocation();

  // 1. Поки Clerk завантажує дані, показуємо лоадер
  if (!isLoaded) {
    return (
      <div style={{ padding: "2rem", textAlign: "center" }}>
        Завантаження системи безпеки...
      </div>
    );
  }

  // 2. Якщо не авторизований - відправляємо на головну
  if (!isSignedIn) {
    return <Navigate to="/" replace />;
  }

  // Отримуємо роль з Clerk (вона з'явиться там після етапу Onboarding)
  const userRole = user?.publicMetadata?.role as AllowedRoles | undefined;

  // 3. Якщо ролі ще немає, і ми НЕ на сторінці onboarding - примусово туди відправляємо
  if (!userRole && location.pathname !== "/onboarding") {
    return <Navigate to="/onboarding" replace />;
  }

  // 4. Якщо сторінка вимагає певних ролей, а в юзера її немає або вона інша
  if (allowedRoles && userRole && !allowedRoles.includes(userRole)) {
    // Відправляємо його у свій кабінет
    if (userRole === "STUDENT") return <Navigate to="/student" replace />;
    if (userRole === "HR") return <Navigate to="/hr" replace />;
    return <Navigate to="/" replace />;
  }

  // 5. Якщо всі перевірки пройдені - рендеримо дочірні маршрути
  return <Outlet />;
}
