# Brasão Inventory Pro 🍷🍾

A mobile-first inventory management application for wine bars and restaurants, featuring dedicated counting workflows for cellar and bar service areas, AI-powered handwritten sheet scanning, CSV reporting, and live Supabase PostgreSQL synchronization.

---

## 🚀 Features

- **Cellar Counting Mode**: Fast `+1 / -1` increments for whole wine and champagne bottle counts.
- **Bar Service Mode**: Fractional `0.25 / 0.5 / 0.75 / Full / Empty` quick-level controls for open liquor bottles.
- **Master Catalog**: Integrated lookup with search across hundreds of wines, champagnes, and bar spirits with standard pour multiplier value calculation.
- **Real-Time Supabase Cloud Sync**: Instant live multi-device inventory updates powered by Supabase PostgreSQL and Realtime replication.
- **Offline-safe counting**: every count is saved on the device first and queued. Pending items upload automatically when the signal comes back (on reconnect, when the app is reopened, and every 20s). Nothing local is discarded until Supabase confirms it. The header pill shows `· N sin subir` while items are pending.
- **Audit Log & In-Place Editing**: Quick inline editing, quantity adjustments, and deletion with instant timestamps.
- **Reports & Financial Valuation**: Summary metrics, category progress bars, and one-click detailed CSV exports.
- **AI photo scan**: take a photo of a handwritten/printed count sheet **or of the bottles themselves**. Gemini reads the sheet or recognizes labels, counts bottles (and estimates fill level of open liquor bottles to 0.25), matches everything to the catalog, and picks Cellar vs Bar from the category. You review/fix the list, then one tap adds it to Supabase.

---

## 🛠️ Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env.local` and configure your credentials:
```bash
cp .env.example .env.local
```

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-publishable-or-anon-key
```

### AI scan (Gemini) — Netlify environment variable
The photo scanner runs in a Netlify Function (`netlify/functions/scan-inventory.mts`, served at `/api/scan-inventory`) so the Gemini key **never reaches the browser**.

1. Create a key at https://aistudio.google.com/apikey
2. Netlify → *Site configuration → Environment variables* → add `GEMINI_API_KEY` (scope must include **Functions**).
3. Optional: `GEMINI_MODEL` to force a specific model. Otherwise it tries `gemini-3.5-flash`, then `gemini-3-flash-preview`, then `gemini-2.5-flash`.
4. Redeploy.

To test the scanner locally use `npx netlify dev` (plain `npm run dev` does not run functions).

### 3. Run Development Server
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🗄️ Database Setup (Supabase)

To initialize your Supabase PostgreSQL database:

1. Open your [Supabase Dashboard](https://supabase.com/dashboard) and navigate to **SQL Editor**.
2. Click **New query** and paste the content of [`supabase-schema.sql`](./supabase-schema.sql):

```sql
CREATE TABLE IF NOT EXISTS public.inventory (
    id TEXT PRIMARY KEY,
    timestamp BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT,
    "itemName" TEXT NOT NULL,
    itemname TEXT GENERATED ALWAYS AS ("itemName") STORED,
    location TEXT NOT NULL CHECK (location IN ('Cellar', 'Bar')),
    qty NUMERIC NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access" ON public.inventory FOR SELECT TO public USING (true);
CREATE POLICY "Allow public insert access" ON public.inventory FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Allow public update access" ON public.inventory FOR UPDATE TO public USING (true);
CREATE POLICY "Allow public delete access" ON public.inventory FOR DELETE TO public USING (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.inventory;
```

3. Click **Run** (`Ctrl+Enter` or `Cmd+Enter`).

---

## 📱 Tech Stack
- **Framework**: React 19 + TypeScript + Vite
- **Database & Realtime**: [Supabase](https://supabase.com) (`@supabase/supabase-js`)
- **Icons**: [Lucide React](https://lucide.dev)
- **Styling**: Tailwind CSS
