-- Adansi v5 migration — Provider-Agnostic Paystack Payments + Supabase Email Signups
-- Applies AFTER the three existing migrations (initial / MVP treasury / guide-alignment).
--
-- Apply via:
--   npx supabase db push
--   OR Supabase Dashboard -> SQL Editor -> run this file.

-- ---------------------------------------------------------------------------
-- 1. Model-schema alignment: columns in the SQLAlchemy User model that were
--    not yet represented in the DDL (users.role, users.updated_at) and the
--    CHECK constraint that migration 3 references.
-- ---------------------------------------------------------------------------

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS role VARCHAR(20) NOT NULL DEFAULT 'user';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE public.users ADD CONSTRAINT users_role_check
  CHECK (role IN ('user', 'agent', 'admin', 'platform_admin', 'super_admin'));

CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role);

-- ---------------------------------------------------------------------------
-- 2. Supabase Auth trigger compatibility for EMAIL signups.
--    The original trigger did: COALESCE(new.phone, new.email, ...), but also
--    stuffed the phone/email fallback into the `phone` column, which broke
--    the UNIQUE(phone) index for Diaspora users signing up only with email.
--    V5 writes phone into phone, email into email — correctly.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_display_name TEXT;
BEGIN
  v_display_name := COALESCE(
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'name',
    new.raw_user_meta_data->>'first_name',
    split_part(new.email, '@', 1),
    ''
  );

  INSERT INTO public.users (id, auth_user_id, phone, email, full_name, is_verified, created_at, updated_at)
  VALUES (
    COALESCE(new.id, gen_random_uuid()),
    new.id,
    new.phone,
    LOWER(new.email),
    v_display_name,
    TRUE,
    COALESCE(new.created_at, CURRENT_TIMESTAMP),
    CURRENT_TIMESTAMP
  )
  ON CONFLICT (id) DO UPDATE
    SET auth_user_id       = EXCLUDED.auth_user_id,
        phone              = COALESCE(public.users.phone, EXCLUDED.phone),
        email              = COALESCE(public.users.email, EXCLUDED.email),
        full_name          = CASE WHEN public.users.full_name IS NULL OR public.users.full_name = ''
                                   THEN EXCLUDED.full_name ELSE public.users.full_name END,
        updated_at         = CURRENT_TIMESTAMP;

  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

-- ---------------------------------------------------------------------------
-- 3. Ensure Supabase Auth "signups are enabled" for email providers in this
--    project. The guide only wants SERVER-SIDE auth (preferred over client
--    to avoid DNS/proxy issues). That means admin creates users via service
--    role; however, in-browser password signups still need a public provider.
-- ---------------------------------------------------------------------------

-- Confirm the "email" auth provider is enabled for Supabase Auth in the
-- dashboard: Auth -> Providers -> Email -> ON.
-- "Confirm email" can be OFF for the hackathon so diaspora users land in
-- the app immediately after signup. Set it back ON in production later.
-- The Python backend disables confirmation in sign_up_with_email options,
-- but the Supabase project-level switch must still match.

-- ---------------------------------------------------------------------------
-- 4. Contribution DDL already supports the Paystack + Hubtel unified
--    reference/metadata columns, but a couple of useful indexes are
--    missing for ledger-scale lookups of Paystack references and events.
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_contrib_transaction_ref ON public.contributions(transaction_ref);
CREATE INDEX IF NOT EXISTS idx_txn_reference_lookup ON public.transactions(reference);
CREATE INDEX IF NOT EXISTS idx_contrib_group_created ON public.contributions(group_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_users_lookup_email ON public.users(email);

-- ---------------------------------------------------------------------------
-- 5. Hubtel "partner integration" — the production target per MTN MoMo
--    Fintech Lab. Hubtel columns are already in place, we just make sure
--    every group has a custody_type and hubtel_reference default for the
--    provider-agnostic code path (PAYMENT_PROVIDER=hubtel post-hackathon).
-- ---------------------------------------------------------------------------

ALTER TABLE public.groups ALTER COLUMN custody_type SET DEFAULT 'hubtel_merchant';
UPDATE public.groups SET custody_type = 'hubtel_merchant' WHERE custody_type IS NULL;
ALTER TABLE public.groups ALTER COLUMN custody_type SET NOT NULL;

-- ---------------------------------------------------------------------------
-- 6. Optional: a small ledger summary view used by admin dashboards.
--    Purely cosmetic; not required by the payment or auth routes.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE VIEW public.v_group_ledger_summary AS
SELECT
  g.id                                             AS group_id,
  g.name                                           AS group_name,
  g.code                                           AS group_code,
  COALESCE(SUM(c.amount) FILTER (WHERE c.status = 'completed'), 0)
                                                   AS ledger_contributions,
  COALESCE(SUM(w.amount) FILTER (WHERE w.status IN ('approved','completed','disbursed')), 0)
                                                   AS ledger_withdrawals,
  COALESCE(SUM(c.amount) FILTER (WHERE c.status = 'completed'), 0)
  - COALESCE(SUM(w.amount) FILTER (WHERE w.status IN ('approved','completed','disbursed')), 0)
                                                   AS ledger_net_assets,
  g.current_balance                                AS reported_balance,
  g.current_balance - (
      COALESCE(SUM(c.amount) FILTER (WHERE c.status = 'completed'), 0)
    - COALESCE(SUM(w.amount) FILTER (WHERE w.status IN ('approved','completed','disbursed')), 0)
  )                                                AS balance_delta
FROM      public.groups        g
LEFT JOIN public.contributions c ON c.group_id = g.id
LEFT JOIN public.withdrawals   w ON w.group_id = g.id
GROUP BY g.id, g.name, g.code, g.current_balance;
