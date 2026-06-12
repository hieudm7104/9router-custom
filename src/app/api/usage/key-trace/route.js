import { NextResponse } from "next/server";
import { getAdapter } from "@/lib/db/driver";
import { getProviderConnections } from "@/lib/db/repos/connectionsRepo";
import { getProviderNodes } from "@/lib/db/repos/nodesRepo";
import { getApiKeys } from "@/lib/db/repos/apiKeysRepo";

export const dynamic = "force-dynamic";

const PERIOD_MS = {
  today: null,
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
  if (!ms) return null;
  return new Date(Date.now() - ms).toISOString();
}

// GET /api/usage/key-trace?period=7d&apiKey=sk-xxx (optional filter)
// Returns usage grouped by apiKey → model → connectionId
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const period = searchParams.get("period") || "7d";
    const filterApiKey = searchParams.get("apiKey") || null;

    const db = await getAdapter();

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

    // Group by apiKey + provider + model + connectionId for full detail
    const rows = db.all(
      `SELECT apiKey, provider, model, connectionId, 
              SUM(promptTokens) as promptTokens, 
              SUM(completionTokens) as completionTokens, 
              SUM(cost) as cost, 
              COUNT(*) as requests,
              MAX(timestamp) as lastUsed
       FROM usageHistory ${where}
       GROUP BY apiKey, provider, model, connectionId
       ORDER BY requests DESC`,
      params
    );

    // Build lookup maps
    const [connections, apiKeys, nodes] = await Promise.all([
      getProviderConnections(),
      getApiKeys(),
      getProviderNodes(),
    ]);

    const connMap = {};
    for (const c of connections) {
      connMap[c.id] = { name: c.name || c.email || c.id, provider: c.provider };
    }

    const nodeMap = {};
    for (const n of nodes) {
      nodeMap[n.id] = n.name || n.id;
    }

    const keyMap = {};
    for (const k of apiKeys) {
      keyMap[k.key] = { id: k.id, name: k.name || k.key.slice(0, 12) + "..." };
    }

    // Group by apiKey → list of detail entries (aggregated by model+connection)
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
          details: [],
        };
      }

      const group = grouped[keyVal];
      const connInfo = connMap[row.connectionId];
      const providerName = nodeMap[row.provider] || row.provider || "unknown";

      group.totalRequests += row.requests;
      group.totalPromptTokens += row.promptTokens || 0;
      group.totalCompletionTokens += row.completionTokens || 0;
      group.totalCost += row.cost || 0;

      group.details.push({
        provider: row.provider || "unknown",
        providerName,
        model: row.model || "unknown",
        connectionId: row.connectionId || "unknown",
        connectionName: connInfo?.name || row.connectionId || "Unknown",
        requests: row.requests,
        promptTokens: row.promptTokens || 0,
        completionTokens: row.completionTokens || 0,
        cost: row.cost || 0,
        lastUsed: row.lastUsed,
      });
    }

    // Also fetch individual request log per key (recent 50 per key)
    const recentRows = db.all(
      `SELECT timestamp, apiKey, provider, model, connectionId, promptTokens, completionTokens, cost, status
       FROM usageHistory ${where}
       ORDER BY id DESC
       LIMIT 200`,
      params
    );

    // Attach recent requests to each key group
    for (const row of recentRows) {
      const keyVal = row.apiKey || "local-no-key";
      if (!grouped[keyVal]) continue;
      if (!grouped[keyVal].requests) grouped[keyVal].requests = [];
      if (grouped[keyVal].requests.length >= 50) continue;

      const connInfo = connMap[row.connectionId];
      const providerName = nodeMap[row.provider] || row.provider || "unknown";

      grouped[keyVal].requests.push({
        timestamp: row.timestamp,
        model: row.model || "unknown",
        providerName,
        connectionName: connInfo?.name || row.connectionId || "Unknown",
        promptTokens: row.promptTokens || 0,
        completionTokens: row.completionTokens || 0,
        cost: row.cost || 0,
        status: row.status || "ok",
      });
    }

    const result = Object.values(grouped).sort((a, b) => b.totalRequests - a.totalRequests);

    return NextResponse.json({ data: result, period });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
