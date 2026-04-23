

## A/R Schedule Tab Rebuild (final)

Same as the prior approved plan, with this single correction:

### Toggle behavior fix

- The **"Use probability-weighted"** toggle controls the **summary strip display only**.
- **Apply to Model always sends probability-weighted amounts** (`amount × probability%`) to the forecast engine, regardless of the toggle state.
- A small muted note is shown next to the toggle: *"Display toggle only — model always uses probability-weighted amounts."*

### Everything else unchanged

**Part 1 — Inline invoice table**
Editable grid: Customer · Invoice # · Amount · Aging Days (computed) · Probability % (auto from bucket, override stored as `__prob_override:NN` in `notes`) · Expected Week (1–13 dropdown, persisted via `expected_collection_date`) · Notes · Delete. Add row button. Auto-save on blur via existing `useUpsertArEntry`. Footer shows total amount + total probability-weighted collections.

**Part 2 — CSV upload**
Drag-and-drop dropzone above the table. Hand-written CSV parser (no new deps) tolerant to QuickBooks A/R Aging Summary headers (`Customer`/`Customer Name`, `Invoice Amount`/`Amount`/`Open Balance`, `Aging Days`/`Days Past Due`, optional `Due Date`, `Invoice #`/`Num`). Auto-fill probability and expected week per aging bucket (0–30 → W1–W2 round-robin, 31–60 → W3–W5, 61–90 → W6–W8, 90+ → W9–W10). Preview modal with row checkboxes + editable expected week before commit.

**Part 3 — Weekly SUMIF strip + Apply to Model**
13-column footer strip showing per-week totals, shifted by `ROUND(ar_delay_days/7, 0)` from Assumptions. Toggle switches the strip between weighted and raw display. **Apply to Model** button always writes probability-weighted weeks to a new `ar_weekly_overrides` table; forecast engine reads the latest override for the current forecast start and uses it for the A/R Collections row, falling back to per-invoice bucketing if no override exists.

### Files

- New migration: `ar_weekly_overrides` table (id, forecast_start, delay_days, weeks jsonb, created_by, created_at) with authenticated RLS.
- `src/hooks/useFinanceData.ts` — add `useArWeeklyOverride`, `useApplyArOverride`.
- `src/lib/forecast.ts` — accept optional `arOverride` and use its `weeks[]` when present.
- `src/pages/Dashboard.tsx` — pass latest override to `buildForecast`.
- `src/pages/ArSchedule.tsx` — full rewrite.
- New: `src/lib/parseArCsv.ts`, `src/components/ar/ArInlineRow.tsx`, `src/components/ar/CsvDropzone.tsx`, `src/components/ar/CsvPreviewDialog.tsx`, `src/components/ar/WeeklySummaryStrip.tsx`.

### Acceptance

- Toggle changes the strip's visible numbers but never changes what Apply to Model writes.
- Disclaimer text is visible next to the toggle.
- All other behaviors (inline edit, CSV import preview, delay shift, override-driven Dashboard A/R row) work as in the prior plan.

