// ============================================================
// AppSidebar — icon rail for primary navigation plus the
// New Campaign quick-add and settings entry.
// ============================================================

import { Home, Plus } from "lucide-react";
import { SIDEBAR_BOTTOM, SIDEBAR_TOP } from "../../../../constants";
import { SIDEBAR_ICON_MAP } from "../../../../components/sidebarIcons";

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
        {SIDEBAR_TOP.map((item) => {
          const Icon = SIDEBAR_ICON_MAP[item.icon] ?? Home;
          return (
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
              <Icon className="w-5 h-5 stroke-[2.5px]" />
            </button>
          );
        })}
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
        {SIDEBAR_BOTTOM.map((item) => {
          const Icon = SIDEBAR_ICON_MAP[item.icon] ?? Home;
          return (
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
              <Icon className="w-5 h-5 stroke-[2.5px]" />
            </button>
          );
        })}
      </div>
    </aside>
  );
}
