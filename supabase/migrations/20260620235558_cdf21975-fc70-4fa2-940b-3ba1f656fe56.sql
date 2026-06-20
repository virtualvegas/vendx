CREATE TABLE public.vendx_external_service_packages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT 'Wrench',
  price_label TEXT NOT NULL DEFAULT 'Quoted',
  price_amount NUMERIC(10,2),
  description TEXT NOT NULL DEFAULT '',
  features JSONB NOT NULL DEFAULT '[]'::jsonb,
  category TEXT NOT NULL DEFAULT 'in_home_arcade',
  machine_type TEXT NOT NULL DEFAULT 'arcade_home',
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.vendx_external_service_packages TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vendx_external_service_packages TO authenticated;
GRANT ALL ON public.vendx_external_service_packages TO service_role;

ALTER TABLE public.vendx_external_service_packages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active packages"
  ON public.vendx_external_service_packages FOR SELECT
  USING (is_active = true OR public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'global_operations_manager') OR public.has_role(auth.uid(), 'tech_support_lead'));

CREATE POLICY "Admins manage packages"
  ON public.vendx_external_service_packages FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'global_operations_manager') OR public.has_role(auth.uid(), 'tech_support_lead'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'global_operations_manager') OR public.has_role(auth.uid(), 'tech_support_lead'));

CREATE TRIGGER update_vendx_external_service_packages_updated_at
  BEFORE UPDATE ON public.vendx_external_service_packages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.vendx_external_service_packages (slug, title, icon, price_label, price_amount, description, features, sort_order) VALUES
('diagnostic_visit','Diagnostic Visit','Wrench','From $89',89,'On-site inspection, fault diagnosis, written estimate. Fee credited toward repair if you proceed.','["1 hour on-site","Multi-meter / boot tests","Written estimate","Same-week scheduling"]'::jsonb,1),
('monitor_repair','Monitor / Display Repair','Monitor','From $149 + parts',149,'CRT cap kits, flyback issues, LCD backlight, scaler/converter swaps for modern panels.','["CRT chassis recap","LCD backlight & inverter","Scaler / GBS / OSSC install","Geometry calibration"]'::jsonb,2),
('board_repair','PCB / Board Repair','Cpu','From $179 + parts',179,'JAMMA & MultiJAMMA boards, JVS, pinball MPUs, redemption logic boards.','["Cap & battery replacement","Trace repair","ROM / EEPROM service","Bench test before reinstall"]'::jsonb,3),
('full_restoration','Full Restoration','Sparkles','Quoted',NULL,'End-to-end cabinet restoration — artwork, t-molding, controls, monitor, harness, and electronics.','["Cabinet repaint / artwork","New controls & t-molding","Harness rebuild","Electronics overhaul"]'::jsonb,4),
('delivery_setup','Delivery & Setup','Truck','From $199',199,'We move, deliver, and set up your in-home arcade — stairs, tight doorways, basement installs included.','["2-person crew","Stair & basement service","Level, test, and tune","Haul-away available"]'::jsonb,5),
('tune_up','Annual Tune-Up','Gamepad2','From $129',129,'Yearly preventative service so your cabinet keeps playing like new — controls, monitor, and electronics.','["Control deep clean","Button & switch test","Monitor brightness check","Internal dusting"]'::jsonb,6);