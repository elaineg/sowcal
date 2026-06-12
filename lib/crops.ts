// Built-in crop table. Offsets are Johnny's/extension-style defaults:
//   sowOffset      = days from last spring frost to the FIRST sowing (negative = before frost)
//   transplantAfter = days from sowing to transplant; null = direct-sow (no transplant events)
//   daysToHarvest  = days from sowing to expected first harvest
//   intervalDays   = suggested days between successive sowings

export interface CropDefaults {
  id: string;
  name: string;
  sowOffset: number;
  transplantAfter: number | null;
  daysToHarvest: number;
  intervalDays: number;
}

export const CROPS: CropDefaults[] = [
  { id: "lettuce", name: "Lettuce", sowOffset: -28, transplantAfter: 21, daysToHarvest: 55, intervalDays: 14 },
  { id: "arugula", name: "Arugula", sowOffset: -21, transplantAfter: null, daysToHarvest: 40, intervalDays: 14 },
  { id: "spinach", name: "Spinach", sowOffset: -42, transplantAfter: null, daysToHarvest: 45, intervalDays: 14 },
  { id: "radish", name: "Radish", sowOffset: -28, transplantAfter: null, daysToHarvest: 28, intervalDays: 10 },
  { id: "salad-turnip", name: "Salad Turnip", sowOffset: -28, transplantAfter: null, daysToHarvest: 38, intervalDays: 14 },
  { id: "carrot", name: "Carrot", sowOffset: -21, transplantAfter: null, daysToHarvest: 70, intervalDays: 21 },
  { id: "beet", name: "Beet", sowOffset: -28, transplantAfter: null, daysToHarvest: 55, intervalDays: 21 },
  { id: "cilantro", name: "Cilantro", sowOffset: -14, transplantAfter: null, daysToHarvest: 50, intervalDays: 14 },
  { id: "dill", name: "Dill", sowOffset: 0, transplantAfter: null, daysToHarvest: 45, intervalDays: 21 },
  { id: "basil", name: "Basil", sowOffset: -28, transplantAfter: 35, daysToHarvest: 60, intervalDays: 21 },
  { id: "bush-bean", name: "Bush Bean", sowOffset: 7, transplantAfter: null, daysToHarvest: 55, intervalDays: 14 },
  { id: "pea", name: "Pea", sowOffset: -42, transplantAfter: null, daysToHarvest: 60, intervalDays: 14 },
  { id: "sweet-corn", name: "Sweet Corn", sowOffset: 7, transplantAfter: null, daysToHarvest: 75, intervalDays: 14 },
  { id: "cucumber", name: "Cucumber", sowOffset: -14, transplantAfter: 21, daysToHarvest: 60, intervalDays: 21 },
  { id: "zucchini", name: "Zucchini", sowOffset: -14, transplantAfter: 21, daysToHarvest: 50, intervalDays: 28 },
  { id: "kale", name: "Kale", sowOffset: -42, transplantAfter: 28, daysToHarvest: 60, intervalDays: 28 },
  { id: "broccoli", name: "Broccoli", sowOffset: -42, transplantAfter: 28, daysToHarvest: 70, intervalDays: 21 },
  { id: "scallion", name: "Scallion", sowOffset: -28, transplantAfter: null, daysToHarvest: 60, intervalDays: 21 },
];

export const CROPS_BY_ID: ReadonlyMap<string, CropDefaults> = new Map(
  CROPS.map((c) => [c.id, c])
);

/** Display name for an unknown crop id, e.g. "red-lettuce" -> "Red Lettuce". */
export function titleizeId(id: string): string {
  return id
    .split(/[-_]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}
