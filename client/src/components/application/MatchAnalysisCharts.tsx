import { useState } from "react";
import { BarChart, DonutChart } from "@mantine/charts";
import { SegmentedControl, Text } from "@mantine/core";
import { messages } from "../../locales/localizedMessages";
import type { ApplicationMatchDetails } from "./applicationTypes";
import { groupMatchedCount, type RequirementGroupData, type RequirementGroupKey } from "./matchAnalysisGroups";
import classes from "./MatchAnalysisCharts.module.scss";

type Props = {
  details: ApplicationMatchDetails;
  groups: RequirementGroupData[];
};

type ChartMode = "skills" | "sources";

const groupColors: Record<RequirementGroupKey, { strong: string; pale: string }> = {
  criticalSkills: { strong: "red.7", pale: "red.2" },
  conditions: { strong: "violet.7", pale: "violet.2" },
  important: { strong: "teal.7", pale: "teal.2" },
  desirable: { strong: "yellow.7", pale: "yellow.2" },
};

/** Показує огляд покриття вимог і перемиканий розподіл доказів комплексного бала. */
export function MatchAnalysisCharts({ details, groups }: Props) {
  const ui = messages.applicationModule.analysis.charts;
  const [mode, setMode] = useState<ChartMode>("skills");
  const donutData = buildCoverageData(groups);
  const bars = mode === "skills" ? buildSkillScoreData(details) : buildSourceCountData(details);

  return <div className={classes.visualRow}>
    <article className={`${classes.chartCard} ${classes.coverageCard}`}>
      <Text fw={900}>{ui.coverageTitle}</Text>
      {donutData.length > 0
        ? <div className={classes.donutBody}>
          <DonutChart
            chartLabel={`${details.details.baseRequirements.matchedRequirementsCount}/${details.details.baseRequirements.totalRequirementsCount}`}
            data={donutData}
            size={182}
            thickness={30}
            tooltipDataSource="segment"
            valueFormatter={(value) => `${value} ${ui.points}`}
          />
          <div className={classes.legend}>
            {groups.filter((group) => group.items.length > 0).map((group) => (
              <div className={classes.legendLine} key={group.key}>
                <i style={{ backgroundColor: `var(--mantine-color-${groupColors[group.key].strong.replace(".", "-")})` }} />
                <span>{group.title}</span>
                <strong>{groupMatchedCount(group.items)}/{group.items.length}</strong>
              </div>
            ))}
          </div>
        </div>
        : <Text size="sm" className={classes.muted}>{ui.noData}</Text>}
    </article>
    <article className={classes.chartCard}>
      <div className={classes.barHeader}>
        <Text fw={900}>{ui.scoreSourcesTitle}</Text>
        <SegmentedControl
          data={[
            { label: ui.skillsMode, value: "skills" },
            { label: ui.sourcesMode, value: "sources" },
          ]}
          onChange={(value) => setMode(value as ChartMode)}
          size="xs"
          value={mode}
        />
      </div>
      {bars.length > 0
        ? <BarChart
          data={bars}
          dataKey="label"
          h={Math.max(180, bars.length * 38)}
          orientation="vertical"
          series={[{ name: "value", label: mode === "skills" ? ui.pointsSeries : ui.recordsSeries, color: "violet.6" }]}
          withBarValueLabel
          withLegend={false}
          tickLine="none"
          gridAxis="none"
          yAxisProps={{ width: 110 }}
        />
        : <Text size="sm" className={classes.muted}>{ui.noData}</Text>}
    </article>
  </div>;
}

/** Створює насичені й пастельні сектори кожної групи відповідно до виконаних пунктів. */
function buildCoverageData(groups: RequirementGroupData[]) {
  const ui = messages.applicationModule.analysis.charts;
  return groups.flatMap((group) => {
    const matched = groupMatchedCount(group.items);
    const missing = group.items.length - matched;
    return [
      ...(matched > 0 ? [{ name: `${group.title}: ${ui.fulfilled}`, value: matched, color: groupColors[group.key].strong }] : []),
      ...(missing > 0 ? [{ name: `${group.title}: ${ui.missing}`, value: missing, color: groupColors[group.key].pale }] : []),
    ];
  });
}

/** Формує відсортований розподіл балів, отриманих за кожну навичку. */
function buildSkillScoreData(details: ApplicationMatchDetails) {
  return [...details.details.skillBreakdown]
    .sort((first, second) => second.skillScore - first.skillScore || first.skillName.localeCompare(second.skillName))
    .map((skill) => ({ label: skill.skillName, value: skill.skillScore }));
}

/** Підсумовує кількість записів профілю, що виступають доказами відповідності. */
function buildSourceCountData(details: ApplicationMatchDetails) {
  const ui = messages.applicationModule.analysis.charts.sources;
  const skills = details.details.skillBreakdown;
  return [
    { label: ui.courses, value: skills.reduce((sum, skill) => sum + skill.sources.courses.length, 0) },
    { label: ui.projects, value: skills.reduce((sum, skill) => sum + skill.sources.projects.length, 0) },
    { label: ui.experience, value: skills.reduce((sum, skill) => sum + skill.sources.experiences.length, 0) },
    { label: ui.education, value: details.details.educationBreakdown.highestDegree ? 1 : 0 },
  ].sort((first, second) => second.value - first.value);
}
