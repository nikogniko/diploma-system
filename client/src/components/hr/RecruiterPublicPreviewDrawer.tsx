import { Avatar, Drawer, Text } from "@mantine/core";
import { Link } from "react-router-dom";
import { AppTooltip } from "../common/AppTooltip";
import { NoticeBanner } from "../common/NoticeBanner";
import classes from "./RecruiterPublicPreviewDrawer.module.scss";

export type RecruiterPreviewVacancy = {
  id: string;
  title: string;
  updatedAt?: string | null;
  profession?: { name?: string | null } | null;
  href?: string;
};

export type RecruiterPublicPreviewData = {
  fullName: string;
  position?: string | null;
  photoUrl?: string | null;
  companyName?: string | null;
  companyHref?: string | null;
  email?: string | null;
  contacts?: Array<{ linkName: string; value: string }>;
  createdAt?: string | null;
  activeVacanciesCount?: number;
  totalVacanciesCount?: number;
  vacancies?: RecruiterPreviewVacancy[];
  contactAccess?: "VISIBLE" | "AFTER_APPLICATION";
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
    latestVacanciesNote?: string;
    emptyVacancies: string;
    copy: string;
    contactsUnavailable?: string;
  };
  onClose: () => void;
  onCompanyOpen?: () => void;
};

/** Відкриває публічний профіль рекрутера в бічній панелі. */
export function RecruiterPublicPreviewDrawer({ opened, data, title, labels, onClose, onCompanyOpen }: RecruiterPublicPreviewDrawerProps) {
  const progress = getRecruiterProgress(data);
  const contactsVisible = !data?.contactAccess || data.contactAccess === "VISIBLE";
  const vacancies = latestVacancies(data?.vacancies ?? []);

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
        <InfoRow label={labels.company} value={data?.companyName} actionLabel={labels.company} href={data?.companyHref ?? undefined} onClick={onCompanyOpen} />
        <InfoRow label={labels.position} value={data?.position} />
        {contactsVisible ? <>
          {data?.email && <ContactCopyRow label={labels.email} value={data.email} copyLabel={labels.copy} />}
          {data?.contacts?.map((contact) => <ContactCopyRow key={`${contact.linkName}-${contact.value}`} label={contact.linkName} value={contact.value} copyLabel={labels.copy} />)}
        </> : <NoticeBanner className={classes.inlineNotice} message={labels.contactsUnavailable ?? null} />}
        {data?.createdAt && <InfoRow label={labels.createdAt} value={new Date(data.createdAt).toLocaleDateString("uk-UA")} />}
        {typeof data?.activeVacanciesCount === "number" && <InfoRow label={labels.activeVacancies} value={String(data.activeVacanciesCount)} />}
        {typeof data?.totalVacanciesCount === "number" && <InfoRow label={labels.totalVacancies} value={String(data.totalVacanciesCount)} />}
        {typeof data?.totalVacanciesCount === "number" && <details className={classes.details}>
          <summary><span>{labels.vacanciesList}</span><ChevronIcon /></summary>
          <Text className={classes.latestNote}>{labels.latestVacanciesNote}</Text>
          {vacancies.length
            ? <div className={classes.vacancyList}>{vacancies.map((vacancy) => <VacancyLinkCard key={vacancy.id} vacancy={vacancy} />)}</div>
            : <Text className={classes.muted}>{labels.emptyVacancies}</Text>}
        </details>}
      </div>
    </div>
  </Drawer>;
}

function InfoRow({ label, value, actionLabel, href, onClick }: { label?: string; value?: string | null; actionLabel?: string; href?: string; onClick?: () => void }) {
  const text = value || actionLabel || "-";
  return <div className={classes.infoRow}>{label && <span>{label}</span>}{href ? <Link to={href}>{text}</Link> : onClick ? <button type="button" onClick={onClick}>{text}</button> : <strong>{text}</strong>}</div>;
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

function VacancyLinkCard({ vacancy }: { vacancy: RecruiterPreviewVacancy }) {
  const content = <>
    <strong>{vacancy.title}</strong>
    <span>{vacancy.profession?.name || "Професія не вказана"}</span>
    {vacancy.updatedAt && <small>{new Date(vacancy.updatedAt).toLocaleDateString("uk-UA")}</small>}
  </>;
  return vacancy.href
    ? <Link className={classes.vacancyLinkCard} to={vacancy.href}>{content}</Link>
    : <div className={classes.vacancyLinkCard}>{content}</div>;
}

function latestVacancies(vacancies: RecruiterPreviewVacancy[]) {
  return [...vacancies]
    .sort((first, second) => new Date(second.updatedAt ?? 0).getTime() - new Date(first.updatedAt ?? 0).getTime())
    .slice(0, 5);
}

function CopyIcon() {
  return <svg viewBox="0 0 24 24"><path d="M8 7a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-9a2 2 0 0 1-2-2V7Zm2 0v12h9V7h-9ZM3 17V3a2 2 0 0 1 2-2h10v2H5v14H3Z" /></svg>;
}

function ChevronIcon() {
  return <svg viewBox="0 0 24 24"><path d="m7.4 8.6 4.6 4.6 4.6-4.6L18 10l-6 6-6-6 1.4-1.4Z" /></svg>;
}
