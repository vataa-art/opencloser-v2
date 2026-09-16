// ============================================================
// AppSidebar — icon rail for primary navigation plus the
// New Campaign quick-add and settings entry.
// ============================================================

import { Bot, GraduationCap, Home, LayoutDashboard, Phone, Plus, Settings, Swords, Target, Zap, AudioLines } from "lucide-react";

const SIDEBAR_TOP = [
  { icon: Home, state: "home", label: "Overview" },
  { icon: LayoutDashboard, state: "dashboard", label: "Pipeline" },
  { icon: Phone, state: "call_logs", label: "Call Intelligence" },
  { icon: Target, state: "hunter", label: "Lead Researcher" },
  { icon: Bot, state: "persona", label: "AI Caller" },
  { icon: Zap, state: "agy", label: "AGY Agents" },
  { icon: Swords, state: "trainer", label: "Sales Coach" },
  { icon: GraduationCap, state: "recruitment", label: "Recruitment Academy" },
  { icon: AudioLines, state: "copilot", label: "Live Copilot" },
];

const SIDEBAR_BOTTOM = [
  { icon: Settings, state: "settings", label: "Settings" },
];

interface AppSidebarProps {
  activeState: string;
  onNavigate: (state: string) => void;
}

export function AppSidebar({ activeState, onNavigate }: AppSidebarProps) {
  return (
    <aside
      className="flex flex-col items-center gap-4 py-8 shrink-0 relative z-40 bg-transparent"
      style={{ width: 80 }}
    >
      {/* Top icons */}
      <div className="flex flex-col items-center gap-3 flex-1 px-4">
        {SIDEBAR_TOP.map((item) => (
          <button
            key={item.state}
            title={item.label}
            onClick={() => onNavigate(item.state)}
            className={`w-12 h-12 flex items-center justify-center rounded-full transition-all duration-200 cursor-pointer ${
              (activeState === item.state || (item.state === "dashboard" && activeState === "lead_detail"))
                ? "bg-gray-200 text-gray-900 shadow-sm"
                : "text-gray-400 hover:bg-gray-200 hover:text-gray-700 bg-transparent"
            }`}
          >
            <item.icon className="w-5 h-5 stroke-[2.5px]" />
          </button>
        ))}
      </div>

      {/* Bottom icons */}
      <div className="flex flex-col items-center gap-3 px-4">
        {/* New Campaign quick-add */}
        <button
          onClick={() => onNavigate("hunter")}
          className="w-12 h-12 flex items-center justify-center rounded-full transition-all duration-200 cursor-pointer shadow-[0_4px_16px_rgba(255,92,57,0.3)] bg-[var(--accent-coral)] text-white hover:scale-105"
          title="New Campaign"
        >
          <Plus className="w-6 h-6 stroke-[3px]" />
        </button>
        {SIDEBAR_BOTTOM.map((item) => (
          <button
            key={item.state}
            title={item.label}
            onClick={() => onNavigate(item.state)}
            className={`w-12 h-12 flex items-center justify-center rounded-full transition-all duration-200 cursor-pointer ${
              activeState === item.state
                ? "bg-gray-200 text-gray-900"
                : "text-gray-400 hover:bg-gray-200 hover:text-gray-700 bg-transparent"
            }`}
          >
            <item.icon className="w-5 h-5 stroke-[2.5px]" />
          </button>
        ))}
      </div>
    </aside>
  );
}
