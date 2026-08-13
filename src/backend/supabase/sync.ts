import type { HistoryEntry } from "../../types";
import { insertOperationHistory, insertFeedback } from "./operations";
import { supabase } from "./client";
import type { Json } from "./database.types";

export async function syncHistoryEntry(
  accountId: string,
  deviceId: string | null,
  entry: HistoryEntry,
): Promise<void> {
  await insertOperationHistory({
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
}

export async function submitDiagnostic(input: {
  fingerprint: string;
  accountId: string;
  deviceId?: string | null;
  appVersion: string;
  module: string;
  errorCode: string;
  safeMessage: string;
  safeContext?: Json;
}): Promise<void> {
  const { error } = await supabase!.rpc('report_diagnostic', {
    p_fingerprint: input.fingerprint,
    p_device_id: input.deviceId ?? null,
    p_app_version: input.appVersion,
    p_module: input.module,
    p_error_code: input.errorCode,
    p_safe_message: input.safeMessage.slice(0, 1000),
    p_safe_context: input.safeContext ?? {},
  });
  if (error) throw error;
}

export async function submitFeedback(input: {
  accountId: string;
  deviceId?: string | null;
  category: string;
  subject: string;
  body: string;
  safeContext?: Json;
}): Promise<void> {
  await insertFeedback({
    account_id: input.accountId,
    device_id: input.deviceId ?? null,
    category: input.category,
    subject: input.subject,
    body: input.body,
    safe_context: input.safeContext ?? {},
  });
}
