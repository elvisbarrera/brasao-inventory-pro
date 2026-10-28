# Brasão Inventory Pro

Cellar and bar inventory app for Brasão Brazilian Steakhouse. Mobile and iPad first, works offline, syncs live through Supabase, and reads count sheets or bottle photos with AI.

Live: https://brasao-inventory-pro.netlify.app (Netlify, deploys from `main`).

## Features

- **Count**: pick Cellar or Bar, search the catalog (433 products) or filter by category, tap a product, set the quantity. Cellar uses whole bottles (with +6 / +12 case shortcuts). Bar uses sealed bottles plus the fill level of the open bottle in quarters.
- **Scan**: one button opens the camera or photo library. The photo can be a handwritten/printed count sheet or the bottles themselves. Gemini reads it, matches each product to the catalog, picks Cellar or Bar from the category, and shows a review list before anything is saved.
- **Report**: inventory value at menu price (spirits = price per pour × 25 pours), bottles per location, grouped by category. Tap a product to edit or delete individual counts. Export CSV.
- **Offline-safe sync**: every change is saved on the device first and queued. The queue uploads on reconnect, when the app is reopened, and every 20s. Nothing local is dropped until Supabase confirms it. The header shows the sync state and how many changes are waiting.

## Project structure

```
src/
  main.tsx, App.tsx          app shell (tabs, sheets, toasts)
  index.css                  Tailwind v4 + Brasão theme tokens (colors, fonts)
  types.ts                   shared types
  data/catalog.ts            product catalog + price helpers
  lib/
    supabase.ts              client, connection test, SQL setup script
    report.ts                report math + CSV export
    format.ts                money/qty/time formatting
  services/
    inventoryApi.ts          Supabase reads/writes (upsert, delete)
    localStore.ts            device storage + pending sync queue
    scan.ts                  photo compression, AI call, catalog matching
  hooks/useInventory.ts      offline-first sync engine (single source of truth)
  components/
    layout/                  Header, BottomNav
    count/                   CountScreen, CountSheet, BottleLevel
    scan/                    useScanner, ScanReview
    report/                  ReportScreen, EntrySheet
    settings/                SettingsSheet (sync status, SQL setup, custom project)
    ui/                      Sheet, Button, Toast, LocationToggle
netlify/functions/scan-inventory.mts   Gemini proxy (keeps the API key server-side)
supabase/schema.sql                    database setup
```

## Development

```bash
bun install          # or npm install
bun run dev          # http://localhost:3000 (no scanner: functions don't run here)
npx netlify dev      # full app including /api/scan-inventory
bun run build
```

Type checking runs in strict mode: `npx tsc --noEmit`.

## Configuration

| Where | Variable | Purpose |
| --- | --- | --- |
| Netlify env (scope: Functions) | `GEMINI_API_KEY` | Required for photo scanning. Create at https://aistudio.google.com/apikey |
| Netlify env (optional) | `GEMINI_MODEL` | Force a model. Default tries `gemini-3.5-flash`, `gemini-3-flash-preview`, `gemini-2.5-flash` |
| Build env (optional) | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | Use a different Supabase project. Defaults to the Brasão project |

## Database

Run `supabase/schema.sql` once in Supabase → SQL Editor (also available from Settings → Database setup script in the app).

Note: the table currently allows anonymous read/write/delete. Anyone with the link can change the inventory. Add a login or PIN before sharing the link widely.
