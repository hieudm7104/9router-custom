"use client";

import { useState } from "react";
import { Card, Button, Input } from "@/shared/components";

export default function KeySettingsPage() {
  const [apiKey, setApiKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [keyInfo, setKeyInfo] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState({ type: "", message: "" });

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!apiKey.trim()) return;
    setLoading(true);
    setError("");
    setKeyInfo(null);

    try {
      const res = await fetch("/api/key-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: apiKey.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Invalid API key");
        return;
      }
      setKeyInfo(data);
      setAccounts(data.accounts || []);
    } catch (err) {
      setError("An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const moveUp = (idx) => {
    if (idx === 0) return;
    const arr = [...accounts];
    [arr[idx - 1], arr[idx]] = [arr[idx], arr[idx - 1]];
    setAccounts(arr);
    setSaveStatus({ type: "", message: "" });
  };

  const moveDown = (idx) => {
    if (idx === accounts.length - 1) return;
    const arr = [...accounts];
    [arr[idx], arr[idx + 1]] = [arr[idx + 1], arr[idx]];
    setAccounts(arr);
    setSaveStatus({ type: "", message: "" });
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveStatus({ type: "", message: "" });
    try {
      const connectionPriority = accounts.map((a) => a.id);
      const res = await fetch("/api/key-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKey: apiKey.trim(),
          action: "save-priority",
          connectionPriority,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setSaveStatus({ type: "success", message: "Priority saved successfully" });
      } else {
        setSaveStatus({ type: "error", message: data.error || "Failed to save" });
      }
    } catch {
      setSaveStatus({ type: "error", message: "An error occurred" });
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    setKeyInfo(null);
    setAccounts([]);
    setApiKey("");
    setError("");
    setSaveStatus({ type: "", message: "" });
  };

  // Not authenticated — show login form
  if (!keyInfo) {
    return (
      <div className="max-w-md mx-auto mt-10 px-4 sm:px-0">
        <Card>
          <div className="flex flex-col items-center text-center gap-2 mb-6">
            <div className="size-12 rounded-full bg-orange-500/10 text-orange-500 flex items-center justify-center">
              <span className="material-symbols-outlined text-2xl">tune</span>
            </div>
            <h2 className="text-lg font-semibold">Key Settings</h2>
            <p className="text-sm text-text-muted">
              Enter your API key to manage account priority
            </p>
          </div>
          <form onSubmit={handleLogin} className="flex flex-col gap-4">
            <Input
              type="password"
              placeholder="sk-..."
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              autoFocus
              required
            />
            {error && <p className="text-sm text-red-500">{error}</p>}
            <Button type="submit" variant="primary" loading={loading} fullWidth disabled={!apiKey.trim()}>
              Continue
            </Button>
          </form>
        </Card>
      </div>
    );
  }

  // Authenticated — show priority settings
  return (
    <div className="max-w-lg mx-auto px-4 sm:px-0">
      <div className="flex flex-col gap-6">
        {/* Header */}
        <Card>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-lg bg-orange-500/10 text-orange-500 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-xl">key</span>
              </div>
              <div>
                <h2 className="text-lg font-semibold">{keyInfo.keyName}</h2>
                <p className="text-sm text-text-muted">
                  {accounts.length} account{accounts.length !== 1 ? "s" : ""} available
                </p>
              </div>
            </div>
            <Button variant="outline" icon="logout" onClick={handleLogout}>
              Logout
            </Button>
          </div>
        </Card>

        {/* Priority List */}
        <Card>
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-orange-500/10 text-orange-500 shrink-0">
              <span className="material-symbols-outlined text-[20px]">sort</span>
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-semibold">Account Priority</h3>
              <p className="text-xs sm:text-sm text-text-muted">
                Top account is used first. Drag to reorder. Falls back down the list on rate-limit.
              </p>
            </div>
          </div>

          {accounts.length === 0 ? (
            <p className="text-sm text-text-muted text-center py-6">No accounts available for this key.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {accounts.map((acc, idx) => (
                <div
                  key={acc.id}
                  className="flex items-center gap-3 p-3 rounded-lg border border-border bg-bg"
                >
                  <span className="text-xs font-bold text-text-muted w-5 text-center shrink-0">{idx + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{acc.providerName}</p>
                    <p className="text-xs text-text-muted truncate">{acc.name}</p>
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => moveUp(idx)}
                      disabled={idx === 0}
                      className="p-1.5 rounded-lg hover:bg-orange-500/10 hover:text-orange-500 disabled:opacity-30 text-text-muted transition-colors"
                    >
                      <span className="material-symbols-outlined text-[18px]">arrow_upward</span>
                    </button>
                    <button
                      onClick={() => moveDown(idx)}
                      disabled={idx === accounts.length - 1}
                      className="p-1.5 rounded-lg hover:bg-orange-500/10 hover:text-orange-500 disabled:opacity-30 text-text-muted transition-colors"
                    >
                      <span className="material-symbols-outlined text-[18px]">arrow_downward</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {accounts.length > 0 && (
            <div className="mt-4 pt-4 border-t border-border">
              <Button variant="primary" onClick={handleSave} loading={saving} fullWidth>
                Save Priority
              </Button>
              {saveStatus.message && (
                <p className={`text-sm mt-2 text-center ${saveStatus.type === "error" ? "text-red-500" : "text-green-500"}`}>
                  {saveStatus.message}
                </p>
              )}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
