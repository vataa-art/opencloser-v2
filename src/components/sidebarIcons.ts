import {
  AudioLines,
  Bot,
  Briefcase,
  GraduationCap,
  Home,
  LayoutDashboard,
  Phone,
  Settings,
  Swords,
  Target,
  Zap,
} from "lucide-react";
import type React from "react";

// Name → component map for the string icon names in constants.ts
// (SIDEBAR_TOP / SIDEBAR_BOTTOM). Single source shared by AppShell and
// AppSidebar; src/test/sidebar-icons.test.ts fails if a sidebar entry
// ships without an icon here (the AppShell crash class from review-agy F1).
export const SIDEBAR_ICON_MAP: Record<string, React.FC<{ className?: string }>> = {
  Home,
  LayoutDashboard,
  Phone,
  Target,
  Bot,
  Zap,
  Swords,
  GraduationCap,
  Briefcase,
  AudioLines,
  Settings,
};
