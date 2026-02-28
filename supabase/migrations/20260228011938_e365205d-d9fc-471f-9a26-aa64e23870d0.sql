
-- Update ad_locations.game_id FK from arcade_game_titles to video_games
ALTER TABLE public.ad_locations DROP CONSTRAINT IF EXISTS ad_locations_game_id_fkey;
ALTER TABLE public.ad_locations ADD CONSTRAINT ad_locations_game_id_fkey 
  FOREIGN KEY (game_id) REFERENCES public.video_games(id);

-- Update branded_game_requests.game_title_id FK from arcade_game_titles to video_games
ALTER TABLE public.branded_game_requests DROP CONSTRAINT IF EXISTS branded_game_requests_game_title_id_fkey;
ALTER TABLE public.branded_game_requests ADD CONSTRAINT branded_game_requests_game_title_id_fkey 
  FOREIGN KEY (game_title_id) REFERENCES public.video_games(id);
