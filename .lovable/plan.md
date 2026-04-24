

## COSO Internal Controls & Audit Trail

End-to-end controls layer: append-only audit log via DB triggers, role-based permissions (viewer/editor/approver), week sign-offs, import-lock with approver override, an Audit Log page, and audit context surfaced throughout the UI.

### 1. Database

**Migration: `audit_log` (append-only)**
- Columns: `id uuid pk`, `user_email text`, `action text` (insert/update/delete/approve/import/override), `table_name text`, `row_id uuid`, `field_name text`, `old_value text`, `new_value text`, `source text` (manual/import/approver_override), `import_filename text`, `created_at timestamptz default now()`.
- RLS: SELECT for authenticated; **INSERT only via security-definer trigger functions**; **no UPDATE policy, no DELETE policy** → effectively append-only.
- Index: `(table_name, row_id)`, `(created_at desc)`, `(user_email)`.

**Trigger function `public.log_audit()`**
- `SECURITY DEFINER`, captures `auth.jwt()->>'email'`, diffs OLD vs NEW per column, writes one row per changed field on UPDATE, one row on INSERT/DELETE. Reads `current_setting('app.source', true)` to tag `source` and `import_filename` (defaults to `manual`).
- Attached as `AFTER INSERT/UPDATE/DELETE` on: `assumptions`, `ar_entries`, `future_hires`, `weekly_actuals`, `model_weeks`.

**Migration: extend `user_roles`** (already exists with admin/user)
- Add new enum values to `app_role`: `viewer`, `editor`, `approver`.
- Seed `ram@vapi.ai` as `approver` (and keep existing `user` rows as `editor` by default via a one-time UPDATE).
- Helper SQL function `current_user_role()` returning highest role for `auth.uid()`.

**Migration: `week_signoffs`**
- Columns: `id uuid pk`, `week_start_date date unique`, `approved_by_email text`, `approved_by_user_id uuid`, `approved_at timestamptz default now()`, `note text`.
- RLS: SELECT all authenticated; INSERT/DELETE only when `has_role(auth.uid(),'approver')`.

**Migration: import metadata on row tables**
- Add columns to `ar_entries`, `future_hires`, `weekly_actuals`: `source text default 'manual'`, `import_filename text`, `import_locked boolean default false`.
- Add columns to backfill: existing rows stay `manual`/unlocked.

### 2. Hooks & client plumbing (`src/hooks/useFinanceData.ts` + new files)

- `useCurrentRole()` — selects the user's role from `user_roles` joined to `profiles.email`. Returns `'viewer' | 'editor' | 'approver'`.
- `useWeekSignoffs()` + `useSignOffWeek()` + `useUnsignWeek()` (approver-only).
- `useAuditLog({ filters })` — paginated query for the Audit Log page.
- `useLastUpdatedByWeek()` — groups latest audit_log rows by `week_start_date` (derived from row → week) for the per-column "Updated by" header chip.
- `useOverrideImportLock()` — clears `import_locked`, sets `source='approver_override'`, then a normal UPDATE proceeds; the trigger logs the change with `action='override'`.
- CSV importers in A/R, Future Hires, Weekly Actuals: before insert, call `supabase.rpc('set_import_context', { filename })` which sets `app.source='import'` + `app.import_filename` for the txn so triggers tag rows correctly. New columns `source='import'`, `import_filename`, `import_locked=true` are also written explicitly on the inserted rows.

### 3. UI changes

**Sidebar (`AppLayout.tsx`)**
- Add nav item **Audit Log** (`/audit-log`, `ScrollText` icon).
- Show role chip under user email ("Approver" / "Editor" / "Viewer").

**Role gating**
- New `<RoleGate role="editor|approver">` component wraps edit affordances. Viewers see grids in read-only mode (inputs become text, Add/Delete buttons hidden). Editors get current behavior. Approvers additionally see Sign-off and Override buttons.

**Dashboard (`ForecastGrid.tsx` + `Dashboard.tsx`)**
- Each week column header gets a stacked footer chip: green ✓ "Approved by ram@vapi.ai · Apr 22" when signed-off; otherwise "Sign off" button (approver-only). Signed-off weeks: actuals cells in that week become read-only and get a subtle green tint.
- Below the week label, a small muted line: "Updated by {email}, {date time}" pulled from `useLastUpdatedByWeek()`.
- Pass `signoffs` map into `ForecastGrid`; `ActualsCell` accepts `locked` + `lockReason` props.

**A/R, Future Hires, Weekly Actuals grids**
- Cells derived from imported rows render with `bg-muted` gray background and are read-only.
- A small lock icon in the row's action column. For approvers, hovering reveals an "Override" button that calls `useOverrideImportLock()`; the next edit is allowed and trigger-logged as `approver_override`.

**Audit Log page (`src/pages/AuditLog.tsx`)**
- Filter bar: user (combobox of distinct emails), date range (date picker), table (multi-select), action (multi-select).
- Table: timestamp · user · action (badge) · table · field · old → new · source (chip with filename when import). Pagination 50/page.
- "Export CSV" button writes filtered set via SheetJS (already in deps) — purely client-side.
- **No delete button anywhere**, ever.

### 4. Excel export (`src/lib/exportExcel.ts`)
- Add second sheet **"Audit"**: pulls `audit_log` rows whose `created_at` falls within the snapshot's forecast window. Columns mirror the page table.

### 5. Acceptance

- Editing any tracked table writes one audit_log row per changed field; trying to DELETE from `audit_log` errors out (no policy).
- `ram@vapi.ai` sees Sign-off buttons and Override actions; other users do not.
- Imported A/R / hires / actuals rows render gray and read-only until an approver overrides.
- Signed-off week locks all actuals cells in that column and shows a green ✓ with name + date.
- Audit Log page filters and exports to CSV; sidebar shows Audit Log entry.
- Excel download contains an "Audit" sheet alongside "13-Week Forecast".

