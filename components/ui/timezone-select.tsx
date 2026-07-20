"use client";

import { useMemo } from "react";
import { DropdownSelect } from "@/components/ui/dropdown-select";
import { TIMEZONE_OPTIONS, getTimezoneOptionLabel } from "@/lib/campaign";

type TimezoneSelectProps = {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disablePortal?: boolean;
};

export function TimezoneSelect({
  id,
  value,
  onChange,
  placeholder = "Please select timezone",
  className,
  disablePortal = false,
}: TimezoneSelectProps) {
  const options = useMemo(
    () =>
      TIMEZONE_OPTIONS.map((timezone) => ({
        value: timezone,
        label: getTimezoneOptionLabel(timezone),
      })),
    []
  );

  return (
    <DropdownSelect
      id={id}
      value={value}
      options={options}
      onChange={onChange}
      placeholder={placeholder}
      className={className}
      disablePortal={disablePortal}
    />
  );
}
