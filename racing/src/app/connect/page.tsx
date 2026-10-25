"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import { SimulatedAdapter } from "@/lib/obd/simulated";
import { ElmAdapter } from "@/lib/obd/connection";
import { requestSerialPort, autoOpenSerialPort } from "@/lib/obd/webserial";
import { requestBluetoothDevice, openBluetoothPort } from "@/lib/obd/webbluetooth";

type LogEntry = { ts: number; level: "info" | "ok" | "err"; text: string };

export default function ConnectPage() {
  const { adapter, setAdapter, setStatus, setInfo, status, info } = useStore();
  const [log, setLog] = useState<LogEntry[]>([]);
  const [busy, setBusy] = useState(false);

  const push = (level: LogEntry["level"], text: string) =>
    setLog((l) => [...l, { ts: Date.now(), level, text }].slice(-50));

  async function connect(kind: "simulated" | "webserial" | "webbluetooth") {
    if (busy) return;
    setBusy(true);
    try {
      if (adapter) {
        await adapter.disconnect();
        setAdapter(null);
      }
      let a;
      if (kind === "simulated") {
        a = new SimulatedAdapter();
      } else if (kind === "webserial") {
        push("info", "Requesting serial port…");
        const port = await requestSerialPort();
        push("info", "Opening port…");
        const elmPort = await autoOpenSerialPort(port);
        a = new ElmAdapter(elmPort, "webserial", port.getInfo().usbProductId ? "USB Serial" : "Serial");
      } else {
        push("info", "Requesting Bluetooth device…");
        const dev = await requestBluetoothDevice();
        push("info", `Pairing ${dev.name ?? "unknown"}…`);
        const elmPort = await openBluetoothPort(dev);
        a = new ElmAdapter(elmPort, "webbluetooth", dev.name ?? "BLE Adapter");
      }
      a.on("status", (s) => setStatus(s));
      push("info", "Initializing ELM327 (ATZ → ATE0 → ATSP0)…");
      await a.connect();
      setAdapter(a);
      setInfo(a.info);
      push("ok", `Connected — ${a.info.protocol ?? "auto"} @ ${a.info.voltage ?? "?"}V`);
    } catch (err) {
      push("err", String(err));
      setStatus("error");
    } finally {
      setBusy(false);
    }
  }

  async function disconnect() {
    if (!adapter) return;
    await adapter.disconnect();
    setAdapter(null);
    setInfo(null);
    push("info", "Disconnected");
  }

  return (
    <div className="grid md:grid-cols-3 gap-4">
      <div className="md:col-span-2 space-y-4">
        <section className="panel p-6">
          <h1 className="text-xl font-semibold mb-1">Adapter</h1>
          <p className="text-sm text-muted mb-4">
            Web Serial works in desktop Chrome / Edge, and on Android Chrome over
            USB-OTG. Web Bluetooth needs a BLE-capable adapter (OBDLink CX, vLinker
            MC+ BLE, Vgate BLE 4.0). Classic-Bluetooth ELM327 clones aren&apos;t
            accessible from browsers.
          </p>
          <div className="flex flex-wrap gap-2">
            <button className="btn" disabled={busy} onClick={() => connect("webserial")}>
              Connect via USB / Serial
            </button>
            <button className="btn" disabled={busy} onClick={() => connect("webbluetooth")}>
              Connect via Bluetooth
            </button>
            <button className="btn" disabled={busy} onClick={() => connect("simulated")}>
              Use simulated ECU
            </button>
            {adapter && (
              <button className="btn" onClick={disconnect}>Disconnect</button>
            )}
          </div>
        </section>

        <section className="panel p-6">
          <h2 className="font-semibold mb-3">Adapter status</h2>
          <dl className="grid grid-cols-3 gap-y-2 text-sm">
            <dt className="text-muted">State</dt><dd className="col-span-2 mono">{status}</dd>
            <dt className="text-muted">Name</dt><dd className="col-span-2 mono">{info?.name ?? "—"}</dd>
            <dt className="text-muted">Protocol</dt><dd className="col-span-2 mono">{info?.protocol ?? "—"}</dd>
            <dt className="text-muted">Voltage</dt><dd className="col-span-2 mono">{info?.voltage ?? "—"} V</dd>
            <dt className="text-muted">Transport</dt><dd className="col-span-2 mono">{info?.kind ?? "—"}</dd>
          </dl>
        </section>
      </div>

      <aside className="panel p-4 text-xs h-fit">
        <div className="font-semibold mb-2 text-sm">Log</div>
        <div className="space-y-1 max-h-96 overflow-y-auto">
          {log.length === 0 && <div className="text-muted">Nothing yet.</div>}
          {log.map((l, i) => (
            <div key={i} className="mono leading-relaxed">
              <span className="text-muted">{new Date(l.ts).toLocaleTimeString()}</span>{" "}
              <span className={l.level === "err" ? "text-accent" : l.level === "ok" ? "text-ok" : "text-ink"}>
                {l.text}
              </span>
            </div>
          ))}
        </div>
      </aside>
    </div>
  );
}
