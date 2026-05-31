"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      // Supabase returns 400 "Email not confirmed" when email confirmation
      // is enabled in the project. Disable it under:
      // Auth → Providers → Email → toggle off "Confirm email"
      const msg =
        authError.message === "Email not confirmed"
          ? "Your account email is not confirmed. Ask your admin to disable email confirmation in Supabase Auth settings, or confirm the email."
          : authError.message;
      setError(msg);
      setLoading(false);
      return;
    }

    router.push("/");
    router.refresh();
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-[#0d0d0f] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Brand */}
        <div className="flex items-center gap-3 mb-8">
          <div className="flex items-center justify-center w-9 h-9 bg-linear-to-br from-emerald-400 to-teal-500">
            <span className="text-white text-[12px] font-black tracking-tight">
              SF
            </span>
          </div>
          <div className="flex flex-col leading-none">
            <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight">
              StitchFlow
            </span>
            <span className="text-[10px] font-mono text-zinc-400 dark:text-zinc-600 uppercase tracking-widest mt-0.5">
              Production Engine v1.0
            </span>
          </div>
        </div>

        {/* Card */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 shadow-sm">
          <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-1">
            Supervisor Login
          </h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-500 font-mono mb-6">
            Access is restricted to authorised supervisors only.
          </p>

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-1">
              <label className="block text-[11px] font-mono text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                Email
              </label>
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:focus:ring-emerald-600 transition-colors"
                placeholder="supervisor@factory.com"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-[11px] font-mono text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                Password
              </label>
              <input
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:focus:ring-emerald-600 transition-colors"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <div className="px-3 py-2 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 text-red-600 dark:text-red-400 text-xs font-mono">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 text-[11px] font-mono tracking-widest uppercase bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-500/50 text-white transition-colors cursor-pointer disabled:cursor-not-allowed"
            >
              {loading ? "Signing in…" : "Sign In"}
            </button>
          </form>
        </div>

        <p className="text-center text-[10px] font-mono text-zinc-400 dark:text-zinc-700 mt-4">
          Contact your admin to get access.
        </p>
      </div>
    </div>
  );
}
