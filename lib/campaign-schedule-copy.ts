import type { CampaignScheduleRule } from "@/lib/campaign";

export type CampaignScheduleRuleInput = Omit<CampaignScheduleRule, "id">;

export function cloneScheduleRulesForCopy(rules: CampaignScheduleRule[]): CampaignScheduleRuleInput[] {
  return rules.map((rule) => ({
    active: rule.active,
    action: rule.action,
    scheduleMethod: rule.scheduleMethod,
    days: [...rule.days],
    startHour: rule.startHour,
    startMinute: rule.startMinute,
    endHour: rule.endHour,
    endMinute: rule.endMinute,
    dailySoldLeadsLimit: rule.dailySoldLeadsLimit,
    dailyPostLeadsLimit: rule.dailyPostLeadsLimit,
  }));
}
