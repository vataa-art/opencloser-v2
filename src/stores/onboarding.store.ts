import { create } from "zustand";
import { ICP } from "../types";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

interface OnboardingState {
  messages: Message[];
  isLoading: boolean;
  isComplete: boolean;
  icpData: ICP | null;

  setMessages: (messages: Message[]) => void;
  addMessage: (msg: Message) => void;
  setIsLoading: (v: boolean) => void;
  completeOnboarding: (icp: ICP) => void;
  loadFromStorage: () => void;
}

export const useOnboardingStore = create<OnboardingState>((set) => ({
  messages: [
    {
      id: "1",
      role: "assistant",
      content:
        "Welcome to OpenCloser. I'm your AI Sales Architect. To engineer your Ideal Customer Profile (ICP) using the SPIN methodology, tell me: what exactly does your company do, and who is your most lucrative customer?",
    },
  ],
  isLoading: false,
  isComplete: false,
  icpData: null,

  setMessages: (messages) => set({ messages }),
  addMessage: (msg) => set((s) => ({ messages: [...s.messages, msg] })),
  setIsLoading: (isLoading) => set({ isLoading }),

  completeOnboarding: (icp) => {
    try { localStorage.setItem("hasCompletedOnboarding", "true"); } catch {}
    try { localStorage.setItem("icp_data", JSON.stringify(icp)); } catch {}
    set({ isComplete: true, icpData: icp, isLoading: false });
  },

  loadFromStorage: () => {
    const completed = localStorage.getItem("hasCompletedOnboarding");
    if (completed) {
      set({ isComplete: true });
      try {
        const saved = localStorage.getItem("icp_data");
        if (saved) set({ icpData: JSON.parse(saved) });
      } catch { localStorage.removeItem("icp_data"); }
    }
  },
}));
