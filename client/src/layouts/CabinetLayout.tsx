import { Button, Stack, Text } from "@mantine/core";
import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { messages } from "../locales/localizedMessages";
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
  defaultCollapsed?: boolean;
  autoCollapseKeys?: string[];
  collapseSignal?: number;
  storageKey?: string;
};

/** Спільний layout кабінету з лівою навігацією для всіх ролей. */
export function CabinetLayout({
  navItems,
  activeKey,
  onSelect,
  children,
  defaultCollapsed = false,
  autoCollapseKeys = [],
  collapseSignal = 0,
  storageKey,
}: CabinetLayoutProps) {
  const [isCollapsed, setIsCollapsed] = useState(() => {
    if (!storageKey || typeof window === "undefined") return defaultCollapsed;
    const stored = window.localStorage.getItem(storageKey);
    return stored === null ? defaultCollapsed : stored === "collapsed";
  });
  const previousActiveKey = useRef(activeKey);
  const previousCollapseSignal = useRef(collapseSignal);
  const ui = messages.layout.cabinet;

  useEffect(() => {
    const changed = previousActiveKey.current !== activeKey;
    const collapseRequested = previousCollapseSignal.current !== collapseSignal && collapseSignal > 0;
    previousActiveKey.current = activeKey;
    previousCollapseSignal.current = collapseSignal;
    if ((changed && autoCollapseKeys.includes(activeKey)) || collapseRequested) {
      setIsCollapsed(true);
    }
  }, [activeKey, autoCollapseKeys, collapseSignal]);

  useEffect(() => {
    if (!storageKey || typeof window === "undefined") return;
    window.localStorage.setItem(storageKey, isCollapsed ? "collapsed" : "expanded");
  }, [isCollapsed, storageKey]);

  /** Меню змінюється користувачем; для вибраних вкладок дозволене тільки одноразове автозгортання. */
  return (
    <main className={classes.page} data-collapsed={isCollapsed || undefined}>
      <aside className={classes.sidebar} data-collapsed={isCollapsed || undefined}>
        <Stack gap="xs">
          <div className={classes.sidebarHeader}>
            <Text className={classes.sidebarLabel}>{ui.label}</Text>
            <button className={classes.collapseButton} type="button" onClick={() => setIsCollapsed((value) => !value)} aria-label={isCollapsed ? ui.expand : ui.collapse}>
              {isCollapsed ? <MenuIcon /> : <CloseIcon />}
            </button>
          </div>
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
                <span className={classes.navText}>{item.label}</span>
              </Button>
            </div>
          ))}
        </Stack>
      </aside>

      <section className={classes.content}>{children}</section>
    </main>
  );
}

function MenuIcon() {
  return <svg viewBox="0 0 24 24"><path d="M4 6h16v2H4V6Zm0 5h16v2H4v-2Zm0 5h16v2H4v-2Z" /></svg>;
}

function CloseIcon() {
  return <svg viewBox="0 0 24 24"><path d="m6.4 5 5.6 5.6L17.6 5 19 6.4 13.4 12l5.6 5.6-1.4 1.4-5.6-5.6L6.4 19 5 17.6l5.6-5.6L5 6.4 6.4 5Z" /></svg>;
}
