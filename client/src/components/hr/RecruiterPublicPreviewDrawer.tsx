import { Avatar, Drawer, Text } from "@mantine/core";
import { AppTooltip } from "../common/AppTooltip";
import classes from "./RecruiterPublicPreviewDrawer.module.scss";

export type RecruiterPublicPreviewData = {
  fullName: string;
  position?: string | null;
  photoUrl?: string | null;
  companyName?: string | null;
  email?: string | null;
  contacts?: Array<{ linkName: string; value: string }>;
  createdAt?: string | null;
  activeVacanciesCount?: number;
  totalVacanciesCount?: number;
};

type RecruiterPublicPreviewDrawerProps = {
  opened: boolean;
  data: RecruiterPublicPreviewData | null;
  title: string;
  labels: {
    company: string;
    position: string;
    email: string;
    createdAt: string;
    activeVacancies: string;
    totalVacancies: string;
    vacanciesList: string;
    emptyVacancies: string;
    copy: string;
  };
  onClose: () => void;
  onCompanyOpen?: () => void;
};

/** Відкриває публічний профіль рекрутера в бічній панелі. */
export function RecruiterPublicPreviewDrawer({ opened, data, title, labels, onClose, onCompanyOpen }: RecruiterPublicPreviewDrawerProps) {
  const progress = getRecruiterProgress(data);

  return <Drawer opened={opened} onClose={onClose} position="right" size="md" title={title} classNames={{ content: classes.drawerContent, overlay: classes.drawerOverlay }}>
    <div className={classes.preview}>
      <div className={classes.stickyHeader}>
        <div className={classes.header}>
          <Avatar src={data?.photoUrl} size={82} radius="xl" className={classes.avatarRing} />
          <div>
            <Text fw={950}>{data?.fullName}</Text>
            <Text className={classes.muted}>{data?.position}</Text>
          </div>
        </div>
        <div className={classes.progress}><span style={{ width: `${progress}%` }} /></div>
      </div>
      <div className={classes.body}>
        <InfoRow label={labels.company} value={data?.companyName} actionLabel={labels.company} onClick={onCompanyOpen} />
        <InfoRow label={labels.position} value={data?.position} />
        {data?.email && <ContactCopyRow label={labels.email} value={data.email} copyLabel={labels.copy} />}
        {data?.contacts?.map((contact) => <ContactCopyRow key={`${contact.linkName}-${contact.value}`} label={contact.linkName} value={contact.value} copyLabel={labels.copy} />)}
        {data?.createdAt && <InfoRow label={labels.createdAt} value={new Date(data.createdAt).toLocaleDateString("uk-UA")} />}
        {typeof data?.activeVacanciesCount === "number" && <InfoRow label={labels.activeVacancies} value={String(data.activeVacanciesCount)} />}
        {typeof data?.totalVacanciesCount === "number" && <InfoRow label={labels.totalVacancies} value={String(data.totalVacanciesCount)} />}
        {typeof data?.totalVacanciesCount === "number" && <details className={classes.details}>
          <summary>{labels.vacanciesList}</summary>
          <Text className={classes.muted}>{labels.emptyVacancies}</Text>
        </details>}
      </div>
    </div>
  </Drawer>;
}

function InfoRow({ label, value, actionLabel, onClick }: { label?: string; value?: string | null; actionLabel?: string; onClick?: () => void }) {
  return <div className={classes.infoRow}>{label && <span>{label}</span>}{onClick ? <button type="button" onClick={onClick}>{value || actionLabel}</button> : <strong>{value || "—"}</strong>}</div>;
}

function ContactCopyRow({ label, value, copyLabel }: { label?: string; value?: string | null; copyLabel: string }) {
  if (!value) return null;
  return <div className={classes.contactRow}>{label && <span>{label}</span>}<strong>{value}</strong><AppTooltip label={copyLabel}><button type="button" onClick={() => void navigator.clipboard?.writeText(value)}><CopyIcon /></button></AppTooltip></div>;
}

function getRecruiterProgress(data: RecruiterPublicPreviewData | null) {
  if (!data) return 0;
  const checks = [
    Boolean(data.fullName?.trim()),
    Boolean(data.position?.trim()),
    Boolean(data.companyName?.trim()),
    Boolean(data.email?.trim()),
    Boolean(data.contacts?.length),
  ];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

function CopyIcon() {
  return <svg viewBox="0 0 24 24"><path d="M8 7a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-9a2 2 0 0 1-2-2V7Zm2 0v12h9V7h-9ZM3 17V3a2 2 0 0 1 2-2h10v2H5v14H3Z" /></svg>;
}
