/**
 * Deterministic address normalization and canonical property-key derivation.
 *
 * This is intentionally pure, synchronous string logic — no external
 * geocoding API, no network call, no LLM. The same input always produces
 * the same property_key on the client, the backend, and (recomputed for
 * verification) inside the Intelligent Contract. That determinism is what
 * lets the contract trust a property_key without doing its own address
 * lookup.
 */

const STREET_ABBREVIATIONS: Record<string, string> = {
  ST: 'STREET',
  STR: 'STREET',
  AVE: 'AVENUE',
  AV: 'AVENUE',
  BLVD: 'BOULEVARD',
  RD: 'ROAD',
  DR: 'DRIVE',
  LN: 'LANE',
  CT: 'COURT',
  PL: 'PLACE',
  SQ: 'SQUARE',
  TER: 'TERRACE',
  PKWY: 'PARKWAY',
  HWY: 'HIGHWAY',
  CIR: 'CIRCLE',
  WAY: 'WAY',
  N: 'NORTH',
  S: 'SOUTH',
  E: 'EAST',
  W: 'WEST',
  NE: 'NORTHEAST',
  NW: 'NORTHWEST',
  SE: 'SOUTHEAST',
  SW: 'SOUTHWEST',
};

const UNIT_ABBREVIATIONS: Record<string, string> = {
  APT: '',
  APARTMENT: '',
  UNIT: '',
  STE: '',
  SUITE: '',
  '#': '',
  FL: '',
  FLOOR: '',
};

function collapseWhitespace(input: string): string {
  return input.trim().replace(/\s+/g, ' ');
}

function stripPunctuation(input: string): string {
  return input.replace(/[.,]/g, '');
}

/**
 * Normalizes a free-text street address into a canonical uppercase form:
 * expands common abbreviations, strips punctuation, collapses whitespace.
 * "123 Main St., Apt. 4-B" and "123 Main Street" both normalize consistently
 * for the *street* portion; unit handling is separate (see normalizeUnit).
 */
export function normalizeStreetAddress(raw: string): string {
  const cleaned = collapseWhitespace(stripPunctuation(raw)).toUpperCase();
  const tokens = cleaned.split(' ').map((token) => STREET_ABBREVIATIONS[token] ?? token);
  return tokens.join(' ');
}

/**
 * Normalizes a unit/apartment identifier: strips common prefixes
 * (Apt, Unit, Suite, #, Floor) and punctuation, keeping only the
 * alphanumeric identifier itself, uppercased.
 * "Apt. 4-B", "Unit 4B", "#4B" -> "4B"
 */
export function normalizeUnit(raw: string | null | undefined): string {
  if (!raw) return '';
  let cleaned = collapseWhitespace(stripPunctuation(raw)).toUpperCase();
  for (const prefix of Object.keys(UNIT_ABBREVIATIONS)) {
    const pattern = new RegExp(`^${prefix.replace('#', '\\#')}\\s*`, 'i');
    cleaned = cleaned.replace(pattern, '');
  }
  return cleaned.replace(/[\s-]/g, '');
}

export function normalizeRegionField(raw: string): string {
  return collapseWhitespace(stripPunctuation(raw)).toUpperCase();
}

export interface CanonicalPropertyFields {
  country: string;
  stateOrRegion: string;
  city: string;
  normalizedStreetAddress: string;
  normalizedUnit: string;
}

/**
 * Builds the pipe-delimited canonical representation used as hash input.
 * The delimiter choice (and uppercasing) means "New York" and "NEW YORK"
 * collapse to the same key, but a genuinely different city never collides
 * with another by accident because each field is normalized independently
 * before joining — no field can "bleed" into the next.
 */
export function buildCanonicalPropertyString(fields: CanonicalPropertyFields): string {
  const { country, stateOrRegion, city, normalizedStreetAddress, normalizedUnit } = fields;
  return [
    normalizeRegionField(country),
    normalizeRegionField(stateOrRegion),
    normalizeRegionField(city),
    normalizedStreetAddress,
    normalizedUnit,
  ].join('|');
}

export interface NormalizeAddressInput {
  country: string;
  stateOrRegion: string;
  city: string;
  streetAddress: string;
  unit?: string | null;
}

export interface NormalizedAddress extends CanonicalPropertyFields {
  canonicalString: string;
}

export function normalizeAddress(input: NormalizeAddressInput): NormalizedAddress {
  const normalizedStreetAddress = normalizeStreetAddress(input.streetAddress);
  const normalizedUnit = normalizeUnit(input.unit);
  const fields: CanonicalPropertyFields = {
    country: normalizeRegionField(input.country),
    stateOrRegion: normalizeRegionField(input.stateOrRegion),
    city: normalizeRegionField(input.city),
    normalizedStreetAddress,
    normalizedUnit,
  };
  return { ...fields, canonicalString: buildCanonicalPropertyString(fields) };
}

/**
 * Hashes the canonical string into the final property_key using SHA-256,
 * via the Web Crypto API — available in both browsers and Node >=20, so
 * the exact same function runs client-side (claim form) and server-side
 * (indexer reconciliation) without a build-time branch.
 */
export async function computePropertyKey(canonicalString: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(canonicalString);
  const digest = await globalThis.crypto.subtle.digest('SHA-256', data);
  const bytes = Array.from(new Uint8Array(digest));
  return bytes.map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function computePropertyKeyFromAddress(
  input: NormalizeAddressInput,
): Promise<{ propertyKey: string; normalized: NormalizedAddress }> {
  const normalized = normalizeAddress(input);
  const propertyKey = await computePropertyKey(normalized.canonicalString);
  return { propertyKey, normalized };
}
