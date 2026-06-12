"use client";

import { useState, useEffect } from "react";
import { Card, Button, SegmentedControl } from "@/shared/components";

const PERIODS = [
  { value: "today", label: "Today" },
  { value: "24h", label: "24h" },
  { value: "7d", label: "7D" },
  { value: "30d", label: "30D" },
  { value: "60d", label: "60D" },
];

function formatTokens(n) {
  if (!n) return "0";
  if (n >= 1000000) return (n / 1000000).toFixed(1) + "M";
  if (n >= 1000) return (n / 1000).toFixed(1) + "K";
  return String(n);
}

function formatCost(n) {
  if (!n) return "$0.00";
  return "$" + n.toFixed(4);
}

export default function KeyTraceTab() {
  const [period, setPeriod] = useState("7d");
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState({});

  useEffect(() => {
    setLoading(true);
    setError("");
    fetch(`/api/usage/key-trace?period=${period}`)
      .then((res) => res.json())
      .then((json) => {
        if (json.error) throw new Error(json.error);
        setData(json.data || []);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [period]);

  const toggleExpand = (key) => {
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <h3 className="text-base font-semibold">Usage by API Key</h3>
        <SegmentedControl
          options={PERIODS}
          value={period}
          onChange={setPeriod}
          size="sm"
          className="w-full sm:w-auto"
        />
      </div>

      {loading && (
        <Card>
          <div className="h-20 animate-pulse" />
        </Card>
      )}

      {error && (
        <Card>
          <p className="text-sm text-red-500">{error}</p>
        </Card>
      )}

      {!loading && !error && data.length === 0 && (
        <Card>
          <p className="text-sm text-text-muted text-center py-6">No usage data for this period.</p>
        </Card>
      )}

      {!loading && !error && data.map((keyGroup) => (
        <Card key={keyGroup.apiKey}>
          <button
            type="button"
            onClick={() => toggleExpand(keyGroup.apiKey)}
            className="w-full flex items-start sm:items-center justify-between gap-3 text-left"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[18px]">key</span>
                <p className="font-medium text-sm sm:text-base truncate">{keyGroup.keyName}</p>
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-xs text-text-muted">
                <span>{keyGroup.totalRequests} requests</span>
                <span>{formatTokens(keyGroup.totalPromptTokens + keyGroup.totalCompletionTokens)} tokens</span>
                <span>{formatCost(keyGroup.totalCost)}</span>
              </div>
            </div>
            <span className="material-symbols-outlined text-text-muted shrink-0">
              {expanded[keyGroup.apiKey] ? "expand_less" : "expand_more"}
            </span>
          </button>

          {expanded[keyGroup.apiKey] && (
            <div className="mt-4 border-t border-border pt-3">
              {/* Aggregated summary */}
              <p className="text-xs font-medium text-text-muted mb-2">Summary</p>
              <div className="overflow-x-auto mb-4">
                <table className="w-full text-xs sm:text-sm">
                  <thead>
                    <tr className="text-left text-text-muted border-b border-border/50">
                      <th className="pb-2 pr-3 font-medium">Model</th>
                      <th className="pb-2 pr-3 font-medium">Provider</th>
                      <th className="pb-2 pr-3 font-medium">Account</th>
                      <th className="pb-2 pr-3 font-medium text-right">Req</th>
                      <th className="pb-2 pr-3 font-medium text-right">Input</th>
                      <th className="pb-2 pr-3 font-medium text-right">Output</th>
                      <th className="pb-2 font-medium text-right">Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {keyGroup.details.map((d, i) => (
                      <tr key={i} className="border-b border-border/30 last:border-0">
                        <td className="py-2 pr-3 font-mono text-xs">{d.model}</td>
                        <td className="py-2 pr-3">
                          <span className="inline-flex items-center gap-1">
                            <span className="size-2 rounded-full bg-orange-500/60" />
                            {d.providerName}
                          </span>
                        </td>
                        <td className="py-2 pr-3 text-text-muted truncate max-w-[120px]">{d.connectionName}</td>
                        <td className="py-2 pr-3 text-right tabular-nums">{d.requests}</td>
                        <td className="py-2 pr-3 text-right tabular-nums">{formatTokens(d.promptTokens)}</td>
                        <td className="py-2 pr-3 text-right tabular-nums">{formatTokens(d.completionTokens)}</td>
                        <td className="py-2 text-right tabular-nums">{formatCost(d.cost)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Individual request log */}
              {keyGroup.requests && keyGroup.requests.length > 0 && (
                <>
                  <p className="text-xs font-medium text-text-muted mb-2">Recent Requests</p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-left text-text-muted border-b border-border/50">
                          <th className="pb-1.5 pr-3 font-medium">Time</th>
                          <th className="pb-1.5 pr-3 font-medium">Model</th>
                          <th className="pb-1.5 pr-3 font-medium">Provider</th>
                          <th className="pb-1.5 pr-3 font-medium">Account</th>
                          <th className="pb-1.5 pr-3 font-medium text-right">Tokens</th>
                          <th className="pb-1.5 font-medium text-right">Cost</th>
                        </tr>
                      </thead>
                      <tbody>
                        {keyGroup.requests.map((r, i) => (
                          <tr key={i} className="border-b border-border/20 last:border-0">
                            <td className="py-1.5 pr-3 text-text-muted whitespace-nowrap">
                              {new Date(r.timestamp).toLocaleString([], { month:"short", day:"numeric", hour:"2-digit", minute:"2-digit" })}
                            </td>
                            <td className="py-1.5 pr-3 font-mono">{r.model}</td>
                            <td className="py-1.5 pr-3">
                              <span className="inline-flex items-center gap-1">
                                <span className="size-1.5 rounded-full bg-orange-500/60" />
                                {r.providerName}
                              </span>
                            </td>
                            <td className="py-1.5 pr-3 text-text-muted">{r.connectionName}</td>
                            <td className="py-1.5 pr-3 text-right tabular-nums">{formatTokens(r.promptTokens + r.completionTokens)}</td>
                            <td className="py-1.5 text-right tabular-nums">{formatCost(r.cost)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          )}
        </Card>
      ))}
    </div>
  );
}
