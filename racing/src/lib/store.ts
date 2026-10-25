/**
 * Browser-side state. Holds the active adapter, last-read snapshot, and
 * any pending AI streams. We keep the adapter itself out of zustand
 * (non-serializable) and just track its status here.
 */

"use client";

import { create } from "zustand";
import type { ObdAdapter, AdapterStatus, AdapterInfo } from "./obd/adapter";

interface Vehicle {
  vin?: string;
  make?: string;
  model?: string;
  year?: number;
  engine?: string;
}

interface Snapshot {
  capturedAt: number;
  dtcs: { code: string; description: string | null; pending?: boolean }[];
  livePids: Record<string, number>;
  freezeFrame?: Record<string, number>;
}

interface State {
  adapter: ObdAdapter | null;
  status: AdapterStatus;
  info: AdapterInfo | null;
  vehicle: Vehicle | null;
  snapshot: Snapshot | null;
  setAdapter: (a: ObdAdapter | null) => void;
  setStatus: (s: AdapterStatus) => void;
  setInfo: (i: AdapterInfo | null) => void;
  setVehicle: (v: Vehicle | null) => void;
  setSnapshot: (s: Snapshot | null) => void;
  updatePid: (pid: string, value: number) => void;
}

export const useStore = create<State>((set) => ({
  adapter: null,
  status: "disconnected",
  info: null,
  vehicle: null,
  snapshot: null,
  setAdapter: (adapter) => set({ adapter }),
  setStatus: (status) => set({ status }),
  setInfo: (info) => set({ info }),
  setVehicle: (vehicle) => set({ vehicle }),
  setSnapshot: (snapshot) => set({ snapshot }),
  updatePid: (pid, value) =>
    set((s) => {
      const snap = s.snapshot ?? { capturedAt: Date.now(), dtcs: [], livePids: {} };
      return { snapshot: { ...snap, livePids: { ...snap.livePids, [pid]: value } } };
    }),
}));
