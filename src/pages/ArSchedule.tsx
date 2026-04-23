import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  useArEntries,
  useUpsertArEntry,
  useDeleteArEntry,
  type ArEntry,
} from "@/hooks/useFinanceData";
import { formatCurrency, formatDate } from "@/lib/format";

type FormState = {
  customer_name: string;
  invoice_number: string;
  invoice_amount: string;
  invoice_date: string;
  expected_collection_date: string;
  status: ArEntry["status"];
  notes: string;
};

const empty: FormState = {
  customer_name: "",
  invoice_number: "",
  invoice_amount: "",
  invoice_date: new Date().toISOString().slice(0, 10),
  expected_collection_date: new Date().toISOString().slice(0, 10),
  status: "pending",
  notes: "",
};

const statusVariant: Record<ArEntry["status"], string> = {
  pending: "bg-[hsl(var(--warning))]/15 text-[hsl(var(--warning))]",
  collected: "bg-[hsl(var(--success))]/15 text-[hsl(var(--success))]",
  overdue: "bg-destructive/15 text-destructive",
  written_off: "bg-muted text-muted-foreground",
};

export default function ArSchedule() {
  const { data, isLoading } = useArEntries();
  const upsert = useUpsertArEntry();
  const del = useDeleteArEntry();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(empty);

  const openNew = () => {
    setEditing(null);
    setForm(empty);
    setOpen(true);
  };

  const openEdit = (e: ArEntry) => {
    setEditing(e.id);
    setForm({
      customer_name: e.customer_name,
      invoice_number: e.invoice_number ?? "",
      invoice_amount: String(e.invoice_amount),
      invoice_date: e.invoice_date,
      expected_collection_date: e.expected_collection_date,
      status: e.status,
      notes: e.notes ?? "",
    });
    setOpen(true);
  };

  const handleSave = async () => {
    await upsert.mutateAsync({
      ...(editing ? { id: editing } : {}),
      customer_name: form.customer_name,
      invoice_number: form.invoice_number || null,
      invoice_amount: parseFloat(form.invoice_amount) || 0,
      invoice_date: form.invoice_date,
      expected_collection_date: form.expected_collection_date,
      status: form.status,
      notes: form.notes || null,
    });
    setOpen(false);
  };

  const total = data?.reduce(
    (sum, e) => (e.status === "pending" || e.status === "overdue" ? sum + Number(e.invoice_amount) : sum),
    0
  ) ?? 0;

  if (isLoading || !data) {
    return <Skeleton className="h-96" />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">
            Outstanding A/R: <span className="font-semibold text-foreground">{formatCurrency(total)}</span> across{" "}
            {data.filter((e) => e.status === "pending" || e.status === "overdue").length} open invoices
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={openNew}>
              <Plus className="mr-2 h-4 w-4" />
              Add invoice
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editing ? "Edit invoice" : "New invoice"}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-2">
              <div className="grid gap-2">
                <Label>Customer</Label>
                <Input
                  value={form.customer_name}
                  onChange={(e) => setForm((f) => ({ ...f, customer_name: e.target.value }))}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2">
                  <Label>Invoice #</Label>
                  <Input
                    value={form.invoice_number}
                    onChange={(e) => setForm((f) => ({ ...f, invoice_number: e.target.value }))}
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Amount (USD)</Label>
                  <Input
                    type="number"
                    value={form.invoice_amount}
                    onChange={(e) => setForm((f) => ({ ...f, invoice_amount: e.target.value }))}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2">
                  <Label>Invoice date</Label>
                  <Input
                    type="date"
                    value={form.invoice_date}
                    onChange={(e) => setForm((f) => ({ ...f, invoice_date: e.target.value }))}
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Expected collection</Label>
                  <Input
                    type="date"
                    value={form.expected_collection_date}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, expected_collection_date: e.target.value }))
                    }
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label>Status</Label>
                <Select
                  value={form.status}
                  onValueChange={(v) => setForm((f) => ({ ...f, status: v as ArEntry["status"] }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="collected">Collected</SelectItem>
                    <SelectItem value="overdue">Overdue</SelectItem>
                    <SelectItem value="written_off">Written off</SelectItem>
                  </SelectContent>
                </Select>
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
              <Button onClick={handleSave} disabled={!form.customer_name || upsert.isPending}>
                Save
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Invoices</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {data.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              No invoices yet. Add one to start tracking expected collections.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead>Invoice #</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Invoiced</TableHead>
                  <TableHead>Expected</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((e) => (
                  <TableRow key={e.id} className="cursor-pointer" onClick={() => openEdit(e)}>
                    <TableCell className="font-medium">{e.customer_name}</TableCell>
                    <TableCell className="text-muted-foreground">{e.invoice_number || "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCurrency(Number(e.invoice_amount))}
                    </TableCell>
                    <TableCell>{formatDate(e.invoice_date)}</TableCell>
                    <TableCell>{formatDate(e.expected_collection_date)}</TableCell>
                    <TableCell>
                      <Badge className={statusVariant[e.status] + " border-0 capitalize"}>
                        {e.status.replace("_", " ")}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(ev) => {
                          ev.stopPropagation();
                          if (confirm("Delete this invoice?")) del.mutate(e.id);
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
