import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from './client';

export function subscribeControlPlane(userId: string, onChange: () => void): () => void {
  if (!supabase) return () => undefined;
  const channels: RealtimeChannel[] = [];
  channels.push(
    supabase.channel(`profile:${userId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${userId}` }, onChange)
      .subscribe(),
  );
  channels.push(
    supabase.channel(`devices:${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'devices', filter: `account_id=eq.${userId}` }, onChange)
      .subscribe(),
  );
  channels.push(
    supabase.channel('feature-flags')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'feature_flags' }, onChange)
      .subscribe(),
  );
  return () => { for (const channel of channels) void supabase.removeChannel(channel); };
}
