import { packParts } from "./src/lib/packing";
import { SheetOptions, Part } from "./src/types";

// Mock Data
const parts: Part[] = [
    { id: "1", category: "Base", qty: 1, width: 4.5, height: 96, depth: 4.5, length: 96 }
];

const options: SheetOptions = {
    sheetWidth: 48,
    sheetHeight: 96,
    kerf: 0.125,
    margin: 0,
    wasteFactor: 0.1,
    grainDirection: "None",
    algorithm: "Guillotine",
    safetyBuffer: 0
};

console.log("Testing Packing base case...");
const result = packParts(parts, options);
console.log(`Packed: ${result.packedSheets.length}, Unpacked: ${result.unpackedParts.length}`);

// Test Case 2: Rotated Part (Width=96, Height=4.5)
console.log("\nTesting Rotated Part (96x4.5)...");
const parts2: Part[] = [
    { id: "2", category: "BaseRotated", qty: 1, width: 96, height: 4.5, depth: 96, length: 4.5 }
];
const result2 = packParts(parts2, options);
console.log(`Packed: ${result2.packedSheets.length}, Unpacked: ${result2.unpackedParts.length}`);
if (result2.unpackedParts.length > 0) console.log("Failed to pack rotated part");

// Test Case 3: Vertical Grain (Should fail if rotated dimensions needed)
console.log("\nTesting Vertical Grain with Rotated Part...");
const optionsVertical: SheetOptions = { ...options, grainDirection: "Vertical" };
// 96x4.5 needs rotation to fit on 48x96 because 96 > 48.
// If Grain is Vertical (Length), we assume Sheet Length (96) is Grain.
// If Part Length is 4.5? No, "grainDirection" restricts "rotation".
// If "Vertical", rotationAllowed = false.
// So 96x4.5 must be placed as 96 wide. 96 > 48. Fails.
const result3 = packParts(parts2, optionsVertical);
console.log(`Packed: ${result3.packedSheets.length}, Unpacked: ${result3.unpackedParts.length}`);

// Test Case 4: Base (4.5x96) with Vertical Grain (Should fit)
console.log("\nTesting Vertical Grain with Base (4.5x96)...");
const result4 = packParts(parts, optionsVertical);
console.log(`Packed: ${result4.packedSheets.length}, Unpacked: ${result4.unpackedParts.length}`);

