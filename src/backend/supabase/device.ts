import { supabase } from './client';
import type { DeviceRow, ProfileRow } from './database.types';

export function browserPlatform(): string {
  const nav = navigator as Navigator & { userAgentData?: { platform?: string } };
  return nav.userAgentData?.platform || navigator.platform || 'web';
}

export function browserOsVersion(): string | null {
  return navigator.userAgent || null;
}

export async function ensureDevice(profile: ProfileRow, publicDeviceId: string, displayName: string, appVersion: string): Promise<DeviceRow | null> {
  if (!supabase || profile.status !== 'approved') return null;
  const { data: existing, error: readError } = await supabase.from('devices').select('*').eq('public_device_id', publicDeviceId).maybeSingle();
  if (readError) throw readError;
  if (existing) {
    const { data, error } = await supabase.from('devices').update({
      display_name: displayName,
      os_version: browserOsVersion(),
      app_version: appVersion,
      last_active_at: new Date().toISOString(),
    }).eq('id', existing.id).select('*').single();
    if (error) throw error;
    return data;
  }
  const { data, error } = await supabase.from('devices').insert({
    account_id: profile.id,
    public_device_id: publicDeviceId,
    display_name: displayName,
    platform: browserPlatform(),
    os_version: browserOsVersion(),
    app_version: appVersion,
  }).select('*').single();
  if (error) throw error;
  return data;
}
