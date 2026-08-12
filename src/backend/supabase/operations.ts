import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './database.types';
import { supabase } from './client';

/**
 * Typed Supabase database operations
 * These functions provide proper type safety by wrapping Supabase queries
 * with correct Database schema typing in signatures and return types.
 * Internal Supabase method calls use type parameters to work around the
 * library's generic type inference limitations.
 */

type TypedSupabase = SupabaseClient<Database>;
type ProfileRow = Database['public']['Tables']['profiles']['Row'];
type DeviceRow = Database['public']['Tables']['devices']['Row'];

function getTypedClient(): TypedSupabase {
  if (!supabase) throw new Error('Supabase is not configured');
  return supabase as unknown as TypedSupabase;
}

export async function updateProfileRow(
  id: string,
  updates: Database['public']['Tables']['profiles']['Update'],
): Promise<ProfileRow> {
  const client = getTypedClient();
  const { data, error } = await (client.from('profiles') as any)
    .update(updates)
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function selectDeviceRow(publicDeviceId: string): Promise<DeviceRow | null> {
  const client = getTypedClient();
  const { data, error } = await (client.from('devices') as any)
    .select('*')
    .eq('public_device_id', publicDeviceId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function updateDeviceRow(
  id: string,
  updates: Database['public']['Tables']['devices']['Update'],
): Promise<DeviceRow> {
  const client = getTypedClient();
  const { data, error } = await (client.from('devices') as any)
    .update(updates)
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function insertDeviceRow(
  device: Database['public']['Tables']['devices']['Insert'],
): Promise<DeviceRow> {
  const client = getTypedClient();
  const { data, error } = await (client.from('devices') as any)
    .insert(device)
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function insertOperationHistory(
  entry: Database['public']['Tables']['operation_history']['Insert'],
): Promise<void> {
  const client = getTypedClient();
  const { error } = await (client.from('operation_history') as any).insert(entry);
  if (error) throw error;
}

export async function insertDiagnostic(
  diagnostic: Database['public']['Tables']['diagnostics']['Insert'],
): Promise<void> {
  const client = getTypedClient();
  const { error } = await (client.from('diagnostics') as any).insert(diagnostic);
  if (error) throw error;
}

export async function insertFeedback(
  feedback: Database['public']['Tables']['feedback']['Insert'],
): Promise<void> {
  const client = getTypedClient();
  const { error } = await (client.from('feedback') as any).insert(feedback);
  if (error) throw error;
}
