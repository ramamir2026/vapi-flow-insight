// Lightweight CSV parser for Future Hires imports. No external deps.
// Tolerant of common header variations.

export type HireStatus = "confirmed" | "offer_sent" | "interviewing";

export type ParsedHireRow = {
  name: string;
  role: string;
  annualSalary: number;
  startDate: string; // YYYY-MM-DD
  status: HireStatus;
  notes: string;
};

const splitCsvLine = (line: string): string[] => {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out.map((s) => s.trim());
};

const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

type Field = "name" | "role" | "salary" | "startDate" | "status" | "notes";

// Higher priority wins when multiple columns could map to the same field.
// e.g. "Compensation" beats "Base Salary"; "Start Date" beats "Est Start Date";
// "New Hire" beats generic "Name".
const HEADER_MAP: Record<string, { field: Field; priority: number }> = {
  // Name variants — "New Hire" is the actual person in Google Sheets roadmap
  newhire: { field: "name", priority: 10 },
  name: { field: "name", priority: 5 },
  fullname: { field: "name", priority: 5 },
  employeename: { field: "name", priority: 5 },
  hire: { field: "name", priority: 3 },
  // Role variants
  role: { field: "role", priority: 10 },
  title: { field: "role", priority: 5 },
  position: { field: "role", priority: 5 },
  jobtitle: { field: "role", priority: 5 },
  // Salary variants — "Compensation" is the negotiated salary, beats "Base Salary"
  compensation: { field: "salary", priority: 10 },
  comp: { field: "salary", priority: 8 },
  annualsalary: { field: "salary", priority: 7 },
  salary: { field: "salary", priority: 6 },
  basesalary: { field: "salary", priority: 4 },
  base: { field: "salary", priority: 3 },
  // Start date variants — actual "Start Date" beats "Est Start Date"
  startdate: { field: "startDate", priority: 10 },
  hiredate: { field: "startDate", priority: 8 },
  eststartdate: { field: "startDate", priority: 4 },
  estimatedstartdate: { field: "startDate", priority: 4 },
  start: { field: "startDate", priority: 3 },
  date: { field: "startDate", priority: 1 },
  // Status variants
  hiringstage: { field: "status", priority: 10 },
  status: { field: "status", priority: 8 },
  offerstatus: { field: "status", priority: 8 },
  stage: { field: "status", priority: 6 },
  // Notes
  notes: { field: "notes", priority: 10 },
  note: { field: "notes", priority: 8 },
  comments: { field: "notes", priority: 6 },
};

const parseAmount = (s: string): number => {
  const cleaned = (s || "").replace(/[$,\s]/g, "");
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : 0;
};

const toIsoDate = (s: string): string | null => {
  if (!s) return null;
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return null;
};

const mapStatus = (s: string): HireStatus => {
  const n = normalize(s || "");
  if (!n) return "interviewing";
  if (["confirmed", "signed", "accepted", "yes", "hired"].includes(n)) return "confirmed";
  if (
    n.includes("offer") ||
    ["sent", "extended"].includes(n)
  ) return "offer_sent";
  if (
    n.includes("interview") ||
    n === "pipeline" ||
    n === "inprocess" ||
    n === "inprogress"
  ) return "interviewing";
  return "interviewing";
};

const stripBom = (s: string) => (s.charCodeAt(0) === 0xfeff ? s.slice(1) : s);

export const parseHiresCsv = (rawText: string): ParsedHireRow[] => {
  const text = stripBom(rawText || "").replace(/\r\n?/g, "\n");
  const lines = text.split("\n").filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];

  // Find header row
  let headerIdx = -1;
  let mapped: (Field | null)[] = [];
  for (let i = 0; i < Math.min(lines.length, 10); i++) {
    const cols = splitCsvLine(lines[i]);
    const m = cols.map((c) => HEADER_MAP[normalize(c)] ?? null);
    if (m.filter(Boolean).length >= 2) {
      headerIdx = i;
      mapped = m;
      break;
    }
  }
  if (headerIdx < 0) return [];

  const rows: ParsedHireRow[] = [];
  for (let i = headerIdx + 1; i < lines.length; i++) {
    const cols = splitCsvLine(lines[i]);
    if (cols.every((c) => !c)) continue;

    const rec: Partial<Record<Field, string>> = {};
    cols.forEach((val, idx) => {
      const k = mapped[idx];
      if (k) rec[k] = val;
    });

    const name = (rec.name || "").trim();
    const role = (rec.role || "").trim();
    if (!name || !role) continue;
    if (/^(total|grand total|subtotal)/i.test(name)) continue;

    const annualSalary = parseAmount(rec.salary || "");
    const startDate = toIsoDate(rec.startDate || "") || new Date().toISOString().slice(0, 10);
    const status = mapStatus(rec.status || "");
    const notes = (rec.notes || "").trim();

    rows.push({ name, role, annualSalary, startDate, status, notes });
  }
  return rows;
};
