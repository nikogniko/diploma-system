import { UserButton, useUser } from "@clerk/react";
import { Link, NavLink } from "react-router-dom";
import classes from "./Header.module.scss";

/** Верхня навігація сайту з лого, вакансіями та переходом у кабінет. */
export default function Header() {
  const { isSignedIn, user } = useUser();
  const role = user?.publicMetadata?.role as string | undefined;
  const cabinetPath =
    role === "HR" ? "/hr" : role === "SYS_ADMIN" ? "/admin" : "/student";

  return (
    <header className={classes.header}>
      <Link to="/" className={classes.logo}>
        UniJob.ua
      </Link>

      <nav className={classes.nav}>
        <NavLink to="/vacancies" className={classes.navLink}>
          Вакансії
        </NavLink>
        {isSignedIn && (
          <NavLink to={cabinetPath} className={classes.navLink}>
            Кабінет
          </NavLink>
        )}
        {!isSignedIn ? (
          <Link to="/sign-in" className={classes.signUpBtn}>
            Увійти
          </Link>
        ) : (
          <UserButton />
        )}
      </nav>
    </header>
  );
}
