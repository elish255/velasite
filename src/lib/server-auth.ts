import { createUserSupabaseClient, getBearerToken } from "./fimipay.server";

export async function getAuthenticatedRequestUser(request: Request) {
  const token = getBearerToken(request);
  if (!token) return null;
  const supabase = createUserSupabaseClient(token);
  const { data, error } = await supabase.auth.getClaims(token);
  if (error || !data?.claims?.sub) return null;
  return { supabase, token, userId: data.claims.sub as string, claims: data.claims };
}
