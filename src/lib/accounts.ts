// Single source of truth for bank account registry.
// Rows live in public.accounts (Supabase). Code never hard-codes the
// 7 operating + 2 restricted accounts — to add a new account, insert a row.
import { supabase } from "@/integrations/supabase/client";
import { BANK_TO_ASSUMPTION_KEY, type BankSource } from "./bankParsers/types";

export type ParserType = "brex" | "svb_bai" | "svb_sweep" | "ramp_feed" | "stripe";

export interface AccountRow {
  id: string;
  label: string;
  institution: string;
  last4: string | null;
  parser_type: ParserType;
  assumption_key: string;
  detection_signature: {
    header_tokens?: string[];
    account_value?: string;
  };
  is_restricted: boolean;
  is_active: boolean;
  sort_order: number;
}

// Reverse of BANK_TO_ASSUMPTION_KEY: lets us map an account's assumption_key
// back to the legacy BankSource enum (which is still used by bank_transactions
// and the parser routing layer).
export const ASSUMPTION_KEY_TO_BANK_SOURCE: Record<string, BankSource> = Object.fromEntries(
  Object.entries(BANK_TO_ASSUMPTION_KEY).map(([src, key]) => [key, src as BankSource]),
) as Record<string, BankSource>;

export const accountToBankSource = (a: Pick<AccountRow, "assumption_key">): BankSource | null =>
  ASSUMPTION_KEY_TO_BANK_SOURCE[a.assumption_key] ?? null;

export const loadAccounts = async (): Promise<AccountRow[]> => {
  // Cast through unknown until the generated types file picks up the new table.
  const { data, error } = await (supabase as unknown as {
    from: (t: string) => {
      select: (s: string) => {
        order: (c: string, opts: { ascending: boolean }) => Promise<{ data: AccountRow[] | null; error: { message: string } | null }>;
      };
    };
  })
    .from("accounts")
    .select("*")
    .order("sort_order", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
};

// Active, non-restricted accounts → assumption keys used by buildForecast
// to sum opening cash.
export const activeSpendableCashKeys = (accounts: AccountRow[]): string[] =>
  accounts.filter((a) => a.is_active && !a.is_restricted).map((a) => a.assumption_key);

// Restricted assumption keys (excluded from spendable cash).
export const restrictedCashKeys = (accounts: AccountRow[]): string[] =>
  accounts.filter((a) => a.is_active && a.is_restricted).map((a) => a.assumption_key);
