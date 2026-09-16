import { create } from "zustand";
import { Lead } from "../types";

export type CallState =
  | "idle"
  | "connecting"
  | "active"
  | "objection_mode"
  | "closing"
  | "ended";

interface CallLog {
  id: string;
  lead_id: string;
  duration_seconds: number;
  transcript: string;
  status: string;
  created_at: string;
  lead_name: string | null;
  lead_company: string | null;
}

interface CallStateStore {
  callLogs: CallLog[];
  activeLead: Lead | null;
  isPowerDialing: boolean;
  callState: CallState;
  debriefData: { lead: Lead; transcript: any[]; duration: number } | null;

  setCallLogs: (logs: CallLog[]) => void;
  setActiveLead: (lead: Lead | null) => void;
  setIsPowerDialing: (v: boolean) => void;
  setCallState: (state: CallState) => void;
  setDebriefData: (
    data: { lead: Lead; transcript: any[]; duration: number } | null
  ) => void;
}

export const useCallStore = create<CallStateStore>((set) => ({
  callLogs: [],
  activeLead: null,
  isPowerDialing: false,
  callState: "idle",
  debriefData: null,

  setCallLogs: (callLogs) => set({ callLogs }),
  setActiveLead: (activeLead) => set({ activeLead }),
  setIsPowerDialing: (isPowerDialing) => set({ isPowerDialing }),
  setCallState: (callState) => set({ callState }),
  setDebriefData: (debriefData) => set({ debriefData }),
}));
