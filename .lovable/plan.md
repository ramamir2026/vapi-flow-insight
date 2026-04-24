# Monday Morning Checklist Widget

Replace the existing `WeeklyChecklist` (currently at the bottom of the Dashboard) with a richer Monday Morning Checklist that lives at the top, behaves contextually, links each step to its destination page, and auto-checks items when the corresponding action happens in the app.

## Behavior

- **Placement**: top of `Dashboard.tsx`, above `BalanceVerificationBanner` and KPI cards.
- **Visibility**: renders when either:
  1. Today is Monday (local time), or
  2. The most recent forecast snapshot (`model_weeks.created_at` max) is more than 6 days old, or none exists.
- **Auto-collapse**: once all active items are checked, the widget collapses to a green success banner: `"Model updated — Week of {Monday date}"`. A small "Show checklist" link re-expands it.
- **Critical-alerts item (15th)**: if `useOpenAlerts()` returns any alert with `severity === "critical"`, append item key `resolve_critical_alerts` ("Resolve or dismiss all critical alerts"), styled red. It counts toward the "all done" check.
- **Reset cadence**: state is keyed by the current Monday's ISO date. Next Monday → new key → completions naturally reset.
- **Persistence**:
  - **Server**: existing `weekly_checklist` table via `useWeeklyChecklist` / `useToggleChecklistItem` (already keyed by `week_start_date`, shared across users).
  - **localStorage mirror** under `mondayChecklist:{week}` for instant restore on refresh while the server query loads.

## Checklist items

Stable keys with labels, optional `to` (router path), and `auto` flag.

| # | Key | Label | Link | Auto-check trigger |
|---|---|---|---|---|
| 1 | `dl_brex_primary` | Download Brex Primary transactions CSV — last 90 days | — | manual |
| 2 | `dl_brex_treasury` | Download Brex Treasury transactions CSV — last 90 days | — | manual |
| 3 | `dl_svb_checking` | Download SVB Analysis Checking transactions CSV — last 90 days | — | manual |
| 4 | `dl_statements` | Download most recent monthly statements for all 5 accounts | — | manual |
| 5 | `upload_txns` | Upload all transaction CSVs → Bank Imports (auto-detected) | `/bank-imports` | manual |
| 6 | `upload_statements` | Upload statements → Statements tab → confirm opening balances match | `/bank-imports?tab=statements` | manual |
| 7 | `upload_ar` | Upload QuickBooks A/R Aging Summary CSV → A/R Schedule | `/ar-schedule` | manual |
| 8 | `check_hiring` | Check hiring plan for new accepts or start date changes | `/future-hires` | manual |
| 9 | `ar_apply` | Hit Apply to Model on A/R Schedule | `/ar-schedule` | **auto** on Apply (A/R) |
| 10 | `hires_apply` | Hit Apply to Model on Future Hires | `/future-hires` | **auto** on Apply (Hires) |
| 11 | `update_balances` | Update the 5 bank balances in Assumptions if statement showed mismatch | `/assumptions` | manual |
| 12 | `generate_forecast` | Go to Dashboard → hit Generate Forecast | `/dashboard?focus=generate` | manual |
| 13 | `review` | Review numbers — burn, headroom vs $15M floor, red/amber alerts | — | manual |
| 14 | `signoff` | Sign off prior week | — | **auto** on week sign-off |
| 15* | `resolve_critical_alerts` | Resolve or dismiss all critical alerts | `/dashboard#alerts` | manual |

Item 1's row also shows the helper text: *"Brex → Transactions → Export. Re-uploading is safe; duplicates are ignored."*

Auto-checked items remain visually identical to manually checked ones (same checkbox state, same line-through), and users can still uncheck them manually.

## Implementation

### Files to add / change

1. **`src/components/dashboard/MondayChecklist.tsx`** (new)
   - Owns visibility, item rendering, auto-collapse, and success banner.
   - Uses `useWeeklyChecklist` + `useToggleChecklistItem`, plus `useOpenAlerts` for the conditional 15th item.
   - localStorage mirror via small `useEffect` reading/writing `mondayChecklist:{weekIso}`.
   - Items with `to` render the label as a `<Link>` (router) sitting next to the checkbox so clicking the label navigates and clicking the box toggles independently.

2. **`src/hooks/useBankData.ts`**
   - Add `useAutoCheckChecklistItem()` — a thin wrapper around `useToggleChecklistItem` that:
     - Computes `mondayOf(today)` internally,
     - Pulls user email from `useAuth()`,
     - Exposes `markDone(itemKey: string)` which upserts only if the row is not already completed (avoid stomping a manual completion timestamp).
   - This keeps call sites trivial and consistent.

3. **`src/pages/ArSchedule.tsx`**
   - In `handleApplyToModel`, after `applyOverride.mutate(...)` resolves successfully, call `markDone("ar_apply")`.

4. **`src/pages/FutureHires.tsx`**
   - In `handleApplyToModel`, after `apply.mutate(...)` resolves, call `markDone("hires_apply")`.

5. **`src/pages/Dashboard.tsx`**
   - Render `<MondayChecklist />` as the first child (above `BalanceVerificationBanner`).
   - Remove the bottom `<WeeklyChecklist />` instance and its import (file left in place, unused).
   - Wrap the `onSignOff` handler so that after `signOff.mutate(iso)` succeeds it calls `markDone("signoff")`.
   - If `?focus=generate` is in the URL, briefly highlight the Generate Forecast button (2s pulse ring via a ref + class toggle).

6. **`src/hooks/useFinanceData.ts`**
   - Add `useLatestForecastAt()` — selects `created_at` from `model_weeks` ordered desc, limit 1; returns a `Date | null`. Used by the widget for the "stale > 6 days" visibility check.

### Visibility logic

```ts
const isMonday = new Date().getDay() === 1;
const stale = !lastForecastAt || (Date.now() - lastForecastAt.getTime()) > 6 * 24 * 3600 * 1000;
const shouldShow = isMonday || stale;
```

### Auto-check helper (sketch)

```ts
// inside handleApplyToModel on ArSchedule.tsx
await applyOverride.mutateAsync({ weeks, delay_days });
markDone("ar_apply"); // no-op if already completed for this week
```

`markDone` performs the upsert with `completed: true` only when the current server state for `(week, key)` is not already `completed === true`.

### Completion + collapse

- `activeItems` = base 14 + optional `resolve_critical_alerts`.
- `allDone = activeItems.every(i => completedKeys.has(i.key))`.
- When `allDone && !manuallyExpanded`, render only the green banner with a "Show checklist" ghost button to re-expand (session-local state).

### Routing notes

- Existing routes confirmed: `/dashboard`, `/bank-imports`, `/ar-schedule`, `/future-hires`, `/assumptions`.
- `?tab=statements` and `?focus=generate` are additive; Bank Imports and Dashboard read them defensively (no-op when absent).

## Out of scope

- No schema changes to `weekly_checklist`.
- No new alert logic — we only read existing `useOpenAlerts()`.
- The old `WeeklyChecklist.tsx` file stays in place but unused on the Dashboard.
