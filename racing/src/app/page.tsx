import Link from "next/link";

export default function Home() {
  return (
    <div className="space-y-8">
      <section className="panel p-8">
        <h1 className="text-3xl font-semibold tracking-tight mb-3">
          Your vehicle, on speaking terms.
        </h1>
        <p className="text-muted max-w-2xl leading-relaxed">
          Connect any ELM327 or OBDLink adapter from your phone or laptop. Read
          live engine data, pull diagnostic codes, and let an AI co-pilot
          explain what&apos;s actually wrong — in plain English, in seconds.
          For tuning on open-source ECUs, upload a datalog and get cell-level
          map suggestions backed by the data, not vibes.
        </p>
        <div className="mt-6 flex gap-3">
          <Link href="/connect" className="btn btn-primary">Connect adapter</Link>
          <Link href="/dashboard" className="btn">Try with simulated data</Link>
        </div>
      </section>

      <section className="grid md:grid-cols-3 gap-4">
        <Feature title="Diagnose" href="/diagnose"
          body="DTC reader with freeze-frame context. AI explains the codes, ranks them by likely root cause, and gives you an ordered test plan." />
        <Feature title="Live dashboard" href="/dashboard"
          body="RPM, speed, coolant, MAF, throttle, fuel trims, O2 — all the standard PIDs your ECU exposes, refreshing in real time." />
        <Feature title="Tune (open ECUs)" href="/tune"
          body="Drop in a datalog from Speeduino, rusEFI, or MegaSquirt. The AI reads it the way a calibration engineer would and suggests changes." />
      </section>

      <section className="panel p-6 text-sm">
        <h2 className="font-semibold mb-2">What this is, and isn&apos;t</h2>
        <ul className="space-y-1.5 text-muted list-disc list-inside">
          <li>Reads everything any OBD-II vehicle from 1996 onward exposes.</li>
          <li>Tuning support is for <em>open / aftermarket</em> ECUs — not for bypassing factory ECU security.</li>
          <li>No emissions-control defeat. No anti-theft / immobilizer bypass.</li>
          <li>Off-road / track use for tuning suggestions. Your jurisdiction&apos;s laws still apply.</li>
        </ul>
      </section>
    </div>
  );
}

function Feature({ title, body, href }: { title: string; body: string; href: string }) {
  return (
    <Link href={href} className="panel p-5 hover:border-accent transition-colors block">
      <h3 className="font-semibold text-accent mb-2">{title}</h3>
      <p className="text-sm text-muted leading-relaxed">{body}</p>
    </Link>
  );
}
