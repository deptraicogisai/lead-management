import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { ensureVerticalCollectionMigrated } from "@/lib/models/industry";
import { ensureVerticalMappingReferencesMigrated } from "@/lib/models/vertical-mapping";
import type { MappingFieldDoc } from "@/lib/mapping-field-api";
import {
  syncGeneralFiltersWithFields,
  toMappingIntakeSettings,
  type MappingIntakeSettingsRecord,
} from "@/lib/mapping-intake-settings";
import {
  defaultScheduleRule,
  findScheduleRuleOverlap,
  getScheduleRuleOverlapMessage,
  validateScheduleRulesNoOverlap,
  type CampaignDuplicatesSettings,
  type CampaignGeneralFilter,
  type CampaignScheduleRule,
} from "@/lib/campaign";
import {
  ensureSellerVerticalMappingFieldsSeededById,
  findSellerVerticalMappingById,
} from "@/lib/seller-vertical-mapping";

type Params = { params: Promise<{ id: string; mappingId: string }> };

type IntakeSettingsUpdatePayload = {
  section?: "duplicates" | "filters" | "schedule";
  timezone?: string;
  duplicates?: CampaignDuplicatesSettings;
  generalFilters?: CampaignGeneralFilter[];
  scheduleRules?: CampaignScheduleRule[];
};

export async function GET(_: Request, context: Params) {
  try {
    const { id, mappingId } = await context.params;
    await connectToDatabase();
    await ensureVerticalCollectionMigrated();
    await ensureVerticalMappingReferencesMigrated();

    const seeded = await ensureSellerVerticalMappingFieldsSeededById(id, mappingId);
    if (!seeded) {
      return NextResponse.json({ message: "Seller API not found." }, { status: 404 });
    }

    const settings = toMappingIntakeSettings(
      seeded.mapping.toObject(),
      seeded.mappingFields as MappingFieldDoc[]
    );

    const syncedFilters = syncGeneralFiltersWithFields(
      settings.generalFilters,
      seeded.mappingFields as MappingFieldDoc[]
    );

    if (syncedFilters.length !== (seeded.mapping.generalFilters?.length ?? 0)) {
      seeded.mapping.set("generalFilters", syncedFilters);
      await seeded.mapping.save();
    }

    return NextResponse.json({
      ...settings,
      generalFilters: syncedFilters,
    } satisfies MappingIntakeSettingsRecord);
  } catch {
    return NextResponse.json({ message: "Failed to fetch intake settings." }, { status: 500 });
  }
}

export async function PATCH(req: Request, context: Params) {
  try {
    const { id, mappingId } = await context.params;
    const body = (await req.json()) as IntakeSettingsUpdatePayload;

    await connectToDatabase();
    await ensureVerticalCollectionMigrated();
    await ensureVerticalMappingReferencesMigrated();

    const mapping = await findSellerVerticalMappingById(id, mappingId);
    if (!mapping) {
      return NextResponse.json({ message: "Seller API not found." }, { status: 404 });
    }

    if (body.timezone?.trim()) {
      mapping.timezone = body.timezone.trim();
    }

    if (body.section === "duplicates" && body.duplicates) {
      mapping.duplicates = body.duplicates;
      mapping.markModified("duplicates");
    }

    if (body.section === "filters" && body.generalFilters) {
      mapping.set("generalFilters", body.generalFilters);
      mapping.markModified("generalFilters");
    }

    if (body.section === "schedule" && body.scheduleRules) {
      const overlapMessage = validateScheduleRulesNoOverlap(body.scheduleRules);
      if (overlapMessage) {
        return NextResponse.json({ message: overlapMessage }, { status: 409 });
      }

      mapping.set(
        "scheduleRules",
        body.scheduleRules.map((rule) => ({
          _id: rule.id || undefined,
          active: rule.active,
          action: rule.action,
          scheduleMethod: rule.scheduleMethod,
          days: rule.days,
          startHour: rule.startHour,
          startMinute: rule.startMinute,
          endHour: rule.endHour,
          endMinute: rule.endMinute,
          dailySoldLeadsLimit: rule.dailySoldLeadsLimit,
          dailyPostLeadsLimit: rule.dailyPostLeadsLimit,
        }))
      );
      mapping.markModified("scheduleRules");
    }

    await mapping.save();

    const mappingFields = (mapping.fields as MappingFieldDoc[] | undefined) ?? [];
    return NextResponse.json(toMappingIntakeSettings(mapping.toObject(), mappingFields));
  } catch {
    return NextResponse.json({ message: "Failed to update intake settings." }, { status: 500 });
  }
}

export async function POST(req: Request, context: Params) {
  try {
    const { id, mappingId } = await context.params;
    const body = (await req.json()) as { action?: string; rule?: CampaignScheduleRule };

    await connectToDatabase();
    await ensureVerticalMappingReferencesMigrated();

    const mapping = await findSellerVerticalMappingById(id, mappingId);
    if (!mapping) {
      return NextResponse.json({ message: "Seller API not found." }, { status: 404 });
    }

    if (body.action === "add-schedule-rule") {
      const nextRule = body.rule ?? defaultScheduleRule();

      if (nextRule.days.length === 0) {
        return NextResponse.json({ message: "Please select at least one day." }, { status: 400 });
      }

      const existingRules = (mapping.scheduleRules ?? []).map((rule) => ({
        id: rule._id?.toString() ?? "",
        active: Boolean(rule.active),
        action: rule.action,
        scheduleMethod: rule.scheduleMethod,
        days: rule.days ?? [],
        startHour: rule.startHour,
        startMinute: rule.startMinute,
        endHour: rule.endHour,
        endMinute: rule.endMinute,
        dailySoldLeadsLimit: rule.dailySoldLeadsLimit ?? null,
        dailyPostLeadsLimit: rule.dailyPostLeadsLimit ?? null,
      }));

      const overlap = findScheduleRuleOverlap(nextRule, existingRules);
      if (overlap) {
        return NextResponse.json({ message: getScheduleRuleOverlapMessage(nextRule, overlap) }, { status: 409 });
      }

      mapping.scheduleRules.push({
        active: nextRule.active,
        action: nextRule.action,
        scheduleMethod: nextRule.scheduleMethod,
        days: nextRule.days,
        startHour: nextRule.startHour,
        startMinute: nextRule.startMinute,
        endHour: nextRule.endHour,
        endMinute: nextRule.endMinute,
        dailySoldLeadsLimit: nextRule.dailySoldLeadsLimit,
        dailyPostLeadsLimit: nextRule.dailyPostLeadsLimit,
      });
      await mapping.save();
    }

    const mappingFields = (mapping.fields as MappingFieldDoc[] | undefined) ?? [];
    return NextResponse.json(toMappingIntakeSettings(mapping.toObject(), mappingFields));
  } catch {
    return NextResponse.json({ message: "Failed to update schedule rules." }, { status: 500 });
  }
}
