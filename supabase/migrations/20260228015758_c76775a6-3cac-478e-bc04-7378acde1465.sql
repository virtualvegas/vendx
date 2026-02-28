-- Add foreign keys from business_owner_id to profiles for proper joins
ALTER TABLE public.ad_bookings
  ADD CONSTRAINT ad_bookings_business_owner_id_fkey
  FOREIGN KEY (business_owner_id) REFERENCES public.profiles(id);

ALTER TABLE public.branded_game_requests
  ADD CONSTRAINT branded_game_requests_business_owner_id_fkey
  FOREIGN KEY (business_owner_id) REFERENCES public.profiles(id);
