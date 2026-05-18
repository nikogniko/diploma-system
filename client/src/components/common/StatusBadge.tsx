import classes from "./StatusBadge.module.scss";

type UserStatus = "PENDING_VERIFICATION" | "ACTIVE" | "BLOCKED" | "DELETED" | string;

type StatusBadgeProps = {
  status?: UserStatus;
};

const statusText: Record<string, string> = {
  PENDING_VERIFICATION: "Очікує перевірки",
  ACTIVE: "Активний",
  BLOCKED: "Заблокований",
  DELETED: "Видалений",
};

/** Показує статус акаунта однаково в усіх профілях користувачів. */
export function StatusBadge({ status = "PENDING_VERIFICATION" }: StatusBadgeProps) {
  return (
    <span className={classes.badge} data-status={status}>
      {statusText[status] ?? status}
    </span>
  );
}
