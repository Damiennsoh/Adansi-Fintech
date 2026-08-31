-- MVP treasury, beneficiary disbursement, and contribution history schema additions
-- Apply via Supabase CLI: npx supabase db push
-- Or paste into Supabase Dashboard → SQL Editor

-- Group treasury configuration
ALTER TABLE groups ADD COLUMN IF NOT EXISTS approval_rule VARCHAR(50) DEFAULT 'any_1_treasurer';
ALTER TABLE groups ADD COLUMN IF NOT EXISTS auto_approve_limit DECIMAL(15, 2) DEFAULT 0;
ALTER TABLE groups ADD COLUMN IF NOT EXISTS approval_timeout_hours INTEGER DEFAULT 24;
ALTER TABLE groups ADD COLUMN IF NOT EXISTS join_type VARCHAR(20) DEFAULT 'approval_required';
ALTER TABLE groups ADD COLUMN IF NOT EXISTS rotation_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE groups ADD COLUMN IF NOT EXISTS rotation_queue JSONB DEFAULT '[]'::jsonb;

-- Direct beneficiary disbursement fields
ALTER TABLE withdrawals ADD COLUMN IF NOT EXISTS beneficiary_name VARCHAR(255);
ALTER TABLE withdrawals ADD COLUMN IF NOT EXISTS beneficiary_phone VARCHAR(15);
ALTER TABLE withdrawals ADD COLUMN IF NOT EXISTS beneficiary_network VARCHAR(20) DEFAULT 'mtn';
ALTER TABLE withdrawals ADD COLUMN IF NOT EXISTS disbursement_method VARCHAR(20) DEFAULT 'momo';
ALTER TABLE withdrawals ADD COLUMN IF NOT EXISTS beneficiary_bank_account VARCHAR(50);
ALTER TABLE withdrawals ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
ALTER TABLE withdrawals ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;

-- Contribution schedules (on-time rate / credit scoring)
CREATE TABLE IF NOT EXISTS contribution_schedules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expected_date DATE NOT NULL,
    expected_amount DECIMAL(12, 2) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    paid_at TIMESTAMPTZ,
    contribution_id UUID REFERENCES contributions(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_schedules_user ON contribution_schedules(user_id);
CREATE INDEX IF NOT EXISTS idx_schedules_group ON contribution_schedules(group_id);

-- Monthly summaries for audit dashboards
CREATE TABLE IF NOT EXISTS group_monthly_summaries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    year INTEGER NOT NULL,
    month INTEGER NOT NULL,
    total_contributions DECIMAL(12, 2) DEFAULT 0,
    total_withdrawals DECIMAL(12, 2) DEFAULT 0,
    member_count INTEGER DEFAULT 0,
    contribution_count INTEGER DEFAULT 0,
    UNIQUE(group_id, year, month)
);

ALTER TABLE contribution_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_monthly_summaries ENABLE ROW LEVEL SECURITY;
