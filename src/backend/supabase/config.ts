export const backendProvider = import.meta.env.VITE_BACKEND_PROVIDER ?? 'local';
export const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? '';
export const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? '';

export const supabaseConfigured = backendProvider === 'supabase' && Boolean(supabaseUrl && supabasePublishableKey);
