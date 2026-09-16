// ============================================================
// AppHeader — logo, Demo Mode badge, navigation pills, power
// dial control, global search, and profile chip.
// ============================================================

import { Bell, ChevronDown, Phone, Search, Zap } from "lucide-react";

export const HEADER_NAV_ITEMS = [
  { label: "Overview", state: "home" },
  { label: "Pipeline", state: "dashboard" },
  { label: "Call Intelligence", state: "call_logs" },
  { label: "AI Team", state: "persona" },
  { label: "AGY Team", state: "agy" },
];

interface AppHeaderProps {
  activeState: string;
  isDemoMode: boolean;
  isPowerDialing: boolean;
  showPowerDial: boolean;
  searchOpen: boolean;
  searchQuery: string;
  onNavigate: (state: string) => void;
  onTogglePowerDial: () => void;
  onSearchOpenChange: (open: boolean) => void;
  onSearchChange: (query: string) => void;
}

export function AppHeader({
  activeState, isDemoMode, isPowerDialing, showPowerDial,
  searchOpen, searchQuery,
  onNavigate, onTogglePowerDial, onSearchOpenChange, onSearchChange,
}: AppHeaderProps) {
  return (
    <header
      className="flex items-center justify-between px-8 py-5 shrink-0"
      style={{ zIndex: 50, background: "transparent" }}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 shrink-0">
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold"
          style={{ background: "var(--accent-coral)", boxShadow: "var(--shadow-coral)" }}
        >
          <Phone className="w-5 h-5 fill-current" />
        </div>
        <span className="text-[22px] font-extrabold" style={{ color: "var(--text-primary)", letterSpacing: "-0.03em" }}>
          OpenCloser
        </span>
        {isDemoMode && (
          <span className="text-[10px] font-bold bg-amber-100 text-amber-700 px-2.5 py-1 rounded-full border border-amber-200 uppercase tracking-wider ml-1">
            Demo Mode
          </span>
        )}
      </div>

      {/* Center Nav Pill Container */}
      <nav className="flex items-center gap-2 px-3 py-2 bg-white rounded-full shadow-[0_2px_12px_rgba(0,0,0,0.03)] border border-gray-100">
        {HEADER_NAV_ITEMS.map((item) => (
          <button
            key={item.state}
            onClick={() => onNavigate(item.state)}
            className={`px-5 py-2.5 rounded-full text-[14px] font-semibold transition-all duration-200 ${
              activeState === item.state
                ? "bg-[#1A1D20] text-white shadow-md"
                : "text-gray-500 hover:text-gray-900 hover:bg-gray-50 bg-transparent"
            }`}
          >
            {item.label}
          </button>
        ))}
      </nav>

      {/* Right Controls Pill */}
      <div className="flex items-center gap-4 shrink-0">
        {showPowerDial && (
          <button
            onClick={onTogglePowerDial}
            className={isPowerDialing ? "btn-coral rounded-full" : "btn-ghost rounded-full bg-white"}
            style={{ fontSize: 13, padding: "9px 18px", border: "none", boxShadow: "0 2px 12px rgba(0,0,0,0.03)" }}
          >
            <Zap className="w-4 h-4" />
            {isPowerDialing ? "Stop Dialer" : "Power Dial"}
          </button>
        )}

        <div className="flex items-center gap-2 bg-white rounded-full px-3 py-2 shadow-[0_2px_12px_rgba(0,0,0,0.03)] border border-gray-100">
          <button className="w-10 h-10 flex items-center justify-center rounded-full text-gray-400 hover:text-gray-900 hover:bg-gray-50 transition-colors" onClick={() => onSearchOpenChange(!searchOpen)} aria-label="Search leads">
            <Search className="w-5 h-5" />
          </button>
          {searchOpen && (
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Escape") { onSearchOpenChange(false); onSearchChange(""); } }}
              placeholder="Search by name or company..."
              className="bg-transparent border-none outline-none text-sm font-medium text-gray-900 w-48 placeholder:text-gray-400"
              autoFocus
            />
          )}
          <button className="w-10 h-10 flex items-center justify-center rounded-full text-gray-400 opacity-50" disabled aria-label="Notifications">
            <Bell className="w-5 h-5" />
          </button>
          <div className="w-[1px] h-6 bg-gray-200 mx-1"></div>

          <div className="flex items-center gap-3 pl-2 pr-4 cursor-pointer hover:opacity-80 transition-opacity" role="button" tabIndex={0} aria-label="Profile menu">
            <div className="w-9 h-9 rounded-full overflow-hidden border border-gray-200">
              <div className="w-full h-full bg-[#FF5C39] text-white flex items-center justify-center text-[13px] font-bold" aria-hidden="true">SL</div>
            </div>
            <div className="flex flex-col">
              <span className="text-[13px] font-bold text-gray-900 leading-tight">Sales Lead</span>
              <span className="text-[11px] text-gray-500 font-medium leading-tight">sales@opencloser.ai</span>
            </div>
            <ChevronDown className="w-4 h-4 text-gray-400 ml-1" />
          </div>
        </div>
      </div>
    </header>
  );
}
