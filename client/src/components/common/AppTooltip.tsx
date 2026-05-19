import { Tooltip } from "@mantine/core";
import type { ReactNode } from "react";
import classes from "./AppTooltip.module.scss";

type AppTooltipProps = {
  label: string;
  children: ReactNode;
};

/** Єдиний м'яко стилізований tooltip для іконкових дій інтерфейсу. */
export function AppTooltip({ label, children }: AppTooltipProps) {
  return (
    <Tooltip
      label={label}
      position="bottom"
      offset={8}
      withArrow
      openDelay={250}
      closeDelay={80}
      classNames={{ tooltip: classes.tooltip, arrow: classes.arrow }}
    >
      {children}
    </Tooltip>
  );
}
