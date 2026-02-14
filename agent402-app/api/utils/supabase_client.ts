import { createClient } from '@supabase/supabase-js';

export function getSupabaseClient(env: any) {
  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) {
    throw new Error('Supabase credentials not configured');
  }
  
  return createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY);
}