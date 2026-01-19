-- Add slug column if it doesn't exist
ALTER TABLE public.stands ADD COLUMN IF NOT EXISTS slug TEXT UNIQUE;

-- Update existing stands with slugs
UPDATE public.stands SET slug = lower(trim(both '-' from regexp_replace(name, '[^a-zA-Z0-9]+', '-', 'g'))) WHERE slug IS NULL;