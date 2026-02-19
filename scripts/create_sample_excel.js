const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const data = [
    { Category: "Vertical", Qty: 4, Width: 14, Height: 84, Notes: "Left Tower Uprights" },
    { Category: "Shelf", Qty: 6, Width: 14, Height: 24, Notes: "Adjustable Shelves" },
    { Category: "Shelf", Qty: 2, Width: 14, Height: 24, Notes: "Fixed Shelves" },
    { Category: "Drawer Front", Qty: 3, Width: 24, Height: 8, Notes: "Shaker Style" },
    { Category: "Door", Qty: 2, Width: 12, Height: 30, Notes: "Upper Doors" },
    { Category: "Base", Qty: 1, Width: 4, Height: 24, Notes: "Toe Kick" },
    { Category: "Back", Qty: 1, Width: 24, Height: 84, Notes: "1/4 inch backing" }
];

const ws = XLSX.utils.json_to_sheet(data);
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, "Parts List");

const outPath = path.resolve(__dirname, '../public/sample_closet_job.xlsx');

// Ensure public dir exists
if (!fs.existsSync(path.dirname(outPath))) {
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
}

XLSX.writeFile(wb, outPath);
console.log(`Created sample file at ${outPath}`);
