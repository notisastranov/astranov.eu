import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ANSWER_TRAINING,
  band,
  boardLine,
  CRIB,
  EDITIONS,
  editionItems,
  editionOf,
  LIE_SCALES,
  limitWord,
  lookingFor,
  ORDINARY_LIMIT,
  QUESTION_LIMIT,
  read,
  SCALE_SEARCH,
  SCALES,
  score,
  scoreSoFar,
  T_SCORE,
  type EditionId,
  type Mark,
  type Profile as ScoreProfile,
  type ScaleId,
} from "@/lib/inventory";
import { listSittings, saveSitting, type Sitting } from "@/lib/sittings";

export const Route = createFileRoute("/")({ component: Home });

const STORAGE_KEY = "minnesota-practice-v1";

type Phase = "cover" | "book" | "profile" | "crib";

type Save = {
  id: string | null;
  edition: EditionId;
  phase: Phase;
  index: number;
  answers: Record<number, Mark>;
};

const EMPTY: Save = { id: null, edition: "tiny", phase: "cover", index: 0, answers: {} };

function loadSave(): Save {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as Save;
    if (!parsed || typeof parsed.index !== "number" || !parsed.answers) return EMPTY;
    const edition = editionOf(parsed.edition);
    const length = editionItems(edition).length;
    return {
      id: typeof parsed.id === "string" ? parsed.id : null,
      edition,
      phase: parsed.phase ?? "cover",
      index: Math.min(Math.max(0, parsed.index), length - 1),
      answers: parsed.answers,
    };
  } catch {
    return EMPTY;
  }
}

function answerCount(answers: Record<number, Mark> | Record<string, Mark>): number {
  return Object.keys(answers).length;
}

function when(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Earlier";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Athens",
  }).format(date);
}

function Home() {
  const [save, setSave] = useState<Save>(EMPTY);
  const [ready, setReady] = useState(false);
  const [kept, setKept] = useState(false);
  const [past, setPast] = useState<Sitting[]>([]);

  useEffect(() => {
    setSave(loadSave());
    setReady(true);
    void listSittings().then(setPast).catch(() => setPast([]));
  }, []);

  useEffect(() => {
    if (!ready) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(save));
  }, [save, ready]);

  useEffect(() => {
    if (!ready || !save.id) return;
    if (save.phase === "cover" && answerCount(save.answers) === 0) return;
    const timer = window.setTimeout(() => {
      void saveSitting({
        data: {
          id: save.id,
          edition: save.edition,
          phase: save.phase,
          index: save.index,
          answers: save.answers,
        },
      })
        .then((result) => {
          setKept(result.kept);
          if (result.kept) void listSittings().then(setPast).catch(() => undefined);
        })
        .catch(() => setKept(false));
    }, 300);
    return () => window.clearTimeout(timer);
  }, [save, ready]);

  function reset() {
    setSave((s) => ({ ...EMPTY, edition: s.edition, id: crypto.randomUUID() }));
    setKept(false);
  }

  function resume(row: Sitting) {
    const edition = editionOf(row.edition);
    const length = editionItems(edition).length;
    const answers: Record<number, Mark> = {};
    for (const [key, mark] of Object.entries(row.answers ?? {})) {
      if (mark === "T" || mark === "F" || mark === "?") answers[Number(key)] = mark;
    }
    setSave({
      id: row.id,
      edition,
      phase: row.phase === "crib" ? "profile" : row.phase,
      index: Math.min(Math.max(0, row.item_index), length - 1),
      answers,
    });
  }

  return (
    <main data-ready={ready ? "true" : "false"} className="min-h-dvh bg-paper text-ink">
      <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col px-6 pt-8 pb-24">
        <Header
          phase={save.phase}
          index={save.index}
          length={editionItems(save.edition).length}
          onCover={() => setSave((s) => ({ ...s, phase: "cover" }))}
        />
        {save.phase === "cover" && (
          <Cover
            ready={ready}
            kept={kept}
            edition={save.edition}
            continuing={answerCount(save.answers) > 0}
            past={past}
            onEdition={(edition) => {
              setKept(false);
              setSave((current) =>
                current.edition === edition
                  ? current
                  : { ...EMPTY, edition },
              );
            }}
            onStart={() => {
              if (!ready) return;
              setSave((s) => ({
                ...s,
                id: s.id ?? crypto.randomUUID(),
                phase: "book",
                index: answerCount(s.answers) > 0 ? s.index : 0,
              }));
            }}
            onResume={resume}
            onCrib={() => {
              if (!ready) return;
              setSave((s) => ({ ...s, phase: "crib" }));
            }}
          />
        )}
        {save.phase === "book" && (
          <Book
            edition={save.edition}
            items={editionItems(save.edition)}
            index={save.index}
            answers={save.answers}
            onMark={(mark) => {
              const items = editionItems(save.edition);
              const item = items[save.index];
              const answers = { ...save.answers, [item.id]: mark };
              const last = save.index >= items.length - 1;
              setSave({
                id: save.id ?? crypto.randomUUID(),
                edition: save.edition,
                phase: last ? "profile" : "book",
                index: last ? save.index : save.index + 1,
                answers,
              });
            }}
            onBack={() => {
              if (save.index === 0) {
                setSave((s) => ({ ...s, phase: "cover" }));
                return;
              }
              setSave((s) => ({ ...s, index: s.index - 1 }));
            }}
          />
        )}
        {save.phase === "profile" && (
          <Profile
            edition={save.edition}
            answers={save.answers}
            kept={kept}
            onAgain={reset}
            onCrib={() => setSave((s) => ({ ...s, phase: "crib" }))}
          />
        )}
        {save.phase === "crib" && (
          <Crib
            onBack={() =>
              setSave((s) => ({
                ...s,
                phase:
                  Object.keys(s.answers).length >= editionItems(s.edition).length
                    ? "profile"
                    : "cover",
              }))
            }
          />
        )}
      </div>
    </main>
  );
}

function Header({
  phase,
  index,
  length,
  onCover,
}: {
  phase: Phase;
  index: number;
  length: number;
  onCover: () => void;
}) {
  return (
    <header className="mb-8 flex items-baseline justify-between border-b border-rule pb-3">
      <button
        type="button"
        onClick={onCover}
        className="font-sans text-xs tracking-widest text-mist uppercase"
      >
        Minnesota Practice
      </button>
      <p className="text-xs text-mist tabular-nums">
        {phase === "book" ? `${index + 1} of ${length}` : `${length} lines`}
      </p>
    </header>
  );
}

function Cover({
  ready,
  kept,
  edition,
  continuing,
  past,
  onEdition,
  onStart,
  onResume,
  onCrib,
}: {
  ready: boolean;
  kept: boolean;
  edition: EditionId;
  continuing: boolean;
  past: Sitting[];
  onEdition: (edition: EditionId) => void;
  onStart: () => void;
  onResume: (row: Sitting) => void;
  onCrib: () => void;
}) {
  const chosen = EDITIONS.find((item) => item.id === edition) ?? EDITIONS[0];
  return (
    <section className="flex flex-1 flex-col">
      <p className="text-xs tracking-widest text-mist uppercase">Practice forms</p>
      <h1 className="mt-3 font-serif text-5xl leading-tight tracking-tight">
        Minnesota
        <br />
        Practice
      </h1>
      <p className="mt-6 max-w-sm text-base leading-relaxed text-mist">
        MMPI means Minnesota Multiphasic Personality Inventory. The long clinical
        form, the MMPI-2, is 567 true or false lines. This is not that test.
        These lines are original. The long form matches that length so you can
        practice the sitting.
      </p>
      <ul className="mt-8 flex flex-col gap-4">
        {ANSWER_TRAINING.map((rule) => (
          <li key={rule.title}>
            <p className="text-sm">{rule.title}</p>
            <p className="mt-1 text-sm leading-relaxed text-mist">{rule.text}</p>
          </li>
        ))}
      </ul>
      <ul className="mt-8 border-t border-rule">
        {EDITIONS.map((item) => {
          const active = item.id === edition;
          return (
            <li key={item.id} className="border-b border-rule">
              <button
                type="button"
                onClick={() => onEdition(item.id)}
                aria-pressed={active}
                className="flex w-full items-baseline justify-between py-3 text-left"
              >
                <span className={active ? "text-sm" : "text-sm text-mist"}>{item.name}</span>
                <span className="text-xs text-mist tabular-nums">{item.length} lines</span>
              </button>
            </li>
          );
        })}
      </ul>
      <div className="mt-8 flex flex-col gap-3">
        <button
          type="button"
          onClick={onStart}
          disabled={!ready}
          className="h-12 bg-lake px-6 text-on-lake disabled:opacity-60"
        >
          {continuing ? `Continue ${chosen.name.toLowerCase()}` : `Open ${chosen.name.toLowerCase()}`}
        </button>
        <button
          type="button"
          onClick={onCrib}
          className="h-12 border border-rule bg-sheet px-6 text-ink"
        >
          Lie scales
        </button>
      </div>
      {past.length > 0 && (
        <ul className="mt-10 border-t border-rule">
          {past.map((row) => {
            const form = EDITIONS.find((item) => item.id === editionOf(row.edition));
            const length = form?.length ?? 16;
            const answered = row.profile?.answered ?? answerCount(row.answers ?? {});
            const done = answered >= length;
            return (
              <li key={row.id} className="border-b border-rule">
                <button
                  type="button"
                  onClick={() => onResume(row)}
                  className="flex w-full items-baseline justify-between gap-4 py-3 text-left"
                >
                  <span className="text-sm">
                    {form?.name ?? "Small"}
                    <span className="text-mist"> · {when(row.updated_at)}</span>
                  </span>
                  <span className="shrink-0 text-xs text-mist tabular-nums">
                    {done ? "Finished" : `${answered} of ${length}`}
                    {row.profile?.clash ? ` · ${row.profile.clash} clash` : ""}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <p className="mt-8 text-sm leading-relaxed text-mist">
        Not the MMPI. Not a diagnosis. Raw counts, not T-scores.
        {kept ? " Last sitting is stored." : ""}
      </p>
    </section>
  );
}

function Book({
  edition,
  items,
  index,
  answers,
  onMark,
  onBack,
}: {
  edition: EditionId;
  items: readonly { id: number; text: string; scale: ScaleId; when: "T" | "F" }[];
  index: number;
  answers: Record<number, Mark>;
  onMark: (mark: Mark) => void;
  onBack: () => void;
}) {
  const item = items[index];
  const chosen = answers[item.id];
  const progress = index / items.length;
  const live = scoreSoFar(answers, edition);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const tag = (event.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      const key = event.key.toLowerCase();
      if (key === "t") onMark("T");
      else if (key === "f") onMark("F");
      else if (key === "p") onMark("?");
      else if (key === "arrowleft") onBack();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onMark, onBack]);

  return (
    <section className="flex flex-1 flex-col">
      <div className="mb-8 h-1 w-full bg-rule">
        <div
          className="h-full w-full origin-left bg-lake transition-transform duration-200"
          style={{ transform: `scaleX(${progress})` }}
        />
      </div>
      <p className="text-xs tracking-widest text-mist uppercase tabular-nums">
        Item {item.id}
      </p>
      <p className="mt-3 text-sm">
        {SCALES.find((scale) => scale.id === item.scale)?.cousin} ·{" "}
        {SCALES.find((scale) => scale.id === item.scale)?.name}
      </p>
      <h2 className="mt-4 font-serif text-3xl leading-snug tracking-tight">
        {item.text}
      </h2>
      <p className="mt-4 text-sm leading-relaxed text-mist">{lookingFor(item)}</p>
      <ProfileGraph profile={live} active={item.scale} />
      <p className="mt-2 text-xs leading-relaxed text-mist">
        So far, among the lines already marked. The point moves when a line for
        that scale is marked. The limits are the same two lines as the final profile.
      </p>
      <div className="mt-10 grid grid-cols-2 gap-3">
        <Choice label="True" mark="T" chosen={chosen} onMark={onMark} />
        <Choice label="False" mark="F" chosen={chosen} onMark={onMark} />
      </div>
      <button
        type="button"
        onClick={() => onMark("?")}
        className="mt-3 h-12 text-sm text-mist"
        aria-pressed={chosen === "?"}
      >
        Pass
      </button>
      <div className="mt-auto flex items-end justify-between pt-10">
        <button type="button" onClick={onBack} className="h-11 text-sm text-mist">
          Back
        </button>
        <p className="text-xs text-mist">T · F · P</p>
      </div>
    </section>
  );
}

function Choice({
  label,
  mark,
  chosen,
  onMark,
}: {
  label: string;
  mark: Mark;
  chosen: Mark | undefined;
  onMark: (mark: Mark) => void;
}) {
  const active = chosen === mark;
  return (
    <button
      type="button"
      onClick={() => onMark(mark)}
      aria-pressed={active}
      className={
        active
          ? "h-14 bg-lake text-on-lake"
          : "h-14 border border-rule bg-sheet text-ink"
      }
    >
      {label}
    </button>
  );
}

function ProfileGraph({
  profile,
  active,
}: {
  profile: ScoreProfile;
  active?: ScaleId;
}) {
  const scales = SCALES.filter((scale) => profile.max[scale.id] > 0);
  const width = Math.max(320, scales.length * 56);
  const height = 228;
  const padL = 8;
  const padR = 8;
  const padT = 18;
  const padB = 32;
  const innerH = height - padT - padB;
  const innerW = width - padL - padR;
  const xOf = (i: number) =>
    scales.length <= 1 ? padL + innerW / 2 : padL + (i * innerW) / (scales.length - 1);
  const yOf = (ratio: number) => padT + (1 - Math.min(1, Math.max(0, ratio))) * innerH;
  const yOrdinary = yOf(ORDINARY_LIMIT);
  const yQuestion = yOf(QUESTION_LIMIT);
  const points = scales.map((scale, i) => {
    const ratio = profile.counts[scale.id] / profile.max[scale.id];
    return { scale, ratio, x: xOf(i), y: yOf(ratio) };
  });
  const path = points.map((point, i) => `${i === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");

  return (
    <div className="mt-8 overflow-x-auto">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-auto w-full min-w-[320px]"
        role="img"
        aria-label="Practice profile with ordinary and question limits"
      >
        <line
          x1={padL}
          x2={width - padR}
          y1={yOrdinary}
          y2={yOrdinary}
          stroke="#6e675f"
          strokeDasharray="3 3"
        />
        <line x1={padL} x2={width - padR} y1={yQuestion} y2={yQuestion} stroke="#1e4d68" />
        <text x={padL + 2} y={yQuestion - 4} fill="#1e4d68" fontSize="10">
          Question limit
        </text>
        <text x={padL + 2} y={yOrdinary - 4} fill="#6e675f" fontSize="10">
          Ordinary limit
        </text>
        {points.length > 1 && (
          <path d={path} fill="none" stroke="#1c1916" strokeWidth="1.5" />
        )}
        {points.map((point) => (
          <g key={point.scale.id}>
            <circle
              cx={point.x}
              cy={point.y}
              r={point.scale.id === active ? 5 : 3.5}
              fill={
                point.scale.id === active
                  ? "#1e4d68"
                  : point.ratio + 1e-9 >= QUESTION_LIMIT
                    ? "#1e4d68"
                    : "#1c1916"
              }
            />
            <text
              x={point.x}
              y={height - 12}
              textAnchor="middle"
              fill={point.scale.id === active ? "#1e4d68" : "#1c1916"}
              fontSize="11"
            >
              {point.scale.cousin}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

function Profile({
  edition,
  answers,
  kept,
  onAgain,
  onCrib,
}: {
  edition: EditionId;
  answers: Record<number, Mark>;
  kept: boolean;
  onAgain: () => void;
  onCrib: () => void;
}) {
  const profile = score(answers, edition);
  const lines = read(profile);

  return (
    <section className="flex flex-1 flex-col">
      <p className="text-xs tracking-widest text-mist uppercase">Practice profile</p>
      <h2 className="mt-3 font-serif text-4xl leading-tight tracking-tight">
        How a board reads it
      </h2>
      <div className="mt-4 flex flex-col gap-3">
        {T_SCORE.map((line) => (
          <p key={line} className="text-sm leading-relaxed text-mist">
            {line}
          </p>
        ))}
      </div>
      <ProfileGraph profile={profile} />
      <div className="mt-6 flex gap-6 text-sm text-mist tabular-nums">
        <p>Passed {profile.blank}</p>
        <p>Contradictions {profile.clash}</p>
      </div>
      {profile.clashPairs.length > 0 && (
        <p className="mt-2 text-sm text-mist">
          Both true:{" "}
          {profile.clashPairs.map(([a, b]) => `${a} & ${b}`).join(", ")}
        </p>
      )}
      <ul className="mt-8 flex flex-col gap-4">
        {SCALES.filter((scale) => profile.max[scale.id] > 0).map((scale) => {
          const n = profile.counts[scale.id];
          const m = profile.max[scale.id];
          const level = band(n, m);
          const pct = m === 0 ? 0 : Math.round((n / m) * 100);
          const note = boardLine(scale.id, level);
          return (
            <li key={scale.id} className="flex flex-col gap-2">
              <div className="flex items-center gap-3">
                <div className="w-24 shrink-0">
                  <p className="text-sm">{scale.name}</p>
                  <p className="text-xs text-mist">{scale.cousin}</p>
                </div>
                <div className="h-1 flex-1 bg-rule">
                  <div className="h-full bg-lake" style={{ width: `${pct}%` }} />
                </div>
                <p className="w-16 shrink-0 text-right text-xs text-mist tabular-nums">
                  {limitWord(level)}
                </p>
              </div>
              <p className="text-sm leading-relaxed text-mist">
                Searches for {SCALE_SEARCH[scale.id]}
              </p>
              {note && <p className="text-sm leading-relaxed">{note}</p>}
            </li>
          );
        })}
      </ul>
      <div className="mt-8 border-t border-rule pt-6">
        {lines.map((line) => (
          <p key={line} className="mb-3 text-sm leading-relaxed">
            {line}
          </p>
        ))}
      </div>
      <p className="mt-6 text-sm leading-relaxed text-mist">
        {profile.max.correct > 0
          ? "Every basic scale on this sitting is in the graph. Mf, the old interest scale, is not used."
          : "Shorter forms leave out K, Hy, Pd, Pt, and Sc. Those are on the long form."}
      </p>
      {kept && (
        <p className="text-sm text-mist">This sitting is stored.</p>
      )}
      <div className="mt-auto flex flex-col gap-3 pt-8">
        <button type="button" onClick={onAgain} className="h-12 bg-lake px-6 text-on-lake">
          New sitting
        </button>
        <button
          type="button"
          onClick={onCrib}
          className="h-12 border border-rule bg-sheet px-6 text-ink"
        >
          Lie scales
        </button>
      </div>
    </section>
  );
}

function Crib({ onBack }: { onBack: () => void }) {
  return (
    <section className="flex flex-1 flex-col">
      <p className="text-xs tracking-widest text-mist uppercase">Score report</p>
      <h2 className="mt-3 font-serif text-4xl leading-tight tracking-tight">
        Lie scales
      </h2>
      <p className="mt-4 text-sm leading-relaxed text-mist">
        Two scales ask whether the booklet is trying to look too good. L is
        obvious. K is quieter. F is not a lie scale. It points the other way.
      </p>
      <ul className="mt-8 flex flex-col gap-6">
        {LIE_SCALES.map((scale) => (
          <li key={scale.code}>
            <p className="text-sm">
              {scale.code} · {scale.name}
            </p>
            <p className="mt-1 text-sm leading-relaxed text-mist">{scale.text}</p>
          </li>
        ))}
      </ul>
      <p className="mt-6 text-sm leading-relaxed">
        High L with a quiet K is an obvious performance. High K with a quiet L
        is a smoother one. Neither is a school pass or fail. Both mean the other
        scales are not yet trustworthy.
      </p>
      <h3 className="mt-10 font-serif text-2xl tracking-tight">The other scales</h3>
      <p className="mt-3 text-sm leading-relaxed text-mist">
        Names on a Minnesota report, and what a board is asking when it sees
        them. Shorter forms score only some of these. The long form scores the
        rest except Mf.
      </p>
      <ul className="mt-8 flex flex-col">
        {CRIB.map(([code, name, gloss]) => (
          <li key={code} className="grid grid-cols-12 gap-3 border-t border-rule py-3">
            <p className="col-span-2 text-sm tabular-nums">{code}</p>
            <div className="col-span-10">
              <p className="text-sm">{name}</p>
              <p className="text-sm text-mist">{gloss}</p>
            </div>
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={onBack}
        className="mt-8 h-12 border border-rule bg-sheet px-6 text-ink"
      >
        Back
      </button>
    </section>
  );
}
