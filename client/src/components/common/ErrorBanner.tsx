import { Alert, Text } from "@mantine/core";
import classes from "./ErrorBanner.module.scss";

type ErrorBannerProps = {
  title?: string;
  message: string | null;
};

/** Показує зрозумілу помилку API або валідації на сторінці. */
export function ErrorBanner({ title = "Не вдалося виконати дію", message }: ErrorBannerProps) {
  if (!message) return null;

  return (
    <Alert className={classes.alert} title={title}>
      <Text size="sm">{message}</Text>
    </Alert>
  );
}
