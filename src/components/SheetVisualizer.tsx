import React from 'react';
import { PackedSheet } from '@/types';

interface SheetVisualizerProps {
    sheet: PackedSheet;
    margin: number;
}

interface Rect {
    x: number;
    y: number;
    w: number;
    h: number;
}


// Helper to find largest empty rectangles
function findLeftovers(sheetW: number, sheetH: number, parts: { x: number, y: number, w: number, h: number }[], margin: number): Rect[] {
    // This is a complex problem (finding maximal empty rectangles). 
    // For visualization, we can use a simpler approach:
    // 1. Create a grid of occupied space? No, expensive.
    // 2. Just subtraction?

    // Better approach for GUI: 
    // The packing algorithm (Guillotine) actually KNOWS the free rects! 
    // But we don't persist them in the PackedSheet result.
    // We can re-simulate the packing or just infer.

    // Start with full sheet (minus margin)
    // Subtract all parts.
    // This is hard to do perfectly in one function.

    // Alternative: We loop through the sheet coordinates (grid) and find large empty blocks? 
    // Or, we can just overlay the "waste" color on the background, 
    // and rely on the user visually seeing the empty space.

    // BUT user wants "dimensions of left over".
    // This implies we NEED the free rects.

    // Simplest Hack:
    // We can't easily reconstruct the *exact* free rects used by the packer without modifying the packer to return them.
    // The Packer DOES have `freeRects`.
    // Let's modify the Packer in `packing.ts` to return `freeRects` in the result?
    // That would be the robust way.

    return [];
}

export default function SheetVisualizer({ sheet, margin }: SheetVisualizerProps) {
    // Dimensions for SVG viewBox
    // We add a little padding around the sheet for better visibility
    const padding = 1;
    const totalWidth = sheet.width + padding * 2;
    const totalHeight = sheet.height + padding * 2;

    return (
        <div className="w-full border rounded-lg overflow-hidden bg-white shadow-sm mb-6">
            <div className="bg-gray-100 px-4 py-2 border-b flex justify-between items-center">
                <h3 className="font-semibold text-gray-700">Sheet #{sheet.sheetId}</h3>
                <span className="text-xs text-gray-500 font-mono">{sheet.width}&quot; x {sheet.height}&quot;</span>
            </div>
            <div className="p-4 overflow-auto flex justify-center bg-gray-50">
                <svg
                    viewBox={`${-padding} ${-padding} ${totalWidth} ${totalHeight}`}
                    className="max-w-full bg-white border border-gray-200"
                    style={{ width: '100%', minHeight: '400px' }}
                    xmlns="http://www.w3.org/2000/svg"
                >
                    <defs>
                        <pattern id="grid" width="12" height="12" patternUnits="userSpaceOnUse">
                            <path d="M 12 0 L 0 0 0 12" fill="none" stroke="#f0f0f0" strokeWidth="0.05" />
                        </pattern>
                    </defs>

                    {/* Sheet Background */}
                    <rect x="0" y="0" width={sheet.width} height={sheet.height} fill="url(#grid)" stroke="#9ca3af" strokeWidth="0.1" />

                    {/* Safe Margin Area */}
                    {margin > 0 && (
                        <rect
                            x={margin}
                            y={margin}
                            width={sheet.width - margin * 2}
                            height={sheet.height - margin * 2}
                            fill="none"
                            stroke="#e5e7eb"
                            strokeDasharray="0.5 0.5"
                            strokeWidth="0.05"
                        />
                    )}

                    {/* Leftovers/Waste - Rendered slightly transparently or with dashed lines */}
                    {sheet.leftovers && sheet.leftovers.map((rect, idx) => (
                        <g key={`waste-${idx}`}>
                            <rect
                                x={rect.x + (margin > 0 ? margin : 0)} // Leftovers are in packing space, which starts at margin
                                y={rect.y + (margin > 0 ? margin : 0)}
                                width={rect.w}
                                height={rect.h}
                                fill="#f3f4f6" // gray-100
                                fillOpacity="0.5"
                                stroke="#d1d5db" // gray-300
                                strokeWidth="0.05"
                                strokeDasharray="0.2 0.2"
                            />
                            {/* Label for significant leftovers */}
                            {rect.w > 6 && rect.h > 6 && (
                                <text
                                    x={rect.x + (margin > 0 ? margin : 0) + rect.w / 2}
                                    y={rect.y + (margin > 0 ? margin : 0) + rect.h / 2}
                                    textAnchor="middle"
                                    dominantBaseline="middle"
                                    fill="#9ca3af" // gray-400
                                    fontSize="1.2"
                                    fontStyle="italic"
                                    style={{ pointerEvents: 'none' }}
                                >
                                    {Number(rect.w.toFixed(2))} x {Number(rect.h.toFixed(2))}
                                </text>
                            )}
                        </g>
                    ))}

                    {/* Parts */}
                    {sheet.parts.map((part) => (
                        <g key={part.partId}>
                            {/* Part Rect */}
                            <rect
                                x={part.x}
                                y={part.y}
                                width={part.w}
                                height={part.h}
                                fill="#e0f2fe" // light sky blue
                                stroke="#dc2626" // red outline
                                strokeWidth="0.08"
                            />

                            {/* Labels - Using SVG Text for better scaling control than foreignObject */}
                            {/* Smart Label Scaling: if part is too small, don't show or scale down */}
                            {part.w > 2 && part.h > 2 && (
                                <>
                                    <text
                                        x={part.x + part.w / 2}
                                        y={part.y + part.h / 2 - 0.6}
                                        textAnchor="middle"
                                        dominantBaseline="middle"
                                        fill="#7f1d1d" // dark red
                                        fontSize="1.2"
                                        fontWeight="bold"
                                        style={{ pointerEvents: 'none', textShadow: '0px 0px 2px rgba(255,255,255,0.8)' }}
                                    >
                                        {part.category.length > 10 ? part.category.substring(0, 10) + '...' : part.category}
                                    </text>
                                    <text
                                        x={part.x + part.w / 2}
                                        y={part.y + part.h / 2 + 0.6}
                                        textAnchor="middle"
                                        dominantBaseline="middle"
                                        fill="#1f2937" // gray-800
                                        fontSize="1.0"
                                        fontWeight="bold"
                                        style={{ pointerEvents: 'none', textShadow: '0px 0px 2px rgba(255,255,255,0.8)' }}
                                    >
                                        {Number(part.w.toFixed(3))} x {Number(part.h.toFixed(3))} {part.rotated ? '(R)' : ''}
                                    </text>
                                </>
                            )}
                        </g>
                    ))}
                </svg>
            </div>
        </div>
    );
}
