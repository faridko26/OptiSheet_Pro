import * as XLSX from "xlsx";
import { Part } from "@/types";

// Column mapping heuristics
const FIELD_MAP: Record<string, string[]> = {
    category: ["component", "category", "part", "description", "item", "name", "type"],
    qty: ["qty", "quantity", "count", "pieces", "pcs"],
    width: ["width", "w", "wid"],
    height: ["height", "h"],
    depth: ["depth", "d"],
    length: ["length", "len", "l", "long"],
    notes: ["special instructions", "notes", "note", "comments", "remark", "instruction"]
};

function normalizeHeader(header: string): string {
    return String(header).toLowerCase().replace(/[^a-z0-9]/g, "");
}

// Parse function for dimensions that might be fractions (e.g. "31 3/4")
function parseDimension(value: any): number {
    if (typeof value === "number") return value;
    if (!value) return 0;

    const str = String(value).trim();

    // Try simple float
    const simple = parseFloat(str);
    if (!isNaN(simple) && String(simple) === str) return simple; // Exact match

    // Handle fractions
    try {
        const parts = str.split(" ");
        let total = 0;
        for (const part of parts) {
            if (part.includes("/")) {
                const [num, den] = part.split("/").map(Number);
                if (den !== 0) total += num / den;
            } else {
                const val = parseFloat(part);
                if (!isNaN(val)) total += val;
            }
        }
        return total > 0 ? total : simple;
    } catch (e) {
        return 0;
    }
}

function mapRowToPart(row: any, rowIndex: number): Part | null {
    const keys = Object.keys(row);

    const findValue = (field: keyof typeof FIELD_MAP): any => {
        let bestValue = undefined;
        for (const key of keys) {
            const normKey = normalizeHeader(key);
            const matches = FIELD_MAP[field].some(alias => normKey === alias || normKey.includes(alias));
            if (matches) {
                const val = row[key];
                if (val !== undefined && val !== "" && val !== null) return val;
                if (bestValue === undefined) bestValue = val;
            }
        }
        return bestValue;
    };

    const categoryVal = findValue("category");
    if (!categoryVal) return null;
    const categoryStr = String(categoryVal).trim();
    if (!categoryStr || categoryStr.toLowerCase() === "warehouse") return null;

    const qty = Number(findValue("qty"));

    // Parse all 4 dimensions
    let widthVal = parseDimension(findValue("width"));
    let heightVal = parseDimension(findValue("height"));
    let depthVal = parseDimension(findValue("depth"));
    let lengthVal = parseDimension(findValue("length"));

    const notes = findValue("notes");

    // Determine effective Width/Height for internal calculation
    // "Width" usually means the cut width. "Height" usually means Cut Length.
    // If Depth/Length exist, they usually map to Width/Length of part.

    let finalW = widthVal;
    let finalH = heightVal;

    if (finalW === 0 && depthVal > 0) finalW = depthVal;
    if (finalH === 0 && lengthVal > 0) finalH = lengthVal;

    // Validation: If still 0, invalid part
    if (!qty && !finalW && !finalH) return null;

    const part: Part = {
        id: `row-${rowIndex}`,
        category: categoryStr,
        qty: isNaN(qty) ? 0 : qty,
        width: finalW,   // Effective Width
        height: finalH,  // Effective Height
        depth: depthVal > 0 ? depthVal : undefined,
        length: lengthVal > 0 ? lengthVal : undefined,
        label: notes ? String(notes) : "",
        errors: []
    };

    if (part.qty <= 0) part.errors?.push("Zero or negative qty");
    if (part.width <= 0) part.errors?.push("Invalid dims");

    return part;
}

// Update return type helper
type ParseResult = { parts: Part[], jobName?: string };

export async function parseExcel(buffer: Buffer): Promise<ParseResult> {
    const wb = XLSX.read(buffer, { type: "buffer" });
    const firstSheetName = wb.SheetNames[0];
    const ws = wb.Sheets[firstSheetName];

    // Convert to JSON with headers, but we need to stop at "Warehouse"
    const jsonData = XLSX.utils.sheet_to_json(ws, { defval: "" }); // Use defval to ensure keys exist

    const parts: Part[] = [];

    for (let i = 0; i < jsonData.length; i++) {
        const row: any = jsonData[i];

        // Stop condition: Check all values in row for "Warehouse" (case insensitive)
        const values = Object.values(row).map(v => String(v).toLowerCase());
        if (values.includes("warehouse")) {
            // Verify it's effectively a section header (e.g. in the first few columns or solely)
            // For safety, just breaking is fine as per user request "above warehouse section is used"
            console.log("Found 'Warehouse' section separator, stopping parse.");
            break;
        }

        const part = mapRowToPart(row, i);
        if (part) {
            parts.push(part);
        }
    }

    // Attempt basic Job Name extraction from cell A1 or filename context? 
    // For manual Excel, maybe look for "Job:" in first few rows?
    // Let's keep it simple for now and rely on AI for good extraction, but could add heuristic here.
    return { parts };
}

// PDF Parsing
export async function extractTextFromPdf(buffer: Buffer): Promise<string> {
    try {
        const pdfModule: any = await import("pdf-parse");
        const pdfParse = pdfModule.default || pdfModule;
        const data = await pdfParse(buffer);
        return data.text;
    } catch (e) {
        console.error("PDF text extract failed", e);
        return "";
    }
}

export async function parsePdf(buffer: Buffer): Promise<ParseResult> {
    // Legacy simple parsing or stub. 
    // Real parsing is hard without AI or strict layout.
    return { parts: [] };
}

// AI Parsing
export async function parseWithAI(text: string, apiKey: string): Promise<ParseResult> {
    // Dynamically import OpenAI to avoid issues if not used (though we installed it)
    const { OpenAI } = await import("openai");
    const openai = new OpenAI({ apiKey });

    // Pre-process text to remove "Warehouse" section manually.
    // This is more reliable than asking the AI to ignore it.
    const lines = text.split('\n');
    const cleanLines: string[] = [];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // precise "Warehouse" detection
        if (line.match(/warehouse/i)) {
            // Avoid false positives in document headers (e.g. "Warehouse Address")
            // Rules: 
            // 1. If we are deep in the doc (i > 5), it's likely the section.
            // 2. If the line is short (< 50 chars), it's likely a section header, even if early.
            // 3. If it looks like a CSV cell "...,Warehouse,..."
            const isDeep = i > 5;
            const isShort = line.trim().length < 50;

            if (isDeep || isShort) {
                console.log("Stopping text extraction at Warehouse row:", line.substring(0, 50));
                break;
            }
        }
        cleanLines.push(line);
    }

    const cleanText = cleanLines.join('\n');

    try {
        const prompt = `
        You are a structured data extraction expert. 
        Extract a list of parts and the Job Name from the text below.
        
        Fields required:
        - jobName: string (Look for "Job:", "Project:", "Client:", or top-level header. If not found, null)
        - parts: Array of objects with:
            - category: string (Component name, e.g. "Vertical", "Shelf")
            - qty: number
            - depth: number (optional)
            - length: number (optional)
            - width: number (optional, often same as depth)
            - height: number (optional, often same as length)

        IMPORTANT Rules:
        1. Only extract part rows. Ignore headers, footers, total lines.
        2. If the text has "Depth" and "Length" columns but no Width/Height, map Depth -> Width and Length -> Height in the output JSON logic.
        3. Convert fractions like "31 3/4" to decimals (31.75).
        4. Return JSON: { "jobName": "...", "parts": [ ... ] }

        Text:
        ${cleanText.substring(0, 20000)}
        `;

        const response = await openai.chat.completions.create({
            model: "gpt-4o-mini", // Cost-effective and smart capable
            messages: [
                { role: "system", content: "You are a helpful data extraction assistant. Output valid JSON." },
                { role: "user", content: prompt }
            ],
            response_format: { type: "json_object" }
        });

        const content = response.choices[0].message.content;
        if (!content) return { parts: [] };

        const result = JSON.parse(content);
        const parts = Array.isArray(result.parts) ? result.parts : [];
        const jobName = result.jobName || undefined;

        // Post-process to ensure IDs and effective w/h
        const processedParts = parts.map((p: any, idx: number) => {
            let w = p.width || 0;
            let h = p.height || 0;
            // Fallbacks
            if (!w && p.depth) w = p.depth;
            if (!h && p.length) h = p.length;

            return {
                id: `ai-${Date.now()}-${idx}`,
                category: p.category || "Unknown",
                qty: Number(p.qty) || 0,
                width: Number(w),
                height: Number(h),
                depth: p.depth ? Number(p.depth) : undefined,
                length: p.length ? Number(p.length) : undefined,
                label: p.label || "AI Extracted"
            };
        });

        return { parts: processedParts, jobName };

    } catch (e) {
        console.error("AI Parsing failed:", e);
        throw new Error("AI Parsing failed: " + (e as Error).message);
    }
}
