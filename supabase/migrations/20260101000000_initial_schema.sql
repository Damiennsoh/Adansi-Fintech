-- ADANSI — Complete Supabase PostgreSQL Database Schema Initial Migration
-- Compatible with Supabase SQL Editor and Supabase CLI (`npx supabase db push`)

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Users Table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    auth_user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    phone VARCHAR(15) UNIQUE,
    email VARCHAR(255) UNIQUE,
    ghana_card_number VARCHAR(20) UNIQUE,
    ghana_card_image_url VARCHAR(500),
    full_name VARCHAR(100) NOT NULL,
    pin_hash VARCHAR(255),
    is_verified BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    credit_score INTEGER DEFAULT 0,
    total_contributed DECIMAL(15, 2) DEFAULT 0.00,
    groups_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- 2. Groups Table
CREATE TABLE IF NOT EXISTS groups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(150) NOT NULL,
    code VARCHAR(10) UNIQUE NOT NULL,
    type VARCHAR(30) NOT NULL,
    purpose TEXT,
    target_amount DECIMAL(15, 2),
    current_balance DECIMAL(15, 2) DEFAULT 0.00,
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    status VARCHAR(20) DEFAULT 'active',
    withdrawal_threshold DECIMAL(15, 2) DEFAULT 500.00,
    agent_verification_required BOOLEAN DEFAULT TRUE,
    contribution_frequency VARCHAR(20),
    contribution_amount DECIMAL(10, 2),
    auto_insurance_enabled BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_groups_code ON groups(code);
CREATE INDEX IF NOT EXISTS idx_groups_type ON groups(type);

-- 3. Group Members Table
CREATE TABLE IF NOT EXISTS group_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(20) DEFAULT 'member',
    joined_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    contribution_streak INTEGER DEFAULT 0,
    total_contributed DECIMAL(15, 2) DEFAULT 0.00,
    last_contribution_at TIMESTAMPTZ,
    UNIQUE(group_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_gm_group ON group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_gm_user ON group_members(user_id);

-- 4. Contributions Table
CREATE TABLE IF NOT EXISTS contributions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    group_id UUID NOT NULL REFERENCES groups(id) ON DELETE RESTRICT,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    amount DECIMAL(15, 2) NOT NULL,
    method VARCHAR(20) DEFAULT 'momo',
    transaction_ref VARCHAR(100) UNIQUE,
    status VARCHAR(20) DEFAULT 'pending',
    momo_transaction_id VARCHAR(100),
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_contrib_group ON contributions(group_id);
CREATE INDEX IF NOT EXISTS idx_contrib_user ON contributions(user_id);
CREATE INDEX IF NOT EXISTS idx_contrib_status ON contributions(status);
CREATE INDEX IF NOT EXISTS idx_contrib_ref ON contributions(transaction_ref);

-- 5. Transactions Audit Ledger Table
CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    type VARCHAR(20) NOT NULL,
    reference VARCHAR(100) UNIQUE NOT NULL,
    amount DECIMAL(15, 2) NOT NULL,
    group_id UUID REFERENCES groups(id) ON DELETE SET NULL,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    target_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    status VARCHAR(20) DEFAULT 'pending',
    external_ref VARCHAR(100),
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_txn_type ON transactions(type);
CREATE INDEX IF NOT EXISTS idx_txn_group ON transactions(group_id);
CREATE INDEX IF NOT EXISTS idx_txn_user ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_txn_created ON transactions(created_at);

-- 6. Withdrawals Table
CREATE TABLE IF NOT EXISTS withdrawals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    group_id UUID NOT NULL REFERENCES groups(id) ON DELETE RESTRICT,
    requested_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    amount DECIMAL(15, 2) NOT NULL,
    reason TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    approval_count INTEGER DEFAULT 0,
    approval_required INTEGER DEFAULT 3,
    agent_id VARCHAR(50),
    agent_verified_at TIMESTAMPTZ,
    disbursed_at TIMESTAMPTZ,
    momo_disbursement_ref VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_withdraw_group ON withdrawals(group_id);
CREATE INDEX IF NOT EXISTS idx_withdraw_status ON withdrawals(status);

-- 7. Withdrawal Approvals Table
CREATE TABLE IF NOT EXISTS withdrawal_approvals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    withdrawal_id UUID NOT NULL REFERENCES withdrawals(id) ON DELETE CASCADE,
    member_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    approved BOOLEAN NOT NULL,
    channel VARCHAR(20) DEFAULT 'pwa',
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(withdrawal_id, member_id)
);

-- 8. Credit Profiles Table
CREATE TABLE IF NOT EXISTS credit_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    score INTEGER DEFAULT 0,
    consistency_rating DECIMAL(3, 2) DEFAULT 0.00,
    total_contributed_all_time DECIMAL(15, 2) DEFAULT 0.00,
    active_groups INTEGER DEFAULT 0,
    loan_eligible BOOLEAN DEFAULT FALSE,
    max_loan_amount DECIMAL(15, 2) DEFAULT 0.00,
    total_loans_taken INTEGER DEFAULT 0,
    total_loans_repaid INTEGER DEFAULT 0,
    default_rate DECIMAL(5, 2) DEFAULT 0.00,
    last_calculated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 9. Loans Table
CREATE TABLE IF NOT EXISTS loans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    group_id UUID REFERENCES groups(id) ON DELETE SET NULL,
    amount DECIMAL(15, 2) NOT NULL,
    interest_rate DECIMAL(5, 2) DEFAULT 5.00,
    status VARCHAR(20) DEFAULT 'applied',
    purpose TEXT,
    approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
    disbursed_at TIMESTAMPTZ,
    due_date DATE,
    repaid_at TIMESTAMPTZ,
    total_repayable DECIMAL(15, 2),
    amount_repaid DECIMAL(15, 2) DEFAULT 0.00,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_loans_user ON loans(user_id);
CREATE INDEX IF NOT EXISTS idx_loans_status ON loans(status);

-- 10. Agent Verifications Table
CREATE TABLE IF NOT EXISTS agent_verifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    withdrawal_id UUID NOT NULL REFERENCES withdrawals(id) ON DELETE CASCADE,
    agent_id VARCHAR(50) NOT NULL,
    agent_name VARCHAR(100),
    agent_location TEXT,
    ghana_card_verified BOOLEAN DEFAULT FALSE,
    biometric_verified BOOLEAN DEFAULT FALSE,
    verification_photo_url VARCHAR(500),
    verified_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_av_withdrawal ON agent_verifications(withdrawal_id);

-- 11. Insurance Policies Table
CREATE TABLE IF NOT EXISTS insurance_policies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    provider VARCHAR(50),
    type VARCHAR(30) NOT NULL,
    premium DECIMAL(10, 2) NOT NULL,
    coverage_amount DECIMAL(15, 2) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    start_date TIMESTAMPTZ,
    end_date TIMESTAMPTZ,
    auto_deduct BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 12. Notifications Table
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    channel VARCHAR(20) NOT NULL,
    type VARCHAR(30) NOT NULL,
    content TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    external_message_id VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notif_status ON notifications(status);

-- 13. USSD Sessions Table
CREATE TABLE IF NOT EXISTS ussd_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id VARCHAR(100) UNIQUE NOT NULL,
    phone VARCHAR(15) NOT NULL,
    current_menu VARCHAR(50) DEFAULT 'main',
    group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
    amount DECIMAL(15, 2),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    step INTEGER DEFAULT 1,
    data JSONB DEFAULT '{}'::jsonb,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_ussd_session ON ussd_sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_ussd_phone ON ussd_sessions(phone);

-- Supabase Auth ownership and safe client access
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE contributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE withdrawals ENABLE ROW LEVEL SECURITY;
ALTER TABLE withdrawal_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE insurance_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE ussd_sessions ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_users_auth_user_id ON users(auth_user_id);

DROP POLICY IF EXISTS users_select_own ON users;
CREATE POLICY users_select_own ON users FOR SELECT TO authenticated
  USING (auth_user_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS users_insert_own ON users;
CREATE POLICY users_insert_own ON users FOR INSERT TO authenticated
  WITH CHECK (auth_user_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS users_update_own ON users;
CREATE POLICY users_update_own ON users FOR UPDATE TO authenticated
  USING (auth_user_id = (SELECT auth.uid()))
  WITH CHECK (auth_user_id = (SELECT auth.uid()));

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.users (id, auth_user_id, phone, full_name, is_verified)
  VALUES (
    new.id,
    new.id,
    COALESCE(new.phone, new.email, new.id::text),
    COALESCE(new.raw_user_meta_data->>'full_name', ''),
    TRUE
  )
  ON CONFLICT (id) DO UPDATE SET auth_user_id = EXCLUDED.auth_user_id;
  RETURN new;
END;
$$;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

