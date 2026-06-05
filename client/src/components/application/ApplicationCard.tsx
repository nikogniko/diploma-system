import { Text } from "@mantine/core";
import type { ReactNode } from "react";
import { ApplicationStatusBadge } from "./ApplicationStatusBadge";
import type { ApplicationRecord } from "./applicationTypes";
import classes from "./ApplicationCard.module.scss";

type ApplicationCardProps = {
  application: ApplicationRecord;
  title: ReactNode;
  subtitle?: ReactNode;
  statusLabel: string;
  createdAtLabel: string;
  baseRequirementsLabel: string;
  matchScoreLabel: string;
  expanded?: boolean;
  inactive?: boolean;
  actions?: ReactNode;
  statusDetails?: ReactNode;
  children?: ReactNode;
  onToggle?: () => void;
};

type SuitabilityTone = "critical" | "partial" | "good" | "high";

type SuitabilityLevel = {
  label: string;
  tone: SuitabilityTone;
};

function getSuitabilityLevel(application: ApplicationRecord): SuitabilityLevel {
  const basePercent = application.matchDetails?.baseRequirementsPercent ?? 0;
  const matchesBlockingRequirements = application.matchDetails?.requirementEligibility?.matchesBlockingRequirements !== false;
  const hasMissingCriticalSkills = (application.matchDetails?.missingCriticalSkills?.length ?? 0) > 0;

  if (!matchesBlockingRequirements || hasMissingCriticalSkills) {
    return { label: "Не відповідає критичним вимогам", tone: "critical" };
  }

  if (basePercent < 70) return { label: "Часткова відповідність", tone: "partial" };
  if (basePercent < 85) return { label: "Хороша відповідність", tone: "good" };
  return { label: "Висока відповідність", tone: "high" };
}

/** Shared application summary card used by student and HR application views. */
export function ApplicationCard({
  application,
  title,
  subtitle,
  statusLabel,
  createdAtLabel,
  baseRequirementsLabel,
  expanded = false,
  inactive = false,
  actions,
  statusDetails,
  children,
  onToggle,
}: ApplicationCardProps) {
  const basePercent = application.matchDetails?.baseRequirementsPercent ?? 0;
  const suitability = getSuitabilityLevel(application);

  return (
    <article
      className={classes.applicationCard}
      data-expanded={expanded || undefined}
      data-inactive={inactive || undefined}
      data-suitability={suitability.tone}
      onDoubleClick={onToggle}
    >
      <div className={classes.applicationCardMain}>
        <div className={classes.applicationHeading}>
          <Text fw={900}>{title}</Text>
          {subtitle && <Text className={classes.muted}>{subtitle}</Text>}
          {statusDetails}
        </div>
        <div className={classes.applicationScoreMetrics}>
          <div className={`${classes.applicationMetric} ${classes.baseMetric}`}>
            <span>{baseRequirementsLabel}</span>
            <strong className={classes.basePercent}>{basePercent}%</strong>
            <small className={classes.suitabilityBadge}>{suitability.label}</small>
          </div>
        </div>
      </div>
      <div className={classes.applicationFooter}>
        <div className={classes.applicationMeta}>
          <div><span>{statusLabel}</span><ApplicationStatusBadge status={application.status} /></div>
          <div><span>{createdAtLabel}</span><Text>{new Date(application.createdAt).toLocaleDateString("uk-UA")}</Text></div>
        </div>
        {actions && <div className={classes.applicationActions} onDoubleClick={(event) => event.stopPropagation()}>{actions}</div>}
      </div>
      {expanded && children && <div className={classes.applicationDetails}>{children}</div>}
    </article>
  );
}
