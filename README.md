# Closet Calc Pro: Material Estimator

A specialized web application for estimating sheet material for custom closet jobs. 

## Features

- **Smart File Parsing**: Upload your excel (`.xlsx`) or PDF file. The app automatically extracts columns like `Category`, `Qty`, `Width`, `Height` even if headers are messy.
- **Robust Calculator**:
    - **Area Method**: Simple square-footage based estimate.
    - **Packing Method**: 2D Guillotine Bin Packing heuristic to optimally place parts on 48x96 sheets.
- **Job Settings**: 
    - Customize sheet size (default 48x96").
    - Set Kerf (blade thickness) and Safety Margins.
    - Grain Direction controls (Vertical/Horizontal/None).
    - Safety Buffer (0%, 5%, 10%).
- **Results**:
    - Instant calculation.
    - Warnings for unpacked parts (parts too big for sheet).
    - Detailed cut list per sheet.
    - **Export to Excel**: Download a full cut list and summary.

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS (Clean, Premium UI)
- **Parsing**: `xlsx` (Excel), `pdf-parse` (PDF)
- **State**: React Hooks (Client-side interactivity)

## Getting Started

### Prerequisites

- Node.js installed (v18+)

### Installation

1. Install dependencies:
   ```bash
   npm install
   ```

2. Run the development server:
   ```bash
   npm run dev
   ```

3. Open [http://localhost:3000](http://localhost:3000)

### Sample Data

A sample file is provided at `public/sample_closet_job.xlsx`. You can drag and drop this file into the upload zone to test the app.

## Project Structure

- `src/app/page.tsx`: Main application UI and Logic.
- `src/app/api/parse/route.ts`: Server-side file parsing API.
- `src/lib/packing.ts`: 2D Bin Packing Algorithms.
- `src/lib/parsing.ts`: File parsing heuristics.
- `src/types.ts`: TypeScript definitions.

## Future Roadmap

- Visual Sheet Layout (Canvas rendering of cut patterns).
- Multiple material types per job (Group by Material).
- User Accounts / Project Saving.
