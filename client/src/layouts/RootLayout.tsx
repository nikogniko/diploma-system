import { Outlet } from "react-router-dom";
import Header from "../components/Header";
import classes from "./RootLayout.module.scss";

export default function RootLayout() {
  return (
    <div className={classes.shell}>
      <Header />
      <main className={classes.main}>
        <Outlet />
      </main>
    </div>
  );
}
