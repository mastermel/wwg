import { createContext } from "react";
import type { Hex } from "@/features/maps/hex-grid";

/**
 * Shows a hex on the Map page (decision 0040): opens its drawer and centres the map on it. Given by
 * the Map page to the panels beside its map; elsewhere there's none, and a hex is only named.
 */
export const ShowHexContext = createContext<((hex: Hex) => void) | null>(null);
