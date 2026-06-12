import { NextResponse } from "next/server";
import { getAdapter } from "@/lib/db/driver";
import { parseJson } from "@/lib/db/helpers/jsonCol";
import { getProviderConnections } from "@/lib/db/repos/connectionsRepo";
import { getApiKeys } from "@/lib/db/repos/apiKeysRepo";

export const dynamic = "force-dynamic";

const PERIOD_MS = {
  today: null, // special: from start of local day
  "24h": 86400000,
  "7d": 604800000,
  "30d": 2592000000,
  "60d": 5184000000,
};

function getStartDate(period) {
  if (period === "today") {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  }
  const ms = PERIOD_MS[period];
  if (!ms) return null; // "all"
  return new Date(Date.now() - ms).toISOString();
}

// GET /api/usage/key-trace?period=7d&apiKey=sk-xxx (optional filter)
// Returns usage grouped by apiKey → provider → connectionId
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const period = searchParams.get("period") || "7d";
    const filterApiKey = searchParams.get("apiKey") || null;

    const db = await getAdapter();

    // Build query
    const conds = [];
    const params = [];

    const startDate = getStartDate(period);
    if (startDate) {
      conds.push("timestamp >= ?");
      params.push(startDate);
    }

    if (filterApiKey) {
      conds.push("apiKey = ?");
      params.push(filterApiKey);
    }

    const where = conds.length ? `WHERE ${conds.join(" AND ")}` : "";

    const rows = db.all(
      `SELECT apiKey, provider, model, connectionId, 
              SUM(promptTokens) as promptTokens, 
              SUM(completionTokens) as completionTokens, 
              SUM(cost) as cost, 
              COUNT(*) as requests,
              MAX(timestamp) as lastUsed
       FROM usageHistory ${where}
       GROUP BY apiKey, provider, connectionId
       ORDER BY requests DESC`,
      params
    );

    // Build lookup maps
    const [connections, apiKeys] = await Promise.all([
      getProviderConnections(),
      getApiKeys(),
    ]);

    const connMap = {};
    for (const c of connections) {
      connMap[c.id] = { name: c.name || c.email || c.id, provider: c.provider };
    }

    const keyMap = {};
    for (const k of apiKeys) {
      keyMap[k.key] = { id: k.id, name: k.name || k.key.slice(0, 12) + "..." };
    }

    // Group by apiKey → list of { provider, connectionId, connectionName, requests, tokens, cost }
    const grouped = {};

    for (const row of rows) {
      const keyVal = row.apiKey || "local-no-key";
      if (!grouped[keyVal]) {
        const keyInfo = keyMap[keyVal];
        grouped[keyVal] = {
          apiKey: keyVal,
          keyName: keyVal === "local-no-key" ? "Local (No API Key)" : (keyInfo?.name || keyVal.slice(0, 12) + "..."),
          keyId: keyInfo?.id || null,
          totalRequests: 0,
          totalPromptTokens: 0,
          totalCompletionTokens: 0,
          totalCost: 0,
          accounts: [],
        };
      }

      const group = grouped[keyVal];
      const connInfo = connMap[row.connectionId];

      group.totalRequests += row.requests;
      group.totalPromptTokens += row.promptTokens || 0;
      group.totalCompletionTokens += row.completionTokens || 0;
      group.totalCost += row.cost || 0;

      group.accounts.push({
        provider: row.provider || "unknown",
        connectionId: row.connectionId || "unknown",
        connectionName: connInfo?.name || row.connectionId || "Unknown",
        requests: row.requests,
        promptTokens: row.promptTokens || 0,
        completionTokens: row.completionTokens || 0,
        cost: row.cost || 0,
        lastUsed: row.lastUsed,
      });
    }

    // Sort keys by total requests descending
    const result = Object.values(grouped).sort((a, b) => b.totalRequests - a.totalRequests);

    return NextResponse.json({ data: result, period });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
