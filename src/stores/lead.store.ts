import { create } from "zustand";
import { Lead, LeadStatus } from "../types";

interface LeadState {
  leads: Lead[];
  loading: boolean;
  error: string | null;
  searchQuery: string;
  scoreFilter: number;
  setLeads: (leads: Lead[]) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setSearchQuery: (query: string) => void;
  setScoreFilter: (score: number) => void;
  updateLeadStatus: (leadId: string, status: LeadStatus) => void;
  patchLead: (leadId: string, patch: Partial<Lead>) => void;
  removeLead: (leadId: string) => void;
}

export const useLeadStore = create<LeadState>((set) => ({
  leads: [],
  loading: true,
  error: null,
  searchQuery: "",
  scoreFilter: 0,

  setLeads: (leads) => set({ leads, loading: false }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error, loading: false }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  setScoreFilter: (scoreFilter) => set({ scoreFilter }),

  updateLeadStatus: (leadId, status) =>
    set((state) => ({
      leads: state.leads.map((l) =>
        l.id === leadId ? { ...l, status } : l
      ),
    })),

  patchLead: (leadId, patch) =>
    set((state) => ({
      leads: state.leads.map((l) =>
        l.id === leadId ? { ...l, ...patch } : l
      ),
    })),

  removeLead: (leadId) =>
    set((state) => ({
      leads: state.leads.filter((l) => l.id !== leadId),
    })),
}));

export const useFilteredLeads = () =>
  useLeadStore((state) => {
    const { leads, searchQuery, scoreFilter } = state;
    return leads.filter((l) => {
      const matchesSearch =
        !searchQuery ||
        l.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        l.company.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesScore = l.score >= scoreFilter;
      return matchesSearch && matchesScore;
    });
  });

export const useLeadsByStatus = (status: LeadStatus) =>
  useFilteredLeads().filter((l) => l.status === status);

export const useOutboundLeads = () =>
  useLeadStore((s) => s.leads.filter((l) => l.status === "Outbound Call"));
