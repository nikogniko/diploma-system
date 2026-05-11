import { Outlet } from "react-router-dom";
import Header from "../components/Header";

export default function RootLayout() {
  return (
    <>
      <Header />
      <main style={{ padding: "2rem", maxWidth: "1200px", margin: "0 auto" }}>
        <Outlet />
      </main>
    </>
  );
}
