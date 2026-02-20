export type PartCategory =
    | "Vertical"
    | "Shelf"
    | "Door"
    | "Drawer Front"
    | "Base"
    | "Back"
    | "Toe Kick"
    | "Other";

export interface Part {
    id: string;
    category: PartCategory | string;
    qty: number;
    width: number;
    height: number;
    depth?: number;
    length?: number;
    label?: string; // Optional label/notes
    errors?: string[]; // Validation errors like 'Negative dims', 'Zero qty', etc.
}

export interface SheetOptions {
    sheetWidth: number;
    sheetHeight: number;
    kerf: number;
    margin: number;
    wasteFactor: number; // For area calculation
    grainDirection: "None" | "Vertical" | "Horizontal";
    algorithm: "Area" | "Guillotine";
    safetyBuffer: 0 | 5 | 10;
}

export interface PackedSheet {
    sheetId: number;
    width: number;
    height: number;
    parts: {
        partId: string;
        category: string;
        x: number;
        y: number;
        w: number;
        h: number;
        rotated: boolean;
    }[];
    wasteArea: number;
    leftovers: {
        x: number;
        y: number;
        w: number;
        h: number;
    }[];
}

export interface CalculationResult {
    totalAreaSqFt: number;
    totalWithWasteSqFt: number;
    sheetsAreaMethod: number;
    sheetsPackingMethod: number;
    packedSheets: PackedSheet[];
    unpackedParts: Part[]; // Parts that didn't fit
}
