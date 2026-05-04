## Seed Apr 27–May 1 2026 weekly actuals

Insert one row into `public.weekly_actuals` for `week_start_date = '2026-04-27'`. The table already has a `UNIQUE (week_start_date)` constraint, so an `ON CONFLICT (week_start_date) DO UPDATE` upsert is safe to re-run.

### SQL to run (via insert tool)

```sql
INSERT INTO public.weekly_actuals (week_start_date, closing_cash_balance, notes, source)
VALUES (
  '2026-04-27',
  55773833,
  '{"openingBalance":58393081,"stripeRevenue":352048,"enterpriseRevenue":344060,"arCollections":382053,"totalInflows":1078161,"payroll":1817580,"cogs_anthropic":386722,"cogs_azure":0,"cogs_openai":0,"cogs_elevenlabs":0,"cogs_deepgram":0,"cogs_pump_aws":0,"cogs_twilio":134929,"cogs_other":38200,"brexCard":442103,"opex_sm":76161,"opex_software":46400,"opex_legal":0,"opex_deel":28215,"opex_hr_te":20902,"opex_recruiting":88750,"opex_ga":184203,"rent":32417,"totalOutflows":3296582,"netChange":-2218421}',
  'manual'
)
ON CONFLICT (week_start_date) DO UPDATE
SET closing_cash_balance = EXCLUDED.closing_cash_balance,
    notes = EXCLUDED.notes,
    updated_at = now();
```

### Notes
- `notes` is stored as text (the `useWeeklyActuals` hook `JSON.parse`s it), matching existing pattern.
- Today is Mon May 4 2026 → `getPriorMondayKey()` returns `2026-04-27`, so the dashboard's prior-week column will pick this up immediately on next query refresh.
- No schema change, no code change — pure data seed.