import { Part, CalculationResult, PackedSheet, SheetOptions } from "@/types";

interface Rect {
    x: number;
    y: number;
    w: number;
    h: number;
}

// Simple Guillotine Packer
class SheetPacker {
    width: number;
    height: number;
    kerf: number;
    freeRects: Rect[] = [];
    placedItems: { partId: string; category: string; x: number; y: number; w: number; h: number; rotated: boolean }[] = [];
    // expose public
    get leftovers() { return this.freeRects; }

    constructor(width: number, height: number, kerf: number) {
        this.width = width;
        this.height = height;
        this.kerf = kerf;
        // Initialize free rects
        // Round to 3 decimal places to avoid initial floating point noise if inputs were messy
        const w = Math.floor(width * 1000) / 1000;
        const h = Math.floor(height * 1000) / 1000;
        this.freeRects = [{ x: 0, y: 0, w, h }];
    }

    place(part: Part, allowRotation: boolean): boolean {
        // Part dimensions
        // Placement logic must ensure it fits within free rect.
        const EPSILON = 0.01;

        // We search best fit among free rects
        let bestScore = Number.MAX_VALUE;
        let bestRectIndex = -1;
        let bestRotated = false;

        for (let i = 0; i < this.freeRects.length; i++) {
            const rect = this.freeRects[i];

            // Try normal orientation
            // Check if rect fits part dimensions (ignoring kerf for the check, but we will consume it if we can)
            // Using a slightly more permissive EPSILON to handle floating point drift
            if (rect.w >= part.width - EPSILON && rect.h >= part.height - EPSILON) {
                const score = rect.w * rect.h - part.width * part.height;
                if (score < bestScore) {
                    bestScore = score;
                    bestRectIndex = i;
                    bestRotated = false;
                }
            }

            // Try rotated
            if (allowRotation && rect.w >= part.height - EPSILON && rect.h >= part.width - EPSILON) {
                const score = rect.w * rect.h - part.height * part.width;
                if (score < bestScore) {
                    bestScore = score;
                    bestRectIndex = i;
                    bestRotated = true;
                }
            }
        }

        if (bestRectIndex === -1) return false;

        // Place the part
        const rect = this.freeRects[bestRectIndex];
        const placedWidth = bestRotated ? part.height : part.width;
        const placedHeight = bestRotated ? part.width : part.height;

        this.placedItems.push({
            partId: part.id,
            x: rect.x + (this.kerf / 2), // Visual: assume kerf is split? Or just start at edge? usually edge.
            y: rect.y + (this.kerf / 2),
            w: placedWidth,
            h: placedHeight,
            category: part.category,
            rotated: bestRotated
        });

        // Remove used rect
        // Split remaining space (Guillotine)
        // Consumed space includes kerf.
        // But we must NOT consume more than exists.
        const consumedW = Math.min(rect.w, placedWidth + this.kerf);
        const consumedH = Math.min(rect.h, placedHeight + this.kerf);

        this.splitRect(bestRectIndex, consumedW, consumedH);

        return true;
    }

    private splitRect(rectIndex: number, placedW: number, placedH: number) {
        const rect = this.freeRects[rectIndex];
        this.freeRects.splice(rectIndex, 1);

        // Remaining
        const wRem = rect.w - placedW;
        const hRem = rect.h - placedH;

        // Heuristic: Split along shorter axis (Min Area Split)
        // If placedW < placedH, split vertically? Maximize rectangles?
        // Standard heuristic: "Split Shorter Leftover Axis" (SAS)
        // If wRem < hRem, split horizontally (full width bottom strip).

        const newRects: Rect[] = [];
        const splitHorizontally = wRem < hRem; // Maximize the bigger free area?

        if (splitHorizontally) {
            // Bottom strip is full width
            if (hRem > 0) newRects.push({ x: rect.x, y: rect.y + placedH, w: rect.w, h: hRem }); // Bottom
            if (wRem > 0) newRects.push({ x: rect.x + placedW, y: rect.y, w: wRem, h: placedH }); // Right
        } else {
            // Right strip is full height
            if (wRem > 0) newRects.push({ x: rect.x + placedW, y: rect.y, w: wRem, h: rect.h }); // Right
            if (hRem > 0) newRects.push({ x: rect.x, y: rect.y + placedH, w: placedW, h: hRem }); // Bottom
        }

        this.freeRects.push(...newRects);
    }
}

export function packParts(parts: Part[], options: SheetOptions): CalculationResult {
    // 1. Calculate Area Method
    const validParts = parts.filter(p => !p.errors || p.errors.length === 0);
    const totalAreaSqIn = validParts.reduce((sum, p) => sum + (p.width * p.height * p.qty), 0);
    const totalAreaSqFt = totalAreaSqIn / 144;

    // Add waste factor
    const totalWithWasteSqFt = totalAreaSqFt * (1 + (options.wasteFactor || 0)); // options.wasteFactor could be 0.1 for 10%

    // Sheet Area (usable or full?) Usually full sheet is purchased.
    // Usable is for packing.
    const sheetAreaSqIn = options.sheetWidth * options.sheetHeight;
    const sheetAreaSqFt = sheetAreaSqIn / 144;

    const sheetsAreaMethod = Math.ceil(totalWithWasteSqFt / sheetAreaSqFt);

    // 2. Packing Method
    // Prepare flattened list of items
    const itemsToPack: Part[] = [];
    validParts.forEach(p => {
        for (let i = 0; i < p.qty; i++) {
            // Create unique instance for each unit to avoid key collisions
            itemsToPack.push({
                ...p,
                id: `${p.id}_${i}`, // Append index for uniqueness
                qty: 1
            });
        }
    });

    // Sort descending by max dimension (Length)
    itemsToPack.sort((a, b) => Math.max(b.width, b.height) - Math.max(a.width, a.height));

    const packedSheets: SheetPacker[] = [];
    const rotationAllowed = options.grainDirection === "None";

    // Usable dimensions
    // Round to 3 decimals to avoid javascript float weirdness
    // Example: 96 - (0 * 2) = 96.0000 
    const usableW = Math.floor((options.sheetWidth - (options.margin * 2)) * 1000) / 1000;
    const usableH = Math.floor((options.sheetHeight - (options.margin * 2)) * 1000) / 1000;

    const unpacked: Part[] = [];

    // First Fit Decreasing
    for (const item of itemsToPack) {
        let placed = false;

        // Try existing sheets
        for (const sheet of packedSheets) {
            if (sheet.place(item, rotationAllowed)) {
                placed = true;
                break;
            }
        }

        // If not placed, create new sheet
        if (!placed) {
            const newSheet = new SheetPacker(usableW, usableH, options.kerf);
            if (newSheet.place(item, rotationAllowed)) {
                packedSheets.push(newSheet);
                placed = true;
            } else {
                // Item too big for empty sheet
                unpacked.push(item);
            }
        }
    }

    // Safety Buffer (Sheets Packing Method)
    const sheetsBase = packedSheets.length;
    const extraSheets = Math.ceil(sheetsBase * (options.safetyBuffer / 100));
    const finalCount = sheetsBase + extraSheets;

    // Convert to Result format
    const results: PackedSheet[] = packedSheets.map((s, idx) => ({
        sheetId: idx + 1,
        width: options.sheetWidth,
        height: options.sheetHeight,
        parts: s.placedItems,
        wasteArea: (usableW * usableH) - s.placedItems.reduce((sum, item) => sum + (item.w * item.h), 0),
        leftovers: s.leftovers
    }));

    return {
        totalAreaSqFt: Number(totalAreaSqFt.toFixed(2)),
        totalWithWasteSqFt: Number(totalWithWasteSqFt.toFixed(2)),
        sheetsAreaMethod,
        sheetsPackingMethod: finalCount,
        packedSheets: results,
        unpackedParts: unpacked
    };
}
