import { create } from "zustand";

export type AppPage =
  | "onboarding"
  | "icp_review"
  | "audio_setup"
  | "persona_setup"
  | "home"
  | "dashboard"
  | "hunter"
  | "call_logs"
  | "settings"
  | "persona"
  | "lead_detail"
  | "trainer";

interface NavigationState {
  currentPage: AppPage;
  previousPage: AppPage | null;
  selectedLeadId: string | null;

  navigate: (page: AppPage) => void;
  goBack: () => void;
  selectLead: (leadId: string) => void;
  clearSelectedLead: () => void;
}

export const useNavigationStore = create<NavigationState>((set, _get) => ({
  currentPage: "home",
  previousPage: null,
  selectedLeadId: null,

  navigate: (page) =>
    set((s) => ({
      previousPage: s.currentPage,
      currentPage: page,
    })),

  goBack: () =>
    set((s) => ({
      currentPage: s.previousPage || "home",
      previousPage: null,
      selectedLeadId: s.currentPage === "lead_detail" ? null : s.selectedLeadId,
    })),

  selectLead: (leadId) =>
    set({ selectedLeadId: leadId, currentPage: "lead_detail" }),

  clearSelectedLead: () => set({ selectedLeadId: null }),
}));
