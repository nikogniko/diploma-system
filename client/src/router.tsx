import { createBrowserRouter } from "react-router-dom";
import RootLayout from "./layouts/RootLayout";
import Home from "./pages/Home";
import StudentDashboard from "./pages/student/StudentDashboard";
import HrDashboard from "./pages/hr/HrDashboard";
import AdminDashboard from "./pages/admin/AdminDashboard";
import Onboarding from "./pages/Onboarding";
import Start from "./pages/Start";
import SignUpPage from "./pages/SignUpPage";
import SignInPage from "./pages/SignInPage";
import ProtectedRoute from "./components/ProtectedRoute";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <RootLayout />,
    children: [
      { index: true, element: <Home /> },

      // Публічні маршрути для старту
      { path: "start", element: <Start /> },
      { path: "sign-up", element: <SignUpPage /> },
      { path: "sign-in", element: <SignInPage /> },

      // Захищений маршрут для завершення (вимагає тільки входу, але без ролі)
      {
        element: <ProtectedRoute />,
        children: [{ path: "onboarding", element: <Onboarding /> }],
      },

      // Зона Студента
      {
        element: <ProtectedRoute allowedRoles={["STUDENT"]} />,
        children: [{ path: "student", element: <StudentDashboard /> }],
      },

      // Зона HR
      {
        element: <ProtectedRoute allowedRoles={["HR"]} />,
        children: [{ path: "hr", element: <HrDashboard /> }],
      },

      // Зона Адміна
      {
        element: <ProtectedRoute allowedRoles={["SYS_ADMIN"]} />,
        children: [{ path: "admin", element: <AdminDashboard /> }],
      },
    ],
  },
]);
