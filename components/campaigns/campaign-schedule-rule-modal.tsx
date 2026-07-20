"use client";

import { useEffect, useState } from "react";
import { FieldLabel, Input } from "@/components/ui/form-controls";
import { DropdownSelect } from "@/components/ui/dropdown-select";
import { Modal } from "@/components/ui/modal";
import { PrimaryButton } from "@/components/ui/form-controls";
import {
  buildHourOptions,
  buildMinuteOptions,
  defaultScheduleRule,
  SCHEDULE_ACTION_OPTIONS,
  SCHEDULE_DAY_OPTIONS,
  type CampaignScheduleRule,
} from "@/lib/campaign";
import { cn } from "@/lib/utils";

type CampaignScheduleRuleModalProps = {
  open: boolean;
  onClose: () => void;
  onSave: (rule: Omit<CampaignScheduleRule, "id">) => void;
  initialRule?: CampaignScheduleRule | null;
};

export function CampaignScheduleRuleModal({ open, onClose, onSave, initialRule }: CampaignScheduleRuleModalProps) {
  const [draft, setDraft] = useState(defaultScheduleRule());
  const isEditing = Boolean(initialRule);

  useEffect(() => {
    if (!open) return;

    if (initialRule) {
      const { id: _id, ...rest } = initialRule;
      setDraft(rest);
      return;
    }

    setDraft(defaultScheduleRule());
  }, [open, initialRule]);

  const hourOptions = buildHourOptions();
  const minuteOptions = buildMinuteOptions();

  const toggleDay = (day: string) => {
    setDraft((current) => ({
      ...current,
      days: current.days.includes(day) ? current.days.filter((item) => item !== day) : [...current.days, day],
    }));
  };

  const setAllDays = () => {
    setDraft((current) => ({ ...current, days: [...SCHEDULE_DAY_OPTIONS] }));
  };

  return (
    <Modal
      open={open}
      title={isEditing ? "Edit Schedule Rule" : "Add Schedule Rule"}
      onClose={onClose}
      panelClassName="max-w-3xl"
      actions={
        <>
          <button type="button" onClick={onClose} className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-100">
            Cancel
          </button>
          <PrimaryButton type="button" onClick={() => onSave(draft)} className="bg-emerald-700 hover:bg-emerald-800">
            {isEditing ? "Update Rule" : "Save Rule"}
          </PrimaryButton>
        </>
      }
    >
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <FieldLabel htmlFor="schedule-status" label="Status" />
          <button
            id="schedule-status"
            type="button"
            onClick={() => setDraft((current) => ({ ...current, active: !current.active }))}
            className={cn(
              "rounded-full px-4 py-2 text-sm font-semibold",
              draft.active ? "bg-emerald-800 text-white" : "bg-slate-200 text-slate-600"
            )}
          >
            {draft.active ? "ON" : "OFF"}
          </button>
        </div>

        <div>
          <FieldLabel htmlFor="schedule-action" label="Action" />
          <DropdownSelect
            id="schedule-action"
            value={draft.action}
            options={SCHEDULE_ACTION_OPTIONS.map((option) => ({
              value: option,
              label: option,
            }))}
            onChange={(action) =>
              setDraft((current) => ({
                ...current,
                action: action as typeof current.action,
              }))
            }
          />
        </div>

        <div>
          <FieldLabel htmlFor="schedule-method" label="Schedule Method" />
          <DropdownSelect
            id="schedule-method"
            value={draft.scheduleMethod}
            options={[{ value: "Days", label: "Days" }]}
            onChange={() => undefined}
            disabled
          />
        </div>

        <div className="md:col-span-2">
          <div className="mb-2 flex items-center gap-2">
            <FieldLabel htmlFor="schedule-days" label="Days" />
            <button type="button" onClick={setAllDays} className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
              Set 24/7
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {SCHEDULE_DAY_OPTIONS.map((day) => (
              <button
                key={day}
                type="button"
                onClick={() => toggleDay(day)}
                className={cn(
                  "rounded-lg px-3 py-2 text-sm font-medium",
                  draft.days.includes(day) ? "bg-emerald-800 text-white" : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-200"
                )}
              >
                {day}
              </button>
            ))}
          </div>
        </div>

        <div>
          <FieldLabel htmlFor="schedule-start-hour" label="Start time" />
          <div className="grid grid-cols-2 gap-2">
            <DropdownSelect
              id="schedule-start-hour"
              value={draft.startHour}
              options={hourOptions.map((hour) => ({ value: hour, label: hour }))}
              onChange={(startHour) =>
                setDraft((current) => ({ ...current, startHour }))
              }
            />
            <DropdownSelect
              value={draft.startMinute}
              options={minuteOptions.map((minute) => ({ value: minute, label: minute }))}
              onChange={(startMinute) =>
                setDraft((current) => ({ ...current, startMinute }))
              }
            />
          </div>
        </div>

        <div>
          <FieldLabel htmlFor="schedule-end-hour" label="End time" />
          <div className="grid grid-cols-2 gap-2">
            <DropdownSelect
              id="schedule-end-hour"
              value={draft.endHour}
              options={hourOptions.map((hour) => ({ value: hour, label: hour }))}
              onChange={(endHour) =>
                setDraft((current) => ({ ...current, endHour }))
              }
            />
            <DropdownSelect
              value={draft.endMinute}
              options={minuteOptions.map((minute) => ({ value: minute, label: minute }))}
              onChange={(endMinute) =>
                setDraft((current) => ({ ...current, endMinute }))
              }
            />
          </div>
        </div>

        <div>
          <FieldLabel htmlFor="schedule-sold-limit" label="Daily Sold Leads Limit" />
          <Input id="schedule-sold-limit" type="number" min={0} value={draft.dailySoldLeadsLimit ?? ""} onChange={(e) => setDraft((current) => ({ ...current, dailySoldLeadsLimit: e.target.value ? Number(e.target.value) : null }))} placeholder="Unlimited" />
        </div>

        <div>
          <FieldLabel htmlFor="schedule-post-limit" label="Daily Post Leads Limit" />
          <Input id="schedule-post-limit" type="number" min={0} value={draft.dailyPostLeadsLimit ?? ""} onChange={(e) => setDraft((current) => ({ ...current, dailyPostLeadsLimit: e.target.value ? Number(e.target.value) : null }))} />
        </div>
      </div>
    </Modal>
  );
}
