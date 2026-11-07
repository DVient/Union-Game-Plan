// Provider selection (plan §8): the analysis interface is provider-agnostic;
// "auto" prefers a keyed cloud provider and falls back to the local rule-based
// pass, with a clear note whenever a provider fails. Statistical sections
// always render regardless of AI availability.
import type { AppConfig } from "../config.js";
import type { AiAnalysisProvider, AnalysisResult, EvidencePack } from "./types.js";
import { RuleBasedProvider } from "./rule-based.js";
import { OpenRouterProvider } from "./openrouter.js";
import { filterCitations } from "./evidence.js";

export interface AnalysisOutcome {
  result: AnalysisResult;
  /** Plain-language note shown to the coach (provider failures, fallbacks). */
  note: string | null;
}

function resolveProviders(config: AppConfig): AiAnalysisProvider[] {
  const providers: AiAnalysisProvider[] = [];
  if (config.aiProvider === "auto" || config.aiProvider === "openrouter") {
    providers.push(new OpenRouterProvider(config.openRouterApiKey ?? "", config.openRouterModel));
  }
  if (config.aiProvider === "auto" || config.aiProvider === "rule-based") {
    providers.push(new RuleBasedProvider());
  }
  return providers;
}

export async function runAnalysis(config: AppConfig, pack: EvidencePack): Promise<AnalysisOutcome> {
  const notes: string[] = [];
  for (const provider of resolveProviders(config)) {
    if (!provider.available()) continue;
    try {
      const result = await provider.analyze(pack);
      // §8 enforcement: drop findings whose citations do not resolve.
      result.findings = filterCitations(result.findings, pack) as typeof result.findings;
      return { result, note: notes.length > 0 ? notes.join(" ") : null };
    } catch (e) {
      notes.push(`AI provider "${provider.id}" failed: ${String(e)}.`);
    }
  }
  throw new Error(`No AI analysis provider could run. ${notes.join(" ")}`.trim());
}
