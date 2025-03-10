/*
  # Add sequence enable/disable functionality

  1. Changes
    - Add `enabled` column to `sequences` table with default value of true
    - Add `paused_at` column to `lead_sequences` table to track when a sequence was paused
  
  2. Security
    - Maintain existing RLS policies
*/

-- Add enabled column to sequences table
ALTER TABLE sequences 
ADD COLUMN enabled boolean DEFAULT true;

-- Add paused_at column to lead_sequences table
ALTER TABLE lead_sequences
ADD COLUMN paused_at timestamptz DEFAULT null;