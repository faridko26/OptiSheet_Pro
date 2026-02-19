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
    placedItems: { partId: string; x: number; y: number; w: number; h: number; rotated: boolean }[] = [];

    constructor(width: number, height: number, kerf: number) {
        this.width = width;
        this.height = height;
        this.kerf = kerf;
        this.freeRects = [{ x: 0, y: 0, w: width, h: height }];
    }

    place(part: Part, allowRotation: boolean): boolean {
        // Part dimensions + kerf (we treat kerf as occupied space on the right/bottom of cut)
        // Actually simpler: Treat part as w+kerf, h+kerf.
        // Placement logic must ensure it fits within free rect.

        // We search best fit among free rects
        let bestScore = Number.MAX_VALUE;
        let bestRectIndex = -1;
        let bestRotated = false;

        // Expand part with kerf for placement calculation
        const pW = part.width + this.kerf;
        const pH = part.height + this.kerf;

        for (let i = 0; i < this.freeRects.length; i++) {
            const rect = this.freeRects[i];

            // Try normal orientation
            if (rect.w >= pW && rect.h >= pH) {
                const score = rect.w * rect.h - pW * pH; // Minimize area waste (Best Area Fit)
                // Alternative: Minimize short side residual (Best Short Side Fit) - better for long strips
                // const score = Math.min(rect.w - pW, rect.h - pH); 

                if (score < bestScore) {
                    bestScore = score;
                    bestRectIndex = i;
                    bestRotated = false;
                }
            }

            // Try rotated
            if (allowRotation && rect.w >= pH && rect.h >= pW) {
                const score = rect.w * rect.h - pH * pW;
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
        const placedWidth = bestRotated ? pH : pW;
        const placedHeight = bestRotated ? pW : pH;

        // Record placement (without kerf for visual, or with?)
        // Visuals usually want exact part dimensions.
        // The *space* consumed includes kerf.
        // We store visual position as rect.x, rect.y.

        this.placedItems.push({
            partId: part.id,
            x: rect.x + (this.kerf / 2), // Center in kerf gap? Or just align?
            // Alignment: Usually cut starts at edges. 
            // Simplest: x, y are cut lines. Part is inside.
            // We'll store x, y as the top-left corner of the part itself.
            y: rect.y + (this.kerf / 2),
            w: bestRotated ? part.height : part.width,
            h: bestRotated ? part.width : part.height,
            rotated: bestRotated
        });

        // Remove used rect
        // Split remaining space (Guillotine)
        this.splitRect(bestRectIndex, placedWidth, placedHeight);

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

        let newRects: Rect[] = [];
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
    let itemsToPack: Part[] = [];
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
    // For packing, we reduce sheet size by margin * 2
    // If margin is 0.25 on each side, width reduces by 0.5.
    const usableW = options.sheetWidth - (options.margin * 2);
    const usableH = options.sheetHeight - (options.margin * 2);

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
        wasteArea: (usableW * usableH) - s.placedItems.reduce((sum, item) => sum + (item.w * item.h), 0) // Area inside margin
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
