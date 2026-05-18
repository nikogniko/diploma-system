import { Paper, Stack, Text, Title } from "@mantine/core";
import type { ReactNode } from "react";
import classes from "./FormSection.module.scss";

type FormSectionProps = {
  title: string;
  description?: string;
  children: ReactNode;
};

/** Уніфікований контейнер для форм реєстрації та блоків кабінету. */
export function FormSection({ title, description, children }: FormSectionProps) {
  return (
    <Paper className={classes.section}>
      <Stack gap="md">
        <div>
          <Title order={2} className={classes.title}>
            {title}
          </Title>
          {description && (
            <Text size="sm" className={classes.description}>
              {description}
            </Text>
          )}
        </div>
        {children}
      </Stack>
    </Paper>
  );
}
