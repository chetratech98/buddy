import { useEffect, useMemo, useState } from "react";
import { Loader2, DollarSign } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface UsageRow {
  function_name: string;
  purpose: string;
  est_cost_usd: number;
  created_at: string;
}

const PURPOSE_LABELS: Record<string, string> = {
  generation: "Draft generation",
  expansion: "Word-count expansion",
  qa_review: "QA review pass",
  targeted_fix: "Targeted fix pass",
  featured_image: "Featured image",
  body_image: "In-body image",
};

const usd = (n: number) => `$${n.toFixed(n < 1 ? 3 : 2)}`;

// Estimated spend from ai_usage_log (price table lives in
// supabase/functions/_shared/ai-usage.ts) — a visibility tool, not billing
// data; reconcile against the OpenAI usage dashboard.
export function AiSpendCard() {
  const [rows, setRows] = useState<UsageRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    supabase
      .from("ai_usage_log")
      .select("function_name, purpose, est_cost_usd, created_at")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(1000)
      .then(({ data }) => {
        setRows((data as UsageRow[]) ?? []);
        setLoading(false);
      });
  }, []);

  const summary = useMemo(() => {
    const total = rows.reduce((sum, r) => sum + Number(r.est_cost_usd), 0);
    const byPurpose = new Map<string, { calls: number; cost: number }>();
    for (const r of rows) {
      const cur = byPurpose.get(r.purpose) ?? { calls: 0, cost: 0 };
      cur.calls += 1;
      cur.cost += Number(r.est_cost_usd);
      byPurpose.set(r.purpose, cur);
    }
    const posts = byPurpose.get("generation")?.calls ?? 0;
    const blogCost = rows.filter((r) => r.function_name === "generate-blog").reduce((s, r) => s + Number(r.est_cost_usd), 0);
    return {
      total,
      posts,
      avgPerPost: posts > 0 ? blogCost / posts : null,
      breakdown: [...byPurpose.entries()].sort((a, b) => b[1].cost - a[1].cost),
      capped: rows.length >= 1000,
    };
  }, [rows]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DollarSign size={18} /> Estimated AI spend (last 30 days)
        </CardTitle>
        <CardDescription>
          Estimated from logged OpenAI calls in generate-blog and generate-post-images — not billing data.
          {summary.capped && " Showing the most recent 1,000 calls only."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-6"><Loader2 className="animate-spin" /></div>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">No AI calls logged yet. Usage is recorded from the next generated post onward.</p>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-xs text-muted-foreground">Estimated total</p>
                <p className="text-2xl font-bold">{usd(summary.total)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Posts generated</p>
                <p className="text-2xl font-bold">{summary.posts}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">≈ Cost per post</p>
                <p className="text-2xl font-bold">{summary.avgPerPost === null ? "—" : usd(summary.avgPerPost)}</p>
              </div>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Step</TableHead>
                  <TableHead className="text-right">Calls</TableHead>
                  <TableHead className="text-right">Est. cost</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {summary.breakdown.map(([purpose, v]) => (
                  <TableRow key={purpose}>
                    <TableCell>{PURPOSE_LABELS[purpose] ?? purpose}</TableCell>
                    <TableCell className="text-right">{v.calls}</TableCell>
                    <TableCell className="text-right">{usd(v.cost)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
