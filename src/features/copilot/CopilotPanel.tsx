// ============================================================
// CopilotPanel — presentational live-assist cards (modeled on
// IntelPanel): question context, grounded suggestion with source
// attribution, domain switcher, and session controls.
// ============================================================

import { memo } from "react";
import { AlertTriangle, AudioLines, ArrowRight, BookOpen, Mic, MicOff, PhoneOff, Zap } from "lucide-react";
import type { FlowQuestion } from "../../configs/screening-flow";
import type { RecruitmentObjectionMatch } from "./screening-flow";

export type CopilotDomain = "sales" | "recruitment";

/** Guided-flow slice of the session, computed by CopilotView. */
export interface FlowUiState {
  stageNumber: number;
  totalStages: number;
  stageTitle: string;
  timebox: string;
  blockers: FlowQuestion[];
  checkedIds: string[];
  redFlags: { id: string; description: string }[];
  nextQuestion: { stageTitle: string; question: FlowQuestion } | null;
  canAdvance: boolean;
}

export interface CopilotPreset {
  label: string;
  question: string;
}

export const COPILOT_PRESETS: Record<CopilotDomain, CopilotPreset[]> = {
  sales: [
    { label: "ROI proof", question: "What ROI can we expect and how is it measured?" },
    { label: "API / integration", question: "How does this integrate with our CRM via an API?" },
    { label: "Price pushback", question: "This is too expensive for our budget — why is it worth it?" },
  ],
  recruitment: [
    { label: "Screen: seniority", question: "How do you screen a candidate for seniority level?" },
    { label: "Screen: tech terms", question: "What does API design mean in a job description?" },
    { label: "Notice period", question: "How should I ask about a candidate's notice period?" },
  ],
};

interface CopilotPanelProps {
  domain: CopilotDomain;
  onDomainChange: (domain: CopilotDomain) => void;
  listening: boolean;
  sessionActive: boolean;
  /** Readiness gate not passed — session runs in shadow (no live calls). */
  shadow?: boolean;
  onToggleSession: () => void;
  question: string;
  suggestion: string | null;
  sources: string[];
  busy: boolean;
  onManualQuestion: (question: string) => void;
  error: string | null;
  onEndSession: () => void;
  flow?: FlowUiState | null;
  onToggleBlocker?: (questionId: string) => void;
  onAdvanceStage?: () => void;
  objection?: RecruitmentObjectionMatch | null;
}

export const CopilotPanel = memo(function CopilotPanel({
  domain, onDomainChange, listening, sessionActive, shadow, onToggleSession,
  question, suggestion, sources, busy, onManualQuestion, error, onEndSession,
  flow, onToggleBlocker, onAdvanceStage, objection,
}: CopilotPanelProps) {
  return (
    <div className="w-full max-w-[420px] mx-auto flex flex-col gap-4 p-5">
      {/* Domain switcher */}
      <div className="flex items-center gap-2">
        {(["sales", "recruitment"] as CopilotDomain[]).map((d) => (
          <button
            key={d}
            onClick={() => onDomainChange(d)}
            className={`px-3 py-1.5 rounded-full text-[11px] font-mono font-bold uppercase tracking-wider transition-colors ${
              domain === d
                ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/40"
                : "bg-white/[0.04] text-gray-500 border border-white/[0.06] hover:text-gray-300"
            }`}
          >
            {d === "sales" ? "💼 Sales" : "🎓 Recruitment"}
          </button>
        ))}
        <div className="flex-1" />
        {sessionActive && (
          <button onClick={onEndSession} className="text-[11px] font-mono text-red-400 hover:text-red-300 flex items-center gap-1">
            <PhoneOff className="w-3.5 h-3.5" /> end session
          </button>
        )}
      </div>

      {/* Session control */}
      <div className="bg-[#0a0a0a] border border-white/[0.08] rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-6 h-6 rounded-lg bg-indigo-500/20 flex items-center justify-center">
            <AudioLines className="w-3.5 h-3.5 text-indigo-400" />
          </div>
          <span className="text-[10px] font-mono text-gray-500 uppercase tracking-[0.15em] font-bold">
            Live Copilot — {listening ? "listening" : sessionActive ? "manual" : "idle"}
          </span>
        </div>
        <button
          onClick={onToggleSession}
          className={`w-full rounded-xl px-4 py-2.5 text-[12px] font-bold font-mono transition-colors ${
            sessionActive
              ? "bg-red-500/15 text-red-300 border border-red-500/30 hover:bg-red-500/25"
              : "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/25"
          }`}
        >
          {sessionActive ? (
            <span className="flex items-center justify-center gap-2">
              {listening ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
              {listening ? "Stop microphone" : "Switch to microphone"}
            </span>
          ) : (
            <span className="flex items-center justify-center gap-2">
              <Zap className="w-4 h-4" /> Start copilot session
            </span>
          )}
        </button>
        {error && (
          <p className="mt-2 text-[11px] font-mono text-red-400 bg-red-500/10 border border-red-500/25 rounded-lg p-2">{error}</p>
        )}
      </div>

      {/* Shadow mode badge (readiness gate not passed) */}
      {shadow && sessionActive && (
        <p className="text-[11px] font-mono font-bold text-orange-400 bg-orange-500/10 border border-orange-500/25 rounded-xl px-4 py-2.5">
          🟠 SHADOW MODE — живі дзвінки заблоковані до проходження readiness gate
        </p>
      )}

      {/* Presets */}
      <div className="bg-[#0a0a0a] border border-white/[0.08] rounded-2xl p-4">
        <div className="text-[10px] font-mono text-gray-500 uppercase tracking-[0.15em] font-bold mb-2.5">
          Presets — {domain}
        </div>
        <div className="flex flex-wrap gap-2">
          {COPILOT_PRESETS[domain].map((preset) => (
            <button
              key={preset.label}
              onClick={() => onManualQuestion(preset.question)}
              className="px-2.5 py-1.5 rounded-full text-[10px] font-mono bg-white/[0.04] text-gray-400 border border-white/[0.06] hover:text-gray-200 hover:border-white/20 transition-colors"
            >
              {preset.label}
            </button>
          ))}
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const el = e.currentTarget.elements.namedItem("q");
            if (el instanceof HTMLInputElement && el.value.trim()) {
              onManualQuestion(el.value.trim());
              el.value = "";
            }
          }}
          className="mt-3 flex gap-2"
        >
          <input
            name="q"
            placeholder="Type the prospect's question…"
            className="flex-1 bg-black/30 border border-white/[0.08] rounded-xl px-3 py-2 text-[12px] text-gray-200 font-mono placeholder:text-gray-600 outline-none focus:border-indigo-500/40"
          />
          <button type="submit" className="px-3 rounded-xl bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 text-[11px] font-mono font-bold">
            ask
          </button>
        </form>
      </div>

      {/* Guided screening flow (recruitment domain, live session) */}
      {sessionActive && flow && (
        <>
          <div className="bg-[#0a0a0a] border border-white/[0.08] rounded-2xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-mono text-gray-500 uppercase tracking-[0.15em] font-bold">
                Етап {flow.stageNumber}/{flow.totalStages} · {flow.stageTitle}
              </span>
              <span className="text-[10px] font-mono text-gray-600">{flow.timebox}</span>
            </div>
            <div className="h-1 w-full bg-white/[0.06] rounded-full overflow-hidden mb-3">
              <div
                className="h-full bg-indigo-500/60 transition-all"
                style={{ width: `${(flow.checkedIds.length / Math.max(flow.blockers.length, 1)) * 100}%` }}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              {flow.blockers.map((q) => {
                const checked = flow.checkedIds.includes(q.id);
                return (
                  <button
                    key={q.id}
                    onClick={() => onToggleBlocker?.(q.id)}
                    className={`flex items-start gap-2 text-left text-[11px] font-mono rounded-lg px-2 py-1.5 transition-colors ${
                      checked ? "text-emerald-300/80" : "text-gray-400 hover:bg-white/[0.03]"
                    }`}
                  >
                    <span className={`mt-[1px] w-3.5 h-3.5 shrink-0 rounded border ${checked ? "bg-emerald-500/25 border-emerald-500/50" : "border-white/20"}`}>
                      {checked ? "✓" : ""}
                    </span>
                    <span className={checked ? "line-through decoration-emerald-500/40" : ""}>{q.text}</span>
                  </button>
                );
              })}
            </div>
            {!flow.canAdvance && (
              <p className="mt-2 text-[10px] font-mono text-orange-300/80">
                Copilot не пускає на наступний етап: не всі питання-блокери відмічені.
              </p>
            )}
            <button
              onClick={onAdvanceStage}
              disabled={!flow.canAdvance}
              className={`mt-3 w-full rounded-xl px-3 py-2 text-[11px] font-mono font-bold transition-colors flex items-center justify-center gap-1.5 ${
                flow.canAdvance
                  ? "bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 hover:bg-indigo-500/25"
                  : "bg-white/[0.03] text-gray-600 border border-white/[0.05] cursor-not-allowed"
              }`}
            >
              Завершити етап <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Pinned: next best question */}
          {flow.nextQuestion && (
            <div className="bg-indigo-500/[0.07] border border-indigo-500/25 rounded-2xl p-4">
              <div className="text-[10px] font-mono text-indigo-300/70 uppercase tracking-[0.15em] font-bold mb-1.5">
                Наступне найкраще питання · {flow.nextQuestion.stageTitle}
              </div>
              <p className="text-[14px] font-bold text-gray-100 leading-snug">{flow.nextQuestion.question.text}</p>
            </div>
          )}

          {/* Recruitment objection alert */}
          {objection && (
            <div className="bg-orange-500/[0.07] border border-orange-500/25 rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-orange-400" />
                <span className="text-[11px] font-bold text-orange-400 uppercase tracking-wider">
                  {objection.label} · {objection.framework}
                </span>
              </div>
              <p className="text-[12px] text-gray-300 leading-relaxed">{objection.core_response}</p>
            </div>
          )}

          {/* Red flags */}
          {flow.redFlags.length > 0 && (
            <div className="bg-red-500/[0.06] border border-red-500/25 rounded-2xl p-4">
              <div className="text-[10px] font-mono text-red-400 uppercase tracking-[0.15em] font-bold mb-2">
                Червоні прапорці
              </div>
              <ul className="flex flex-col gap-1">
                {flow.redFlags.map((f) => (
                  <li key={f.id} className="text-[11px] font-mono text-red-300/90">• {f.description}</li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}

      {/* Suggestion card */}
      <div className="bg-[#0a0a0a] border border-white/[0.08] rounded-2xl p-4">
        <div className="text-[10px] font-mono text-gray-500 uppercase tracking-[0.15em] font-bold mb-2.5">
          Suggestion
        </div>
        {busy && <p className="text-[12px] font-mono text-gray-500">thinking…</p>}
        {!busy && !suggestion && (
          <p className="text-[12px] font-mono text-gray-600">
            {sessionActive
              ? "Waiting for the prospect to ask something…"
              : "Start a session and ask anything — answers are grounded in your knowledge base."}
          </p>
        )}
        {!busy && suggestion && (
          <>
            <p className="text-[12px] text-gray-200 leading-relaxed mb-2">{question && <span className="text-gray-500 font-mono text-[11px]">Q: {question}{"\n"}</span>}{suggestion}</p>
            {sources.length > 0 && (
              <p className="flex items-center gap-1.5 text-[10px] text-gray-600 font-mono">
                <BookOpen className="w-3 h-3" /> sources: {sources.join(", ")}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
});
