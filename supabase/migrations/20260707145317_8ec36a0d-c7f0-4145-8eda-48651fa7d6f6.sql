ALTER TABLE public.locations
  ADD COLUMN IF NOT EXISTS booking_url text,
  ADD COLUMN IF NOT EXISTS booking_label text,
  ADD COLUMN IF NOT EXISTS additional_categories text[] NOT NULL DEFAULT '{}';