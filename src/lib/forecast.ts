import { addDays, startOfWeek } from "date-fns";

export type AssumptionMap = Record<string, number>;

export interface ARForecastEntry {
  expected_collection_date: string;
  invoice_amount: number;
  status: string;
}

export interface HireForecastEntry {
  start_date: string;
  annual_salary: number;
}

export interface ForecastWeek {
  weekIndex: number;
  weekStartDate: Date;
  openingBalance: number;
  stripeRevenue: number;
  enterpriseRevenue: number;
  arCollections: number;
  payroll: number;
  cogs: number;
  cardPayments: number;
  rent: number;
  opex: number;
  totalInflows: number;
  totalOutflows: number;
  netChange: number;
  closingBalance: number;
}

export interface ForecastResult {
  weeks: ForecastWeek[];
  averageWeeklyBurn: number;
  runwayWeeks: number | null;
  endingBalance: number;
}

export const buildAssumptionMap = (
  rows: Array<{ key: string; value: number | string }>
): AssumptionMap => {
  const map: AssumptionMap = {};
  for (const row of rows) {
    map[row.key] = typeof row.value === "string" ? parseFloat(row.value) : row.value;
  }
  return map;
};

const monthStartIndices = (weeks: number) => {
  // Treat week 0 as start of payment month; pay rent/opex/card on week 0, 4, 8...
  const indices: number[] = [];
  for (let i = 0; i < weeks; i += 4) indices.push(i);
  return indices;
};

export const buildForecast = (
  assumptions: AssumptionMap,
  arEntries: ARForecastEntry[],
  hires: HireForecastEntry[],
  weeksCount = 13,
  startDate?: Date
): ForecastResult => {
  const start = startOfWeek(startDate ?? new Date(), { weekStartsOn: 1 });

  const opening = assumptions["opening_cash_balance"] ?? 0;
  const stripeBase = assumptions["stripe_weekly_revenue"] ?? 0;
  const stripeGrowth = (assumptions["stripe_growth_rate_weekly"] ?? 0) / 100;
  const enterpriseMonthly = assumptions["enterprise_monthly_ach"] ?? 0;
  const biweeklyPayroll = assumptions["biweekly_payroll"] ?? 0;
  const payrollTaxesPct = (assumptions["payroll_taxes_pct"] ?? 0) / 100;
  const cogsPct = (assumptions["cogs_pct_of_revenue"] ?? 0) / 100;
  const monthlyRent = assumptions["monthly_rent"] ?? 0;
  const monthlyOpex = assumptions["monthly_opex"] ?? 0;
  const monthlyCard = assumptions["monthly_card_payments"] ?? 0;

  const monthlyWeeks = monthStartIndices(weeksCount);

  const weeks: ForecastWeek[] = [];
  let runningBalance = opening;

  for (let i = 0; i < weeksCount; i++) {
    const weekStart = addDays(start, i * 7);
    const weekEnd = addDays(weekStart, 6);

    // Stripe revenue with growth
    const stripeRevenue = stripeBase * Math.pow(1 + stripeGrowth, i);

    // Enterprise revenue: assume monthly ACH paid week 1 of each "month" (every 4 weeks)
    const enterpriseRevenue = monthlyWeeks.includes(i) ? enterpriseMonthly : 0;

    // A/R collections falling in this week
    const arCollections = arEntries
      .filter((e) => {
        if (e.status === "written_off" || e.status === "collected") return false;
        const d = new Date(e.expected_collection_date);
        return d >= weekStart && d <= weekEnd;
      })
      .reduce((sum, e) => sum + Number(e.invoice_amount), 0);

    // Payroll bi-weekly (every 2 weeks starting week 0). Add new hires pro-rated.
    let payroll = 0;
    if (i % 2 === 0) {
      payroll = biweeklyPayroll * (1 + payrollTaxesPct);
      // add hires already started
      const activeHires = hires.filter((h) => new Date(h.start_date) <= weekEnd);
      const hireBiweekly = activeHires.reduce(
        (sum, h) => sum + (Number(h.annual_salary) / 26) * (1 + payrollTaxesPct),
        0
      );
      payroll += hireBiweekly;
    }

    // COGS as % of total revenue
    const cogs = (stripeRevenue + enterpriseRevenue) * cogsPct;

    // Monthly outflows
    const isMonthStart = monthlyWeeks.includes(i);
    const cardPayments = isMonthStart ? monthlyCard : 0;
    const rent = isMonthStart ? monthlyRent : 0;
    const opex = isMonthStart ? monthlyOpex : 0;

    const totalInflows = stripeRevenue + enterpriseRevenue + arCollections;
    const totalOutflows = payroll + cogs + cardPayments + rent + opex;
    const netChange = totalInflows - totalOutflows;
    const openingBalance = runningBalance;
    const closingBalance = openingBalance + netChange;
    runningBalance = closingBalance;

    weeks.push({
      weekIndex: i,
      weekStartDate: weekStart,
      openingBalance,
      stripeRevenue,
      enterpriseRevenue,
      arCollections,
      payroll,
      cogs,
      cardPayments,
      rent,
      opex,
      totalInflows,
      totalOutflows,
      netChange,
      closingBalance,
    });
  }

  const burns = weeks.map((w) => Math.max(0, -w.netChange));
  const averageWeeklyBurn = burns.reduce((a, b) => a + b, 0) / Math.max(1, weeks.length);
  const endingBalance = weeks[weeks.length - 1]?.closingBalance ?? opening;
  const runwayWeeks = averageWeeklyBurn > 0 ? opening / averageWeeklyBurn : null;

  return { weeks, averageWeeklyBurn, runwayWeeks, endingBalance };
};
