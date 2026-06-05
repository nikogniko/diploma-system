import { Outlet } from "react-router-dom";
import Header from "../components/common/Header";
import { ClerkProfileSync } from "../components/auth/ClerkProfileSync";
import classes from "./RootLayout.module.scss";

export default function RootLayout() {
  return (
    <div className={classes.shell}>
      <ClerkProfileSync />
      <Header />
      <main className={classes.main}>
        <Outlet />
      </main>
    </div>
  );
}
