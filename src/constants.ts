export const STORAGE_KEYS = {
  ICP_DATA: "icp_data",
  AI_PERSONA: "ai_persona",
  ONBOARDING_COMPLETE: "hasCompletedOnboarding",
  AUDIO_SETUP_COMPLETE: "hasCompletedAudioSetup",
  GEMINI_API_KEY: "gemini_api_key",
  OPENAI_API_KEY: "openai_api_key",
  ELEVENLABS_API_KEY: "elevenlabs_api_key",
  DEEPGRAM_API_KEY: "deepgram_api_key",
  ELEVENLABS_AGENT_ID: "elevenlabs_agent_id",
  PREFERRED_MIC: "preferredMicId",
  PREFERRED_SPEAKER: "preferredSpeakerId",
} as const;

export const LEAD_STATUSES = ["Discovery", "Outbound Call", "Audit Requested", "Closed"] as const;

export const NAV_ITEMS = [
  { label: "Overview", state: "home" },
  { label: "Pipeline", state: "dashboard" },
  { label: "Call Intelligence", state: "call_logs" },
  { label: "AI Team", state: "persona" },
] as const;

export const SIDEBAR_TOP = [
  { icon: "Home", state: "home", label: "Overview" },
  { icon: "LayoutDashboard", state: "dashboard", label: "Pipeline" },
  { icon: "Phone", state: "call_logs", label: "Call Intelligence" },
  { icon: "Target", state: "hunter", label: "Lead Researcher" },
  { icon: "Bot", state: "persona", label: "AI Caller" },
  { icon: "Swords", state: "trainer", label: "Sales Coach" },
  { icon: "GraduationCap", state: "recruitment", label: "Recruitment Academy" },
  { icon: "Briefcase", state: "hiring", label: "Hiring" },
  { icon: "AudioLines", state: "copilot", label: "Live Copilot" },
] as const;

export const SIDEBAR_BOTTOM = [
  { icon: "Settings", state: "settings", label: "Settings" },
] as const;

export const APP_TITLE = "OpenCloser";
export const APP_DESCRIPTION = "AI-Powered Sales Development Platform";
