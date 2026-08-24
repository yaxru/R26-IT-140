"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { signInWithPassword } from "@/shared/auth";

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
    const errorMsg = await signInWithPassword(supabase, email, password);

    if (errorMsg) {
      setError(errorMsg);
      setLoading(false);
      return;
    }

    router.push("/");
    router.refresh();
  };

  return (
    <div
      className="min-h-screen bg-cover bg-center flex items-center justify-center px-4"
      style={{ backgroundImage: "url('/img/login.webp')" }}
    >
      {/* Dark tint overlay for better readability if background is bright */}
      <div className="absolute inset-0 bg-[#000000]/30 pointer-events-none" />

      <div className="w-full max-w-sm relative z-10">
        

        {/* Card */}
        <div className="bg-[#05190F]/60 backdrop-blur-md border border-white/10 p-7">

        {/* Brand */}
        <div className="flex items-center gap-3 border-b border-white/20 pb-4">
          <div className="flex items-center justify-center w-9 h-9 bg-[#1A7C4B] border border-[#47966F]">
            <span className="text-white text-xs font-black tracking-tight">
              OP
            </span>
          </div>
          <div className="flex flex-col leading-none">
            <span className="text-sm font-bold text-white tracking-tight">
              Opsis
            </span>
            <span className="text-[10px] font-mono text-white/70 uppercase tracking-widest mt-0.5">
              Production OS v1.0
            </span>
          </div>
        </div>

          <h1 className="text-lg font-bold text-white mb-1 mt-4">
            Supervisor Login
          </h1>
          <p className="text-xs text-white/60 font-mono mb-6">
            Access is restricted to authorised supervisors only.
          </p>

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-1.5">
              <label className="block text-[10px] font-mono text-white/80 uppercase tracking-wider">
                Email
              </label>
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-black/40 border border-white/20 text-white placeholder-white/30 focus:outline-none focus:border-[#1A7C4B] focus:bg-black/60 transition-colors"
                placeholder="supervisor@factory.com"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-[10px] font-mono text-white/80 uppercase tracking-wider">
                Password
              </label>
              <input
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-black/40 border border-white/20 text-white placeholder-white/30 focus:outline-none focus:border-[#1A7C4B] focus:bg-black/60 transition-colors"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <div className="px-3 py-2 bg-[#CE8E33]/20 border border-[#CE8E33]/50 text-[#F4E5D1] text-xs font-mono">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 mt-2 text-[11px] font-bold font-mono tracking-widest uppercase bg-[#1A7C4B] hover:bg-[#15633C] border border-[#15633C] disabled:opacity-50 text-white transition-colors cursor-pointer disabled:cursor-not-allowed"
            >
              {loading ? "Signing in…" : "Sign In"}
            </button>
          </form>

          <p className="text-center text-[10px] font-mono text-white/50 mt-6 tracking-wide">
          Contact your administrator to request access.
        </p>
        </div>

        
      </div>
    </div>
  );
}
