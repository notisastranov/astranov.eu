/**
 * Web Bluetooth transport for BLE-capable OBD adapters (OBDLink CX,
 * vLinker MC+ BLE, Vgate iCar Pro BLE 4.0, etc.).
 *
 * Heads-up: cheap classic-Bluetooth ELM327 clones use the SPP profile and
 * are NOT accessible from browsers — Web Bluetooth is BLE-only. Users on
 * those adapters need to fall back to Web Serial via a USB cable, or use
 * a BLE-native adapter.
 *
 * We use the Nordic UART Service (NUS) by default since most modern BLE
 * OBD adapters expose it, plus a few vendor-specific UUIDs as fallbacks.
 */

import type { ElmPort } from "./elm327";

const NUS_SERVICE     = "6e400001-b5a3-f393-e0a9-e50e24dcca9e";
const NUS_RX_CHAR     = "6e400002-b5a3-f393-e0a9-e50e24dcca9e"; // write
const NUS_TX_CHAR     = "6e400003-b5a3-f393-e0a9-e50e24dcca9e"; // notify

// OBDLink CX uses a STN-specific service.
const STN_SERVICE     = "0000fff0-0000-1000-8000-00805f9b34fb";
const STN_WRITE_CHAR  = "0000fff2-0000-1000-8000-00805f9b34fb";
const STN_NOTIFY_CHAR = "0000fff1-0000-1000-8000-00805f9b34fb";

interface Pair {
  service: string;
  write: string;
  notify: string;
}

const PAIRS: Pair[] = [
  { service: NUS_SERVICE, write: NUS_RX_CHAR, notify: NUS_TX_CHAR },
  { service: STN_SERVICE, write: STN_WRITE_CHAR, notify: STN_NOTIFY_CHAR },
];

export async function requestBluetoothDevice(): Promise<BluetoothDevice> {
  if (!("bluetooth" in navigator)) {
    throw new Error("Web Bluetooth not supported in this browser.");
  }
  return navigator.bluetooth.requestDevice({
    optionalServices: PAIRS.map((p) => p.service),
    filters: [
      { namePrefix: "OBDII" },
      { namePrefix: "OBDLink" },
      { namePrefix: "vLinker" },
      { namePrefix: "Vgate" },
      { namePrefix: "Carista" },
      { namePrefix: "VEEPEAK" },
    ],
  });
}

export async function openBluetoothPort(device: BluetoothDevice): Promise<ElmPort> {
  const server = await device.gatt!.connect();
  let chosen: { write: BluetoothRemoteGATTCharacteristic; notify: BluetoothRemoteGATTCharacteristic } | null = null;
  let lastErr: unknown;
  for (const pair of PAIRS) {
    try {
      const svc = await server.getPrimaryService(pair.service);
      const write = await svc.getCharacteristic(pair.write);
      const notify = await svc.getCharacteristic(pair.notify);
      chosen = { write, notify };
      break;
    } catch (err) {
      lastErr = err;
    }
  }
  if (!chosen) {
    throw new Error(`No compatible GATT service found on ${device.name}: ${String(lastErr)}`);
  }
  await chosen.notify.startNotifications();
  const queue: Uint8Array[] = [];
  let wake: (() => void) | null = null;
  chosen.notify.addEventListener("characteristicvaluechanged", () => {
    const v = chosen!.notify.value;
    if (!v) return;
    queue.push(new Uint8Array(v.buffer.slice(v.byteOffset, v.byteOffset + v.byteLength)));
    wake?.();
  });

  return {
    async write(bytes) {
      // BLE write chunks are limited to ~20 bytes for the default MTU.
      const max = 20;
      for (let i = 0; i < bytes.byteLength; i += max) {
        await chosen!.write.writeValueWithoutResponse(bytes.slice(i, i + max));
      }
    },
    read: async function* () {
      while (device.gatt?.connected) {
        if (queue.length === 0) {
          await new Promise<void>((r) => { wake = r; });
        }
        wake = null;
        while (queue.length) yield queue.shift()!;
      }
    },
    async close() {
      try { await chosen!.notify.stopNotifications(); } catch {}
      device.gatt?.disconnect();
    },
  };
}
