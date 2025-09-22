import { supabase } from "@/lib/supabase";

/**
 * Upsert mapping between Clerk and Supabase user into public.app_users.
 * If clerkId/email are not provided, attempts to infer them from the current Supabase user identities.
 * Safe to call multiple times; uses upsert on (auth_user_id) or (clerk_id) depending on availability.
 */
export async function upsertAppUserFromClerk(clerkId?: string, email?: string): Promise<void> {
  const { data: ures, error: uerr } = await supabase.auth.getUser();
  if (uerr || !ures.user) throw uerr || new Error("No Supabase user");
  const user = ures.user;
  // Try to infer clerkId/email from OIDC identity_data
  let inferredClerkId: string | undefined = clerkId;
  let inferredEmail: string | undefined = email || (user.email ?? undefined);
  const identities = (user as any).identities as Array<any> | undefined;
  if (!inferredClerkId && Array.isArray(identities)) {
    const oidc = identities.find((i) => i?.provider === "oidc");
    const sub = oidc?.identity_data?.sub as string | undefined;
    const em = (oidc?.identity_data?.email as string | undefined) || inferredEmail;
    if (sub) inferredClerkId = sub;
    if (em) inferredEmail = em;
  }

  const row: any = {
    auth_user_id: user.id,
    clerk_id: inferredClerkId ?? null,
    email: inferredEmail ?? null,
  };
  // Prefer to upsert by auth_user_id if we have it
  // Note: your DB should have a unique constraint on app_users.auth_user_id (and optionally clerk_id)
  const { error } = await supabase.from("app_users").upsert(row, { onConflict: "auth_user_id" });
  if (error) throw error;
}
