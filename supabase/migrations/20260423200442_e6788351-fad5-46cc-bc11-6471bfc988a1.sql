CREATE TABLE public.ar_weekly_overrides (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  forecast_start date NOT NULL,
  delay_days integer NOT NULL DEFAULT 0,
  weeks jsonb NOT NULL,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.ar_weekly_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view ar_weekly_overrides"
ON public.ar_weekly_overrides FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert ar_weekly_overrides"
ON public.ar_weekly_overrides FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update ar_weekly_overrides"
ON public.ar_weekly_overrides FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete ar_weekly_overrides"
ON public.ar_weekly_overrides FOR DELETE TO authenticated USING (true);

CREATE INDEX idx_ar_weekly_overrides_lookup
ON public.ar_weekly_overrides (forecast_start DESC, created_at DESC);