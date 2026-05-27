import { createBrowserRouter } from "react-router-dom";
import RootLayout from "./layouts/RootLayout";
import Home from "./pages/home/Home";
import StudentDashboard from "./pages/student/StudentDashboard";
import HrDashboard from "./pages/hr/HrDashboard";
//import AdminDashboard from "./pages/admin/AdminDashboard";
import Onboarding from "./pages/auth/Onboarding";
import Start from "./pages/auth/Start";
import SignUpPage from "./pages/auth/SignUpPage";
import SignInPage from "./pages/auth/SignInPage";
import AuthRedirect from "./pages/auth/AuthRedirect";
import VacanciesPage from "./pages/vacancies/VacanciesPage";
import CompanyPublicPage from "./pages/companies/CompanyPublicPage";
import ProtectedRoute from "./components/auth/ProtectedRoute";

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
      { path: "vacancies", element: <VacanciesPage /> },
      { path: "vacancies/:vacancyId", element: <VacanciesPage /> },
      { path: "companies/:companyId", element: <CompanyPublicPage /> },

      // Захищений маршрут для завершення (вимагає тільки входу, але без ролі)
      {
        element: <ProtectedRoute />,
        children: [
          { path: "onboarding", element: <Onboarding /> },
          { path: "auth/redirect", element: <AuthRedirect /> },
        ],
      },

      // Зона Студента
      {
        element: <ProtectedRoute allowedRoles={["STUDENT"]} />,
        children: [{ path: "student", element: <StudentDashboard /> }],
      },

      // Зона HR
      {
        element: <ProtectedRoute allowedRoles={["HR"]} />,
        children: [
          { path: "hr", element: <HrDashboard /> },
          { path: "hr/vacancies", element: <HrDashboard /> },
          { path: "hr/vacancies/new", element: <HrDashboard /> },
          { path: "hr/vacancies/:vacancyId/:view", element: <HrDashboard /> },
          { path: "hr/profile", element: <HrDashboard /> },
          { path: "hr/company", element: <HrDashboard /> },
        ],
      },

      // Зона Адміна
      // {
      //   element: <ProtectedRoute allowedRoles={["SYS_ADMIN"]} />,
      //   children: [{ path: "admin", element: <AdminDashboard /> }],
      // },
    ],
  },
]);
