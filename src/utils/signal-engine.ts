/**
 * SelectStream Signal Engine (SSE)
 * Calculates a 0-10 technical score based on material, cognitive, momentum, and longevity pillars.
 */
export function calculateSignal(materials: number = 5, cognitive: number = 5, momentum: number = 5, longevity: number = 5): number {
  // Formula: (Mat*0.3) + (Cog*0.3) + (Mom*0.2) + (Lon*0.2)
  const calculated = (materials * 0.3) + (cognitive * 0.3) + (momentum * 0.2) + (longevity * 0.2);
  return Math.min(Math.max(calculated, 0), 10);
}
