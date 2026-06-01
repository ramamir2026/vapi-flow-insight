-- Accounts registry: single source of truth for bank account → parser/assumption mapping.
CREATE TABLE public.accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL,
  institution text NOT NULL,
  last4 text,
  parser_type text NOT NULL CHECK (parser_type IN ('brex','svb_bai','svb_sweep','ramp_feed','stripe')),
  assumption_key text NOT NULL UNIQUE,
  detection_signature jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_restricted boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.accounts TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.accounts TO authenticated;
GRANT ALL ON public.accounts TO service_role;

ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view accounts"
  ON public.accounts FOR SELECT TO authenticated USING (true);

CREATE POLICY "Editors can insert accounts"
  ON public.accounts FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'editor'::app_role) OR has_role(auth.uid(), 'approver'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Editors can update accounts"
  ON public.accounts FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'editor'::app_role) OR has_role(auth.uid(), 'approver'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Approvers can delete accounts"
  ON public.accounts FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'approver'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_accounts_updated_at
  BEFORE UPDATE ON public.accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_accounts_active ON public.accounts(is_active, is_restricted);
CREATE INDEX idx_accounts_parser_type ON public.accounts(parser_type);

-- Seed: 7 operating + 2 restricted
INSERT INTO public.accounts (label, institution, last4, parser_type, assumption_key, detection_signature, is_restricted, is_active, sort_order) VALUES
  ('Brex Primary',          'Brex', '8083', 'brex',      'cash_brex_primary',              '{"header_tokens":["tofrom","accountnumberlastfour"],"account_value":"8083"}'::jsonb, false, true, 10),
  ('Brex Treasury',         'Brex', '2515', 'brex',      'cash_brex_treasury',             '{"header_tokens":["tofrom","accountnumberlastfour"],"account_value":"2515"}'::jsonb, false, true, 20),
  ('Brex Stripe Clearing',  'Brex', '9173', 'brex',      'cash_stripe_clearing',           '{"header_tokens":["tofrom","accountnumberlastfour"],"account_value":"9173"}'::jsonb, false, true, 30),
  ('SVB Analysis Checking', 'SVB',  '4687', 'svb_bai',   'cash_svb_checking',              '{"header_tokens":["bankid","accountnumber","accounttitle"],"account_value":"4687"}'::jsonb, false, true, 40),
  ('SVB Money Market',      'SVB',  NULL,   'svb_sweep', 'cash_svb_mm',                    '{"header_tokens":["sweepaccount","sweepproduct"]}'::jsonb, false, true, 50),
  ('Ramp Checking',         'Ramp', NULL,   'ramp_feed', 'cash_ramp_checking',             '{"header_tokens":["signedtransactionamount","detailedtransactiontype"]}'::jsonb, false, true, 60),
  ('Ramp Managed Portfolio','Ramp', NULL,   'ramp_feed', 'cash_ramp_treasury',             '{"header_tokens":["signedtransactionamount","detailedtransactiontype"]}'::jsonb, false, true, 70),
  ('Brex Vault (restricted)','Brex', NULL,  'brex',      'cash_brex_vault_restricted',     '{"header_tokens":["tofrom","accountnumberlastfour"]}'::jsonb, true,  true, 80),
  ('SVB Collateral MMA (restricted)','SVB','0999','svb_bai','cash_svb_collateral_restricted','{"header_tokens":["bankid","accountnumber","accounttitle"],"account_value":"0999"}'::jsonb, true, true, 90);
