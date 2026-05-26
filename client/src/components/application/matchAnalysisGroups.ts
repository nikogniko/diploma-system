import { messages } from "../../locales/localizedMessages";
import type { MatchRequirementItem } from "./applicationTypes";

export type RequirementGroupKey = "criticalSkills" | "conditions" | "important" | "desirable";

export type RequirementGroupData = {
  key: RequirementGroupKey;
  title: string;
  items: MatchRequirementItem[];
};

/** Розподіляє пункти аналізу у чотири стабільні групи для списків і діаграм. */
export function buildRequirementGroups(items: MatchRequirementItem[]): RequirementGroupData[] {
  const ui = messages.applicationModule.analysis.sections;
  return [
    {
      key: "criticalSkills",
      title: ui.criticalSkills,
      items: items.filter((item) => item.category === "SKILL" && item.details?.requirementWeight === "CRITICAL"),
    },
    {
      key: "conditions",
      title: ui.conditions,
      items: items.filter((item) => item.category !== "SKILL"),
    },
    {
      key: "important",
      title: ui.important,
      items: items.filter((item) => item.category === "SKILL" && item.details?.requirementWeight === "IMPORTANT"),
    },
    {
      key: "desirable",
      title: ui.desirable,
      items: items.filter((item) => item.category === "SKILL" && item.details?.requirementWeight === "NICE_TO_HAVE"),
    },
  ];
}

/** Повертає кількість виконаних пунктів певної групи вимог. */
export function groupMatchedCount(items: MatchRequirementItem[]) {
  return items.filter((item) => item.matched).length;
}

/** Повертає зважене покриття групи для пояснення базової відповідності. */
export function groupWeightedCoverage(items: MatchRequirementItem[]) {
  const matched = items.filter((item) => item.matched).reduce((sum, item) => sum + item.weight, 0);
  return `${matched}/${items.reduce((sum, item) => sum + item.weight, 0)}`;
}
