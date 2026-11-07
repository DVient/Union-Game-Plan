// OpenRouter analysis provider: the first concrete provider behind the
// provider-agnostic interface (plan §8). Sends ONLY the evidence pack; asks
// for strict JSON findings with citations from the pack's key map.
import type { AiAnalysisProvider, AnalysisResult, EvidencePack } from "./types.js";

const SYSTEM_PROMPT = `You are a youth basketball development analyst. You receive an evidence pack for one 14-15-year-old player: validated statistics, event summaries, and Superstat's own insights.
Rules:
- Base every statement ONLY on the evidence pack. Never invent statistics.
- Every finding's "citation" field must list one or more citation keys from the pack's "citations" map (multiple keys separated by '; '). A finding whose citation is not a listed key is invalid and will be discarded.
- Use confidence: "confirmed" for facts directly stated by the cited evidence, "possible" for reasonable interpretations, "unverified" for observations needing more data.
- Never claim to evaluate video, defensive positioning, athleticism, processing speed, or contested shots — that data is not in the pack.
- Be development-focused and strengths-based; no shaming; no medical or psychological claims.
- Write claims in plain English suitable for a 14-15-year-old player.
Respond with JSON only: {"findings":[{"category":"scoring|ballhandling|offense|defense|iq","claim":"...","citation":"key1; key2","confidence":"confirmed|possible|unverified"}]}
Cover: scoring, ball handling and decision-making, offensive contribution, defensive contribution, basketball IQ.`;

export class OpenRouterProvider implements AiAnalysisProvider {
  readonly id = "openrouter";
  constructor(
    private readonly apiKey: string,
    private readonly model: string,
    private readonly baseUrl = "https://openrouter.ai/api/v1",
  ) {}

  available(): boolean { return this.apiKey.length > 0; }

  async analyze(pack: EvidencePack, signal?: AbortSignal): Promise<AnalysisResult> {
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${this.apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: JSON.stringify({ evidencePack: pack, citationKeys: Object.keys(pack.citations) }) },
        ],
        temperature: 0.2,
        max_tokens: 2000,
      }),
      signal: signal ?? AbortSignal.timeout(90_000),
    });
    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(`OpenRouter error (HTTP ${response.status})${text ? `: ${text.slice(0, 300)}` : ""}`);
    }
    const body = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const content = body.choices?.[0]?.message?.content ?? "";
    const jsonText = content.replace(/^```(?:json)?\s*/u, "").replace(/\s*```$/u, "");
    let parsed: { findings?: Array<{ category?: string; claim?: string; citation?: string; confidence?: string }> };
    try {
      parsed = JSON.parse(jsonText) as typeof parsed;
    } catch {
      throw new Error("OpenRouter returned non-JSON analysis output.");
    }
    const findings = (parsed.findings ?? []).map((f) => ({
      category: (f.category ?? "iq") as AnalysisResult["findings"][number]["category"],
      claim: String(f.claim ?? ""),
      citation: String(f.citation ?? ""),
      confidence: (f.confidence ?? "unverified") as AnalysisResult["findings"][number]["confidence"],
    })).filter((f) => f.claim.length > 0);
    return { providerId: this.id, findings };
  }
}
