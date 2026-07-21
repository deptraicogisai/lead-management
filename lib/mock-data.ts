export type Seller = {
  id: string;
  displayId?: number;
  name: string;
  email: string;
  region: string;
  publisherTag?: string;
  status: "Active" | "Inactive" | "Deleted";
  createdAt?: string | null;
  apiFields?: ApiFieldConfig[];
};

export type ApiFieldConfig = {
  id: string;
  fieldName: string;
  description: string;
  type: string;
  displayArrayMapping: boolean;
  dataTypeFilter?: string | null;
  options: Array<{
    label: string;
    value: string;
  }>;
  required: boolean;
  format?: string;
  emailDuplicateRule?: {
    mode: "days" | "forever";
    days?: number;
  };
  ignoreValues?: string[];
};

export type Vertical = {
  id: string;
  displayId?: number;
  name: string;
  description: string;
  status?: "Active" | "Deleted";
  sellerId?: string;
  fields?: ApiFieldConfig[];
};

export type Industry = Vertical;

export type VerticalMapping = {
  id: string;
  verticalId: string;
  sellerId: string;
  apiRequest?: {
    apiKey: string;
    url: string;
    method: string;
  };
  fields?: Array<{
    id: string;
    sourceVerticalFieldId?: string;
    fieldName: string;
    description: string;
    type: string;
    required: boolean;
    format?: string;
  }>;
};

export type Buyer = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  company: string;
  verticalId: string;
  verticalName: string;
  apiKey: string;
  postLeadUrl: string;
  status: "Active" | "Paused";
  mappings?: Array<{
    source: string;
    destination: string;
  }>;
};

export type Lead = {
  id: string;
  raw_data: string;
  normalized_data: string;
  status: "Qualified" | "Pending" | "Rejected";
};

export type DistributionLog = {
  id: string;
  buyer: string;
  payload: string;
  response: string;
  status: "Success" | "Failed";
};

export const stats = {
  totalLeads: 3000,
  totalSellers: 50,
  totalBuyers: 20,
  successRate: "89.4%",
};

export const sellers: Seller[] = [
  { id: "SEL-001", name: "NorthStar Media", email: "ops@northstar.com", region: "US-East", status: "Active" },
  { id: "SEL-002", name: "LeadFlow Partners", email: "hello@leadflow.io", region: "EU", status: "Active" },
  { id: "SEL-003", name: "Apex Demand", email: "team@apexdemand.com", region: "APAC", status: "Inactive" },
];

export const buyers: Buyer[] = [
  {
    id: "BUY-101",
    firstName: "Liam",
    lastName: "Reed",
    email: "liam.reed@acmefinancial.com",
    phone: "+1 555 100 101",
    company: "Acme Financial",
    verticalId: "mortgage",
    verticalName: "Mortgage",
    apiKey: "BUYER-ACME-KEY-001",
    postLeadUrl: "https://buyer.acmefinancial.com/api/leads",
    status: "Active",
    mappings: [{ source: "phone", destination: "customer_phone" }],
  },
  {
    id: "BUY-102",
    firstName: "Olivia",
    lastName: "Hart",
    email: "olivia.hart@zenhealth.com",
    phone: "+1 555 100 102",
    company: "Zen Health",
    verticalId: "health",
    verticalName: "Health Insurance",
    apiKey: "BUYER-ZEN-KEY-002",
    postLeadUrl: "https://buyer.zenhealth.com/api/leads",
    status: "Paused",
    mappings: [{ source: "email", destination: "email_address" }],
  },
  {
    id: "BUY-103",
    firstName: "Noah",
    lastName: "Cruz",
    email: "noah.cruz@primelegal.com",
    phone: "+1 555 100 103",
    company: "Prime Legal",
    verticalId: "legal",
    verticalName: "Legal",
    apiKey: "BUYER-PRIME-KEY-003",
    postLeadUrl: "https://buyer.primelegal.com/api/leads",
    status: "Active",
    mappings: [{ source: "fname", destination: "first_name" }],
  },
];

export const leads: Lead[] = [
  { id: "LED-8901", raw_data: "{\"phone\":\"+1-555-1010\",\"zip\":\"11201\"}", normalized_data: "Phone: +15551010, Zip: 11201", status: "Qualified" },
  { id: "LED-8902", raw_data: "{\"phone\":\"+1-555-2020\",\"zip\":\"90001\"}", normalized_data: "Phone: +15552020, Zip: 90001", status: "Pending" },
  { id: "LED-8903", raw_data: "{\"phone\":\"invalid\",\"zip\":\"-\"}", normalized_data: "Phone: N/A, Zip: N/A", status: "Rejected" },
];

export const distributionLogs: DistributionLog[] = [
  { id: "DST-5001", buyer: "Acme Financial", payload: "{lead_id: LED-8901}", response: "200 OK", status: "Success" },
  { id: "DST-5002", buyer: "Zen Health", payload: "{lead_id: LED-8902}", response: "Timeout", status: "Failed" },
  { id: "DST-5003", buyer: "Prime Legal", payload: "{lead_id: LED-8903}", response: "202 Accepted", status: "Success" },
];
