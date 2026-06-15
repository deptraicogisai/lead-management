export type PhonexaProductCatalogItem = {
  id: number;
  name: string;
};

export type PhonexaProductCategory = {
  category: string;
  subCategories: PhonexaProductCatalogItem[];
};

export const PHONEXA_PRODUCT_CATALOG: PhonexaProductCategory[] = [
  {
    category: "Education",
    subCategories: [{ id: 181, name: "Education" }],
  },
  {
    category: "Financial Services",
    subCategories: [
      { id: 121, name: "Auto Finance" },
      { id: 178, name: "Auto Finance Ping Post" },
      { id: 250, name: "Auto Finance Ping Post Expanded" },
      { id: 3, name: "Business Loan US" },
      { id: 143, name: "Car Finance UK" },
      { id: 147, name: "Car Finance UK Old" },
      { id: 123, name: "Credit Card Debt Settlement" },
      { id: 148, name: "Debt UK" },
      { id: 218, name: "Debt US" },
      { id: 46, name: "Financial Advice UK" },
      { id: 215, name: "Financial Advisor Direct UK" },
      { id: 124, name: "Merchant Cash Advance" },
      { id: 261, name: "Mortgage Equity Ping Post" },
      { id: 260, name: "Mortgage New Home Purchase Ping Post" },
      { id: 182, name: "Mortgage Ping Post" },
      { id: 168, name: "Mortgage Refinance Ping Post" },
      { id: 259, name: "Mortgage Refinance Ping Post Expanded" },
      { id: 8, name: "Mortgage US" },
      { id: 22, name: "Mortgage US Home Equity" },
      { id: 23, name: "Mortgage US Refinance" },
      { id: 125, name: "Payday Settlement" },
      { id: 1, name: "Payday US" },
      { id: 216, name: "Pension Anonymous UK" },
      { id: 188, name: "Pension UK" },
      { id: 43, name: "Personal Loan US" },
      { id: 19, name: "Personal Loan US (hybrid)" },
      { id: 150, name: "Second Charge Mortgage UK" },
      { id: 4, name: "Short Term/Installment Loan UK" },
      { id: 225, name: "Simple Mortgage UK" },
      { id: 122, name: "Student Loan Debt Consolidation" },
      { id: 126, name: "Title Loans" },
      { id: 324, name: "UK Short-Term Loan Comparison" },
    ],
  },
  {
    category: "Health wellness and Fitness",
    subCategories: [
      { id: 116, name: "Diabetes" },
      { id: 29, name: "Insurance Health US" },
      { id: 104, name: "Nursing" },
    ],
  },
  {
    category: "Home Services",
    subCategories: [
      { id: 288, name: "Bathroom Remodeling Ping Post" },
      { id: 263, name: "Boiler Repair/Replacement UK" },
      { id: 184, name: "Car Shipping Ping Post" },
      { id: 264, name: "Conservatories UK" },
      { id: 289, name: "Gutters Ping Post" },
      { id: 44, name: "Home Improvement Ping Post" },
      { id: 102, name: "Home Service Healthcare" },
      { id: 57, name: "HVAC" },
      { id: 171, name: "HVAC" },
      { id: 170, name: "HVAC Ping Post" },
      { id: 290, name: "Kitchen Remodeling Ping Post" },
      { id: 56, name: "Lawn Care" },
      { id: 214, name: "Mobile Home" },
      { id: 183, name: "Moving Ping Post" },
      { id: 226, name: "Moving US" },
      { id: 54, name: "Pest Control" },
      { id: 58, name: "Plumbing" },
      { id: 55, name: "Roofing" },
      { id: 172, name: "Roofing" },
      { id: 169, name: "Roofing Ping Post" },
      { id: 256, name: "Skip Waste Disposal UK" },
      { id: 249, name: "Spray Foam Insulation Ping Post" },
      { id: 276, name: "Walk in Tubs Ping Post" },
      { id: 258, name: "Window Installation - Smart Tree UK" },
      { id: 220, name: "Window Installation UK" },
      { id: 53, name: "Windows" },
      { id: 286, name: "Windows Ping Post" },
      { id: 34, name: "Windows Services US" },
    ],
  },
  {
    category: "Insurance",
    subCategories: [
      { id: 173, name: "Health Insurance Ping Post Expanded" },
      { id: 149, name: "Annuity" },
      { id: 187, name: "Auto Insurance Ping Post" },
      { id: 224, name: "Auto Insurance Ping Post (Conditional fields)" },
      { id: 97, name: "Burial Insurance" },
      { id: 107, name: "Car Insurance Call APP" },
      { id: 98, name: "Commercial Business Insurance" },
      { id: 166, name: "Cyber Insurance" },
      { id: 95, name: "Dental Insurance" },
      { id: 96, name: "Disaster Insurance" },
      { id: 222, name: "Final Expense Direct Post" },
      { id: 194, name: "Final Expense Ping Post" },
      { id: 282, name: "Funeral Plans UK" },
      { id: 100, name: "Health Insurance" },
      { id: 160, name: "Health Insurance Pingpost" },
      { id: 219, name: "Health Insurance UK" },
      { id: 115, name: "Home Insurance (DO NOT USE)" },
      { id: 277, name: "Home Insurance Ping Post" },
      { id: 284, name: "Home Insurance Ping Post (Conditional Fields)" },
      { id: 217, name: "Insurance (Auto) Ping Post Calls" },
      { id: 14, name: "Insurance Car US" },
      { id: 164, name: "Insurance Car US 2" },
      { id: 162, name: "Insurance Car US 2 Pingpost" },
      { id: 105, name: "Insurance Car US Pingpost" },
      { id: 161, name: "Insurance Health Ping Post" },
      { id: 35, name: "Insurance Life 2 US" },
      { id: 9, name: "Insurance Life US" },
      { id: 101, name: "Insurance Life US 2 NEW" },
      { id: 163, name: "Insurance Life US 2 Pingpost" },
      { id: 165, name: "Liability Insurance" },
      { id: 192, name: "Life Insurance Expanded Ping Post" },
      { id: 190, name: "Life Insurance Ping Post" },
      { id: 279, name: "Life Insurance UK" },
      { id: 221, name: "LMS Medicare" },
      { id: 167, name: "Medicare" },
      { id: 285, name: "Medicare Health Hybrid Ping Post" },
      { id: 113, name: "Medicare Ping Post Expanded" },
      { id: 114, name: "Medicare Pingpost" },
      { id: 52, name: "Now Insurance Services" },
      { id: 99, name: "Pet Insurance" },
      { id: 93, name: "Supplemental Insurance" },
      { id: 94, name: "Travel Insurance" },
    ],
  },
  {
    category: "Legal",
    subCategories: [
      { id: 252, name: "Asbestos and Mesothelioma Ping Post" },
      { id: 127, name: "Bankruptcy" },
      { id: 151, name: "Bankruptcy Ping Post" },
      { id: 246, name: "Criminal Defense Ping Post" },
      { id: 243, name: "DUI Ping Post" },
      { id: 291, name: "Employment Law Ping Post" },
      { id: 254, name: "Immigration Ping Post" },
      { id: 175, name: "Legal" },
      { id: 253, name: "Legal Bankruptcy Ping Post" },
      { id: 180, name: "Legal Clergy" },
      { id: 242, name: "Legal General Ping Post" },
      { id: 185, name: "Legal Ping Post" },
      { id: 179, name: "Legal Talc" },
      { id: 278, name: "Marriage Tax Claims UK" },
      { id: 195, name: "Motor Vehicle Accident" },
      { id: 45, name: "Motor Vehicle Accident Ping Post" },
      { id: 293, name: "PCP Claims UK" },
      { id: 280, name: "Personal Injury Claims UK" },
      { id: 245, name: "Personal Injury Ping Post" },
      { id: 247, name: "Social Security Disability Ping Post" },
      { id: 255, name: "Tax Law Ping Post" },
      { id: 248, name: "Traffic Law Ping Post" },
      { id: 283, name: "Will Writing UK" },
      { id: 244, name: "Workers Comp Ping Post" },
    ],
  },
  {
    category: "Management Consulting",
    subCategories: [{ id: 257, name: "Franchise Candidates with Categories" }],
  },
  {
    category: "Real Estate",
    subCategories: [{ id: 174, name: "Real Estate" }],
  },
  {
    category: "Solar",
    subCategories: [
      { id: 130, name: "Solar" },
      { id: 262, name: "Solar Panels UK" },
      { id: 177, name: "Solar Ping Post" },
    ],
  },
  {
    category: "Utilities",
    subCategories: [
      { id: 120, name: "Broadband Internet UK" },
      { id: 176, name: "Mobile UK" },
    ],
  },
  {
    category: "Other",
    subCategories: [
      { id: 42, name: "Email Signup US" },
      { id: 186, name: "Hybrid UK" },
      { id: 292, name: "Life Insurance Ping Post Short Form" },
      { id: 25, name: "User Data Collector" },
    ],
  },
];

export function findCatalogProduct(productId: number) {
  for (const category of PHONEXA_PRODUCT_CATALOG) {
    const product = category.subCategories.find((item) => item.id === productId);
    if (product) {
      return { category: category.category, ...product };
    }
  }

  return null;
}

export function getAllCatalogProductIds() {
  return PHONEXA_PRODUCT_CATALOG.flatMap((category) => category.subCategories.map((item) => item.id));
}
