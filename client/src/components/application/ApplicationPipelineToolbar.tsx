import { Menu } from "@mantine/core";
import { useEffect, useRef, useState } from "react";
import { messages } from "../../locales/localizedMessages";
import type { ApplicationStatus } from "./applicationTypes";
import classes from "./ApplicationPipelineToolbar.module.scss";

export type ApplicationPipelineFilter = "ALL" | ApplicationStatus;
type FilterItem = { key: ApplicationPipelineFilter; label: string };
type SortKey = "score" | "percent" | "date";

type Props = {
  counts: Record<ApplicationPipelineFilter, number>;
  selected: ApplicationPipelineFilter;
  onSelect: (filter: ApplicationPipelineFilter) => void;
  sortBy: SortKey;
  onSortChange: (sortBy: SortKey) => void;
};

const statuses: ApplicationStatus[] = ["SENT", "VIEWED", "SHORTLISTED", "INTERVIEW_INVITED", "OFFERED", "HIRED", "REJECTED", "WITHDRAWN"];

/** Показує спільну адаптивну панель фільтрів і сортування applications. */
export function ApplicationPipelineToolbar({ counts, selected, onSelect, sortBy, onSortChange }: Props) {
  const ui = messages.applicationModule;
  const filters: FilterItem[] = [
    { key: "ALL", label: ui.filters.all },
    ...statuses.map((status) => ({ key: status, label: ui.statuses[status] })),
  ];
  const containerRef = useRef<HTMLDivElement | null>(null);
  const measureRef = useRef<HTMLDivElement | null>(null);
  const [visibleCount, setVisibleCount] = useState(filters.length);

  useEffect(() => {
    const container = containerRef.current;
    const measurement = measureRef.current;
    if (!container || !measurement) return;

    /** Обчислює число статусів, які вміщуються перед overflow-кнопкою. */
    const updateVisibleCount = () => {
      const widths = Array.from(measurement.querySelectorAll<HTMLElement>("[data-filter-measure]"))
        .map((element) => element.offsetWidth);
      const gap = 4;
      const overflowWidth = 42;
      const available = container.clientWidth;
      const total = widths.reduce((sum, width) => sum + width, 0) + gap * Math.max(0, widths.length - 1);
      if (total <= available) {
        setVisibleCount(widths.length);
        return;
      }
      let occupied = overflowWidth;
      let count = 0;
      widths.forEach((width) => {
        if (occupied + gap + width <= available) {
          occupied += gap + width;
          count += 1;
        }
      });
      setVisibleCount(Math.max(1, count));
    };

    updateVisibleCount();
    const observer = new ResizeObserver(updateVisibleCount);
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  const visible = filters.slice(0, visibleCount);
  const overflow = filters.slice(visibleCount);

  return <div className={classes.toolbar}>
    <div className={classes.viewport} ref={containerRef}>
      <div aria-hidden="true" className={classes.measurement} ref={measureRef}>
        {filters.map((filter) => <FilterButton count={counts[filter.key]} filter={filter} key={filter.key} measure />)}
      </div>
      <div className={classes.tabs}>
        {visible.map((filter) => (
          <FilterButton active={selected === filter.key} count={counts[filter.key]} filter={filter} key={filter.key} onClick={() => onSelect(filter.key)} />
        ))}
        {overflow.length > 0 && <Menu position="bottom-end" shadow="md" width={230}>
          <Menu.Target>
            <button aria-label={ui.filters.moreStatuses} className={classes.iconButton} type="button"><MoreIcon /></button>
          </Menu.Target>
          <Menu.Dropdown>
            {overflow.map((filter) => (
              <Menu.Item key={filter.key} onClick={() => onSelect(filter.key)}>
                {selected === filter.key ? "✓ " : ""}{filter.label} ({counts[filter.key]})
              </Menu.Item>
            ))}
          </Menu.Dropdown>
        </Menu>}
      </div>
    </div>
    <Menu position="bottom-end" shadow="md" width={235}>
      <Menu.Target>
        <button aria-label={ui.filters.sortLabel} className={classes.sortButton} type="button"><SortIcon /></button>
      </Menu.Target>
      <Menu.Dropdown>
        {([
          { value: "score", label: ui.filters.sortScore },
          { value: "percent", label: ui.filters.sortPercent },
          { value: "date", label: ui.filters.sortDate },
        ] as Array<{ value: SortKey; label: string }>).map((option) => (
          <Menu.Item key={option.value} onClick={() => onSortChange(option.value)}>
            {sortBy === option.value ? "✓ " : ""}{option.label}
          </Menu.Item>
        ))}
      </Menu.Dropdown>
    </Menu>
  </div>;
}

/** Виводить округлу плашку одного статусу з його кількістю. */
function FilterButton({ filter, count, active = false, measure = false, onClick }: {
  filter: FilterItem;
  count: number;
  active?: boolean;
  measure?: boolean;
  onClick?: () => void;
}) {
  return <button
    className={active ? classes.tabActive : classes.tab}
    data-filter-measure={measure || undefined}
    data-status={filter.key}
    onClick={onClick}
    tabIndex={measure ? -1 : undefined}
    type="button"
  >
    {filter.label}<span>{count}</span>
  </button>;
}

/** Малює іконку меню додаткових статусів. */
function MoreIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 10a2 2 0 1 0 0 4 2 2 0 0 0 0-4Zm7 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4Zm7 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z" /></svg>;
}

/** Малює іконку відкриття сортування applications. */
function SortIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4h2v12.17l2.59-2.58L13 15l-5 5-5-5 1.41-1.41L7 16.17V4Zm10 16h-2V7.83l-2.59 2.58L11 9l5-5 5 5-1.41 1.41L17 7.83V20Z" /></svg>;
}
