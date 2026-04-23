
# Vapi Cash Flow — Internal Financial Operations App (Revised)

A team-only 13-week cash flow forecasting tool with Google sign-in restricted to @vapi.ai, deterministic forecasting from assumptions + A/R, and weekly actuals tracking for variance analysis.

## 1. Backend (Lovable Cloud / Supabase)

**Tables** (RLS: read/write for any authenticated user with email ending in `@vapi.ai`):
- `assumptions` — key/value store for all model inputs
- `ar_entries` — accounts receivable line items
- `future_hires` — upcoming hires affecting payroll
- `weekly_actuals` — actual cash flow per week (for variance)
- `model_weeks` — saved forecast snapshots (one row per week per run)

**Seeding**: On first app load, if `assumptions` is empty, insert all 17 seed key/value pairs with friendly labels.

**Auth**: Supabase Google OAuth. After Google returns, check email domain — if not `@vapi.ai`, sign out and show "Access restricted to Vapi team members."

## 2. App Shell

- **Sidebar (dark navy #1F3864)**: Dashboard (13-Week Model), Assumptions, A/R Schedule, Future Hires. Active item highlighted blue (#2F5496). Collapses on mobile.
- **Top bar (white)**: "Vapi Cash Flow" left, current model week + last-updated center, user avatar + sign-out right.
- **Content**: white background, blue (#2F5496) accents.

## 3. Dashboard — 13-Week Model

**Empty state**: "No model data yet — go to Assumptions to review inputs, then click Generate Forecast." with primary CTA.

**With data**:
- KPI strip: current cash, weekly burn, runway (months), weeks until min cash threshold breach (red if <13).
- **Generate Forecast** button — recomputes 13 weeks, saves snapshot to `model_weeks`.
- 13-week table (cols=weeks, rows=line items) with subtotals: Inflows (Stripe, Enterprise ACH, A/R) → Total Inflows; Outflows (Payroll, COGS lines → COGS Total, Card Payment, OPEX lines → OPEX Total) → Total Outflows; Net CF; Closing Balance (red below threshold).
- Cash balance line chart with min-cash threshold line.
- Inline-editable actuals row for past weeks → `weekly_actuals` with variance badges.

## 4. Assumptions Page

Grouped sections (Cash & Revenue, Payroll, COGS, OPEX, Rent, Other). Each row: label, numeric input, "is estimate" toggle, notes, last updated by/at. Inline save; Dashboard shows "needs regenerate" indicator.

## 5. A/R Schedule Page

Table of `ar_entries`: customer, invoice #, amount, aging days, probability %, expected week (1–13), notes. Add/edit/delete. Footer shows expected collection per week (amount × probability).

## 6. Future Hires Page

Table of `future_hires`: name, role, annual salary, start date, status badge, notes. Confirmed hires whose start_date falls in window add to that week's payroll.

## 7. Forecast Calculation (client-side, deterministic) — REVISED

For each of 13 weeks starting from current week:

**Stripe revenue**:
- 5 business days per week.
- Growth applied per calendar month (not compounded weekly): determine the calendar month each week falls in; effective_daily_rate = `stripe_daily_rate × (1 + stripe_growth_pct/100)^(months_elapsed_since_start)`.
- Weekly revenue = `effective_daily_rate × 5`.

**Enterprise ACH** = `enterprise_ach_weekly` every week.

**A/R collections** = sum of `ar_entries` where `expected_week = w`, weighted by `probability_pct/100`, shifted by `ar_delay_days`.

**Payroll** = `payroll_semi_monthly` in weeks **W2, W4, W6, W8, W10, W12** (clears 2 days before the 15th and last day of each month). Plus pro-rated salary of confirmed `future_hires` once `start_date` ≤ that week's date, added to those same payroll weeks.

**COGS — lump-sum vendor payments at fixed weeks**:
| Vendor      | Weeks & amounts |
|-------------|-----------------|
| Anthropic   | W2 $386,722, W7 $413,793, W11 $442,758 |
| Azure       | W3 $278,221, W8 $297,697, W12 $318,536 |
| OpenAI      | W2/W7/W11 $252,688 each |
| ElevenLabs  | W3/W8/W12 $111,829 each |
| Deepgram    | W2 $277,843 only |
| Pump        | W4/W9/W13 $374,471 each |
| Twilio      | W3/W8/W12 $140,000 each |

These zero out in weeks not listed. `other_cogs` (if any) = monthly ÷ 4.333 smoothed every week. `cogs_total` = sum of all vendor lines that week.

**Card Payment (Brex)** — lump sums: W2 $540,000, W7 $551,000, W11 $562,000.

**Rent** — lump sums at W2/W7/W11 $32,417 each (uses May–Sep rate; switches to `rent_oct_plus` for any of those weeks falling in Oct or later).

**OPEX (smoothed)** — every week = monthly ÷ 4.333 for: S&M, Software, Legal, Deel, HR&E, Recruiting, G&A.

**One-time W2 ($460,000)** added to **W2 G&A**.

**Closing balance** = opening + total_inflows − total_outflows; carries to next week's opening. Week 1 opening = `opening_balance` assumption.

**Burn rate** = 4-week trailing rolling average of net_cf × −4.333 (monthly burn). For W1–W3 use however many prior weeks are available (including current).

**Runway (months)** = current closing balance ÷ burn_rate (guard against zero/negative burn).

Snapshot all 13 rows to `model_weeks` with shared `model_run_at` timestamp.

## 8. Polish

Loading skeletons, toast confirmations, currency formatting ($1.23M / $123K), KPI tooltips, mobile-responsive sidebar.
