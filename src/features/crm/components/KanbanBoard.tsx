import React, { useState, useEffect, Suspense, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Lead, LeadStatus, ICP } from "../../../types";
import { Onboarding } from "../../onboarding/components/Onboarding";
import { ICPDisplay } from "../../onboarding/components/ICPDisplay";
import { AudioSetupWizard } from "../../onboarding/components/AudioSetupWizard";
import { LeadHunter } from "../../hunter/components/LeadHunter";
import { CallLogsView } from "./CallLogsView";
import { SettingsView } from "./SettingsView";
import { DashboardHome } from "./DashboardHome";
import { PipelineBoard } from "./PipelineBoard";
import { AgyTeamView } from "../../agy/components/AgyTeamView";
import { AppHeader } from "./shell/AppHeader";
import { AppSidebar } from "./shell/AppSidebar";
import { WelcomeScreen } from "./shell/WelcomeScreen";
import { AIPersona } from "../../../types/persona";
import { Toast, ToastMessage, ToastType } from "../../../ui/components/Toast";
import { hasAnyProviderKey, useKeysStore } from "../../../stores/keys.store";
import { isDoNotCall } from "../lib/compliance";

const WarRoom = React.lazy(() => import("../../voice/components/WarRoom").then(m => ({ default: m.WarRoom })));
const PostCallDebrief = React.lazy(() => import("../../voice/components/PostCallDebrief").then(m => ({ default: m.PostCallDebrief })));
const AIPersonaBuilder = React.lazy(() => import("./AIPersonaBuilder").then(m => ({ default: m.AIPersonaBuilder })));
const LeadDetailView = React.lazy(() => import("./LeadDetailView").then(m => ({ default: m.LeadDetailView })));
const ObjectionTrainer = React.lazy(() => import("../../voice/components/ObjectionTrainer").then(m => ({ default: m.ObjectionTrainer })));
const RecruitmentKnowledgeView = React.lazy(() => import("../../recruitment/components/RecruitmentKnowledgeView").then(m => ({ default: m.RecruitmentKnowledgeView })));
const CopilotView = React.lazy(() => import("../../copilot/CopilotView").then(m => ({ default: m.CopilotView })));

const LazyFallback = () => (
  <div className="flex items-center justify-center h-full" style={{ color: "var(--text-muted)", fontFamily: "var(--font-mono)", fontSize: 13 }}>
    Loading...
  </div>
);

type AppState =
  | "onboarding" | "icp_review" | "audio_setup" | "persona_setup"
  | "home" | "dashboard" | "hunter" | "call_logs" | "settings"
  | "persona" | "agy" | "lead_detail" | "trainer" | "recruitment" | "copilot" | "welcome";

export function KanbanBoard() {
  const voiceKeys = useKeysStore((s) => s.keys);
  const hasVoiceKey = !!(voiceKeys.gemini_api_key || voiceKeys.openai_api_key || voiceKeys.elevenlabs_api_key);

  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [appState, setAppState] = useState<AppState>("onboarding");
  const [allCallLogs, setAllCallLogs] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [scoreFilter, setScoreFilter] = useState(0);
  const [globalSearchOpen, setGlobalSearchOpen] = useState(false);
  const [globalSearch, setGlobalSearch] = useState("");
  const [icpData, setIcpData] = useState<ICP | null>(null);
  const [persona, setPersona] = useState<AIPersona | null>(null);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);

  // Call State
  const [activeCallLead, setActiveCallLead] = useState<Lead | null>(null);
  const [isPowerDialing, setIsPowerDialing] = useState(false);

  // Post-Call Debrief State
  const [debriefData, setDebriefData] = useState<{ lead: Lead; transcript: any[]; duration: number } | null>(null);

  // Toast State
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = useCallback((type: ToastType, message: string) => {
    setToasts((prev) => [...prev, { id: Date.now().toString(), type, message }]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  useEffect(() => {
    // Secrets hydrate from the OS keychain; the demo-reset decision only
    // runs once we know whether any provider key actually exists.
    useKeysStore.getState().hydrate().then(() => {
      if (!hasAnyProviderKey()) {
        localStorage.removeItem("hasCompletedOnboarding");
        localStorage.removeItem("hasCompletedAudioSetup");
        localStorage.removeItem("icp_data");
        // Keep ai_persona so the form is somewhat pre-filled or uses defaults safely
      }

      const completed = localStorage.getItem("hasCompletedOnboarding");
      if (completed) {
        setAppState("home");
        try {
          const savedIcp = localStorage.getItem("icp_data");
          if (savedIcp) setIcpData(JSON.parse(savedIcp));
        } catch { localStorage.removeItem("icp_data"); }
      }
    });

    fetchLeads();
    fetchCallLogs();
    try {
      const savedPersona = localStorage.getItem("ai_persona");
      if (savedPersona) setPersona(JSON.parse(savedPersona));
    } catch { localStorage.removeItem("ai_persona"); }
  }, []);

  const fetchCallLogs = async () => {
    try {
      const data: any = await invoke('get_call_logs');
      setAllCallLogs(data);
    } catch (err) {
      console.error("Failed to fetch call logs:", err);
    }
  };

  const fetchLeads = async () => {
    try {
      const data: any = await invoke('get_leads');
      setLeads(data);
    } catch (error) {
      console.error("Failed to fetch leads:", error);
      addToast("error", "Failed to load pipeline data.");
    } finally {
      setLoading(false);
    }
  };

  const handleDragStart = useCallback((e: React.DragEvent, leadId: string) => {
    e.dataTransfer.setData("leadId", leadId);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent, status: LeadStatus) => {
    e.preventDefault();
    const leadId = e.dataTransfer.getData("leadId");
    const leadToMove = leads.find((l) => l.id === leadId);
    if (!leadToMove || leadToMove.status === status) return;

    const previousStatus = leadToMove.status;
    setLeads((prev) => prev.map((lead) => (lead.id === leadId ? { ...lead, status } : lead)));

    if (status === "Outbound Call") {
      setActiveCallLead({ ...leadToMove, status });
    }

    try {
      await invoke('update_lead_status', { id: leadId, status });
      addToast("success", `Moved to ${status}`);
      if (status === "Closed") {
        addToast("success", `🎉 Deal closed with ${leadToMove.company}!`);
      }
    } catch (error) {
      console.error("Failed to update lead status:", error);
      setLeads((prev) =>
        prev.map((lead) => (lead.id === leadId ? { ...lead, status: previousStatus } : lead))
      );
      addToast("error", `Failed to move lead — reverted to ${previousStatus}.`);
    }
  }, [addToast, leads]);

  const handleDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); }, []);

  const handleOnboardingComplete = (icp: ICP) => {
    setIcpData(icp);
    try { localStorage.setItem("hasCompletedOnboarding", "true"); } catch {}
    try { localStorage.setItem("icp_data", JSON.stringify(icp)); } catch {}
    if (!localStorage.getItem("hasCompletedAudioSetup")) {
      setAppState("audio_setup");
    } else {
      setAppState("icp_review");
    }
    addToast("success", "AI Sales Strategy generated successfully.");
  };

  const handleDial = useCallback((lead: Lead) => {
    if (isDoNotCall(lead)) {
      addToast("error", "Lead is on the Do Not Call list");
      return;
    }
    setActiveCallLead(lead);
  }, [addToast]);

  const startPowerDialing = useCallback(() => {
    const outboundLeads = leads.filter((l) => l.status === "Outbound Call" && !isDoNotCall(l));
    if (outboundLeads.length === 0) {
      addToast("info", "No leads in the Outbound Call column to dial.");
      return;
    }
    setIsPowerDialing(true);
    setActiveCallLead(outboundLeads[0]);
    addToast("info", `Starting Power Dial session with ${outboundLeads.length} leads.`);
  }, [addToast, leads]);

  const handleViewLead = useCallback((lead: Lead) => {
    setSelectedLead(lead);
    setAppState("lead_detail");
  }, []);

  const handleWarRoomClose = (callTranscript?: any[], callDuration?: number) => {
    const closedLead = activeCallLead;
    if (isPowerDialing && activeCallLead) {
      const outboundLeads = leads.filter((l) => l.status === "Outbound Call" && !isDoNotCall(l));
      const currentIndex = outboundLeads.findIndex((l) => l.id === activeCallLead.id);
      if (currentIndex !== -1 && currentIndex + 1 < outboundLeads.length) {
        setActiveCallLead(outboundLeads[currentIndex + 1]);
      } else {
        setIsPowerDialing(false);
        setActiveCallLead(null);
        addToast("success", "Power Dialing session complete.");
      }
    } else {
      setActiveCallLead(null);
    }
    if (closedLead && callTranscript && callTranscript.length > 0) {
      setDebriefData({ lead: closedLead, transcript: callTranscript, duration: callDuration || 0 });
    }
  };

  const isAppShellVisible = !["onboarding", "icp_review", "audio_setup", "persona_setup", "welcome"].includes(appState);

  // Determine active nav
  const activeNavState = appState === "lead_detail" ? "dashboard" : appState;

  return (
    <div className="flex flex-col h-screen overflow-hidden" style={{ background: "var(--bg-primary)" }}>

      {/* ── Top Header ── */}
      {isAppShellVisible && (
        <AppHeader
          activeState={activeNavState}
          isDemoMode={!hasVoiceKey}
          isPowerDialing={isPowerDialing}
          showPowerDial={appState === "dashboard"}
          searchOpen={globalSearchOpen}
          searchQuery={globalSearch}
          onNavigate={(state) => setAppState(state as AppState)}
          onTogglePowerDial={() => (isPowerDialing ? setIsPowerDialing(false) : startPowerDialing())}
          onSearchOpenChange={setGlobalSearchOpen}
          onSearchChange={(q) => { setGlobalSearch(q); setSearchQuery(q); }}
        />
      )}

      {/* ── Body: Sidebar + Main ── */}
      <div className="flex flex-1 overflow-hidden relative">

        {/* ── Icon Sidebar ── */}
        {isAppShellVisible && (
          <AppSidebar activeState={activeNavState} onNavigate={(state) => setAppState(state as AppState)} />
        )}

        {/* ── Main View ── */}
        <main
          className="flex-1 overflow-y-auto overflow-x-hidden"
          style={{
            background: ["dashboard"].includes(appState) ? "var(--bg-primary)" : "var(--bg-primary)",
            padding: appState === "dashboard" ? "24px" : "0",
          }}
        >
          {appState === "onboarding" && (
            <Onboarding onComplete={handleOnboardingComplete} />
          )}

          {appState === "icp_review" && icpData && (
            <ICPDisplay icp={icpData} onContinue={() => setAppState("welcome")} />
          )}

          {appState === "welcome" && (
            <WelcomeScreen onHome={() => setAppState("home")} onPipeline={() => setAppState("dashboard")} />
          )}

          {appState === "audio_setup" && (
            <AudioSetupWizard
              onComplete={() => {
                if (!localStorage.getItem("ai_persona")) {
                  setAppState("persona_setup");
                } else {
                  setAppState("home");
                }
              }}
            />
          )}

          {(appState === "persona" || appState === "persona_setup") && (
            <Suspense fallback={<LazyFallback />}>
            <AIPersonaBuilder
              initialPersona={persona || undefined}
              onSave={(p) => {
                setPersona(p);
                localStorage.setItem("ai_persona", JSON.stringify(p));
                addToast("success", "AI Persona successfully re-programmed.");
                if (appState === "persona_setup") setAppState("home");
              }}
            />
            </Suspense>
          )}

          {appState === "hunter" && (
            <LeadHunter
              icp={icpData}
              onLeadsAdded={() => {
                fetchLeads();
                setTimeout(() => setAppState("dashboard"), 2000);
              }}
              addToast={addToast}
            />
          )}

          {appState === "call_logs" && <CallLogsView />}

          {appState === "settings" && <SettingsView />}

          {appState === "agy" && <AgyTeamView />}

          {appState === "home" && (
            <DashboardHome
              leads={leads}
              callLogs={allCallLogs}
              onViewLead={handleViewLead}
              onDial={handleDial}
              onNavigate={(page) => setAppState(page as AppState)}
              addToast={addToast}
            />
          )}

          {appState === "dashboard" &&
            (loading ? (
              <div
                className="flex items-center justify-center h-full"
                style={{ color: "var(--text-muted)", fontFamily: "var(--font-mono)", fontSize: 13 }}
              >
                Loading pipeline…
              </div>
            ) : (
              <PipelineBoard
                leads={leads}
                searchQuery={searchQuery}
                scoreFilter={scoreFilter}
                onSearchChange={setSearchQuery}
                onScoreFilterChange={setScoreFilter}
                onDragStart={handleDragStart}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDial={handleDial}
                onViewDetails={handleViewLead}
              />
            ))}

          {appState === "trainer" && (
            <Suspense fallback={<LazyFallback />}>
            <ObjectionTrainer icp={icpData} />
            </Suspense>
          )}

          {appState === "recruitment" && (
            <Suspense fallback={<LazyFallback />}>
            <RecruitmentKnowledgeView onBack={() => setAppState("home")} />
            </Suspense>
          )}

          {appState === "copilot" && (
            <Suspense fallback={<LazyFallback />}>
            <CopilotView />
            </Suspense>
          )}

          {appState === "lead_detail" && selectedLead && (
            <Suspense fallback={<LazyFallback />}>
            <LeadDetailView
              lead={selectedLead}
              icp={icpData}
              onBack={() => {
                setSelectedLead(null);
                setAppState("dashboard");
              }}
              onDial={handleDial}
              onDelete={(leadId) => {
                setLeads(leads.filter((l) => l.id !== leadId));
                setSelectedLead(null);
                setAppState("dashboard");
                addToast("success", "Lead deleted successfully.");
              }}
              onStatusChange={async (leadId, newStatus) => {
                try {
                  await invoke("update_lead_status", { id: leadId, status: newStatus });
                  setLeads(leads.map((l) => (l.id === leadId ? { ...l, status: newStatus } : l)));
                  setSelectedLead((prev) => (prev ? { ...prev, status: newStatus } : prev));
                  addToast("success", `Lead moved to ${newStatus}.`);
                } catch (err) {
                  console.error("Failed to update status:", err);
                }
              }}
            />
            </Suspense>
          )}
        </main>
      </div>

      {/* War Room Modal */}
      {activeCallLead && (
        <Suspense fallback={<LazyFallback />}>
        <WarRoom lead={activeCallLead} icp={icpData} onClose={handleWarRoomClose} />
        </Suspense>
      )}

      {/* Post-Call Debrief */}
      {debriefData && (
        <Suspense fallback={<LazyFallback />}>
        <PostCallDebrief
          lead={debriefData.lead}
          icp={icpData}
          transcript={debriefData.transcript}
          durationSeconds={debriefData.duration}
          onClose={() => setDebriefData(null)}
        />
        </Suspense>
      )}

      {/* Toast Notifications */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3">
        {toasts.map((toast) => (
          <Toast key={toast.id} toast={toast} onDismiss={removeToast} />
        ))}
      </div>
    </div>
  );
}
