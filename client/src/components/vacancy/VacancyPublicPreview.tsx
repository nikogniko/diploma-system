import { Avatar, Badge, Button, Text, Title } from "@mantine/core";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ChipBadge } from "../common/ChipBadge";
import { FormSection } from "../common/FormSection";
import { messages } from "../../locales/localizedMessages";
import classes from "./VacancyPublicPreview.module.scss";

export type PreviewSkillWeight = "CRITICAL" | "IMPORTANT" | "NICE_TO_HAVE";
export type PreviewVacancy = {
  title: string;
  description: string;
  status?: string;
  updatedAt?: string;
  closingDate?: string;
  company?: { publicName?: string | null; logoUrl?: string | null } | null;
  profession?: { name?: string | null } | null;
  minSalary?: number | null;
  maxSalary?: number | null;
  salaryPeriod?: "PER_MONTH" | "PER_HOUR" | null;
  isLocationCritical?: boolean;
  skills: Array<{ skillId: string | number; weight: PreviewSkillWeight; skill?: { name?: string | null; category?: string | null } | null }>;
  languages: Array<{ languageId: string | number; level: string; language?: { name?: string | null } | null }>;
  spheres?: Array<{ sphereId: string | number; sphere?: { name?: string | null } | null }>;
  workFormats?: Array<{ workFormat?: { name?: string | null } | null }>;
  employmentTypes?: Array<{ employmentType?: { name?: string | null } | null }>;
  workSchedules?: Array<{ workSchedule?: { name?: string | null } | null }>;
};

type Props = {
  vacancy: PreviewVacancy;
  labels?: {
    status?: string;
    description?: string;
    requiredSkills?: string;
    requiredSkillsDescription?: string;
    languages?: string;
    about?: string;
    conditions?: string;
    profession?: string;
    salary?: string;
    closingDate?: string;
    location?: string;
    workFormat?: string;
    employmentType?: string;
    schedule?: string;
    apply?: string;
    notSpecified?: string;
    companyFallback?: string;
    updatedAt?: string;
    locationRequired?: string;
    spheres?: string;
    nativeLanguage?: string;
    salaryPerHour?: string;
    salaryPerMonth?: string;
  };
  locationText?: string | null;
  companyHref?: string;
  recruiterSlot?: React.ReactNode;
  stickyAction?: "student-apply" | null;
  notice?: string | null;
  onApply?: () => void;
};

export function VacancyPublicPreview({ vacancy, labels = {}, locationText, companyHref, recruiterSlot, stickyAction = null, notice, onApply }: Props) {
  const [scrollProgress, setScrollProgress] = useState(0);
  const skillGroups = groupSkills(vacancy.skills);
  const hasLanguages = vacancy.languages.length > 0;
  const ui = { ...messages.publicVacancies.details, ...messages.publicVacancies.common, ...messages.publicVacancies.card, ...labels };

  useEffect(() => {
    const updateProgress = () => {
      const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
      setScrollProgress(maxScroll > 0 ? Math.min(100, Math.max(0, (window.scrollY / maxScroll) * 100)) : 0);
    };
    updateProgress();
    window.addEventListener("scroll", updateProgress, { passive: true });
    window.addEventListener("resize", updateProgress);
    return () => {
      window.removeEventListener("scroll", updateProgress);
      window.removeEventListener("resize", updateProgress);
    };
  }, []);

  return (
    <div className={classes.preview}>
      <section className={classes.hero}>
        <div>
          {vacancy.status && <Badge variant="light">{labels.status ?? vacancy.status}</Badge>}
          <Title order={2}>{vacancy.title}</Title>
          {companyHref
            ? <Link className={classes.companyLink} to={companyHref}>{vacancy.company?.publicName ?? ui.companyFallback}</Link>
            : <Text className={classes.company}>{vacancy.company?.publicName ?? ui.companyFallback}</Text>}
          {vacancy.updatedAt && <Text className={classes.muted}>{ui.updatedAt} {dateLong(vacancy.updatedAt)}</Text>}
        </div>
        <div className={classes.logoBox}><Avatar src={vacancy.company?.logoUrl} radius="md">{vacancy.company?.publicName?.[0] ?? "C"}</Avatar></div>
        <div className={classes.progressTrack}><span style={{ width: `${scrollProgress}%` }} /></div>
      </section>

      <div className={classes.grid}>
        <main className={classes.main}>
          <FormSection title={ui.description}>
            <div className={classes.richPreview} dangerouslySetInnerHTML={{ __html: vacancy.description }} />
          </FormSection>
          <FormSection title={ui.requiredSkills} description={ui.requiredSkillsDescription}>
            <div className={classes.skillGroups}>{skillGroups.map((group) => (
              <div key={group.category}>
                <Text fw={900}>{skillCategoryLabel(group.category)}</Text>
                <div className={classes.skillChips}>{group.skills.map((item) => <ChipBadge key={item.skillId} tone={skillWeightTone(item.weight)}>{item.skill?.name ?? item.skillId}</ChipBadge>)}</div>
              </div>
            ))}</div>
          </FormSection>
          {hasLanguages && <FormSection title={ui.languages}>
            <div className={classes.languageChips}>{vacancy.languages.map((item) => <ChipBadge key={item.languageId} tone="language">{item.language?.name ?? item.languageId} - {languageLevelLabel(item.level, ui.nativeLanguage)}</ChipBadge>)}</div>
          </FormSection>}
        </main>

        <aside className={classes.aside}>
          {stickyAction === "student-apply" && <div className={classes.stickyAction}>
            <Button fullWidth onClick={onApply}>{ui.apply}</Button>
            {notice && <div className={classes.notice}>{notice}</div>}
          </div>}
          <FormSection title={ui.about}>
            <InfoLine label={ui.profession} value={vacancy.profession?.name} emptyLabel={ui.notSpecified} />
            <InfoLine label={ui.salary} value={formatSalary(vacancy, ui.salaryPerHour, ui.salaryPerMonth)} emptyLabel={ui.notSpecified} />
            <InfoLine label={ui.closingDate} value={vacancy.closingDate ? dateShort(vacancy.closingDate) : null} emptyLabel={ui.notSpecified} />
          </FormSection>
          <FormSection title={ui.conditions}>
            <InfoLine label={ui.location} emptyLabel={ui.notSpecified} value={<><span>{locationText || ui.notSpecified}</span>{vacancy.isLocationCritical && <Badge className={classes.badge}>{ui.locationRequired}</Badge>}</>} />
            <InfoLine label={ui.workFormat} value={joinNames(vacancy.workFormats?.map((item) => item.workFormat?.name))} emptyLabel={ui.notSpecified} />
            <InfoLine label={ui.employmentType} value={joinNames(vacancy.employmentTypes?.map((item) => item.employmentType?.name))} emptyLabel={ui.notSpecified} />
            <InfoLine label={ui.schedule} value={joinNames(vacancy.workSchedules?.map((item) => item.workSchedule?.name))} emptyLabel={ui.notSpecified} />
          </FormSection>
          {vacancy.spheres?.length ? <FormSection title={ui.spheres}><div className={classes.languageChips}>{vacancy.spheres.map((item) => <ChipBadge key={item.sphereId} tone="sphere">{item.sphere?.name}</ChipBadge>)}</div></FormSection> : null}
          {recruiterSlot}
        </aside>
      </div>
    </div>
  );
}

function InfoLine({ label, value, emptyLabel }: { label: string; value?: React.ReactNode; emptyLabel: string }) {
  return <div className={classes.infoLine}><span>{label}</span><strong>{value || emptyLabel}</strong></div>;
}

function groupSkills(skills: PreviewVacancy["skills"]) {
  const order = ["HARD_SKILL", "TOOL", "SOFT_SKILL"];
  return Object.entries(skills.reduce<Record<string, PreviewVacancy["skills"]>>((groups, item) => {
    const category = item.skill?.category ?? "OTHER";
    groups[category] ??= [];
    groups[category].push(item);
    return groups;
  }, {}))
    .sort(([first], [second]) => categoryRank(first, order) - categoryRank(second, order))
    .map(([category, groupSkills]) => ({
      category,
      skills: [...groupSkills].sort((first, second) => weightRank[second.weight] - weightRank[first.weight]),
    }));
}

const weightRank: Record<PreviewSkillWeight, number> = { CRITICAL: 3, IMPORTANT: 2, NICE_TO_HAVE: 1 };
const categoryRank = (category: string, order: string[]) => {
  const index = order.indexOf(category);
  return index === -1 ? order.length : index;
};
const skillCategoryLabel = (category: string) => category === "HARD_SKILL" ? "Hard Skills" : category === "TOOL" ? "Tools" : category === "SOFT_SKILL" ? "Soft Skills" : category;
const skillWeightTone = (weight: PreviewSkillWeight) => ({ CRITICAL: "critical", IMPORTANT: "important", NICE_TO_HAVE: "plus" }[weight] as "critical" | "important" | "plus");
const languageLevelLabel = (level: string, nativeLabel: string) => level === "NATIVE" ? nativeLabel : level;
const joinNames = (values?: Array<string | null | undefined>) => values?.filter(Boolean).join(", ") || null;
const dateShort = (value: string) => new Date(value).toLocaleDateString("uk-UA");
const dateLong = (value: string) => new Date(value).toLocaleDateString("uk-UA", { day: "numeric", month: "long" });
const formatMoney = (value: number) => new Intl.NumberFormat("uk-UA").format(value);
function formatSalary(vacancy: PreviewVacancy, perHour: string, perMonth: string) {
  if (!vacancy.minSalary && !vacancy.maxSalary) return null;
  const period = vacancy.salaryPeriod === "PER_HOUR" ? perHour : perMonth;
  if (vacancy.minSalary && vacancy.maxSalary) return `${formatMoney(vacancy.minSalary)}-${formatMoney(vacancy.maxSalary)} ${period}`;
  return `${formatMoney(vacancy.minSalary ?? vacancy.maxSalary ?? 0)} ${period}`;
}
