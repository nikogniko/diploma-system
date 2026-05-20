import { Badge, Text, Title } from "@mantine/core";
import dayjs from "dayjs";
import { useEffect, useRef, useState } from "react";
import { AppTooltip } from "../common/AppTooltip";
import { interpolate, messages } from "../../locales/localizedMessages";
import styles from "./ResumePreview.module.scss";

type CatalogItem = { id: number; name: string };
type Skill = CatalogItem & { category: string };
type LinkItem = { id?: string; linkType: string; linkName: string; value: string };
type SkillJoin = { skill: Skill };
type LocationJoin = {
  location: {
    country?: CatalogItem | null;
    region?: CatalogItem | null;
    city?: CatalogItem | null;
  };
};

type ResumeProfile = {
  user: {
    firstName: string;
    lastName: string;
    middleName?: string | null;
    photoUrl?: string | null;
    createdAt?: string;
  };
  birthDate?: string | null;
  gender?: string | null;
  about?: string | null;
  contactEmail?: string | null;
  primaryPhone?: string | null;
  secondaryPhone?: string | null;
  desiredPosition?: string | null;
  minSalary?: number | null;
  isActiveSearch?: boolean;
  visibility?: string | null;
  links?: LinkItem[];
  education?: Array<{
    id: string;
    university?: CatalogItem | null;
    customUniversityName?: string | null;
    specialty: string;
    degree: string;
    startYear: number;
    endYear?: number | null;
    diplomaUrl?: string | null;
  }>;
  languages?: Array<{ id: string; level: string; certificateUrl?: string | null; language?: CatalogItem | null }>;
  courses?: Array<{ id: string; title: string; startDate: string; endDate?: string | null; certificateUrl?: string | null; skills: SkillJoin[] }>;
  projects?: Array<{ id: string; title: string; description: string; projectUrl?: string | null; skills: SkillJoin[] }>;
  experiences?: Array<{
    id: string;
    profession?: CatalogItem | null;
    sphere?: CatalogItem | null;
    position: string;
    companyName: string;
    startDate: string;
    endDate?: string | null;
    achievements: string;
    skills: SkillJoin[];
  }>;
  desiredProfessions?: Array<{ profession?: CatalogItem | null }>;
  employmentTypes?: Array<{ employmentType?: CatalogItem | null }>;
  workSchedules?: Array<{ workSchedule?: CatalogItem | null }>;
  workFormats?: Array<{ workFormat?: CatalogItem | null }>;
  desiredLocations?: LocationJoin[];
};

const ui = messages.studentDashboard.resumePreview;
const commonUi = messages.common;
const degreeLabels = messages.studentDashboard.degreeLabels;
const languageLevelLabels: Record<string, string> = {
  NATIVE: "На рівні носія",
};

type ResumePreviewProps = {
  profile: ResumeProfile | null;
};

/** Показує повне резюме кандидата у режимі читання для студента або рекрутера. */
export function ResumePreview({ profile }: ResumePreviewProps) {
  const scrollRef = useRef<HTMLElement | null>(null);
  const [scrollProgress, setScrollProgress] = useState(0);

  useEffect(() => {
    const node = scrollRef.current;
    if (!node) return;
    const handleScroll = () => {
      const maxScroll = node.scrollHeight - node.clientHeight;
      setScrollProgress(maxScroll > 0 ? Math.min(100, (node.scrollTop / maxScroll) * 100) : 0);
    };
    handleScroll();
    node.addEventListener("scroll", handleScroll, { passive: true });
    return () => node.removeEventListener("scroll", handleScroll);
  }, [profile]);

  if (!profile) return null;

  const fullName = [profile.user.lastName, profile.user.firstName, profile.user.middleName].filter(Boolean).join(" ") || ui.profileFallbackName;
  const allSkills = collectSkills(profile);
  const groupedSkills = groupSkills(allSkills);
  const knownLinks = (profile.links ?? []).filter((link) => isQuickContact(link.linkName) || link.linkType === "MESSENGER" || link.linkType === "SOCIAL");
  const otherLinks = (profile.links ?? []).filter((link) => !knownLinks.includes(link));
  const isContactsVisible = profile.visibility === "PUBLIC";

  return (
    <article className={styles.resume} ref={scrollRef}>
      <div className={styles.stickyHeader}>
        <header className={styles.hero}>
          <img className={styles.avatar} src={profile.user.photoUrl || "/vite.svg"} alt={fullName} />
          <div>
            <Text className={styles.eyebrow}>{ui.eyebrow}</Text>
            <Title order={1} className={styles.name}>{fullName}</Title>
            <div className={styles.meta}>
              <Badge variant="light">{profile.isActiveSearch ? ui.activeSearch : ui.no}</Badge>
            </div>
          </div>
        </header>
        <div className={styles.progressTrack} aria-hidden="true">
          <span style={{ width: `${scrollProgress}%` }} />
        </div>
      </div>

      <div className={styles.previewBody}>
      <div className={styles.layout}>
        <main className={styles.main}>
          <PreviewSection title={ui.about}>
            {profile.about ? <RichHtml value={profile.about} /> : <Empty />}
          </PreviewSection>

          <PreviewSection title={ui.experience}>
            <CardList items={sortByDateDesc(profile.experiences ?? [], (item) => item.startDate)} render={(item) => (
              <ResumeCard
                key={item.id}
                title={`${item.position} · ${item.companyName}`}
                meta={<><strong>{formatDuration(item.startDate, item.endDate)}</strong> · {dateShort(item.startDate)} - {item.endDate ? dateShort(item.endDate) : ui.now}<br />{item.profession?.name ?? ""} · {item.sphere?.name ?? ""}</>}
                html={item.achievements}
                skills={item.skills.map((join) => join.skill)}
              />
            )} />
          </PreviewSection>

          <PreviewSection title={ui.projects}>
            <CardList items={profile.projects ?? []} render={(item) => (
              <ResumeCard
                key={item.id}
                title={item.title}
                html={item.description}
                skills={item.skills.map((join) => join.skill)}
                links={item.projectUrl ? [{ label: ui.projectLink, value: item.projectUrl }] : []}
              />
            )} />
          </PreviewSection>

          <PreviewSection title={ui.courses}>
            <CardList items={sortByDateDesc(profile.courses ?? [], (item) => item.startDate)} render={(item) => (
              <ResumeCard
                key={item.id}
                title={item.title}
                meta={`${monthShort(item.startDate)}${item.endDate ? ` - ${monthShort(item.endDate)}` : ""}`}
                skills={item.skills.map((join) => join.skill)}
                links={item.certificateUrl ? [{ label: ui.certificate, value: item.certificateUrl }] : []}
              />
            )} />
          </PreviewSection>

          <PreviewSection title={ui.education}>
            <CardList items={sortByYearDesc(profile.education ?? [])} render={(item) => (
              <ResumeCard
                key={item.id}
                title={item.university?.name ?? item.customUniversityName ?? ui.emptySection}
                meta={<><strong>{degreeLabel(item.degree)}</strong> · {item.specialty}<br />{item.startYear}{item.endYear ? `-${item.endYear}` : ""}</>}
                links={item.diplomaUrl ? [{ label: ui.diploma, value: item.diplomaUrl }] : []}
              />
            )} />
          </PreviewSection>

          <PreviewSection title={ui.languages}>
            <CardList items={profile.languages ?? []} render={(item) => (
              <ResumeCard
                key={item.id}
                title={`${item.language?.name ?? ui.emptySection} - ${languageLevelLabel(item.level)}`}
                links={item.certificateUrl ? [{ label: ui.certificate, value: item.certificateUrl }] : []}
              />
            )} />
          </PreviewSection>
        </main>

        <aside className={styles.aside}>
          <PreviewSection title={ui.contacts} compact>
            {isContactsVisible ? (
              <>
                <Text className={styles.contactNote}>{ui.contactsNote}</Text>
                <ContactLine label={ui.contactEmail} value={profile.contactEmail} />
                <ContactLine label={ui.primaryPhone} value={profile.primaryPhone} normalizeCopy={normalizePhone} />
                <ContactLine label={ui.secondaryPhone} value={profile.secondaryPhone} normalizeCopy={normalizePhone} />
              </>
            ) : (
              <ContactAccessNotice visibility={profile.visibility} />
            )}
          </PreviewSection>

          {isContactsVisible && (
            <PreviewSection title={ui.links} compact>
              {knownLinks.length ? <QuickContactList links={knownLinks} /> : <Empty />}
              {otherLinks.length ? <LinkList links={otherLinks.map((link) => ({ label: link.linkName, value: link.value }))} withActions /> : null}
            </PreviewSection>
          )}

          <PreviewSection title={ui.skillsTitle} compact>
            {allSkills.length ? <GroupedSkillCloud groups={groupedSkills} /> : <Empty />}
          </PreviewSection>

          <PreviewSection title={ui.searchPreferences} compact>
            <InfoLine label={ui.desiredPosition} value={profile.desiredPosition} />
            <InfoLine label={ui.desiredProfessions} value={joinNames(profile.desiredProfessions?.map((item) => item.profession?.name))} />
            <InfoLine label={ui.desiredLocations} value={joinNames(profile.desiredLocations?.map(formatLocation))} />
            <InfoLine label={ui.minSalary} value={profile.minSalary ? interpolate(ui.salaryValue, { amount: profile.minSalary }) : ui.salaryAny} />
            <InfoLine label={ui.employmentTypes} value={joinNames(profile.employmentTypes?.map((item) => item.employmentType?.name))} />
            <InfoLine label={ui.workSchedules} value={joinNames(profile.workSchedules?.map((item) => item.workSchedule?.name))} />
            <InfoLine label={ui.workFormats} value={joinNames(profile.workFormats?.map((item) => item.workFormat?.name))} />
          </PreviewSection>

          <PreviewSection title={ui.other} compact>
            <InfoLine label={ui.createdAt} value={profile.user.createdAt ? dateShort(profile.user.createdAt) : undefined} />
            <InfoLine label={ui.candidateAge} value={profile.birthDate ? interpolate(ui.ageValue, { age: getAge(profile.birthDate) }) : undefined} />
          </PreviewSection>
        </aside>
      </div>
      </div>
    </article>
  );
}

function PreviewSection({ title, compact, children }: { title: string; compact?: boolean; children: React.ReactNode }) {
  return <section className={compact ? styles.compactSection : styles.section}><Title order={2}>{title}</Title>{children}</section>;
}

function ResumeCard({ title, meta, html, skills, links }: { title: string; meta?: React.ReactNode; html?: string; skills?: Skill[]; links?: Array<{ label: string; value: string }> }) {
  return (
    <div className={styles.card}>
      <Text className={styles.cardTitle}>{title}</Text>
      {meta && <Text className={styles.cardMeta}>{meta}</Text>}
      {html && <RichHtml value={html} />}
      {skills?.length ? <SkillCloud skills={skills} /> : null}
      {links?.length ? <LinkList links={links} /> : null}
    </div>
  );
}

function CardList<T>({ items, render }: { items: T[]; render: (item: T) => React.ReactNode }) {
  if (!items.length) return <Empty />;
  return <div className={styles.cardList}>{items.map(render)}</div>;
}

function SkillCloud({ skills }: { skills: Skill[] }) {
  return <div className={styles.skills}>{skills.map((skill) => <span className={skillClass(skill.category)} key={`${skill.id}-${skill.name}`}>{skill.name}</span>)}</div>;
}

function GroupedSkillCloud({ groups }: { groups: Record<string, Skill[]> }) {
  return <div className={styles.skillGroups}>{Object.entries(groups).map(([category, skills]) => skills.length ? <div key={category}><Text className={styles.skillGroupTitle}>{categoryLabel(category)}</Text><SkillCloud skills={skills} /></div> : null)}</div>;
}

function LinkList({ links, withActions }: { links: Array<{ label: string; value: string }>; withActions?: boolean }) {
  return <div className={styles.links}>{links.map((link) => <div className={styles.linkRow} key={`${link.label}-${link.value}`}><AppTooltip label={link.value}><a href={normalizeHref(link.value)} target="_blank" rel="noreferrer">{link.label}</a></AppTooltip>{withActions && <LinkActions value={link.value} />}</div>)}</div>;
}

function QuickContactList({ links }: { links: LinkItem[] }) {
  return <div className={styles.quickContacts}>{links.map((link) => <ContactLine key={`${link.linkName}-${link.value}`} label={link.linkName} value={link.value} openable={isWebLink(link.value)} />)}</div>;
}

function LinkActions({ value }: { value: string }) {
  return <span className={styles.linkActions}><AppTooltip label={ui.open}><a href={normalizeHref(value)} target="_blank" rel="noreferrer"><OpenIcon /></a></AppTooltip><AppTooltip label={ui.copy}><button type="button" onClick={() => copyToClipboard(value)}><CopyIcon /></button></AppTooltip></span>;
}

function InfoLine({ label, value, copyable }: { label: string; value?: string | null; copyable?: boolean }) {
  if (!value) return null;
  return <div className={styles.infoLine}><span>{label}</span><strong>{value}</strong>{copyable && <AppTooltip label={ui.copy}><button type="button" onClick={() => copyToClipboard(value)}><CopyIcon /></button></AppTooltip>}</div>;
}

function ContactLine({ label, value, openable, normalizeCopy }: { label: string; value?: string | null; openable?: boolean; normalizeCopy?: (value: string) => string }) {
  if (!value) return null;
  const copyValue = normalizeCopy ? normalizeCopy(value) : value;
  return <div className={styles.contactLine}><span>{label}</span><strong>{value}</strong>{openable && <AppTooltip label={ui.open}><a href={normalizeHref(value)} target="_blank" rel="noreferrer"><OpenIcon /></a></AppTooltip>}<AppTooltip label={ui.copy}><button type="button" onClick={() => copyToClipboard(copyValue)}><CopyIcon /></button></AppTooltip></div>;
}

function ContactAccessNotice({ visibility }: { visibility?: string | null }) {
  const isHidden = visibility === "HIDDEN";
  return <div className={isHidden ? styles.hiddenNotice : styles.confidentialNotice}><strong>{isHidden ? messages.studentDashboard.visibility.hiddenLabel : messages.studentDashboard.visibility.appliedLabel}</strong><span>{isHidden ? ui.contactsHidden : ui.contactsAfterInterview}</span></div>;
}

function RichHtml({ value }: { value: string }) {
  return <div className={styles.richText} dangerouslySetInnerHTML={{ __html: value }} />;
}

function Empty() {
  return <Text className={styles.empty}>{ui.emptySection}</Text>;
}

function collectSkills(profile: ResumeProfile) {
  const map = new Map<number, Skill>();
  [...(profile.courses ?? []), ...(profile.projects ?? []), ...(profile.experiences ?? [])].forEach((item) => {
    item.skills.forEach((join) => map.set(join.skill.id, join.skill));
  });
  return Array.from(map.values());
}

function groupSkills(skills: Skill[]) {
  return skills.reduce<Record<string, Skill[]>>((groups, skill) => {
    const key = skill.category?.toUpperCase().includes("TOOL") ? "TOOL" : skill.category?.toUpperCase().includes("SOFT") ? "SOFT" : "HARD";
    groups[key] = [...(groups[key] ?? []), skill];
    return groups;
  }, { HARD: [], TOOL: [], SOFT: [] });
}

function sortByDateDesc<T extends object>(items: T[], getDate: (item: T) => string) {
  return [...items].sort((a, b) => dayjs(getDate(b)).valueOf() - dayjs(getDate(a)).valueOf());
}

function sortByYearDesc<T extends { startYear: number }>(items: T[]) {
  return [...items].sort((a, b) => b.startYear - a.startYear);
}

function joinNames(values?: Array<string | null | undefined>) {
  return values?.filter(Boolean).join(", ") || "";
}

function formatLocation(item: LocationJoin) {
  return [item.location.country?.name, item.location.region?.name, item.location.city?.name].filter(Boolean).join(", ");
}

function getAge(date: string) {
  return dayjs().diff(dayjs(date), "year");
}

function formatDuration(start: string, end?: string | null) {
  const startDate = dayjs(start);
  const endDate = end ? dayjs(end) : dayjs();
  const years = endDate.diff(startDate, "year");
  if (years >= 1) return `${years} ${pluralUk(years, commonUi.duration.year)}`;
  const months = endDate.diff(startDate, "month");
  if (months >= 1) return `${months} ${pluralUk(months, commonUi.duration.month)}`;
  const days = Math.max(1, endDate.diff(startDate, "day"));
  return `${days} ${pluralUk(days, commonUi.duration.day)}`;
}

function pluralUk(value: number, forms: string[]) {
  const mod10 = value % 10;
  const mod100 = value % 100;
  if (mod10 === 1 && mod100 !== 11) return forms[0];
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return forms[1];
  return forms[2];
}

function isQuickContact(name: string) {
  return ["telegram", "viber", "linkedin", "instagram", "facebook", "youtube", "tiktok"].includes(name.toLowerCase());
}

function categoryLabel(category: string) {
  if (category === "TOOL") return "Tools";
  if (category === "SOFT") return "Soft Skills";
  return "Hard Skills";
}

function skillClass(category: string) {
  const lower = category.toLowerCase();
  if (lower.includes("tool")) return styles.toolSkill;
  if (lower.includes("soft")) return styles.softSkill;
  return styles.hardSkill;
}

function copyToClipboard(value: string) {
  void navigator.clipboard?.writeText(value);
}

function normalizePhone(value: string) {
  return value.replace(/\s+/g, "");
}

function isWebLink(value: string) {
  return /^(https?:\/\/|www\.|[a-z0-9-]+\.[a-z]{2,})/i.test(value.trim());
}

function degreeLabel(degree: string) {
  return ({ JUNIOR_BACHELOR: degreeLabels.juniorBachelor, BACHELOR: degreeLabels.bachelor, MASTER: degreeLabels.master, PHD: degreeLabels.phd, OTHER: degreeLabels.other }[degree] ?? degree);
}
function languageLevelLabel(level: string) {
  return languageLevelLabels[level] ?? level;
}

const dateShort = (value: string) => dayjs(value).format("DD.MM.YYYY");
const monthShort = (value: string) => dayjs(value).format("MM.YYYY");
const normalizeHref = (value: string) => /^https?:\/\//i.test(value.trim()) ? value.trim() : `https://${value.trim()}`;

function CopyIcon() { return <svg viewBox="0 0 24 24"><path d="M8 7a3 3 0 0 1 3-3h6a3 3 0 0 1 3 3v6a3 3 0 0 1-3 3h-1v1a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3v-6a3 3 0 0 1 3-3h1V7Zm2 1h3a3 3 0 0 1 3 3v3h1a1 1 0 0 0 1-1V7a1 1 0 0 0-1-1h-6a1 1 0 0 0-1 1v1Zm-3 2a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-6a1 1 0 0 0-1-1H7Z" /></svg>; }
function OpenIcon() { return <svg viewBox="0 0 24 24"><path d="M14 4h6v6h-2V7.4l-7.3 7.3-1.4-1.4L16.6 6H14V4ZM5 6h6v2H7v9h9v-4h2v6H5V6Z" /></svg>; }
