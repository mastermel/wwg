import type { DistanceUnit } from "@/api/generated/model";

const metresPer: Record<DistanceUnit, number> = { Kilometres: 1000, Miles: 1609.344 };

export const distanceUnitLabels: Record<DistanceUnit, { long: string; short: string }> = {
  Kilometres: { long: "Kilometres", short: "km" },
  Miles: { long: "Miles", short: "mi" },
};

/** Metres (as stored) in the campaign's unit, to a hundredth (whole metres keep 2.75 mi exact). */
export const toUnit = (metres: number, unit: DistanceUnit) =>
  Math.round((metres / metresPer[unit]) * 100) / 100;

/** A distance in the campaign's unit, in whole metres (as the API takes it). */
export const toMetres = (distance: number, unit: DistanceUnit) =>
  Math.round(distance * metresPer[unit]);

/**
 * The smallest and largest hex size (the API's 500 m and 50 km), in the campaign's unit, to a
 * hundredth inside them.
 */
export const minHexDistance = (unit: DistanceUnit) =>
  Math.ceil((500 / metresPer[unit]) * 100) / 100;
export const maxHexDistance = (unit: DistanceUnit) =>
  Math.floor((50_000 / metresPer[unit]) * 100) / 100;

/** The languages place names can be in (the API's list), for choosing one. */
export const labelLanguages = [
  { value: "local", label: "Each place's own" },
  { value: "en", label: "English" },
  { value: "fr", label: "French" },
  { value: "de", label: "German" },
  { value: "es", label: "Spanish" },
  { value: "it", label: "Italian" },
  { value: "pt", label: "Portuguese" },
  { value: "nl", label: "Dutch" },
  { value: "pl", label: "Polish" },
  { value: "ru", label: "Russian" },
  { value: "sv", label: "Swedish" },
  { value: "da", label: "Danish" },
];
