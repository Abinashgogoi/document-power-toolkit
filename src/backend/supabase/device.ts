import { supabase } from "./client";
import { selectDeviceRow, updateDeviceRow, insertDeviceRow } from "./operations";
import type { DeviceRow, ProfileRow } from "./database.types";

export function browserPlatform(): string {
  const nav = navigator as Navigator & { userAgentData?: { platform?: string } };
  return nav.userAgentData?.platform || navigator.platform || "web";
}

export function browserOsVersion(): string | null {
  return navigator.userAgent || null;
}

export async function ensureDevice(
  profile: ProfileRow,
  publicDeviceId: string,
  displayName: string,
  appVersion: string,
): Promise<DeviceRow | null> {
  if (!supabase || profile.status !== "approved") return null;
  const existing = await selectDeviceRow(publicDeviceId);
  if (existing) {
    return updateDeviceRow(existing.id, {
      display_name: displayName,
      os_version: browserOsVersion(),
      app_version: appVersion,
      last_active_at: new Date().toISOString(),
    });
  }
  return insertDeviceRow({
    account_id: profile.id,
    public_device_id: publicDeviceId,
    display_name: displayName,
    platform: browserPlatform(),
    os_version: browserOsVersion(),
    app_version: appVersion,
  });
}
