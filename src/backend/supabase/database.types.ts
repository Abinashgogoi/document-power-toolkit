export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type AccountStatus = 'pending' | 'approved' | 'rejected' | 'disabled';
export type AccountRole = 'user' | 'admin' | 'super_admin';
export type DeviceTrust = 'pending' | 'trusted' | 'revoked';

export interface ProfileRow {
  id: string;
  display_name: string;
  status: AccountStatus;
  role: AccountRole;
  approved_at: string | null;
  approved_by: string | null;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface DeviceRow {
  id: string;
  account_id: string;
  public_device_id: string;
  display_name: string;
  platform: string;
  os_version: string | null;
  app_version: string;
  trust: DeviceTrust;
  last_active_at: string;
  created_at: string;
  revoked_at: string | null;
}

export interface FeatureFlagRow {
  key: string;
  enabled: boolean;
  stable_only: boolean;
  description: string;
  updated_by: string | null;
  updated_at: string;
}

export interface Database {
  public: {
    Tables: {
      profiles: { Row: ProfileRow; Insert: Partial<ProfileRow> & { id: string }; Update: Partial<ProfileRow>; Relationships: [] };
      devices: { Row: DeviceRow; Insert: Partial<DeviceRow> & Pick<DeviceRow, 'account_id' | 'display_name' | 'platform' | 'app_version'>; Update: Partial<DeviceRow>; Relationships: [] };
      operation_history: {
        Row: { id: string; account_id: string; device_id: string | null; tool: string; input_bytes: number | null; output_bytes: number | null; duration_ms: number | null; verification_passed: boolean; safe_settings: Json; created_at: string };
        Insert: { id?: string; account_id: string; device_id?: string | null; tool: string; input_bytes?: number | null; output_bytes?: number | null; duration_ms?: number | null; verification_passed: boolean; safe_settings?: Json; created_at?: string };
        Update: Record<string, never>; Relationships: [];
      };
      diagnostics: {
        Row: { id: string; fingerprint: string; account_id: string; device_id: string | null; app_version: string; module: string; error_code: string; safe_message: string; safe_context: Json; occurrence_count: number; first_seen_at: string; last_seen_at: string; resolved_at: string | null };
        Insert: { id?: string; fingerprint: string; account_id: string; device_id?: string | null; app_version: string; module: string; error_code: string; safe_message: string; safe_context?: Json; occurrence_count?: number; first_seen_at?: string; last_seen_at?: string; resolved_at?: string | null };
        Update: Partial<{ occurrence_count: number; last_seen_at: string; resolved_at: string | null }>; Relationships: [];
      };
      feedback: {
        Row: { id: string; account_id: string; device_id: string | null; category: string; subject: string; body: string; safe_context: Json; status: string; created_at: string; updated_at: string };
        Insert: { id?: string; account_id: string; device_id?: string | null; category: string; subject: string; body: string; safe_context?: Json; status?: string; created_at?: string; updated_at?: string };
        Update: Partial<{ status: string }>; Relationships: [];
      };
      feature_flags: { Row: FeatureFlagRow; Insert: Partial<FeatureFlagRow> & Pick<FeatureFlagRow, 'key' | 'description'>; Update: Partial<FeatureFlagRow>; Relationships: [] };
      admin_audit_log: { Row: { id: number; actor_id: string; action: string; target_type: string; target_id: string; safe_details: Json; created_at: string }; Insert: Record<string, never>; Update: Record<string, never>; Relationships: [] };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: { account_status: AccountStatus; account_role: AccountRole; device_trust: DeviceTrust };
    CompositeTypes: Record<string, never>;
  };
}
