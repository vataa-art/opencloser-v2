import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import {
  X, Activity, Timer,
} from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-shell";
import { Lead, ICP } from "../../../types";
import type { AIPersona } from "../../../types/persona";
import { createCallerEngine, CallerEngine, CallState, TranscriptLine } from "../lib/caller-engine";
import { analyzeEmotions, EmotionAxes, EmotionShift } from "../lib/emotion-engine";
import { detectObjectionInTranscript, ObjectionMatch } from "../lib/objection-engine";
import { coachAdvise, createDebouncedCoach, type CoachAdvice } from "../lib/coach-agent";
import { DeepgramTranscriber, normalizeDeepgramLanguage } from "../lib/deepgram";
import { getProviderKey, hasAnyProviderKey, useKeysStore } from "../../../stores/keys.store";
import { assertLeadCallable } from "../../../services/lead.service";
import { isDoNotCall, liveCallBlockReason } from "../../crm/lib/compliance";
import { TranscriptPanel } from "./warroom/TranscriptPanel";
import { IntelPanel } from "./warroom/IntelPanel";
import { decodeBase64Pcm } from "../lib/pcm";
import {
  buildCallSystemPrompt,
  buildCoachingHints,
  formatTimer,
  getCallPhase,
  getSentimentFromMood,
  loadPersona,
  SENTIMENT_CONFIG,
  type SentimentLevel,
} from "./warroom/warroom-logic";

interface WarRoomProps {
  lead: Lead;
  icp: ICP | null;
  onClose: (transcript?: TranscriptLine[], durationSeconds?: number) => void;
}

interface EmotionState {
  axes: EmotionAxes | null;
  shifts: EmotionShift[];
  sentiment: SentimentLevel;
  label: string;
}

export function WarRoom({ lead, icp, onClose }: WarRoomProps) {
  const [callState, setCallState] = useState<CallState>("idle");
  const [isMuted, setIsMuted] = useState(false);
  const [usePhoneLink, setUsePhoneLink] = useState(true);
  const [transcript, setTranscript] = useState<TranscriptLine[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // Emotion & Sentiment
  const [emotionState, setEmotionState] = useState<EmotionState>({
    axes: null,
    shifts: [],
    sentiment: "cold",
    label: "Neutral",
  });

  // Objection coaching
  const [activeObjection, setActiveObjection] = useState<ObjectionMatch | null>(null);
  const [objectionHistory, setObjectionHistory] = useState<ObjectionMatch[]>([]);
  const [coachAdvice, setCoachAdvice] = useState<CoachAdvice | null>(null);

  // Audio
  const audioContextRef = useRef<AudioContext | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const outputAnalyserRef = useRef<AnalyserNode | null>(null);

  // Playback
  const playbackQueueRef = useRef<Float32Array[]>([]);
  const playbackQueueIndexRef = useRef(0);
  const nextPlayTimeRef = useRef(0);
  const playbackSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());

  // Engine
  const engineRef = useRef<CallerEngine | null>(null);
  const deepgramRef = useRef<DeepgramTranscriber | null>(null);
  const isMutedRef = useRef(false);
  const transcriptRef = useRef<TranscriptLine[]>([]);
  const startTimeRef = useRef(Date.now());
  const timeoutIdsRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);

  const stopPlayback = useCallback(() => {
    playbackSourcesRef.current.forEach((source) => {
      try {
        source.stop();
      } catch {
        // A source that already ended cannot be stopped again.
      }
    });
    playbackSourcesRef.current.clear();
    playbackQueueRef.current = [];
    playbackQueueIndexRef.current = 0;
    nextPlayTimeRef.current = audioContextRef.current?.currentTime ?? 0;
  }, []);

  const safeSetTimeout = (fn: () => void, ms: number) => {
    const id = setTimeout(fn, ms);
    timeoutIdsRef.current.push(id);
    return id;
  };

  // Persona
  const persona: AIPersona = useMemo(() => loadPersona(), []);
  const { axes: currentAxes, shifts: recentShifts, sentiment, label: sentimentLabel } = emotionState;

  useEffect(() => {
    // Init emotion axes from persona
    setEmotionState((prev) => ({
      ...prev,
      axes: {
        empathy: persona.emotionalModulation.empathy,
        energy: persona.emotionalModulation.energy,
        formality: persona.emotionalModulation.formality,
        assertiveness: persona.emotionalModulation.assertiveness ?? 45,
        humor: persona.emotionalModulation.humor ?? 30,
      },
    }));
    // Provider keys load from the OS keychain before the engine picks a mode.
    useKeysStore.getState().hydrate().finally(() => {
      startCall();
    });
    return () => {
      timeoutIdsRef.current.forEach(clearTimeout);
      timeoutIdsRef.current = [];
      workletNodeRef.current?.disconnect();
      scriptProcessorRef.current?.disconnect();
      sourceRef.current?.disconnect();
      mediaStreamRef.current?.getTracks().forEach(t => t.stop());
      stopPlayback();
      if (audioContextRef.current?.state !== "closed") audioContextRef.current?.close();
      engineRef.current?.disconnect();
      deepgramRef.current?.disconnect();
    };
  }, [stopPlayback]);

  // Timer
  useEffect(() => {
    if (callState !== "active" && callState !== "objection_mode" && callState !== "closing") return;
    const interval = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [callState]);

  // Real-time emotion + objection analysis every 2 transcript entries
  useEffect(() => {
    if (transcript.length === 0 || transcript.length % 2 !== 0) return;

    // Emotion analysis
    const baseAxes: EmotionAxes = currentAxes || {
      empathy: persona.emotionalModulation.empathy,
      energy: persona.emotionalModulation.energy,
      formality: persona.emotionalModulation.formality,
      assertiveness: persona.emotionalModulation.assertiveness ?? 45,
      humor: persona.emotionalModulation.humor ?? 30,
    };

    const windowed = transcript.length > 20 ? transcript.slice(-20) : transcript;
    const analysis = analyzeEmotions(windowed, baseAxes);
    const nextSentiment = getSentimentFromMood(analysis.dominantMood);
    setEmotionState((prev) => ({
      ...prev,
      axes: persona.emotionalModulation.dynamicToneShift ? analysis.axes : prev.axes,
      shifts: persona.emotionalModulation.dynamicToneShift && analysis.shifts.length > 0
        ? analysis.shifts.slice(-3)
        : prev.shifts,
      sentiment: nextSentiment,
      label: analysis.dominantMood,
    }));

    // Objection detection
    const objection = detectObjectionInTranscript(windowed);
    if (objection && objection.archetype !== activeObjection?.archetype) {
      setActiveObjection(objection);
      setObjectionHistory(prev => [objection, ...prev.slice(0, 4)]);
      setCallState("objection_mode");
      // Auto-clear after 20s
      safeSetTimeout(() => {
        setActiveObjection(null);
        setCallState(prev => prev === "objection_mode" ? "active" : prev);
      }, 20000);
    }
  }, [transcript.length]);

  const buildSystemPrompt = (): string => {
    return buildCallSystemPrompt(persona, currentAxes, icp, lead);
  };

  const startCall = async () => {
    const live = hasAnyProviderKey();
    const localBlock = live ? liveCallBlockReason(lead) : (isDoNotCall(lead) ? "Lead is on the Do Not Call list" : null);
    if (localBlock) {
      setError(localBlock);
      return;
    }
    try {
      await assertLeadCallable(lead.id, live);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      return;
    }
    try {
      const preferredMicId = localStorage.getItem("preferredMicId");
      const preferredSpeakerId = localStorage.getItem("preferredSpeakerId");
      const personaData: AIPersona = persona;

      // ── Audio Context ──────────────────────────────────────
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const ac = new AudioContextClass({ sampleRate: 16000 });
      if (preferredSpeakerId && typeof (ac as any).setSinkId === "function") {
        try { await (ac as any).setSinkId(preferredSpeakerId); } catch (_) {}
      }
      audioContextRef.current = ac;

      // ── Output Analyser (for AI Agent visualization) ────────
      const outAnalyser = ac.createAnalyser();
      outAnalyser.fftSize = 128;
      outAnalyser.connect(ac.destination);
      outputAnalyserRef.current = outAnalyser;

      // ── AudioWorklet ───────────────────────────────────────
      try {
        await ac.audioWorklet.addModule("/audio-processor.worklet.js");
      } catch (e) {
        console.warn("AudioWorklet load failed, falling back:", e);
      }

      // ── Microphone ─────────────────────────────────────────
      try {
        const audioConstraints: boolean | MediaTrackConstraints = preferredMicId
          ? { deviceId: { exact: preferredMicId } } : true;
        mediaStreamRef.current = await navigator.mediaDevices.getUserMedia({ audio: audioConstraints });
        sourceRef.current = ac.createMediaStreamSource(mediaStreamRef.current);

        // ── Analyser for visualizer ────────────────────────────
        const analyser = ac.createAnalyser();
        analyser.fftSize = 128;
        sourceRef.current.connect(analyser);
        analyserRef.current = analyser;
      } catch (err) {
        console.warn("No active microphone found, proceeding in text-only/simulation mode.");
      }

      const hasAnyKey = hasAnyProviderKey();

      if (!hasAnyKey) {
        // ── DEMO SIMULATION (clearly labelled, offline) ────────
        setCallState("connecting");

        safeSetTimeout(() => {
          setCallState("active");
          startTimeRef.current = Date.now();

          const industry = icp?.industry?.toLowerCase() || '';
          const isInsurance = industry.includes('insurance') || industry.includes('construction') || industry.includes('engineering');
          const isTech = industry.includes('software') || industry.includes('saas') || industry.includes('tech') || industry.includes('cloud');
          const competitor = icp?.competitorNames?.[0] || 'your current provider';
          const valueProp = icp?.valueProposition || 'scale your operations efficiently';

          const script = isInsurance ? [
            { text: `Hello? Who is this?`, role: "user", delay: 2000 },
            { text: `Hi ${lead.name}, this is the OpenCloser AI calling. I noticed ${lead.company} handles heavy industrial projects — quick question: if one of your key assets went down and your current policy denied the claim, what would that cost you?`, role: "model", delay: 5500 },
            { text: `We already have coverage through ${competitor}. Been with them for years. Why would we switch?`, role: "user", delay: 13000 },
            { text: `That's exactly what most of our clients said. What they found was ${competitor}'s standard policies have specific gaps that leave $100k+ exposures on equipment during transit and complex projects. We close those gaps.`, role: "model", delay: 19000 },
            { text: `Hmm. What kind of gaps are we talking about?`, role: "user", delay: 27000 },
            { text: `${lead.name}, the most common one is equipment in transit between job sites — most policies drop coverage the moment it leaves your yard. Our contractor-specific policy guarantees coverage end-to-end. ${valueProp}. Would Tuesday at 2pm work for a 15-minute walkthrough?`, role: "model", delay: 33000 },
            { text: `I hadn't considered the transit gap. Yeah, send me a calendar invite — let's talk Tuesday.`, role: "user", delay: 42000 },
            { text: `Excellent. I'll send that right now. Looking forward to showing you exactly how we protect your operations. Have a great day, ${lead.name}.`, role: "model", delay: 48000 },
          ] : isTech ? [
            { text: `Hello? Who is this?`, role: "user", delay: 2000 },
            { text: `Hi ${lead.name}, this is the OpenCloser AI calling. I noticed ${lead.company} is in the tech space — quick question: what's your current cost per qualified lead?`, role: "model", delay: 5000 },
            { text: `Honestly, it's getting out of control. We're spending about $200 per MQL and the quality is dropping.`, role: "user", delay: 12000 },
            { text: `That's exactly the problem we solve. Most tech companies are in the same spot — paying more for fewer meetings. Our AI handles the first 1,000 outbound touches and only hands over qualified conversations. Clients typically see a 3x improvement in meeting quality within 30 days.`, role: "model", delay: 18000 },
            { text: `We tried an outbound AI tool last year and it was terrible. Sounded completely robotic.`, role: "user", delay: 27000 },
            { text: `I completely understand the skepticism — honestly, you're talking to our AI right now. If I could show you the WarRoom dashboard where you can see exactly how my brain processes buyer signals in real time, would 15 minutes next Tuesday work?`, role: "model", delay: 33000 },
            { text: `Wait — you're an AI? That's impressive. Okay, send me the invite. I want to see this.`, role: "user", delay: 42000 },
            { text: `Sent! Thanks for the great conversation, ${lead.name}. Looking forward to showing you what's possible.`, role: "model", delay: 48000 },
          ] : [
            { text: `Hello? Who is this?`, role: "user", delay: 2000 },
            { text: `Hi ${lead.name}, this is OpenCloser AI calling. I'm reaching out because we help companies like ${lead.company} improve their outbound efficiency. How are things going on the sales front?`, role: "model", delay: 5500 },
            { text: `We're doing okay but honestly, our team is stretched thin. Too many dials, not enough qualified meetings.`, role: "user", delay: 12000 },
            { text: `That's exactly the pattern we see. ${lead.name}, if I could show you how to triple your qualified meetings without adding a single SDR, would that be worth 15 minutes next Tuesday?`, role: "model", delay: 19000 },
            { text: `I don't know — we already use ${competitor} for some of our automation. How are you different?`, role: "user", delay: 27000 },
            { text: `Great question. ${competitor} is solid, but they focus on workflow — we focus on conversation quality. Our AI handles the actual phone dialogue, handles objections in real time, and only hands over meetings that are truly ready. ${valueProp}.`, role: "model", delay: 34000 },
            { text: `Alright, I'm curious. Send me a calendar invite and I'll take a look.`, role: "user", delay: 43000 },
            { text: `Perfect. Invite sent. Thanks for your time, ${lead.name} — really looking forward to showing you what this can do.`, role: "model", delay: 49000 },
          ];

          script.forEach((line) => {
            safeSetTimeout(() => {
               const newLine: TranscriptLine = {
                 id: `msg_${Date.now()}_${Math.random()}`,
                 role: line.role as any,
                 text: line.text,
                 timestamp: Date.now()
               };
               setTranscript(prev => {
                  const next = [...prev, newLine];
                  transcriptRef.current = next;
                  return next;
               });

               // End call 3 seconds after the last message
                if (line === script[script.length - 1]) {
                   safeSetTimeout(() => endCall(), 3000);
                }
            }, line.delay);
          });
        }, 1500);

        return; // Bail out from real engine connection
      }

      // ── CallerEngine ───────────────────────────────────────
      const provider = personaData.provider || "gemini";
      const deepgramApiKey = (await getProviderKey("deepgram_api_key")).trim();
      if (deepgramApiKey) {
        const deepgram = new DeepgramTranscriber({
          onTranscript: (text) => {
            const line: TranscriptLine = {
              id: `deepgram_${Date.now()}_${Math.random()}`,
              role: "user",
              text,
              timestamp: Date.now(),
            };
            setTranscript(prev => {
              const next = [...prev, line];
              transcriptRef.current = next;
              return next;
            });
          },
          onError: (err) => console.warn("Deepgram transcription error:", err.message),
        });
        try {
          const configuredLanguage = localStorage.getItem("deepgram_language") || personaData.language;
          await deepgram.connect(normalizeDeepgramLanguage(configuredLanguage));
          deepgramRef.current = deepgram;
        } catch (err) {
          deepgram.disconnect();
          console.warn("Deepgram unavailable; using provider transcript:", err);
        }
      }

      const engine = await createCallerEngine(provider, {
        onState: (state) => {
          setCallState(state);
          if (state === "active") {
            startTimeRef.current = Date.now();
            if (usePhoneLink) {
              const phone = lead.phone.replace(/[^0-9+]/g, "");
              open(`tel:${phone}`).catch(() => {});
            }
          }
        },
        onAudio: (b64, sampleRate) => playAudio(b64, sampleRate),
        onTranscript: (line) => {
          // Deepgram is authoritative for prospect speech when configured.
          if (line.role === "user" && deepgramRef.current?.isConnected()) return;
          setTranscript(prev => {
            const next = [...prev, line];
            transcriptRef.current = next;
            return next;
          });
        },
        onInterrupted: () => {
          stopPlayback();
        },
        onHandoffRequested: (reason) => {
          setCallState("closing");
          const line: TranscriptLine = {
            id: `handoff_${Date.now()}_${Math.random()}`,
            role: "model",
            text: `[Human handoff requested: ${reason}]`,
            timestamp: Date.now(),
          };
          setTranscript(prev => {
            const next = [...prev, line];
            transcriptRef.current = next;
            return next;
          });
        },
        onError: (err) => setError(err.message),
      });

      engineRef.current = engine;
      const systemPrompt = buildSystemPrompt();
      await engine.connect(systemPrompt, personaData.voiceId, personaData.language);

      // ── Wire AudioWorklet → Engine ─────────────────────────
      try {
        const worklet = new AudioWorkletNode(ac, "pcm-capture-processor");
        worklet.port.onmessage = (e) => {
          if (e.data.type === "audio" && !isMutedRef.current) {
            engine.sendAudio(e.data.buffer);
            deepgramRef.current?.sendAudio(e.data.buffer);
          }
        };
        sourceRef.current?.connect(worklet);
        workletNodeRef.current = worklet;
      } catch (e) {
        // Fallback: ScriptProcessorNode if AudioWorklet not supported
        console.warn("Falling back to ScriptProcessorNode:", e);
        const processor = ac.createScriptProcessor(2048, 1, 1);
        scriptProcessorRef.current = processor;
        processor.onaudioprocess = (ev) => {
          if (isMutedRef.current) return;
          engine.sendAudio(ev.inputBuffer.getChannelData(0).slice());
          deepgramRef.current?.sendAudio(ev.inputBuffer.getChannelData(0).slice());
        };
        sourceRef.current?.connect(processor);
        processor.connect(ac.destination);
      }

    } catch (err: any) {
      console.error("Failed to start call:", err);
      audioContextRef.current?.close();
      setError(err.message || "Failed to access microphone or connect to AI.");
    }
  };

  const playAudio = (b64: string, sampleRate: number = 24000) => {
    if (!audioContextRef.current) return;
    playbackQueueRef.current.push(decodeBase64Pcm(b64));
    scheduleBuffer(sampleRate);
  };

  const scheduleBuffer = (sampleRate = 24000) => {
    const ac = audioContextRef.current;
    if (!ac || playbackQueueRef.current.length === 0) return;
    const outAnalyser = outputAnalyserRef.current;
    const now = ac.currentTime;
    if (nextPlayTimeRef.current < now) nextPlayTimeRef.current = now;
    while (playbackQueueIndexRef.current < playbackQueueRef.current.length) {
      const data = playbackQueueRef.current[playbackQueueIndexRef.current++];
      const buf = ac.createBuffer(1, data.length, sampleRate);
      buf.getChannelData(0).set(data);
      const src = ac.createBufferSource();
      src.buffer = buf;
      src.connect(outAnalyser || ac.destination);
      playbackSourcesRef.current.add(src);
      src.onended = () => playbackSourcesRef.current.delete(src);
      src.start(nextPlayTimeRef.current);
      nextPlayTimeRef.current += buf.duration;
    }
    playbackQueueRef.current = [];
    playbackQueueIndexRef.current = 0;
  };

  const endCall = useCallback(() => {
    timeoutIdsRef.current.forEach(clearTimeout);
    timeoutIdsRef.current = [];
    workletNodeRef.current?.disconnect();
    scriptProcessorRef.current?.disconnect();
    sourceRef.current?.disconnect();
    mediaStreamRef.current?.getTracks().forEach(t => t.stop());
    stopPlayback();
    if (audioContextRef.current?.state !== "closed") audioContextRef.current?.close();
    engineRef.current?.disconnect();
    deepgramRef.current?.disconnect();

    const durationSeconds = Math.floor((Date.now() - startTimeRef.current) / 1000);
    const t = transcriptRef.current;
    const userMessages = t.filter(e => e.role === "user").length;

    let status = "Rejected";
    if (userMessages >= 3) status = "Success";
    else if (durationSeconds < 15) status = "Voicemail";

    const callLogId = `call_${Date.now()}`;
    invoke("add_call_log", {
      id: callLogId, leadId: lead.id, durationSeconds,
      transcript: JSON.stringify(t), status,
    }).catch(console.error);

    onClose(t, durationSeconds);
  }, [lead.id, onClose, stopPlayback]);

  const toggleMute = useCallback(() => {
    const next = !isMutedRef.current;
    setIsMuted(next);
    isMutedRef.current = next;
    workletNodeRef.current?.port.postMessage({ type: "setMuted", muted: next });
  }, []);

  const sentimentInfo = SENTIMENT_CONFIG[sentiment];
  const isCallLive = callState === "active" || callState === "objection_mode" || callState === "closing";
  const phase = getCallPhase(callState, transcript.length);
  const hasExceededFiveMinutes = elapsedSeconds > 300;
  // CoachAgent: KB-grounded counter-scripts + hints, debounced so live
  // transcript updates never spam the embedding API.
  const debouncedCoach = useMemo(
    () =>
      createDebouncedCoach(4000, async (objection: ObjectionMatch | null, lines: TranscriptLine[]) =>
        setCoachAdvice(await coachAdvise({ objection, transcript: lines }))
      ),
    [],
  );
  useEffect(() => {
    debouncedCoach.schedule(activeObjection, transcript);
  }, [debouncedCoach, activeObjection, transcript.length]);
  useEffect(() => () => debouncedCoach.cancel(), [debouncedCoach]);
  const coachingHints = useMemo(
    () => buildCoachingHints(transcript, hasExceededFiveMinutes ? 301 : 0, coachAdvice?.hints ?? []),
    [transcript, hasExceededFiveMinutes, coachAdvice],
  );
  const { aiTurns, prospectTurns } = useMemo(() => ({
    aiTurns: transcript.filter((t) => t.role === "model").length,
    prospectTurns: transcript.filter((t) => t.role === "user").length,
  }), [transcript]);
  const dismissObjection = useCallback(() => setActiveObjection(null), []);
  const togglePhoneLink = useCallback(() => setUsePhoneLink((value) => !value), []);

  return (
    <div className="warroom-dark fixed inset-0 bg-black/90 backdrop-blur-xl z-50 flex items-center justify-center p-4 animate-fade-in">
      {/* Ambient glow */}
      <div className={`absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full blur-[180px] pointer-events-none transition-colors duration-3000 ${
        isCallLive ? "bg-red-500/8" : "bg-indigo-500/5"
      }`}></div>

      <div className="bg-[#0a0a0a] border border-white/[0.08] rounded-[20px] w-full max-w-[1100px] h-[90vh] flex flex-col overflow-hidden shadow-[0_32px_128px_rgba(0,0,0,0.8)] relative z-10 animate-scale-in">

        {/* ── Header ── */}
        <div className="px-6 py-4 border-b border-white/[0.06] bg-gradient-to-r from-[#111] to-[#0d0d0d] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className={`w-11 h-11 rounded-2xl flex items-center justify-center border transition-all duration-500 ${
                isCallLive
                  ? "bg-red-500/15 border-red-500/30"
                  : "bg-white/5 border-white/10"
              }`}>
                <Activity className="w-5 h-5 text-red-400" />
              </div>
              {isCallLive && (
                <>
                  <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-ping" />
                  <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full" />
                </>
              )}
            </div>
            <div>
              <h2 className="text-[15px] font-bold text-white tracking-tight flex items-center gap-2">
                War Room
                <span className="text-[9px] font-mono bg-white/[0.06] text-gray-400 px-2 py-0.5 rounded-md border border-white/[0.05] uppercase tracking-widest">
                  AI Caller
                </span>
              </h2>
              <p className="text-gray-500 text-[12px] mt-0.5 font-medium">
                {callState === "connecting" ? "Establishing secure connection..." :
                 callState === "active" ? `Live · ${lead.name} at ${lead.company}` :
                 callState === "objection_mode" ? `⚡ Objection Active — ${lead.name}` :
                 "Call ended"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            {/* Sentiment Badge */}
            <div className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-[11px] font-bold transition-all duration-500 ${sentimentInfo.bg} ${sentimentInfo.color}`}>
              <span className="text-sm">{sentimentInfo.emoji}</span>
              <span>{sentimentInfo.label}</span>
            </div>
            {/* Timer */}
            <div className={`flex items-center gap-2 px-3.5 py-2 rounded-xl border transition-all ${
              isCallLive ? "bg-red-500/10 border-red-500/20" : "bg-white/5 border-white/10"
            }`}>
              <Timer className={`w-3.5 h-3.5 ${isCallLive ? "text-red-400" : "text-gray-500"}`} />
              <span className={`font-mono text-[12px] font-bold tabular-nums ${isCallLive ? "text-red-400" : "text-gray-500"}`}>
                {formatTimer(elapsedSeconds)}
              </span>
            </div>
            {/* Phase */}
            <div className={`text-[10px] font-mono uppercase tracking-wider px-3 py-2 rounded-xl bg-white/[0.04] border border-white/[0.06] font-bold ${phase.color}`}>
              {phase.label}
            </div>
            <button onClick={endCall} className="p-2 hover:bg-white/[0.06] rounded-xl transition-all btn-press" aria-label="Close War Room">
              <X className="w-4 h-4 text-gray-500" />
            </button>
          </div>
        </div>

        {/* ── Body ── */}
        <div className="flex flex-1 overflow-hidden">

          {/* ── Left: Transcript ── */}
          <TranscriptPanel
            transcript={transcript}
            callState={callState}
            error={error}
            sentiment={sentiment}
            audioContext={audioContextRef.current}
            inputAnalyser={analyserRef.current}
            outputAnalyser={outputAnalyserRef.current}
          />

          {/* ── Right: Intel Panel ── */}
          <IntelPanel
            sentiment={sentiment}
            sentimentLabel={sentimentLabel}
            activeObjection={activeObjection}
            counterScript={coachAdvice?.counterScript ?? null}
            kbSources={coachAdvice?.sources ?? []}
            flaggedClaims={coachAdvice?.flaggedClaims ?? []}
            onDismissObjection={dismissObjection}
            coachingHints={coachingHints}
            currentAxes={currentAxes}
            recentShifts={recentShifts}
            aiTurns={aiTurns}
            prospectTurns={prospectTurns}
            objectionCount={objectionHistory.length}
            usePhoneLink={usePhoneLink}
            onTogglePhoneLink={togglePhoneLink}
            isMuted={isMuted}
            onToggleMute={toggleMute}
            onEndCall={endCall}
          />
        </div>
      </div>
    </div>
  );
}
