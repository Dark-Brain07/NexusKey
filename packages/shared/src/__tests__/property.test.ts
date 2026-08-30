import { describe, it, expect } from 'vitest';
import {
  normalizeStreetAddress,
  normalizeUnit,
  normalizeRegionField,
  buildCanonicalPropertyString,
  normalizeAddress,
  computePropertyKey,
  computePropertyKeyFromAddress,
} from '../property.js';

describe('normalizeStreetAddress', () => {
  it('expands common abbreviations and uppercases', () => {
    expect(normalizeStreetAddress('123 Main St.')).toBe('123 MAIN STREET');
    expect(normalizeStreetAddress('456 Oak Ave')).toBe('456 OAK AVENUE');
  });

  it('collapses whitespace and strips punctuation', () => {
    expect(normalizeStreetAddress('123   Main   St.')).toBe('123 MAIN STREET');
  });

  it('produces the same result for equivalent representations', () => {
    expect(normalizeStreetAddress('123 Main Street')).toBe(normalizeStreetAddress('123 Main St.'));
  });
});

describe('normalizeUnit', () => {
  it('strips common unit prefixes and punctuation', () => {
    expect(normalizeUnit('Apt. 4-B')).toBe('4B');
    expect(normalizeUnit('Unit 4B')).toBe('4B');
    expect(normalizeUnit('#4B')).toBe('4B');
    expect(normalizeUnit('Apartment 4B')).toBe('4B');
  });

  it('returns empty string for null/undefined/empty input', () => {
    expect(normalizeUnit(null)).toBe('');
    expect(normalizeUnit(undefined)).toBe('');
    expect(normalizeUnit('')).toBe('');
  });

  it('treats equivalent unit representations identically', () => {
    const a = normalizeUnit('Apt. 4-B');
    const b = normalizeUnit('Unit 4B');
    const c = normalizeUnit('Apartment 4B');
    expect(a).toBe(b);
    expect(b).toBe(c);
  });

  it('does NOT collide two genuinely different units', () => {
    expect(normalizeUnit('4A')).not.toBe(normalizeUnit('4B'));
  });
});

describe('normalizeRegionField', () => {
  it('uppercases and trims', () => {
    expect(normalizeRegionField('  new york  ')).toBe('NEW YORK');
  });
});

describe('buildCanonicalPropertyString', () => {
  it('joins normalized fields with a pipe delimiter', () => {
    const canonical = buildCanonicalPropertyString({
      country: 'US',
      stateOrRegion: 'NY',
      city: 'NEW YORK',
      normalizedStreetAddress: '123 MAIN STREET',
      normalizedUnit: '4B',
    });
    expect(canonical).toBe('US|NY|NEW YORK|123 MAIN STREET|4B');
  });
});

describe('normalizeAddress', () => {
  it('produces identical canonical strings for equivalent addresses (the core README example)', () => {
    const a = normalizeAddress({
      country: 'US',
      stateOrRegion: 'NY',
      city: 'New York',
      streetAddress: '123 Main Street',
      unit: 'Unit 4B',
    });
    const b = normalizeAddress({
      country: 'us',
      stateOrRegion: 'ny',
      city: 'new york',
      streetAddress: '123 Main St.',
      unit: 'Apt. 4-B',
    });
    expect(a.canonicalString).toBe(b.canonicalString);
  });

  it('distinguishes genuinely different units on the same street (never collide 4A and 4B)', () => {
    const unit4a = normalizeAddress({
      country: 'US',
      stateOrRegion: 'IL',
      city: 'Springfield',
      streetAddress: '123 Main Street',
      unit: '4A',
    });
    const unit4b = normalizeAddress({
      country: 'US',
      stateOrRegion: 'IL',
      city: 'Springfield',
      streetAddress: '123 Main Street',
      unit: '4B',
    });
    expect(unit4a.canonicalString).not.toBe(unit4b.canonicalString);
  });

  it('does not let one field bleed into another (field independence)', () => {
    // "New" as a city and "New" appearing inside a street name must not
    // produce the same canonical string as swapping which field it's in.
    const a = normalizeAddress({
      country: 'US',
      stateOrRegion: 'NY',
      city: 'New York',
      streetAddress: 'Main Street',
      unit: '',
    });
    const b = normalizeAddress({
      country: 'US',
      stateOrRegion: 'NY',
      city: 'York',
      streetAddress: 'New Main Street',
      unit: '',
    });
    expect(a.canonicalString).not.toBe(b.canonicalString);
  });
});

describe('computePropertyKey', () => {
  it('produces a 64-character lowercase hex SHA-256 digest', async () => {
    const key = await computePropertyKey('US|NY|NEW YORK|123 MAIN STREET|4B');
    expect(key).toMatch(/^[0-9a-f]{64}$/);
  });

  it('is deterministic -- same input always produces the same key', async () => {
    const key1 = await computePropertyKey('US|NY|NEW YORK|123 MAIN STREET|4B');
    const key2 = await computePropertyKey('US|NY|NEW YORK|123 MAIN STREET|4B');
    expect(key1).toBe(key2);
  });

  it('produces different keys for different canonical strings', async () => {
    const key1 = await computePropertyKey('US|NY|NEW YORK|123 MAIN STREET|4A');
    const key2 = await computePropertyKey('US|NY|NEW YORK|123 MAIN STREET|4B');
    expect(key1).not.toBe(key2);
  });
});

describe('computePropertyKeyFromAddress', () => {
  it('produces the same property_key for equivalent addresses end-to-end', async () => {
    const { propertyKey: keyA } = await computePropertyKeyFromAddress({
      country: 'US',
      stateOrRegion: 'NY',
      city: 'New York',
      streetAddress: '123 Main Street',
      unit: 'Unit 4B',
    });
    const { propertyKey: keyB } = await computePropertyKeyFromAddress({
      country: 'US',
      stateOrRegion: 'NY',
      city: 'New York',
      streetAddress: '123 Main St.',
      unit: 'Apt. 4-B',
    });
    expect(keyA).toBe(keyB);
    expect(keyA).toMatch(/^[0-9a-f]{64}$/);
  });
});
