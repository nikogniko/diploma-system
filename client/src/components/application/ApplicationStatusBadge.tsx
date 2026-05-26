import { messages } from "../../locales/localizedMessages";
import type { ApplicationStatus } from "./applicationTypes";
import classes from "./ApplicationStatusBadge.module.scss";

type Props = {
  status: ApplicationStatus;
};

/** Показує уніфіковану кольорову плашку статусу application. */
export function ApplicationStatusBadge({ status }: Props) {
  return <span className={classes.badge} data-status={status}>{messages.applicationModule.statuses[status]}</span>;
}
