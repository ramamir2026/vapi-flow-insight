import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useFutureHires,
  useUpsertHire,
  useDeleteHire,
  type FutureHire,
} from "@/hooks/useFinanceData";
import { formatCurrency, formatDate } from "@/lib/format";

type FormState = {
  name: string;
  role: string;
  department: string;
  start_date: string;
  annual_salary: string;
  notes: string;
};

const empty: FormState = {
  name: "",
  role: "",
  department: "",
  start_date: new Date().toISOString().slice(0, 10),
  annual_salary: "",
  notes: "",
};

export default function FutureHires() {
  const { data, isLoading } = useFutureHires();
  const upsert = useUpsertHire();
  const del = useDeleteHire();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(empty);

  const openNew = () => {
    setEditing(null);
    setForm(empty);
    setOpen(true);
  };

  const openEdit = (h: FutureHire) => {
    setEditing(h.id);
    setForm({
      name: h.name,
      role: h.role,
      department: h.department ?? "",
      start_date: h.start_date,
      annual_salary: String(h.annual_salary),
      notes: h.notes ?? "",
    });
    setOpen(true);
  };

  const handleSave = async () => {
    await upsert.mutateAsync({
      ...(editing ? { id: editing } : {}),
      name: form.name,
      role: form.role,
      department: form.department || null,
      start_date: form.start_date,
      annual_salary: parseFloat(form.annual_salary) || 0,
      notes: form.notes || null,
    });
    setOpen(false);
  };

  const totalAnnual = data?.reduce((s, h) => s + Number(h.annual_salary), 0) ?? 0;

  if (isLoading || !data) return <Skeleton className="h-96" />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground">
          Planned hires: <span className="font-semibold text-foreground">{data.length}</span> · Annual cost{" "}
          <span className="font-semibold text-foreground">{formatCurrency(totalAnnual)}</span>
        </p>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={openNew}>
              <Plus className="mr-2 h-4 w-4" />
              Add hire
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editing ? "Edit hire" : "New hire"}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2">
                  <Label>Name</Label>
                  <Input
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Role</Label>
                  <Input
                    value={form.role}
                    onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2">
                  <Label>Department</Label>
                  <Input
                    value={form.department}
                    onChange={(e) => setForm((f) => ({ ...f, department: e.target.value }))}
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Start date</Label>
                  <Input
                    type="date"
                    value={form.start_date}
                    onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))}
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label>Annual salary (USD)</Label>
                <Input
                  type="number"
                  value={form.annual_salary}
                  onChange={(e) => setForm((f) => ({ ...f, annual_salary: e.target.value }))}
                />
              </div>
              <div className="grid gap-2">
                <Label>Notes</Label>
                <Textarea
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  rows={2}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                disabled={!form.name || !form.role || upsert.isPending}
              >
                Save
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pipeline</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {data.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              No upcoming hires. Add one to factor them into payroll forecasts.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Start date</TableHead>
                  <TableHead className="text-right">Annual salary</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((h) => (
                  <TableRow key={h.id} className="cursor-pointer" onClick={() => openEdit(h)}>
                    <TableCell className="font-medium">{h.name}</TableCell>
                    <TableCell>{h.role}</TableCell>
                    <TableCell className="text-muted-foreground">{h.department || "—"}</TableCell>
                    <TableCell>{formatDate(h.start_date)}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCurrency(Number(h.annual_salary))}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(ev) => {
                          ev.stopPropagation();
                          if (confirm("Delete this hire?")) del.mutate(h.id);
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
