import { create } from "zustand";

interface AppState {
  workspaceId: string | null;
  setWorkspaceId: (id: string | null) => void;
}

export const useAppStore = create<AppState>((set) => ({
  workspaceId: null,
  setWorkspaceId: (workspaceId) => set({ workspaceId }),
}));
