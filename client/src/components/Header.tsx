import { Link } from "react-router-dom";
import { UserButton, useUser } from "@clerk/react";
import classes from "./Header.module.scss";

export default function Header() {
  const { isSignedIn, user } = useUser();
  const role = user?.publicMetadata?.role as string | undefined;

  return (
    <header className={classes.header}>
      <nav className={classes.nav}>
        <Link to="/">Головна</Link>

        {role === "STUDENT" && <Link to="/student">Кабінет Студента</Link>}
        {role === "HR" && <Link to="/hr">Кабінет HR</Link>}
        {role === "SYS_ADMIN" && <Link to="/admin">Панель Адміністратора</Link>}
      </nav>

      <div className={classes.authActions}>
        {!isSignedIn ? (
          <>
            <Link to="/start" className={classes.signUpBtn}>
              Реєстрація
            </Link>{" "}
          </>
        ) : (
          <UserButton />
        )}
      </div>
    </header>
  );
}
