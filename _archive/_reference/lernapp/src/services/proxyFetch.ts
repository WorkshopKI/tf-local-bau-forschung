/**
 * Shared authenticated fetch for the LLM proxy (Supabase Edge Function).
 * Centralizes session retrieval, header construction, and error handling.
 */

const PROXY_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/llm-proxy`;

export interface ProxyFetchResult {
  response: Response;
}

/**
 * Fetch the LLM proxy with authenticated Supabase session headers.
 * Throws descriptive errors for missing session or network issues.
 */
export async function proxyFetch(
  body: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<Response> {
  const { supabase } = await import("@/integrations/supabase/client");
  const { data } = await supabase.auth.getSession();

  if (!data.session) {
    throw new Error("NOT_AUTHENTICATED");
  }

  return fetch(PROXY_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${data.session.access_token}`,
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    },
    body: JSON.stringify(body),
    signal,
  });
}
