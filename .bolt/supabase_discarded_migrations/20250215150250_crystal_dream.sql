-- Create a function to handle set list activation atomically
CREATE OR REPLACE FUNCTION toggle_set_list_active(set_list_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- First, deactivate all set lists
  UPDATE set_lists
  SET is_active = false
  WHERE id != set_list_id;

  -- Then activate the target set list
  UPDATE set_lists
  SET is_active = true
  WHERE id = set_list_id;
END;
$$;