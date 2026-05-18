import { Button, Stack, Text } from "@mantine/core";
import type { ReactNode } from "react";
import classes from "./CabinetLayout.module.scss";

type CabinetNavItem = {
  key: string;
  label: string;
  icon?: ReactNode;
  underline?: boolean;
};

type CabinetLayoutProps = {
  navItems: CabinetNavItem[];
  activeKey: string;
  onSelect: (key: string) => void;
  children: ReactNode;
};

/** Спільний layout кабінету з лівою навігацією для всіх ролей. */
export function CabinetLayout({
  navItems,
  activeKey,
  onSelect,
  children,
}: CabinetLayoutProps) {
  return (
    <main className={classes.page}>
      <aside className={classes.sidebar}>
        <Stack gap="xs">
          <Text className={classes.sidebarLabel}>Кабінет</Text>
          {navItems.map((item) => (
            <div key={item.key}>
              <Button
                className={classes.navButton}
                data-active={item.key === activeKey || undefined}
                data-underline={item.underline || undefined}
                variant="subtle"
                fullWidth
                leftSection={item.icon}
                onClick={() => onSelect(item.key)}
              >
                {item.label}
              </Button>
            </div>
          ))}
        </Stack>
      </aside>

      <section className={classes.content}>{children}</section>
    </main>
  );
}
