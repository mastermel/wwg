import { UnitType } from "@/api/generated/model";

/** How each unit type reads in the app. */
export const unitTypeLabels: Record<UnitType, string> = {
  LineInfantry: "Line Infantry",
  FootArtillery: "Foot Artillery",
  Engineers: "Engineers",
  LightInfantry: "Light Infantry",
  Partisans: "Partisans",
  LightCavalry: "Light Cavalry",
  Scouts: "Scouts",
  MediumCavalry: "Medium Cavalry",
  HeavyCavalry: "Heavy Cavalry",
  HorseArtillery: "Horse Artillery",
  SupplyTrain: "Supply Train",
  SiegeArtillery: "Siege Artillery",
  Boat: "Boat",
  Commander: "Commander",
};

/**
 * Whether a unit of this type fights: all but scouts (decision 0028), which have no FF or points.
 */
export const fights = (type: UnitType) => type !== UnitType.Scouts;

/**
 * The types a unit can be given, or a setting can choose, in the API's order, for a Select: not
 * scouts, which only the army's Add a scout makes, and which no setting counts (decision 0028).
 */
export const unitTypeOptions = Object.values(UnitType)
  .filter(fights)
  .map((value) => ({ value, label: unitTypeLabels[value] }));
