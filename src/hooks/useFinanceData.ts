import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// ============ Assumptions ============
export type Assumption = {
  id: string;
  category: string;
  key: string;
  label: string;
  value: number;
  unit: string | null;
  notes: string | null;
};

export const useAssumptions = () =>
  useQuery({
    queryKey: ["assumptions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assumptions")
        .select("*")
        .order("category")
        .order("label");
      if (error) throw error;
      return (data ?? []) as Assumption[];
    },
  });

export const useUpdateAssumption = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, value }: { id: string; value: number }) => {
      const { error } = await supabase.from("assumptions").update({ value }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["assumptions"] });
      toast.success("Assumption updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });
};

// ============ A/R entries ============
export type ArEntry = {
  id: string;
  customer_name: string;
  invoice_number: string | null;
  invoice_amount: number;
  invoice_date: string;
  expected_collection_date: string;
  status: "pending" | "collected" | "overdue" | "written_off";
  notes: string | null;
};

export const useArEntries = () =>
  useQuery({
    queryKey: ["ar_entries"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ar_entries")
        .select("*")
        .order("expected_collection_date");
      if (error) throw error;
      return (data ?? []) as ArEntry[];
    },
  });

export const useUpsertArEntry = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (entry: Partial<ArEntry> & { id?: string }) => {
      if (entry.id) {
        const { id, ...rest } = entry;
        const { error } = await supabase.from("ar_entries").update(rest).eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("ar_entries").insert(entry as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ar_entries"] });
      toast.success("Saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });
};

export const useDeleteArEntry = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("ar_entries").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ar_entries"] });
      toast.success("Deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });
};

// ============ Future hires ============
export type FutureHire = {
  id: string;
  name: string;
  role: string;
  department: string | null;
  start_date: string;
  annual_salary: number;
  notes: string | null;
};

export const useFutureHires = () =>
  useQuery({
    queryKey: ["future_hires"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("future_hires")
        .select("*")
        .order("start_date");
      if (error) throw error;
      return (data ?? []) as FutureHire[];
    },
  });

export const useUpsertHire = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (hire: Partial<FutureHire> & { id?: string }) => {
      if (hire.id) {
        const { id, ...rest } = hire;
        const { error } = await supabase.from("future_hires").update(rest).eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("future_hires").insert(hire as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["future_hires"] });
      toast.success("Saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });
};

export const useDeleteHire = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("future_hires").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["future_hires"] });
      toast.success("Deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });
};
