

## Assumptions Tab Rebuild

Replace the current Assumptions page with a fully grouped, spec-driven editor: 9 sections, ~35 editable rows, an auto-summed Opening Cash Balance, visual flags (yellow estimate / red threshold), a sticky info banner, and inline notes. Auto-save on blur is preserved.

### 1. Database — reseed + new keys

A migration will reseed `assumptions` with the exact rows from the spec, keyed for engine consumption.

New / changed keys:

- **Cash accounts (new, category `Opening Cash`)**: `cash_svb_mm` 51,428,680 · `cash_brex_treasury` 5,163,683 · `cash_brex_primary` 1,040,168 · `cash_svb_checking` 250,000 · `cash_stripe_clearing` 65,667. The legacy `opening_cash_balance` row is removed; the engine will sum these five.
- **Inflows**: `stripe_daily_rate` 64,990 · `stripe_growth_pct` 3 · `enterprise_ach_weekly` 344,060.
- **Payroll**: `payroll_semi_monthly` 659,000 · `payroll_processing_fee` 1,500 (new — added to each payroll-week outflow).
- **AI COGS**: `cogs_anthropic` 386,722 · `cogs_azure` 278,221 · `cogs_openai` 252,688 · `cogs_elevenlabs` 111,829 · `cogs_deepgram` 277,843 · `cogs_pump_aws` 374,471 · `cogs_twilio` 140,000 · `cogs_other` 96,000. Anthropic/Azure notes capture the 7% growth (engine applies it monthly the same way Stripe does — see §3).
- **Brex Card (new, category `Brex Card`)**: `brex_w2` 540,000 · `brex_w7` 551,000 · `brex_w11` 562,000. The hardcoded constants in `forecast.ts` are removed and these assumptions drive the model. All three flagged yellow.
- **OpEx**: `opex_sm` 720,000 · `opex_software` 55,000 · `opex_legal` 220,403 · `opex_deel` 231,870 · `opex_hr_te` 73,552 · `opex_recruiting` 165,000 (yellow) · `opex_ga` 75,000. `rent_may_sep` 32,417 · `rent_oct_plus` 64,835 stay in category `Rent`.
- **One-Time**: rename `one_time_w2` → `one_time_vendor_w2` 460,000 (yellow, note "vendor TBD"). The forecast engine reads the new key (engine update below).
- **Cash Threshold**: `min_cash_threshold` 15,000,000 (red border).
- **A/R Delay**: `ar_delay_days` 0.

A short `flag` column is **not** added — flags are derived in the UI from a static key→flag map (`yellow` / `red`). No schema column changes needed beyond the row reseed.

### 2. Forecast engine update (`src/lib/forecast.ts`)

Small adjustments to consume the new keys:

- `opening` = sum of the five `cash_*` keys (fallback to legacy `opening_cash_balance` if present, for safety on first run).
- Brex weeks read from `brex_w2`, `brex_w7`, `brex_w11` instead of the hardcoded constants.
- Payroll weeks add `payroll_processing_fee` once per payroll-week.
- Anthropic & Azure apply `(1 + 0.07)^monthIndex` to their monthly base (matches "7% growth" note). Other COGS vendors stay flat.
- `one_time_w2` lookup falls back to `one_time_vendor_w2`.

These changes are internal to the engine; the existing grid keeps working.

### 3. UI — `src/pages/Assumptions.tsx`

Replace the current category-grouped Cards with a hand-ordered section list driven by a static config. Each section has a title, optional subtitle, and rows.

**Top banner** (sticky-ish at top, blue/info style):

> Changes here take effect when you click **Generate Forecast** on the Dashboard.

**Section structure** (one Card per section):

1. **Opening Cash Balance (as of Apr 20, 2026)** — 5 editable rows + auto-summed read-only **TOTAL** row at bottom (bold, computed live from the 5 input states, not from DB). Total updates as user types so they get instant feedback before blur.
2. **Inflows** — stripe daily, growth %, enterprise ACH weekly.
3. **Payroll** — semi-monthly base, processing fee.
4. **AI COGS Vendors** — 8 rows; Anthropic/Azure show "(monthly base, 7% growth)" subtitle; Deepgram shows "one payment Apr 30 only".
5. **Brex Card Payments** — 3 rows, all yellow-flagged with a section subtitle "Estimates".
6. **Operating Expenses** — 9 rows including the two rent regimes; Recruiting flagged yellow; S&M shows the Montgomery Entertainment note.
7. **One-Time Payments** — single row, yellow, note "vendor TBD".
8. **Cash Threshold / Alert** — `min_cash_threshold` rendered with red border on the input.
9. **A/R Collection Delay Scenario** — `ar_delay_days` with helper note about ROUND(days/7).

**Row component (`AssumptionRow`)**:

- Label (left), inline notes (small muted text under label).
- Number input (right, `tabular-nums`, width 200px).
- `flag` prop: `yellow` adds `bg-estimate-yellow/40 border-estimate-yellow` to the input; `red` adds `border-warn-amber border-2`. Blue editable highlight (`bg-input-blue/30`) is the default.
- Auto-save on blur via existing `useUpdateAssumption` mutation; no save on every keystroke. Pressing Enter blurs.
- Skips save if value unchanged or NaN (existing logic).

**Auto-summed total row** for section 1: a non-editable row that reads the five local input states, sums them, and renders bold with `$` formatting via `formatCurrency`.

### 4. Section config (single source of truth)

A `const SECTIONS` array in `Assumptions.tsx` defines: `{ id, title, subtitle?, rows: [{ key, flag? }] }`. The page maps DB rows by `key` and renders strictly in this order, ignoring DB sort. Any DB row whose key isn't in the config is hidden (clean slate), which is fine because the migration reseeds the table.

### 5. Files touched

- `supabase/migrations/<new>.sql` — `DELETE FROM assumptions;` then `INSERT` all rows above with category, key, label, value, unit, notes.
- `src/lib/forecast.ts` — opening-cash sum, Brex-from-assumptions, payroll fee, Anthropic/Azure growth, key fallback.
- `src/pages/Assumptions.tsx` — full rewrite per UI spec above.
- `src/hooks/useFinanceData.ts` — no change (existing `useAssumptions` / `useUpdateAssumption` are sufficient).
- `src/index.css` — no change (existing `--input-blue`, `--estimate-yellow`, `--warn-amber` tokens are reused).

### Acceptance

- Page renders 9 sections in the order above with the exact labels and default values from the spec.
- Editing any input and blurring saves to Supabase and shows the existing "Assumption updated" toast.
- Opening Cash Balance section shows a live-updating bold TOTAL row (initially 57,948,198).
- Yellow-flagged rows have a yellow-tinted input; min-cash row has a red border.
- Banner is visible at the top of the page.
- Dashboard's Generate Forecast continues to work and now reflects the new Brex / payroll-fee / Anthropic-growth logic.

