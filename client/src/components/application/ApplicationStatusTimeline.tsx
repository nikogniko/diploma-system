import { Button, Select, Text } from "@mantine/core";
import { type ReactNode, useState } from "react";
import { messages } from "../../locales/localizedMessages";
import { ApplicationStatusBadge } from "./ApplicationStatusBadge";
import type { ApplicationHistoryItem, ApplicationStatus } from "./applicationTypes";
import classes from "./ApplicationStatusTimeline.module.scss";

type Props = {
  currentStatus: ApplicationStatus;
  statusHistory: ApplicationHistoryItem[];
  variant: "student" | "hr";
  onStatusChange?: (status: ApplicationStatus) => void;
  onReject?: () => void;
  saving?: boolean;
  actions?: ReactNode;
};

type ProcessStatus = Exclude<ApplicationStatus, "REJECTED" | "WITHDRAWN">;

const flow: ProcessStatus[] = ["SENT", "VIEWED", "SHORTLISTED", "INTERVIEW_INVITED", "OFFERED", "HIRED"];

/** Показує останній перехід та розгортану компактну історію руху application. */
export function ApplicationStatusTimeline({ currentStatus, statusHistory, variant, onStatusChange, onReject, saving = false, actions }: Props) {
  const ui = messages.applicationModule;
  const [expanded, setExpanded] = useState(variant === "student");
  const reachedStatus = terminalBaseStatus(currentStatus, statusHistory);
  const reachedIndex = flow.indexOf(reachedStatus);
  const latest = statusHistory[statusHistory.length - 1];
  const achievedStatuses = new Set(statusHistory.map((event) => event.toStatus));
  const transitionOptions = allowedHrTransitions(currentStatus).map((status) => ({
    value: status,
    label: ui.statuses[status],
  }));

  return <section className={classes.timeline} data-variant={variant}>
    <div className={classes.header}>
      <Text size="sm">
        <strong>{ui.timeline.lastUpdate}:</strong>{" "}
        {latest ? `${transitionLabel(latest)}; ${formatDate(latest.createdAt)}` : ui.timeline.noHistory}
      </Text>
      <button className={classes.toggle} type="button" onClick={() => setExpanded((current) => !current)}>
        {expanded ? ui.timeline.hideHistory : ui.timeline.showHistory}
      </button>
    </div>
    {expanded && <>
      <Text fw={900}>{ui.timeline.title}</Text>
      <div className={classes.steps}>
        {flow.map((status, index) => {
          const state = currentStatus === status
            ? "active"
            : achievedStatuses.has(status)
              ? "completed"
              : index < reachedIndex
                ? "skipped"
                : "pending";
          return <div className={classes.step} data-state={state} key={status}>
            <span>{index + 1}</span>
            <small>{ui.timeline.shortStatuses[status]}</small>
          </div>;
        })}
      </div>
      {(currentStatus === "REJECTED" || currentStatus === "WITHDRAWN") && (
        <div className={classes.terminal}><ApplicationStatusBadge status={currentStatus} /></div>
      )}
      {variant === "hr" && onStatusChange && transitionOptions.length > 0 && (
        <div className={classes.statusControl}>
          <Text fw={800} size="sm">{ui.timeline.changeStatus}</Text>
          <Select
            data={transitionOptions}
            disabled={saving}
            onChange={(status) => status && onStatusChange(status as ApplicationStatus)}
            placeholder={ui.timeline.selectNextStatus}
            value={null}
          />
        </div>
      )}
      {variant === "hr" && onReject && !["HIRED", "REJECTED", "WITHDRAWN"].includes(currentStatus) && (
        <Button color="red" size="xs" variant="light" onClick={onReject}>{ui.hr.reject}</Button>
      )}
      {actions && <div className={classes.actions}>{actions}</div>}
      <div className={classes.history}>
        {statusHistory.map((event) => <div className={classes.historyItem} key={event.id}>
          <Text size="sm">{formatDate(event.createdAt)}</Text>
          <Text size="sm" fw={700}>{transitionLabel(event)}</Text>
          {event.changedByUser && <Text size="xs">{ui.timeline.changedBy} {userName(event.changedByUser)}</Text>}
        </div>)}
      </div>
    </>}
  </section>;
}

/** Повертає дозволені HR переходи вперед та можливість відхилити кандидата. */
function allowedHrTransitions(status: ApplicationStatus): ApplicationStatus[] {
  if (status === "HIRED" || status === "REJECTED" || status === "WITHDRAWN") return [];
  const currentIndex = flow.indexOf(status as ProcessStatus);
  return [...flow.slice(currentIndex + 1)];
}

/** Повертає останній процесний крок перед terminal-статусом. */
function terminalBaseStatus(status: ApplicationStatus, history: ApplicationHistoryItem[]): ProcessStatus {
  if (status !== "REJECTED" && status !== "WITHDRAWN") return status;
  return [...history].reverse().map((item) => item.fromStatus).find((item): item is ProcessStatus =>
    Boolean(item && (flow as readonly ApplicationStatus[]).includes(item))) ?? "SENT";
}

/** Формує читабельний підпис переходу статусу. */
function transitionLabel(event: ApplicationHistoryItem) {
  const ui = messages.applicationModule;
  return `${event.fromStatus ? ui.statuses[event.fromStatus] : ui.timeline.created} -> ${ui.statuses[event.toStatus]}`;
}

/** Форматує дату history у локальному форматі інтерфейсу. */
function formatDate(value: string) {
  return new Date(value).toLocaleString("uk-UA");
}

/** Формує відображуване ім'я автора переходу статусу. */
function userName(user: NonNullable<ApplicationHistoryItem["changedByUser"]>) {
  return [user.lastName, user.firstName, user.middleName].filter(Boolean).join(" ");
}
