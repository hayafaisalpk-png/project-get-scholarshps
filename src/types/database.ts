export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      academic_fields: {
        Row: {
          archived_at: string | null
          created_at: string
          description: string | null
          id: string
          intro_content: string | null
          name: string
          parent_group: string | null
          seo_description: string | null
          seo_title: string | null
          slug: string
          sort_order: number
          status: Database["public"]["Enums"]["taxonomy_status"]
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          description?: string | null
          id?: string
          intro_content?: string | null
          name: string
          parent_group?: string | null
          seo_description?: string | null
          seo_title?: string | null
          slug: string
          sort_order?: number
          status?: Database["public"]["Enums"]["taxonomy_status"]
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          description?: string | null
          id?: string
          intro_content?: string | null
          name?: string
          parent_group?: string | null
          seo_description?: string | null
          seo_title?: string | null
          slug?: string
          sort_order?: number
          status?: Database["public"]["Enums"]["taxonomy_status"]
          updated_at?: string
        }
        Relationships: []
      }
      ad_placements: {
        Row: {
          created_at: string
          description: string | null
          display_name: string
          id: string
          is_enabled: boolean
          key: string
          min_content_blocks: number
          sort_order: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          display_name: string
          id?: string
          is_enabled?: boolean
          key: string
          min_content_blocks?: number
          sort_order?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          display_name?: string
          id?: string
          is_enabled?: boolean
          key?: string
          min_content_blocks?: number
          sort_order?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      article_categories: {
        Row: {
          archived_at: string | null
          created_at: string
          description: string | null
          id: string
          name: string
          seo_description: string | null
          seo_title: string | null
          slug: string
          sort_order: number
          status: Database["public"]["Enums"]["taxonomy_status"]
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name: string
          seo_description?: string | null
          seo_title?: string | null
          slug: string
          sort_order?: number
          status?: Database["public"]["Enums"]["taxonomy_status"]
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          seo_description?: string | null
          seo_title?: string | null
          slug?: string
          sort_order?: number
          status?: Database["public"]["Enums"]["taxonomy_status"]
          updated_at?: string
        }
        Relationships: []
      }
      article_category_links: {
        Row: {
          article_category_id: string
          article_id: string
        }
        Insert: {
          article_category_id: string
          article_id: string
        }
        Update: {
          article_category_id?: string
          article_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "article_category_links_article_category_id_fkey"
            columns: ["article_category_id"]
            isOneToOne: false
            referencedRelation: "article_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "article_category_links_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "articles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "article_category_links_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "published_articles"
            referencedColumns: ["id"]
          },
        ]
      }
      article_reviews: {
        Row: {
          article_id: string
          created_at: string
          decision: Database["public"]["Enums"]["review_decision"]
          id: string
          notes: string | null
          reviewer_id: string | null
        }
        Insert: {
          article_id: string
          created_at?: string
          decision: Database["public"]["Enums"]["review_decision"]
          id?: string
          notes?: string | null
          reviewer_id?: string | null
        }
        Update: {
          article_id?: string
          created_at?: string
          decision?: Database["public"]["Enums"]["review_decision"]
          id?: string
          notes?: string | null
          reviewer_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "article_reviews_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "articles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "article_reviews_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "published_articles"
            referencedColumns: ["id"]
          },
        ]
      }
      article_revisions: {
        Row: {
          article_id: string
          change_note: string | null
          changed_by: string | null
          content: string
          content_plain: string
          created_at: string
          excerpt: string | null
          id: string
          revision_number: number
          title: string
        }
        Insert: {
          article_id: string
          change_note?: string | null
          changed_by?: string | null
          content?: string
          content_plain?: string
          created_at?: string
          excerpt?: string | null
          id?: string
          revision_number: number
          title: string
        }
        Update: {
          article_id?: string
          change_note?: string | null
          changed_by?: string | null
          content?: string
          content_plain?: string
          created_at?: string
          excerpt?: string | null
          id?: string
          revision_number?: number
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "article_revisions_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "articles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "article_revisions_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "published_articles"
            referencedColumns: ["id"]
          },
        ]
      }
      article_scholarships: {
        Row: {
          article_id: string
          scholarship_id: string
          sort_order: number
        }
        Insert: {
          article_id: string
          scholarship_id: string
          sort_order?: number
        }
        Update: {
          article_id?: string
          scholarship_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "article_scholarships_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "articles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "article_scholarships_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "published_articles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "article_scholarships_scholarship_id_fkey"
            columns: ["scholarship_id"]
            isOneToOne: false
            referencedRelation: "published_scholarships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "article_scholarships_scholarship_id_fkey"
            columns: ["scholarship_id"]
            isOneToOne: false
            referencedRelation: "scholarships"
            referencedColumns: ["id"]
          },
        ]
      }
      article_tag_links: {
        Row: {
          article_id: string
          tag_id: string
        }
        Insert: {
          article_id: string
          tag_id: string
        }
        Update: {
          article_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "article_tag_links_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "articles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "article_tag_links_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "published_articles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "article_tag_links_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "article_tags"
            referencedColumns: ["id"]
          },
        ]
      }
      article_tags: {
        Row: {
          archived_at: string | null
          created_at: string
          id: string
          name: string
          slug: string
          status: Database["public"]["Enums"]["taxonomy_status"]
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          id?: string
          name: string
          slug: string
          status?: Database["public"]["Enums"]["taxonomy_status"]
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          id?: string
          name?: string
          slug?: string
          status?: Database["public"]["Enums"]["taxonomy_status"]
          updated_at?: string
        }
        Relationships: []
      }
      articles: {
        Row: {
          allow_sitemap: boolean
          archived_at: string | null
          author_id: string | null
          canonical_url: string | null
          content: string
          content_plain: string
          created_at: string
          created_by: string | null
          editor_id: string | null
          excerpt: string | null
          faq_items: Json
          featured_image_id: string | null
          id: string
          noindex: boolean
          published_at: string | null
          reading_time_minutes: number
          reviewed_at: string | null
          scheduled_for: string | null
          search_vector: unknown
          seo_description: string | null
          seo_title: string | null
          slug: string
          social_image_id: string | null
          status: Database["public"]["Enums"]["article_status"]
          title: string
          updated_at: string
          updated_by: string | null
          word_count: number
        }
        Insert: {
          allow_sitemap?: boolean
          archived_at?: string | null
          author_id?: string | null
          canonical_url?: string | null
          content?: string
          content_plain?: string
          created_at?: string
          created_by?: string | null
          editor_id?: string | null
          excerpt?: string | null
          faq_items?: Json
          featured_image_id?: string | null
          id?: string
          noindex?: boolean
          published_at?: string | null
          reading_time_minutes?: number
          reviewed_at?: string | null
          scheduled_for?: string | null
          search_vector?: unknown
          seo_description?: string | null
          seo_title?: string | null
          slug: string
          social_image_id?: string | null
          status?: Database["public"]["Enums"]["article_status"]
          title: string
          updated_at?: string
          updated_by?: string | null
          word_count?: number
        }
        Update: {
          allow_sitemap?: boolean
          archived_at?: string | null
          author_id?: string | null
          canonical_url?: string | null
          content?: string
          content_plain?: string
          created_at?: string
          created_by?: string | null
          editor_id?: string | null
          excerpt?: string | null
          faq_items?: Json
          featured_image_id?: string | null
          id?: string
          noindex?: boolean
          published_at?: string | null
          reading_time_minutes?: number
          reviewed_at?: string | null
          scheduled_for?: string | null
          search_vector?: unknown
          seo_description?: string | null
          seo_title?: string | null
          slug?: string
          social_image_id?: string | null
          status?: Database["public"]["Enums"]["article_status"]
          title?: string
          updated_at?: string
          updated_by?: string | null
          word_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "articles_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "authors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "articles_featured_image_id_fkey"
            columns: ["featured_image_id"]
            isOneToOne: false
            referencedRelation: "media_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "articles_social_image_id_fkey"
            columns: ["social_image_id"]
            isOneToOne: false
            referencedRelation: "media_assets"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_email: string | null
          actor_id: string | null
          after: Json | null
          before: Json | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: number
          ip_address: unknown
          user_agent: string | null
        }
        Insert: {
          action: string
          actor_email?: string | null
          actor_id?: string | null
          after?: Json | null
          before?: Json | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: never
          ip_address?: unknown
          user_agent?: string | null
        }
        Update: {
          action?: string
          actor_email?: string | null
          actor_id?: string | null
          after?: Json | null
          before?: Json | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: never
          ip_address?: unknown
          user_agent?: string | null
        }
        Relationships: []
      }
      authors: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string
          full_name: string
          id: string
          is_active: boolean
          slug: string
          title: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          full_name: string
          id?: string
          is_active?: boolean
          slug: string
          title?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          full_name?: string
          id?: string
          is_active?: boolean
          slug?: string
          title?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      categories: {
        Row: {
          archived_at: string | null
          created_at: string
          description: string | null
          icon: string | null
          id: string
          intro_content: string | null
          name: string
          seo_description: string | null
          seo_title: string | null
          slug: string
          sort_order: number
          status: Database["public"]["Enums"]["taxonomy_status"]
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          intro_content?: string | null
          name: string
          seo_description?: string | null
          seo_title?: string | null
          slug: string
          sort_order?: number
          status?: Database["public"]["Enums"]["taxonomy_status"]
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          intro_content?: string | null
          name?: string
          seo_description?: string | null
          seo_title?: string | null
          slug?: string
          sort_order?: number
          status?: Database["public"]["Enums"]["taxonomy_status"]
          updated_at?: string
        }
        Relationships: []
      }
      consent_records: {
        Row: {
          ads: boolean
          analytics: boolean
          created_at: string
          functionality: boolean
          id: string
          source: Database["public"]["Enums"]["consent_source"]
          updated_at: string
          version: string
          visitor_id: string
        }
        Insert: {
          ads?: boolean
          analytics?: boolean
          created_at?: string
          functionality?: boolean
          id?: string
          source?: Database["public"]["Enums"]["consent_source"]
          updated_at?: string
          version?: string
          visitor_id: string
        }
        Update: {
          ads?: boolean
          analytics?: boolean
          created_at?: string
          functionality?: boolean
          id?: string
          source?: Database["public"]["Enums"]["consent_source"]
          updated_at?: string
          version?: string
          visitor_id?: string
        }
        Relationships: []
      }
      contact_submissions: {
        Row: {
          created_at: string
          email: string
          handled_at: string | null
          handled_by: string | null
          id: string
          message: string
          name: string
          read_at: string | null
          status: Database["public"]["Enums"]["contact_status"]
          subject: string
          updated_at: string
          whatsapp_no: string | null
        }
        Insert: {
          created_at?: string
          email: string
          handled_at?: string | null
          handled_by?: string | null
          id?: string
          message: string
          name: string
          read_at?: string | null
          status?: Database["public"]["Enums"]["contact_status"]
          subject: string
          updated_at?: string
          whatsapp_no?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          handled_at?: string | null
          handled_by?: string | null
          id?: string
          message?: string
          name?: string
          read_at?: string | null
          status?: Database["public"]["Enums"]["contact_status"]
          subject?: string
          updated_at?: string
          whatsapp_no?: string | null
        }
        Relationships: []
      }
      content_pages: {
        Row: {
          body: string
          canonical_url: string | null
          created_at: string
          excerpt: string | null
          id: string
          noindex: boolean
          seo_description: string | null
          seo_title: string | null
          slug: string
          sort_order: number
          status: Database["public"]["Enums"]["taxonomy_status"]
          title: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          body?: string
          canonical_url?: string | null
          created_at?: string
          excerpt?: string | null
          id?: string
          noindex?: boolean
          seo_description?: string | null
          seo_title?: string | null
          slug: string
          sort_order?: number
          status?: Database["public"]["Enums"]["taxonomy_status"]
          title: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          body?: string
          canonical_url?: string | null
          created_at?: string
          excerpt?: string | null
          id?: string
          noindex?: boolean
          seo_description?: string | null
          seo_title?: string | null
          slug?: string
          sort_order?: number
          status?: Database["public"]["Enums"]["taxonomy_status"]
          title?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      content_reports: {
        Row: {
          article_id: string | null
          created_at: string
          details: string | null
          id: string
          reason: Database["public"]["Enums"]["report_reason"]
          reporter_email: string | null
          resolution_note: string | null
          resolved_at: string | null
          resolved_by: string | null
          scholarship_id: string | null
          status: Database["public"]["Enums"]["report_status"]
          updated_at: string
        }
        Insert: {
          article_id?: string | null
          created_at?: string
          details?: string | null
          id?: string
          reason: Database["public"]["Enums"]["report_reason"]
          reporter_email?: string | null
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          scholarship_id?: string | null
          status?: Database["public"]["Enums"]["report_status"]
          updated_at?: string
        }
        Update: {
          article_id?: string | null
          created_at?: string
          details?: string | null
          id?: string
          reason?: Database["public"]["Enums"]["report_reason"]
          reporter_email?: string | null
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          scholarship_id?: string | null
          status?: Database["public"]["Enums"]["report_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_reports_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "articles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_reports_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "published_articles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_reports_scholarship_id_fkey"
            columns: ["scholarship_id"]
            isOneToOne: false
            referencedRelation: "published_scholarships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_reports_scholarship_id_fkey"
            columns: ["scholarship_id"]
            isOneToOne: false
            referencedRelation: "scholarships"
            referencedColumns: ["id"]
          },
        ]
      }
      education_levels: {
        Row: {
          archived_at: string | null
          created_at: string
          description: string | null
          id: string
          intro_content: string | null
          name: string
          rank: number
          seo_description: string | null
          seo_title: string | null
          slug: string
          sort_order: number
          status: Database["public"]["Enums"]["taxonomy_status"]
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          description?: string | null
          id?: string
          intro_content?: string | null
          name: string
          rank?: number
          seo_description?: string | null
          seo_title?: string | null
          slug: string
          sort_order?: number
          status?: Database["public"]["Enums"]["taxonomy_status"]
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          description?: string | null
          id?: string
          intro_content?: string | null
          name?: string
          rank?: number
          seo_description?: string | null
          seo_title?: string | null
          slug?: string
          sort_order?: number
          status?: Database["public"]["Enums"]["taxonomy_status"]
          updated_at?: string
        }
        Relationships: []
      }
      homepage_sections: {
        Row: {
          config: Json
          created_at: string
          heading: string | null
          id: string
          is_visible: boolean
          key: string
          sort_order: number
          subheading: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          config?: Json
          created_at?: string
          heading?: string | null
          id?: string
          is_visible?: boolean
          key: string
          sort_order?: number
          subheading?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          config?: Json
          created_at?: string
          heading?: string | null
          id?: string
          is_visible?: boolean
          key?: string
          sort_order?: number
          subheading?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      institutions: {
        Row: {
          country: string | null
          created_at: string
          description: string | null
          id: string
          institution_type: string
          is_verified: boolean
          logo_url: string | null
          name: string
          slug: string
          updated_at: string
          website_url: string | null
        }
        Insert: {
          country?: string | null
          created_at?: string
          description?: string | null
          id?: string
          institution_type?: string
          is_verified?: boolean
          logo_url?: string | null
          name: string
          slug: string
          updated_at?: string
          website_url?: string | null
        }
        Update: {
          country?: string | null
          created_at?: string
          description?: string | null
          id?: string
          institution_type?: string
          is_verified?: boolean
          logo_url?: string | null
          name?: string
          slug?: string
          updated_at?: string
          website_url?: string | null
        }
        Relationships: []
      }
      locations: {
        Row: {
          archived_at: string | null
          code: string | null
          created_at: string
          description: string | null
          id: string
          intro_content: string | null
          name: string
          parent_id: string | null
          seo_description: string | null
          seo_title: string | null
          slug: string
          sort_order: number
          status: Database["public"]["Enums"]["taxonomy_status"]
          type: Database["public"]["Enums"]["location_type"]
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          code?: string | null
          created_at?: string
          description?: string | null
          id?: string
          intro_content?: string | null
          name: string
          parent_id?: string | null
          seo_description?: string | null
          seo_title?: string | null
          slug: string
          sort_order?: number
          status?: Database["public"]["Enums"]["taxonomy_status"]
          type: Database["public"]["Enums"]["location_type"]
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          code?: string | null
          created_at?: string
          description?: string | null
          id?: string
          intro_content?: string | null
          name?: string
          parent_id?: string | null
          seo_description?: string | null
          seo_title?: string | null
          slug?: string
          sort_order?: number
          status?: Database["public"]["Enums"]["taxonomy_status"]
          type?: Database["public"]["Enums"]["location_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "locations_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      media_assets: {
        Row: {
          alt_text: string | null
          archived_at: string | null
          attribution: string | null
          caption: string | null
          created_at: string
          credit_url: string | null
          file_name: string
          file_size: number
          folder: string
          height: number | null
          id: string
          is_decorative: boolean
          is_public: boolean
          mime_type: string
          public_url: string | null
          storage_path: string
          updated_at: string
          uploaded_by: string | null
          width: number | null
        }
        Insert: {
          alt_text?: string | null
          archived_at?: string | null
          attribution?: string | null
          caption?: string | null
          created_at?: string
          credit_url?: string | null
          file_name: string
          file_size: number
          folder?: string
          height?: number | null
          id?: string
          is_decorative?: boolean
          is_public?: boolean
          mime_type: string
          public_url?: string | null
          storage_path: string
          updated_at?: string
          uploaded_by?: string | null
          width?: number | null
        }
        Update: {
          alt_text?: string | null
          archived_at?: string | null
          attribution?: string | null
          caption?: string | null
          created_at?: string
          credit_url?: string | null
          file_name?: string
          file_size?: number
          folder?: string
          height?: number | null
          id?: string
          is_decorative?: boolean
          is_public?: boolean
          mime_type?: string
          public_url?: string | null
          storage_path?: string
          updated_at?: string
          uploaded_by?: string | null
          width?: number | null
        }
        Relationships: []
      }
      navigation_items: {
        Row: {
          created_at: string
          description: string | null
          href: string
          id: string
          is_visible: boolean
          label: string
          location: Database["public"]["Enums"]["navigation_location"]
          opens_in_new_tab: boolean
          parent_id: string | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          href: string
          id?: string
          is_visible?: boolean
          label: string
          location?: Database["public"]["Enums"]["navigation_location"]
          opens_in_new_tab?: boolean
          parent_id?: string | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          href?: string
          id?: string
          is_visible?: boolean
          label?: string
          location?: Database["public"]["Enums"]["navigation_location"]
          opens_in_new_tab?: boolean
          parent_id?: string | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "navigation_items_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "navigation_items"
            referencedColumns: ["id"]
          },
        ]
      }
      newsletter_subscribers: {
        Row: {
          consent_given_at: string | null
          created_at: string
          email: string
          id: string
          ip_hash: string | null
          source: string | null
          status: Database["public"]["Enums"]["newsletter_status"]
          unsubscribed_at: string | null
          updated_at: string
        }
        Insert: {
          consent_given_at?: string | null
          created_at?: string
          email: string
          id?: string
          ip_hash?: string | null
          source?: string | null
          status?: Database["public"]["Enums"]["newsletter_status"]
          unsubscribed_at?: string | null
          updated_at?: string
        }
        Update: {
          consent_given_at?: string | null
          created_at?: string
          email?: string
          id?: string
          ip_hash?: string | null
          source?: string | null
          status?: Database["public"]["Enums"]["newsletter_status"]
          unsubscribed_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      permissions: {
        Row: {
          category: string
          created_at: string
          description: string | null
          id: string
          key: string
          updated_at: string
        }
        Insert: {
          category: string
          created_at?: string
          description?: string | null
          id?: string
          key: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          key?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          last_sign_in_at: string | null
          status: Database["public"]["Enums"]["user_status"]
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          last_sign_in_at?: string | null
          status?: Database["public"]["Enums"]["user_status"]
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          last_sign_in_at?: string | null
          status?: Database["public"]["Enums"]["user_status"]
          updated_at?: string
        }
        Relationships: []
      }
      redirects: {
        Row: {
          created_at: string
          created_by: string | null
          from_path: string
          hit_count: number
          is_active: boolean
          note: string | null
          status_code: number
          to_path: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          from_path: string
          hit_count?: number
          is_active?: boolean
          note?: string | null
          status_code?: number
          to_path: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          from_path?: string
          hit_count?: number
          is_active?: boolean
          note?: string | null
          status_code?: number
          to_path?: string
          updated_at?: string
        }
        Relationships: []
      }
      role_permissions: {
        Row: {
          permission_id: string
          role_id: string
        }
        Insert: {
          permission_id: string
          role_id: string
        }
        Update: {
          permission_id?: string
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_permissions_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_system: boolean
          key: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_system?: boolean
          key: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_system?: boolean
          key?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      scholarship_categories: {
        Row: {
          category_id: string
          scholarship_id: string
        }
        Insert: {
          category_id: string
          scholarship_id: string
        }
        Update: {
          category_id?: string
          scholarship_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "scholarship_categories_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scholarship_categories_scholarship_id_fkey"
            columns: ["scholarship_id"]
            isOneToOne: false
            referencedRelation: "published_scholarships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scholarship_categories_scholarship_id_fkey"
            columns: ["scholarship_id"]
            isOneToOne: false
            referencedRelation: "scholarships"
            referencedColumns: ["id"]
          },
        ]
      }
      scholarship_education_levels: {
        Row: {
          education_level_id: string
          scholarship_id: string
        }
        Insert: {
          education_level_id: string
          scholarship_id: string
        }
        Update: {
          education_level_id?: string
          scholarship_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "scholarship_education_levels_education_level_id_fkey"
            columns: ["education_level_id"]
            isOneToOne: false
            referencedRelation: "education_levels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scholarship_education_levels_scholarship_id_fkey"
            columns: ["scholarship_id"]
            isOneToOne: false
            referencedRelation: "published_scholarships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scholarship_education_levels_scholarship_id_fkey"
            columns: ["scholarship_id"]
            isOneToOne: false
            referencedRelation: "scholarships"
            referencedColumns: ["id"]
          },
        ]
      }
      scholarship_fields: {
        Row: {
          academic_field_id: string
          scholarship_id: string
        }
        Insert: {
          academic_field_id: string
          scholarship_id: string
        }
        Update: {
          academic_field_id?: string
          scholarship_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "scholarship_fields_academic_field_id_fkey"
            columns: ["academic_field_id"]
            isOneToOne: false
            referencedRelation: "academic_fields"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scholarship_fields_scholarship_id_fkey"
            columns: ["scholarship_id"]
            isOneToOne: false
            referencedRelation: "published_scholarships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scholarship_fields_scholarship_id_fkey"
            columns: ["scholarship_id"]
            isOneToOne: false
            referencedRelation: "scholarships"
            referencedColumns: ["id"]
          },
        ]
      }
      scholarship_locations: {
        Row: {
          location_id: string
          scholarship_id: string
        }
        Insert: {
          location_id: string
          scholarship_id: string
        }
        Update: {
          location_id?: string
          scholarship_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "scholarship_locations_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scholarship_locations_scholarship_id_fkey"
            columns: ["scholarship_id"]
            isOneToOne: false
            referencedRelation: "published_scholarships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scholarship_locations_scholarship_id_fkey"
            columns: ["scholarship_id"]
            isOneToOne: false
            referencedRelation: "scholarships"
            referencedColumns: ["id"]
          },
        ]
      }
      scholarship_sources: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          retrieved_at: string | null
          scholarship_id: string
          source_name: string
          source_url: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          retrieved_at?: string | null
          scholarship_id: string
          source_name: string
          source_url: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          retrieved_at?: string | null
          scholarship_id?: string
          source_name?: string
          source_url?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "scholarship_sources_scholarship_id_fkey"
            columns: ["scholarship_id"]
            isOneToOne: false
            referencedRelation: "published_scholarships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scholarship_sources_scholarship_id_fkey"
            columns: ["scholarship_id"]
            isOneToOne: false
            referencedRelation: "scholarships"
            referencedColumns: ["id"]
          },
        ]
      }
      scholarship_tags: {
        Row: {
          scholarship_id: string
          tag_id: string
        }
        Insert: {
          scholarship_id: string
          tag_id: string
        }
        Update: {
          scholarship_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "scholarship_tags_scholarship_id_fkey"
            columns: ["scholarship_id"]
            isOneToOne: false
            referencedRelation: "published_scholarships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scholarship_tags_scholarship_id_fkey"
            columns: ["scholarship_id"]
            isOneToOne: false
            referencedRelation: "scholarships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scholarship_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      scholarship_verification_logs: {
        Row: {
          checked_at: string
          checked_by: string | null
          created_at: string
          id: string
          new_deadline: string | null
          notes: string | null
          previous_deadline: string | null
          result: Database["public"]["Enums"]["verification_result"]
          scholarship_id: string
        }
        Insert: {
          checked_at?: string
          checked_by?: string | null
          created_at?: string
          id?: string
          new_deadline?: string | null
          notes?: string | null
          previous_deadline?: string | null
          result: Database["public"]["Enums"]["verification_result"]
          scholarship_id: string
        }
        Update: {
          checked_at?: string
          checked_by?: string | null
          created_at?: string
          id?: string
          new_deadline?: string | null
          notes?: string | null
          previous_deadline?: string | null
          result?: Database["public"]["Enums"]["verification_result"]
          scholarship_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "scholarship_verification_logs_scholarship_id_fkey"
            columns: ["scholarship_id"]
            isOneToOne: false
            referencedRelation: "published_scholarships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scholarship_verification_logs_scholarship_id_fkey"
            columns: ["scholarship_id"]
            isOneToOne: false
            referencedRelation: "scholarships"
            referencedColumns: ["id"]
          },
        ]
      }
      scholarships: {
        Row: {
          application_fee_cents: number
          application_instructions: string | null
          application_url: string | null
          archived_at: string | null
          award_amount_max_cents: number | null
          award_amount_min_cents: number | null
          award_amount_text: string | null
          award_currency: string
          award_per_year: boolean
          created_at: string
          created_by: string | null
          deadline: string | null
          description: string | null
          eligibility_requirements: string | null
          featured: boolean
          featured_until: string | null
          id: string
          image_id: string | null
          institution_id: string | null
          internal_notes: string | null
          is_renewable: boolean
          is_rolling: boolean
          last_reviewed_at: string | null
          max_renewals: number | null
          noindex: boolean
          number_of_awards: number | null
          opens_at: string | null
          published_at: string | null
          renewal_details: string | null
          required_documents: string | null
          search_vector: unknown
          seo_description: string | null
          seo_title: string | null
          slug: string
          sponsor_name: string
          status: Database["public"]["Enums"]["scholarship_status"]
          summary: string | null
          title: string
          updated_at: string
          updated_by: string | null
          verification_status: Database["public"]["Enums"]["verification_status"]
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          application_fee_cents?: number
          application_instructions?: string | null
          application_url?: string | null
          archived_at?: string | null
          award_amount_max_cents?: number | null
          award_amount_min_cents?: number | null
          award_amount_text?: string | null
          award_currency?: string
          award_per_year?: boolean
          created_at?: string
          created_by?: string | null
          deadline?: string | null
          description?: string | null
          eligibility_requirements?: string | null
          featured?: boolean
          featured_until?: string | null
          id?: string
          image_id?: string | null
          institution_id?: string | null
          internal_notes?: string | null
          is_renewable?: boolean
          is_rolling?: boolean
          last_reviewed_at?: string | null
          max_renewals?: number | null
          noindex?: boolean
          number_of_awards?: number | null
          opens_at?: string | null
          published_at?: string | null
          renewal_details?: string | null
          required_documents?: string | null
          search_vector?: unknown
          seo_description?: string | null
          seo_title?: string | null
          slug: string
          sponsor_name: string
          status?: Database["public"]["Enums"]["scholarship_status"]
          summary?: string | null
          title: string
          updated_at?: string
          updated_by?: string | null
          verification_status?: Database["public"]["Enums"]["verification_status"]
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          application_fee_cents?: number
          application_instructions?: string | null
          application_url?: string | null
          archived_at?: string | null
          award_amount_max_cents?: number | null
          award_amount_min_cents?: number | null
          award_amount_text?: string | null
          award_currency?: string
          award_per_year?: boolean
          created_at?: string
          created_by?: string | null
          deadline?: string | null
          description?: string | null
          eligibility_requirements?: string | null
          featured?: boolean
          featured_until?: string | null
          id?: string
          image_id?: string | null
          institution_id?: string | null
          internal_notes?: string | null
          is_renewable?: boolean
          is_rolling?: boolean
          last_reviewed_at?: string | null
          max_renewals?: number | null
          noindex?: boolean
          number_of_awards?: number | null
          opens_at?: string | null
          published_at?: string | null
          renewal_details?: string | null
          required_documents?: string | null
          search_vector?: unknown
          seo_description?: string | null
          seo_title?: string | null
          slug?: string
          sponsor_name?: string
          status?: Database["public"]["Enums"]["scholarship_status"]
          summary?: string | null
          title?: string
          updated_at?: string
          updated_by?: string | null
          verification_status?: Database["public"]["Enums"]["verification_status"]
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "scholarships_image_id_fkey"
            columns: ["image_id"]
            isOneToOne: false
            referencedRelation: "media_assets"
            referencedColumns: ["id"]
          },
        ]
      }
      site_settings: {
        Row: {
          created_at: string
          description: string | null
          group: string
          is_public: boolean
          key: string
          label: string | null
          updated_at: string
          updated_by: string | null
          value: Json | null
          value_type: Database["public"]["Enums"]["setting_value_type"]
        }
        Insert: {
          created_at?: string
          description?: string | null
          group?: string
          is_public?: boolean
          key: string
          label?: string | null
          updated_at?: string
          updated_by?: string | null
          value?: Json | null
          value_type?: Database["public"]["Enums"]["setting_value_type"]
        }
        Update: {
          created_at?: string
          description?: string | null
          group?: string
          is_public?: boolean
          key?: string
          label?: string | null
          updated_at?: string
          updated_by?: string | null
          value?: Json | null
          value_type?: Database["public"]["Enums"]["setting_value_type"]
        }
        Relationships: []
      }
      tags: {
        Row: {
          archived_at: string | null
          created_at: string
          description: string | null
          id: string
          name: string
          seo_description: string | null
          seo_title: string | null
          slug: string
          status: Database["public"]["Enums"]["taxonomy_status"]
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name: string
          seo_description?: string | null
          seo_title?: string | null
          slug: string
          status?: Database["public"]["Enums"]["taxonomy_status"]
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          seo_description?: string | null
          seo_title?: string | null
          slug?: string
          status?: Database["public"]["Enums"]["taxonomy_status"]
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          granted_at: string
          granted_by: string | null
          role_id: string
          user_id: string
        }
        Insert: {
          granted_at?: string
          granted_by?: string | null
          role_id: string
          user_id: string
        }
        Update: {
          granted_at?: string
          granted_by?: string | null
          role_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      published_articles: {
        Row: {
          author_id: string | null
          content: string | null
          excerpt: string | null
          faq_items: Json | null
          featured_image_id: string | null
          id: string | null
          published_at: string | null
          reading_time_minutes: number | null
          seo_description: string | null
          seo_title: string | null
          slug: string | null
          social_image_id: string | null
          title: string | null
          updated_at: string | null
          word_count: number | null
        }
        Insert: {
          author_id?: string | null
          content?: string | null
          excerpt?: string | null
          faq_items?: Json | null
          featured_image_id?: string | null
          id?: string | null
          published_at?: string | null
          reading_time_minutes?: number | null
          seo_description?: string | null
          seo_title?: string | null
          slug?: string | null
          social_image_id?: string | null
          title?: string | null
          updated_at?: string | null
          word_count?: number | null
        }
        Update: {
          author_id?: string | null
          content?: string | null
          excerpt?: string | null
          faq_items?: Json | null
          featured_image_id?: string | null
          id?: string | null
          published_at?: string | null
          reading_time_minutes?: number | null
          seo_description?: string | null
          seo_title?: string | null
          slug?: string | null
          social_image_id?: string | null
          title?: string | null
          updated_at?: string | null
          word_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "articles_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "authors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "articles_featured_image_id_fkey"
            columns: ["featured_image_id"]
            isOneToOne: false
            referencedRelation: "media_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "articles_social_image_id_fkey"
            columns: ["social_image_id"]
            isOneToOne: false
            referencedRelation: "media_assets"
            referencedColumns: ["id"]
          },
        ]
      }
      published_scholarship_sources: {
        Row: {
          id: string | null
          retrieved_at: string | null
          scholarship_id: string | null
          source_name: string | null
          source_url: string | null
        }
        Relationships: [
          {
            foreignKeyName: "scholarship_sources_scholarship_id_fkey"
            columns: ["scholarship_id"]
            isOneToOne: false
            referencedRelation: "published_scholarships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scholarship_sources_scholarship_id_fkey"
            columns: ["scholarship_id"]
            isOneToOne: false
            referencedRelation: "scholarships"
            referencedColumns: ["id"]
          },
        ]
      }
      published_scholarships: {
        Row: {
          application_fee_cents: number | null
          award_amount_max_cents: number | null
          award_amount_min_cents: number | null
          award_amount_text: string | null
          award_currency: string | null
          days_remaining: number | null
          deadline: string | null
          featured: boolean | null
          id: string | null
          image_id: string | null
          institution_id: string | null
          is_expired: boolean | null
          is_renewable: boolean | null
          is_rolling: boolean | null
          last_reviewed_at: string | null
          number_of_awards: number | null
          opens_at: string | null
          published_at: string | null
          search_vector: unknown
          slug: string | null
          sponsor_name: string | null
          status: Database["public"]["Enums"]["scholarship_status"] | null
          summary: string | null
          title: string | null
          updated_at: string | null
          verification_status:
            | Database["public"]["Enums"]["verification_status"]
            | null
          verified_at: string | null
        }
        Insert: {
          application_fee_cents?: number | null
          award_amount_max_cents?: number | null
          award_amount_min_cents?: number | null
          award_amount_text?: string | null
          award_currency?: string | null
          days_remaining?: never
          deadline?: string | null
          featured?: boolean | null
          id?: string | null
          image_id?: string | null
          institution_id?: string | null
          is_expired?: never
          is_renewable?: boolean | null
          is_rolling?: boolean | null
          last_reviewed_at?: string | null
          number_of_awards?: number | null
          opens_at?: string | null
          published_at?: string | null
          search_vector?: unknown
          slug?: string | null
          sponsor_name?: string | null
          status?: Database["public"]["Enums"]["scholarship_status"] | null
          summary?: string | null
          title?: string | null
          updated_at?: string | null
          verification_status?:
            | Database["public"]["Enums"]["verification_status"]
            | null
          verified_at?: string | null
        }
        Update: {
          application_fee_cents?: number | null
          award_amount_max_cents?: number | null
          award_amount_min_cents?: number | null
          award_amount_text?: string | null
          award_currency?: string | null
          days_remaining?: never
          deadline?: string | null
          featured?: boolean | null
          id?: string | null
          image_id?: string | null
          institution_id?: string | null
          is_expired?: never
          is_renewable?: boolean | null
          is_rolling?: boolean | null
          last_reviewed_at?: string | null
          number_of_awards?: number | null
          opens_at?: string | null
          published_at?: string | null
          search_vector?: unknown
          slug?: string | null
          sponsor_name?: string | null
          status?: Database["public"]["Enums"]["scholarship_status"] | null
          summary?: string | null
          title?: string | null
          updated_at?: string | null
          verification_status?:
            | Database["public"]["Enums"]["verification_status"]
            | null
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "scholarships_image_id_fkey"
            columns: ["image_id"]
            isOneToOne: false
            referencedRelation: "media_assets"
            referencedColumns: ["id"]
          },
        ]
      }
      user_role_summary: {
        Row: {
          created_at: string | null
          email: string | null
          full_name: string | null
          roles: string[] | null
          status: Database["public"]["Enums"]["user_status"] | null
          user_id: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      article_faq_items_valid: { Args: { p_items: Json }; Returns: boolean }
      article_is_public: {
        Args: {
          p_published_at: string
          p_status: Database["public"]["Enums"]["article_status"]
        }
        Returns: boolean
      }
      attach_updated_at_trigger: {
        Args: { p_table: string }
        Returns: undefined
      }
      can: {
        Args: { v_permission_key: string; v_role_keys: string[] }
        Returns: boolean
      }
      can_publish: { Args: never; Returns: boolean }
      current_user_role_keys: { Args: never; Returns: string[] }
      has_any_role: { Args: { v_role_keys: string[] }; Returns: boolean }
      has_permission: { Args: { v_permission_key: string }; Returns: boolean }
      has_role: { Args: { v_role_key: string }; Returns: boolean }
      is_article_author: { Args: { p_article_id: string }; Returns: boolean }
      is_cms_role: { Args: never; Returns: boolean }
      scholarship_days_remaining: {
        Args: { p_deadline: string }
        Returns: number
      }
      scholarship_is_expired: {
        Args: {
          p_deadline: string
          p_is_rolling: boolean
          p_status: Database["public"]["Enums"]["scholarship_status"]
        }
        Returns: boolean
      }
      scholarship_is_public: {
        Args: { p_status: Database["public"]["Enums"]["scholarship_status"] }
        Returns: boolean
      }
      search_scholarships: {
        Args: {
          p_categories?: string[]
          p_deadline?: string
          p_fields?: string[]
          p_free_application?: boolean
          p_international?: boolean
          p_levels?: string[]
          p_locations?: string[]
          p_max_amount_cents?: number
          p_min_amount_cents?: number
          p_page?: number
          p_page_size?: number
          p_q?: string
          p_renewable?: boolean
          p_sort?: string
          p_tags?: string[]
        }
        Returns: {
          application_fee_cents: number
          award_amount_max_cents: number
          award_amount_min_cents: number
          award_amount_text: string
          award_currency: string
          days_remaining: number
          deadline: string
          featured: boolean
          id: string
          is_expired: boolean
          is_renewable: boolean
          is_rolling: boolean
          last_reviewed_at: string
          number_of_awards: number
          published_at: string
          search_rank: number
          slug: string
          sponsor_name: string
          summary: string
          title: string
          total_count: number
          verification_status: Database["public"]["Enums"]["verification_status"]
          verified_at: string
        }[]
      }
      sitemap_taxonomy_terms: {
        Args: never
        Returns: {
          kind: string
          listings: number
          slug: string
        }[]
      }
      write_audit_log: {
        Args: {
          p_action: string
          p_after?: Json
          p_before?: Json
          p_entity_id?: string
          p_entity_type: string
        }
        Returns: number
      }
    }
    Enums: {
      article_status:
        | "draft"
        | "in_review"
        | "scheduled"
        | "published"
        | "archived"
      consent_source: "banner" | "settings"
      contact_status: "new" | "in_progress" | "resolved" | "spam"
      location_type: "country" | "state" | "region"
      navigation_location:
        | "header"
        | "footer_column_1"
        | "footer_column_2"
        | "footer_column_3"
        | "footer_column_4"
        | "legal"
      newsletter_status: "pending" | "subscribed" | "unsubscribed" | "bounced"
      report_reason:
        | "incorrect_deadline"
        | "incorrect_amount"
        | "not_eligible"
        | "no_longer_available"
        | "broken_link"
        | "duplicate"
        | "other"
      report_status: "open" | "reviewing" | "resolved" | "dismissed"
      review_decision: "approved" | "changes_requested" | "rejected"
      scholarship_status:
        | "draft"
        | "pending_review"
        | "published"
        | "expired"
        | "archived"
      setting_value_type:
        | "string"
        | "text"
        | "number"
        | "boolean"
        | "json"
        | "url"
        | "image"
      taxonomy_status: "active" | "inactive"
      user_status: "active" | "pending" | "suspended"
      verification_result:
        | "confirmed"
        | "updated"
        | "deadline_extended"
        | "disputed"
        | "unreachable"
      verification_status: "unverified" | "pending" | "verified" | "disputed"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      article_status: [
        "draft",
        "in_review",
        "scheduled",
        "published",
        "archived",
      ],
      consent_source: ["banner", "settings"],
      contact_status: ["new", "in_progress", "resolved", "spam"],
      location_type: ["country", "state", "region"],
      navigation_location: [
        "header",
        "footer_column_1",
        "footer_column_2",
        "footer_column_3",
        "footer_column_4",
        "legal",
      ],
      newsletter_status: ["pending", "subscribed", "unsubscribed", "bounced"],
      report_reason: [
        "incorrect_deadline",
        "incorrect_amount",
        "not_eligible",
        "no_longer_available",
        "broken_link",
        "duplicate",
        "other",
      ],
      report_status: ["open", "reviewing", "resolved", "dismissed"],
      review_decision: ["approved", "changes_requested", "rejected"],
      scholarship_status: [
        "draft",
        "pending_review",
        "published",
        "expired",
        "archived",
      ],
      setting_value_type: [
        "string",
        "text",
        "number",
        "boolean",
        "json",
        "url",
        "image",
      ],
      taxonomy_status: ["active", "inactive"],
      user_status: ["active", "pending", "suspended"],
      verification_result: [
        "confirmed",
        "updated",
        "deadline_extended",
        "disputed",
        "unreachable",
      ],
      verification_status: ["unverified", "pending", "verified", "disputed"],
    },
  },
} as const
