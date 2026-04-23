import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowDownRight, ArrowUpRight, Calendar, Flame, TrendingUp, Wallet } from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { useAssumptions, useArEntries, useFutureHires } from "@/hooks/useFinanceData";
import { buildAssumptionMap, buildForecast } from "@/lib/forecast";
import { formatCurrency, formatNumber } from "@/lib/format";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

const Kpi = ({
  label,
  value,
  sub,
  icon: Icon,
  tone = "default",
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ComponentType<{ className?: string }>;
  tone?: "default" | "positive" | "negative" | "warning";
}) => {
  const toneClass = {
    default: "bg-accent text-accent-foreground",
    positive: "bg-[hsl(var(--success))]/10 text-[hsl(var(--success))]",
    negative: "bg-destructive/10 text-destructive",
    warning: "bg-[hsl(var(--warning))]/10 text-[hsl(var(--warning))]",
  }[tone];

  return (
    <Card>
      <CardContent className="flex items-start gap-4 p-6">
        <div className={cn("flex h-11 w-11 items-center justify-center rounded-lg", toneClass)}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <div className="text-sm text-muted-foreground">{label}</div>
          <div className="mt-1 text-2xl font-semibold tracking-tight text-foreground">{value}</div>
          {sub && <div className="mt-0.5 text-xs text-muted-foreground">{sub}</div>}
        </div>
      </CardContent>
    </Card>
  );
};

export default function Dashboard() {
  const { data: assumptions, isLoading: aLoading } = useAssumptions();
  const { data: arEntries, isLoading: arLoading } = useArEntries();
  const { data: hires, isLoading: hLoading } = useFutureHires();

  const loading = aLoading || arLoading || hLoading;

  const forecast = useMemo(() => {
    if (!assumptions) return null;
    const map = buildAssumptionMap(assumptions);
    return buildForecast(
      map,
      arEntries?.map((e) => ({
        expected_collection_date: e.expected_collection_date,
        invoice_amount: Number(e.invoice_amount),
        status: e.status,
      })) ?? [],
      hires?.map((h) => ({
        start_date: h.start_date,
        annual_salary: Number(h.annual_salary),
      })) ?? []
    );
  }, [assumptions, arEntries, hires]);

  const openingCash = forecast?.weeks[0]?.openingBalance ?? 0;
  const burn = forecast?.averageWeeklyBurn ?? 0;
  const runway = forecast?.runwayWeeks;
  const ending = forecast?.endingBalance ?? 0;

  const chartData = forecast?.weeks.map((w) => ({
    week: `W${w.weekIndex + 1}`,
    balance: Math.round(w.closingBalance),
  }));

  if (loading || !forecast) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
        <Skeleton className="h-72" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi
          label="Current Cash"
          value={formatCurrency(openingCash, { compact: true })}
          sub="Opening balance"
          icon={Wallet}
        />
        <Kpi
          label="Avg Weekly Burn"
          value={formatCurrency(burn, { compact: true })}
          sub="13-week average"
          icon={Flame}
          tone={burn > 0 ? "warning" : "positive"}
        />
        <Kpi
          label="Runway"
          value={runway ? `${formatNumber(runway)} wks` : "∞"}
          sub={runway ? `~${formatNumber(runway / 4.33)} months` : "Cash positive"}
          icon={Calendar}
          tone={runway && runway < 26 ? "negative" : "default"}
        />
        <Kpi
          label="Ending Balance (W13)"
          value={formatCurrency(ending, { compact: true })}
          sub={ending >= openingCash ? "Growing" : "Declining"}
          icon={ending >= openingCash ? ArrowUpRight : ArrowDownRight}
          tone={ending >= openingCash ? "positive" : "negative"}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="h-4 w-4 text-primary" /> Cash Balance — Next 13 Weeks
          </CardTitle>
        </CardHeader>
        <CardContent className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="week" stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <YAxis
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
                tickFormatter={(v) => formatCurrency(v, { compact: true })}
              />
              <Tooltip
                contentStyle={{
                  background: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "0.5rem",
                  fontSize: "0.875rem",
                }}
                formatter={(v: number) => formatCurrency(v)}
              />
              <Line
                type="monotone"
                dataKey="balance"
                stroke="hsl(var(--primary))"
                strokeWidth={2.5}
                dot={{ r: 3, fill: "hsl(var(--primary))" }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">13-Week Forecast</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="sticky left-0 bg-card">Line item</TableHead>
                {forecast.weeks.map((w) => (
                  <TableHead key={w.weekIndex} className="text-right text-xs">
                    W{w.weekIndex + 1}
                    <div className="font-normal text-muted-foreground">
                      {w.weekStartDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </div>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {[
                ["Stripe Revenue", "stripeRevenue", "in"],
                ["Enterprise ACH", "enterpriseRevenue", "in"],
                ["A/R Collections", "arCollections", "in"],
                ["Payroll", "payroll", "out"],
                ["COGS", "cogs", "out"],
                ["Card Payments", "cardPayments", "out"],
                ["Rent", "rent", "out"],
                ["OPEX", "opex", "out"],
              ].map(([label, key, dir]) => (
                <TableRow key={key as string}>
                  <TableCell className="sticky left-0 bg-card font-medium">{label}</TableCell>
                  {forecast.weeks.map((w) => {
                    const v = (w as any)[key as string] as number;
                    return (
                      <TableCell
                        key={w.weekIndex}
                        className={cn(
                          "text-right tabular-nums",
                          dir === "out" && v > 0 && "text-destructive/80"
                        )}
                      >
                        {v ? formatCurrency(v, { compact: true }) : "—"}
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
              <TableRow className="border-t-2 font-semibold">
                <TableCell className="sticky left-0 bg-card">Net Change</TableCell>
                {forecast.weeks.map((w) => (
                  <TableCell
                    key={w.weekIndex}
                    className={cn(
                      "text-right tabular-nums",
                      w.netChange < 0 ? "text-destructive" : "text-[hsl(var(--success))]"
                    )}
                  >
                    {formatCurrency(w.netChange, { compact: true })}
                  </TableCell>
                ))}
              </TableRow>
              <TableRow className="bg-accent/30 font-semibold">
                <TableCell className="sticky left-0 bg-accent/30">Closing Balance</TableCell>
                {forecast.weeks.map((w) => (
                  <TableCell key={w.weekIndex} className="text-right tabular-nums text-primary">
                    {formatCurrency(w.closingBalance, { compact: true })}
                  </TableCell>
                ))}
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
