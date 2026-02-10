-- ==========================================
-- Supabase Database Setup for Location Storage
-- ==========================================
-- Run this SQL in your Supabase Dashboard → SQL Editor

-- Create user_locations table
CREATE TABLE IF NOT EXISTS user_locations (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  region TEXT,
  pincode TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security (RLS)
ALTER TABLE user_locations ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only read/write their own location
CREATE POLICY "Users can manage own location" 
ON user_locations
FOR ALL 
USING (auth.uid() = user_id);

-- Optional: Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_locations_user_id 
ON user_locations(user_id);

-- Display success message
SELECT 'user_locations table created successfully!' AS status;
