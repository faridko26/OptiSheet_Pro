import { NextRequest, NextResponse } from "next/server";
import { parseExcel, parsePdf, extractTextFromPdf, parseWithAI } from "@/lib/parsing";
import { Part } from "@/types";
import * as XLSX from "xlsx";

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const file = formData.get("file") as File;
        // Check header first (User's key), then fallback to Server Env Var (Owner's key)
        const apiKey = req.headers.get("x-openai-key") || process.env.OPENAI_API_KEY;

        if (!file) {
            return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
        }

        const buffer = Buffer.from(await file.arrayBuffer());
        let parts: Part[] = [];
        let jobName: string | undefined;

        // AI Path
        if (apiKey) {
            let textToParse = "";

            if (file.name.endsWith(".pdf")) {
                textToParse = await extractTextFromPdf(buffer);
            } else if (file.name.match(/\.xlsx?$/)) {
                // Convert Excel to CSV text for AI
                const wb = XLSX.read(buffer, { type: "buffer" });
                const ws = wb.Sheets[wb.SheetNames[0]];
                textToParse = XLSX.utils.sheet_to_csv(ws);
            } else {
                return NextResponse.json({ error: "Unsupported file type for AI" }, { status: 400 });
            }

            if (!textToParse.trim()) {
                return NextResponse.json({ error: "Could not extract text from file" }, { status: 400 });
            }

            const aiResult = await parseWithAI(textToParse, apiKey);
            parts = aiResult.parts;
            jobName = aiResult.jobName;

        } else {
            // Legacy / Heuristic Path
            if (file.name.endsWith(".xlsx") || file.name.endsWith(".xls")) {
                const res = await parseExcel(buffer);
                parts = res.parts;
            } else if (file.name.endsWith(".pdf")) {
                const res = await parsePdf(buffer);
                parts = res.parts;
                if (parts.length === 0) {
                    return NextResponse.json({
                        parts: [],
                        warning: "PDF parsing requires an OpenAI API Key. Please enter one in Settings."
                    });
                }
            } else {
                return NextResponse.json({ error: "Unsupported file type. Use .xlsx or .pdf" }, { status: 400 });
            }
        }

        return NextResponse.json({ parts, jobName });
    } catch (error: any) {
        console.error("Parse error:", error);
        return NextResponse.json({ error: error.message || "Failed to parse file" }, { status: 500 });
    }
}
