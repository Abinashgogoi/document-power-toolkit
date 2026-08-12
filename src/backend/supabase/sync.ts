import type { HistoryEntry } from '../../types';
import { supabase } from './client';
import type { Json } from './database.types';

export async function syncHistoryEntry(accountId: string, deviceId: string | null, entry: HistoryEntry): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from('operation_history').insert({
    account_id: accountId,
    device_id: deviceId,
    tool: entry.tool,
    input_bytes: entry.inputBytes,
    output_bytes: entry.outputBytes,
    duration_ms: entry.durationMs,
    verification_passed: entry.passed,
    safe_settings: entry.settings as Json,
    created_at: entry.timestamp,
  });
  if (error) throw error;
}

export async function submitDiagnostic(input: {
  fingerprint: string; accountId: string; deviceId?: string | null; appVersion: string;
  module: string; errorCode: string; safeMessage: string; safeContext?: Json;
}): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from('diagnostics').insert({
    fingerprint: input.fingerprint,
    account_id: input.accountId,
    device_id: input.deviceId ?? null,
    app_version: input.appVersion,
    module: input.module,
    error_code: input.errorCode,
    safe_message: input.safeMessage.slice(0, 1000),
    safe_context: input.safeContext ?? {},
  });
  if (error) throw error;
}

export async function submitFeedback(input: {
  accountId: string; deviceId?: string | null; category: string; subject: string; body: string; safeContext?: Json;
}): Promise<void> {
  if (!supabase) throw new Error('Supabase backend is not configured.');
  const { error } = await supabase.from('feedback').insert({
    account_id: input.accountId,
    device_id: input.deviceId ?? null,
    category: input.category,
    subject: input.subject,
    body: input.body,
    safe_context: input.safeContext ?? {},
  });
  if (error) throw error;
}
