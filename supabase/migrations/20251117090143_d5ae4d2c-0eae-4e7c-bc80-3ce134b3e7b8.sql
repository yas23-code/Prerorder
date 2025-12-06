-- Add pickup_code column to orders table
ALTER TABLE orders ADD COLUMN pickup_code TEXT;

-- Create function to generate a random 6-digit pickup code
CREATE OR REPLACE FUNCTION generate_pickup_code()
RETURNS TEXT
LANGUAGE plpgsql
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

-- Create trigger to auto-generate pickup code on order insert
CREATE OR REPLACE FUNCTION set_pickup_code()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.pickup_code := generate_pickup_code();
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_order_pickup_code
BEFORE INSERT ON orders
FOR EACH ROW
EXECUTE FUNCTION set_pickup_code();