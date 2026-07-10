import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectToDatabase } from "@/lib/mongodb";
import { ensureVerticalCollectionMigrated } from "@/lib/models/industry";
import {
  ensureVerticalMappingReferencesMigrated,
  VerticalMappingModel,
} from "@/lib/models/vertical-mapping";
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
  normalizeGeneralFiltersForStorage,
  validateScheduleRulesNoOverlap,
  type CampaignDuplicatesSettings,
  type CampaignGeneralFilter,
  type CampaignScheduleRule,
} from "@/lib/campaign";
import { cloneScheduleRulesForCopy } from "@/lib/campaign-schedule-copy";
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

type IntakeSettingsActionPayload = {
  action?: string;
  rule?: CampaignScheduleRule;
  targetSellerIds?: string[];
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
      mapping.set("generalFilters", normalizeGeneralFiltersForStorage(body.generalFilters));
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
    const body = (await req.json()) as IntakeSettingsActionPayload;

    await connectToDatabase();
    await ensureVerticalMappingReferencesMigrated();

    const mapping = await findSellerVerticalMappingById(id, mappingId);
    if (!mapping) {
      return NextResponse.json({ message: "Seller API not found." }, { status: 404 });
    }

    if (body.action === "copy-schedule") {
      const targetSellerIds = Array.isArray(body.targetSellerIds)
        ? body.targetSellerIds.filter(
            (value): value is string => typeof value === "string" && value.trim().length > 0
          )
        : [];

      if (targetSellerIds.length === 0) {
        return NextResponse.json({ message: "Please select at least one publisher." }, { status: 400 });
      }

      if (!mapping.verticalRef) {
        return NextResponse.json(
          { message: "This publisher mapping has no product assigned." },
          { status: 400 }
        );
      }

      const copiedRules = cloneScheduleRulesForCopy(
        (mapping.scheduleRules ?? []).map((rule) => ({
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
        }))
      );

      const overlapMessage = validateScheduleRulesNoOverlap(
        copiedRules.map((rule, index) => ({ ...rule, id: `copy-${index}` }))
      );
      if (overlapMessage) {
        return NextResponse.json({ message: overlapMessage }, { status: 409 });
      }

      const schedulePayload = copiedRules.map((rule) => ({
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
      }));

      let updatedCount = 0;

      for (const targetSellerId of targetSellerIds) {
        if (!Types.ObjectId.isValid(targetSellerId) || targetSellerId === id) {
          continue;
        }

        const targetMappings = await VerticalMappingModel.find({
          sellerRef: new Types.ObjectId(targetSellerId),
          verticalRef: mapping.verticalRef,
        });

        for (const targetMapping of targetMappings) {
          targetMapping.set("scheduleRules", schedulePayload);
          if (mapping.timezone) {
            targetMapping.timezone = mapping.timezone;
          }
          targetMapping.markModified("scheduleRules");
          await targetMapping.save();
          updatedCount += 1;
        }
      }

      if (updatedCount === 0) {
        return NextResponse.json(
          {
            message:
              "No matching publisher product mappings were updated. Selected publishers may not have this product configured.",
          },
          { status: 400 }
        );
      }

      return NextResponse.json({
        message: `Schedule copied to ${updatedCount} publisher mapping(s).`,
        updatedCount,
      });
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
