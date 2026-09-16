import { useState, useEffect } from "react";
import {
  Settings as SettingsIcon, Mic, Volume2, Info, CheckCircle2,
  ChevronDown, Sliders, Key, Eye, EyeOff, CheckCheck, AlertTriangle, Zap, Languages
} from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { PROVIDERS } from "../../voice/lib/providers";
import { DEEPGRAM_LANGUAGES, normalizeDeepgramLanguage } from "../../voice/lib/deepgram";
import { useKeysStore } from "../../../stores/keys.store";

export function SettingsView() {
  // Audio devices
  const [mics, setMics] = useState<MediaDeviceInfo[]>([]);
  const [speakers, setSpeakers] = useState<MediaDeviceInfo[]>([]);
  const [selectedMic, setSelectedMic] = useState("");
  const [selectedSpeaker, setSelectedSpeaker] = useState("");
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);

  // API Keys
  const [apiKeys, setApiKeys] = useState<Record<string, string>>({});
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
  const [testing, setTesting] = useState<Record<string, boolean>>({});
  const [testResults, setTestResults] = useState<Record<string, string | null>>({});
  const [deepgramLanguage, setDeepgramLanguage] = useState(() => normalizeDeepgramLanguage(localStorage.getItem("deepgram_language")));
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem("darkMode") === "true");

  const toggleDarkMode = () => {
    const next = !darkMode;
    setDarkMode(next);
    localStorage.setItem("darkMode", String(next));
    document.documentElement.classList.toggle("dark", next);
  };

  useEffect(() => {
    if (darkMode) document.documentElement.classList.add("dark");
    else document.documentElement.classList.remove("dark");
  }, []);

  const testConnection = async (providerId: string, storageKey: string) => {
    setTesting(prev => ({ ...prev, [providerId]: true }));
    setTestResults(prev => ({ ...prev, [providerId]: null }));
    try {
      await invoke("generate_demo_leads", {
        query: "test", location: "test", icp: null,
        apiKey: apiKeys[storageKey] || undefined,
      });
      setTestResults(prev => ({ ...prev, [providerId]: "connected" }));
    } catch {
      setTestResults(prev => ({ ...prev, [providerId]: "failed" }));
    } finally {
      setTesting(prev => ({ ...prev, [providerId]: false }));
    }
  };

  useEffect(() => {
    navigator.mediaDevices.getUserMedia({ audio: true })
      .then((stream) => {
        setPermissionGranted(true);
        navigator.mediaDevices.enumerateDevices().then((devices) => {
          setMics(devices.filter(d => d.kind === "audioinput"));
          setSpeakers(devices.filter(d => d.kind === "audiooutput"));
          const savedMic = localStorage.getItem("preferredMicId");
          const savedSpeaker = localStorage.getItem("preferredSpeakerId");
          if (savedMic) setSelectedMic(savedMic);
          if (savedSpeaker) setSelectedSpeaker(savedSpeaker);
          stream.getTracks().forEach(t => t.stop());
        });
      })
      .catch(console.error);

    // Load stored API keys (secrets come from the OS keychain via the
    // keys store; the ElevenLabs agent id is not a secret and stays in
    // regular settings storage).
    useKeysStore.getState().hydrate().then(() => {
      const { keys } = useKeysStore.getState();
      const stored: Record<string, string> = {};
      PROVIDERS.forEach(p => {
        stored[p.apiKeySettingKey] = keys[p.apiKeySettingKey] || "";
        p.extraSettings?.forEach(s => {
          stored[s.key] = localStorage.getItem(s.key) || "";
        });
      });
      stored.deepgram_api_key = keys.deepgram_api_key || "";
      setApiKeys(stored);
    });
  }, []);

  const showSaved = (msg: string) => {
    setSavedMessage(msg);
    setTimeout(() => setSavedMessage(null), 3000);
  };

  const saveMic = (id: string) => { setSelectedMic(id); localStorage.setItem("preferredMicId", id); showSaved("Mic updated"); };
  const saveSpeaker = (id: string) => { setSelectedSpeaker(id); localStorage.setItem("preferredSpeakerId", id); showSaved("Speaker updated"); };

  const saveApiKey = (storageKey: string, value: string) => {
    setApiKeys(prev => ({ ...prev, [storageKey]: value }));
    if (storageKey === "elevenlabs_agent_id") {
      localStorage.setItem(storageKey, value);
    } else {
      void useKeysStore.getState().setKey(storageKey, value);
    }
    showSaved("API key saved");
  };

  const toggleShowKey = (key: string) => {
    setShowKeys(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const hasKey = (storageKey: string) => !!(apiKeys[storageKey]?.trim());

  return (
    <div className="flex flex-col w-full max-w-5xl mx-auto py-10 px-6 lg:px-10 h-full overflow-y-auto custom-scrollbar animate-fade-in">

      {/* Header */}
      <div className="flex items-center justify-between mb-10">
        <div className="flex items-center gap-5">
          <div className="w-14 h-14 rounded-2xl bg-surface-bg flex items-center justify-center border border-surface-border shadow-sm">
            <SettingsIcon className="w-7 h-7 text-coral" />
          </div>
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-ink">System Configuration</h2>
            <p className="text-ink-secondary text-sm mt-1 font-medium">Voice engine API keys, hardware routing, and audio settings.</p>
          </div>
        </div>
        {savedMessage && (
          <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-700 font-bold px-4 py-2 rounded-xl text-xs uppercase tracking-widest animate-fade-in">
            <CheckCircle2 className="w-4 h-4" /> {savedMessage}
          </div>
        )}
      </div>

      <div className="space-y-8 pb-16">

        {/* ── Appearance ── */}
        <section className="card p-8">
          <h3 className="text-[11px] font-bold uppercase tracking-[0.2em] text-ink-muted flex items-center gap-2 mb-4">
            <Zap className="w-4 h-4 text-coral" /> Appearance
          </h3>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-bold text-ink">Dark Mode</div>
              <div className="text-[11px] text-ink-muted">Switch between light and dark theme</div>
            </div>
            <button
              onClick={toggleDarkMode}
              className={`w-12 h-6 rounded-full p-0.5 transition-smooth ${darkMode ? "bg-coral" : "bg-surface-bg border border-surface-border"}`}
            >
              <div className={`w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${darkMode ? "translate-x-6" : "translate-x-0"}`} />
            </button>
          </div>
        </section>

        {/* ── Voice Engine API Keys ── */}
        <section className="card p-8">
          <h3 className="text-[11px] font-bold uppercase tracking-[0.2em] text-ink-muted flex items-center gap-2 mb-2">
            <Key className="w-4 h-4 text-coral" /> Voice Engine API Keys
          </h3>
          <p className="text-ink-muted text-sm mb-6 font-medium">
            Keys are stored in your OS keychain (Windows Credential Manager / macOS Keychain). They are sent only to the provider you choose.
          </p>

          <div className="space-y-6">
            {PROVIDERS.map(provider => (
              <div key={provider.id} className="rounded-2xl border border-surface-border overflow-hidden">
                {/* Provider Header */}
                <div className="flex items-center gap-3 bg-surface-bg px-6 py-4 border-b border-surface-border">
                  <span className="text-xl">{provider.id === "gemini" ? "🧠" : provider.id === "openai" ? "⚡" : "🎤"}</span>
                  <div className="flex-1">
                    <span className="text-sm font-bold text-ink">{provider.label}</span>
                    <span className="text-[11px] text-ink-muted ml-2">{provider.model}</span>
                  </div>
                  <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold border ${
                    hasKey(provider.apiKeySettingKey)
                      ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                      : "bg-surface-bg border-surface-border text-ink-muted"
                  }`}>
                    {hasKey(provider.apiKeySettingKey)
                      ? <><CheckCheck className="w-3 h-3" /> Configured</>
                      : <><AlertTriangle className="w-3 h-3" /> Not Set</>
                    }
                  </div>
                </div>

                {/* Key Inputs */}
                <div className="p-6 space-y-4">
                  {/* Primary API Key */}
                  <div>
                    <label className="text-[11px] font-bold uppercase tracking-widest text-ink-muted block mb-2">
                      {provider.apiKeyLabel}
                    </label>
                    <div className="relative">
                      <input
                        type={showKeys[provider.apiKeySettingKey] ? "text" : "password"}
                        value={apiKeys[provider.apiKeySettingKey] || ""}
                        onChange={e => setApiKeys(prev => ({ ...prev, [provider.apiKeySettingKey]: e.target.value }))}
                        onBlur={e => { if (e.target.value !== (apiKeys[provider.apiKeySettingKey] || '')) saveApiKey(provider.apiKeySettingKey, e.target.value); }}
                        placeholder={`${provider.id === "gemini" ? "AIza..." : provider.id === "openai" ? "sk-..." : "xi_..."}`}
                        className="w-full bg-surface-bg border border-surface-border rounded-xl px-4 py-3 text-sm font-mono text-ink focus:outline-none focus:border-coral/30 pr-10"
                      />
                      <button
                        onClick={() => toggleShowKey(provider.apiKeySettingKey)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink transition-smooth"
                      >
                        {showKeys[provider.apiKeySettingKey] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Extra Settings (e.g. ElevenLabs Agent ID) */}
                  {provider.extraSettings?.map(extra => (
                    <div key={extra.key}>
                      <label className="text-[11px] font-bold uppercase tracking-widest text-ink-muted block mb-2">{extra.label}</label>
                      <div className="relative">
                        <input
                          type={showKeys[extra.key] ? "text" : "password"}
                          value={apiKeys[extra.key] || ""}
                          onChange={e => setApiKeys(prev => ({ ...prev, [extra.key]: e.target.value }))}
                          onBlur={e => { if (e.target.value !== (apiKeys[extra.key] || '')) saveApiKey(extra.key, e.target.value); }}
                          placeholder={extra.placeholder}
                          className="w-full bg-surface-bg border border-surface-border rounded-xl px-4 py-3 text-sm font-mono text-ink focus:outline-none focus:border-coral/30 pr-10"
                        />
                        <button
                          onClick={() => toggleShowKey(extra.key)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink"
                        >
                          {showKeys[extra.key] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  ))}

                  {/* Test Connection */}
                  <div className="flex items-center gap-3 pt-2">
                    <button
                      onClick={() => testConnection(provider.id, provider.apiKeySettingKey)}
                      disabled={!hasKey(provider.apiKeySettingKey) || testing[provider.id]}
                      className="text-[11px] font-bold px-4 py-2 rounded-xl border border-surface-border bg-white hover:bg-surface-bg transition-smooth disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {testing[provider.id] ? "Testing..." : "Test Connection"}
                    </button>
                    {testResults[provider.id] === "connected" && (
                      <span className="text-[11px] font-bold text-emerald-600 flex items-center gap-1">
                        <CheckCheck className="w-3.5 h-3.5" /> Connected
                      </span>
                    )}
                    {testResults[provider.id] === "failed" && (
                      <span className="text-[11px] font-bold text-red-500 flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5" /> Failed — check key
                      </span>
                    )}
                  </div>

                  {!provider.requiresRelay && (
                    <p className="text-[11px] text-emerald-600 font-medium flex items-center gap-1.5">
                      <Zap className="w-3 h-3" /> Direct browser connection — no server relay needed.
                    </p>
                  )}
                  {provider.requiresRelay && (
                    <p className="text-[11px] text-amber-600 font-medium flex items-center gap-1.5">
                      <Info className="w-3 h-3" /> Routes through the local loopback relay (127.0.0.1). Key stays on your machine.
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Deepgram STT ── */}
        <section className="card p-8">
          <h3 className="text-[11px] font-bold uppercase tracking-[0.2em] text-ink-muted flex items-center gap-2 mb-2">
            <Languages className="w-4 h-4 text-coral" /> Deepgram Speech-to-Text
          </h3>
          <p className="text-ink-muted text-sm mb-6 font-medium">
            Optional live transcription for real calls. The key stays in local storage and is sent only to the local Tauri relay.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-[1fr_220px] gap-5 items-end">
            <div>
              <label className="text-[11px] font-bold uppercase tracking-widest text-ink-muted block mb-2">Deepgram API Key</label>
              <div className="relative">
                <input
                  type={showKeys.deepgram_api_key ? "text" : "password"}
                  value={apiKeys.deepgram_api_key || ""}
                  onChange={e => setApiKeys(prev => ({ ...prev, deepgram_api_key: e.target.value }))}
                  onBlur={e => { if (e.target.value !== (apiKeys.deepgram_api_key || "")) saveApiKey("deepgram_api_key", e.target.value); }}
                  placeholder="dg_..."
                  className="w-full bg-surface-bg border border-surface-border rounded-xl px-4 py-3 text-sm font-mono text-ink focus:outline-none focus:border-coral/30 pr-10"
                />
                <button
                  type="button"
                  onClick={() => toggleShowKey("deepgram_api_key")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink transition-smooth"
                  aria-label={showKeys.deepgram_api_key ? "Hide Deepgram API key" : "Show Deepgram API key"}
                >
                  {showKeys.deepgram_api_key ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div>
              <label className="text-[11px] font-bold uppercase tracking-widest text-ink-muted block mb-2">Prospect language</label>
              <select
                value={deepgramLanguage}
                onChange={e => {
                  const value = normalizeDeepgramLanguage(e.target.value);
                  setDeepgramLanguage(value);
                  localStorage.setItem("deepgram_language", value);
                }}
                className="w-full bg-surface-bg border border-surface-border rounded-xl px-4 py-3 text-sm font-bold text-ink focus:outline-none focus:border-coral/30"
              >
                {DEEPGRAM_LANGUAGES.map(language => <option key={language.value} value={language.value}>{language.label}</option>)}
              </select>
            </div>
          </div>
          <p className="mt-4 text-[11px] text-ink-muted">Model: Nova-2 · supported locales: `en-US` and `uk`. Select the dominant language before starting a call.</p>
        </section>

        {/* ── Audio Hardware ── */}
        <section className="card p-8">
          <h3 className="text-[11px] font-bold uppercase tracking-[0.2em] text-ink-muted flex items-center gap-2 mb-5">
            <Sliders className="w-4 h-4 text-coral" /> Hardware Architecture
          </h3>

          {/* Virtual Cable Info */}
          <div className="mb-7 p-5 rounded-xl bg-coral-light border border-coral/10">
            <div className="flex gap-4">
              <div className="w-10 h-10 rounded-xl bg-white border border-coral/20 flex items-center justify-center shrink-0">
                <Info className="w-5 h-5 text-coral" />
              </div>
              <div>
                <h4 className="font-bold text-ink mb-1">Virtual Audio Routing</h4>
                <p className="text-ink-secondary text-sm leading-relaxed font-medium">
                  For AI audio injection into Phone Link or FaceTime, use a virtual audio cable.
                  Set <span className="font-bold text-ink">Output</span>: CABLE Input · <span className="font-bold text-ink">Input</span>: CABLE Output
                </p>
              </div>
            </div>
          </div>

          {!permissionGranted && (
            <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-100 rounded-xl mb-6">
              <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />
              <p className="text-red-700 text-sm font-bold">Grant microphone permission to configure audio devices.</p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-[11px] font-bold text-ink-muted uppercase tracking-widest">
                <Mic className="w-4 h-4 text-coral" /> Microphone Input
              </label>
              <div className="relative">
                <select value={selectedMic} onChange={e => saveMic(e.target.value)}
                  className="w-full bg-surface-bg border border-surface-border rounded-xl px-4 py-3 text-sm font-bold text-ink appearance-none hover:border-coral/20 focus:outline-none focus:border-coral/30">
                  <option value="">System Default</option>
                  {mics.map(m => <option key={m.deviceId} value={m.deviceId}>{m.label || `Input (${m.deviceId.slice(0, 8)}...)`}</option>)}
                </select>
                <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-ink-muted w-4 h-4" />
              </div>
            </div>
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-[11px] font-bold text-ink-muted uppercase tracking-widest">
                <Volume2 className="w-4 h-4 text-coral" /> Speaker / Output
              </label>
              <div className="relative">
                <select value={selectedSpeaker} onChange={e => saveSpeaker(e.target.value)}
                  className="w-full bg-surface-bg border border-surface-border rounded-xl px-4 py-3 text-sm font-bold text-ink appearance-none hover:border-coral/20 focus:outline-none focus:border-coral/30">
                  <option value="">System Default</option>
                  {speakers.map(s => <option key={s.deviceId} value={s.deviceId}>{s.label || `Output (${s.deviceId.slice(0, 8)}...)`}</option>)}
                </select>
                <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-ink-muted w-4 h-4" />
              </div>
            </div>
          </div>
        </section>

        {/* Audio Engine Info */}
        <section className="card p-6">
          <h3 className="text-[11px] font-bold uppercase tracking-[0.2em] text-ink-muted flex items-center gap-2 mb-3">
            <Zap className="w-4 h-4 text-coral" /> Audio Engine
          </h3>
          <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-100 rounded-xl px-5 py-3.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <div>
              <div className="text-sm font-bold text-emerald-800">AudioWorklet Engine Active</div>
              <div className="text-xs text-emerald-600">Zero-latency PCM capture via dedicated audio thread (~10ms). No ScriptProcessorNode.</div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
