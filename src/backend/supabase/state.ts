import type { Session, User } from '@supabase/supabase-js';
import type { DeviceRow, FeatureFlagRow, ProfileRow } from './database.types';
import { getCloudIdentity, getProfile } from './auth';
import { ensureDevice } from './device';
import { supabase } from './client';

export interface CloudState {
  connected: boolean;
  session: Session | null;
  user: User | null;
  profile: ProfileRow | null;
  device: DeviceRow | null;
  featureFlags: FeatureFlagRow[];
}

export const emptyCloudState: CloudState = { connected: false, session: null, user: null, profile: null, device: null, featureFlags: [] };

export async function loadCloudState(publicDeviceId: string, deviceName: string, appVersion: string): Promise<CloudState> {
  if (!supabase) return emptyCloudState;
  const identity = await getCloudIdentity();
  if (!identity.user || !identity.profile) return { ...emptyCloudState, connected: true };
  const freshProfile = await getProfile(identity.user.id);
  const device = freshProfile ? await ensureDevice(freshProfile, publicDeviceId, deviceName, appVersion) : null;
  let featureFlags: FeatureFlagRow[] = [];
  if (freshProfile?.status === 'approved') {
    const { data, error } = await supabase.from('feature_flags').select('*').order('key');
    if (error) throw error;
    featureFlags = data ?? [];
  }
  return { connected: true, session: identity.session, user: identity.user, profile: freshProfile, device, featureFlags };
}
