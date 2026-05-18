import { Text } from "@mantine/core";
import classes from "./NoticeBanner.module.scss";

type NoticeBannerProps = {
  message: string | null;
  tone?: "info" | "warning" | "error";
};

const icons = {
  info: "i",
  warning: "!",
  error: "!",
};

/** Показує коротку підказку або попередження з м'яким кольоровим акцентом. */
export function NoticeBanner({ message, tone = "info" }: NoticeBannerProps) {
  if (!message) return null;

  return (
    <div className={classes.notice} data-tone={tone}>
      <span className={classes.icon}>{icons[tone]}</span>
      <Text size="sm" className={classes.text}>
        {message}
      </Text>
    </div>
  );
}
