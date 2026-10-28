-- =========================================================
-- Brasão Inventory Pro - Supabase Database Schema
-- Run this script in your Supabase SQL Editor:
-- Dashboard -> SQL Editor -> New query -> Paste & Run (Ctrl+Enter)
-- =========================================================

-- 1. Create the inventory table
CREATE TABLE IF NOT EXISTS public.inventory (
    id TEXT PRIMARY KEY,
    timestamp BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT,
    "itemName" TEXT NOT NULL,
    itemname TEXT GENERATED ALWAYS AS ("itemName") STORED,
    location TEXT NOT NULL CHECK (location IN ('Cellar', 'Bar')),
    qty NUMERIC NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 2. Create index on timestamp for fast sorting
CREATE INDEX IF NOT EXISTS idx_inventory_timestamp ON public.inventory(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_inventory_location ON public.inventory(location);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;

-- 4. Create Policies for Public Access (Anon key)
DROP POLICY IF EXISTS "Allow public read access" ON public.inventory;
CREATE POLICY "Allow public read access" 
ON public.inventory 
FOR SELECT 
TO public 
USING (true);

DROP POLICY IF EXISTS "Allow public insert access" ON public.inventory;
CREATE POLICY "Allow public insert access" 
ON public.inventory 
FOR INSERT 
TO public 
WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public update access" ON public.inventory;
CREATE POLICY "Allow public update access" 
ON public.inventory 
FOR UPDATE 
TO public 
USING (true);

DROP POLICY IF EXISTS "Allow public delete access" ON public.inventory;
CREATE POLICY "Allow public delete access" 
ON public.inventory 
FOR DELETE 
TO public 
USING (true);

-- 5. Enable Realtime updates for live inventory sync across devices
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'inventory'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.inventory;
  END IF;
END $$;

-- 6. Optional: Insert initial sample stock for testing
INSERT INTO public.inventory (id, timestamp, "itemName", location, qty)
VALUES 
  ('seed-1', (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT, '1209 Duckhorn Cabernet', 'Cellar', 12),
  ('seed-2', (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT - 100000, '1207 Caymus Cabernet', 'Cellar', 6),
  ('seed-3', (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT - 200000, 'Macallan 12 Double Cask', 'Bar', 2.75)
ON CONFLICT (id) DO NOTHING;
