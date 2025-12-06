-- Fix search_path for generate_pickup_code function
CREATE OR REPLACE FUNCTION generate_pickup_code()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  code TEXT;
  code_exists BOOLEAN;
BEGIN
  LOOP
    -- Generate a random 6-digit code
    code := LPAD(FLOOR(RANDOM() * 1000000)::TEXT, 6, '0');
    
    -- Check if this code already exists for active orders
    SELECT EXISTS (
      SELECT 1 FROM orders 
      WHERE pickup_code = code 
      AND status IN ('pending', 'ready')
    ) INTO code_exists;
    
    -- Exit loop if code is unique
    EXIT WHEN NOT code_exists;
  END LOOP;
  
  RETURN code;
END;
$$;

-- Fix search_path for set_pickup_code function
CREATE OR REPLACE FUNCTION set_pickup_code()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.pickup_code := generate_pickup_code();
  RETURN NEW;
END;
$$;