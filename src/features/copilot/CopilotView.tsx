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
import { getLeads, assertLeadCallable } from "../../services/lead.service";
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
import { CopilotPanel, type CopilotDomain } from "./CopilotPanel";

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
      const decision = shouldFireCopilot(lines, triggerRef.current, Date.now());
      triggerRef.current = decision.nextState;
      if (decision.fire) void runCopilotTurn(lines);
    },
    [runCopilotTurn]
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
    setSessionActive(true);
  }, [leads, selectedLeadId]);

  const endSession = useCallback(() => {
    stopMicrophone();
    setSessionActive(false);
    setSuggestion(null);
    setQuestion("");
  }, [stopMicrophone]);

  const askManual = useCallback(
    (text: string) => {
      void onTranscriptLine(text);
    },
    [onTranscriptLine]
  );

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
        />
      </div>
    </div>
  );
}
