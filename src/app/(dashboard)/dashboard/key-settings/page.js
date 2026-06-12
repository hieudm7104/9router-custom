"use client";

import { useState } from "react";

export default function KeySettingsPage() {
  const [apiKey, setApiKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [keyInfo, setKeyInfo] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState("");

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
    setSaveStatus("");
  };

  const moveDown = (idx) => {
    if (idx === accounts.length - 1) return;
    const arr = [...accounts];
    [arr[idx], arr[idx + 1]] = [arr[idx + 1], arr[idx]];
    setAccounts(arr);
    setSaveStatus("");
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveStatus("");
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
        setSaveStatus("success");
      } else {
        setSaveStatus(data.error || "Failed to save");
      }
    } catch {
      setSaveStatus("An error occurred");
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    setKeyInfo(null);
    setAccounts([]);
    setApiKey("");
    setError("");
    setSaveStatus("");
  };

  // Not authenticated — show login form
  if (!keyInfo) {
    return (
      <div className="flex items-center justify-center py-10 px-4">
        <div className="w-full max-w-md bg-white dark:bg-gray-900 rounded-xl shadow-lg border border-gray-200 dark:border-gray-800 p-6">
          <div className="flex flex-col items-center text-center gap-2 mb-6">
            <div className="size-12 rounded-full bg-blue-500/10 text-blue-500 flex items-center justify-center">
              <span className="material-symbols-outlined text-2xl">key</span>
            </div>
            <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Key Settings</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Enter your API key to manage account priority
            </p>
          </div>
          <form onSubmit={handleLogin} className="flex flex-col gap-4">
            <input
              type="password"
              placeholder="sk-..."
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              autoFocus
              required
              className="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            />
            {error && <p className="text-sm text-red-500">{error}</p>}
            <button
              type="submit"
              disabled={loading || !apiKey.trim()}
              className="w-full py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium transition-colors"
            >
              {loading ? "Verifying..." : "Continue"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Authenticated — show priority settings
  return (
    <div className="px-4 sm:px-0">
      <div className="max-w-lg mx-auto flex flex-col gap-4">
        {/* Header */}
        <div className="bg-white dark:bg-gray-900 rounded-xl shadow-lg border border-gray-200 dark:border-gray-800 p-6 mb-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {keyInfo.keyName}
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {accounts.length} account{accounts.length !== 1 ? "s" : ""} available
              </p>
            </div>
            <button
              onClick={handleLogout}
              className="px-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400 transition-colors"
            >
              Logout
            </button>
          </div>
        </div>

        {/* Priority List */}
        <div className="bg-white dark:bg-gray-900 rounded-xl shadow-lg border border-gray-200 dark:border-gray-800 p-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="material-symbols-outlined text-blue-500">sort</span>
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Account Priority</h2>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
            Accounts at the top will be used first. Use arrows to reorder. When the top account is rate-limited, requests fall back to the next one.
          </p>

          {accounts.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-6">No accounts available for this key.</p>
          ) : (
            <div className="flex flex-col gap-1">
              {accounts.map((acc, idx) => (
                <div
                  key={acc.id}
                  className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50"
                >
                  <span className="text-xs font-bold text-gray-400 w-5 text-center">{idx + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                      {acc.providerName}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      {acc.name}
                    </p>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <button
                      onClick={() => moveUp(idx)}
                      disabled={idx === 0}
                      className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-30 text-gray-500 transition-colors"
                    >
                      <span className="material-symbols-outlined text-[16px]">arrow_upward</span>
                    </button>
                    <button
                      onClick={() => moveDown(idx)}
                      disabled={idx === accounts.length - 1}
                      className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-30 text-gray-500 transition-colors"
                    >
                      <span className="material-symbols-outlined text-[16px]">arrow_downward</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {accounts.length > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={handleSave}
                disabled={saving}
                className="w-full py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium transition-colors"
              >
                {saving ? "Saving..." : "Save Priority"}
              </button>
              {saveStatus === "success" && (
                <p className="text-sm text-green-600 dark:text-green-400 mt-2 text-center">Priority saved successfully</p>
              )}
              {saveStatus && saveStatus !== "success" && (
                <p className="text-sm text-red-500 mt-2 text-center">{saveStatus}</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
