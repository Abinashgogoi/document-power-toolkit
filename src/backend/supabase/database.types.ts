export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.15";
  };
  public: {
    Tables: {
      admin_audit_log: {
        Row: {
          action: string;
          actor_id: string;
          created_at: string;
          id: number;
          safe_details: Json;
          target_id: string;
          target_type: string;
        };
        Insert: {
          action: string;
          actor_id: string;
          created_at?: string;
          id?: never;
          safe_details?: Json;
          target_id: string;
          target_type: string;
        };
        Update: {
          action?: string;
          actor_id?: string;
          created_at?: string;
          id?: never;
          safe_details?: Json;
          target_id?: string;
          target_type?: string;
        };
        Relationships: [];
      };
      devices: {
        Row: {
          account_id: string;
          app_version: string;
          created_at: string;
          display_name: string;
          email: string | null;
          id: string;
          last_active_at: string;
          os_version: string | null;
          platform: string;
          public_device_id: string;
          revoked_at: string | null;
          trust: Database["public"]["Enums"]["device_trust"];
        };
        Insert: {
          account_id: string;
          app_version: string;
          created_at?: string;
          display_name: string;
          id?: string;
          last_active_at?: string;
          os_version?: string | null;
          platform: string;
          public_device_id?: string;
          revoked_at?: string | null;
          trust?: Database["public"]["Enums"]["device_trust"];
        };
        Update: {
          account_id?: string;
          app_version?: string;
          created_at?: string;
          display_name?: string;
          email?: string | null;
          id?: string;
          last_active_at?: string;
          os_version?: string | null;
          platform?: string;
          public_device_id?: string;
          revoked_at?: string | null;
          trust?: Database["public"]["Enums"]["device_trust"];
        };
        Relationships: [
          {
            foreignKeyName: "devices_account_id_fkey";
            columns: ["account_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      diagnostics: {
        Row: {
          account_id: string;
          app_version: string;
          device_id: string | null;
          error_code: string;
          fingerprint: string;
          first_seen_at: string;
          id: string;
          last_seen_at: string;
          module: string;
          occurrence_count: number;
          resolved_at: string | null;
          safe_context: Json;
          safe_message: string;
        };
        Insert: {
          account_id: string;
          app_version: string;
          device_id?: string | null;
          error_code: string;
          fingerprint: string;
          first_seen_at?: string;
          id?: string;
          last_seen_at?: string;
          module: string;
          occurrence_count?: number;
          resolved_at?: string | null;
          safe_context?: Json;
          safe_message: string;
        };
        Update: {
          account_id?: string;
          app_version?: string;
          device_id?: string | null;
          error_code?: string;
          fingerprint?: string;
          first_seen_at?: string;
          id?: string;
          last_seen_at?: string;
          module?: string;
          occurrence_count?: number;
          resolved_at?: string | null;
          safe_context?: Json;
          safe_message?: string;
        };
        Relationships: [
          {
            foreignKeyName: "diagnostics_account_id_fkey";
            columns: ["account_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "diagnostics_device_id_fkey";
            columns: ["device_id"];
            isOneToOne: false;
            referencedRelation: "devices";
            referencedColumns: ["id"];
          },
        ];
      };
      feature_flags: {
        Row: {
          description: string;
          enabled: boolean;
          key: string;
          stable_only: boolean;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          description: string;
          enabled?: boolean;
          key: string;
          stable_only?: boolean;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          description?: string;
          enabled?: boolean;
          key?: string;
          stable_only?: boolean;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [];
      };
      feedback: {
        Row: {
          account_id: string;
          body: string;
          category: string;
          created_at: string;
          device_id: string | null;
          id: string;
          safe_context: Json;
          status: string;
          subject: string;
          updated_at: string;
        };
        Insert: {
          account_id: string;
          body: string;
          category: string;
          created_at?: string;
          device_id?: string | null;
          id?: string;
          safe_context?: Json;
          status?: string;
          subject: string;
          updated_at?: string;
        };
        Update: {
          account_id?: string;
          body?: string;
          category?: string;
          created_at?: string;
          device_id?: string | null;
          id?: string;
          safe_context?: Json;
          status?: string;
          subject?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "feedback_account_id_fkey";
            columns: ["account_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "feedback_device_id_fkey";
            columns: ["device_id"];
            isOneToOne: false;
            referencedRelation: "devices";
            referencedColumns: ["id"];
          },
        ];
      };
      operation_history: {
        Row: {
          account_id: string;
          created_at: string;
          device_id: string | null;
          duration_ms: number | null;
          id: string;
          input_bytes: number | null;
          output_bytes: number | null;
          safe_settings: Json;
          tool: string;
          verification_passed: boolean;
        };
        Insert: {
          account_id: string;
          created_at?: string;
          device_id?: string | null;
          duration_ms?: number | null;
          id?: string;
          input_bytes?: number | null;
          output_bytes?: number | null;
          safe_settings?: Json;
          tool: string;
          verification_passed: boolean;
        };
        Update: {
          account_id?: string;
          created_at?: string;
          device_id?: string | null;
          duration_ms?: number | null;
          id?: string;
          input_bytes?: number | null;
          output_bytes?: number | null;
          safe_settings?: Json;
          tool?: string;
          verification_passed?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: "operation_history_account_id_fkey";
            columns: ["account_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "operation_history_device_id_fkey";
            columns: ["device_id"];
            isOneToOne: false;
            referencedRelation: "devices";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          approved_at: string | null;
          approved_by: string | null;
          created_at: string;
          display_name: string;
          email: string | null;
          id: string;
          rejection_reason: string | null;
          role: Database["public"]["Enums"]["account_role"];
          status: Database["public"]["Enums"]["account_status"];
          updated_at: string;
        };
        Insert: {
          approved_at?: string | null;
          approved_by?: string | null;
          created_at?: string;
          display_name?: string;
          email?: string | null;
          id: string;
          rejection_reason?: string | null;
          role?: Database["public"]["Enums"]["account_role"];
          status?: Database["public"]["Enums"]["account_status"];
          updated_at?: string;
        };
        Update: {
          approved_at?: string | null;
          approved_by?: string | null;
          created_at?: string;
          display_name?: string;
          email?: string | null;
          id?: string;
          rejection_reason?: string | null;
          role?: Database["public"]["Enums"]["account_role"];
          status?: Database["public"]["Enums"]["account_status"];
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      admin_set_diagnostic_resolution: {
        Args: { is_resolved: boolean; target_id: string; };
        Returns: Database["public"]["Tables"]["diagnostics"]["Row"];
      };
      report_diagnostic: {
        Args: {
          p_app_version: string;
          p_device_id: string | null;
          p_error_code: string;
          p_fingerprint: string;
          p_module: string;
          p_safe_context?: Json;
          p_safe_message: string;
        };
        Returns: Database["public"]["Tables"]["diagnostics"]["Row"];
      };
      admin_set_feedback_status: {
        Args: { new_status: string; target_id: string; };
        Returns: Database["public"]["Tables"]["feedback"]["Row"];
      };
      admin_set_device_trust: {
        Args: {
          new_trust: Database["public"]["Enums"]["device_trust"];
          target_id: string;
        };
        Returns: Database["public"]["Tables"]["devices"]["Row"];
      };
      admin_set_account_control: {
        Args: {
          new_rejection_reason?: string | null;
          new_role?: Database["public"]["Enums"]["account_role"] | null;
          new_status: Database["public"]["Enums"]["account_status"];
          target_id: string;
        };
        Returns: {
          approved_at: string | null;
          approved_by: string | null;
          created_at: string;
          display_name: string;
          email: string | null;
          id: string;
          rejection_reason: string | null;
          role: Database["public"]["Enums"]["account_role"];
          status: Database["public"]["Enums"]["account_status"];
          updated_at: string;
        };
      };
    };
    Enums: {
      account_role: "user" | "admin" | "super_admin";
      account_status: "pending" | "approved" | "rejected" | "disabled";
      device_trust: "pending" | "trusted" | "revoked";
    };
    CompositeTypes: { [_ in never]: never };
  };
};

export type AccountStatus = Database["public"]["Enums"]["account_status"];
export type AccountRole = Database["public"]["Enums"]["account_role"];
export type DeviceTrust = Database["public"]["Enums"]["device_trust"];
export type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
export type DeviceRow = Database["public"]["Tables"]["devices"]["Row"];
export type DiagnosticRow = Database["public"]["Tables"]["diagnostics"]["Row"];
export type FeedbackRow = Database["public"]["Tables"]["feedback"]["Row"];
export type FeatureFlagRow = Database["public"]["Tables"]["feature_flags"]["Row"];
