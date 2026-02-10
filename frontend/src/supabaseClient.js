import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Only initialize if real credentials are provided (not placeholders)
const hasValidCredentials =
    supabaseUrl &&
    supabaseAnonKey &&
    !supabaseUrl.includes('YOUR_') &&
    !supabaseAnonKey.includes('YOUR_');

export const supabase = hasValidCredentials
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null;
