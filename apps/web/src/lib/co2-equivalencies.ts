// EPA Greenhouse Gas Equivalencies Calculator factors
// https://www.epa.gov/energy/greenhouse-gas-equivalencies-calculator

// ── Constants ──

const KG_PER_MILE_DRIVEN = 0.404;
const KG_PER_SMARTPHONE_CHARGE = 0.00822;
const KG_PER_DAY_US_FOOTPRINT = 44.16;
const KG_PER_DAY_GLOBAL_FOOTPRINT = 12.33;
// ── Public Types ──

export interface Co2Equivalency {
  readonly label: string;
  readonly value: string;
  readonly unit: string;
}

// ── Private Helpers ──

function formatValue(n: number): string {
  if (n >= 100) return Math.round(n).toLocaleString();
  if (n >= 10) return n.toFixed(1);
  if (n >= 1) return n.toFixed(2);
  return n.toFixed(3);
}

function formatDuration(days: number): { value: string; unit: string } {
  if (days < 1) {
    const hours = days * 24;
    if (hours < 1) {
      const minutes = hours * 60;
      return { value: formatValue(minutes), unit: "minutes" };
    }
    return { value: formatValue(hours), unit: "hours" };
  }
  return { value: formatValue(days), unit: "days" };
}

// ── Public API ──

/** Convert a CO2 kg value into EPA-based real-world equivalencies (miles driven, smartphone charges, etc.). */
export function computeEquivalencies(co2Kg: number): Co2Equivalency[] {
  if (co2Kg <= 0) return [];

  const milesDriven = co2Kg / KG_PER_MILE_DRIVEN;
  const smartphoneCharges = co2Kg / KG_PER_SMARTPHONE_CHARGE;
  const usDays = co2Kg / KG_PER_DAY_US_FOOTPRINT;
  const globalDays = co2Kg / KG_PER_DAY_GLOBAL_FOOTPRINT;
  const usFootprint = formatDuration(usDays);
  const globalFootprint = formatDuration(globalDays);

  return [
    {
      label: "Miles driven",
      value: formatValue(milesDriven),
      unit: "miles",
    },
    {
      label: "Smartphone charges",
      value: formatValue(smartphoneCharges),
      unit: "charges",
    },
    {
      label: "Avg US footprint",
      value: usFootprint.value,
      unit: usFootprint.unit,
    },
    {
      label: "Avg global footprint",
      value: globalFootprint.value,
      unit: globalFootprint.unit,
    },
  ];
}
