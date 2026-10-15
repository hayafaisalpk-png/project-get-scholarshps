/**
 * Database types — GENERATED FILE, DO NOT EDIT BY HAND.
 *
 * Regenerate after any schema change:
 *   node supabase/scripts/generate-database-types.mjs
 *
 * Source: live Supabase project, public schema only.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
  Tables: {
      academic_fields: {
        Row: {
        id: string
        slug: string
        name: string
        description: string | null
        parent_group: string | null
        status: 'active' | 'inactive'
        sort_order: number
        seo_title: string | null
        seo_description: string | null
        intro_content: string | null
        created_at: string
        updated_at: string
        archived_at: string | null
      }
        Insert: {
        id: string | null
        slug: string | null
        name: string | null
        description: string | null
        parent_group: string | null
        status: 'active' | 'inactive' | null
        sort_order: number | null
        seo_title: string | null
        seo_description: string | null
        intro_content: string | null
        created_at: string | null
        updated_at: string | null
        archived_at: string | null
      }
        Update: {
        id: string | null
        slug: string | null
        name: string | null
        description: string | null
        parent_group: string | null
        status: 'active' | 'inactive' | null
        sort_order: number | null
        seo_title: string | null
        seo_description: string | null
        intro_content: string | null
        created_at: string | null
        updated_at: string | null
        archived_at: string | null
      }
        Relationships: []
      }
      ad_placements: {
        Row: {
        id: string
        key: string
        display_name: string
        description: string | null
        is_enabled: boolean
        min_content_blocks: number
        sort_order: number
        updated_by: string | null
        created_at: string
        updated_at: string
      }
        Insert: {
        id: string | null
        key: string | null
        display_name: string | null
        description: string | null
        is_enabled: boolean | null
        min_content_blocks: number | null
        sort_order: number | null
        updated_by: string | null
        created_at: string | null
        updated_at: string | null
      }
        Update: {
        id: string | null
        key: string | null
        display_name: string | null
        description: string | null
        is_enabled: boolean | null
        min_content_blocks: number | null
        sort_order: number | null
        updated_by: string | null
        created_at: string | null
        updated_at: string | null
      }
        Relationships: []
      }
      article_categories: {
        Row: {
        id: string
        slug: string
        name: string
        description: string | null
        status: 'active' | 'inactive'
        sort_order: number
        seo_title: string | null
        seo_description: string | null
        created_at: string
        updated_at: string
        archived_at: string | null
      }
        Insert: {
        id: string | null
        slug: string | null
        name: string | null
        description: string | null
        status: 'active' | 'inactive' | null
        sort_order: number | null
        seo_title: string | null
        seo_description: string | null
        created_at: string | null
        updated_at: string | null
        archived_at: string | null
      }
        Update: {
        id: string | null
        slug: string | null
        name: string | null
        description: string | null
        status: 'active' | 'inactive' | null
        sort_order: number | null
        seo_title: string | null
        seo_description: string | null
        created_at: string | null
        updated_at: string | null
        archived_at: string | null
      }
        Relationships: []
      }
      article_category_links: {
        Row: {
        article_id: string
        article_category_id: string
      }
        Insert: {
        article_id: string | null
        article_category_id: string | null
      }
        Update: {
        article_id: string | null
        article_category_id: string | null
      }
        Relationships: [
        {"foreignKeyName":"article_category_links_article_category_id_fkey","columns":["article_category_id"],"isOneToOne":false,"referencedRelation":"article_categories","referencedColumns":["id"]},
        {"foreignKeyName":"article_category_links_article_id_fkey","columns":["article_id"],"isOneToOne":false,"referencedRelation":"articles","referencedColumns":["id"]}
      ]
      }
      article_reviews: {
        Row: {
        id: string
        article_id: string
        reviewer_id: string | null
        decision: 'approved' | 'changes_requested' | 'rejected'
        notes: string | null
        created_at: string
      }
        Insert: {
        id: string | null
        article_id: string | null
        reviewer_id: string | null
        decision: 'approved' | 'changes_requested' | 'rejected' | null
        notes: string | null
        created_at: string | null
      }
        Update: {
        id: string | null
        article_id: string | null
        reviewer_id: string | null
        decision: 'approved' | 'changes_requested' | 'rejected' | null
        notes: string | null
        created_at: string | null
      }
        Relationships: [
        {"foreignKeyName":"article_reviews_article_id_fkey","columns":["article_id"],"isOneToOne":false,"referencedRelation":"articles","referencedColumns":["id"]}
      ]
      }
      article_revisions: {
        Row: {
        id: string
        article_id: string
        revision_number: number
        title: string
        excerpt: string | null
        content: string
        content_plain: string
        change_note: string | null
        changed_by: string | null
        created_at: string
      }
        Insert: {
        id: string | null
        article_id: string | null
        revision_number: number | null
        title: string | null
        excerpt: string | null
        content: string | null
        content_plain: string | null
        change_note: string | null
        changed_by: string | null
        created_at: string | null
      }
        Update: {
        id: string | null
        article_id: string | null
        revision_number: number | null
        title: string | null
        excerpt: string | null
        content: string | null
        content_plain: string | null
        change_note: string | null
        changed_by: string | null
        created_at: string | null
      }
        Relationships: [
        {"foreignKeyName":"article_revisions_article_id_fkey","columns":["article_id"],"isOneToOne":false,"referencedRelation":"articles","referencedColumns":["id"]}
      ]
      }
      article_scholarships: {
        Row: {
        article_id: string
        scholarship_id: string
        sort_order: number
      }
        Insert: {
        article_id: string | null
        scholarship_id: string | null
        sort_order: number | null
      }
        Update: {
        article_id: string | null
        scholarship_id: string | null
        sort_order: number | null
      }
        Relationships: [
        {"foreignKeyName":"article_scholarships_article_id_fkey","columns":["article_id"],"isOneToOne":false,"referencedRelation":"articles","referencedColumns":["id"]},
        {"foreignKeyName":"article_scholarships_scholarship_id_fkey","columns":["scholarship_id"],"isOneToOne":false,"referencedRelation":"scholarships","referencedColumns":["id"]}
      ]
      }
      article_tag_links: {
        Row: {
        article_id: string
        tag_id: string
      }
        Insert: {
        article_id: string | null
        tag_id: string | null
      }
        Update: {
        article_id: string | null
        tag_id: string | null
      }
        Relationships: [
        {"foreignKeyName":"article_tag_links_article_id_fkey","columns":["article_id"],"isOneToOne":false,"referencedRelation":"articles","referencedColumns":["id"]},
        {"foreignKeyName":"article_tag_links_tag_id_fkey","columns":["tag_id"],"isOneToOne":false,"referencedRelation":"article_tags","referencedColumns":["id"]}
      ]
      }
      article_tags: {
        Row: {
        id: string
        slug: string
        name: string
        status: 'active' | 'inactive'
        created_at: string
        updated_at: string
        archived_at: string | null
      }
        Insert: {
        id: string | null
        slug: string | null
        name: string | null
        status: 'active' | 'inactive' | null
        created_at: string | null
        updated_at: string | null
        archived_at: string | null
      }
        Update: {
        id: string | null
        slug: string | null
        name: string | null
        status: 'active' | 'inactive' | null
        created_at: string | null
        updated_at: string | null
        archived_at: string | null
      }
        Relationships: []
      }
      articles: {
        Row: {
        id: string
        slug: string
        title: string
        excerpt: string | null
        content: string
        content_plain: string
        word_count: number
        reading_time_minutes: number
        status: 'draft' | 'in_review' | 'scheduled' | 'published' | 'archived'
        author_id: string | null
        editor_id: string | null
        featured_image_id: string | null
        social_image_id: string | null
        published_at: string | null
        scheduled_for: string | null
        reviewed_at: string | null
        archived_at: string | null
        seo_title: string | null
        seo_description: string | null
        canonical_url: string | null
        noindex: boolean
        allow_sitemap: boolean
        created_by: string | null
        updated_by: string | null
        created_at: string
        updated_at: string
        search_vector: string | null
      }
        Insert: {
        id: string | null
        slug: string | null
        title: string | null
        excerpt: string | null
        content: string | null
        content_plain: string | null
        word_count: number | null
        reading_time_minutes: number | null
        status: 'draft' | 'in_review' | 'scheduled' | 'published' | 'archived' | null
        author_id: string | null
        editor_id: string | null
        featured_image_id: string | null
        social_image_id: string | null
        published_at: string | null
        scheduled_for: string | null
        reviewed_at: string | null
        archived_at: string | null
        seo_title: string | null
        seo_description: string | null
        canonical_url: string | null
        noindex: boolean | null
        allow_sitemap: boolean | null
        created_by: string | null
        updated_by: string | null
        created_at: string | null
        updated_at: string | null
      }
        Update: {
        id: string | null
        slug: string | null
        title: string | null
        excerpt: string | null
        content: string | null
        content_plain: string | null
        word_count: number | null
        reading_time_minutes: number | null
        status: 'draft' | 'in_review' | 'scheduled' | 'published' | 'archived' | null
        author_id: string | null
        editor_id: string | null
        featured_image_id: string | null
        social_image_id: string | null
        published_at: string | null
        scheduled_for: string | null
        reviewed_at: string | null
        archived_at: string | null
        seo_title: string | null
        seo_description: string | null
        canonical_url: string | null
        noindex: boolean | null
        allow_sitemap: boolean | null
        created_by: string | null
        updated_by: string | null
        created_at: string | null
        updated_at: string | null
        search_vector: string | null
      }
        Relationships: [
        {"foreignKeyName":"articles_author_id_fkey","columns":["author_id"],"isOneToOne":false,"referencedRelation":"authors","referencedColumns":["id"]},
        {"foreignKeyName":"articles_featured_image_id_fkey","columns":["featured_image_id"],"isOneToOne":false,"referencedRelation":"media_assets","referencedColumns":["id"]},
        {"foreignKeyName":"articles_social_image_id_fkey","columns":["social_image_id"],"isOneToOne":false,"referencedRelation":"media_assets","referencedColumns":["id"]}
      ]
      }
      audit_logs: {
        Row: {
        id: number
        actor_id: string | null
        actor_email: string | null
        action: string
        entity_type: string
        entity_id: string | null
        before: Json | null
        after: Json | null
        ip_address: string | null
        user_agent: string | null
        created_at: string
      }
        Insert: {
        actor_id: string | null
        actor_email: string | null
        action: string | null
        entity_type: string | null
        entity_id: string | null
        before: Json | null
        after: Json | null
        ip_address: string | null
        user_agent: string | null
        created_at: string | null
      }
        Update: {
        id: number | null
        actor_id: string | null
        actor_email: string | null
        action: string | null
        entity_type: string | null
        entity_id: string | null
        before: Json | null
        after: Json | null
        ip_address: string | null
        user_agent: string | null
        created_at: string | null
      }
        Relationships: []
      }
      authors: {
        Row: {
        id: string
        slug: string
        full_name: string
        bio: string | null
        avatar_url: string | null
        title: string | null
        user_id: string | null
        is_active: boolean
        created_at: string
        updated_at: string
      }
        Insert: {
        id: string | null
        slug: string | null
        full_name: string | null
        bio: string | null
        avatar_url: string | null
        title: string | null
        user_id: string | null
        is_active: boolean | null
        created_at: string | null
        updated_at: string | null
      }
        Update: {
        id: string | null
        slug: string | null
        full_name: string | null
        bio: string | null
        avatar_url: string | null
        title: string | null
        user_id: string | null
        is_active: boolean | null
        created_at: string | null
        updated_at: string | null
      }
        Relationships: []
      }
      categories: {
        Row: {
        id: string
        slug: string
        name: string
        description: string | null
        icon: string | null
        status: 'active' | 'inactive'
        sort_order: number
        seo_title: string | null
        seo_description: string | null
        intro_content: string | null
        created_at: string
        updated_at: string
        archived_at: string | null
      }
        Insert: {
        id: string | null
        slug: string | null
        name: string | null
        description: string | null
        icon: string | null
        status: 'active' | 'inactive' | null
        sort_order: number | null
        seo_title: string | null
        seo_description: string | null
        intro_content: string | null
        created_at: string | null
        updated_at: string | null
        archived_at: string | null
      }
        Update: {
        id: string | null
        slug: string | null
        name: string | null
        description: string | null
        icon: string | null
        status: 'active' | 'inactive' | null
        sort_order: number | null
        seo_title: string | null
        seo_description: string | null
        intro_content: string | null
        created_at: string | null
        updated_at: string | null
        archived_at: string | null
      }
        Relationships: []
      }
      consent_records: {
        Row: {
        id: string
        visitor_id: string
        analytics: boolean
        ads: boolean
        functionality: boolean
        version: string
        source: 'banner' | 'settings'
        created_at: string
        updated_at: string
      }
        Insert: {
        id: string | null
        visitor_id: string | null
        analytics: boolean | null
        ads: boolean | null
        functionality: boolean | null
        version: string | null
        source: 'banner' | 'settings' | null
        created_at: string | null
        updated_at: string | null
      }
        Update: {
        id: string | null
        visitor_id: string | null
        analytics: boolean | null
        ads: boolean | null
        functionality: boolean | null
        version: string | null
        source: 'banner' | 'settings' | null
        created_at: string | null
        updated_at: string | null
      }
        Relationships: []
      }
      contact_submissions: {
        Row: {
        id: string
        name: string
        email: string
        subject: string
        message: string
        status: 'new' | 'in_progress' | 'resolved' | 'spam'
        handled_by: string | null
        handled_at: string | null
        created_at: string
        updated_at: string
      }
        Insert: {
        id: string | null
        name: string | null
        email: string | null
        subject: string | null
        message: string | null
        status: 'new' | 'in_progress' | 'resolved' | 'spam' | null
        handled_by: string | null
        handled_at: string | null
        created_at: string | null
        updated_at: string | null
      }
        Update: {
        id: string | null
        name: string | null
        email: string | null
        subject: string | null
        message: string | null
        status: 'new' | 'in_progress' | 'resolved' | 'spam' | null
        handled_by: string | null
        handled_at: string | null
        created_at: string | null
        updated_at: string | null
      }
        Relationships: []
      }
      content_reports: {
        Row: {
        id: string
        scholarship_id: string | null
        article_id: string | null
        reporter_email: string | null
        reason: 'incorrect_deadline' | 'incorrect_amount' | 'not_eligible' | 'no_longer_available' | 'broken_link' | 'duplicate' | 'other'
        details: string | null
        status: 'open' | 'reviewing' | 'resolved' | 'dismissed'
        resolved_by: string | null
        resolved_at: string | null
        resolution_note: string | null
        created_at: string
        updated_at: string
      }
        Insert: {
        id: string | null
        scholarship_id: string | null
        article_id: string | null
        reporter_email: string | null
        reason: 'incorrect_deadline' | 'incorrect_amount' | 'not_eligible' | 'no_longer_available' | 'broken_link' | 'duplicate' | 'other' | null
        details: string | null
        status: 'open' | 'reviewing' | 'resolved' | 'dismissed' | null
        resolved_by: string | null
        resolved_at: string | null
        resolution_note: string | null
        created_at: string | null
        updated_at: string | null
      }
        Update: {
        id: string | null
        scholarship_id: string | null
        article_id: string | null
        reporter_email: string | null
        reason: 'incorrect_deadline' | 'incorrect_amount' | 'not_eligible' | 'no_longer_available' | 'broken_link' | 'duplicate' | 'other' | null
        details: string | null
        status: 'open' | 'reviewing' | 'resolved' | 'dismissed' | null
        resolved_by: string | null
        resolved_at: string | null
        resolution_note: string | null
        created_at: string | null
        updated_at: string | null
      }
        Relationships: [
        {"foreignKeyName":"content_reports_article_id_fkey","columns":["article_id"],"isOneToOne":false,"referencedRelation":"articles","referencedColumns":["id"]},
        {"foreignKeyName":"content_reports_scholarship_id_fkey","columns":["scholarship_id"],"isOneToOne":false,"referencedRelation":"scholarships","referencedColumns":["id"]}
      ]
      }
      education_levels: {
        Row: {
        id: string
        slug: string
        name: string
        description: string | null
        rank: number
        status: 'active' | 'inactive'
        sort_order: number
        seo_title: string | null
        seo_description: string | null
        intro_content: string | null
        created_at: string
        updated_at: string
        archived_at: string | null
      }
        Insert: {
        id: string | null
        slug: string | null
        name: string | null
        description: string | null
        rank: number | null
        status: 'active' | 'inactive' | null
        sort_order: number | null
        seo_title: string | null
        seo_description: string | null
        intro_content: string | null
        created_at: string | null
        updated_at: string | null
        archived_at: string | null
      }
        Update: {
        id: string | null
        slug: string | null
        name: string | null
        description: string | null
        rank: number | null
        status: 'active' | 'inactive' | null
        sort_order: number | null
        seo_title: string | null
        seo_description: string | null
        intro_content: string | null
        created_at: string | null
        updated_at: string | null
        archived_at: string | null
      }
        Relationships: []
      }
      homepage_sections: {
        Row: {
        id: string
        key: string
        heading: string | null
        subheading: string | null
        is_visible: boolean
        sort_order: number
        config: Json
        updated_by: string | null
        created_at: string
        updated_at: string
      }
        Insert: {
        id: string | null
        key: string | null
        heading: string | null
        subheading: string | null
        is_visible: boolean | null
        sort_order: number | null
        config: Json | null
        updated_by: string | null
        created_at: string | null
        updated_at: string | null
      }
        Update: {
        id: string | null
        key: string | null
        heading: string | null
        subheading: string | null
        is_visible: boolean | null
        sort_order: number | null
        config: Json | null
        updated_by: string | null
        created_at: string | null
        updated_at: string | null
      }
        Relationships: []
      }
      locations: {
        Row: {
        id: string
        slug: string
        name: string
        type: 'country' | 'state' | 'region'
        parent_id: string | null
        code: string | null
        status: 'active' | 'inactive'
        sort_order: number
        seo_title: string | null
        seo_description: string | null
        intro_content: string | null
        created_at: string
        updated_at: string
        archived_at: string | null
        description: string | null
      }
        Insert: {
        id: string | null
        slug: string | null
        name: string | null
        type: 'country' | 'state' | 'region' | null
        parent_id: string | null
        code: string | null
        status: 'active' | 'inactive' | null
        sort_order: number | null
        seo_title: string | null
        seo_description: string | null
        intro_content: string | null
        created_at: string | null
        updated_at: string | null
        archived_at: string | null
        description: string | null
      }
        Update: {
        id: string | null
        slug: string | null
        name: string | null
        type: 'country' | 'state' | 'region' | null
        parent_id: string | null
        code: string | null
        status: 'active' | 'inactive' | null
        sort_order: number | null
        seo_title: string | null
        seo_description: string | null
        intro_content: string | null
        created_at: string | null
        updated_at: string | null
        archived_at: string | null
        description: string | null
      }
        Relationships: [
        {"foreignKeyName":"locations_parent_id_fkey","columns":["parent_id"],"isOneToOne":false,"referencedRelation":"locations","referencedColumns":["id"]}
      ]
      }
      media_assets: {
        Row: {
        id: string
        storage_path: string
        public_url: string | null
        is_public: boolean
        file_name: string
        mime_type: string
        file_size: number
        width: number | null
        height: number | null
        alt_text: string | null
        caption: string | null
        attribution: string | null
        credit_url: string | null
        folder: string
        uploaded_by: string | null
        created_at: string
        updated_at: string
        archived_at: string | null
      }
        Insert: {
        id: string | null
        storage_path: string | null
        public_url: string | null
        is_public: boolean | null
        file_name: string | null
        mime_type: string | null
        file_size: number | null
        width: number | null
        height: number | null
        alt_text: string | null
        caption: string | null
        attribution: string | null
        credit_url: string | null
        folder: string | null
        uploaded_by: string | null
        created_at: string | null
        updated_at: string | null
        archived_at: string | null
      }
        Update: {
        id: string | null
        storage_path: string | null
        public_url: string | null
        is_public: boolean | null
        file_name: string | null
        mime_type: string | null
        file_size: number | null
        width: number | null
        height: number | null
        alt_text: string | null
        caption: string | null
        attribution: string | null
        credit_url: string | null
        folder: string | null
        uploaded_by: string | null
        created_at: string | null
        updated_at: string | null
        archived_at: string | null
      }
        Relationships: []
      }
      navigation_items: {
        Row: {
        id: string
        label: string
        href: string
        parent_id: string | null
        location: 'header' | 'footer_column_1' | 'footer_column_2' | 'footer_column_3' | 'footer_column_4' | 'legal'
        sort_order: number
        is_visible: boolean
        opens_in_new_tab: boolean
        description: string | null
        created_at: string
        updated_at: string
      }
        Insert: {
        id: string | null
        label: string | null
        href: string | null
        parent_id: string | null
        location: 'header' | 'footer_column_1' | 'footer_column_2' | 'footer_column_3' | 'footer_column_4' | 'legal' | null
        sort_order: number | null
        is_visible: boolean | null
        opens_in_new_tab: boolean | null
        description: string | null
        created_at: string | null
        updated_at: string | null
      }
        Update: {
        id: string | null
        label: string | null
        href: string | null
        parent_id: string | null
        location: 'header' | 'footer_column_1' | 'footer_column_2' | 'footer_column_3' | 'footer_column_4' | 'legal' | null
        sort_order: number | null
        is_visible: boolean | null
        opens_in_new_tab: boolean | null
        description: string | null
        created_at: string | null
        updated_at: string | null
      }
        Relationships: [
        {"foreignKeyName":"navigation_items_parent_id_fkey","columns":["parent_id"],"isOneToOne":false,"referencedRelation":"navigation_items","referencedColumns":["id"]}
      ]
      }
      newsletter_subscribers: {
        Row: {
        id: string
        email: string
        status: 'pending' | 'subscribed' | 'unsubscribed' | 'bounced'
        consent_given_at: string | null
        ip_hash: string | null
        source: string | null
        unsubscribed_at: string | null
        created_at: string
        updated_at: string
      }
        Insert: {
        id: string | null
        email: string | null
        status: 'pending' | 'subscribed' | 'unsubscribed' | 'bounced' | null
        consent_given_at: string | null
        ip_hash: string | null
        source: string | null
        unsubscribed_at: string | null
        created_at: string | null
        updated_at: string | null
      }
        Update: {
        id: string | null
        email: string | null
        status: 'pending' | 'subscribed' | 'unsubscribed' | 'bounced' | null
        consent_given_at: string | null
        ip_hash: string | null
        source: string | null
        unsubscribed_at: string | null
        created_at: string | null
        updated_at: string | null
      }
        Relationships: []
      }
      permissions: {
        Row: {
        id: string
        key: string
        description: string | null
        category: string
        created_at: string
        updated_at: string
      }
        Insert: {
        id: string | null
        key: string | null
        description: string | null
        category: string | null
        created_at: string | null
        updated_at: string | null
      }
        Update: {
        id: string | null
        key: string | null
        description: string | null
        category: string | null
        created_at: string | null
        updated_at: string | null
      }
        Relationships: []
      }
      profiles: {
        Row: {
        id: string
        email: string | null
        full_name: string | null
        avatar_url: string | null
        bio: string | null
        status: 'active' | 'pending' | 'suspended'
        last_sign_in_at: string | null
        created_at: string
        updated_at: string
      }
        Insert: {
        id: string | null
        email: string | null
        full_name: string | null
        avatar_url: string | null
        bio: string | null
        status: 'active' | 'pending' | 'suspended' | null
        last_sign_in_at: string | null
        created_at: string | null
        updated_at: string | null
      }
        Update: {
        id: string | null
        email: string | null
        full_name: string | null
        avatar_url: string | null
        bio: string | null
        status: 'active' | 'pending' | 'suspended' | null
        last_sign_in_at: string | null
        created_at: string | null
        updated_at: string | null
      }
        Relationships: []
      }
      redirects: {
        Row: {
        from_path: string
        to_path: string
        status_code: number
        is_active: boolean
        hit_count: number
        note: string | null
        created_by: string | null
        created_at: string
        updated_at: string
      }
        Insert: {
        from_path: string | null
        to_path: string | null
        status_code: number | null
        is_active: boolean | null
        hit_count: number | null
        note: string | null
        created_by: string | null
        created_at: string | null
        updated_at: string | null
      }
        Update: {
        from_path: string | null
        to_path: string | null
        status_code: number | null
        is_active: boolean | null
        hit_count: number | null
        note: string | null
        created_by: string | null
        created_at: string | null
        updated_at: string | null
      }
        Relationships: []
      }
      role_permissions: {
        Row: {
        role_id: string
        permission_id: string
      }
        Insert: {
        role_id: string | null
        permission_id: string | null
      }
        Update: {
        role_id: string | null
        permission_id: string | null
      }
        Relationships: [
        {"foreignKeyName":"role_permissions_permission_id_fkey","columns":["permission_id"],"isOneToOne":false,"referencedRelation":"permissions","referencedColumns":["id"]},
        {"foreignKeyName":"role_permissions_role_id_fkey","columns":["role_id"],"isOneToOne":false,"referencedRelation":"roles","referencedColumns":["id"]}
      ]
      }
      roles: {
        Row: {
        id: string
        key: string
        name: string
        description: string | null
        is_system: boolean
        created_at: string
        updated_at: string
      }
        Insert: {
        id: string | null
        key: string | null
        name: string | null
        description: string | null
        is_system: boolean | null
        created_at: string | null
        updated_at: string | null
      }
        Update: {
        id: string | null
        key: string | null
        name: string | null
        description: string | null
        is_system: boolean | null
        created_at: string | null
        updated_at: string | null
      }
        Relationships: []
      }
      scholarship_categories: {
        Row: {
        scholarship_id: string
        category_id: string
      }
        Insert: {
        scholarship_id: string | null
        category_id: string | null
      }
        Update: {
        scholarship_id: string | null
        category_id: string | null
      }
        Relationships: [
        {"foreignKeyName":"scholarship_categories_category_id_fkey","columns":["category_id"],"isOneToOne":false,"referencedRelation":"categories","referencedColumns":["id"]},
        {"foreignKeyName":"scholarship_categories_scholarship_id_fkey","columns":["scholarship_id"],"isOneToOne":false,"referencedRelation":"scholarships","referencedColumns":["id"]}
      ]
      }
      scholarship_education_levels: {
        Row: {
        scholarship_id: string
        education_level_id: string
      }
        Insert: {
        scholarship_id: string | null
        education_level_id: string | null
      }
        Update: {
        scholarship_id: string | null
        education_level_id: string | null
      }
        Relationships: [
        {"foreignKeyName":"scholarship_education_levels_education_level_id_fkey","columns":["education_level_id"],"isOneToOne":false,"referencedRelation":"education_levels","referencedColumns":["id"]},
        {"foreignKeyName":"scholarship_education_levels_scholarship_id_fkey","columns":["scholarship_id"],"isOneToOne":false,"referencedRelation":"scholarships","referencedColumns":["id"]}
      ]
      }
      scholarship_fields: {
        Row: {
        scholarship_id: string
        academic_field_id: string
      }
        Insert: {
        scholarship_id: string | null
        academic_field_id: string | null
      }
        Update: {
        scholarship_id: string | null
        academic_field_id: string | null
      }
        Relationships: [
        {"foreignKeyName":"scholarship_fields_academic_field_id_fkey","columns":["academic_field_id"],"isOneToOne":false,"referencedRelation":"academic_fields","referencedColumns":["id"]},
        {"foreignKeyName":"scholarship_fields_scholarship_id_fkey","columns":["scholarship_id"],"isOneToOne":false,"referencedRelation":"scholarships","referencedColumns":["id"]}
      ]
      }
      scholarship_locations: {
        Row: {
        scholarship_id: string
        location_id: string
      }
        Insert: {
        scholarship_id: string | null
        location_id: string | null
      }
        Update: {
        scholarship_id: string | null
        location_id: string | null
      }
        Relationships: [
        {"foreignKeyName":"scholarship_locations_location_id_fkey","columns":["location_id"],"isOneToOne":false,"referencedRelation":"locations","referencedColumns":["id"]},
        {"foreignKeyName":"scholarship_locations_scholarship_id_fkey","columns":["scholarship_id"],"isOneToOne":false,"referencedRelation":"scholarships","referencedColumns":["id"]}
      ]
      }
      scholarship_sources: {
        Row: {
        id: string
        scholarship_id: string
        source_url: string
        source_name: string
        retrieved_at: string | null
        notes: string | null
        created_by: string | null
        created_at: string
        updated_at: string
      }
        Insert: {
        id: string | null
        scholarship_id: string | null
        source_url: string | null
        source_name: string | null
        retrieved_at: string | null
        notes: string | null
        created_by: string | null
        created_at: string | null
        updated_at: string | null
      }
        Update: {
        id: string | null
        scholarship_id: string | null
        source_url: string | null
        source_name: string | null
        retrieved_at: string | null
        notes: string | null
        created_by: string | null
        created_at: string | null
        updated_at: string | null
      }
        Relationships: [
        {"foreignKeyName":"scholarship_sources_scholarship_id_fkey","columns":["scholarship_id"],"isOneToOne":false,"referencedRelation":"scholarships","referencedColumns":["id"]}
      ]
      }
      scholarship_tags: {
        Row: {
        scholarship_id: string
        tag_id: string
      }
        Insert: {
        scholarship_id: string | null
        tag_id: string | null
      }
        Update: {
        scholarship_id: string | null
        tag_id: string | null
      }
        Relationships: [
        {"foreignKeyName":"scholarship_tags_scholarship_id_fkey","columns":["scholarship_id"],"isOneToOne":false,"referencedRelation":"scholarships","referencedColumns":["id"]},
        {"foreignKeyName":"scholarship_tags_tag_id_fkey","columns":["tag_id"],"isOneToOne":false,"referencedRelation":"tags","referencedColumns":["id"]}
      ]
      }
      scholarship_verification_logs: {
        Row: {
        id: string
        scholarship_id: string
        checked_by: string | null
        checked_at: string
        result: 'confirmed' | 'updated' | 'deadline_extended' | 'disputed' | 'unreachable'
        previous_deadline: string | null
        new_deadline: string | null
        notes: string | null
        created_at: string
      }
        Insert: {
        id: string | null
        scholarship_id: string | null
        checked_by: string | null
        checked_at: string | null
        result: 'confirmed' | 'updated' | 'deadline_extended' | 'disputed' | 'unreachable' | null
        previous_deadline: string | null
        new_deadline: string | null
        notes: string | null
        created_at: string | null
      }
        Update: {
        id: string | null
        scholarship_id: string | null
        checked_by: string | null
        checked_at: string | null
        result: 'confirmed' | 'updated' | 'deadline_extended' | 'disputed' | 'unreachable' | null
        previous_deadline: string | null
        new_deadline: string | null
        notes: string | null
        created_at: string | null
      }
        Relationships: [
        {"foreignKeyName":"scholarship_verification_logs_scholarship_id_fkey","columns":["scholarship_id"],"isOneToOne":false,"referencedRelation":"scholarships","referencedColumns":["id"]}
      ]
      }
      scholarships: {
        Row: {
        id: string
        slug: string
        title: string
        sponsor_name: string
        summary: string | null
        description: string | null
        award_amount_min_cents: number | null
        award_amount_max_cents: number | null
        award_amount_text: string | null
        award_currency: string
        number_of_awards: number | null
        award_per_year: boolean
        application_fee_cents: number
        is_renewable: boolean
        renewal_details: string | null
        max_renewals: number | null
        eligibility_requirements: string | null
        application_instructions: string | null
        required_documents: string[]
        application_url: string | null
        opens_at: string | null
        deadline: string | null
        is_rolling: boolean
        status: 'draft' | 'pending_review' | 'published' | 'expired' | 'archived'
        published_at: string | null
        archived_at: string | null
        verification_status: 'unverified' | 'pending' | 'verified' | 'disputed'
        verified_at: string | null
        verified_by: string | null
        last_reviewed_at: string | null
        featured: boolean
        featured_until: string | null
        internal_notes: string | null
        image_id: string | null
        seo_title: string | null
        seo_description: string | null
        noindex: boolean
        created_by: string | null
        updated_by: string | null
        created_at: string
        updated_at: string
        search_vector: string | null
      }
        Insert: {
        id: string | null
        slug: string | null
        title: string | null
        sponsor_name: string | null
        summary: string | null
        description: string | null
        award_amount_min_cents: number | null
        award_amount_max_cents: number | null
        award_amount_text: string | null
        award_currency: string | null
        number_of_awards: number | null
        award_per_year: boolean | null
        application_fee_cents: number | null
        is_renewable: boolean | null
        renewal_details: string | null
        max_renewals: number | null
        eligibility_requirements: string | null
        application_instructions: string | null
        required_documents: string[] | null
        application_url: string | null
        opens_at: string | null
        deadline: string | null
        is_rolling: boolean | null
        status: 'draft' | 'pending_review' | 'published' | 'expired' | 'archived' | null
        published_at: string | null
        archived_at: string | null
        verification_status: 'unverified' | 'pending' | 'verified' | 'disputed' | null
        verified_at: string | null
        verified_by: string | null
        last_reviewed_at: string | null
        featured: boolean | null
        featured_until: string | null
        internal_notes: string | null
        image_id: string | null
        seo_title: string | null
        seo_description: string | null
        noindex: boolean | null
        created_by: string | null
        updated_by: string | null
        created_at: string | null
        updated_at: string | null
      }
        Update: {
        id: string | null
        slug: string | null
        title: string | null
        sponsor_name: string | null
        summary: string | null
        description: string | null
        award_amount_min_cents: number | null
        award_amount_max_cents: number | null
        award_amount_text: string | null
        award_currency: string | null
        number_of_awards: number | null
        award_per_year: boolean | null
        application_fee_cents: number | null
        is_renewable: boolean | null
        renewal_details: string | null
        max_renewals: number | null
        eligibility_requirements: string | null
        application_instructions: string | null
        required_documents: string[] | null
        application_url: string | null
        opens_at: string | null
        deadline: string | null
        is_rolling: boolean | null
        status: 'draft' | 'pending_review' | 'published' | 'expired' | 'archived' | null
        published_at: string | null
        archived_at: string | null
        verification_status: 'unverified' | 'pending' | 'verified' | 'disputed' | null
        verified_at: string | null
        verified_by: string | null
        last_reviewed_at: string | null
        featured: boolean | null
        featured_until: string | null
        internal_notes: string | null
        image_id: string | null
        seo_title: string | null
        seo_description: string | null
        noindex: boolean | null
        created_by: string | null
        updated_by: string | null
        created_at: string | null
        updated_at: string | null
        search_vector: string | null
      }
        Relationships: [
        {"foreignKeyName":"scholarships_image_id_fkey","columns":["image_id"],"isOneToOne":false,"referencedRelation":"media_assets","referencedColumns":["id"]}
      ]
      }
      site_settings: {
        Row: {
        key: string
        value: Json | null
        value_type: 'string' | 'text' | 'number' | 'boolean' | 'json' | 'url' | 'image'
        group: string
        label: string | null
        description: string | null
        is_public: boolean
        updated_by: string | null
        created_at: string
        updated_at: string
      }
        Insert: {
        key: string | null
        value: Json | null
        value_type: 'string' | 'text' | 'number' | 'boolean' | 'json' | 'url' | 'image' | null
        group: string | null
        label: string | null
        description: string | null
        is_public: boolean | null
        updated_by: string | null
        created_at: string | null
        updated_at: string | null
      }
        Update: {
        key: string | null
        value: Json | null
        value_type: 'string' | 'text' | 'number' | 'boolean' | 'json' | 'url' | 'image' | null
        group: string | null
        label: string | null
        description: string | null
        is_public: boolean | null
        updated_by: string | null
        created_at: string | null
        updated_at: string | null
      }
        Relationships: []
      }
      tags: {
        Row: {
        id: string
        slug: string
        name: string
        description: string | null
        status: 'active' | 'inactive'
        seo_title: string | null
        seo_description: string | null
        created_at: string
        updated_at: string
        archived_at: string | null
      }
        Insert: {
        id: string | null
        slug: string | null
        name: string | null
        description: string | null
        status: 'active' | 'inactive' | null
        seo_title: string | null
        seo_description: string | null
        created_at: string | null
        updated_at: string | null
        archived_at: string | null
      }
        Update: {
        id: string | null
        slug: string | null
        name: string | null
        description: string | null
        status: 'active' | 'inactive' | null
        seo_title: string | null
        seo_description: string | null
        created_at: string | null
        updated_at: string | null
        archived_at: string | null
      }
        Relationships: []
      }
      user_roles: {
        Row: {
        user_id: string
        role_id: string
        granted_by: string | null
        granted_at: string
      }
        Insert: {
        user_id: string | null
        role_id: string | null
        granted_by: string | null
        granted_at: string | null
      }
        Update: {
        user_id: string | null
        role_id: string | null
        granted_by: string | null
        granted_at: string | null
      }
        Relationships: [
        {"foreignKeyName":"user_roles_role_id_fkey","columns":["role_id"],"isOneToOne":false,"referencedRelation":"roles","referencedColumns":["id"]}
      ]
      }
  }
  Views: {
      published_scholarship_sources: {
        Row: {
        id: string
        scholarship_id: string
        source_url: string
        source_name: string
        retrieved_at: string | null
      }
        Relationships: []
      }
      published_scholarships: {
        Row: {
        id: string
        slug: string
        title: string
        sponsor_name: string
        summary: string | null
        award_amount_min_cents: number | null
        award_amount_max_cents: number | null
        award_amount_text: string | null
        award_currency: string
        number_of_awards: number | null
        is_renewable: boolean
        application_fee_cents: number
        opens_at: string | null
        deadline: string | null
        is_rolling: boolean
        status: 'draft' | 'pending_review' | 'published' | 'expired' | 'archived'
        verification_status: 'unverified' | 'pending' | 'verified' | 'disputed'
        verified_at: string | null
        last_reviewed_at: string | null
        featured: boolean
        image_id: string | null
        published_at: string | null
        updated_at: string
        search_vector: string | null
        is_expired: boolean | null
        days_remaining: number | null
      }
        Relationships: []
      }
      published_articles: {
        Row: {
        id: string
        slug: string
        title: string
        excerpt: string | null
        content: string
        author_id: string | null
        featured_image_id: string | null
        social_image_id: string | null
        published_at: string | null
        updated_at: string
        reading_time_minutes: number
        word_count: number
        seo_title: string | null
        seo_description: string | null
      }
        Relationships: []
      }
      user_role_summary: {
        Row: {
        user_id: string
        email: string
        full_name: string
        status: 'active' | 'pending' | 'suspended'
        roles: string[] | null
        created_at: string
      }
        Relationships: []
      }
  }
  Functions: {
      article_is_public: { Args: {p_status?: 'draft' | 'in_review' | 'scheduled' | 'published' | 'archived'; p_published_at?: string }; Returns: unknown }
      attach_updated_at_trigger: { Args: {p_table?: string }; Returns: unknown }
      scholarship_days_remaining: { Args: {p_deadline?: string }; Returns: unknown }
      scholarship_is_expired: { Args: {p_status?: 'draft' | 'pending_review' | 'published' | 'expired' | 'archived'; p_deadline?: string; p_is_rolling?: boolean }; Returns: unknown }
      scholarship_is_public: { Args: {p_status?: 'draft' | 'pending_review' | 'published' | 'expired' | 'archived' }; Returns: unknown }
      search_scholarships: { Args: {p_q?: string; p_levels?: string[]; p_fields?: string[]; p_categories?: string[]; p_locations?: string[]; p_tags?: string[]; p_min_amount_cents?: number; p_max_amount_cents?: number; p_deadline?: string; p_renewable?: boolean; p_free_application?: boolean; p_international?: boolean; p_sort?: string; p_page?: number; p_page_size?: number }; Returns: unknown }
      set_updated_at: { Args: { }; Returns: unknown }
  }
  Enums: {
      article_status: 'draft' | 'in_review' | 'scheduled' | 'published' | 'archived'
      consent_source: 'banner' | 'settings'
      contact_status: 'new' | 'in_progress' | 'resolved' | 'spam'
      location_type: 'country' | 'state' | 'region'
      navigation_location: 'header' | 'footer_column_1' | 'footer_column_2' | 'footer_column_3' | 'footer_column_4' | 'legal'
      newsletter_status: 'pending' | 'subscribed' | 'unsubscribed' | 'bounced'
      report_reason: 'incorrect_deadline' | 'incorrect_amount' | 'not_eligible' | 'no_longer_available' | 'broken_link' | 'duplicate' | 'other'
      report_status: 'open' | 'reviewing' | 'resolved' | 'dismissed'
      review_decision: 'approved' | 'changes_requested' | 'rejected'
      scholarship_status: 'draft' | 'pending_review' | 'published' | 'expired' | 'archived'
      setting_value_type: 'string' | 'text' | 'number' | 'boolean' | 'json' | 'url' | 'image'
      taxonomy_status: 'active' | 'inactive'
      user_status: 'active' | 'pending' | 'suspended'
      verification_result: 'confirmed' | 'updated' | 'deadline_extended' | 'disputed' | 'unreachable'
      verification_status: 'unverified' | 'pending' | 'verified' | 'disputed'
  }
  CompositeTypes: {}
  }
  }

export type Tables<
  PublicTableNameOrOptions extends
    | keyof (Database['public']['Tables'] & Database['public']['Views'])
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof (Database['public']['Tables'] & Database['public']['Views'])
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? (Database['public']['Tables'] & Database['public']['Views'])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : PublicTableNameOrOptions extends keyof (Database['public']['Tables'] &
        Database['public']['Views'])
    ? (Database['public']['Tables'] & Database['public']['Views'])[PublicTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T] extends { Insert: infer I } ? I : never

export type TablesUpdate<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T] extends { Update: infer U } ? U : never

export type Enums<E extends keyof Database['public']['Enums']> =
  Database['public']['Enums'][E]

/** A single row of a public table. */
export type TableRow<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T] extends { Row: infer R } ? R : never

/** An insert payload for a public table (generated columns omitted). */
export type TableInsert<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T] extends { Insert: infer I } ? I : never

/** An update payload for a public table. */
export type TableUpdate<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T] extends { Update: infer U } ? U : never
