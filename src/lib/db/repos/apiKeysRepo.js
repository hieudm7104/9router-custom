import { v4 as uuidv4 } from "uuid";
import { getAdapter } from "../driver.js";

function rowToKey(row) {
  if (!row) return null;
  let allowedConnections = null;
  if (row.allowedConnections) {
    try { allowedConnections = JSON.parse(row.allowedConnections); } catch {}
  }
  let connectionPriority = null;
  if (row.connectionPriority) {
    try { connectionPriority = JSON.parse(row.connectionPriority); } catch {}
  }
  return {
    id: row.id,
    key: row.key,
    name: row.name,
    machineId: row.machineId,
    isActive: row.isActive === 1 || row.isActive === true,
    allowedConnections,
    connectionPriority,
    createdAt: row.createdAt,
  };
}

export async function getApiKeys() {
  const db = await getAdapter();
  const rows = db.all(`SELECT * FROM apiKeys ORDER BY createdAt ASC`);
  return rows.map(rowToKey);
}

export async function getApiKeyById(id) {
  const db = await getAdapter();
  const row = db.get(`SELECT * FROM apiKeys WHERE id = ?`, [id]);
  return rowToKey(row);
}

export async function createApiKey(name, machineId, allowedConnections = null) {
  if (!machineId) throw new Error("machineId is required");
  const db = await getAdapter();
  const { generateApiKeyWithMachine } = await import("@/shared/utils/apiKey");
  const result = generateApiKeyWithMachine(machineId);
  const apiKey = {
    id: uuidv4(),
    name,
    key: result.key,
    machineId,
    isActive: true,
    allowedConnections,
    createdAt: new Date().toISOString(),
  };
  db.run(
    `INSERT INTO apiKeys(id, key, name, machineId, isActive, allowedConnections, createdAt) VALUES(?, ?, ?, ?, ?, ?, ?)`,
    [apiKey.id, apiKey.key, apiKey.name, apiKey.machineId, 1, allowedConnections ? JSON.stringify(allowedConnections) : null, apiKey.createdAt]
  );
  return apiKey;
}

export async function updateApiKey(id, data) {
  const db = await getAdapter();
  let result = null;
  db.transaction(() => {
    const row = db.get(`SELECT * FROM apiKeys WHERE id = ?`, [id]);
    if (!row) return;
    const current = rowToKey(row);
    const merged = { ...current, ...data };
    const allowedJson = merged.allowedConnections ? JSON.stringify(merged.allowedConnections) : null;
    const priorityJson = merged.connectionPriority ? JSON.stringify(merged.connectionPriority) : null;
    db.run(
      `UPDATE apiKeys SET key = ?, name = ?, machineId = ?, isActive = ?, allowedConnections = ?, connectionPriority = ? WHERE id = ?`,
      [merged.key, merged.name, merged.machineId, merged.isActive ? 1 : 0, allowedJson, priorityJson, id]
    );
    result = merged;
  });
  return result;
}

export async function deleteApiKey(id) {
  const db = await getAdapter();
  const res = db.run(`DELETE FROM apiKeys WHERE id = ?`, [id]);
  return (res?.changes ?? 0) > 0;
}

// Returns the full key record if valid, or false if invalid/not found.
// This allows callers to read allowedConnections for permission filtering.
export async function validateApiKey(key) {
  const db = await getAdapter();
  const row = db.get(`SELECT * FROM apiKeys WHERE key = ?`, [key]);
  if (!row) return false;
  if (row.isActive !== 1 && row.isActive !== true) return false;
  return rowToKey(row);
}

// Rotate: generate a new key value while keeping name, permissions, and other fields.
export async function rotateApiKey(id) {
  const db = await getAdapter();
  const row = db.get(`SELECT * FROM apiKeys WHERE id = ?`, [id]);
  if (!row) return null;
  const current = rowToKey(row);
  const { generateApiKeyWithMachine } = await import("@/shared/utils/apiKey");
  const newKeyResult = generateApiKeyWithMachine(current.machineId);
  db.run(`UPDATE apiKeys SET key = ? WHERE id = ?`, [newKeyResult.key, id]);
  return { ...current, key: newKeyResult.key };
}
