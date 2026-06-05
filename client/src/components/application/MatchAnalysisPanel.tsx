import { useState } from "react";
import { Accordion, Collapse, Table, Text, UnstyledButton } from "@mantine/core";
import { interpolate, messages } from "../../locales/localizedMessages";
import type { ApplicationMatchDetails, MatchRequirementItem } from "./applicationTypes";
import { MatchAnalysisCharts } from "./MatchAnalysisCharts";
import { buildRequirementGroups, groupMatchedCount, groupWeightedCoverage, type RequirementGroupData } from "./matchAnalysisGroups";
import classes from "./MatchAnalysisPanel.module.scss";

type Props = {
  details: ApplicationMatchDetails | null | undefined;
  variant: "student" | "hr";
};

type ExpandedMetrics = { base: boolean; score: boolean };

/** Показує спільну для HR і студента панель пояснення відповідності вакансії. */
export function MatchAnalysisPanel({ details, variant }: Props) {
  const ui = messages.applicationModule.analysis;
  const [expandedMetrics, setExpandedMetrics] = useState<ExpandedMetrics>({ base: false, score: false });
  if (!details) return <Text className={classes.muted}>{ui.unavailable}</Text>;
  const base = details.details.baseRequirements;
  const groups = buildRequirementGroups(base.items);
  const sectionGroups = sortRequirementSections(groups);
  const hasMissingCritical = groups
    .filter((group) => group.key === "criticalSkills" || group.key === "conditions")
    .flatMap((group) => group.items)
    .some((item) => item.isBlocking && !item.matched);

  return <section className={classes.panel}>
    <div className={classes.metrics}>
      <Metric label={ui.coveredCount} value={`${base.matchedRequirementsCount}/${base.totalRequirementsCount}`} />
      <Metric label={ui.criticalRequirements} value={`${base.blockingRequirements.matchedCount}/${base.blockingRequirements.totalCount}`} />
      <ExpandableMetric
        expanded={expandedMetrics.base}
        label={ui.baseRequirements}
        onToggle={() => setExpandedMetrics((current) => ({ ...current, base: !current.base }))}
        value={`${details.baseRequirementsPercent}%`}
      />
      <ExpandableMetric
        expanded={expandedMetrics.score}
        label={ui.totalScore}
        onToggle={() => setExpandedMetrics((current) => ({ ...current, score: !current.score }))}
        value={String(details.score)}
      />
    </div>
    <Collapse expanded={expandedMetrics.base}>
      <div className={classes.metricDetails}>
        <Text size="sm" className={classes.description}>{ui.baseRequirementsDescription}</Text>
        <Text size="sm" className={classes.description}>{ui.baseRequirementsFormula}</Text>
        <CoverageTable base={base} groups={groups} />
        {variant === "student" && <Text fw={800}>{studentAdvice(details)}</Text>}
      </div>
    </Collapse>
    <Collapse expanded={expandedMetrics.score}>
      <div className={`${classes.metricDetails} ${classes.scoreDetails}`}>
        <ScoreLine
          label={ui.competencyDepthPoints}
          score={details.detailedScore.skillDepthScore}
          total={details.detailedScore.totalScore}
        />
        <ScoreLine
          label={ui.additionalPoints}
          score={details.detailedScore.additionalCriteriaScore}
          total={details.detailedScore.totalScore}
        />
      </div>
    </Collapse>
    <Text className={classes.summary}>{summaryLabel(details.explanation.summary)}</Text>
    <MatchAnalysisCharts details={details} groups={groups} />
    {hasMissingCritical && <div className={classes.warning}>{ui.blockingWarning}</div>}
    <Accordion
      classNames={{ root: classes.accordion, item: classes.accordionItem, control: classes.accordionControl, panel: classes.accordionPanel }}
      defaultValue={[]}
      multiple
      variant="separated"
    >
      {sectionGroups.map((group) => <RequirementSection group={group} key={group.key} />)}
      <Accordion.Item value="skillSources">
        <Accordion.Control>
          <SectionHeader title={ui.sections.skillSources} value={String(details.detailedScore.skillDepthScore)} />
        </Accordion.Control>
        <Accordion.Panel>
          <SkillSourcesTable details={details} />
        </Accordion.Panel>
      </Accordion.Item>
      <Accordion.Item value="additional">
        <Accordion.Control>
          <SectionHeader title={ui.sections.additional} value={String(details.detailedScore.additionalCriteriaScore)} />
        </Accordion.Control>
        <Accordion.Panel>
          <AdditionalPoints details={details} />
        </Accordion.Panel>
      </Accordion.Item>
    </Accordion>
  </section>;
}

/** Показує одну компактну підсумкову метрику аналізу. */
function Metric({ label, value }: { label: string; value: string }) {
  return <div className={classes.metric}><span>{label}</span><strong>{value}</strong></div>;
}

/** Показує метрику, що відкриває пов'язане пояснення без розгортання всього аналізу. */
function ExpandableMetric({ expanded, label, onToggle, value }: { expanded: boolean; label: string; onToggle: () => void; value: string }) {
  const ui = messages.applicationModule.analysis;
  return <UnstyledButton className={classes.metricButton} onClick={onToggle}>
    <Metric label={label} value={value} />
    <span className={classes.metricAction}>{expanded ? ui.hideDetails : ui.showDetails}</span>
  </UnstyledButton>;
}

/** Виводить внесок складової комплексного бала у балах і відсотках. */
function ScoreLine({ label, score, total }: { label: string; score: number; total: number }) {
  return <div className={classes.scoreLine}>
    <span>{label}</span>
    <span className={classes.scoreValue}>{score}</span>
    <span className={classes.scorePercent}>{scorePercent(score, total)}%</span>
  </div>;
}

/** Розраховує частку складової у комплексному балі. */
function scorePercent(score: number, total: number) {
  return total > 0 ? Math.round((score / total) * 100) : 0;
}

/** Розташовує умови вакансії перед skill-секціями у детальному списку вимог. */
function sortRequirementSections(groups: RequirementGroupData[]) {
  const order = { conditions: 0, criticalSkills: 1, important: 2, desirable: 3 };
  return [...groups].sort((first, second) => order[first.key] - order[second.key]);
}

/** Показує таблицю з кількісним та зваженим покриттям чотирьох груп вимог. */
function CoverageTable({ base, groups }: { base: ApplicationMatchDetails["details"]["baseRequirements"]; groups: RequirementGroupData[] }) {
  const ui = messages.applicationModule.analysis;
  return <div className={classes.tableScroll}>
    <Table className={classes.coverageTable}>
      <Table.Thead>
        <Table.Tr>
          <Table.Th>{ui.table.group}</Table.Th>
          <Table.Th>{ui.table.coveredCount}</Table.Th>
          <Table.Th>{ui.table.formulaContribution}</Table.Th>
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {groups.map((group) => <Table.Tr key={group.key}>
          <Table.Td>{group.title}</Table.Td>
          <Table.Td>{groupMatchedCount(group.items)}/{group.items.length}</Table.Td>
          <Table.Td>{groupWeightedCoverage(group.items)}</Table.Td>
        </Table.Tr>)}
        <Table.Tr>
          <Table.Td><strong>{ui.table.totalRequirements}</strong></Table.Td>
          <Table.Td><strong>{base.matchedRequirementsCount}/{base.totalRequirementsCount}</strong></Table.Td>
          <Table.Td><strong>{base.matchedRequirementScore}/{base.maxRequirementScore}</strong></Table.Td>
        </Table.Tr>
      </Table.Tbody>
    </Table>
  </div>;
}

/** Показує секцію вимог у двох колонках виконаних і невиконаних пунктів. */
function RequirementSection({ group }: { group: RequirementGroupData }) {
  return <Accordion.Item value={group.key}>
    <Accordion.Control>
      <SectionHeader title={group.title} value={`${groupMatchedCount(group.items)}/${group.items.length}`} />
    </Accordion.Control>
    <Accordion.Panel>
      <div className={classes.requirementColumns}>
        <RequirementColumn items={group.items.filter((item) => item.matched)} tone="success" />
        <RequirementColumn items={group.items.filter((item) => !item.matched)} tone="danger" />
      </div>
    </Accordion.Panel>
  </Accordion.Item>;
}

/** Виводить уніфікований заголовок секції з числовою плашкою. */
function SectionHeader({ title, value }: { title: string; value: string }) {
  return <span className={classes.sectionHeader}>{title}<strong>{value}</strong></span>;
}

/** Виводить одну кольорову колонку пунктів вимог та причини невідповідності. */
function RequirementColumn({ items, tone }: { items: MatchRequirementItem[]; tone: "success" | "danger" }) {
  const ui = messages.applicationModule.analysis;
  const title = tone === "success" ? ui.fulfilled : ui.missing;
  return <div className={classes.requirementColumn} data-tone={tone}>
    <Text fw={800} size="sm">{title}</Text>
    {items.length === 0 ? <Text size="sm" className={classes.muted}>{ui.none}</Text> : items.map((item) => {
      const value = requirementValue(item);
      return <div className={classes.requirementItem} key={item.key}>
        {item.category === "SKILL"
          ? <div className={classes.skillRequirement}>{item.label}</div>
          : <div className={classes.requirementRow}>
            <span>{requirementLabel(item)}</span>
            <i>-</i>
            <strong>{value.value}</strong>
          </div>}
        {value.comment && <small>{value.comment}</small>}
        {tone === "danger" && item.blockingReason && <small className={classes.reason}>{blockingReason(item.blockingReason)}</small>}
      </div>;
    })}
  </div>;
}

/** Показує таблицю джерел skill score із підсумками по всіх колонках. */
function SkillSourcesTable({ details }: { details: ApplicationMatchDetails }) {
  const ui = messages.applicationModule.analysis;
  const skills = [...details.details.skillBreakdown]
    .sort((first, second) => second.skillScore - first.skillScore || first.skillName.localeCompare(second.skillName));
  const total = {
    courses: skills.reduce((sum, skill) => sum + skill.sources.courses.length, 0),
    coursePoints: skills.reduce((sum, skill) => sum + skill.coursePoints, 0),
    projects: skills.reduce((sum, skill) => sum + skill.sources.projects.length, 0),
    projectPoints: skills.reduce((sum, skill) => sum + skill.projectPoints, 0),
    experiences: skills.reduce((sum, skill) => sum + skill.sources.experiences.length, 0),
    experiencePoints: skills.reduce((sum, skill) => sum + skill.experiencePoints, 0),
    score: skills.reduce((sum, skill) => sum + skill.skillScore, 0),
  };
  return <div className={classes.tableScroll}>
    <Table className={classes.scoreTable}>
      <Table.Thead>
        <Table.Tr>
          <Table.Th>{ui.table.skill}</Table.Th>
          <Table.Th>{ui.table.courses}</Table.Th>
          <Table.Th>{ui.table.projects}</Table.Th>
          <Table.Th>{ui.table.experience}</Table.Th>
          <Table.Th>{ui.table.total}</Table.Th>
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {skills.map((skill) => <Table.Tr key={skill.skillId}>
          <Table.Td>{skill.skillName}</Table.Td>
          <Table.Td>{skill.sources.courses.length} (+{skill.coursePoints})</Table.Td>
          <Table.Td>{skill.sources.projects.length} (+{skill.projectPoints})</Table.Td>
          <Table.Td>{skill.sources.experiences.length} (+{skill.experiencePoints})</Table.Td>
          <Table.Td><strong>{skill.skillScore}</strong></Table.Td>
        </Table.Tr>)}
        <Table.Tr className={classes.totalRow}>
          <Table.Td><strong>{ui.table.totalRequirements}</strong></Table.Td>
          <Table.Td><strong>{total.courses} (+{total.coursePoints})</strong></Table.Td>
          <Table.Td><strong>{total.projects} (+{total.projectPoints})</strong></Table.Td>
          <Table.Td><strong>{total.experiences} (+{total.experiencePoints})</strong></Table.Td>
          <Table.Td><strong>{total.score}</strong></Table.Td>
        </Table.Tr>
      </Table.Tbody>
    </Table>
  </div>;
}

/** Показує деталізацію додаткових балів за мовами, локацією, освітою й пошуком. */
function AdditionalPoints({ details }: { details: ApplicationMatchDetails }) {
  const ui = messages.applicationModule.analysis;
  return <div className={classes.criteria}>
    {details.details.languageBreakdown.map((language) => (
      <div className={classes.criteriaItem} key={language.languageName}>
        <div className={classes.criteriaLine}>
          <span>{language.languageName}</span>
          <strong>+{language.languageBonus}</strong>
        </div>
        <small>{interpolate(ui.additionalComments.language, {
          student: language.studentLevel ?? ui.informationMissing,
          required: language.requiredLevel,
        })}</small>
      </div>
    ))}
    <div className={classes.criteriaItem}>
      <div className={classes.criteriaLine}><span>{ui.location}</span><strong>+{details.details.locationBreakdown.locationBonus}</strong></div>
      <small>{interpolate(ui.additionalComments.location, { value: locationMatchLabel(details.details.locationBreakdown.matchType) })}</small>
      {details.details.locationBreakdown.bonusRule && <small>{locationRule(details.details.locationBreakdown.bonusRule)}</small>}
    </div>
    <div className={classes.criteriaItem}>
      <div className={classes.criteriaLine}><span>{ui.education}</span><strong>+{details.details.educationBreakdown.educationBonus}</strong></div>
      <small>{interpolate(ui.additionalComments.education, { value: details.details.educationBreakdown.highestDegree ?? ui.informationMissing })}</small>
    </div>
    <div className={classes.criteriaItem}>
      <div className={classes.criteriaLine}><span>{ui.activeSearch}</span><strong>+{details.details.activeSearchBonus}</strong></div>
      <small>{details.details.activeSearchBonus > 0 ? ui.additionalComments.activeSearchEnabled : ui.additionalComments.activeSearchDisabled}</small>
    </div>
  </div>;
}

/** Формує основне значення і короткий коментар до пункту вимоги. */
function requirementValue(item: MatchRequirementItem) {
  const ui = messages.applicationModule.analysis;
  const details = item.details ?? {};
  const requiredValues = details.requiredValues as string[] | undefined;
  const studentValues = details.studentValues as string[] | undefined;
  if (requiredValues) {
    return {
      value: requiredValues.join(", ") || ui.none,
      comment: interpolate(ui.candidateValues, { value: studentValues?.join(", ") || ui.informationMissing }),
    };
  }
  if (item.category === "PROFESSION") {
    return {
      value: item.label,
      comment: interpolate(ui.candidateValues, { value: studentValues?.join(", ") || ui.informationMissing }),
    };
  }
  if (item.category === "SALARY") {
    const expected = details.studentMinSalary as number | null;
    return {
      value: salaryRange(details.vacancyMinSalary as number | null, details.vacancyMaxSalary as number | null),
      comment: expected === null ? ui.candidateSalaryFlexible : interpolate(ui.candidateSalary, { value: expected }),
    };
  }
  if (item.category === "LANGUAGE") {
    return {
      value: String(details.requiredLevel ?? ui.none),
      comment: interpolate(ui.candidateLanguage, { value: String(details.studentLevel ?? ui.informationMissing) }),
    };
  }
  if (item.category === "LOCATION" && details.matchType) return { value: locationMatchLabel(String(details.matchType)), comment: null };
  return { value: item.matched ? ui.fulfilled : ui.missing, comment: null };
}

/** Формує короткий діапазон зарплати для пояснення відповідності. */
function salaryRange(minimum: number | null, maximum: number | null) {
  const ui = messages.applicationModule.analysis;
  if (minimum !== null && maximum !== null) return `${minimum}-${maximum}`;
  if (minimum !== null) return interpolate(ui.salaryFrom, { value: minimum });
  return maximum !== null ? interpolate(ui.salaryTo, { value: maximum }) : ui.none;
}

/** Формує читабельну назву пункту вимоги. */
function requirementLabel(item: MatchRequirementItem) {
  const categories = messages.applicationModule.analysis.categories;
  if (item.category === "SKILL" || item.category === "LANGUAGE") return item.label;
  return categories[item.category as keyof typeof categories] ?? item.label;
}

/** Перекладає стабільний код причини блокування у текст інтерфейсу. */
function blockingReason(reason: string) {
  const reasons = messages.applicationModule.analysis.blockingReasons;
  return reasons[reason as keyof typeof reasons] ?? reason;
}

/** Перекладає правило нарахування бонусу за локацію. */
function locationRule(rule: string) {
  const rules = messages.applicationModule.analysis.locationRules;
  return rules[rule as keyof typeof rules] ?? rule;
}

/** Перекладає тип збігу локації. */
function locationMatchLabel(matchType: string) {
  const types = messages.applicationModule.analysis.locationMatches;
  return types[matchType as keyof typeof types] ?? matchType;
}

/** Перекладає deterministic summary code з backend у видимий текст. */
function summaryLabel(summary: string) {
  const summaries = messages.applicationModule.analysis.summaries;
  return summaries[summary as keyof typeof summaries] ?? summary;
}

/** Формує пораду кандидату щодо посилення відповідності. */
function studentAdvice(details: ApplicationMatchDetails) {
  const ui = messages.applicationModule.analysis;
  if (details.missingCriticalSkills.length) return ui.studentMissingSkills;
  if (details.missingLanguages.length) return ui.studentMissingLanguages;
  return ui.studentImprove;
}
