-- Add game_id column to store_products for linking game items to specific games
ALTER TABLE public.store_products 
ADD COLUMN game_id uuid REFERENCES public.video_games(id) ON DELETE SET NULL;

-- Add index for game filtering
CREATE INDEX idx_store_products_game_id ON public.store_products(game_id);

-- Add comment for documentation
COMMENT ON COLUMN public.store_products.game_id IS 'Links product to a video game for Game Items category';