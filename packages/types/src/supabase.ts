export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: { extensions?: Json; operationName?: string; query?: string; variables?: Json };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      admin_audit_log: {
        Row: {
          action: string;
          actor_id: string | null;
          after: Json | null;
          before: Json | null;
          created_at: string;
          entity: string;
          entity_id: string;
          id: number;
        };
        ComputedFields: never;
        Insert: {
          action: string;
          actor_id?: string | null;
          after?: Json | null;
          before?: Json | null;
          created_at?: string;
          entity: string;
          entity_id: string;
          id?: never;
        };
        Update: {
          action?: string;
          actor_id?: string | null;
          after?: Json | null;
          before?: Json | null;
          created_at?: string;
          entity?: string;
          entity_id?: string;
          id?: never;
        };
        Relationships: [
          {
            foreignKeyName: 'admin_audit_log_actor_id_fkey';
            columns: ['actor_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      announcements: {
        Row: {
          body: string;
          created_at: string;
          created_by: string | null;
          id: string;
          published_at: string | null;
          status: Database['public']['Enums']['announcement_status'];
          title: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          body: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          published_at?: string | null;
          status?: Database['public']['Enums']['announcement_status'];
          title: string;
          updated_at?: string;
        };
        Update: {
          body?: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          published_at?: string | null;
          status?: Database['public']['Enums']['announcement_status'];
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'announcements_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      business_hours: {
        Row: {
          closes_at: string;
          is_closed: boolean;
          opens_at: string;
          updated_at: string;
          weekday: number;
        };
        ComputedFields: never;
        Insert: {
          closes_at?: string;
          is_closed?: boolean;
          opens_at?: string;
          updated_at?: string;
          weekday: number;
        };
        Update: {
          closes_at?: string;
          is_closed?: boolean;
          opens_at?: string;
          updated_at?: string;
          weekday?: number;
        };
        Relationships: [];
      };
      coupon_point_balances: {
        Row: {
          balance: number;
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          balance?: number;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          balance?: number;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'coupon_point_balances_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: true;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      coupon_point_code_attempts: {
        Row: {
          created_at: string;
          id: number;
          succeeded: boolean;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          id?: never;
          succeeded: boolean;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: never;
          succeeded?: boolean;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'coupon_point_code_attempts_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      coupon_point_code_batches: {
        Row: {
          amount: number;
          created_at: string;
          created_by: string | null;
          expires_at: string;
          id: string;
          memo: string;
          quantity: number;
        };
        ComputedFields: never;
        Insert: {
          amount: number;
          created_at?: string;
          created_by?: string | null;
          expires_at: string;
          id?: string;
          memo?: string;
          quantity: number;
        };
        Update: {
          amount?: number;
          created_at?: string;
          created_by?: string | null;
          expires_at?: string;
          id?: string;
          memo?: string;
          quantity?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'coupon_point_code_batches_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      coupon_point_codes: {
        Row: {
          amount: number;
          batch_id: string;
          code: string;
          created_at: string;
          expires_at: string;
          id: string;
          registered_at: string | null;
          registered_by: string | null;
          status: Database['public']['Enums']['point_code_status'];
          voided_at: string | null;
          voided_by: string | null;
        };
        ComputedFields: never;
        Insert: {
          amount: number;
          batch_id: string;
          code: string;
          created_at?: string;
          expires_at: string;
          id?: string;
          registered_at?: string | null;
          registered_by?: string | null;
          status?: Database['public']['Enums']['point_code_status'];
          voided_at?: string | null;
          voided_by?: string | null;
        };
        Update: {
          amount?: number;
          batch_id?: string;
          code?: string;
          created_at?: string;
          expires_at?: string;
          id?: string;
          registered_at?: string | null;
          registered_by?: string | null;
          status?: Database['public']['Enums']['point_code_status'];
          voided_at?: string | null;
          voided_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'coupon_point_codes_batch_id_fkey';
            columns: ['batch_id'];
            isOneToOne: false;
            referencedRelation: 'coupon_point_code_batches';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'coupon_point_codes_registered_by_fkey';
            columns: ['registered_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'coupon_point_codes_voided_by_fkey';
            columns: ['voided_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      coupon_point_holds: {
        Row: {
          amount: number;
          created_at: string;
          id: string;
          order_id: string;
          resolved_at: string | null;
          status: Database['public']['Enums']['point_hold_status'];
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          amount: number;
          created_at?: string;
          id?: string;
          order_id: string;
          resolved_at?: string | null;
          status?: Database['public']['Enums']['point_hold_status'];
          user_id: string;
        };
        Update: {
          amount?: number;
          created_at?: string;
          id?: string;
          order_id?: string;
          resolved_at?: string | null;
          status?: Database['public']['Enums']['point_hold_status'];
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'coupon_point_holds_order_id_fkey';
            columns: ['order_id'];
            isOneToOne: true;
            referencedRelation: 'orders';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'coupon_point_holds_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      coupon_point_policy: {
        Row: {
          id: number;
          max_use_per_order: number | null;
          min_use_amount: number;
          registration_attempt_limit: number;
          registration_attempt_window_minutes: number;
          updated_at: string;
          use_unit: number;
        };
        ComputedFields: never;
        Insert: {
          id?: number;
          max_use_per_order?: number | null;
          min_use_amount?: number;
          registration_attempt_limit?: number;
          registration_attempt_window_minutes?: number;
          updated_at?: string;
          use_unit?: number;
        };
        Update: {
          id?: number;
          max_use_per_order?: number | null;
          min_use_amount?: number;
          registration_attempt_limit?: number;
          registration_attempt_window_minutes?: number;
          updated_at?: string;
          use_unit?: number;
        };
        Relationships: [];
      };
      coupon_point_transactions: {
        Row: {
          actor_id: string | null;
          balance_after: number;
          code_id: string;
          created_at: string;
          delta: number;
          id: number;
          idempotency_key: string;
          kind: Database['public']['Enums']['point_tx_kind'];
          label: string;
          lot_expires_at: string;
          order_id: string | null;
          user_id: string | null;
        };
        ComputedFields: never;
        Insert: {
          actor_id?: string | null;
          balance_after: number;
          code_id: string;
          created_at?: string;
          delta: number;
          id?: never;
          idempotency_key: string;
          kind: Database['public']['Enums']['point_tx_kind'];
          label: string;
          lot_expires_at: string;
          order_id?: string | null;
          user_id?: string | null;
        };
        Update: {
          actor_id?: string | null;
          balance_after?: number;
          code_id?: string;
          created_at?: string;
          delta?: number;
          id?: never;
          idempotency_key?: string;
          kind?: Database['public']['Enums']['point_tx_kind'];
          label?: string;
          lot_expires_at?: string;
          order_id?: string | null;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'coupon_point_transactions_actor_id_fkey';
            columns: ['actor_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'coupon_point_transactions_code_id_fkey';
            columns: ['code_id'];
            isOneToOne: false;
            referencedRelation: 'coupon_point_codes';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'coupon_point_transactions_order_id_fkey';
            columns: ['order_id'];
            isOneToOne: false;
            referencedRelation: 'orders';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'coupon_point_transactions_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      coupons: {
        Row: {
          benefit_type: Database['public']['Enums']['coupon_benefit_type'];
          created_at: string;
          discount_amount: number | null;
          eligible_category_ids: string[];
          eligible_menu_item_ids: string[];
          id: string;
          is_active: boolean;
          required_stamps: number;
          sort_order: number;
          title: string;
          updated_at: string;
          valid_days: number;
        };
        ComputedFields: never;
        Insert: {
          benefit_type: Database['public']['Enums']['coupon_benefit_type'];
          created_at?: string;
          discount_amount?: number | null;
          eligible_category_ids?: string[];
          eligible_menu_item_ids?: string[];
          id?: string;
          is_active?: boolean;
          required_stamps: number;
          sort_order?: number;
          title: string;
          updated_at?: string;
          valid_days: number;
        };
        Update: {
          benefit_type?: Database['public']['Enums']['coupon_benefit_type'];
          created_at?: string;
          discount_amount?: number | null;
          eligible_category_ids?: string[];
          eligible_menu_item_ids?: string[];
          id?: string;
          is_active?: boolean;
          required_stamps?: number;
          sort_order?: number;
          title?: string;
          updated_at?: string;
          valid_days?: number;
        };
        Relationships: [];
      };
      menu_categories: {
        Row: {
          created_at: string;
          id: string;
          is_active: boolean;
          name: string;
          sort_order: number;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          id?: string;
          is_active?: boolean;
          name: string;
          sort_order?: number;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          is_active?: boolean;
          name?: string;
          sort_order?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      menu_items: {
        Row: {
          archived_at: string | null;
          category_id: string;
          created_at: string;
          description: string;
          id: string;
          image_path: string | null;
          is_active: boolean;
          is_sold_out: boolean;
          name: string;
          price: number;
          sort_order: number;
          temperatures: Database['public']['Enums']['temperature'][];
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          archived_at?: string | null;
          category_id: string;
          created_at?: string;
          description?: string;
          id?: string;
          image_path?: string | null;
          is_active?: boolean;
          is_sold_out?: boolean;
          name: string;
          price: number;
          sort_order?: number;
          temperatures?: Database['public']['Enums']['temperature'][];
          updated_at?: string;
        };
        Update: {
          archived_at?: string | null;
          category_id?: string;
          created_at?: string;
          description?: string;
          id?: string;
          image_path?: string | null;
          is_active?: boolean;
          is_sold_out?: boolean;
          name?: string;
          price?: number;
          sort_order?: number;
          temperatures?: Database['public']['Enums']['temperature'][];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'menu_items_category_id_fkey';
            columns: ['category_id'];
            isOneToOne: false;
            referencedRelation: 'menu_categories';
            referencedColumns: ['id'];
          },
        ];
      };
      notification_preferences: {
        Row: {
          notices: boolean;
          order_updates: boolean;
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          notices?: boolean;
          order_updates?: boolean;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          notices?: boolean;
          order_updates?: boolean;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'notification_preferences_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: true;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      notifications: {
        Row: {
          body: string;
          created_at: string;
          dedupe_key: string;
          id: string;
          is_read: boolean;
          kind: Database['public']['Enums']['notification_kind'];
          order_id: string | null;
          title: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          body?: string;
          created_at?: string;
          dedupe_key: string;
          id?: string;
          is_read?: boolean;
          kind: Database['public']['Enums']['notification_kind'];
          order_id?: string | null;
          title: string;
          user_id: string;
        };
        Update: {
          body?: string;
          created_at?: string;
          dedupe_key?: string;
          id?: string;
          is_read?: boolean;
          kind?: Database['public']['Enums']['notification_kind'];
          order_id?: string | null;
          title?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'notifications_order_id_fkey';
            columns: ['order_id'];
            isOneToOne: false;
            referencedRelation: 'orders';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'notifications_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      order_items: {
        Row: {
          id: string;
          line_total: number | null;
          menu_item_id: string | null;
          name_snapshot: string;
          order_id: string;
          quantity: number;
          sort_order: number;
          temperature: Database['public']['Enums']['temperature'] | null;
          unit_price: number;
        };
        ComputedFields: never;
        Insert: {
          id?: string;
          line_total?: never;
          menu_item_id?: string | null;
          name_snapshot: string;
          order_id: string;
          quantity: number;
          sort_order?: number;
          temperature?: Database['public']['Enums']['temperature'] | null;
          unit_price: number;
        };
        Update: {
          id?: string;
          line_total?: never;
          menu_item_id?: string | null;
          name_snapshot?: string;
          order_id?: string;
          quantity?: number;
          sort_order?: number;
          temperature?: Database['public']['Enums']['temperature'] | null;
          unit_price?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'order_items_menu_item_id_fkey';
            columns: ['menu_item_id'];
            isOneToOne: false;
            referencedRelation: 'menu_items';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'order_items_order_id_fkey';
            columns: ['order_id'];
            isOneToOne: false;
            referencedRelation: 'orders';
            referencedColumns: ['id'];
          },
        ];
      };
      order_number_counters: {
        Row: {
          business_date: string;
          last_value: number;
        };
        ComputedFields: never;
        Insert: {
          business_date: string;
          last_value: number;
        };
        Update: {
          business_date?: string;
          last_value?: number;
        };
        Relationships: [];
      };
      order_status_history: {
        Row: {
          actor_id: string | null;
          actor_role: Database['public']['Enums']['actor_role'];
          created_at: string;
          from_status: Database['public']['Enums']['order_status'] | null;
          id: number;
          order_id: string;
          reason: string | null;
          to_status: Database['public']['Enums']['order_status'];
        };
        ComputedFields: never;
        Insert: {
          actor_id?: string | null;
          actor_role: Database['public']['Enums']['actor_role'];
          created_at?: string;
          from_status?: Database['public']['Enums']['order_status'] | null;
          id?: never;
          order_id: string;
          reason?: string | null;
          to_status: Database['public']['Enums']['order_status'];
        };
        Update: {
          actor_id?: string | null;
          actor_role?: Database['public']['Enums']['actor_role'];
          created_at?: string;
          from_status?: Database['public']['Enums']['order_status'] | null;
          id?: never;
          order_id?: string;
          reason?: string | null;
          to_status?: Database['public']['Enums']['order_status'];
        };
        Relationships: [
          {
            foreignKeyName: 'order_status_history_actor_id_fkey';
            columns: ['actor_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'order_status_history_order_id_fkey';
            columns: ['order_id'];
            isOneToOne: false;
            referencedRelation: 'orders';
            referencedColumns: ['id'];
          },
        ];
      };
      orders: {
        Row: {
          accepted_at: string | null;
          business_date: string | null;
          cancel_reason: string | null;
          cancelled_at: string | null;
          client_request_id: string;
          completed_at: string | null;
          coupon_discount: number;
          coupon_title_snapshot: string | null;
          created_at: string;
          customer_id: string | null;
          expires_at: string;
          id: string;
          menu_amount: number;
          note: string | null;
          order_number: string | null;
          order_type: Database['public']['Enums']['order_type'];
          paid_amount: number;
          paid_at: string | null;
          payment_method: Database['public']['Enums']['payment_method'];
          payment_status: Database['public']['Enums']['payment_status'];
          points_used: number;
          preparing_at: string | null;
          ready_at: string | null;
          reject_reason: string | null;
          reject_reason_code: string | null;
          rejected_at: string | null;
          request_hash: string;
          stamp_policy_id: string | null;
          status: Database['public']['Enums']['order_status'];
          updated_at: string;
          user_coupon_id: string | null;
        };
        ComputedFields: never;
        Insert: {
          accepted_at?: string | null;
          business_date?: string | null;
          cancel_reason?: string | null;
          cancelled_at?: string | null;
          client_request_id: string;
          completed_at?: string | null;
          coupon_discount?: number;
          coupon_title_snapshot?: string | null;
          created_at?: string;
          customer_id?: string | null;
          expires_at: string;
          id?: string;
          menu_amount: number;
          note?: string | null;
          order_number?: string | null;
          order_type: Database['public']['Enums']['order_type'];
          paid_amount: number;
          paid_at?: string | null;
          payment_method: Database['public']['Enums']['payment_method'];
          payment_status?: Database['public']['Enums']['payment_status'];
          points_used?: number;
          preparing_at?: string | null;
          ready_at?: string | null;
          reject_reason?: string | null;
          reject_reason_code?: string | null;
          rejected_at?: string | null;
          request_hash: string;
          stamp_policy_id?: string | null;
          status?: Database['public']['Enums']['order_status'];
          updated_at?: string;
          user_coupon_id?: string | null;
        };
        Update: {
          accepted_at?: string | null;
          business_date?: string | null;
          cancel_reason?: string | null;
          cancelled_at?: string | null;
          client_request_id?: string;
          completed_at?: string | null;
          coupon_discount?: number;
          coupon_title_snapshot?: string | null;
          created_at?: string;
          customer_id?: string | null;
          expires_at?: string;
          id?: string;
          menu_amount?: number;
          note?: string | null;
          order_number?: string | null;
          order_type?: Database['public']['Enums']['order_type'];
          paid_amount?: number;
          paid_at?: string | null;
          payment_method?: Database['public']['Enums']['payment_method'];
          payment_status?: Database['public']['Enums']['payment_status'];
          points_used?: number;
          preparing_at?: string | null;
          ready_at?: string | null;
          reject_reason?: string | null;
          reject_reason_code?: string | null;
          rejected_at?: string | null;
          request_hash?: string;
          stamp_policy_id?: string | null;
          status?: Database['public']['Enums']['order_status'];
          updated_at?: string;
          user_coupon_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'orders_customer_id_fkey';
            columns: ['customer_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'orders_stamp_policy_id_fkey';
            columns: ['stamp_policy_id'];
            isOneToOne: false;
            referencedRelation: 'stamp_policies';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'orders_user_coupon_id_fkey';
            columns: ['user_coupon_id'];
            isOneToOne: false;
            referencedRelation: 'user_coupon_view';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'orders_user_coupon_id_fkey';
            columns: ['user_coupon_id'];
            isOneToOne: false;
            referencedRelation: 'user_coupons';
            referencedColumns: ['id'];
          },
        ];
      };
      payment_events: {
        Row: {
          event_id: string;
          event_type: string;
          id: number;
          payload: Json | null;
          payment_id: string | null;
          provider: string;
          received_at: string;
          result: string;
          source: string;
        };
        ComputedFields: never;
        Insert: {
          event_id: string;
          event_type: string;
          id?: never;
          payload?: Json | null;
          payment_id?: string | null;
          provider: string;
          received_at?: string;
          result: string;
          source: string;
        };
        Update: {
          event_id?: string;
          event_type?: string;
          id?: never;
          payload?: Json | null;
          payment_id?: string | null;
          provider?: string;
          received_at?: string;
          result?: string;
          source?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'payment_events_payment_id_fkey';
            columns: ['payment_id'];
            isOneToOne: false;
            referencedRelation: 'payments';
            referencedColumns: ['id'];
          },
        ];
      };
      payments: {
        Row: {
          amount: number;
          approved_at: string | null;
          cancelled_at: string | null;
          failed_at: string | null;
          failure_code: string | null;
          failure_message: string | null;
          id: string;
          idempotency_key: string;
          method: Database['public']['Enums']['payment_method'];
          order_id: string;
          provider: string;
          provider_payment_id: string | null;
          requested_at: string;
          status: Database['public']['Enums']['payment_status'];
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          amount: number;
          approved_at?: string | null;
          cancelled_at?: string | null;
          failed_at?: string | null;
          failure_code?: string | null;
          failure_message?: string | null;
          id?: string;
          idempotency_key: string;
          method: Database['public']['Enums']['payment_method'];
          order_id: string;
          provider: string;
          provider_payment_id?: string | null;
          requested_at?: string;
          status?: Database['public']['Enums']['payment_status'];
          updated_at?: string;
        };
        Update: {
          amount?: number;
          approved_at?: string | null;
          cancelled_at?: string | null;
          failed_at?: string | null;
          failure_code?: string | null;
          failure_message?: string | null;
          id?: string;
          idempotency_key?: string;
          method?: Database['public']['Enums']['payment_method'];
          order_id?: string;
          provider?: string;
          provider_payment_id?: string | null;
          requested_at?: string;
          status?: Database['public']['Enums']['payment_status'];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'payments_order_id_fkey';
            columns: ['order_id'];
            isOneToOne: false;
            referencedRelation: 'orders';
            referencedColumns: ['id'];
          },
        ];
      };
      profiles: {
        Row: {
          avatar_url: string | null;
          created_at: string;
          deleted_at: string | null;
          id: string;
          nickname: string;
          updated_at: string;
          username: string | null;
        };
        ComputedFields: never;
        Insert: {
          avatar_url?: string | null;
          created_at?: string;
          deleted_at?: string | null;
          id: string;
          nickname?: string;
          updated_at?: string;
          username?: string | null;
        };
        Update: {
          avatar_url?: string | null;
          created_at?: string;
          deleted_at?: string | null;
          id?: string;
          nickname?: string;
          updated_at?: string;
          username?: string | null;
        };
        Relationships: [];
      };
      provider_cancels: {
        Row: {
          amount: number;
          attempts: number;
          completed_at: string | null;
          created_at: string;
          failure_message: string | null;
          id: string;
          payment_id: string;
          provider_payment_id: string;
          reason: string;
          status: Database['public']['Enums']['refund_status'];
        };
        ComputedFields: never;
        Insert: {
          amount: number;
          attempts?: number;
          completed_at?: string | null;
          created_at?: string;
          failure_message?: string | null;
          id?: string;
          payment_id: string;
          provider_payment_id: string;
          reason: string;
          status?: Database['public']['Enums']['refund_status'];
        };
        Update: {
          amount?: number;
          attempts?: number;
          completed_at?: string | null;
          created_at?: string;
          failure_message?: string | null;
          id?: string;
          payment_id?: string;
          provider_payment_id?: string;
          reason?: string;
          status?: Database['public']['Enums']['refund_status'];
        };
        Relationships: [
          {
            foreignKeyName: 'provider_cancels_payment_id_fkey';
            columns: ['payment_id'];
            isOneToOne: true;
            referencedRelation: 'payments';
            referencedColumns: ['id'];
          },
        ];
      };
      refunds: {
        Row: {
          amount: number;
          completed_at: string | null;
          created_at: string;
          failure_message: string | null;
          id: string;
          idempotency_key: string;
          payment_id: string;
          provider_refund_id: string | null;
          reason: string;
          requested_by: string | null;
          status: Database['public']['Enums']['refund_status'];
        };
        ComputedFields: never;
        Insert: {
          amount: number;
          completed_at?: string | null;
          created_at?: string;
          failure_message?: string | null;
          id?: string;
          idempotency_key: string;
          payment_id: string;
          provider_refund_id?: string | null;
          reason: string;
          requested_by?: string | null;
          status?: Database['public']['Enums']['refund_status'];
        };
        Update: {
          amount?: number;
          completed_at?: string | null;
          created_at?: string;
          failure_message?: string | null;
          id?: string;
          idempotency_key?: string;
          payment_id?: string;
          provider_refund_id?: string | null;
          reason?: string;
          requested_by?: string | null;
          status?: Database['public']['Enums']['refund_status'];
        };
        Relationships: [
          {
            foreignKeyName: 'refunds_payment_id_fkey';
            columns: ['payment_id'];
            isOneToOne: false;
            referencedRelation: 'payments';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'refunds_requested_by_fkey';
            columns: ['requested_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      staff_members: {
        Row: {
          created_at: string;
          display_name: string;
          invited_by: string | null;
          is_active: boolean;
          permissions: Database['public']['Enums']['staff_permission'][];
          role: Database['public']['Enums']['staff_role'];
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          display_name: string;
          invited_by?: string | null;
          is_active?: boolean;
          permissions?: Database['public']['Enums']['staff_permission'][];
          role: Database['public']['Enums']['staff_role'];
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          display_name?: string;
          invited_by?: string | null;
          is_active?: boolean;
          permissions?: Database['public']['Enums']['staff_permission'][];
          role?: Database['public']['Enums']['staff_role'];
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'staff_members_invited_by_fkey';
            columns: ['invited_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'staff_members_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: true;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      stamp_balances: {
        Row: {
          balance: number;
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          balance?: number;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          balance?: number;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'stamp_balances_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: true;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      stamp_policies: {
        Row: {
          amount_per_stamp: number | null;
          created_at: string;
          created_by: string | null;
          earn_basis: string;
          earn_mode: Database['public']['Enums']['stamp_earn_mode'];
          earn_timing: Database['public']['Enums']['stamp_earn_timing'];
          effective_from: string;
          id: string;
          stamps_per_order: number | null;
          version: number;
        };
        ComputedFields: never;
        Insert: {
          amount_per_stamp?: number | null;
          created_at?: string;
          created_by?: string | null;
          earn_basis?: string;
          earn_mode: Database['public']['Enums']['stamp_earn_mode'];
          earn_timing?: Database['public']['Enums']['stamp_earn_timing'];
          effective_from?: string;
          id?: string;
          stamps_per_order?: number | null;
          version?: never;
        };
        Update: {
          amount_per_stamp?: number | null;
          created_at?: string;
          created_by?: string | null;
          earn_basis?: string;
          earn_mode?: Database['public']['Enums']['stamp_earn_mode'];
          earn_timing?: Database['public']['Enums']['stamp_earn_timing'];
          effective_from?: string;
          id?: string;
          stamps_per_order?: number | null;
          version?: never;
        };
        Relationships: [
          {
            foreignKeyName: 'stamp_policies_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      stamp_transactions: {
        Row: {
          actor_id: string | null;
          balance_after: number;
          created_at: string;
          delta: number;
          id: number;
          idempotency_key: string;
          kind: Database['public']['Enums']['stamp_tx_kind'];
          label: string;
          order_id: string | null;
          user_coupon_id: string | null;
          user_id: string | null;
        };
        ComputedFields: never;
        Insert: {
          actor_id?: string | null;
          balance_after: number;
          created_at?: string;
          delta: number;
          id?: never;
          idempotency_key: string;
          kind: Database['public']['Enums']['stamp_tx_kind'];
          label: string;
          order_id?: string | null;
          user_coupon_id?: string | null;
          user_id?: string | null;
        };
        Update: {
          actor_id?: string | null;
          balance_after?: number;
          created_at?: string;
          delta?: number;
          id?: never;
          idempotency_key?: string;
          kind?: Database['public']['Enums']['stamp_tx_kind'];
          label?: string;
          order_id?: string | null;
          user_coupon_id?: string | null;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'stamp_transactions_actor_id_fkey';
            columns: ['actor_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'stamp_transactions_order_id_fkey';
            columns: ['order_id'];
            isOneToOne: false;
            referencedRelation: 'orders';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'stamp_transactions_user_coupon_id_fkey';
            columns: ['user_coupon_id'];
            isOneToOne: false;
            referencedRelation: 'user_coupon_view';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'stamp_transactions_user_coupon_id_fkey';
            columns: ['user_coupon_id'];
            isOneToOne: false;
            referencedRelation: 'user_coupons';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'stamp_transactions_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      store_settings: {
        Row: {
          address: string;
          daily_summary: boolean;
          description: string;
          id: number;
          is_accepting_orders: boolean;
          is_open: boolean;
          name: string;
          new_order_banner: boolean;
          new_order_sound: boolean;
          pending_payment_ttl_minutes: number;
          phone: string;
          sold_out_reminder: boolean;
          updated_at: string;
          updated_by: string | null;
        };
        ComputedFields: never;
        Insert: {
          address?: string;
          daily_summary?: boolean;
          description?: string;
          id?: number;
          is_accepting_orders?: boolean;
          is_open?: boolean;
          name: string;
          new_order_banner?: boolean;
          new_order_sound?: boolean;
          pending_payment_ttl_minutes?: number;
          phone?: string;
          sold_out_reminder?: boolean;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          address?: string;
          daily_summary?: boolean;
          description?: string;
          id?: number;
          is_accepting_orders?: boolean;
          is_open?: boolean;
          name?: string;
          new_order_banner?: boolean;
          new_order_sound?: boolean;
          pending_payment_ttl_minutes?: number;
          phone?: string;
          sold_out_reminder?: boolean;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'store_settings_updated_by_fkey';
            columns: ['updated_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      user_coupons: {
        Row: {
          benefit_type_snapshot: Database['public']['Enums']['coupon_benefit_type'];
          coupon_id: string;
          discount_amount_snapshot: number | null;
          eligible_category_ids_snapshot: string[];
          eligible_menu_item_ids_snapshot: string[];
          expires_at: string;
          id: string;
          idempotency_key: string;
          issued_at: string;
          redeem_transaction_id: number | null;
          reserved_order_id: string | null;
          status: Database['public']['Enums']['user_coupon_status'];
          title_snapshot: string;
          used_at: string | null;
          used_order_id: string | null;
          user_id: string | null;
        };
        ComputedFields: never;
        Insert: {
          benefit_type_snapshot: Database['public']['Enums']['coupon_benefit_type'];
          coupon_id: string;
          discount_amount_snapshot?: number | null;
          eligible_category_ids_snapshot?: string[];
          eligible_menu_item_ids_snapshot?: string[];
          expires_at: string;
          id?: string;
          idempotency_key: string;
          issued_at?: string;
          redeem_transaction_id?: number | null;
          reserved_order_id?: string | null;
          status?: Database['public']['Enums']['user_coupon_status'];
          title_snapshot: string;
          used_at?: string | null;
          used_order_id?: string | null;
          user_id?: string | null;
        };
        Update: {
          benefit_type_snapshot?: Database['public']['Enums']['coupon_benefit_type'];
          coupon_id?: string;
          discount_amount_snapshot?: number | null;
          eligible_category_ids_snapshot?: string[];
          eligible_menu_item_ids_snapshot?: string[];
          expires_at?: string;
          id?: string;
          idempotency_key?: string;
          issued_at?: string;
          redeem_transaction_id?: number | null;
          reserved_order_id?: string | null;
          status?: Database['public']['Enums']['user_coupon_status'];
          title_snapshot?: string;
          used_at?: string | null;
          used_order_id?: string | null;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'user_coupons_coupon_id_fkey';
            columns: ['coupon_id'];
            isOneToOne: false;
            referencedRelation: 'coupons';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'user_coupons_redeem_tx_fkey';
            columns: ['redeem_transaction_id'];
            isOneToOne: false;
            referencedRelation: 'stamp_transactions';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'user_coupons_reserved_order_fkey';
            columns: ['reserved_order_id'];
            isOneToOne: false;
            referencedRelation: 'orders';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'user_coupons_used_order_fkey';
            columns: ['used_order_id'];
            isOneToOne: false;
            referencedRelation: 'orders';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'user_coupons_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: {
      user_coupon_view: {
        Row: {
          benefit_type_snapshot: Database['public']['Enums']['coupon_benefit_type'];
          coupon_id: string;
          discount_amount_snapshot: number | null;
          display_status: Database['public']['Enums']['user_coupon_status'] | null;
          eligible_category_ids_snapshot: string[];
          eligible_menu_item_ids_snapshot: string[];
          expires_at: string;
          id: string;
          issued_at: string;
          title_snapshot: string;
          used_at: string | null;
          user_id: string | null;
        };
        ComputedFields: never;
        Insert: {
          benefit_type_snapshot?: Database['public']['Enums']['coupon_benefit_type'] | null;
          coupon_id?: string | null;
          discount_amount_snapshot?: number | null;
          display_status?: never;
          eligible_category_ids_snapshot?: string[] | null;
          eligible_menu_item_ids_snapshot?: string[] | null;
          expires_at?: string | null;
          id?: string | null;
          issued_at?: string | null;
          title_snapshot?: string | null;
          used_at?: string | null;
          user_id?: string | null;
        };
        Update: {
          benefit_type_snapshot?: Database['public']['Enums']['coupon_benefit_type'] | null;
          coupon_id?: string | null;
          discount_amount_snapshot?: number | null;
          display_status?: never;
          eligible_category_ids_snapshot?: string[] | null;
          eligible_menu_item_ids_snapshot?: string[] | null;
          expires_at?: string | null;
          id?: string | null;
          issued_at?: string | null;
          title_snapshot?: string | null;
          used_at?: string | null;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'user_coupons_coupon_id_fkey';
            columns: ['coupon_id'];
            isOneToOne: false;
            referencedRelation: 'coupons';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'user_coupons_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Functions: {
      admin_create_staff_record: {
        Args: {
          p_actor_id: string;
          p_display_name: string;
          p_permissions: Database['public']['Enums']['staff_permission'][];
          p_role: Database['public']['Enums']['staff_role'];
          p_user_id: string;
        };
        Returns: {
          created_at: string;
          display_name: string;
          invited_by: string | null;
          is_active: boolean;
          permissions: Database['public']['Enums']['staff_permission'][];
          role: Database['public']['Enums']['staff_role'];
          updated_at: string;
          user_id: string;
        };
        SetofOptions: {
          from: '*';
          to: 'staff_members';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      admin_get_member: { Args: { p_member_id: string }; Returns: Json };
      admin_issue_point_codes: {
        Args: { p_amount: number; p_expires_on: string; p_memo?: string; p_quantity: number };
        Returns: Json;
      };
      admin_list_members: {
        Args: { p_limit?: number; p_offset?: number; p_search?: string };
        Returns: Json;
      };
      admin_list_point_codes: {
        Args: { p_limit?: number; p_offset?: number; p_search?: string; p_status?: string };
        Returns: Json;
      };
      admin_list_staff: {
        Args: Record<PropertyKey, never>;
        Returns: {
          created_at: string;
          display_name: string;
          email: string;
          is_active: boolean;
          permissions: Database['public']['Enums']['staff_permission'][];
          role: Database['public']['Enums']['staff_role'];
          user_id: string;
        }[];
      };
      admin_popular_items: {
        Args: { p_from: string; p_limit?: number; p_to: string };
        Returns: Json;
      };
      admin_reorder_categories: { Args: { p_ids: string[] }; Returns: number };
      admin_sales_summary: { Args: { p_from: string; p_to: string }; Returns: Json };
      admin_set_stamp_policy: {
        Args: {
          p_amount_per_stamp?: number;
          p_earn_basis?: string;
          p_earn_mode: Database['public']['Enums']['stamp_earn_mode'];
          p_stamps_per_order?: number;
        };
        Returns: Json;
      };
      admin_stamp_overview: { Args: Record<PropertyKey, never>; Returns: Json };
      admin_update_staff: {
        Args: {
          p_display_name: string;
          p_is_active: boolean;
          p_permissions: Database['public']['Enums']['staff_permission'][];
          p_role: Database['public']['Enums']['staff_role'];
          p_user_id: string;
        };
        Returns: {
          created_at: string;
          display_name: string;
          invited_by: string | null;
          is_active: boolean;
          permissions: Database['public']['Enums']['staff_permission'][];
          role: Database['public']['Enums']['staff_role'];
          updated_at: string;
          user_id: string;
        };
        SetofOptions: {
          from: '*';
          to: 'staff_members';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      admin_void_point_code: { Args: { p_code_id: string }; Returns: Json };
      apply_payment_result: {
        Args: {
          p_amount: number;
          p_event_id: string;
          p_failure_code?: string;
          p_outcome: string;
          p_payload?: Json;
          p_payment_id: string;
          p_provider_payment_id: string;
          p_source: string;
        };
        Returns: Json;
      };
      create_checkout_order: {
        Args: {
          p_client_request_id: string;
          p_lines: Json;
          p_note: string;
          p_order_type: Database['public']['Enums']['order_type'];
          p_payment_method: Database['public']['Enums']['payment_method'];
          p_points_to_use: number;
          p_user_coupon_id: string;
        };
        Returns: Json;
      };
      customer_cancel_order: {
        Args: {
          p_expected_status: Database['public']['Enums']['order_status'];
          p_order_id: string;
        };
        Returns: Json;
      };
      delete_account: { Args: { p_user_id: string }; Returns: Json };
      expire_stale_orders: { Args: Record<PropertyKey, never>; Returns: number };
      get_my_point_summary: { Args: Record<PropertyKey, never>; Returns: Json };
      get_my_reward_summary: { Args: Record<PropertyKey, never>; Returns: Json };
      get_my_staff_role: {
        Args: Record<PropertyKey, never>;
        Returns: {
          is_active: boolean;
          permissions: Database['public']['Enums']['staff_permission'][];
          role: Database['public']['Enums']['staff_role'];
        }[];
      };
      mark_notifications_read: { Args: { p_ids?: string[] }; Returns: Json };
      quote_checkout: {
        Args: { p_lines: Json; p_points_to_use?: number; p_user_coupon_id?: string };
        Returns: Json;
      };
      record_refund_result: {
        Args: {
          p_message: string;
          p_provider_refund_id: string;
          p_refund_id: string;
          p_succeeded: boolean;
        };
        Returns: Json;
      };
      redeem_stamps_for_coupon: {
        Args: { p_client_request_id: string; p_coupon_id: string };
        Returns: Json;
      };
      register_coupon_point_code: { Args: { p_code: string }; Returns: Json };
      set_menu_item_sold_out: {
        Args: { p_is_sold_out: boolean; p_menu_item_id: string };
        Returns: {
          id: string;
          is_sold_out: boolean;
        }[];
      };
      set_store_status: {
        Args: { p_is_accepting_orders?: boolean; p_is_open?: boolean };
        Returns: {
          address: string;
          daily_summary: boolean;
          description: string;
          id: number;
          is_accepting_orders: boolean;
          is_open: boolean;
          name: string;
          new_order_banner: boolean;
          new_order_sound: boolean;
          pending_payment_ttl_minutes: number;
          phone: string;
          sold_out_reminder: boolean;
          updated_at: string;
          updated_by: string | null;
        };
        SetofOptions: {
          from: '*';
          to: 'store_settings';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      staff_cancel_order: {
        Args: {
          p_expected_status: Database['public']['Enums']['order_status'];
          p_order_id: string;
          p_reason: string;
        };
        Returns: Json;
      };
      staff_transition_order: {
        Args: {
          p_action: string;
          p_expected_status: Database['public']['Enums']['order_status'];
          p_order_id: string;
          p_reason?: string;
          p_reason_code?: string;
        };
        Returns: Json;
      };
      test_pg_create: { Args: { p_amount: number; p_payment_id: string }; Returns: Json };
      test_pg_force_expire: { Args: { p_payment_id: string }; Returns: boolean };
      test_pg_get: { Args: { p_payment_id: string }; Returns: Json };
      test_pg_refund: {
        Args: { p_amount: number; p_idempotency_key: string; p_provider_payment_id: string };
        Returns: Json;
      };
      test_pg_set: {
        Args: {
          p_approved_amount?: number;
          p_payment_id: string;
          p_refund_failures?: number;
          p_scenario?: string;
          p_status: string;
        };
        Returns: Json;
      };
    };
    Enums: {
      actor_role: 'CUSTOMER' | 'STAFF' | 'ADMIN' | 'SYSTEM';
      announcement_status: 'PUBLISHED' | 'UNPUBLISHED';
      coupon_benefit_type: 'FIXED_AMOUNT' | 'FREE_ITEM';
      notification_kind: 'ORDER' | 'PAYMENT' | 'STAMP' | 'COUPON' | 'POINT' | 'NOTICE';
      order_status:
        | 'PENDING_PAYMENT'
        | 'PAID'
        | 'ACCEPTED'
        | 'PREPARING'
        | 'READY'
        | 'COMPLETED'
        | 'REJECTED'
        | 'CANCELLED';
      order_type: 'DINE_IN' | 'TAKEOUT';
      payment_method: 'KAKAO_PAY' | 'NAVER_PAY' | 'TOSS_PAY' | 'CARD' | 'NONE';
      payment_status: 'READY' | 'PAID' | 'FAILED' | 'CANCELLED' | 'PARTIAL_REFUNDED' | 'REFUNDED';
      point_code_status: 'UNUSED' | 'REGISTERED' | 'EXPIRED' | 'VOID';
      point_hold_status: 'HELD' | 'CAPTURED' | 'RELEASED';
      point_tx_kind: 'REGISTER' | 'USE' | 'REFUND_RESTORE' | 'EXPIRE' | 'FORFEIT' | 'ADJUST';
      refund_status: 'REQUESTED' | 'SUCCEEDED' | 'FAILED';
      staff_permission: 'PROCESS_ORDERS' | 'MANAGE_OPERATIONS';
      staff_role: 'ADMIN' | 'STAFF';
      stamp_earn_mode: 'PER_ORDER' | 'PER_AMOUNT';
      stamp_earn_timing: 'PAID' | 'ACCEPTED' | 'COMPLETED';
      stamp_tx_kind:
        'EARN' | 'REDEEM' | 'EARN_REVERSAL' | 'REDEEM_RESTORE' | 'EXPIRE' | 'FORFEIT' | 'ADJUST';
      temperature: 'HOT' | 'ICE';
      user_coupon_status: 'AVAILABLE' | 'RESERVED' | 'USED' | 'EXPIRED' | 'VOID';
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema['Enums'] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema['CompositeTypes'] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      actor_role: ['CUSTOMER', 'STAFF', 'ADMIN', 'SYSTEM'],
      announcement_status: ['PUBLISHED', 'UNPUBLISHED'],
      coupon_benefit_type: ['FIXED_AMOUNT', 'FREE_ITEM'],
      notification_kind: ['ORDER', 'PAYMENT', 'STAMP', 'COUPON', 'POINT', 'NOTICE'],
      order_status: [
        'PENDING_PAYMENT',
        'PAID',
        'ACCEPTED',
        'PREPARING',
        'READY',
        'COMPLETED',
        'REJECTED',
        'CANCELLED',
      ],
      order_type: ['DINE_IN', 'TAKEOUT'],
      payment_method: ['KAKAO_PAY', 'NAVER_PAY', 'TOSS_PAY', 'CARD', 'NONE'],
      payment_status: ['READY', 'PAID', 'FAILED', 'CANCELLED', 'PARTIAL_REFUNDED', 'REFUNDED'],
      point_code_status: ['UNUSED', 'REGISTERED', 'EXPIRED', 'VOID'],
      point_hold_status: ['HELD', 'CAPTURED', 'RELEASED'],
      point_tx_kind: ['REGISTER', 'USE', 'REFUND_RESTORE', 'EXPIRE', 'FORFEIT', 'ADJUST'],
      refund_status: ['REQUESTED', 'SUCCEEDED', 'FAILED'],
      staff_permission: ['PROCESS_ORDERS', 'MANAGE_OPERATIONS'],
      staff_role: ['ADMIN', 'STAFF'],
      stamp_earn_mode: ['PER_ORDER', 'PER_AMOUNT'],
      stamp_earn_timing: ['PAID', 'ACCEPTED', 'COMPLETED'],
      stamp_tx_kind: [
        'EARN',
        'REDEEM',
        'EARN_REVERSAL',
        'REDEEM_RESTORE',
        'EXPIRE',
        'FORFEIT',
        'ADJUST',
      ],
      temperature: ['HOT', 'ICE'],
      user_coupon_status: ['AVAILABLE', 'RESERVED', 'USED', 'EXPIRED', 'VOID'],
    },
  },
} as const;
