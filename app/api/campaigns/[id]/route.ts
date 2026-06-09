import { Types } from "mongoose";
import { NextResponse } from "next/server";
import { buildCampaignLookupContext } from "@/lib/campaign-context";
import {
  defaultScheduleRule,
  toCampaignRecord,
  type CampaignDuplicatesSettings,
  type CampaignGeneralFilter,
  type CampaignScheduleRule,
  type CampaignStatus,
} from "@/lib/campaign";
import { CampaignModel } from "@/lib/models/campaign";
import { connectToDatabase } from "@/lib/mongodb";

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
  postUrl?: string;
  postTimeout?: number | string;
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
        campaign.set("generalFilters", body.generalFilters);
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
        campaign.integrationRef = value && Types.ObjectId.isValid(value) ? new Types.ObjectId(value) : null;
      }

      if (!campaign.integrationSettings) campaign.integrationSettings = { postUrl: "", postTimeout: 90 };

      if (body.postUrl !== undefined) {
        campaign.integrationSettings.postUrl = body.postUrl?.trim() ?? "";
      }

      if (body.postTimeout !== undefined) {
        const parsed = Number(body.postTimeout);
        campaign.integrationSettings.postTimeout = Number.isFinite(parsed) && parsed > 0 ? parsed : 90;
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

    const campaign = await CampaignModel.findByIdAndDelete(id);
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
    const body = (await req.json()) as { action?: string; rule?: CampaignScheduleRule };

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

    const lookup = await buildCampaignLookupContext();

    return NextResponse.json(toCampaignRecord(campaign.toObject(), lookup));
  } catch {
    return NextResponse.json({ message: "Failed to update campaign schedule." }, { status: 500 });
  }
}
