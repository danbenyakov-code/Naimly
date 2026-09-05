import { createClient } from "@supabase/supabase-js";
import { isSupabaseAdminConfigured, supabaseServiceRoleKey, supabaseUrl } from "@/lib/supabase/env";

export function createSupabaseAdminClient() {
  if (!isSupabaseAdminConfigured) return null;
  return createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
