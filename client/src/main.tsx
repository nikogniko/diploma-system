import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ClerkProvider } from "@clerk/react";
import { ukUA } from "@clerk/localizations";
import { MantineProvider, createTheme } from "@mantine/core";
import "@fontsource-variable/manrope/index.css";
import "@mantine/core/styles.css";
import "@mantine/dates/styles.css";
import "dayjs/locale/uk";
import "./styles/global.scss";
import App from "./App.tsx";

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

if (!PUBLISHABLE_KEY) {
  throw new Error("Missing Publishable Key");
}

const theme = createTheme({
  fontFamily: "Manrope Variable, Manrope, Inter, system-ui, sans-serif",
  primaryColor: "violet",
  defaultRadius: "md",
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ClerkProvider
      localization={ukUA}
      publishableKey={PUBLISHABLE_KEY}
      afterSignOutUrl="/"
    >
      <MantineProvider theme={theme}>
        <App />
      </MantineProvider>
    </ClerkProvider>
  </StrictMode>,
);
