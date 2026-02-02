// Standard government warning text per ABLA of 1988 (27 CFR Part 16)
export const STANDARD_WARNING_TEXT = `GOVERNMENT WARNING: (1) According to the Surgeon General, women should not drink alcoholic beverages during pregnancy because of the risk of birth defects. (2) Consumption of alcoholic beverages impairs your ability to drive a car or operate machinery, and may cause health problems.`;

// Matching thresholds
export const FUZZY_MATCH_THRESHOLD = 0.85;
export const ADDRESS_MATCH_THRESHOLD = 0.70;
export const VOLUME_TOLERANCE = 0.005; // 0.5% tolerance for volume conversions

// Volume unit conversions to milliliters
export const ML_CONVERSIONS: Record<string, number> = {
  ml: 1,
  cl: 10,
  l: 1000,
  "fl oz": 29.5735,
  "fl. oz": 29.5735,
  "fl.oz": 29.5735,
  oz: 29.5735, // In beverage context, oz = fl oz
  pt: 473.176,
  qt: 946.353,
  gal: 3785.41,
};

// Field configuration for verification
export const FIELD_CONFIG = {
  brandName: {
    displayName: "Brand Name",
    matchType: "fuzzy" as const,
    required: true,
  },
  classType: {
    displayName: "Class/Type",
    matchType: "fuzzy" as const,
    required: true,
  },
  alcoholContent: {
    displayName: "Alcohol Content",
    matchType: "abv" as const,
    required: true,
  },
  netContents: {
    displayName: "Net Contents",
    matchType: "volume" as const,
    required: true,
  },
  nameAddress: {
    displayName: "Name & Address",
    matchType: "address" as const,
    required: true,
  },
  countryOfOrigin: {
    displayName: "Country of Origin",
    matchType: "strict" as const,
    required: false,
  },
  governmentWarning: {
    displayName: "Government Warning",
    matchType: "strict" as const,
    required: true,
  },
} as const;

// Address abbreviation normalizations
export const ADDRESS_ABBREVIATIONS: Record<string, string> = {
  st: "street",
  ave: "avenue",
  blvd: "boulevard",
  dr: "drive",
  rd: "road",
  ln: "lane",
  ct: "court",
  pl: "place",
  cir: "circle",
  hwy: "highway",
  ste: "suite",
  apt: "apartment",
  fl: "floor",
};
