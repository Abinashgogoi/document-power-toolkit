import type { Database } from "./database.types";
import { supabase } from "./client";

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
type DeviceRow = Database["public"]["Tables"]["devices"]["Row"];

function getClient() {
  if (!supabase) throw new Error("Supabase is not configured");
  return supabase;
}

export async function updateProfileRow(
  id: string,
  updates: Database["public"]["Tables"]["profiles"]["Update"],
): Promise<ProfileRow> {
  const { data, error } = await getClient()
    .from("profiles")
    .update(updates)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function selectDeviceRow(
  publicDeviceId: string,
): Promise<DeviceRow | null> {
  const { data, error } = await getClient()
    .from("devices")
    .select("*")
    .eq("public_device_id", publicDeviceId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function updateDeviceRow(
  id: string,
  updates: Database["public"]["Tables"]["devices"]["Update"],
): Promise<DeviceRow> {
  const { data, error } = await getClient()
    .from("devices")
    .update(updates)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function insertDeviceRow(
  device: Database["public"]["Tables"]["devices"]["Insert"],
): Promise<DeviceRow> {
  const { data, error } = await getClient()
    .from("devices")
    .insert(device)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function insertOperationHistory(
  entry: Database["public"]["Tables"]["operation_history"]["Insert"],
): Promise<void> {
  const { error } = await getClient().from("operation_history").insert(entry);
  if (error) throw error;
}

export async function insertDiagnostic(
  diagnostic: Database["public"]["Tables"]["diagnostics"]["Insert"],
): Promise<void> {
  const { error } = await getClient().from("diagnostics").insert(diagnostic);
  if (error) throw error;
}

export async function insertFeedback(
  feedback: Database["public"]["Tables"]["feedback"]["Insert"],
): Promise<void> {
  const { error } = await getClient().from("feedback").insert(feedback);
  if (error) throw error;
}
