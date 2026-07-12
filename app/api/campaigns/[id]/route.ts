import { Types } from "mongoose";
import { NextResponse } from "next/server";
import { buildCampaignLookupContext } from "@/lib/campaign-context";
import { cloneScheduleRulesForCopy } from "@/lib/campaign-schedule-copy";
import { cloneGeneralFiltersForTarget } from "@/lib/campaign-filters-copy";
import {
  defaultScheduleRule,
  findScheduleRuleOverlap,
  getScheduleRuleOverlapMessage,
  normalizeGeneralFiltersForStorage,
  toCampaignRecord,
  validateScheduleRulesNoOverlap,
  type CampaignDuplicatesSettings,
  type CampaignGeneralFilter,
  type CampaignScheduleRule,
  type CampaignStatus,
} from "@/lib/campaign";
import { CampaignModel } from "@/lib/models/campaign";
import { BuyerModel } from "@/lib/models/buyer";
import { getAvailableIntegrationOptions, resolveBuyerIntegrations } from "@/lib/buyer-integrations";
import { connectToDatabase } from "@/lib/mongodb";
import { softDeleteUpdate } from "@/lib/soft-delete";
import { DEFAULT_POST_TIMEOUT_SECONDS, sanitizeIntegrationConfigValues } from "@/lib/campaign-integration-config";
import { IntegrationBuilderModel } from "@/lib/models/integration-builder";
import { toIntegrationBuilderRecord, type IntegrationBuilderConfigField } from "@/lib/integration-builder";
import { ensureVerticalCollectionMigrated, VerticalModel } from "@/lib/models/industry";

type Params = { params: Promise<{ id: string }> };

type CampaignUpdatePayload = {
  section?: "general" | "duplicates" | "filters" | "schedule" | "integration";
  name?: string;
  status?: CampaignStatus;
  campaignType?: string;
  timezone?: string;
  minPrice?: number | string;
  duplicates?: CampaignDuplicatesSettings;
  generalFilters?: CampaignGeneralFilter[];
  plDnplListIds?: string[];
  copyPlDnplToOtherCampaigns?: boolean;
  scheduleRules?: CampaignScheduleRule[];
  integrationId?: string;
  configValues?: Record<string, string>;
};

export async function GET(_: Request, context: Params) {
  try {
    const { id } = await context.params;

    if (!Types.ObjectId.isValid(id)) {
      return NextResponse.json({ message: "Invalid campaign id." }, { status: 400 });
    }

    await connectToDatabase();

    const campaign = await CampaignModel.findById(id).lean();
    if (!campaign) {
      return NextResponse.json({ message: "Campaign not found." }, { status: 404 });
    }

    const lookup = await buildCampaignLookupContext();

    return NextResponse.json(toCampaignRecord(campaign, lookup));
  } catch {
    return NextResponse.json({ message: "Failed to fetch campaign." }, { status: 500 });
  }
}

export async function PATCH(req: Request, context: Params) {
  try {
    const { id } = await context.params;
    const body = (await req.json()) as CampaignUpdatePayload;

    if (!Types.ObjectId.isValid(id)) {
      return NextResponse.json({ message: "Invalid campaign id." }, { status: 400 });
    }

    await connectToDatabase();

    const campaign = await CampaignModel.findById(id);
    if (!campaign) {
      return NextResponse.json({ message: "Campaign not found." }, { status: 404 });
    }

    if (body.section === "general" || !body.section) {
      if (body.name?.trim()) campaign.name = body.name.trim();
      if (body.status) campaign.status = body.status;
      if (body.campaignType === "Redirect" || body.campaignType === "Silent") {
        campaign.campaignType = body.campaignType;
      }
      if (body.timezone?.trim()) campaign.timezone = body.timezone.trim();
      if (body.minPrice !== undefined) {
        const minPrice = Number(body.minPrice);
        campaign.minPrice = Number.isFinite(minPrice) ? minPrice : campaign.minPrice;
      }
    }

    if (body.section === "duplicates" && body.duplicates) {
      campaign.duplicates = body.duplicates;
      campaign.markModified("duplicates");
    }

    if (body.section === "filters") {
      if (body.generalFilters) {
        campaign.set("generalFilters", normalizeGeneralFiltersForStorage(body.generalFilters));
        campaign.markModified("generalFilters");
      }
      if (body.plDnplListIds) {
        campaign.plDnplListIds = body.plDnplListIds;
      }
      if (body.copyPlDnplToOtherCampaigns !== undefined) {
        campaign.copyPlDnplToOtherCampaigns = Boolean(body.copyPlDnplToOtherCampaigns);
      }
    }

    if (body.section === "schedule" && body.scheduleRules) {
      const overlapMessage = validateScheduleRulesNoOverlap(body.scheduleRules);
      if (overlapMessage) {
        return NextResponse.json({ message: overlapMessage }, { status: 409 });
      }

      campaign.set(
        "scheduleRules",
        body.scheduleRules.map((rule) => ({
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
      campaign.markModified("scheduleRules");
    }

    if (body.section === "integration") {
      if (body.integrationId !== undefined) {
        const value = body.integrationId?.trim() ?? "";

        if (value) {
          if (!Types.ObjectId.isValid(value)) {
            return NextResponse.json({ message: "Invalid integration id." }, { status: 400 });
          }

          const buyer = await BuyerModel.findById(campaign.buyerRef).lean();
          if (!buyer) {
            return NextResponse.json({ message: "Buyer not found." }, { status: 404 });
          }

          const integrationOptions = await getAvailableIntegrationOptions();
          const { integrationIds: allowedIntegrationIds } = resolveBuyerIntegrations(buyer, integrationOptions);

          if (!allowedIntegrationIds.includes(value)) {
            return NextResponse.json(
              { message: "Integration is not assigned to this buyer." },
              { status: 400 }
            );
          }

          const integration = await IntegrationBuilderModel.findById(value).select({ _id: 1 }).lean();
          if (!integration) {
            return NextResponse.json({ message: "Integration not found." }, { status: 404 });
          }
        }

        campaign.integrationRef = value && Types.ObjectId.isValid(value) ? new Types.ObjectId(value) : null;
      }

      if (!campaign.integrationSettings) {
        campaign.integrationSettings = { postUrl: "", postTimeout: DEFAULT_POST_TIMEOUT_SECONDS, configValues: {} };
      }

      if (body.configValues) {
        await ensureVerticalCollectionMigrated();
        const integrationId =
          body.integrationId?.trim() ||
          (campaign.integrationRef ? campaign.integrationRef.toString() : "");

        let configFields: IntegrationBuilderConfigField[] = [];
        if (integrationId && Types.ObjectId.isValid(integrationId)) {
          const integration = await IntegrationBuilderModel.findById(integrationId).lean();
          if (integration) {
            const verticals = await VerticalModel.find().select({ _id: 1, name: 1 }).lean();
            const verticalNameById = new Map(verticals.map((vertical) => [vertical._id.toString(), vertical.name]));
            configFields = toIntegrationBuilderRecord(integration, verticalNameById).configFields;
          }
        }

        const sanitizedValues = sanitizeIntegrationConfigValues(configFields, body.configValues);
        campaign.integrationSettings.configValues = sanitizedValues;
        campaign.integrationSettings.postUrl = sanitizedValues.url?.trim() ?? "";
        const parsedTimeout = Number(sanitizedValues.timeout);
        campaign.integrationSettings.postTimeout =
          Number.isFinite(parsedTimeout) && parsedTimeout > 0 ? parsedTimeout : DEFAULT_POST_TIMEOUT_SECONDS;
      }

      campaign.markModified("integrationSettings");
    }

    await campaign.save();

    const lookup = await buildCampaignLookupContext();

    return NextResponse.json(toCampaignRecord(campaign.toObject(), lookup));
  } catch {
    return NextResponse.json({ message: "Failed to update campaign." }, { status: 500 });
  }
}

export async function DELETE(_: Request, context: Params) {
  try {
    const { id } = await context.params;

    if (!Types.ObjectId.isValid(id)) {
      return NextResponse.json({ message: "Invalid campaign id." }, { status: 400 });
    }

    await connectToDatabase();

    const campaign = await CampaignModel.findByIdAndUpdate(id, softDeleteUpdate(), { new: true });
    if (!campaign) {
      return NextResponse.json({ message: "Campaign not found." }, { status: 404 });
    }

    return NextResponse.json({ message: "Campaign deleted." });
  } catch {
    return NextResponse.json({ message: "Failed to delete campaign." }, { status: 500 });
  }
}

export async function POST(req: Request, context: Params) {
  try {
    const { id } = await context.params;
    const body = (await req.json()) as {
      action?: string;
      rule?: CampaignScheduleRule;
      targetCampaignIds?: string[];
      plDnplListIds?: string[];
      generalFilters?: CampaignGeneralFilter[];
    };

    if (!Types.ObjectId.isValid(id)) {
      return NextResponse.json({ message: "Invalid campaign id." }, { status: 400 });
    }

    await connectToDatabase();

    const campaign = await CampaignModel.findById(id);
    if (!campaign) {
      return NextResponse.json({ message: "Campaign not found." }, { status: 404 });
    }

    if (body.action === "add-schedule-rule") {
      const nextRule = body.rule ?? defaultScheduleRule();

      if (nextRule.days.length === 0) {
        return NextResponse.json({ message: "Please select at least one day." }, { status: 400 });
      }

      const existingRules = campaign.scheduleRules.map((rule) => ({
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

      campaign.scheduleRules.push({
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
      await campaign.save();
    }

    if (body.action === "copy-schedule") {
      const targetCampaignIds = Array.isArray(body.targetCampaignIds)
        ? body.targetCampaignIds.filter((value): value is string => typeof value === "string" && value.trim().length > 0)
        : [];

      if (targetCampaignIds.length === 0) {
        return NextResponse.json({ message: "Please select at least one campaign." }, { status: 400 });
      }

      const copiedRules = cloneScheduleRulesForCopy(
        campaign.scheduleRules.map((rule) => ({
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

      let updatedCount = 0;

      for (const targetCampaignId of targetCampaignIds) {
        if (!Types.ObjectId.isValid(targetCampaignId) || targetCampaignId === id) {
          continue;
        }

        const targetCampaign = await CampaignModel.findById(targetCampaignId);
        if (!targetCampaign) {
          continue;
        }

        targetCampaign.set(
          "scheduleRules",
          copiedRules.map((rule) => ({
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
        targetCampaign.markModified("scheduleRules");
        await targetCampaign.save();
        updatedCount += 1;
      }

      if (updatedCount === 0) {
        return NextResponse.json({ message: "No valid target campaigns were updated." }, { status: 400 });
      }

      return NextResponse.json({
        message: `Schedule copied to ${updatedCount} campaign(s).`,
        updatedCount,
      });
    }

    if (body.action === "copy-pl-dnpl") {
      const targetCampaignIds = Array.isArray(body.targetCampaignIds)
        ? body.targetCampaignIds.filter((value): value is string => typeof value === "string" && value.trim().length > 0)
        : [];

      if (targetCampaignIds.length === 0) {
        return NextResponse.json({ message: "Please select at least one campaign." }, { status: 400 });
      }

      const listIds = Array.isArray(body.plDnplListIds)
        ? body.plDnplListIds.filter((value): value is string => typeof value === "string" && Types.ObjectId.isValid(value))
        : (campaign.plDnplListIds ?? []);

      let updatedCount = 0;

      for (const targetCampaignId of targetCampaignIds) {
        if (!Types.ObjectId.isValid(targetCampaignId) || targetCampaignId === id) {
          continue;
        }

        const result = await CampaignModel.updateOne(
          { _id: targetCampaignId },
          { $set: { plDnplListIds: listIds } }
        );

        if (result.matchedCount > 0) {
          updatedCount += 1;
        }
      }

      if (updatedCount === 0) {
        return NextResponse.json({ message: "No valid target campaigns were updated." }, { status: 400 });
      }

      return NextResponse.json({
        message: `PL/DNPL settings copied to ${updatedCount} campaign(s).`,
        updatedCount,
      });
    }

    if (body.action === "copy-filters") {
      const targetCampaignIds = Array.isArray(body.targetCampaignIds)
        ? body.targetCampaignIds.filter(
            (value): value is string => typeof value === "string" && value.trim().length > 0
          )
        : [];

      if (targetCampaignIds.length === 0) {
        return NextResponse.json({ message: "Please select at least one campaign." }, { status: 400 });
      }

      const sourceFilters = normalizeGeneralFiltersForStorage(
        Array.isArray(body.generalFilters)
          ? body.generalFilters
          : ((campaign.generalFilters ?? []) as CampaignGeneralFilter[])
      );

      let updatedCount = 0;

      for (const targetCampaignId of targetCampaignIds) {
        if (!Types.ObjectId.isValid(targetCampaignId) || targetCampaignId === id) {
          continue;
        }

        const targetCampaign = await CampaignModel.findById(targetCampaignId);
        if (!targetCampaign) {
          continue;
        }

        const verticalId = targetCampaign.verticalRef?.toString() ?? "";
        const vertical = verticalId ? await VerticalModel.findById(verticalId).lean() : null;
        const targetFields = Array.isArray(vertical?.fields)
          ? (vertical.fields as Array<{
              _id?: { toString(): string };
              fieldName?: string;
              description?: string;
              dataTypeFilter?: string | null;
            }>).map((field) => ({
              id: field._id?.toString(),
              fieldName: field.fieldName?.trim() || "",
              description: field.description?.trim() || field.fieldName?.trim() || "",
              dataTypeFilter: field.dataTypeFilter,
            }))
          : [];

        const copiedFilters = cloneGeneralFiltersForTarget(
          sourceFilters,
          targetFields.filter((field) => field.fieldName)
        );

        targetCampaign.set("generalFilters", copiedFilters);
        targetCampaign.markModified("generalFilters");
        await targetCampaign.save();
        updatedCount += 1;
      }

      if (updatedCount === 0) {
        return NextResponse.json({ message: "No valid target campaigns were updated." }, { status: 400 });
      }

      return NextResponse.json({
        message: `Filter settings copied to ${updatedCount} campaign(s).`,
        updatedCount,
      });
    }

    const lookup = await buildCampaignLookupContext();

    return NextResponse.json(toCampaignRecord(campaign.toObject(), lookup));
  } catch {
    return NextResponse.json({ message: "Failed to update campaign schedule." }, { status: 500 });
  }
}
