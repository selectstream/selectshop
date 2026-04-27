import { describe, it, expect } from 'vitest';
import { calculateSignal } from './signal-engine';

describe('Signal Engine Logic', () => {
  it('calculates the correct weighted score for a 10/10 item', () => {
    const score = calculateSignal(10, 10, 10, 10);
    expect(score).toBe(10);
  });

  it('calculates a balanced average for default values (5/5)', () => {
    const score = calculateSignal(5, 5, 5, 5);
    expect(score).toBe(5);
  });

  it('weights Material and Cognitive higher (0.3 each)', () => {
    // 10 Mat, 0 Cog, 0 Mom, 0 Lon -> 3.0
    expect(calculateSignal(10, 0, 0, 0)).toBe(3.0);
    // 0 Mat, 10 Cog, 0 Mom, 0 Lon -> 3.0
    expect(calculateSignal(0, 10, 0, 0)).toBe(3.0);
  });

  it('weights Momentum and Longevity lower (0.2 each)', () => {
    // 0 Mat, 0 Cog, 10 Mom, 0 Lon -> 2.0
    expect(calculateSignal(0, 0, 10, 0)).toBe(2.0);
    // 0 Mat, 0 Cog, 0 Mom, 10 Lon -> 2.0
    expect(calculateSignal(0, 0, 0, 10)).toBe(2.0);
  });

  it('claps the output between 0 and 10', () => {
    expect(calculateSignal(20, 20, 20, 20)).toBe(10);
    expect(calculateSignal(-10, -10, -10, -10)).toBe(0);
  });
});
