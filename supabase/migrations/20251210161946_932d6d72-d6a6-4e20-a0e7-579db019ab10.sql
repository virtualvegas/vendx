-- Replace pin_code with totp_secret for rotating codes
ALTER TABLE public.profiles DROP COLUMN IF EXISTS pin_code;
ALTER TABLE public.profiles ADD COLUMN totp_secret TEXT;

-- Create a function to generate a random TOTP secret
CREATE OR REPLACE FUNCTION generate_totp_secret()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  chars TEXT := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  result TEXT := '';
  i INT;
BEGIN
  FOR i IN 1..16 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
  END LOOP;
  RETURN result;
END;
$$;

-- Generate TOTP secrets for existing users without one
UPDATE public.profiles 
SET totp_secret = generate_totp_secret() 
WHERE totp_secret IS NULL;

-- Update the handle_new_user function to include totp_secret
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, totp_secret)
  VALUES (new.id, new.email, new.raw_user_meta_data ->> 'full_name', generate_totp_secret());
  RETURN new;
END;
$$;