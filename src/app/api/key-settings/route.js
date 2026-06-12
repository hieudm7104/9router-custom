import { NextResponse } from "next/server";
import { validateApiKey, updateApiKey } from "@/lib/localDb";
import { getProviderConnections } from "@/lib/localDb";
import { getProviderNodes } from "@/lib/localDb";

export const dynamic = "force-dynamic";

// POST /api/key-settings — Validate API key and return allowed accounts
// Body: { apiKey: "sk-..." }
export async function POST(request) {
  try {
    const { apiKey, action, connectionPriority } = await request.json();

    if (!apiKey || typeof apiKey !== "string") {
      return NextResponse.json({ error: "API key is required" }, { status: 400 });
    }

    // Validate the key
    const keyRecord = await validateApiKey(apiKey);
    if (!keyRecord) {
      return NextResponse.json({ error: "Invalid or inactive API key" }, { status: 401 });
    }

    // Action: save priority
    if (action === "save-priority") {
      if (!Array.isArray(connectionPriority)) {
        return NextResponse.json({ error: "connectionPriority must be an array" }, { status: 400 });
      }
      // Validate that all IDs in priority are in allowedConnections (if set)
      if (keyRecord.allowedConnections) {
        const invalid = connectionPriority.filter(id => !keyRecord.allowedConnections.includes(id));
        if (invalid.length > 0) {
          return NextResponse.json({ error: "Priority contains connections not allowed for this key" }, { status: 400 });
        }
      }
      await updateApiKey(keyRecord.id, { connectionPriority });
      return NextResponse.json({ success: true, connectionPriority });
    }

    // Default action: return key info + allowed accounts
    const [allConnections, nodes] = await Promise.all([
      getProviderConnections(),
      getProviderNodes(),
    ]);

    const nodeMap = {};
    for (const n of nodes) {
      nodeMap[n.id] = n.name || n.id;
    }

    // Filter to only allowed connections (or all if no restriction)
    let visibleConnections = allConnections.filter(c => c.isActive);
    if (keyRecord.allowedConnections) {
      visibleConnections = visibleConnections.filter(c => keyRecord.allowedConnections.includes(c.id));
    }

    // Build response with readable names
    const accounts = visibleConnections.map(c => ({
      id: c.id,
      provider: c.provider,
      providerName: nodeMap[c.provider] || c.provider,
      name: c.name || c.email || c.id.slice(0, 8),
    }));

    // Sort by current priority if set
    if (keyRecord.connectionPriority && keyRecord.connectionPriority.length > 0) {
      const priorityMap = {};
      keyRecord.connectionPriority.forEach((id, idx) => { priorityMap[id] = idx; });
      accounts.sort((a, b) => {
        const pa = priorityMap[a.id] ?? 999;
        const pb = priorityMap[b.id] ?? 999;
        return pa - pb;
      });
    }

    return NextResponse.json({
      keyName: keyRecord.name,
      keyId: keyRecord.id,
      accounts,
      connectionPriority: keyRecord.connectionPriority || [],
      allowedConnections: keyRecord.allowedConnections,
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
