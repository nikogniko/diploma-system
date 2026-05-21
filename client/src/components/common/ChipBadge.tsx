import type { ReactNode } from "react";
import classes from "./ChipBadge.module.scss";

type ChipTone = "primary" | "hard" | "soft" | "tools" | "critical" | "important" | "plus" | "language" | "sphere" | "location";

type ChipBadgeProps = {
  children: ReactNode;
  tone?: ChipTone;
  onClick?: () => void;
  onRemove?: () => void;
};

/** Уніфікована плашка для навичок, мов, сфер, локацій та інших коротких тегів. */
export function ChipBadge({ children, tone = "primary", onClick, onRemove }: ChipBadgeProps) {
  const content = (
    <>
      {children}
      {onRemove && (
        <button
          type="button"
          className={classes.close}
          onClick={(event) => {
            event.stopPropagation();
            onRemove();
          }}
          aria-label="Видалити"
        >
          ×
        </button>
      )}
    </>
  );

  if (onClick) {
    return <button type="button" className={`${classes.chip} ${classes.button} ${classes[tone]}`} onClick={onClick}>{content}</button>;
  }

  return <span className={`${classes.chip} ${classes[tone]}`}>{content}</span>;
}
