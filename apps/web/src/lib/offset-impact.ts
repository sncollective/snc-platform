// Pika Project offset impact calculations
// https://pikapartners.org/carbon/

// ── Constants ──

const DOLLARS_PER_TONNE = 30;
const SPLT_SHARE = 0.80;
const DOLLARS_PER_ACRE = 480;
const SQ_FT_PER_ACRE = 43560;

// ── Public Types ──

export interface OffsetImpactCard {
  readonly label: string;
  readonly value: string;
  readonly unit: string;
}

// ── Public API ──

/** Compute Pika Project donation amount and grassland area protected from CO2 offset kilograms. */
export function computeOffsetImpact(offsetCo2Kg: number): OffsetImpactCard[] {
  if (offsetCo2Kg <= 0) return [];

  const donation = (offsetCo2Kg / 1000) * DOLLARS_PER_TONNE;
  const spltShare = donation * SPLT_SHARE;
  const acres = spltShare / DOLLARS_PER_ACRE;
  const sqFt = acres * SQ_FT_PER_ACRE;

  const cards: OffsetImpactCard[] = [
    {
      label: "Pika Project donation",
      value: `$${donation.toFixed(2)}`,
      unit: "USD",
    },
  ];

  if (acres >= 1) {
    cards.push({
      label: "Grassland protected",
      value: acres.toFixed(2),
      unit: "acres",
    });
  } else {
    cards.push({
      label: "Grassland protected",
      value: Math.round(sqFt).toLocaleString(),
      unit: "sq ft",
    });
  }

  return cards;
}
