import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';
import { supabaseConfigured, supabasePublishableKey, supabaseUrl } from './config';

export const supabase = supabaseConfigured
  ? createClient<Database>(supabaseUrl, supabasePublishableKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: 'pkce',
      },
    })
  : null;
