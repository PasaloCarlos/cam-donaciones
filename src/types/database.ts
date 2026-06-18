export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      donors: {
        Row: {
          id: string;
          email_normalized: string | null;
          display_name: string;
          name_normalized: string;
          phone_normalized: string | null;
          address: string | null;
          country_region: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          email_normalized?: string | null;
          display_name: string;
          name_normalized: string;
          phone_normalized?: string | null;
          address?: string | null;
          country_region?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email_normalized?: string | null;
          display_name?: string;
          name_normalized?: string;
          phone_normalized?: string | null;
          address?: string | null;
          country_region?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      import_batches: {
        Row: {
          id: string;
          source: DonationSource;
          importer: string;
          filename: string | null;
          file_hash: string | null;
          row_count: number;
          created_donors: number;
          created_pledges: number;
          inserted_payments: number;
          skipped_payments: number;
          notes: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          source: DonationSource;
          importer: string;
          filename?: string | null;
          file_hash?: string | null;
          row_count?: number;
          created_donors?: number;
          created_pledges?: number;
          inserted_payments?: number;
          skipped_payments?: number;
          notes?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          source?: DonationSource;
          importer?: string;
          filename?: string | null;
          file_hash?: string | null;
          row_count?: number;
          created_donors?: number;
          created_pledges?: number;
          inserted_payments?: number;
          skipped_payments?: number;
          notes?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      pledges: {
        Row: {
          id: string;
          donor_id: string;
          source: DonationSource;
          kind: PledgeKind;
          status: PledgeStatus;
          goal: DonationGoal | null;
          monthly_gross_cents: number | null;
          fee_cents: number;
          monthly_net_cents: number | null;
          subscription_date: string | null;
          cancelled_at: string | null;
          source_year: number | null;
          external_ref: string | null;
          import_batch_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          donor_id: string;
          source: DonationSource;
          kind?: PledgeKind;
          status?: PledgeStatus;
          goal?: DonationGoal | null;
          monthly_gross_cents?: number | null;
          fee_cents?: number;
          monthly_net_cents?: number | null;
          subscription_date?: string | null;
          cancelled_at?: string | null;
          source_year?: number | null;
          external_ref?: string | null;
          import_batch_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          donor_id?: string;
          source?: DonationSource;
          kind?: PledgeKind;
          status?: PledgeStatus;
          goal?: DonationGoal | null;
          monthly_gross_cents?: number | null;
          fee_cents?: number;
          monthly_net_cents?: number | null;
          subscription_date?: string | null;
          cancelled_at?: string | null;
          source_year?: number | null;
          external_ref?: string | null;
          import_batch_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      payments: {
        Row: {
          id: string;
          donor_id: string;
          pledge_id: string | null;
          source: DonationSource;
          period_month: string;
          gross_cents: number;
          fee_cents: number;
          net_cents: number;
          goal: DonationGoal | null;
          external_ref: string | null;
          idempotency_key: string;
          import_batch_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          donor_id: string;
          pledge_id?: string | null;
          source: DonationSource;
          period_month: string;
          gross_cents: number;
          fee_cents?: number;
          net_cents: number;
          goal?: DonationGoal | null;
          external_ref?: string | null;
          idempotency_key: string;
          import_batch_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          donor_id?: string;
          pledge_id?: string | null;
          source?: DonationSource;
          period_month?: string;
          gross_cents?: number;
          fee_cents?: number;
          net_cents?: number;
          goal?: DonationGoal | null;
          external_ref?: string | null;
          idempotency_key?: string;
          import_batch_id?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      donation_source: "cam_cash" | "paypal" | "stripe" | "special" | "other";
      pledge_status: "active" | "cancelled" | "paused";
      pledge_kind: "recurring" | "one_time";
      donation_goal: "operacion_general" | "compras_solidarias";
    };
    CompositeTypes: Record<string, never>;
  };
};

export type DonationSource = Database["public"]["Enums"]["donation_source"];
export type PledgeStatus = Database["public"]["Enums"]["pledge_status"];
export type PledgeKind = Database["public"]["Enums"]["pledge_kind"];
export type DonationGoal = Database["public"]["Enums"]["donation_goal"];
