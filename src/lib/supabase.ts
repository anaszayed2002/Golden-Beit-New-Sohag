import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

let browserClient: SupabaseClient | null = null;

export function supabaseBrowser() {
  if (!browserClient) browserClient = createClient(url, key);
  return browserClient;
}

// Public reads on the server; RLS only exposes approved listings to it.
export function supabaseServer() {
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
