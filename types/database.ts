/**
 * Hand-written to match supabase/migrations/*.sql so the app is type-safe
 * before the project is linked.
 *
 * Once `supabase link` is done, replace this file wholesale:
 *   npm run types
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type WorkspaceType = "personal" | "team";

export type MemberRole = "owner" | "admin" | "member";

/** Private notes are visible only to their author; public ones to the workspace. */
export type NoteVisibility = "private" | "public";

export type ContactStatus =
  | "added"
  | "reached_out"
  | "responded"
  | "chat_booked"
  | "chat_completed"
  | "follow_up_needed"
  | "no_response"
  | "not_interested";

export type InteractionType =
  | "reached_out"
  | "follow_up_sent"
  | "replied"
  | "chat_booked"
  | "chat_completed"
  | "marked_follow_up"
  | "marked_no_response"
  | "marked_not_interested"
  | "note_added"
  | "ownership_changed";

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          full_name: string | null;
          email: string | null;
          avatar_url: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          full_name?: string | null;
          email?: string | null;
          avatar_url?: string | null;
          created_at?: string;
        };
        Update: {
          full_name?: string | null;
          email?: string | null;
          avatar_url?: string | null;
        };
        Relationships: [];
      };
      workspaces: {
        Row: {
          id: string;
          name: string;
          type: WorkspaceType;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          type?: WorkspaceType;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          name?: string;
          type?: WorkspaceType;
        };
        Relationships: [];
      };
      memberships: {
        Row: {
          id: string;
          user_id: string;
          workspace_id: string;
          role: MemberRole;
          joined_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          workspace_id: string;
          role?: MemberRole;
          joined_at?: string;
        };
        Update: {
          role?: MemberRole;
        };
        Relationships: [];
      };
      invites: {
        Row: {
          id: string;
          workspace_id: string;
          code: string;
          created_by: string | null;
          role_granted: MemberRole;
          expires_at: string;
          max_uses: number;
          uses_count: number;
          revoked_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          code?: string;
          created_by?: string | null;
          role_granted?: MemberRole;
          expires_at?: string;
          max_uses?: number;
          uses_count?: number;
          revoked_at?: string | null;
          created_at?: string;
        };
        Update: {
          revoked_at?: string | null;
          max_uses?: number;
        };
        Relationships: [];
      };
      contacts: {
        Row: {
          id: string;
          workspace_id: string;
          name: string;
          linkedin_url: string | null;
          linkedin_url_normalized: string | null;
          email: string | null;
          email_normalized: string | null;
          company: string | null;
          title: string | null;
          notes: string | null;
          status: ContactStatus;
          is_important: boolean;
          is_flagged: boolean;
          owner_id: string | null;
          created_by: string;
          last_activity_at: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          name: string;
          linkedin_url?: string | null;
          linkedin_url_normalized?: string | null;
          email?: string | null;
          email_normalized?: string | null;
          company?: string | null;
          title?: string | null;
          notes?: string | null;
          status?: ContactStatus;
          is_important?: boolean;
          is_flagged?: boolean;
          owner_id?: string | null;
          created_by: string;
          last_activity_at?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          name?: string;
          linkedin_url?: string | null;
          linkedin_url_normalized?: string | null;
          email?: string | null;
          email_normalized?: string | null;
          company?: string | null;
          title?: string | null;
          notes?: string | null;
          status?: ContactStatus;
          is_important?: boolean;
          is_flagged?: boolean;
          owner_id?: string | null;
        };
        Relationships: [];
      };
      interactions: {
        Row: {
          id: string;
          contact_id: string;
          workspace_id: string;
          user_id: string;
          type: InteractionType;
          note: string | null;
          occurred_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          contact_id: string;
          workspace_id: string;
          user_id: string;
          type: InteractionType;
          note?: string | null;
          occurred_at?: string;
          created_at?: string;
        };
        Update: never;
        Relationships: [];
      };
      notes: {
        Row: {
          id: string;
          workspace_id: string;
          author_id: string;
          body: string;
          visibility: NoteVisibility;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          author_id: string;
          body: string;
          visibility?: NoteVisibility;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          body?: string;
          visibility?: NoteVisibility;
        };
        Relationships: [];
      };
    };
    Views: Record<never, never>;
    Functions: {
      is_member_of: { Args: { ws: string }; Returns: boolean };
      shares_workspace_with: { Args: { other: string }; Returns: boolean };
      has_workspace_role: {
        Args: { ws: string; roles: MemberRole[] };
        Returns: boolean;
      };
      create_team_workspace: {
        Args: { workspace_name: string };
        Returns: string;
      };
      redeem_invite: { Args: { invite_code: string }; Returns: string };
      workspace_context: {
        Args: Record<string, never>;
        Returns: {
          user_id: string;
          workspace_id: string;
          name: string;
          type: WorkspaceType;
          created_by: string | null;
          created_at: string;
          role: MemberRole;
          member_count: number;
        }[];
      };
      remove_workspace_member: {
        Args: { p_workspace_id: string; p_user_id: string };
        Returns: number;
      };
      preview_invite: {
        Args: { invite_code: string };
        Returns: { workspace_name: string | null; invite_status: string }[];
      };
      create_contact: {
        Args: {
          p_workspace_id: string;
          p_name: string;
          p_linkedin_url: string | null;
          p_linkedin_url_normalized: string | null;
          p_email: string | null;
          p_email_normalized: string | null;
          p_company: string | null;
          p_title: string | null;
          p_notes: string | null;
          p_mark_reached_out: boolean;
        };
        Returns: string;
      };
      update_contact: {
        Args: {
          p_contact_id: string;
          p_name: string;
          p_linkedin_url: string | null;
          p_linkedin_url_normalized: string | null;
          p_email: string | null;
          p_email_normalized: string | null;
          p_company: string | null;
          p_title: string | null;
          p_notes: string | null;
        };
        Returns: undefined;
      };
      advance_contact_status: {
        Args: {
          p_contact_id: string;
          p_status: ContactStatus;
          p_note: string | null;
        };
        Returns: undefined;
      };
      log_contact_note: {
        Args: { p_contact_id: string; p_note: string };
        Returns: undefined;
      };
      take_contact_ownership: {
        Args: { p_contact_id: string };
        Returns: undefined;
      };
    };
    Enums: {
      workspace_type: WorkspaceType;
      member_role: MemberRole;
      contact_status: ContactStatus;
      interaction_type: InteractionType;
      note_visibility: NoteVisibility;
    };
    CompositeTypes: Record<never, never>;
  };
}

export type ContactRow = Database["public"]["Tables"]["contacts"]["Row"];
export type InteractionRow = Database["public"]["Tables"]["interactions"]["Row"];
export type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
export type WorkspaceRow = Database["public"]["Tables"]["workspaces"]["Row"];
