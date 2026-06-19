ALTER TABLE public.vendx_external_service_tickets
  ADD COLUMN IF NOT EXISTS service_package text,
  ADD COLUMN IF NOT EXISTS arcade_cabinet_brand text,
  ADD COLUMN IF NOT EXISTS arcade_cabinet_model text,
  ADD COLUMN IF NOT EXISTS arcade_game_title text,
  ADD COLUMN IF NOT EXISTS arcade_monitor_type text,
  ADD COLUMN IF NOT EXISTS arcade_control_type text,
  ADD COLUMN IF NOT EXISTS arcade_power_type text,
  ADD COLUMN IF NOT EXISTS arcade_year_manufactured integer,
  ADD COLUMN IF NOT EXISTS service_location_type text,
  ADD COLUMN IF NOT EXISTS access_notes text,
  ADD COLUMN IF NOT EXISTS has_stairs boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS preferred_contact_time text;