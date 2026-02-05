// Standard government warning text per ABLA of 1988 (27 CFR Part 16)
export const STANDARD_WARNING_TEXT = `GOVERNMENT WARNING: (1) According to the Surgeon General, women should not drink alcoholic beverages during pregnancy because of the risk of birth defects. (2) Consumption of alcoholic beverages impairs your ability to drive a car or operate machinery, and may cause health problems.`;

// Matching thresholds
export const FUZZY_MATCH_THRESHOLD = 0.85;
export const ADDRESS_MATCH_THRESHOLD = 0.70;
export const VOLUME_TOLERANCE = 0.005; // 0.5% tolerance for volume conversions

// Volume unit conversions to milliliters
// Sorted by length (longest first) in parseVolume to avoid partial matches
export const ML_CONVERSIONS: Record<string, number> = {
  // Milliliters
  ml: 1,
  // Centiliters
  cl: 10,
  // Liters (multiple spellings)
  liters: 1000,
  litres: 1000,
  liter: 1000,
  litre: 1000,
  l: 1000,
  // Fluid ounces (many label variations)
  "fluid ounces": 29.5735,
  "fluid ounce": 29.5735,
  "fl. oz.": 29.5735,
  "fl oz.": 29.5735,
  "fl. oz": 29.5735,
  "fl oz": 29.5735,
  "fl.oz.": 29.5735,
  "fl.oz": 29.5735,
  floz: 29.5735,
  "oz.": 29.5735,
  oz: 29.5735,
  // Pints
  pints: 473.176,
  pint: 473.176,
  "pt.": 473.176,
  pt: 473.176,
  // Quarts
  quarts: 946.353,
  quart: 946.353,
  "qt.": 946.353,
  qt: 946.353,
  // Gallons
  gallons: 3785.41,
  gallon: 3785.41,
  "gal.": 3785.41,
  gal: 3785.41,
};

// Class/Type abbreviations (common alcohol industry abbreviations)
export const CLASS_TYPE_ABBREVIATIONS: Record<string, string> = {
  // Beer styles
  ipa: "india pale ale",
  dipa: "double india pale ale",
  neipa: "new england india pale ale",
  apa: "american pale ale",
  epa: "english pale ale",
  esb: "extra special bitter",
  // Cognac/Brandy grades
  vs: "very special",
  vsop: "very superior old pale",
  xo: "extra old",
  // Whiskey
  // Wine
  rsv: "reserve",
  res: "reserve",
  // General
  ltd: "limited",
  sr: "special reserve",
};

// Field configuration for verification
export const FIELD_CONFIG = {
  brandName: {
    displayName: "Brand Name",
    matchType: "brand" as const,
    required: true,
  },
  classType: {
    displayName: "Class/Type",
    matchType: "classType" as const,
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
    matchType: "country" as const,
    required: false,
  },
  governmentWarning: {
    displayName: "Government Warning",
    matchType: "strict" as const,
    required: true,
  },
} as const;

// Street type abbreviations
export const STREET_ABBREVIATIONS: Record<string, string> = {
  st: "street",
  ave: "avenue",
  blvd: "boulevard",
  dr: "drive",
  rd: "road",
  ln: "lane",
  pl: "place",
  cir: "circle",
  hwy: "highway",
  ste: "suite",
  apt: "apartment",
};

// US state abbreviations (2-letter postal codes)
export const STATE_ABBREVIATIONS: Record<string, string> = {
  al: "alabama",
  ak: "alaska",
  az: "arizona",
  ar: "arkansas",
  ca: "california",
  co: "colorado",
  ct: "connecticut",
  de: "delaware",
  fl: "florida",
  ga: "georgia",
  hi: "hawaii",
  id: "idaho",
  il: "illinois",
  in: "indiana",
  ia: "iowa",
  ks: "kansas",
  ky: "kentucky",
  la: "louisiana",
  me: "maine",
  md: "maryland",
  ma: "massachusetts",
  mi: "michigan",
  mn: "minnesota",
  ms: "mississippi",
  mo: "missouri",
  mt: "montana",
  ne: "nebraska",
  nv: "nevada",
  nh: "new hampshire",
  nj: "new jersey",
  nm: "new mexico",
  ny: "new york",
  nc: "north carolina",
  nd: "north dakota",
  oh: "ohio",
  ok: "oklahoma",
  or: "oregon",
  pa: "pennsylvania",
  ri: "rhode island",
  sc: "south carolina",
  sd: "south dakota",
  tn: "tennessee",
  tx: "texas",
  ut: "utah",
  vt: "vermont",
  va: "virginia",
  wa: "washington",
  wv: "west virginia",
  wi: "wisconsin",
  wy: "wyoming",
  dc: "district of columbia",
};

// Combined for backward compatibility (states take precedence for ambiguous cases like CT, FL)
export const ADDRESS_ABBREVIATIONS: Record<string, string> = {
  ...STREET_ABBREVIATIONS,
  ...STATE_ABBREVIATIONS,
};

// Common production phrases to strip from addresses
// These appear before the company name on labels but aren't part of the registered address
export const ADDRESS_PREFIXES_TO_STRIP = [
  // Standard production phrases
  "distilled and bottled by",
  "distilled, aged, and bottled by",
  "distilled, aged, and bottled in \\w+ by",  // "Distilled, Aged, and Bottled in Scotland by"
  "bottled by",
  "vinted and bottled by",
  "brewed by",
  "produced by",
  "produced and bottled by",
  "made by",
  "blended and bottled by",
  "blended by",
  "imported by",
  "imported and bottled by",
  "cellared and bottled by",
  "estate bottled by",
  "crafted by",
  "handcrafted by",
];
