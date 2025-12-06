-- Drop the existing check constraint
ALTER TABLE orders DROP CONSTRAINT orders_status_check;

-- Add the updated check constraint to allow 'pending', 'ready', and 'completed'
ALTER TABLE orders ADD CONSTRAINT orders_status_check 
CHECK (status IN ('pending', 'ready', 'completed'));