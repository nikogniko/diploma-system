import { Paper, Text, Title } from "@mantine/core";
import type { ReactNode } from "react";
import { NoticeBanner } from "../common/NoticeBanner";
import classes from "./AuthShell.module.scss";

type AuthShellProps = {
  title: string;
  subtitle: string;
  note?: string | null;
  tone?: "info" | "warning";
  children: ReactNode;
};

/** Єдиний візуальний контейнер для входу, реєстрації та onboarding. */
export function AuthShell({ title, subtitle, note, tone = "info", children }: AuthShellProps) {
  return (
    <main className={classes.page}>
      <section className={classes.hero}>
        <Text className={classes.eyebrow}>UniJob.ua</Text>
        <Title className={classes.title}>{title}</Title>
        <Text className={classes.subtitle}>{subtitle}</Text>
      </section>
      <Paper className={classes.panel}>
        <NoticeBanner tone={tone} message={note ?? null} />
        {children}
      </Paper>
    </main>
  );
}
