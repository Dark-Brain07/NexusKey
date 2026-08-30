import { describe, it, expect } from 'vitest';
import { genToWeiString, weiStringToGen, PROTOCOL_DEFAULTS } from '../protocolConfig.js';

describe('genToWeiString', () => {
  it('converts whole GEN amounts to wei correctly', () => {
    expect(genToWeiString(50)).toBe('50000000000000000000');
    expect(genToWeiString(1)).toBe('1000000000000000000');
  });

  it('converts fractional GEN amounts to wei correctly', () => {
    expect(genToWeiString(0.5)).toBe('500000000000000000');
  });

  it('matches the default claim bond minimum used by the contract', () => {
    expect(genToWeiString(PROTOCOL_DEFAULTS.CLAIM_BOND_MINIMUM_GEN)).toBe('50000000000000000000');
  });

  it('throws for negative amounts', () => {
    expect(() => genToWeiString(-1)).toThrow();
  });
});

describe('weiStringToGen', () => {
  it('round-trips with genToWeiString', () => {
    expect(weiStringToGen(genToWeiString(50))).toBe(50);
    expect(weiStringToGen(genToWeiString(0.5))).toBe(0.5);
  });

  it('converts the default bond minimum back to 50', () => {
    expect(weiStringToGen('50000000000000000000')).toBe(50);
  });
});
