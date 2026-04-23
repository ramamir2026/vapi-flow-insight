
-- =========================================
-- ENUMS
-- =========================================
CREATE TYPE public.app_role AS ENUM ('admin', 'user');
CREATE TYPE public.ar_status AS ENUM ('pending', 'collected', 'overdue', 'written_off');

-- =========================================
-- UTILITY: updated_at trigger function
-- =========================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- =========================================
-- DOMAIN RESTRICTION (only @vapi.ai)
-- =========================================
CREATE OR REPLACE FUNCTION public.enforce_vapi_domain()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.email IS NULL OR NEW.email NOT ILIKE '%@vapi.ai' THEN
    RAISE EXCEPTION 'Only @vapi.ai email addresses are allowed to sign up.';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER enforce_vapi_domain_trigger
BEFORE INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.enforce_vapi_domain();

-- =========================================
-- PROFILES TABLE
-- =========================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own profile"
ON public.profiles FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile"
ON public.profiles FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile"
ON public.profiles FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', '')
  );
  -- Default role: user
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user')
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

-- =========================================
-- USER ROLES TABLE
-- =========================================
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
$$;

CREATE POLICY "Users can view their own roles"
ON public.user_roles FOR SELECT
TO authenticated
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage all roles"
ON public.user_roles FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Now create the trigger that depends on user_roles
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user();

-- =========================================
-- ASSUMPTIONS TABLE
-- =========================================
CREATE TABLE public.assumptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL,
  key TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  value NUMERIC NOT NULL DEFAULT 0,
  unit TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.assumptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view assumptions"
ON public.assumptions FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert assumptions"
ON public.assumptions FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update assumptions"
ON public.assumptions FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete assumptions"
ON public.assumptions FOR DELETE TO authenticated USING (true);

CREATE TRIGGER update_assumptions_updated_at
BEFORE UPDATE ON public.assumptions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================
-- A/R ENTRIES TABLE
-- =========================================
CREATE TABLE public.ar_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_name TEXT NOT NULL,
  invoice_number TEXT,
  invoice_amount NUMERIC NOT NULL DEFAULT 0,
  invoice_date DATE NOT NULL,
  expected_collection_date DATE NOT NULL,
  status public.ar_status NOT NULL DEFAULT 'pending',
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.ar_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view ar_entries"
ON public.ar_entries FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert ar_entries"
ON public.ar_entries FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update ar_entries"
ON public.ar_entries FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete ar_entries"
ON public.ar_entries FOR DELETE TO authenticated USING (true);

CREATE TRIGGER update_ar_entries_updated_at
BEFORE UPDATE ON public.ar_entries
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================
-- FUTURE HIRES TABLE
-- =========================================
CREATE TABLE public.future_hires (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  department TEXT,
  start_date DATE NOT NULL,
  annual_salary NUMERIC NOT NULL DEFAULT 0,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.future_hires ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view future_hires"
ON public.future_hires FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert future_hires"
ON public.future_hires FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update future_hires"
ON public.future_hires FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete future_hires"
ON public.future_hires FOR DELETE TO authenticated USING (true);

CREATE TRIGGER update_future_hires_updated_at
BEFORE UPDATE ON public.future_hires
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================
-- WEEKLY ACTUALS TABLE
-- =========================================
CREATE TABLE public.weekly_actuals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  week_start_date DATE NOT NULL UNIQUE,
  closing_cash_balance NUMERIC NOT NULL DEFAULT 0,
  actual_burn NUMERIC,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.weekly_actuals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view weekly_actuals"
ON public.weekly_actuals FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert weekly_actuals"
ON public.weekly_actuals FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update weekly_actuals"
ON public.weekly_actuals FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete weekly_actuals"
ON public.weekly_actuals FOR DELETE TO authenticated USING (true);

CREATE TRIGGER update_weekly_actuals_updated_at
BEFORE UPDATE ON public.weekly_actuals
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================
-- MODEL WEEKS TABLE (forecast snapshots)
-- =========================================
CREATE TABLE public.model_weeks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_id UUID NOT NULL,
  snapshot_label TEXT,
  week_index INTEGER NOT NULL,
  week_start_date DATE NOT NULL,
  opening_balance NUMERIC NOT NULL DEFAULT 0,
  stripe_revenue NUMERIC NOT NULL DEFAULT 0,
  enterprise_revenue NUMERIC NOT NULL DEFAULT 0,
  ar_collections NUMERIC NOT NULL DEFAULT 0,
  payroll NUMERIC NOT NULL DEFAULT 0,
  cogs NUMERIC NOT NULL DEFAULT 0,
  card_payments NUMERIC NOT NULL DEFAULT 0,
  rent NUMERIC NOT NULL DEFAULT 0,
  opex NUMERIC NOT NULL DEFAULT 0,
  net_change NUMERIC NOT NULL DEFAULT 0,
  closing_balance NUMERIC NOT NULL DEFAULT 0,
  burn NUMERIC NOT NULL DEFAULT 0,
  runway_weeks NUMERIC,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.model_weeks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view model_weeks"
ON public.model_weeks FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert model_weeks"
ON public.model_weeks FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update model_weeks"
ON public.model_weeks FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete model_weeks"
ON public.model_weeks FOR DELETE TO authenticated USING (true);

CREATE INDEX idx_model_weeks_snapshot ON public.model_weeks(snapshot_id, week_index);

-- =========================================
-- SEED ASSUMPTIONS
-- =========================================
INSERT INTO public.assumptions (category, key, label, value, unit, notes) VALUES
  ('Cash', 'opening_cash_balance', 'Opening Cash Balance', 0, 'USD', 'Current bank balance at week 0'),
  ('Revenue', 'stripe_weekly_revenue', 'Stripe Weekly Revenue', 0, 'USD', 'Average weekly Stripe revenue'),
  ('Revenue', 'stripe_growth_rate_weekly', 'Stripe Weekly Growth Rate', 0, '%', 'Week-over-week growth %'),
  ('Revenue', 'enterprise_monthly_ach', 'Enterprise Monthly ACH', 0, 'USD', 'Recurring enterprise ACH revenue per month'),
  ('Payroll', 'biweekly_payroll', 'Bi-weekly Payroll', 0, 'USD', 'Total bi-weekly payroll cost'),
  ('Payroll', 'payroll_taxes_pct', 'Payroll Taxes %', 10, '%', 'Estimated payroll taxes as % of payroll'),
  ('COGS', 'cogs_pct_of_revenue', 'COGS as % of Revenue', 30, '%', 'Cost of goods sold as % of revenue'),
  ('OPEX', 'monthly_rent', 'Monthly Rent', 0, 'USD', 'Office rent paid monthly'),
  ('OPEX', 'monthly_opex', 'Monthly OPEX', 0, 'USD', 'Other recurring monthly operating expenses'),
  ('OPEX', 'monthly_card_payments', 'Monthly Card Payments', 0, 'USD', 'Average monthly credit card payments');
