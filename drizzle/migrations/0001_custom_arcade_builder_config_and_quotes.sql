CREATE TABLE public.vendx_arcade_builder_styles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  style_key text NOT NULL UNIQUE,
  label text NOT NULL,
  description text,
  sizes jsonb NOT NULL DEFAULT '[]'::jsonb,
  option_groups jsonb NOT NULL DEFAULT '[]'::jsonb,
  featured_product_ids uuid[] NOT NULL DEFAULT '{}',
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.vendx_arcade_builder_styles TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vendx_arcade_builder_styles TO authenticated;
GRANT ALL ON public.vendx_arcade_builder_styles TO service_role;
ALTER TABLE public.vendx_arcade_builder_styles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view builder styles" ON public.vendx_arcade_builder_styles FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Staff manage builder styles" ON public.vendx_arcade_builder_styles FOR ALL TO authenticated USING (public.is_ext_service_staff(auth.uid())) WITH CHECK (public.is_ext_service_staff(auth.uid()));
CREATE TRIGGER trg_arcade_builder_styles_updated BEFORE UPDATE ON public.vendx_arcade_builder_styles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.vendx_custom_arcade_requests
  ADD COLUMN IF NOT EXISTS access_token uuid NOT NULL DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS concept_image_path text,
  ADD COLUMN IF NOT EXISTS quote_message text,
  ADD COLUMN IF NOT EXISTS quote_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS customer_response text,
  ADD COLUMN IF NOT EXISTS customer_response_note text,
  ADD COLUMN IF NOT EXISTS customer_responded_at timestamptz;
CREATE UNIQUE INDEX IF NOT EXISTS vendx_custom_arcade_requests_access_token_idx ON public.vendx_custom_arcade_requests(access_token);

CREATE POLICY "Staff upload arcade concepts" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'custom-arcade-concepts' AND public.is_ext_service_staff(auth.uid()));
CREATE POLICY "Staff read arcade concepts" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'custom-arcade-concepts' AND public.is_ext_service_staff(auth.uid()));
CREATE POLICY "Staff delete arcade concepts" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'custom-arcade-concepts' AND public.is_ext_service_staff(auth.uid()));

INSERT INTO public.vendx_arcade_builder_styles (style_key, label, description, sort_order, sizes, option_groups) VALUES
('upright','Upright','Classic stand-up arcade',1,
 '[{"v":"full","l":"Full Size","d":"~68\" tall"},{"v":"mid","l":"Mid Size","d":"~58\" tall"},{"v":"mini","l":"Mini","d":"~48\" tall"}]',
 '[{"key":"players","label":"Players","type":"select","choices":["1 Player","2 Player","4 Player"]},{"key":"joystickStyle","label":"Joystick style","type":"select","choices":["Competition","Bat top","Ball top","Magnetic"]},{"key":"buttonLayout","label":"Button layout","type":"select","choices":["4 button","6 button","8 button"]},{"key":"monitorSize","label":"Monitor","type":"select","choices":["24\"","27\"","32\""]},{"key":"trackball","label":"Trackball","type":"toggle"},{"key":"spinner","label":"Spinner","type":"toggle"},{"key":"lightGun","label":"Light guns","type":"toggle"},{"key":"coinDoor","label":"Coin door","type":"toggle"}]'),
('bartop','Bartop','Countertop mini cabinet',2,
 '[{"v":"standard","l":"Standard","d":"~26\" tall"},{"v":"compact","l":"Compact","d":"~20\" tall"}]',
 '[{"key":"players","label":"Players","type":"select","choices":["1 Player","2 Player"]},{"key":"buttonLayout","label":"Button layout","type":"select","choices":["6 button","8 button"]},{"key":"monitorSize","label":"Monitor","type":"select","choices":["19\"","22\"","24\""]},{"key":"pedestalStand","label":"Matching stand","type":"toggle"}]'),
('cocktail','Cocktail Table','Sit-down tabletop',3,
 '[{"v":"standard","l":"Standard","d":"~30\" tall table"},{"v":"large","l":"Large","d":"Wide tabletop"}]',
 '[{"key":"players","label":"Players","type":"select","choices":["2 Player","4 Player"]},{"key":"screenFlip","label":"Screen flip for opposite players","type":"toggle"},{"key":"glassTop","label":"Tempered glass top","type":"toggle"},{"key":"monitorSize","label":"Monitor","type":"select","choices":["24\"","27\""]}]'),
('racing','Racing Cockpit','Seat, wheel and pedals',4,
 '[{"v":"single","l":"Single Seat","d":"~60\" long"},{"v":"deluxe","l":"Deluxe Seat","d":"Larger shell & screen"},{"v":"twin","l":"Twin Linked","d":"Two cockpits side by side"}]',
 '[{"key":"wheelType","label":"Steering wheel","type":"select","choices":["Standard","Force feedback","Direct drive"]},{"key":"pedals","label":"Pedals","type":"select","choices":["Gas / Brake","Gas / Brake / Clutch"]},{"key":"shifter","label":"Shifter","type":"select","choices":["None","Paddle","H-pattern","Sequential"]},{"key":"seatType","label":"Seat","type":"select","choices":["Bucket seat","Adjustable sliding seat"]},{"key":"screens","label":"Screens","type":"select","choices":["Single 32\"","Single 43\"","Triple screen"]},{"key":"motion","label":"Motion platform","type":"toggle"},{"key":"seatVibration","label":"Seat vibration","type":"toggle"}]'),
('virtual_pinball','Virtual Pinball','Digital playfield cabinet',5,
 '[{"v":"full","l":"Full Size","d":"43\" playfield"},{"v":"mini","l":"Mini","d":"32\" playfield"}]',
 '[{"key":"playfieldScreen","label":"Playfield screen","type":"select","choices":["32\" 4K","43\" 4K","49\" 4K"]},{"key":"backglass","label":"Backglass","type":"select","choices":["Single screen","Backglass + DMD"]},{"key":"hapticFeedback","label":"Haptic / solenoid feedback","type":"toggle"},{"key":"plunger","label":"Analog plunger","type":"toggle"},{"key":"nudge","label":"Nudge sensor","type":"toggle"},{"key":"legs","label":"Legs","type":"select","choices":["Chrome","Black powder coat","Custom color"]}]'),
('pedestal','Pedestal','Open-screen setup',6,
 '[{"v":"standard","l":"Standard","d":"Fits most TVs"}]',
 '[{"key":"players","label":"Players","type":"select","choices":["2 Player","4 Player"]},{"key":"trackball","label":"Trackball","type":"toggle"}]'),
('four_player','4-Player','Wide party control deck',7,
 '[{"v":"full","l":"Full Size","d":"~70\" tall, 40\" wide"}]',
 '[{"key":"buttonLayout","label":"Button layout","type":"select","choices":["4 button","6 button"]},{"key":"monitorSize","label":"Monitor","type":"select","choices":["32\"","43\""]},{"key":"coinDoor","label":"Coin door","type":"toggle"}]');
