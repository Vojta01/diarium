"use client";

import { useState } from "react";

export function SetupScreen({
  onConfigured,
}: {
  onConfigured: () => void;
}) {
  const [token, setToken] = useState("");
  const [repo, setRepo] = useState("Vojta01/obsidian-druhy-mozek");
  const [error, setError] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);

  const testConnection = async () => {
    setTesting(true);
    setError(null);
    try {
      const res = await fetch(`https://api.github.com/repos/${repo}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
        },
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.message || `HTTP ${res.status}`);
      }
      localStorage.setItem("diarium_github_token", token);
      localStorage.setItem("diarium_repo", repo);
      onConfigured();
    } catch (e: any) {
      setError(e.message || "Nepodařilo se připojit");
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <div className="glass-card w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
            Diarium
          </h1>
          <p className="text-white/30 text-sm mt-2">
            Denní check-in do tvého Obsidian vaultu
          </p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-white/40 text-sm block mb-1">
              GitHub Personal Access Token
            </label>
            <input
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="github_pat_..."
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm
                         placeholder:text-white/15 focus:outline-none focus:border-indigo-400/50"
            />
            <p className="text-white/20 text-[10px] mt-1">
              Fine-grained token s přístupem k repo (Contents: RW)
            </p>
          </div>

          <div>
            <label className="text-white/40 text-sm block mb-1">
              Repozitář
            </label>
            <input
              type="text"
              value={repo}
              onChange={(e) => setRepo(e.target.value)}
              placeholder="uzivatel/repo"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm
                         placeholder:text-white/15 focus:outline-none focus:border-indigo-400/50"
            />
          </div>

          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm text-center">
              {error}
            </div>
          )}

          <button
            onClick={testConnection}
            disabled={!token || !repo || testing}
            className="btn-primary w-full disabled:opacity-50"
          >
            {testing ? "Ověřuji..." : "Připojit vault"}
          </button>
        </div>

        <p className="text-white/15 text-[10px] text-center mt-6">
          Token se ukládá jen do localStorage tvého prohlížeče.
          Nikam jinam se neposílá.
        </p>
      </div>
    </div>
  );
}
