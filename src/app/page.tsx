"use client";

import { useState, useCallback, useEffect } from "react";
import Image from "next/image";
import { useDropzone } from "react-dropzone";
import { Copy, UploadCloud, Calculator, Trash2, Edit2, CheckCircle, AlertTriangle, FileText, Settings, X, ChevronDown, ChevronUp, HelpCircle, LayoutGrid } from "lucide-react";
import { Part, SheetOptions, CalculationResult } from "@/types";
import { cn } from "@/lib/utils";
import { packParts } from "@/lib/packing";
import SheetVisualizer from "@/components/SheetVisualizer";

export default function Home() {
  // State
  const [parts, setParts] = useState<Part[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string>(""); // Visual feedback
  const [error, setError] = useState<string | null>(null);
  const [jobName, setJobName] = useState<string>(""); // Extracted Job Name
  const [result, setResult] = useState<CalculationResult | null>(null);

  // Settings
  const [apiKey, setApiKey] = useState("");
  const [settings, setSettings] = useState<SheetOptions>({
    sheetWidth: 48,
    sheetHeight: 96,
    kerf: 0.125,
    margin: 0.25,
    wasteFactor: 0.1, // 10%
    grainDirection: "None",
    algorithm: "Guillotine",
    safetyBuffer: 5
  });

  // Load API Key
  useEffect(() => {
    const key = localStorage.getItem("openai_api_key");
    if (key) setApiKey(key);
  }, []);

  const saveApiKey = (key: string) => {
    setApiKey(key);
    localStorage.setItem("openai_api_key", key);
  };

  // Upload Logic
  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;

    setLoading(true);
    setError(null);
    setUploadStatus("Starting upload...");

    let totalAdded = 0;
    const errors: string[] = [];

    for (let i = 0; i < acceptedFiles.length; i++) {
      const file = acceptedFiles[i];
      setUploadStatus(`Processing ${i + 1} of ${acceptedFiles.length}: ${file.name}...`);

      const formData = new FormData();
      formData.append("file", file);

      try {
        const headers: HeadersInit = {};
        if (apiKey) headers["x-openai-key"] = apiKey;

        const res = await fetch("/api/parse", {
          method: "POST",
          body: formData,
          headers
        });

        if (!res.ok) throw new Error("Failed to parse");

        const data = await res.json();
        if (data.error) throw new Error(data.error);
        if (data.warning) errors.push(`${file.name}: ${data.warning}`);

        const newParts = (data.parts || []).map((p: any, idx: number) => ({
          ...p,
          // Force new unique ID to avoid collisions between files/chunks
          id: `part-${Date.now()}-${i}-${idx}-${Math.random().toString(36).slice(2, 7)}`
        }));

        if (newParts.length > 0) {
          setParts(prev => [...prev, ...newParts]);
          totalAdded += newParts.length;
        }

        if (data.jobName && !jobName) {
          setJobName(data.jobName);
        }
      } catch (err: any) {
        console.error(err);
        errors.push(`${file.name}: ${err.message || "Failed"}`);
      }
    }

    setUploadStatus("");
    setLoading(false);

    if (errors.length > 0) {
      setError(`Process complete with issues: ${errors.join("; ")}`);
    } else if (totalAdded > 0) {
      // Optional success flash or just clear
    }
  }, [apiKey]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/pdf': ['.pdf']
    },
    // maxFiles removed to allow multiple
  });

  // Calculation Logic
  const handleCalculate = () => {
    setLoading(true);
    setUploadStatus("Optimizing layout...");
    // Simulate slight delay for effect
    setTimeout(() => {
      const res = packParts(parts, settings);
      setResult(res);
      setLoading(false);
      setUploadStatus("");
    }, 500);
  };

  // Helper to update part
  const updatePart = (id: string, field: keyof Part, value: any) => {
    setParts(prev => prev.map(p => p.id === id ? { ...p, [field]: value } : p));
  };

  const removePart = (id: string) => {
    setParts(prev => prev.filter(p => p.id !== id));
  };

  return (
    <main className="min-h-screen bg-gray-50 text-gray-900 font-sans p-8">
      <div className="max-w-6xl mx-auto space-y-8">

        {/* Header */}
        <header className="flex justify-between items-center pb-6 border-b border-gray-200">
          <div className="flex items-center gap-4">
            <Image
              src="/saw-with-handle-cutting-wood-svgrepo-com.svg"
              alt="OptiSheet Pro Logo"
              width={48}
              height={48}
              className="w-12 h-12 text-blue-600"
            />
            <div>
              <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600">
                OptiSheet Pro
              </h1>
              <p className="text-gray-500 mt-1">Intelligent Sheet Optimizer & Cut List Estimator</p>
            </div>
          </div>
          <div className="flex gap-4">
            <button
              onClick={() => {
                setParts([]);
                setJobName("");
                setResult(null);
              }}
              className="text-sm text-gray-400 hover:text-red-500 transition-colors"
            >
              Clear All
            </button>
          </div>
        </header>

        {/* Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

          {/* Left Column: Input + Parts List */}
          <div className="lg:col-span-2 space-y-6">

            {/* Upload Zone */}
            <div {...getRootProps()}
              className={cn(
                "border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-300",
                isDragActive ? "border-blue-500 bg-blue-50" : "border-gray-300 hover:border-gray-400 hover:bg-gray-50",
                loading ? "opacity-75 cursor-wait" : ""
              )}>
              <input {...getInputProps()} disabled={loading} />
              <UploadCloud className="w-10 h-10 mx-auto text-gray-400 mb-3" />
              {uploadStatus ? (
                <div className="space-y-2">
                  <p className="text-lg font-medium text-blue-600 animate-pulse">{uploadStatus}</p>
                  <div className="w-1/2 mx-auto bg-gray-200 rounded-full h-1.5 dark:bg-gray-700">
                    <div className="bg-blue-600 h-1.5 rounded-full w-2/3 animate-[shimmer_2s_infinite]"></div>
                  </div>
                </div>
              ) : (
                <>
                  <p className="text-lg font-medium text-gray-700">Drop order sheets here</p>
                  <p className="text-sm text-gray-500">Supports .xlsx and .pdf (multi-file)</p>
                </>
              )}
            </div>

            {error && (
              <div className="bg-red-50 text-red-600 p-4 rounded-lg flex items-center gap-3 border border-red-100">
                <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                <span className="text-sm">{error}</span>
              </div>
            )}

            {/* Parts Table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="bg-gray-50 px-6 py-4 border-b border-gray-100 flex justify-between items-center">
                <h2 className="font-semibold text-gray-800 flex items-center gap-2">
                  <FileText className="w-4 h-4" /> Parts List ({parts.length})
                </h2>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      navigator.clipboard.readText().then(text => {
                        const rows = text.split("\n");
                        const newParts: Part[] = [];

                        rows.forEach((row, idx) => {
                          const cols = row.split("\t").map(c => c.trim());
                          if (cols.length < 3) return;

                          // User requested order: Component | Qty | Depth | Length | Width | Height
                          // Check if first col is index #
                          let startIndex = 0;
                          if (cols[0] && /^\d+$/.test(cols[0]) && cols.length > 5) {
                            startIndex = 1;
                          }
                          const getCol = (i: number) => cols[i + startIndex] || "";

                          const category = getCol(0);
                          const isNum = (s: string) => !isNaN(parseFloat(s));

                          const parseDim = (s: string) => {
                            if (!s) return 0;
                            const clean = s.replace(/"/g, '').trim();
                            if (clean.includes(" ") && clean.includes("/")) {
                              try {
                                const [whole, frac] = clean.split(" ");
                                const [n, d] = frac.split("/");
                                return parseFloat(whole) + (parseFloat(n) / parseFloat(d));
                              } catch (e) { return parseFloat(clean) || 0; }
                            }
                            return parseFloat(clean) || 0;
                          };

                          const qty = parseFloat(getCol(1)) || 0;
                          const depthVal = parseDim(getCol(2));
                          const lengthVal = parseDim(getCol(3));

                          if (category && (qty || depthVal || lengthVal)) {
                            newParts.push({
                              id: `pasted-${Date.now()}-${idx}`,
                              category,
                              qty,
                              depth: depthVal,
                              length: lengthVal,
                              width: depthVal, // Depth -> Width
                              height: lengthVal // Length -> Height
                            });
                          }
                        });

                        setParts(prev => [...prev, ...newParts]);
                      }).catch(err => alert("Failed to read clipboard: " + err));
                    }}
                    className="text-xs font-medium text-emerald-600 hover:text-emerald-800 flex items-center gap-1 border border-emerald-200 bg-emerald-50 px-3 py-1 rounded"
                  >
                    <Copy className="w-3 h-3" /> Paste from Excel
                  </button>
                  <button onClick={() => setParts([...parts, { id: Date.now().toString(), category: "New", qty: 1, width: 12, height: 12, depth: 12, length: 12 }])} className="text-xs font-medium text-blue-600 hover:text-blue-800 flex items-center gap-1 border border-blue-200 bg-blue-50 px-3 py-1 rounded">
                    + Add Item
                  </button>
                </div>
              </div>

              {parts.length === 0 ? (
                <div className="p-8 text-center text-gray-400">
                  No parts loaded yet. Upload a file or add manually.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-gray-50 text-gray-500 uppercase text-xs">
                      <tr>
                        <th className="px-4 py-3">Component</th>
                        <th className="px-4 py-3 w-20">Qty</th>
                        <th className="px-4 py-3 w-24">Depth</th>
                        <th className="px-4 py-3 w-24">Length</th>
                        <th className="px-4 py-3">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {parts.map((p) => (
                        <tr key={p.id} className="hover:bg-gray-50 group">
                          <td className="px-4 py-2">
                            <input
                              className="w-full bg-transparent focus:outline-none focus:ring-1 focus:ring-blue-200 rounded px-1"
                              value={p.category}
                              onChange={(e) => updatePart(p.id, "category", e.target.value)}
                            />
                          </td>
                          <td className="px-4 py-2">
                            <input
                              type="number"
                              className="w-full bg-transparent focus:outline-none focus:ring-1 focus:ring-blue-200 rounded px-1"
                              value={p.qty}
                              onChange={(e) => updatePart(p.id, "qty", Number(e.target.value))}
                            />
                          </td>
                          <td className="px-4 py-2">
                            <input
                              type="number"
                              step="0.001"
                              className="w-full bg-transparent focus:outline-none focus:ring-1 focus:ring-blue-200 rounded px-1"
                              value={p.depth || ""}
                              placeholder="-"
                              onChange={(e) => {
                                const d = Number(e.target.value);
                                setParts(prev => prev.map(x => x.id === p.id ? { ...x, depth: d, width: d } : x));
                              }}
                            />
                          </td>
                          <td className="px-4 py-2">
                            <input
                              type="number"
                              step="0.001"
                              className="w-full bg-transparent focus:outline-none focus:ring-1 focus:ring-blue-200 rounded px-1"
                              value={p.length || ""}
                              placeholder="-"
                              onChange={(e) => {
                                const l = Number(e.target.value);
                                setParts(prev => prev.map(x => x.id === p.id ? { ...x, length: l, height: l } : x));
                              }}
                            />
                          </td>
                          <td className="px-4 py-2">
                            <button onClick={() => removePart(p.id)} className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Visual Diagrams (Moved to Left Column) */}
            {result && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <h3 className="font-semibold text-gray-800 mb-6 flex items-center gap-2 text-lg border-b pb-4">
                  <LayoutGrid className="w-5 h-5 text-indigo-600" /> Cutting Diagrams ({result.packedSheets.length} Sheets)
                </h3>
                <div className="space-y-8">
                  {result.packedSheets.map((sheet) => (
                    <SheetVisualizer
                      key={sheet.sheetId}
                      sheet={sheet}
                      margin={settings.margin}
                    />
                  ))}
                </div>
              </div>
            )}

          </div>

          {/* Right Column: Settings & Results */}
          <div className="space-y-6">

            {/* Settings Card */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h2 className="font-semibold text-gray-800 flex items-center gap-2 mb-4">
                <Settings className="w-4 h-4" /> job Settings
              </h2>

              <div className="space-y-4">
                <div>
                  <label className="text-xs font-medium text-gray-500 uppercase flex items-center gap-1">
                    OpenAI API Key (Stored Locally)
                    <span title="Your key is stored safely in your browser's local storage and sent directly to OpenAI via our secure proxy. We do not save it." className="cursor-help text-gray-400">
                      <HelpCircle className="w-3 h-3" />
                    </span>
                  </label>
                  <input
                    type="password"
                    value={apiKey}
                    onChange={(e) => saveApiKey(e.target.value)}
                    placeholder="sk-..."
                    className="mt-1 block w-full rounded-md border-gray-200 bg-gray-50 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-3 py-2 border"
                  />
                  <p className="text-[10px] text-gray-400 mt-1">
                    Required for AI-powered PDF/Excel parsing.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-medium text-gray-500 uppercase">Sheet Width</label>
                    <input
                      type="number"
                      value={settings.sheetWidth}
                      onChange={(e) => setSettings({ ...settings, sheetWidth: Number(e.target.value) })}
                      className="mt-1 block w-full rounded-md border-gray-200 bg-gray-50 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-3 py-2 border"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-500 uppercase">Sheet Length</label>
                    <input
                      type="number"
                      value={settings.sheetHeight}
                      onChange={(e) => setSettings({ ...settings, sheetHeight: Number(e.target.value) })}
                      className="mt-1 block w-full rounded-md border-gray-200 bg-gray-50 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-3 py-2 border"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium text-gray-500 uppercase">Grain Direction</label>
                  <select
                    value={settings.grainDirection}
                    onChange={(e) => setSettings({ ...settings, grainDirection: e.target.value as any })}
                    className="mt-1 block w-full rounded-md border-gray-200 bg-gray-50 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-3 py-2 border"
                  >
                    <option value="None">None (Best optimization)</option>
                    <option value="Vertical">Vertical (Grain follows Length)</option>
                    <option value="Horizontal">Horizontal (Grain follows Width)</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-medium text-gray-500 uppercase flex items-center gap-1">
                      Kerf
                      <span title="Width of material removed by the saw blade during each cut." className="cursor-help text-gray-400">
                        <HelpCircle className="w-3 h-3" />
                      </span>
                    </label>
                    <input
                      type="number"
                      step="0.001"
                      value={settings.kerf}
                      onChange={(e) => setSettings({ ...settings, kerf: Number(e.target.value) })}
                      className="mt-1 block w-full rounded-md border-gray-200 bg-gray-50 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-3 py-2 border"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-500 uppercase flex items-center gap-1">
                      Safe Margin
                      <span title="Border around the sheet edges that is considered unusable (for squaring/trimming)." className="cursor-help text-gray-400">
                        <HelpCircle className="w-3 h-3" />
                      </span>
                    </label>
                    <input
                      type="number"
                      step="0.125"
                      value={settings.margin}
                      onChange={(e) => setSettings({ ...settings, margin: Number(e.target.value) })}
                      className="mt-1 block w-full rounded-md border-gray-200 bg-gray-50 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-3 py-2 border"
                    />
                  </div>
                </div>

                <div className="pt-2">
                  <label className="text-xs font-medium text-gray-500 uppercase flex items-center gap-1">
                    Safety Buffer (%)
                    <span title="Percentage of extra sheets to order to account for mistakes or defects." className="cursor-help text-gray-400">
                      <HelpCircle className="w-3 h-3" />
                    </span>
                  </label>
                  <div className="flex gap-2 mt-1">
                    {[0, 5, 10].map((val) => (
                      <button
                        key={val}
                        onClick={() => setSettings({ ...settings, safetyBuffer: val as any })}
                        className={cn(
                          "flex-1 py-1 text-xs rounded border transition-colors",
                          settings.safetyBuffer === val ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                        )}
                      >
                        +{val}%
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  onClick={handleCalculate}
                  disabled={parts.length === 0 || loading}
                  className={cn(
                    "w-full py-3 mt-4 rounded-lg font-semibold text-white shadow-lg transition-all",
                    parts.length === 0 ? "bg-gray-300 cursor-not-allowed" : "bg-indigo-600 hover:bg-indigo-700 hover:shadow-indigo-200"
                  )}>
                  {loading ? "Calculating..." : "Calculate Sheets"}
                </button>
              </div>
            </div>

            {/* Results Card */}
            {result && (
              <div className="bg-white rounded-xl shadow-lg border border-indigo-100 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="bg-indigo-50 px-6 py-4 border-b border-indigo-100 flex justify-between items-center">
                  <h2 className="font-semibold text-indigo-900 flex items-center gap-2">
                    <Calculator className="w-4 h-4" /> Estimate Results
                  </h2>
                  {jobName && (
                    <span className="text-xs font-semibold px-2 py-1 bg-white text-indigo-600 rounded border border-indigo-100 shadow-sm max-w-[150px] truncate" title={jobName}>
                      {jobName}
                    </span>
                  )}
                </div>
                <div className="p-6 space-y-6">

                  <div className="flex justify-between items-end pb-4 border-b border-gray-100">
                    <div>
                      <p className="text-sm text-gray-500 uppercase tracking-wide">Sheets Required</p>
                      <p className="text-4xl font-bold text-gray-900">{result.sheetsPackingMethod}</p>
                      <p className="text-xs text-gray-400 mt-1">Includes {settings.safetyBuffer}% buffer</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-500 uppercase tracking-wide">Total Area</p>
                      <p className="text-xl font-semibold text-gray-700">{result.totalAreaSqFt} sq ft</p>
                    </div>
                  </div>

                  <div className="bg-yellow-50 rounded-lg p-4 border border-yellow-100 text-yellow-800 text-sm">
                    <p className="font-bold flex items-center gap-2 text-yellow-900">
                      <CheckCircle className="w-4 h-4" /> Recommendation
                    </p>
                    <p className="mt-1">
                      Order <span className="font-bold">{result.sheetsPackingMethod} sheets</span> of {settings.sheetWidth}x{settings.sheetHeight}&quot;.
                      Based on packing efficiency. (Simple Area calc suggests {result.sheetsAreaMethod}).
                    </p>
                    {result.unpackedParts.length > 0 && (
                      <div className="bg-red-50 p-4 rounded-lg border border-red-100 text-red-700 text-sm flex items-start gap-2">
                        <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="font-bold">Warning: {result.unpackedParts.length} parts could not fit!</p>
                          <p className="mt-1">The parts below exceed usable dimensions (Sheet: {settings.sheetWidth - settings.margin * 2}x{settings.sheetHeight - settings.margin * 2}&quot;). Try rotating or checking grain direction.</p>
                          <p className="mt-1 text-xs text-red-500 font-semibold">Tip: If dimensions match exactly, try reducing margin to 0.</p>
                          <ul className="list-disc list-inside mt-2 text-xs">
                            {result.unpackedParts.slice(0, 3).map(p => (
                              <li key={p.id}>{p.category} ({p.width}&quot; x {p.height}&quot;)</li>
                            ))}
                            {result.unpackedParts.length > 3 && <li>...and more</li>}
                          </ul>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Detailed List */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <p className="text-xs font-medium text-gray-500 uppercase">Cut Pattern Summary</p>
                      <button
                        onClick={() => {
                          import("xlsx").then((XLSX) => {
                            const wb = XLSX.utils.book_new();

                            // 1. Summary Sheet
                            const summaryData = [
                              { Property: "Total Parts", Value: parts.reduce((acc, p) => acc + p.qty, 0) },
                              { Property: "Total Area (sq ft)", Value: result.totalAreaSqFt },
                              { Property: "Sheets Required", Value: result.sheetsPackingMethod },
                              { Property: "Sheet Size", Value: `${settings.sheetWidth} x ${settings.sheetHeight}` },
                              { Property: "Waste Factor", Value: `${settings.wasteFactor * 100}%` },
                              { Property: "Buffer", Value: `${settings.safetyBuffer}%` }
                            ];
                            const wsSummary = XLSX.utils.json_to_sheet(summaryData);
                            XLSX.utils.book_append_sheet(wb, wsSummary, "Summary");

                            // 2. Cut List (Flat)
                            const cutList: any[] = [];
                            result.packedSheets.forEach(sheet => {
                              sheet.parts.forEach(p => {
                                cutList.push({
                                  SheetID: sheet.sheetId,
                                  PartID: p.partId,
                                  Width: p.w,
                                  Length: p.h,
                                  Rotated: p.rotated ? "Yes" : "No",
                                  X: p.x,
                                  Y: p.y
                                });
                              });
                            });
                            const wsCuts = XLSX.utils.json_to_sheet(cutList);
                            XLSX.utils.book_append_sheet(wb, wsCuts, "Cut List");

                            // Download
                            const fileName = jobName ? `${jobName.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_cutlist.xlsx` : "closet_job_cutlist.xlsx";
                            XLSX.writeFile(wb, fileName);
                          });
                        }}
                        className="text-xs font-medium text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                      >
                        <Copy className="w-3 h-3" /> Export Excel
                      </button>
                    </div>
                    <div className="max-h-40 overflow-y-auto space-y-2 pr-2">
                      {result.packedSheets.map((sheet) => (
                        <div key={sheet.sheetId} className="flex justify-between text-sm bg-gray-50 p-2 rounded">
                          <span>Sheet #{sheet.sheetId}</span>
                          <span className="text-gray-500">{sheet.parts.length} parts</span>
                        </div>
                      ))}
                    </div>
                  </div>


                </div>
              </div>
            )}

          </div>



        </div>

        {/* Footer */}
        <div className="text-center pt-8 border-t border-gray-200">
          <p className="text-sm text-gray-400 font-medium">
            Designed & built by <span className="text-indigo-500">Farid</span>
          </p>
        </div>
      </div>
    </main>
  );
}
