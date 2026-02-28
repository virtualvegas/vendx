
-- Update ad_locations location_type constraint: remove machine_wrap
ALTER TABLE public.ad_locations DROP CONSTRAINT IF EXISTS ad_locations_location_type_check;
ALTER TABLE public.ad_locations ADD CONSTRAINT ad_locations_location_type_check CHECK (location_type IN ('machine_screen', 'in_game_banner', 'in_game_interstitial'));

-- Update any existing machine_wrap rows to machine_screen
UPDATE public.ad_locations SET location_type = 'machine_screen' WHERE location_type = 'machine_wrap';

-- Rename branded_game_requests to reflect "custom ad requests" concept
-- Change request_type values from reskin/custom to custom_cosmetics/collab_items/custom_ad
ALTER TABLE public.branded_game_requests DROP CONSTRAINT IF EXISTS branded_game_requests_request_type_check;
ALTER TABLE public.branded_game_requests ADD CONSTRAINT branded_game_requests_request_type_check CHECK (request_type IN ('custom_cosmetics', 'collab_items', 'custom_ad', 'reskin', 'custom'));
