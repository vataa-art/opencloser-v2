// ============================================================
// CopilotView — live-assist session container.
// Gating: a copilot session on a lead requires the same DNC /
// consent compliance gate as the dialer (isDoNotCall +
// assertLeadCallable). Audio: reuses DeepgramTranscriber over the
// local relay for the microphone channel; a second (virtual cable)
// channel for the other side of a real call is a second-wave item.
// ============================================================

import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getProviderKey } from "../../stores/keys.store";
import { getLeads, assertLeadCallable, addLeadNote } from "../../services/lead.service";
import type { Lead } from "../../types";
import { isDoNotCall } from "../crm/lib/compliance";
import { DeepgramTranscriber } from "../voice/lib/deepgram";
import {
  buildTranscriptWindow,
  initialCopilotState,
  shouldFireCopilot,
  withLineAt,
  type CopilotTriggerState,
  type TranscriptLine,
} from "./copilot-engine";
import { CopilotPanel, type CopilotDomain, type FlowUiState } from "./CopilotPanel";
import {
  SCREENING_FLOW,
  advanceStage,
  computeRedFlags,
  currentStage,
  detectForbiddenTopic,
  detectRecruitmentObjection,
  initialFlowProgress,
  nextBestQuestion,
  stageBlockersSatisfied,
  toggleQuestion,
  type FlowProgress,
  type RecruitmentObjectionMatch,
} from "./screening-flow";
import {
  SCORECARD_CRITERIA,
  type ScoreValue,
} from "../../configs/candidate-scorecard";
import { scoreCandidate, scorecardSummary, type CriterionScores } from "./candidate-scorecard";
import { PRECALL_CHEATSHEET_FACTS } from "../../configs/precall-cheatsheet";

interface CopilotTurnResult {
  suggestion: string;
  sources: string[];
  question: string;
}

export function CopilotView() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [selectedLeadId, setSelectedLeadId] = useState<string>("");
  const [gateError, setGateError] = useState<string | null>(null);
  const [sessionActive, setSessionActive] = useState(false);
  const [listening, setListening] = useState(false);
  const [domain, setDomain] = useState<CopilotDomain>("sales");
  const [question, setQuestion] = useState("");
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [sources, setSources] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [flowProgress, setFlowProgress] = useState<FlowProgress>(initialFlowProgress);
  const [recruitmentObjection, setRecruitmentObjection] = useState<RecruitmentObjectionMatch | null>(null);
  const [showScorecard, setShowScorecard] = useState(false);
  const [criterionScores, setCriterionScores] = useState<CriterionScores>({
    motivation: 0, time: 0, budget: 0, readiness: 0, decision: 0,
  });
  const [noteSaved, setNoteSaved] = useState(false);

  const transcriptRef = useRef<TranscriptLine[]>([]);
  const triggerRef = useRef<CopilotTriggerState>(initialCopilotState);
  const transcriberRef = useRef<DeepgramTranscriber | null>(null);
  const firingRef = useRef(false);
  const workletRef = useRef<AudioWorkletNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    getLeads().then(setLeads).catch(() => setLeads([]));
    return () => {
      transcriberRef.current?.disconnect();
      mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
      void audioContextRef.current?.close();
    };
  }, []);

  const runCopilotTurn = useCallback(
    async (lines: TranscriptLine[]) => {
      if (firingRef.current) return;
      firingRef.current = true;
      setBusy(true);
      try {
        const apiKey = await getProviderKey("gemini_api_key");
        const result = await invoke<CopilotTurnResult>("copilot_turn", {
          transcriptWindow: buildTranscriptWindow(lines),
          domain,
          apiKey: apiKey || undefined,
        });
        setQuestion(result.question);
        setSuggestion(result.suggestion);
        setSources(result.sources);
      } catch (e) {
        setError(String(e));
      } finally {
        firingRef.current = false;
        setBusy(false);
      }
    },
    [domain]
  );

  /** Buffer bookkeeping on every finalized transcript line. */
  const onTranscriptLine = useCallback(
    (text: string) => {
      const lines = transcriptRef.current;
      lines.push({ role: "user", text });
      triggerRef.current = withLineAt(triggerRef.current, lines, Date.now());

      // Hard block: forbidden screening questions never reach the copilot.
      const forbidden = detectForbiddenTopic(text);
      if (forbidden) {
        setError(`Заборонене питання (${forbidden}) — такі питання ставити не можна.`);
        return;
      }
      setError(null);

      if (domain === "recruitment") {
        setRecruitmentObjection(detectRecruitmentObjection(text));
      }

      const decision = shouldFireCopilot(lines, triggerRef.current, Date.now());
      triggerRef.current = decision.nextState;
      if (decision.fire) void runCopilotTurn(lines);
    },
    [runCopilotTurn, domain]
  );

  const startMicrophone = useCallback(async () => {
    setError(null);
    try {
      const transcriber = new DeepgramTranscriber({
        onTranscript: onTranscriptLine,
        onError: (err) => setError(err.message),
      });
      await transcriber.connect(
        (localStorage.getItem("deepgram_language") as never) || "en-US"
      );
      transcriberRef.current = transcriber;

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      const context = new AudioContext();
      audioContextRef.current = context;
      const source = context.createMediaStreamSource(stream);
      sourceRef.current = source;
      await context.audioWorklet.addModule("/audio-processor.worklet.js");
      const worklet = new AudioWorkletNode(context, "pcm-capture-processor");
      worklet.port.onmessage = (e) => {
        if (e.data.type === "audio") {
          transcriberRef.current?.sendAudio(e.data.buffer);
        }
      };
      source.connect(worklet);
      workletRef.current = worklet;
      setListening(true);
    } catch (e) {
      stopMicrophone();
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [onTranscriptLine]);

  const stopMicrophone = useCallback(() => {
    transcriberRef.current?.disconnect();
    transcriberRef.current = null;
    workletRef.current?.disconnect();
    workletRef.current = null;
    sourceRef.current?.disconnect();
    sourceRef.current = null;
    mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
    mediaStreamRef.current = null;
    void audioContextRef.current?.close();
    audioContextRef.current = null;
    setListening(false);
  }, []);

  /** Compliance gate mirrors the dialer: DNC / opted-out leads cannot be
   *  live-assisted, and the backend consent gate must pass. */
  const startSession = useCallback(async () => {
    setGateError(null);
    setError(null);
    const lead = leads.find((l) => l.id === selectedLeadId);
    if (!lead) {
      setGateError("Select the lead you are calling first.");
      return;
    }
    if (isDoNotCall(lead)) {
      setGateError("This lead is on the Do Not Call list — copilot sessions are blocked.");
      return;
    }
    try {
      const live = false; // copilot assists human calls; relay presence not required
      await assertLeadCallable(lead.id, live);
    } catch (e) {
      setGateError(String(e));
      return;
    }
    transcriptRef.current = [];
    triggerRef.current = initialCopilotState;
    setSuggestion(null);
    setSources([]);
    setFlowProgress(initialFlowProgress);
    setRecruitmentObjection(null);
    setSessionActive(true);
  }, [leads, selectedLeadId]);

  const endSession = useCallback(() => {
    stopMicrophone();
    setSessionActive(false);
    setSuggestion(null);
    setQuestion("");
    // Post-call stage of the flow: scorecard + note + follow-up.
    if (domain === "recruitment") setShowScorecard(true);
  }, [stopMicrophone, domain]);

  const saveScorecardNote = useCallback(async () => {
    const lead = leads.find((l) => l.id === selectedLeadId);
    if (!lead) return;
    try {
      await addLeadNote(`note_${Date.now()}`, lead.id, scorecardSummary(criterionScores));
      setNoteSaved(true);
    } catch (e) {
      setError(String(e));
    }
  }, [leads, selectedLeadId, criterionScores]);

  const askManual = useCallback(
    (text: string) => {
      void onTranscriptLine(text);
    },
    [onTranscriptLine]
  );

  // Guided flow UI (recruitment domain, live session only).
  const flowActive = sessionActive && domain === "recruitment";
  const flowStage = flowActive ? currentStage(SCREENING_FLOW, flowProgress) : null;
  const flowUi: FlowUiState | null = flowStage
    ? {
        stageNumber: flowStage.order,
        totalStages: SCREENING_FLOW.stages.length,
        stageTitle: flowStage.title,
        timebox: flowStage.timebox,
        blockers: flowStage.blocking_questions,
        checkedIds: flowProgress.checked,
        redFlags: computeRedFlags(SCREENING_FLOW, flowProgress, {
          // talk-ratio needs the second (prospect) channel — second wave.
          talkRatio: null,
          quotedPrice: flowProgress.checked.includes("present_options"),
          quotedStartDate: flowProgress.checked.includes("fit_check"),
          consentConfirmed: flowProgress.checked.includes("consent_recording"),
        }),
        nextQuestion: nextBestQuestion(SCREENING_FLOW, flowProgress),
        canAdvance: stageBlockersSatisfied(flowStage, flowProgress.checked),
      }
    : null;
  const scoreResult = scoreCandidate(criterionScores);
  const selectedLead = leads.find((l) => l.id === selectedLeadId) ?? null;

  return (
    <div className="h-full overflow-y-auto custom-scrollbar" style={{ background: "var(--bg-primary)" }}>
      <div className="max-w-[520px] mx-auto py-6">
        <h2 className="text-[15px] font-bold text-gray-200 px-5 mb-1">Live Copilot</h2>
        <p className="text-[11px] font-mono text-gray-500 px-5 mb-4">
          KB-grounded answers during real calls. Sessions are compliance-gated (DNC / consent).
        </p>

        <div className="px-5 pb-4">
          <label className="block text-[10px] font-mono text-gray-500 uppercase tracking-[0.15em] font-bold mb-1.5">
            Who are you calling?
          </label>
          <select
            value={selectedLeadId}
            onChange={(e) => setSelectedLeadId(e.target.value)}
            className="w-full bg-black/30 border border-white/[0.08] rounded-xl px-3 py-2 text-[12px] text-gray-200 font-mono outline-none focus:border-indigo-500/40"
          >
            <option value="">— select a lead —</option>
            {leads.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name} — {l.company}{l.dnc ? " (DNC)" : ""}
              </option>
            ))}
          </select>
          {gateError && (
            <p className="mt-2 text-[11px] font-mono text-red-400 bg-red-500/10 border border-red-500/25 rounded-lg p-2">
              ⛔ {gateError}
            </p>
          )}
        </div>

        {/* Pre-call cheat sheet: five facts, 10 seconds before the call */}
        {!sessionActive && !showScorecard && (
          <div className="px-5 pb-4">
            <div className="bg-[#0a0a0a] border border-white/[0.08] rounded-2xl p-4">
              <div className="text-[10px] font-mono text-gray-500 uppercase tracking-[0.15em] font-bold mb-2.5">
                Pre-call cheat sheet — 5 фактів
              </div>
              <ul className="flex flex-col gap-1.5 text-[12px]">
                {PRECALL_CHEATSHEET_FACTS.map((fact) => (
                  <li key={fact.id} className="flex flex-col">
                    <span className="font-mono text-[10px] text-gray-500 uppercase">{fact.title}</span>
                    <span className="text-gray-300">
                      {fact.id === "who_and_source" && selectedLead
                        ? `${selectedLead.name} — ${selectedLead.company}${selectedLead.phone ? ` · ${selectedLead.phone}` : ""}`
                        : fact.id === "previous_contact" && selectedLead?.notes
                        ? selectedLead.notes.slice(0, 140)
                        : fact.id === "likely_objections"
                        ? "Дорого · Немає часу · Чи гарантуєте роботу"
                        : "— заповнюється з KB під час етапів 2 і 5 —"}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* Post-call scorecard (stage 8 of the screening flow) */}
        {showScorecard && (
          <div className="px-5 pb-8">
            <div className="bg-[#0a0a0a] border border-white/[0.08] rounded-2xl p-4">
              <div className="text-[10px] font-mono text-gray-500 uppercase tracking-[0.15em] font-bold mb-3">
                Скоркарта кандидата — 0–3 бали за критерій
              </div>
              <div className="flex flex-col gap-3">
                {SCORECARD_CRITERIA.map((c) => (
                  <div key={c.id}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px] font-bold text-gray-300">{c.title}</span>
                      <span className="text-[10px] font-mono text-gray-500">{c.levels[criterionScores[c.id]]}</span>
                    </div>
                    <div className="flex gap-1.5">
                      {([0, 1, 2, 3] as ScoreValue[]).map((v) => (
                        <button
                          key={v}
                          onClick={() => setCriterionScores((s) => ({ ...s, [c.id]: v }))}
                          className={`flex-1 rounded-lg py-1.5 text-[12px] font-mono font-bold transition-colors ${
                            criterionScores[c.id] === v
                              ? "bg-indigo-500/25 text-indigo-200 border border-indigo-500/50"
                              : "bg-white/[0.04] text-gray-500 border border-white/[0.06] hover:text-gray-300"
                          }`}
                        >
                          {v}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 p-3 rounded-xl bg-black/30 border border-white/[0.05]">
                <div className="text-[13px] font-bold text-gray-100">
                  {scoreResult.band} · {scoreResult.total}/{scoreResult.max}
                </div>
                <div className="text-[11px] font-mono text-gray-400">{scoreResult.action}</div>
              </div>
              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => void saveScorecardNote()}
                  disabled={noteSaved}
                  className={`flex-1 rounded-xl px-3 py-2 text-[11px] font-mono font-bold ${
                    noteSaved
                      ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
                      : "bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 hover:bg-indigo-500/25"
                  }`}
                >
                  {noteSaved ? "✓ Нотатку збережено" : "Зберегти як нотатку ліда"}
                </button>
                <button
                  onClick={() => setShowScorecard(false)}
                  className="px-3 rounded-xl bg-white/[0.04] text-gray-400 border border-white/[0.06] text-[11px] font-mono"
                >
                  Закрити
                </button>
              </div>
            </div>
          </div>
        )}

        <CopilotPanel
          domain={domain}
          onDomainChange={setDomain}
          listening={listening}
          sessionActive={sessionActive}
          onToggleSession={
            sessionActive
              ? listening
                ? stopMicrophone
                : startMicrophone
              : startSession
          }
          question={question}
          suggestion={suggestion}
          sources={sources}
          busy={busy}
          onManualQuestion={askManual}
          error={error}
          onEndSession={endSession}
          flow={flowUi}
          onToggleBlocker={(id) => setFlowProgress((p) => toggleQuestion(p, id))}
          onAdvanceStage={() => setFlowProgress((p) => advanceStage(SCREENING_FLOW, p))}
          objection={domain === "recruitment" ? recruitmentObjection : null}
        />
      </div>
    </div>
  );
}
