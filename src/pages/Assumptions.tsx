import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useAssumptions, useUpdateAssumption, type Assumption } from "@/hooks/useFinanceData";

const AssumptionRow = ({ a }: { a: Assumption }) => {
  const [value, setValue] = useState(String(a.value));
  const update = useUpdateAssumption();

  useEffect(() => {
    setValue(String(a.value));
  }, [a.value]);

  const handleBlur = () => {
    const num = parseFloat(value);
    if (isNaN(num) || num === Number(a.value)) return;
    update.mutate({ id: a.id, value: num });
  };

  return (
    <div className="grid grid-cols-1 gap-3 border-b border-border py-4 last:border-0 sm:grid-cols-[1fr_180px]">
      <div>
        <Label htmlFor={a.id} className="text-sm font-medium">
          {a.label}
        </Label>
        {a.notes && <p className="mt-0.5 text-xs text-muted-foreground">{a.notes}</p>}
      </div>
      <div className="flex items-center gap-2">
        <Input
          id={a.id}
          type="number"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
          className="text-right tabular-nums"
        />
        {a.unit && <span className="w-10 shrink-0 text-sm text-muted-foreground">{a.unit}</span>}
      </div>
    </div>
  );
};

export default function Assumptions() {
  const { data, isLoading } = useAssumptions();

  if (isLoading || !data) {
    return (
      <div className="space-y-4">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-48" />
        ))}
      </div>
    );
  }

  const grouped = data.reduce<Record<string, Assumption[]>>((acc, a) => {
    (acc[a.category] = acc[a.category] ?? []).push(a);
    return acc;
  }, {});

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <p className="text-sm text-muted-foreground">
        Edit financial assumptions used by the 13-week forecast. Changes are saved automatically.
      </p>
      {Object.entries(grouped).map(([cat, items]) => (
        <Card key={cat}>
          <CardHeader>
            <CardTitle className="text-base">{cat}</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {items.map((a) => (
              <AssumptionRow key={a.id} a={a} />
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
