import { createClient } from "@supabase/supabase-js";

// Server-only: bypasses RLS entirely via the service-role key. Only ever
// import this from app/api/*/route.ts files — never from a "use client"
// component, and never send this key to the browser.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string;

if (!supabaseUrl || !serviceRoleKey) {
  // eslint-disable-next-line no-console
  console.warn(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars — online play and push notifications won't work."
  );
}

export const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// A plain anon-key client used only to verify a caller's access token — kept
// separate from supabaseAdmin so the privileged service-role key is never
// involved in deciding who someone is, only in what they're allowed to touch
// once we already know.
const supabaseAuthCheck = createClient(supabaseUrl, anonKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Verifies a bearer access token (sent by the client from
// supabase.auth.getSession()) and returns the caller's email, or null if the
// token is missing/invalid.
export async function getEmailFromAccessToken(accessToken: string | null): Promise<string | null> {
  if (!accessToken) return null;
  const { data, error } = await supabaseAuthCheck.auth.getUser(accessToken);
  if (error || !data.user?.email) return null;
  return data.user.email.toLowerCase();
}
