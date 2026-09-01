-- Align live Supabase schema with the v4 MVP custody and ledger model.

ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE public.users ADD CONSTRAINT users_role_check CHECK (role IN ('user', 'agent', 'admin', 'platform_admin', 'super_admin'));

ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS hubtel_reference VARCHAR(50);
ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS custody_type VARCHAR(20) DEFAULT 'hubtel_merchant';
ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS partner_bank_account VARCHAR(50);
ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS interest_rate DECIMAL(5,2) DEFAULT 0;

ALTER TABLE public.contributions ADD COLUMN IF NOT EXISTS momo_transaction_id VARCHAR(100);
ALTER TABLE public.contributions ADD COLUMN IF NOT EXISTS transaction_ref VARCHAR(100);
ALTER TABLE public.contributions ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;
CREATE UNIQUE INDEX IF NOT EXISTS contributions_transaction_ref_key ON public.contributions(transaction_ref) WHERE transaction_ref IS NOT NULL;

ALTER TABLE public.withdrawals ADD COLUMN IF NOT EXISTS momo_disbursement_ref VARCHAR(100);
ALTER TABLE public.withdrawals ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP;

CREATE TABLE IF NOT EXISTS public.audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  event_type VARCHAR(50) NOT NULL,
  entity_type VARCHAR(30) NOT NULL,
  entity_id UUID,
  amount DECIMAL(15,2),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_audit_events_group_created ON public.audit_events(group_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.exchange_rate_quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  base_currency VARCHAR(3) NOT NULL,
  quote_currency VARCHAR(3) NOT NULL DEFAULT 'GHS',
  rate DECIMAL(18,8) NOT NULL,
  provider VARCHAR(50) NOT NULL,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMPTZ NOT NULL
);

ALTER TABLE public.audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exchange_rate_quotes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS audit_events_member_read ON public.audit_events;
CREATE POLICY audit_events_member_read ON public.audit_events FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.group_members gm WHERE gm.group_id = audit_events.group_id AND gm.user_id = auth.uid()));

DROP POLICY IF EXISTS exchange_quotes_authenticated_read ON public.exchange_rate_quotes;
CREATE POLICY exchange_quotes_authenticated_read ON public.exchange_rate_quotes FOR SELECT TO authenticated USING (true);
