export const formatCurrency = (value: number | null | undefined, opts?: { compact?: boolean }) => {
  const v = value ?? 0;
  if (opts?.compact) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(v);
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(v);
};

export const formatNumber = (value: number | null | undefined) =>
  new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(value ?? 0);

export const formatPercent = (value: number | null | undefined) =>
  `${(value ?? 0).toFixed(1)}%`;

export const formatDate = (value: string | Date) => {
  const d = typeof value === "string" ? new Date(value) : value;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

export const formatWeekRange = (startDate: Date) => {
  const end = new Date(startDate);
  end.setDate(end.getDate() + 6);
  return `${startDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${end.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
};
