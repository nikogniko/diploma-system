import { Avatar, Group, Paper, Text } from "@mantine/core";
import { messages } from "../../locales/localizedMessages";
import { richTextToPlainText } from "../../utils/richText";
import classes from "./VacancySearchCard.module.scss";

export type SearchCardVacancy = {
  id: string;
  title: string;
  description?: string | null;
  updatedAt: string;
  minSalary?: number | null;
  maxSalary?: number | null;
  salaryPeriod?: "PER_MONTH" | "PER_HOUR" | null;
  company?: { publicName?: string | null; logoUrl?: string | null } | null;
  profession?: { name?: string | null } | null;
  workFormats?: Array<{ workFormat?: { name?: string | null } | null }>;
  employmentTypes?: Array<{ employmentType?: { name?: string | null } | null }>;
  workSchedules?: Array<{ workSchedule?: { name?: string | null } | null }>;
};

export type SearchCardSkill = {
  skillId: string | number;
  weight: string;
  skill?: { name?: string | null } | null;
};

type Props = {
  vacancy: SearchCardVacancy;
  skills?: SearchCardSkill[];
  locations?: string[];
  onOpen: (vacancyId: string) => void;
};

const ui = messages.publicVacancies.card;

export function VacancySearchCard({ vacancy, skills = [], locations = [], onOpen }: Props) {
  return (
    <Paper component="button" type="button" className={classes.card} onClick={() => onOpen(vacancy.id)}>
      <div className={classes.cardTop}>
        <div>
          <Text className={classes.cardTitle}>{vacancy.title}</Text>
          <Text className={classes.company}>
            <span>{vacancy.company?.publicName ?? ui.companyFallback}</span>
            <span className={classes.companyDot}>{ui.dot}</span>
            <span>{vacancy.profession?.name ?? ui.professionFallback}</span>
          </Text>
        </div>
        <Avatar src={vacancy.company?.logoUrl} radius="md" size={64}>
          {vacancy.company?.publicName?.[0] ?? "C"}
        </Avatar>
      </div>
      {vacancy.description && <Text className={classes.description}>{richTextToPlainText(vacancy.description)}</Text>}
      <div className={classes.metaLine}>
        <span className={classes.locationInline}>
          {(locations.length ? locations : [ui.locationFallback]).map((location) => (
            <span key={location} className={classes.locationChip}>{location}</span>
          ))}
        </span>
        <span className={classes.conditionsInline}>
          {labelList(vacancy.workFormats?.map((item) => item.workFormat?.name))} <b>|</b>{" "}
          {labelList(vacancy.employmentTypes?.map((item) => item.employmentType?.name))} <b>|</b>{" "}
          {labelList(vacancy.workSchedules?.map((item) => item.workSchedule?.name))}
        </span>
      </div>
      <div className={classes.cardBottom}>
        <div className={classes.cardBottomMain}>
          {skills.length > 0 && (
            <div className={classes.skillRow}>
              {skills.map((skill) => (
                <span key={`${skill.skillId}-${skill.weight}`} className={classes.skillChip}>{skill.skill?.name}</span>
              ))}
            </div>
          )}
          <Text className={classes.updatedText}>{ui.updatedAt} {dateLong(vacancy.updatedAt)}</Text>
        </div>
        <Group className={classes.cardValueBlock} gap="sm" wrap="nowrap">
          {formatVacancySalary(vacancy) && <Text className={classes.salaryText}>{formatVacancySalary(vacancy)}</Text>}
        </Group>
      </div>
    </Paper>
  );
}

function formatVacancySalary(vacancy: SearchCardVacancy) {
  if (!vacancy.minSalary && !vacancy.maxSalary) return null;
  const period = vacancy.salaryPeriod === "PER_HOUR" ? ui.salaryPerHour : ui.salaryPerMonth;
  if (vacancy.minSalary && vacancy.maxSalary) return `${formatMoney(vacancy.minSalary)}-${formatMoney(vacancy.maxSalary)} ${period}`;
  return `${formatMoney(vacancy.minSalary ?? vacancy.maxSalary ?? 0)} ${period}`;
}

const labelList = (values?: Array<string | null | undefined>) => values?.filter(Boolean).join(", ") || ui.notSpecified;
const dateLong = (value: string) => new Date(value).toLocaleDateString("uk-UA", { day: "numeric", month: "long" });
const formatMoney = (value: number) => new Intl.NumberFormat("uk-UA").format(value);
