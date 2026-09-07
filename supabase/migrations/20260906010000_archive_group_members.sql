-- Migration: Add archived_at column to group_members table for member archival/restoration
ALTER TABLE group_members ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ NULL;
