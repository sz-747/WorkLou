// Provider-neutral LLM adapter.
// If LLM_API_KEY + LLM_BASE_URL are configured, calls an OpenAI-compatible
// chat completions endpoint. Otherwise callers fall back to local logic.

export function llmConfigured(): boolean {
  return Boolean(process.env.LLM_API_KEY && process.env.LLM_BASE_URL);
}

// Interactive paths (search parsing, verification extraction) fall back to local
// logic when the LLM fails. To keep that fallback fast, back off for a short
// period after a failure instead of paying the failed round-trip on every call.
const LLM_TIMEOUT_MS = 6000;
const FAILURE_BACKOFF_MS = 5 * 60_000;
let disabledUntil = 0;

export async function llmJson(system: string, user: string): Promise<unknown | null> {
  const base = process.env.LLM_BASE_URL;
  const key = process.env.LLM_API_KEY;
  if (!base || !key) return null;
  if (Date.now() < disabledUntil) return null;
  try {
    const res = await fetch(`${base.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: process.env.LLM_MODEL || 'gpt-4o-mini',
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      }),
      signal: AbortSignal.timeout(LLM_TIMEOUT_MS),
    });
    if (!res.ok) {
      disabledUntil = Date.now() + FAILURE_BACKOFF_MS;
      return null;
    }
    const data = await res.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) return null;
    return JSON.parse(content);
  } catch {
    disabledUntil = Date.now() + FAILURE_BACKOFF_MS;
    return null;
  }
}
