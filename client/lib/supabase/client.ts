import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "development-placeholder-key";

  return createBrowserClient(
    url,
    key,
  );
}
