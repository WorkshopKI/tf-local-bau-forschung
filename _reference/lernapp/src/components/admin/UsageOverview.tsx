import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { BarChart3, Coins, Zap, Users, Pencil, Check, X } from "lucide-react";

interface UserUsage {
  userId: string;
  displayName: string;
  totalRequests: number;
  totalTokens: number;
  estimatedCost: number;
  remainingBudget: number;
  lastRequest: string | null;
}

interface Props {
  courseId: string;
}

export const UsageOverview = ({ courseId }: Props) => {
  const [userUsage, setUserUsage] = useState<UserUsage[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [bulkBudget, setBulkBudget] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  const load = useCallback(async () => {
    if (!courseId) return;
    setLoading(true);

    const { data: profiles } = await supabase
      .from("user_profiles")
      .select("id, display_name")
      .eq("course_id", courseId);

    if (!profiles || profiles.length === 0) {
      setUserUsage([]);
      setLoading(false);
      return;
    }

    const userIds = profiles.map((p) => p.id);

      // 2. Lade Usage-Logs und API-Key-Budgets parallel
      const [usageResult, keysResult] = await Promise.all([
        (supabase as any)
          .from("api_usage_log")
          .select("user_id, estimated_cost, total_tokens, created_at")
          .in("user_id", userIds),
        supabase
          .from("user_api_keys")
          .select("user_id, provisioned_key_budget")
          .in("user_id", userIds),
      ]);

    const usageLogs = usageResult.data ?? [];
    const apiKeys = keysResult.data ?? [];

    const budgetMap = new Map<string, number>();
    for (const k of apiKeys) {
      budgetMap.set(k.user_id, Number(k.provisioned_key_budget ?? 0));
    }

    const usageMap = new Map<string, { requests: number; tokens: number; cost: number; lastAt: string | null }>();
    for (const log of usageLogs) {
      const existing = usageMap.get(log.user_id) ?? { requests: 0, tokens: 0, cost: 0, lastAt: null };
      existing.requests += 1;
      existing.tokens += log.total_tokens ?? 0;
      existing.cost += Number(log.estimated_cost ?? 0);
      if (!existing.lastAt || log.created_at > existing.lastAt) {
        existing.lastAt = log.created_at;
      }
      usageMap.set(log.user_id, existing);
    }

    const result: UserUsage[] = profiles.map((p) => {
      const u = usageMap.get(p.id) ?? { requests: 0, tokens: 0, cost: 0, lastAt: null };
      return {
        userId: p.id,
        displayName: p.display_name || "Unbekannt",
        totalRequests: u.requests,
        totalTokens: u.tokens,
        estimatedCost: u.cost,
        remainingBudget: budgetMap.get(p.id) ?? 0,
        lastRequest: u.lastAt,
      };
    });

    result.sort((a, b) => b.estimatedCost - a.estimatedCost);
    setUserUsage(result);
    setLoading(false);
  }, [courseId]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  /* ── Budget für einzelnen User setzen ── */
  const saveBudget = async (userId: string) => {
    const value = parseFloat(editValue);
    if (isNaN(value) || value < 1) {
      toast.error("Budget muss mindestens $1.00 sein.");
      return;
    }

    // Prüfen ob Zeile existiert
    const { data: existing } = await supabase
      .from("user_api_keys")
      .select("user_id")
      .eq("user_id", userId)
      .maybeSingle();

    if (existing) {
      const { error } = await supabase
        .from("user_api_keys")
        .update({ provisioned_key_budget: value, updated_at: new Date().toISOString() })
        .eq("user_id", userId);
      if (error) {
        toast.error("Fehler: " + error.message);
        return;
      }
    } else {
      const { error } = await supabase
        .from("user_api_keys")
        .insert({ user_id: userId, provisioned_key_budget: value });
      if (error) {
        toast.error("Fehler: " + error.message);
        return;
      }
    }

    toast.success(`Budget auf $${value.toFixed(2)} gesetzt.`);
    setEditingUserId(null);
    setRefreshKey((k) => k + 1);
  };

  /* ── Budget für alle User setzen ── */
  const setBulkBudgetForAll = async () => {
    const value = parseFloat(bulkBudget);
    if (isNaN(value) || value < 1) {
      toast.error("Budget muss mindestens $1.00 sein.");
      return;
    }

    let successCount = 0;
    for (const u of userUsage) {
      const { data: existing } = await supabase
        .from("user_api_keys")
        .select("user_id")
        .eq("user_id", u.userId)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from("user_api_keys")
          .update({ provisioned_key_budget: value, updated_at: new Date().toISOString() })
          .eq("user_id", u.userId);
        if (!error) successCount++;
      } else {
        const { error } = await supabase
          .from("user_api_keys")
          .insert({ user_id: u.userId, provisioned_key_budget: value });
        if (!error) successCount++;
      }
    }

    toast.success(`Budget für ${successCount} Teilnehmer auf $${value.toFixed(2)} gesetzt.`);
    setBulkBudget("");
    setRefreshKey((k) => k + 1);
  };

  const totalCost = userUsage.reduce((s, u) => s + u.estimatedCost, 0);
  const totalRequests = userUsage.reduce((s, u) => s + u.totalRequests, 0);
  const totalTokens = userUsage.reduce((s, u) => s + u.totalTokens, 0);
  const activeUsers = userUsage.filter((u) => u.totalRequests > 0).length;

  return (
    <div className="space-y-4">
      {/* Aggregierte Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <Coins className="h-3.5 w-3.5" /> Gesamtkosten
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-bold">${totalCost.toFixed(3)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <BarChart3 className="h-3.5 w-3.5" /> Anfragen
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-bold">{totalRequests}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <Zap className="h-3.5 w-3.5" /> Tokens
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-bold">
              {totalTokens > 1_000_000
                ? `${(totalTokens / 1_000_000).toFixed(1)}M`
                : totalTokens > 1000
                  ? `${(totalTokens / 1000).toFixed(1)}k`
                  : totalTokens}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5" /> Aktive User
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-bold">
              {activeUsers}
              <span className="text-sm font-normal text-muted-foreground"> / {userUsage.length}</span>
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Budget für alle setzen */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Coins className="h-5 w-5" /> Budget für alle Teilnehmer setzen
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">$</span>
            <Input
              type="number"
              min={1}
              step={1}
              placeholder="z.B. 5"
              value={bulkBudget}
              onChange={(e) => setBulkBudget(e.target.value)}
              className="w-32"
              onKeyDown={(e) => e.key === "Enter" && setBulkBudgetForAll()}
            />
            <Button
              onClick={setBulkBudgetForAll}
              disabled={!bulkBudget || userUsage.length === 0}
              size="sm"
            >
              Für alle setzen ({userUsage.length})
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-1.5">
            Mindestens $1.00. Überschreibt das aktuelle Budget aller Teilnehmer im Kurs.
          </p>
        </CardContent>
      </Card>

      {/* Pro-User Tabelle */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <BarChart3 className="h-5 w-5" /> Verbrauch pro Teilnehmer
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Laden…</p>
          ) : userUsage.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              Keine Teilnehmer in diesem Kurs.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead className="text-right">Anfragen</TableHead>
                  <TableHead className="text-right">Tokens</TableHead>
                  <TableHead className="text-right">Kosten</TableHead>
                  <TableHead className="text-right">Budget</TableHead>
                  <TableHead>Letzter Request</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {userUsage.map((u) => (
                  <TableRow key={u.userId}>
                    <TableCell className="font-medium">{u.displayName}</TableCell>
                    <TableCell className="text-right">{u.totalRequests}</TableCell>
                    <TableCell className="text-right">
                      {u.totalTokens > 1000
                        ? `${(u.totalTokens / 1000).toFixed(1)}k`
                        : u.totalTokens}
                    </TableCell>
                    <TableCell className="text-right">${u.estimatedCost.toFixed(3)}</TableCell>
                    <TableCell className="text-right">
                      {editingUserId === u.userId ? (
                        <div className="flex items-center justify-end gap-1">
                          <span className="text-xs">$</span>
                          <Input
                            type="number"
                            min={1}
                            step={1}
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            className="w-20 h-7 text-sm"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === "Enter") saveBudget(u.userId);
                              if (e.key === "Escape") setEditingUserId(null);
                            }}
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => saveBudget(u.userId)}
                          >
                            <Check className="h-3.5 w-3.5 text-primary" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => setEditingUserId(null)}
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-end gap-1">
                          <Badge
                            variant={u.remainingBudget <= 0 ? "destructive" : u.remainingBudget < 1 ? "secondary" : "outline"}
                          >
                            ${u.remainingBudget.toFixed(2)}
                          </Badge>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => {
                              setEditingUserId(u.userId);
                              setEditValue(u.remainingBudget.toFixed(2));
                            }}
                          >
                            <Pencil className="h-3 w-3 text-muted-foreground" />
                          </Button>
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {u.lastRequest
                        ? new Date(u.lastRequest).toLocaleString("de-DE", {
                            day: "2-digit",
                            month: "2-digit",
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "—"}
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
};
