"use client";

import { create } from "zustand";

type OperationState = {
  active: boolean;
  title: string | null;
};

type OperationStore = OperationState & {
  start: (title: string) => void;
  stop: () => void;
};

export const useOperation = create<OperationStore>((set) => ({
  active: false,
  title: null,
  start: (title) => set({ active: true, title }),
  stop: () => set({ active: false, title: null }),
}));
