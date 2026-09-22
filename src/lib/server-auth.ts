import { createUserSupabaseClient, getBearerToken } from "./fimipay.server";

export async function getAuthenticatedRequestUser(request: Request) {
  const token = getBearerToken(request);
  if (!token) return null;
  const supabase = createUserSupabaseClient(token);
  // Validate the bearer token against Supabase Auth directly.
  // getClaims() can return 401 when the project's JWT verification mode/key
  // is not compatible with the token even though the token is valid.
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user?.id) return null;
  return { supabase, token, userId: data.user.id, claims: { sub: data.user.id } };
}
