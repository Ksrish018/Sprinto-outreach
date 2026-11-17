// Gemini client: JSON output, one call at a time with a minimum gap, backoff on 429 / 5xx.
// No key or prompt content is ever logged.

export type GeminiConfig = { apiKey: string; model: string; minGapMs?: number; onCall?: (kind: "gemini" | "gemini_search") => Promise<void> };

type Part = { text?: string };
type Candidate = {
  content?: { parts?: Part[] };
  groundingMetadata?: { groundingChunks?: { web?: { uri?: string; title?: string } }[] };
};

const BASE = "https://generativelanguage.googleapis.com/v1beta/models";

export class Gemini {
  private last = 0;
  constructor(private cfg: GeminiConfig, private http: typeof fetch = fetch) {}

  private async call(body: unknown, kind: "gemini" | "gemini_search"): Promise<Candidate> {
    const gap = this.cfg.minGapMs ?? 1200;
    for (let attempt = 0; attempt < 4; attempt++) {
      const wait = this.last + gap - Date.now();
      if (wait > 0) await new Promise((r) => setTimeout(r, wait));
      this.last = Date.now();
      let res: Response;
      try {
        res = await this.http(`${BASE}/${this.cfg.model}:generateContent`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": this.cfg.apiKey },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(60_000),
        });
      } catch {
        // Timeouts and dropped connections are retried like a 5xx.
        await new Promise((r) => setTimeout(r, 2000 * 2 ** attempt));
        continue;
      }
      await this.cfg.onCall?.(kind);
      if (res.ok) {
        const data = (await res.json()) as { candidates?: Candidate[] };
        return data.candidates?.[0] ?? {};
      }
      if (res.status === 429 || res.status >= 500) {
        await new Promise((r) => setTimeout(r, 2000 * 2 ** attempt));
        continue;
      }
      throw new Error(`Gemini HTTP ${res.status}`);
    }
    throw new Error("Gemini unavailable after retries");
  }

  // Structured JSON with a response schema.
  async json<T>(prompt: string, schema: object): Promise<T> {
    const c = await this.call(
      {
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0, responseMimeType: "application/json", responseSchema: schema },
      },
      "gemini",
    );
    return parseJson<T>(textOf(c));
  }

  // Google Search grounding. Structured output is not available with tools, so JSON is parsed from text.
  async grounded<T>(prompt: string): Promise<{ data: T; sources: { uri: string; title: string }[] }> {
    const c = await this.call(
      { contents: [{ role: "user", parts: [{ text: prompt }] }], tools: [{ google_search: {} }], generationConfig: { temperature: 0 } },
      "gemini_search",
    );
    const sources = (c.groundingMetadata?.groundingChunks ?? [])
      .map((g) => ({ uri: g.web?.uri ?? "", title: g.web?.title ?? "" }))
      .filter((s) => s.uri);
    return { data: parseJson<T>(textOf(c)), sources };
  }
}

function textOf(c: Candidate): string {
  return (c.content?.parts ?? []).map((p) => p.text ?? "").join("");
}

export function parseJson<T>(text: string): T {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = (fenced ? fenced[1] : text).trim();
  try {
    return JSON.parse(raw) as T;
  } catch {
    const start = raw.search(/[[{]/);
    const end = Math.max(raw.lastIndexOf("}"), raw.lastIndexOf("]"));
    if (start !== -1 && end > start) return JSON.parse(raw.slice(start, end + 1)) as T;
    throw new Error("Model did not return valid JSON");
  }
}
