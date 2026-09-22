import { createUserSupabaseClient, getBearerToken } from "./fimipay.server";

export async function getAuthenticatedRequestUser(request: Request) {
  const token = getBearerToken(request);
  if (!token) return null;

  const supabase = createUserSupabaseClient(token);
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return null;

  return {
    supabase,
    token,
    userId: data.user.id,
    claims: { sub: data.user.id, email: data.user.email ?? null },
    user: data.user,
  };
}
