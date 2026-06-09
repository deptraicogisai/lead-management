"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  Braces,
  ChevronDown,
  ExternalLink,
  FileJson2,
  FlaskConical,
  House,
  Info,
  Minus,
  Plus,
  Settings2,
  Trash2,
  Upload,
  Waypoints,
} from "lucide-react";
import { TwigTemplateInput } from "@/components/integration-builder/twig-template-input";
import { FormError, Input, PrimaryButton } from "@/components/ui/form-controls";
import { Modal } from "@/components/ui/modal";
import { PageSection } from "@/components/ui/state";
import type { ApiFieldConfig } from "@/lib/mock-data";
import type {
  IntegrationBuilderArrayMappingEntry,
  IntegrationBuilderConfigField,
  IntegrationBuilderRequestMapping,
  IntegrationBuilderRequestMappingDataRow,
  IntegrationBuilderRequestMappingHeader,
  IntegrationBuilderResponseMapping,
} from "@/lib/integration-builder";
import type { IntegrationBuilderResponseMappingField } from "@/lib/response-mapping";
import {
  fieldNameToSectionTitle,
  mergeArrayMappingEntry,
  type ArrayMappingEntry,
} from "@/lib/vertical-field";
import { cn } from "@/lib/utils";
import { toLeadFieldTemplate } from "@/lib/lead-template";
import { validateRequestMappingTwigPayload, validateResponseMappingTwigPayload } from "@/lib/twig-template";

function RequestMappingCollapsible({ open, children }: { open: boolean; children: ReactNode }) {
  return (
    <div
      className={cn(
        "grid transition-[grid-template-rows,opacity] duration-300 ease-in-out motion-reduce:transition-none",
        open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
      )}
      aria-hidden={!open}
    >
      <div className="min-h-0 overflow-hidden">
        <div
          className={cn(
            "transition-[transform,opacity] duration-300 ease-in-out motion-reduce:transition-none",
            open ? "translate-y-0 opacity-100" : "-translate-y-2 opacity-0"
          )}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

function RequestMappingToggle({
  open,
  label,
  onToggle,
}: {
  open: boolean;
  label: string;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 transition-colors duration-200 hover:underline dark:text-blue-300"
    >
      <ChevronDown
        size={16}
        className={cn("shrink-0 transition-transform duration-300 ease-in-out motion-reduce:transition-none", open && "rotate-180")}
      />
      <span>
        {label} ({open ? "Hide" : "Show"})
      </span>
    </button>
  );
}

const builderTabs = [
  {
    id: "general",
    label: "General",
    icon: House,
    title: "General",
    description: "Use this section for basic builder information, ownership, naming, and high-level flow setup.",
    bullets: [
      "Define builder name, status, and ownership.",
      "Track high-level integration notes and purpose.",
      "Prepare base information before configuring mappings.",
    ],
  },
  {
    id: "integration-config",
    label: "Integration Config",
    icon: Settings2,
    title: "Integration Config",
    description: "Configure connection details, endpoints, authentication, and reusable integration-level behavior.",
    bullets: [
      "Set target endpoint and method.",
      "Manage API credentials and request headers.",
      "Define reusable delivery configuration for this builder.",
    ],
  },
  {
    id: "array-mapping",
    label: "Array Mapping",
    icon: Braces,
    title: "Array Mapping",
    description: "Handle array-based payload structures and map repeating groups from source to destination.",
    bullets: [
      "Map nested array nodes and repeated sections.",
      "Control source-to-destination grouping behavior.",
      "Prepare transformations for complex request bodies.",
    ],
  },
  {
    id: "request-mapping",
    label: "Request Mapping",
    icon: FileJson2,
    title: "Request Mapping",
    description: "Map outbound request fields and shape the payload that will be sent to external systems.",
    bullets: [
      "Define destination keys for every source field.",
      "Apply request-level payload structure.",
      "Review request transformation output before delivery.",
    ],
  },
  {
    id: "response-mapping",
    label: "Response Mapping",
    icon: Waypoints,
    title: "Response Mapping",
    description: "Capture and interpret response values so downstream logic can react to success, fail, or custom statuses.",
    bullets: [
      "Map response fields and status keys.",
      "Normalize third-party response structures.",
      "Support future conditional routing from response values.",
    ],
  },
  {
    id: "testing",
    label: "Testing",
    icon: FlaskConical,
    title: "Testing",
    description: "Execute requests and validate request-response behavior before promoting the integration flow.",
    bullets: [
      "Send sample payloads for validation.",
      "Inspect response and mapped status values.",
      "Confirm the builder is ready before go-live.",
    ],
  },
] as const;

type HeaderRow = {
  id: string;
  key: string;
  value: string;
};

type RequestDataRow = {
  id: string;
  name: string;
  type: string;
  value: string;
};

type ConfigFieldRow = {
  id: string;
  variableName: string;
  label: string;
  type: string;
  required: boolean;
};

type ResponseMappingRow = {
  id: string;
  key: string;
  value: string;
};

function mapResponseFieldsToRows(fields: IntegrationBuilderResponseMappingField[]): ResponseMappingRow[] {
  return fields.map((field, index) => ({
    id: `response-${index}-${field.key}`,
    key: field.key,
    value: field.value,
  }));
}

const CONFIG_FIELD_TYPES = ["string", "number", "boolean"] as const;

const selectControlClassName =
  "w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-50 dark:focus:border-blue-400 dark:focus:ring-blue-400/25";

function mapConfigFieldsToRows(fields: IntegrationBuilderConfigField[]): ConfigFieldRow[] {
  return fields.map((field, index) => ({
    id: `config-${index}-${field.variableName || "row"}`,
    variableName: field.variableName,
    label: field.label,
    type: field.type || "string",
    required: Boolean(field.required),
  }));
}

function createEmptyConfigFieldRow(): ConfigFieldRow {
  return {
    id: `config-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    variableName: "",
    label: "",
    type: "string",
    required: false,
  };
}

const DEFAULT_HEADER_ROWS: HeaderRow[] = [
  { id: "header-content-type", key: "Content-Type", value: "application/json" },
  { id: "header-accept", key: "Accept", value: "application/json" },
];

function mapSavedHeadersToRows(headers: IntegrationBuilderRequestMappingHeader[]): HeaderRow[] {
  if (!headers.length) return DEFAULT_HEADER_ROWS;
  return headers.map((row, index) => ({
    id: `header-${index}-${row.key || "row"}`,
    key: row.key,
    value: row.value,
  }));
}

function mapSavedDataRowsToState(rows: IntegrationBuilderRequestMappingDataRow[]): RequestDataRow[] {
  return rows.map((row, index) => ({
    id: `data-${index}-${row.name || "row"}`,
    name: row.name,
    type: row.type || "String",
    value: row.value,
  }));
}

function inferSampleValueType(value: unknown) {
  if (Array.isArray(value)) return "Array";
  if (value === null) return "Null";
  if (typeof value === "boolean") return "Boolean";
  if (typeof value === "number") return "Number";
  if (typeof value === "object") return "Object";
  return "String";
}

function stringifySampleValue(value: unknown) {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value);
}

function buildRowsFromSample(sample: unknown) {
  if (Array.isArray(sample)) {
    const firstEntry = sample[0];

    if (firstEntry && typeof firstEntry === "object" && !Array.isArray(firstEntry)) {
      return {
        payloadType: "Array",
        rows: Object.entries(firstEntry).map(([key, value], index) => ({
          id: `sample-array-${Date.now()}-${index}`,
          name: key,
          type: inferSampleValueType(value),
          value: toLeadFieldTemplate(key),
        })),
      };
    }

    return {
      payloadType: "Array",
      rows: sample.map((value, index) => ({
        id: `sample-array-${Date.now()}-${index}`,
        name: `item_${index + 1}`,
        type: inferSampleValueType(value),
        value: stringifySampleValue(value),
      })),
    };
  }

  if (sample && typeof sample === "object") {
    return {
      payloadType: "Object",
      rows: Object.entries(sample).map(([key, value], index) => ({
        id: `sample-object-${Date.now()}-${index}`,
        name: key,
        type: inferSampleValueType(value),
        value: toLeadFieldTemplate(key),
      })),
    };
  }

  throw new Error("Sample JSON must be an object or array.");
}

function formatBuilderDate(value?: string) {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();

  return `${day}/${month}/${year}`;
}

type IntegrationBuilderDetailProps = {
  builder?: {
    id: string;
    name: string;
    status: "Active" | "Draft" | "Paused";
    postingType: "Direct Post" | "Ping Post";
    productLabel: string;
    verticalId: string;
    updatedAt: string;
    arrayMappings: IntegrationBuilderArrayMappingEntry[];
    requestMapping: IntegrationBuilderRequestMapping;
    responseMapping: IntegrationBuilderResponseMapping;
    configFields: IntegrationBuilderConfigField[];
  };
};

function ArrayMappingCollapsible({ open, children }: { open: boolean; children: ReactNode }) {
  return (
    <div
      className={cn(
        "grid transition-[grid-template-rows,opacity] duration-300 ease-in-out motion-reduce:transition-none",
        open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
      )}
      aria-hidden={!open}
    >
      <div className="min-h-0 overflow-hidden">
        <div
          className={cn(
            "transition-[transform,opacity] duration-300 ease-in-out motion-reduce:transition-none",
            open ? "translate-y-0 opacity-100" : "-translate-y-2 opacity-0"
          )}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

export function IntegrationBuilderDetail({ builder }: IntegrationBuilderDetailProps) {
  const [activeTabId, setActiveTabId] = useState<(typeof builderTabs)[number]["id"]>("general");
  const [showHeaders, setShowHeaders] = useState(true);
  const [showData, setShowData] = useState(true);
  const [requestUrl, setRequestUrl] = useState("{{ config.url }}");
  const [methodType, setMethodType] = useState("POST");
  const [dataType, setDataType] = useState("JSON");
  const [payloadType, setPayloadType] = useState("Object");
  const [integrationName, setIntegrationName] = useState(builder?.name ?? "");
  const [generalStatus, setGeneralStatus] = useState(builder?.status ?? "Active");
  const [dateUpdated, setDateUpdated] = useState(builder?.updatedAt ?? "");
  const [isSavingGeneral, setIsSavingGeneral] = useState(false);
  const [generalSaveError, setGeneralSaveError] = useState("");
  const [generalSaveMessage, setGeneralSaveMessage] = useState("");
  const [sampleModalOpen, setSampleModalOpen] = useState(false);
  const [sampleJson, setSampleJson] = useState("");
  const [sampleImportError, setSampleImportError] = useState("");
  const [headers, setHeaders] = useState<HeaderRow[]>(DEFAULT_HEADER_ROWS);
  const [requestDataRows, setRequestDataRows] = useState<RequestDataRow[]>([]);
  const [isSavingHeaders, setIsSavingHeaders] = useState(false);
  const [headerSaveError, setHeaderSaveError] = useState("");
  const [headerSaveMessage, setHeaderSaveMessage] = useState("");
  const [isSavingData, setIsSavingData] = useState(false);
  const [dataSaveError, setDataSaveError] = useState("");
  const [dataSaveMessage, setDataSaveMessage] = useState("");
  const [arrayMappingFields, setArrayMappingFields] = useState<ApiFieldConfig[]>([]);
  const [arrayMappingEntries, setArrayMappingEntries] = useState<ArrayMappingEntry[]>([]);
  const [expandedArraySections, setExpandedArraySections] = useState<Record<string, boolean>>({});
  const [isLoadingArrayFields, setIsLoadingArrayFields] = useState(false);
  const [isSavingArrayMappings, setIsSavingArrayMappings] = useState(false);
  const [arrayMappingError, setArrayMappingError] = useState("");
  const [arrayMappingMessage, setArrayMappingMessage] = useState("");
  const [selectedArrayVariable, setSelectedArrayVariable] = useState("");
  const [arrayMappingAddError, setArrayMappingAddError] = useState("");
  const [leadFieldNames, setLeadFieldNames] = useState<string[]>([]);
  const [configFieldRows, setConfigFieldRows] = useState<ConfigFieldRow[]>([]);
  const [isSavingConfigFields, setIsSavingConfigFields] = useState(false);
  const [configSaveError, setConfigSaveError] = useState("");
  const [configSaveMessage, setConfigSaveMessage] = useState("");
  const [responseDataType, setResponseDataType] = useState("JSON");
  const [responseFieldRows, setResponseFieldRows] = useState<ResponseMappingRow[]>([]);
  const [isSavingResponseMapping, setIsSavingResponseMapping] = useState(false);
  const [responseSaveError, setResponseSaveError] = useState("");
  const [responseSaveMessage, setResponseSaveMessage] = useState("");

  const activeTab = builderTabs.find((tab) => tab.id === activeTabId) ?? builderTabs[0];

  const integrationConfigFields = useMemo(
    () =>
      configFieldRows
        .map((row) => ({
          variableName: row.variableName.trim(),
          label: row.label.trim(),
        }))
        .filter((field) => field.variableName),
    [configFieldRows]
  );

  const arrayMappingSlugs = useMemo(
    () =>
      arrayMappingEntries
        .map((entry) => ({
          slug: entry.slug.trim(),
          fieldName: entry.fieldName.trim(),
        }))
        .filter((entry) => entry.slug),
    [arrayMappingEntries]
  );

  const twigValidationContext = useMemo(
    () => ({
      leadFieldNames,
      integrationConfigFields,
      arrayMappingSlugs,
    }),
    [leadFieldNames, integrationConfigFields, arrayMappingSlugs]
  );

  useEffect(() => {
    if (!builder) return;
    setIntegrationName(builder.name);
    setGeneralStatus(builder.status);
    setDateUpdated(builder.updatedAt);

    const mapping = builder.requestMapping;
    setRequestUrl(mapping.requestUrl);
    setMethodType(mapping.methodType);
    setDataType(mapping.dataType);
    setPayloadType(mapping.payloadType);
    setHeaders(mapSavedHeadersToRows(mapping.headers));
    setRequestDataRows(mapSavedDataRowsToState(mapping.dataRows));
    setConfigFieldRows(mapConfigFieldsToRows(builder.configFields ?? []));

    const response = builder.responseMapping;
    setResponseDataType(response.dataType);
    setResponseFieldRows(mapResponseFieldsToRows(response.fields));
  }, [builder]);

  const savedArrayMappingsRef = useRef<IntegrationBuilderArrayMappingEntry[]>(builder?.arrayMappings ?? []);

  useEffect(() => {
    savedArrayMappingsRef.current = builder?.arrayMappings ?? [];
  }, [builder?.arrayMappings]);

  useEffect(() => {
    if (!builder?.verticalId) {
      setArrayMappingFields([]);
      setArrayMappingEntries([]);
      setLeadFieldNames([]);
      return;
    }

    const loadArrayMappingFields = async () => {
      setIsLoadingArrayFields(true);
      setArrayMappingError("");

      try {
        const response = await fetch(`/api/industries/${encodeURIComponent(builder.verticalId)}/fields`);
        if (!response.ok) {
          setArrayMappingError("Failed to load vertical fields.");
          return;
        }

        const fields = (await response.json()) as ApiFieldConfig[];
        const mappingFields = fields.filter((field) => field.displayArrayMapping);
        const savedByFieldName = new Map(savedArrayMappingsRef.current.map((entry) => [entry.fieldName, entry]));
        const entries = [...savedArrayMappingsRef.current]
          .reverse()
          .map((saved) => {
            const field = mappingFields.find((item) => item.fieldName === saved.fieldName);
            if (!field) return null;
            return mergeArrayMappingEntry(field, saved);
          })
          .filter((entry): entry is ArrayMappingEntry => entry !== null);

        setLeadFieldNames(fields.map((field) => field.fieldName));
        setArrayMappingFields(mappingFields);
        setArrayMappingEntries(entries);
        setSelectedArrayVariable("");
        setArrayMappingAddError("");
        setExpandedArraySections({});
      } catch {
        setArrayMappingError("Failed to load vertical fields.");
      } finally {
        setIsLoadingArrayFields(false);
      }
    };

    void loadArrayMappingFields();
  }, [builder?.verticalId]);

  const handleSaveIntegration = async () => {
    if (!builder?.id) {
      setGeneralSaveError("Integration record is missing.");
      return;
    }

    if (!integrationName.trim()) {
      setGeneralSaveError("Integration name is required.");
      setGeneralSaveMessage("");
      return;
    }

    setIsSavingGeneral(true);
    setGeneralSaveError("");
    setGeneralSaveMessage("");

    try {
      const response = await fetch(`/api/integration-builder/${encodeURIComponent(builder.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: integrationName.trim(),
          status: generalStatus,
          postingType: builder.postingType,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { message?: string } | null;
        setGeneralSaveError(payload?.message ?? "Failed to save integration.");
        return;
      }

      const updated = (await response.json()) as {
        name: string;
        status: typeof generalStatus;
        updatedAt: string;
      };

      setIntegrationName(updated.name);
      setGeneralStatus(updated.status);
      setDateUpdated(updated.updatedAt);
      setGeneralSaveMessage("Integration saved successfully.");
    } catch {
      setGeneralSaveError("Failed to save integration.");
    } finally {
      setIsSavingGeneral(false);
    }
  };

  const updateHeaderRow = (id: string, key: keyof HeaderRow, value: string) => {
    setHeaders((current) => current.map((row) => (row.id === id ? { ...row, [key]: value } : row)));
  };

  const addHeaderRow = () => {
    setHeaders((current) => [...current, { id: `header-${current.length + 1}`, key: "", value: "" }]);
  };

  const removeHeaderRow = (id: string) => {
    setHeaders((current) => current.filter((row) => row.id !== id));
  };

  const updateRequestDataRow = (id: string, key: keyof RequestDataRow, value: string) => {
    setRequestDataRows((current) => current.map((row) => (row.id === id ? { ...row, [key]: value } : row)));
  };

  const addRequestDataRow = () => {
    setRequestDataRows((current) => [...current, { id: `field-${current.length + 1}`, name: "", type: "String", value: "" }]);
  };

  const removeRequestDataRow = (id: string) => {
    setRequestDataRows((current) => current.filter((row) => row.id !== id));
  };

  const handleImportSample = () => {
    try {
      const parsed = JSON.parse(sampleJson);
      const result = buildRowsFromSample(parsed);
      setPayloadType(result.payloadType);
      setRequestDataRows(result.rows);
      setSampleImportError("");
      setSampleModalOpen(false);
    } catch (error) {
      setSampleImportError(error instanceof Error ? error.message : "Unable to import sample JSON.");
    }
  };

  const updateArrayMappingSlug = (fieldName: string, slug: string) => {
    setArrayMappingEntries((current) =>
      current.map((entry) => (entry.fieldName === fieldName ? { ...entry, slug } : entry))
    );
  };

  const updateArrayMappingValue = (fieldName: string, label: string, mapping: string) => {
    setArrayMappingEntries((current) =>
      current.map((entry) =>
        entry.fieldName === fieldName
          ? {
              ...entry,
              mappings: entry.mappings.map((row) => (row.label === label ? { ...row, mapping } : row)),
            }
          : entry
      )
    );
  };

  const handleAddArrayMapping = () => {
    if (!selectedArrayVariable) {
      setArrayMappingAddError("Please choose a variable.");
      return;
    }

    const field = arrayMappingFields.find((item) => item.fieldName === selectedArrayVariable);
    if (!field) {
      setArrayMappingAddError("Selected variable is not available.");
      return;
    }

    if (arrayMappingEntries.some((entry) => entry.fieldName === selectedArrayVariable)) {
      setArrayMappingAddError("This variable is already added.");
      return;
    }

    const saved = savedArrayMappingsRef.current.find((entry) => entry.fieldName === selectedArrayVariable);
    setArrayMappingEntries((current) => [mergeArrayMappingEntry(field, saved), ...current]);
    setSelectedArrayVariable("");
    setArrayMappingAddError("");
  };

  const removeArrayMappingSection = (fieldName: string) => {
    setArrayMappingEntries((current) => current.filter((entry) => entry.fieldName !== fieldName));
    setExpandedArraySections((current) => {
      const next = { ...current };
      delete next[fieldName];
      return next;
    });
    if (selectedArrayVariable === fieldName) {
      setSelectedArrayVariable("");
    }
  };

  const toggleArrayMappingSection = (fieldName: string) => {
    setExpandedArraySections((current) => ({
      ...current,
      [fieldName]: !current[fieldName],
    }));
  };

  const buildRequestMappingSettings = () => ({
    requestUrl: requestUrl.trim(),
    methodType: methodType.trim(),
    dataType: dataType.trim(),
    payloadType: payloadType.trim(),
  });

  const handleSaveHeaders = async () => {
    if (!builder?.id) {
      setHeaderSaveError("Integration record is missing.");
      return;
    }

    setHeaderSaveError("");
    setHeaderSaveMessage("");

    const twigError = validateRequestMappingTwigPayload(
      {
        requestUrl: requestUrl.trim(),
        headers: headers.map((row) => ({
          key: row.key.trim(),
          value: row.value,
        })),
      },
      twigValidationContext
    );

    if (twigError) {
      setHeaderSaveError(twigError);
      return;
    }

    setIsSavingHeaders(true);

    try {
      const response = await fetch(`/api/integration-builder/${encodeURIComponent(builder.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: integrationName.trim() || builder.name,
          requestMapping: {
            ...buildRequestMappingSettings(),
            headers: headers.map((row) => ({
              key: row.key.trim(),
              value: row.value,
            })),
          },
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { message?: string } | null;
        setHeaderSaveError(payload?.message ?? "Failed to save headers.");
        return;
      }

      const updated = (await response.json()) as { updatedAt?: string };
      if (updated.updatedAt) setDateUpdated(updated.updatedAt);
      setHeaderSaveMessage("Headers saved successfully.");
    } catch {
      setHeaderSaveError("Failed to save headers.");
    } finally {
      setIsSavingHeaders(false);
    }
  };

  const handleSaveData = async () => {
    if (!builder?.id) {
      setDataSaveError("Integration record is missing.");
      return;
    }

    setDataSaveError("");
    setDataSaveMessage("");

    const twigError = validateRequestMappingTwigPayload(
      {
        requestUrl: requestUrl.trim(),
        dataRows: requestDataRows.map((row) => ({
          name: row.name.trim(),
          value: row.value,
        })),
      },
      twigValidationContext
    );

    if (twigError) {
      setDataSaveError(twigError);
      return;
    }

    setIsSavingData(true);

    try {
      const response = await fetch(`/api/integration-builder/${encodeURIComponent(builder.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: integrationName.trim() || builder.name,
          requestMapping: {
            ...buildRequestMappingSettings(),
            dataRows: requestDataRows.map((row) => ({
              name: row.name.trim(),
              type: row.type.trim() || "String",
              value: row.value,
            })),
          },
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { message?: string } | null;
        setDataSaveError(payload?.message ?? "Failed to save data.");
        return;
      }

      const updated = (await response.json()) as { updatedAt?: string };
      if (updated.updatedAt) setDateUpdated(updated.updatedAt);
      setDataSaveMessage("Data saved successfully.");
    } catch {
      setDataSaveError("Failed to save data.");
    } finally {
      setIsSavingData(false);
    }
  };

  const updateConfigFieldRow = (id: string, key: keyof Omit<ConfigFieldRow, "id">, value: string | boolean) => {
    setConfigFieldRows((current) =>
      current.map((row) => (row.id === id ? { ...row, [key]: value } : row))
    );
  };

  const addConfigFieldRow = () => {
    setConfigFieldRows((current) => [...current, createEmptyConfigFieldRow()]);
  };

  const removeConfigFieldRow = (id: string) => {
    setConfigFieldRows((current) => current.filter((row) => row.id !== id));
  };

  const handleSaveConfigFields = async () => {
    if (!builder?.id) {
      setConfigSaveError("Integration record is missing.");
      return;
    }

    setIsSavingConfigFields(true);
    setConfigSaveError("");
    setConfigSaveMessage("");

    try {
      const response = await fetch(`/api/integration-builder/${encodeURIComponent(builder.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: integrationName.trim() || builder.name,
          configFields: configFieldRows.map((row) => ({
            variableName: row.variableName.trim(),
            label: row.label.trim(),
            type: row.type.trim() || "string",
            required: row.required,
          })),
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { message?: string } | null;
        setConfigSaveError(payload?.message ?? "Failed to save integration config.");
        return;
      }

      const updated = (await response.json()) as { updatedAt?: string; configFields?: IntegrationBuilderConfigField[] };
      if (updated.updatedAt) setDateUpdated(updated.updatedAt);
      if (updated.configFields) setConfigFieldRows(mapConfigFieldsToRows(updated.configFields));
      setConfigSaveMessage("Integration config saved successfully.");
    } catch {
      setConfigSaveError("Failed to save integration config.");
    } finally {
      setIsSavingConfigFields(false);
    }
  };

  const updateResponseFieldValue = (id: string, value: string) => {
    setResponseFieldRows((current) => current.map((row) => (row.id === id ? { ...row, value } : row)));
  };

  const handleSaveResponseMapping = async () => {
    if (!builder?.id) {
      setResponseSaveError("Integration record is missing.");
      return;
    }

    setResponseSaveError("");
    setResponseSaveMessage("");

    const twigError = validateResponseMappingTwigPayload(
      {
        fields: responseFieldRows.map((row) => ({
          key: row.key,
          value: row.value,
        })),
      },
      twigValidationContext
    );

    if (twigError) {
      setResponseSaveError(twigError);
      return;
    }

    setIsSavingResponseMapping(true);

    try {
      const response = await fetch(`/api/integration-builder/${encodeURIComponent(builder.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: integrationName.trim() || builder.name,
          responseMapping: {
            dataType: responseDataType.trim(),
            fields: responseFieldRows.map((row) => ({
              key: row.key,
              value: row.value,
            })),
          },
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { message?: string } | null;
        setResponseSaveError(payload?.message ?? "Failed to save response mapping.");
        return;
      }

      const updated = (await response.json()) as {
        updatedAt?: string;
        responseMapping?: IntegrationBuilderResponseMapping;
      };

      if (updated.updatedAt) setDateUpdated(updated.updatedAt);
      if (updated.responseMapping) {
        setResponseDataType(updated.responseMapping.dataType);
        setResponseFieldRows(mapResponseFieldsToRows(updated.responseMapping.fields));
      }

      setResponseSaveMessage("Response mapping saved successfully.");
    } catch {
      setResponseSaveError("Failed to save response mapping.");
    } finally {
      setIsSavingResponseMapping(false);
    }
  };

  const handleSaveArrayMappings = async () => {
    if (!builder?.id) {
      setArrayMappingError("Integration record is missing.");
      return;
    }

    setIsSavingArrayMappings(true);
    setArrayMappingError("");
    setArrayMappingMessage("");

    try {
      const response = await fetch(`/api/integration-builder/${encodeURIComponent(builder.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: integrationName.trim() || builder.name,
          arrayMappings: arrayMappingEntries,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { message?: string } | null;
        setArrayMappingError(payload?.message ?? "Failed to save array mappings.");
        return;
      }

      setArrayMappingMessage("Array mappings saved successfully.");
    } catch {
      setArrayMappingError("Failed to save array mappings.");
    } finally {
      setIsSavingArrayMappings(false);
    }
  };

  const generalLabelClass =
    "w-full shrink-0 text-sm font-medium text-slate-700 dark:text-slate-200 sm:w-52 sm:pr-6 sm:text-right";
  const generalValueClass = "w-full min-w-0 max-w-xl flex-1 text-sm text-slate-800 dark:text-slate-100";

  const renderGeneralRow = (label: string, control: ReactNode) => (
    <div className="flex flex-col gap-2 py-2 sm:flex-row sm:items-center">
      <p className={generalLabelClass}>{label}</p>
      <div className={generalValueClass}>{control}</div>
    </div>
  );

  const renderGeneralTab = () => (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 px-6 py-4 dark:border-slate-700">
        <div className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-300">
          <span className="font-medium text-slate-700 dark:text-slate-200">Active Users:</span>
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-sky-500 text-sm font-semibold text-white">
            M
          </span>
        </div>

        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-xl border border-emerald-700 bg-emerald-800 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700 dark:border-emerald-500 dark:bg-emerald-600 dark:hover:bg-emerald-500"
        >
          <span>Logs</span>
          <ExternalLink size={15} />
        </button>
      </div>

      <div className="px-6 py-8">
        <div className="mx-auto w-full max-w-3xl space-y-1">
          {renderGeneralRow(
            "Integration name:",
            <Input value={integrationName} onChange={(event) => setIntegrationName(event.target.value)} />
          )}
          {renderGeneralRow(
            "Product:",
            <p className="py-2.5 text-slate-800 dark:text-slate-100">{builder?.productLabel || "-"}</p>
          )}
          {renderGeneralRow(
            "Post model:",
            <p className="py-2.5 text-slate-800 dark:text-slate-100">{builder?.postingType ?? "-"}</p>
          )}
          {renderGeneralRow(
            "Date updated:",
            <p className="py-2.5 text-slate-800 dark:text-slate-100">{formatBuilderDate(dateUpdated)}</p>
          )}
          {renderGeneralRow(
            "Status:",
            <select
              id="builder-general-status"
              value={generalStatus}
              onChange={(event) => setGeneralStatus(event.target.value as typeof generalStatus)}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-50 dark:focus:border-blue-400 dark:focus:ring-blue-400/25"
            >
              <option value="Active">Active</option>
              <option value="Draft">Draft</option>
              <option value="Paused">Paused</option>
            </select>
          )}

          <div className="flex flex-col gap-2 pt-6 sm:flex-row">
            <div className="hidden shrink-0 sm:block sm:w-52 sm:pr-6" aria-hidden />
            <div className="w-full max-w-xl flex-1 space-y-2">
              <div className="flex justify-end">
                <PrimaryButton
                  type="button"
                  disabled={isSavingGeneral || !builder?.id}
                  onClick={() => void handleSaveIntegration()}
                  className="bg-emerald-700 hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-500"
                >
                  {isSavingGeneral ? "Saving..." : "Save Integration"}
                </PrimaryButton>
              </div>
              <FormError error={generalSaveError} />
              {generalSaveMessage ? (
                <p className="text-sm text-emerald-700 dark:text-emerald-300">{generalSaveMessage}</p>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderIntegrationConfigTab = () => (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-200">
            Integration Config
          </h3>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            Define custom config variables used in request templates such as{" "}
            <code className="rounded bg-slate-200 px-1.5 py-0.5 font-mono text-xs dark:bg-slate-700">{`{{ config.url }}`}</code>.
          </p>
        </div>

        <PrimaryButton
          type="button"
          disabled={isSavingConfigFields || !builder?.id}
          onClick={() => void handleSaveConfigFields()}
          className="bg-emerald-700 hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-500"
        >
          {isSavingConfigFields ? "Saving..." : "Save Config"}
        </PrimaryButton>
      </div>

      <FormError error={configSaveError} />
      {configSaveMessage ? <p className="text-sm text-emerald-700 dark:text-emerald-300">{configSaveMessage}</p> : null}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="space-y-4 p-5">
          {configFieldRows.length > 0 ? (
            <>
              <div className="hidden gap-3 md:grid md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_160px_120px_48px]">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Variable Name</p>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Label</p>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Type</p>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Required</p>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400"> </p>
              </div>

              {configFieldRows.map((row) => (
                <div
                  key={row.id}
                  className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/50 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_160px_120px_48px] md:border-0 md:bg-transparent md:p-0"
                >
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200 md:sr-only">
                      Variable Name
                    </label>
                    <Input
                      value={row.variableName}
                      onChange={(event) => updateConfigFieldRow(row.id, "variableName", event.target.value)}
                      placeholder="api_key"
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200 md:sr-only">Label</label>
                    <Input
                      value={row.label}
                      onChange={(event) => updateConfigFieldRow(row.id, "label", event.target.value)}
                      placeholder="API"
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200 md:sr-only">Type</label>
                    <select
                      value={row.type}
                      onChange={(event) => updateConfigFieldRow(row.id, "type", event.target.value)}
                      className={selectControlClassName}
                    >
                      {CONFIG_FIELD_TYPES.map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200 md:sr-only">Required</label>
                    <select
                      value={row.required ? "true" : "false"}
                      onChange={(event) => updateConfigFieldRow(row.id, "required", event.target.value === "true")}
                      className={selectControlClassName}
                    >
                      <option value="true">true</option>
                      <option value="false">false</option>
                    </select>
                  </div>
                  <div className="flex items-end md:items-center">
                    <button
                      type="button"
                      onClick={() => removeConfigFieldRow(row.id)}
                      className="flex h-11 w-full items-center justify-center rounded-xl border border-red-200 text-red-500 transition hover:bg-red-50 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-200 dark:hover:bg-red-500/20 md:w-11"
                      aria-label="Remove config field"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500 dark:border-slate-600 dark:text-slate-300">
              No config fields yet. Click Add new config field to create one.
            </div>
          )}

          <button
            type="button"
            onClick={addConfigFieldRow}
            className="inline-flex items-center gap-2 rounded-xl border border-emerald-700 bg-emerald-800 px-3 py-2 text-sm font-medium text-white transition hover:bg-emerald-700 dark:border-emerald-500 dark:bg-emerald-600 dark:hover:bg-emerald-500"
          >
            <Plus size={15} />
            <span>Add new config field</span>
          </button>
        </div>
      </div>
    </div>
  );

  const renderResponseMappingTab = () => {
    const twigInputProps = {
      leadFieldNames,
      integrationConfigFields,
      arrayMappingSlugs,
      includeResponseSuggestions: true,
    };

    return (
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-200">
              Response Mapping
            </h3>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              Map buyer response values. Use plain text or Twig — type{" "}
              <code className="rounded bg-slate-200 px-1.5 py-0.5 font-mono text-xs dark:bg-slate-700">{`{{`}</code> for
              suggestions (<code className="rounded bg-slate-200 px-1 py-0.5 font-mono text-xs dark:bg-slate-700">response</code>,{" "}
              <code className="rounded bg-slate-200 px-1 py-0.5 font-mono text-xs dark:bg-slate-700">lead</code>,{" "}
              <code className="rounded bg-slate-200 px-1 py-0.5 font-mono text-xs dark:bg-slate-700">config</code>,{" "}
              <code className="rounded bg-slate-200 px-1 py-0.5 font-mono text-xs dark:bg-slate-700">mapped</code>).
            </p>
          </div>

          <PrimaryButton
            type="button"
            disabled={isSavingResponseMapping || !builder?.id}
            onClick={() => void handleSaveResponseMapping()}
            className="bg-emerald-700 hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-500"
          >
            {isSavingResponseMapping ? "Saving..." : "Save Response Mapping"}
          </PrimaryButton>
        </div>

        <FormError error={responseSaveError} />
        {responseSaveMessage ? (
          <p className="text-sm text-emerald-700 dark:text-emerald-300">{responseSaveMessage}</p>
        ) : null}

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <div className="space-y-5 p-5">
            <div className="max-w-xs">
              <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">Data Type</label>
              <select
                value={responseDataType}
                onChange={(event) => setResponseDataType(event.target.value)}
                className={selectControlClassName}
              >
                <option value="JSON">JSON</option>
                <option value="XML">XML</option>
              </select>
            </div>

            <div className="space-y-4">
              {responseFieldRows.map((row) => (
                <div key={row.id} className="grid gap-3 md:grid-cols-[220px_minmax(0,1fr)] md:items-start">
                  <p className="pt-2.5 text-sm font-medium text-slate-700 dark:text-slate-200">{row.key}</p>
                  <TwigTemplateInput
                    value={row.value}
                    onChange={(nextValue) => updateResponseFieldValue(row.id, nextValue)}
                    {...twigInputProps}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderRequestMappingTab = () => {
    const twigInputProps = {
      leadFieldNames,
      integrationConfigFields,
      arrayMappingSlugs,
    };

    return (
    <div className="space-y-5">
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="border-b border-slate-200 px-5 py-4 dark:border-slate-700">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-200">Request Builder (POST)</h3>
        </div>

        <div className="space-y-6 p-5">
          <div className="grid gap-4 md:max-w-3xl md:grid-cols-2 xl:grid-cols-3">
            <div className="md:col-span-2 xl:col-span-1">
              <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">Request-Url</label>
              <TwigTemplateInput
                value={requestUrl}
                onChange={setRequestUrl}
                placeholder="{{ config.url }}"
                {...twigInputProps}
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">Method Type</label>
              <select
                value={methodType}
                onChange={(event) => setMethodType(event.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-50 dark:focus:border-blue-400 dark:focus:ring-blue-400/25"
              >
                <option value="POST">POST</option>
                <option value="PUT">PUT</option>
                <option value="PATCH">PATCH</option>
                <option value="GET">GET</option>
              </select>
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">Data Type</label>
              <select
                value={dataType}
                onChange={(event) => setDataType(event.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-50 dark:focus:border-blue-400 dark:focus:ring-blue-400/25"
              >
                <option value="JSON">JSON</option>
                <option value="FORM-DATA">FORM-DATA</option>
                <option value="XML">XML</option>
              </select>
            </div>
          </div>

          <div className="space-y-4">
            <RequestMappingToggle
              open={showHeaders}
              label="Headers"
              onToggle={() => setShowHeaders((current) => !current)}
            />

            <RequestMappingCollapsible open={showHeaders}>
              <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/50">
                <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_48px]">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Key</p>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Value</p>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400"> </p>
                </div>

                {headers.map((row) => (
                  <div key={row.id} className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_48px]">
                    <TwigTemplateInput
                      value={row.key}
                      onChange={(nextValue) => updateHeaderRow(row.id, "key", nextValue)}
                      {...twigInputProps}
                    />
                    <TwigTemplateInput
                      value={row.value}
                      onChange={(nextValue) => updateHeaderRow(row.id, "value", nextValue)}
                      {...twigInputProps}
                    />
                    <button
                      type="button"
                      onClick={() => removeHeaderRow(row.id)}
                      className="flex h-11 items-center justify-center rounded-xl border border-red-200 text-red-500 transition hover:bg-red-50 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-200 dark:hover:bg-red-500/20"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}

                <button
                  type="button"
                  onClick={addHeaderRow}
                  className="inline-flex items-center gap-2 rounded-xl border border-emerald-700 bg-emerald-800 px-3 py-2 text-sm font-medium text-white transition hover:bg-emerald-700 dark:border-emerald-500 dark:bg-emerald-600 dark:hover:bg-emerald-500"
                >
                  <Plus size={15} />
                  <span>Add new</span>
                </button>

                <div className="space-y-2 border-t border-slate-200 pt-4 dark:border-slate-600">
                  <FormError error={headerSaveError} />
                  {headerSaveMessage ? (
                    <p className="text-right text-sm text-emerald-700 dark:text-emerald-300">{headerSaveMessage}</p>
                  ) : null}
                  <div className="flex justify-end">
                    <PrimaryButton
                      type="button"
                      disabled={isSavingHeaders || !builder?.id}
                      onClick={() => void handleSaveHeaders()}
                      className="bg-emerald-700 hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-500"
                    >
                      {isSavingHeaders ? "Saving..." : "Save Headers"}
                    </PrimaryButton>
                  </div>
                </div>
              </div>
            </RequestMappingCollapsible>
          </div>

          <div className="space-y-4">
            <RequestMappingToggle open={showData} label="Data" onToggle={() => setShowData((current) => !current)} />

            <RequestMappingCollapsible open={showData}>
              <div className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/50">
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  Text fields accept plain values or Twig templates. Type{" "}
                  <code className="rounded bg-slate-200 px-1.5 py-0.5 font-mono text-xs dark:bg-slate-700">{`{{`}</code> for suggestions — e.g.{" "}
                  <code className="rounded bg-slate-200 px-1.5 py-0.5 font-mono text-xs dark:bg-slate-700">{`{{ lead.field_name }}`}</code> (leads) or{" "}
                  <code className="rounded bg-slate-200 px-1.5 py-0.5 font-mono text-xs dark:bg-slate-700">{`{{ config.api_key }}`}</code> (Integration Config),{" "}
                  <code className="rounded bg-slate-200 px-1.5 py-0.5 font-mono text-xs dark:bg-slate-700">{`{{ mapped.slug }}`}</code> (Array Mapping slugs).
                </p>

                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setSampleImportError("");
                      setSampleModalOpen(true);
                    }}
                    className="inline-flex items-center gap-2 rounded-xl border border-emerald-700 bg-emerald-800 px-3 py-2 text-sm font-medium text-white transition hover:bg-emerald-700 dark:border-emerald-500 dark:bg-emerald-600 dark:hover:bg-emerald-500"
                  >
                    <Upload size={15} />
                    <span>Import by Sample</span>
                  </button>

                  <div className="flex items-center gap-3">
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Type</label>
                    <select
                      value={payloadType}
                      onChange={(event) => setPayloadType(event.target.value)}
                      className="min-w-44 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-50 dark:focus:border-blue-400 dark:focus:ring-blue-400/25"
                    >
                      <option value="Object">Object</option>
                      <option value="Array">Array</option>
                    </select>
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-[minmax(0,1.1fr)_180px_minmax(0,1fr)_48px]">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Name</p>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Type</p>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Value</p>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400"> </p>
                </div>

                {requestDataRows.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-8 text-center text-sm text-slate-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-300">
                    No data records yet. Click `Add new` or use `Import by Sample` to generate rows.
                  </div>
                ) : (
                  requestDataRows.map((row) => (
                    <div key={row.id} className="grid gap-3 md:grid-cols-[minmax(0,1.1fr)_180px_minmax(0,1fr)_48px]">
                      <TwigTemplateInput
                        value={row.name}
                        onChange={(nextValue) => updateRequestDataRow(row.id, "name", nextValue)}
                        {...twigInputProps}
                      />
                      <select
                        value={row.type}
                        onChange={(event) => updateRequestDataRow(row.id, "type", event.target.value)}
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-50 dark:focus:border-blue-400 dark:focus:ring-blue-400/25"
                      >
                        <option value="String">String</option>
                        <option value="Number">Number</option>
                        <option value="Boolean">Boolean</option>
                        <option value="Object">Object</option>
                        <option value="Array">Array</option>
                        <option value="Null">Null</option>
                      </select>
                      <TwigTemplateInput
                        value={row.value}
                        onChange={(nextValue) => updateRequestDataRow(row.id, "value", nextValue)}
                        {...twigInputProps}
                      />
                      <button
                        type="button"
                        onClick={() => removeRequestDataRow(row.id)}
                        className="flex h-11 items-center justify-center rounded-xl border border-red-200 text-red-500 transition hover:bg-red-50 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-200 dark:hover:bg-red-500/20"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))
                )}

                <button
                  type="button"
                  onClick={addRequestDataRow}
                  className="inline-flex items-center gap-2 rounded-xl border border-emerald-700 bg-emerald-800 px-3 py-2 text-sm font-medium text-white transition hover:bg-emerald-700 dark:border-emerald-500 dark:bg-emerald-600 dark:hover:bg-emerald-500"
                >
                  <Plus size={15} />
                  <span>Add new</span>
                </button>

                <div className="space-y-2 border-t border-slate-200 pt-4 dark:border-slate-600">
                  <FormError error={dataSaveError} />
                  {dataSaveMessage ? (
                    <p className="text-right text-sm text-emerald-700 dark:text-emerald-300">{dataSaveMessage}</p>
                  ) : null}
                  <div className="flex justify-end">
                    <PrimaryButton
                      type="button"
                      disabled={isSavingData || !builder?.id}
                      onClick={() => void handleSaveData()}
                      className="bg-emerald-700 hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-500"
                    >
                      {isSavingData ? "Saving..." : "Save Data"}
                    </PrimaryButton>
                  </div>
                </div>
              </div>
            </RequestMappingCollapsible>
          </div>
        </div>
      </div>

      <Modal
        open={sampleModalOpen}
        title="Import by Sample"
        description="Paste a JSON object or array sample. Rows will use Twig lead templates such as {{ lead.first_name }} for each field name."
        onClose={() => {
          setSampleImportError("");
          setSampleModalOpen(false);
        }}
        panelClassName="max-w-3xl"
        actions={
          <>
            <button
              type="button"
              onClick={() => {
                setSampleImportError("");
                setSampleModalOpen(false);
              }}
              className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
            >
              Cancel
            </button>
            <PrimaryButton type="button" onClick={handleImportSample}>
              Import Sample
            </PrimaryButton>
          </>
        }
      >
        <div className="space-y-3">
          <textarea
            value={sampleJson}
            onChange={(event) => {
              setSampleJson(event.target.value);
              if (sampleImportError) setSampleImportError("");
            }}
            placeholder={`{\n  "first_name": "Jim",\n  "last_name": "Cena",\n  "email": "jim@example.com",\n  "phone": "+15551234567"\n}`}
            className="min-h-64 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 font-mono text-sm text-slate-800 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-50 dark:placeholder:text-slate-400 dark:focus:border-blue-400 dark:focus:ring-blue-400/25"
          />
          {sampleImportError ? <p className="text-sm text-red-600 dark:text-red-300">{sampleImportError}</p> : null}
        </div>
      </Modal>
    </div>
    );
  };

  const renderArrayMappingTab = () => {
    const addedFieldNames = new Set(arrayMappingEntries.map((entry) => entry.fieldName));
    const availableVariables = arrayMappingFields.filter((field) => !addedFieldNames.has(field.fieldName));

    return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-200">Array Mapping</h3>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            Choose a variable with Display Array Mapping enabled, then add mapping rows below.
          </p>
        </div>

        <PrimaryButton
          type="button"
          disabled={isSavingArrayMappings || !builder?.id}
          onClick={() => void handleSaveArrayMappings()}
          className="bg-emerald-700 hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-500"
        >
          {isSavingArrayMappings ? "Saving..." : "Save Array Mapping"}
        </PrimaryButton>
      </div>

      <FormError error={arrayMappingError} />
      {arrayMappingMessage ? <p className="text-sm text-emerald-700 dark:text-emerald-300">{arrayMappingMessage}</p> : null}

      {isLoadingArrayFields ? (
        <div className="rounded-2xl border border-slate-200 bg-white px-6 py-10 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
          Loading vertical fields...
        </div>
      ) : arrayMappingFields.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center text-sm text-slate-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-300">
          No array mapping variables found. Upload a vertical field list and enable Display Array Mapping for the fields you want to configure.
        </div>
      ) : (
        <>
          <div className="max-w-md space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <label htmlFor="array-mapping-variable" className="block text-sm font-semibold text-slate-800 dark:text-slate-100">
              Variables
            </label>
            <select
              id="array-mapping-variable"
              value={selectedArrayVariable}
              onChange={(event) => {
                setSelectedArrayVariable(event.target.value);
                if (arrayMappingAddError) setArrayMappingAddError("");
              }}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-50 dark:focus:border-blue-400 dark:focus:ring-blue-400/25"
            >
              <option value="">Please choose variable</option>
              {availableVariables.map((field) => (
                <option key={field.fieldName} value={field.fieldName}>
                  {field.description ? `${field.description} (${field.fieldName})` : field.fieldName}
                </option>
              ))}
            </select>
            <PrimaryButton
              type="button"
              disabled={!selectedArrayVariable || availableVariables.length === 0}
              onClick={handleAddArrayMapping}
            >
              Add mapping
            </PrimaryButton>
            <FormError error={arrayMappingAddError} />
            {availableVariables.length === 0 && arrayMappingEntries.length > 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">All available variables have been added.</p>
            ) : null}
          </div>

          {arrayMappingEntries.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-8 text-center text-sm text-slate-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-300">
              Select a variable and click Add mapping to configure rows below.
            </div>
          ) : (
        <div className="space-y-4">
          {arrayMappingEntries.map((entry) => {
            const isExpanded = expandedArraySections[entry.fieldName] ?? false;

            return (
              <div
                key={entry.fieldName}
                className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900"
              >
                <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-700">
                  <div className="flex min-w-0 items-center gap-3">
                    <button
                      type="button"
                      onClick={() => toggleArrayMappingSection(entry.fieldName)}
                      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-300 text-slate-600 transition hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
                      aria-label={isExpanded ? "Collapse section" : "Expand section"}
                    >
                      {isExpanded ? <Minus size={16} /> : <Plus size={16} />}
                    </button>
                    <h4 className="truncate text-sm font-semibold uppercase tracking-wide text-slate-800 dark:text-slate-100">
                      {fieldNameToSectionTitle(entry.fieldName)}
                    </h4>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      type="button"
                      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-blue-200 text-blue-600 transition hover:bg-blue-50 dark:border-blue-500/40 dark:text-blue-300 dark:hover:bg-blue-500/10"
                      aria-label="Upload mapping"
                    >
                      <Upload size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeArrayMappingSection(entry.fieldName)}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-red-200 text-red-500 transition hover:bg-red-50 dark:border-red-500/40 dark:text-red-300 dark:hover:bg-red-500/10"
                      aria-label="Remove mapping"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                <ArrayMappingCollapsible open={isExpanded}>
                  <div className="space-y-4 p-4">
                    <div className="max-w-md">
                      <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">Slug</label>
                      <Input value={entry.slug} onChange={(event) => updateArrayMappingSlug(entry.fieldName, event.target.value)} />
                    </div>

                    <div className="space-y-3">
                      <div className="grid gap-3 md:grid-cols-2">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Label</p>
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Mapping</p>
                      </div>

                      {entry.mappings.map((row) => (
                        <div key={`${entry.fieldName}-${row.label}`} className="grid gap-3 md:grid-cols-2">
                          <div
                            className="flex min-h-11 items-center rounded-xl border border-slate-200 bg-slate-100 px-3 text-sm text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
                            aria-label={`Label ${row.label}`}
                          >
                            {row.label}
                          </div>
                          <Input
                            value={row.mapping}
                            onChange={(event) => updateArrayMappingValue(entry.fieldName, row.label, event.target.value)}
                            placeholder="Enter mapping value"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </ArrayMappingCollapsible>
              </div>
            );
          })}
        </div>
          )}
        </>
      )}
    </div>
    );
  };

  const renderDefaultTab = () => {
    const ActiveIcon = activeTab.icon;

    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-200">
            <ActiveIcon size={20} />
          </div>
          <div className="space-y-2">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{activeTab.title}</h3>
            <p className="max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300">{activeTab.description}</p>
          </div>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-700 dark:bg-slate-800/70">
            <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Section Overview</h4>
            <ul className="mt-3 space-y-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
              {activeTab.bullets.map((bullet) => (
                <li key={bullet} className="flex gap-3">
                  <span className="mt-2 h-2 w-2 rounded-full bg-blue-500 dark:bg-blue-300" />
                  <span>{bullet}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 dark:border-slate-600 dark:bg-slate-800/40">
            <div className="flex items-center gap-2 text-slate-700 dark:text-slate-200">
              <Info size={16} />
              <h4 className="text-sm font-semibold">Next Step</h4>
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
              This tab is ready for the detailed form and mapping controls you want to add next. The layout now matches the
              tab-based builder structure from your reference.
            </p>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <PageSection title="Builder">
        <div className="space-y-5">
          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-slate-50/80 p-3 dark:border-slate-700 dark:bg-slate-900/70">
            <div className="flex min-w-max items-center gap-3">
              {builderTabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = tab.id === activeTab.id;

                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTabId(tab.id)}
                    className={cn(
                      "inline-flex items-center gap-2 rounded-2xl border px-4 py-2.5 text-sm font-medium transition duration-200",
                      isActive
                        ? "border-emerald-700 bg-emerald-800 text-white shadow-sm dark:border-emerald-500 dark:bg-emerald-600"
                        : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
                    )}
                  >
                    <Icon size={16} />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {activeTab.id === "general"
            ? renderGeneralTab()
            : activeTab.id === "integration-config"
              ? renderIntegrationConfigTab()
              : activeTab.id === "request-mapping"
                ? renderRequestMappingTab()
                : activeTab.id === "response-mapping"
                  ? renderResponseMappingTab()
                  : activeTab.id === "array-mapping"
                    ? renderArrayMappingTab()
                    : renderDefaultTab()}
        </div>
      </PageSection>
    </div>
  );
}
