import { BANK } from "@/lib/bank";
import { LONG_BANK } from "@/lib/long-bank";

export type Mark = "T" | "F" | "?";

export type ScaleId =
  | "guard"
  | "rare"
  | "correct"
  | "distress"
  | "drive"
  | "apart"
  | "body"
  | "wary"
  | "social"
  | "rules"
  | "worry"
  | "detached";

export type Band = "quiet" | "mixed" | "raised";

export type EditionId = "tiny" | "small" | "medium" | "full" | "long";

export type Item = {
  id: number;
  text: string;
  scale: ScaleId;
  /** The mark that endorses the scale. */
  when: "T" | "F";
};

export type ScaleInfo = {
  id: ScaleId;
  name: string;
  cousin: string;
};

/** Both True is a contradiction — a toy stand-in for an inconsistency pair. */
export const CLASHES: ReadonlyArray<readonly [number, number]> = [
  [1, 8],
  [4, 12],
  [5, 16],
];

export const EDITIONS: readonly {
  id: EditionId;
  name: string;
  length: number;
}[] = [
  { id: "tiny", name: "Very small", length: 7 },
  { id: "small", name: "Small", length: 16 },
  { id: "medium", name: "Medium", length: 49 },
  { id: "full", name: "Full", length: 112 },
  { id: "long", name: "Long", length: 567 },
];

const LENGTH: Record<EditionId, number> = {
  tiny: 7,
  small: 16,
  medium: 49,
  full: 112,
  long: 567,
};

export function isEdition(value: unknown): value is EditionId {
  return (
    value === "tiny" ||
    value === "small" ||
    value === "medium" ||
    value === "full" ||
    value === "long"
  );
}

export function editionOf(value: unknown): EditionId {
  return isEdition(value) ? value : "small";
}

export const SCALES: readonly ScaleInfo[] = [
  { id: "guard", name: "Guarded", cousin: "L" },
  { id: "rare", name: "Unusual", cousin: "F" },
  { id: "correct", name: "Composed", cousin: "K" },
  { id: "body", name: "Body focus", cousin: "Hs" },
  { id: "distress", name: "Low mood", cousin: "D" },
  { id: "social", name: "Approval", cousin: "Hy" },
  { id: "rules", name: "Rules", cousin: "Pd" },
  { id: "wary", name: "Wary", cousin: "Pa" },
  { id: "worry", name: "Worry", cousin: "Pt" },
  { id: "detached", name: "Detached", cousin: "Sc" },
  { id: "drive", name: "Drive", cousin: "Ma" },
  { id: "apart", name: "Keeps apart", cousin: "Si" },
];

/** What this particular line is looking for, and which mark counts toward the scale. */
const LOOKING: Record<ScaleId, Record<"T" | "F", string>> = {
  guard: {
    T: "Looking for a claim of uncommon virtue in this line.",
    F: "Looking for whether you deny the ordinary fault in this line.",
  },
  rare: {
    T: "Looking for the rare experience named in this line.",
    F: "Looking for whether you deny that things have stayed ordinary.",
  },
  correct: {
    T: "Looking for a claim, in this line, that you are fine and in control.",
    F: "Looking for whether you deny an ordinary strain.",
  },
  body: {
    T: "Looking for attention fastened on the body sensation in this line.",
    F: "Looking for whether you deny that the body stays in the background.",
  },
  distress: {
    T: "Looking for the low mood named in this line.",
    F: "Looking for whether you deny that mood has been all right.",
  },
  social: {
    T: "Looking for a need to be liked, or the body carrying that strain.",
    F: "Looking for whether you deny that approval is necessary.",
  },
  rules: {
    T: "Looking for friction with a rule or an authority in this line.",
    F: "Looking for whether you deny that you keep to the same limit as other people.",
  },
  wary: {
    T: "Looking for suspicion, or a sense of being used, in this line.",
    F: "Looking for whether you deny ordinary trust.",
  },
  worry: {
    T: "Looking for checking, doubt, or rumination in this line.",
    F: "Looking for whether you deny that a worry can be left.",
  },
  detached: {
    T: "Looking for feeling removed, unreal, or loosely tied together.",
    F: "Looking for whether you deny feeling present and continuous.",
  },
  drive: {
    T: "Looking for speed, impatience, or a weak brake in this line.",
    F: "Looking for whether you deny that your pace is steady.",
  },
  apart: {
    T: "Looking for a preference for being apart from people.",
    F: "Looking for whether you deny that company is welcome.",
  },
};

export function lookingFor(item: Item): string {
  const code = SCALES.find((scale) => scale.id === item.scale)?.cousin ?? "";
  const mark = item.when === "T" ? "True" : "False";
  return `${LOOKING[item.scale][item.when]} ${mark} is the mark that counts toward ${code}.`;
}

export const T_SCORE = [
  "A T-score puts a raw count on a common ruler. The comparison group’s average is set at 50. Every 10 points is one standard deviation, the usual spread of that group.",
  "T = 50 is average. T = 60 is one step up. T = 65, one and a half steps up, is the line on an MMPI-2 where a scale stops looking ordinary. T = 70 is clearly high. The arithmetic is 50 + 10 × (your raw score − the group average) ÷ the group’s spread.",
  "This practice form has no norm group, so it cannot make a real T-score. The graph uses the share of keyed lines instead. Two-thirds stands in for the job T = 65 does. It is not itself a T-score, and it is not a school pass or fail.",
];

export const SCALE_SEARCH: Record<ScaleId, string> = {
  guard: "Lie. Uncommon virtue — a record that claims it never slips.",
  rare: "Infrequency. Experiences most people do not report.",
  correct: "Correction. A quieter performance of being fine and in control.",
  body: "Hypochondriasis. Attention fastened on the body.",
  distress: "Depression. Low mood, slowing, and loss of interest.",
  social: "Hysteria. Needing approval, with the body carrying that strain.",
  rules: "Conduct. Conflict with rules, authority, and consequences.",
  wary: "Paranoia. Suspicion, and a sense of being used.",
  worry: "Psychasthenia. Doubt, checking, and rumination.",
  detached: "Alienation. Feeling removed, unreal, or loosely tied together.",
  drive: "Hypomania. Speed, impatience, and a weak brake.",
  apart: "Social introversion. Keeping apart from people.",
};

/** Practice limits. On a real MMPI-2 these roles belong to T = 50 and T = 65. */
export const ORDINARY_LIMIT = 1 / 3;
export const QUESTION_LIMIT = 2 / 3;

export function limitWord(level: Band): string {
  if (level === "raised") return "Over limit";
  if (level === "mixed") return "Border";
  return "Within limit";
}

export const LIE_SCALES: readonly { code: string; name: string; text: string }[] = [
  {
    code: "L",
    name: "Lie",
    text: "The obvious one. These lines claim an uncommon virtue: never angry, never a small lie, always fair. Ordinary people cannot honestly endorse a stack of them. When L is over the limit, the booklet looks performed. A board reads that as guarding, not as good character. A high L does not mean you are a liar in daily life. It means the answers claimed a purity almost no one has.",
  },
  {
    code: "K",
    name: "Correction",
    text: "The quieter one. Not “I have never lied.” More “I am fine, in control, hard to rattle.” Careful people raise K while L stays low. On a real MMPI-2, a fraction of K is added to some clinical scales. This form only shows whether that composed face rose. A high K can hide distress and make the other scales look calmer than the person is. A very low K is the opposite: unusually open, or playing problems up.",
  },
  {
    code: "F",
    name: "Not a lie scale",
    text: "F is a validity scale, and it gets lumped in with the lie scales. It points the other way. F searches for rare experiences. High F looks like fake-bad, careless answering, or a genuinely unusual life. High L is someone trying to look too good. High F is someone not looking good. If L and F are both over the limit, the booklet is pulling both ways and should not be believed.",
  },
];

export const ANSWER_TRAINING: readonly { title: string; text: string }[] = [
  {
    title: "Answer the weeks you had",
    text: "Not the candidate you wish a board would meet. A performed record is what the lie items are built to catch.",
  },
  {
    title: "Never and always",
    text: "If a line says you never slip or always do the ideal thing, and that is not literally true, mark False. Admitting an ordinary fault is accuracy. It is not a trick, and it is what keeps the lie scale down.",
  },
  {
    title: "Do not invent, and do not deny",
    text: "Rare lines are rare. Mark them True only if they happened. Marking them to look interesting, or answering at random, is what lifts the infrequency scale.",
  },
  {
    title: "Pass almost nothing",
    text: "Pass only a line you truly cannot answer. A pile of blanks is its own bad result. The rest of the profile stops being readable.",
  },
  {
    title: "Do not polish",
    text: "The first honest mark is the accurate one. Going back to improve the picture is the lie pattern. This practice does not teach you how to hide a real trait.",
  },
];

const OPENING: readonly Item[] = [
  { id: 1, scale: "distress", when: "T", text: "I have felt sad or empty for days at a time." },
  { id: 2, scale: "guard", when: "T", text: "I have never felt annoyed at another person." },
  { id: 3, scale: "body", when: "T", text: "Small aches make me wonder if something serious is wrong." },
  { id: 4, scale: "apart", when: "T", text: "I would rather spend the evening alone than with friends." },
  { id: 5, scale: "drive", when: "T", text: "New ideas pull me off whatever I was already doing." },
  { id: 6, scale: "rare", when: "T", text: "I have believed that other people could hear my thoughts." },
  { id: 7, scale: "wary", when: "T", text: "Most people are looking for a way to use me." },
  { id: 8, scale: "distress", when: "F", text: "My mood is generally good these days." },
  { id: 9, scale: "guard", when: "T", text: "I tell the whole truth, including about small things." },
  { id: 10, scale: "body", when: "T", text: "My body feels tense even when nothing is happening." },
  { id: 11, scale: "drive", when: "T", text: "I sleep very little and still feel full of energy." },
  { id: 12, scale: "apart", when: "F", text: "I enjoy being in a room full of people." },
  { id: 13, scale: "rare", when: "T", text: "Familiar places have looked unreal to me, like a set." },
  { id: 14, scale: "wary", when: "F", text: "I trust people until they give me a reason not to." },
  { id: 15, scale: "distress", when: "T", text: "Things I used to like now feel flat." },
  { id: 16, scale: "drive", when: "F", text: "I stay with a task until it is finished, even when it is dull." },
];

export const ALL_ITEMS: readonly Item[] = [...OPENING, ...BANK, ...LONG_BANK];

/** The short booklet. Longer editions add lines after these. */
export const ITEMS: readonly Item[] = OPENING;

export function editionItems(edition: EditionId): readonly Item[] {
  return ALL_ITEMS.slice(0, LENGTH[edition]);
}

export function editionClashes(
  edition: EditionId,
): ReadonlyArray<readonly [number, number]> {
  const length = LENGTH[edition];
  return CLASHES.filter(([a, b]) => a <= length && b <= length);
}

export const CRIB: ReadonlyArray<readonly [string, string, string]> = [
  ["?", "Cannot Say", "Too many blanks, and a board treats the protocol as incomplete."],
  ["L", "Lie", "Uncommon virtue. Selection reads this as guarding, not as good character."],
  ["F", "Infrequency", "Rare items. A board settles this before it believes any other scale."],
  ["K", "Correction", "Quieter guarding than L. A calm claim of being fine. Scored on the long form."],
  ["VRIN", "Inconsistency", "Pairs that should not both be true. Careless or random answering."],
  ["Hs", "Hypochondriasis", "Body focus. Read against physical training and medical fitness, not as a diagnosis."],
  ["D", "Depression", "Low mood and slowing. The emotional-stability question in a long course."],
  ["Hy", "Hysteria", "Need for approval, sometimes carried by the body. Scored on the long form."],
  ["Pd", "Psychopathic deviate", "Conflict with rules and authority. The conduct scale boards watch. Scored on the long form."],
  ["Mf", "Masculinity–Femininity", "Old interest norms. Not used for selection in this form."],
  ["Pa", "Paranoia", "Suspicion. Read against trust in peers and in a chain of command."],
  ["Pt", "Psychasthenia", "Worry and rumination under stress. Scored on the long form."],
  ["Sc", "Schizophrenia", "Feeling removed or unreal. Scored on the long form. Not a diagnosis."],
  ["Ma", "Hypomania", "Energy and a weak brake. Stamina if mild, impulse and risk if clearly raised."],
  ["Si", "Social introversion", "Keeping apart. Read against group living, teamwork, and being seen as a leader."],
];

/** How a military-school board reads the cousin of this scale. Not a decision. */
export function boardLine(id: ScaleId, level: Band): string | null {
  if (level === "quiet") return null;
  const raised = level === "raised";
  const lines: Record<ScaleId, readonly [string, string]> = {
    guard: [
      "Some uncommon virtue. A board calls that mild guarding, not good character.",
      "The booklet looks too perfect. L is read as defensiveness. It is not scored as conduct.",
    ],
    rare: [
      "A few rare items. They are noted, and the rest is read more carefully.",
      "Unusual items are frequent. F is settled before any training scale is believed. A high F can stop a file.",
    ],
    distress: [
      "Some low mood. A board asks whether energy will hold through a long, stressful course.",
      "Low mood is the shape that rose. That is the emotional-stability question, not a diagnosis of depression.",
    ],
    body: [
      "Some attention to the body. Asked against physical training, not treated as a medical finding.",
      "Body focus is high. Selection asks whether that concern would interfere with training and duty.",
    ],
    wary: [
      "Some distrust. Relevant to roommates, peers, and taking orders without feeling singled out.",
      "Suspicion is high. Read as trouble trusting the group or the chain of command, not as proof that anyone is against you.",
    ],
    apart: [
      "Some preference for being apart. Group living will be part of the interview, not an automatic problem.",
      "Keeping apart is marked. Boards ask how that sits with barracks life, teamwork, and leadership visibility.",
    ],
    drive: [
      "Energy is up. Mild drive can look like stamina. They still ask about finishing what was started.",
      "Drive is high. That is read as impatience and a weak brake — a discipline and safety question, not ambition.",
    ],
    correct: [
      "Some claim of being unruffled. K is the quieter lie: not 'never angry,' but 'I am simply fine.'",
      "The record insists on composure. A board reads K as defensiveness wearing a calm face, and it stops trusting the heights under it.",
    ],
    social: [
      "Some need to be liked, or the body joins a social strain. Noted, not treated as an illness.",
      "Approval is carrying the profile. Read as needing to be liked, sometimes with physical complaints doing the talking.",
    ],
    rules: [
      "Some friction with rules. A board asks whether that is a story or a habit.",
      "Conflict with rules is high. This is the conduct question military schools watch. It is not a finding that you will break an order. It is a reason they will ask.",
    ],
    worry: [
      "Some checking and doubt. Relevant to whether training stress would occupy the day.",
      "Worry is high. Read as rumination under load, not as a diagnosis, and not as conscientiousness.",
    ],
    detached: [
      "Some sense of being a step removed. Ask whether that was a bad week or the usual way the room feels.",
      "Detachment is high. Read as feeling unreal or loosely tied together. A board does not call that a diagnosis from this practice form.",
    ],
  };
  return lines[id][raised ? 1 : 0];
}

export type Profile = {
  counts: Record<ScaleId, number>;
  max: Record<ScaleId, number>;
  clash: number;
  clashPairs: Array<[number, number]>;
  blank: number;
  trueCount: number;
  falseCount: number;
};

function emptyCounts(): Record<ScaleId, number> {
  return {
    guard: 0,
    rare: 0,
    correct: 0,
    distress: 0,
    drive: 0,
    apart: 0,
    body: 0,
    wary: 0,
    social: 0,
    rules: 0,
    worry: 0,
    detached: 0,
  };
}

export function score(answers: Record<number, Mark>, edition: EditionId = "small"): Profile {
  const counts = emptyCounts();
  const max = emptyCounts();
  let blank = 0;
  let trueCount = 0;
  let falseCount = 0;

  for (const item of editionItems(edition)) {
    max[item.scale] += 1;
    const mark = answers[item.id];
    if (mark === "?") blank += 1;
    if (mark === "T") trueCount += 1;
    if (mark === "F") falseCount += 1;
    if (mark && mark === item.when) counts[item.scale] += 1;
  }

  const clashPairs: Array<[number, number]> = [];
  for (const pair of editionClashes(edition)) {
    const [a, b] = pair;
    if (answers[a] === "T" && answers[b] === "T") {
      clashPairs.push([a, b]);
    }
  }

  return {
    counts,
    max,
    clash: clashPairs.length,
    clashPairs,
    blank,
    trueCount,
    falseCount,
  };
}

/** Running profile: only lines already marked. The denominator grows with the sitting. */
export function scoreSoFar(answers: Record<number, Mark>, edition: EditionId): Profile {
  const counts = emptyCounts();
  const max = emptyCounts();
  let blank = 0;
  let trueCount = 0;
  let falseCount = 0;

  for (const item of editionItems(edition)) {
    const mark = answers[item.id];
    if (mark !== "T" && mark !== "F" && mark !== "?") continue;
    max[item.scale] += 1;
    if (mark === "?") blank += 1;
    if (mark === "T") trueCount += 1;
    if (mark === "F") falseCount += 1;
    if (mark === item.when) counts[item.scale] += 1;
  }

  return {
    counts,
    max,
    clash: 0,
    clashPairs: [],
    blank,
    trueCount,
    falseCount,
  };
}

export function band(n: number, m: number): Band {
  if (m <= 0 || n <= 0) return "quiet";
  if (n * 3 >= m * 2) return "raised";
  if (n * 3 >= m) return "mixed";
  return "quiet";
}

export function read(profile: Profile): string[] {
  const lines: string[] = [];
  const size = Object.values(profile.max).reduce((sum, n) => sum + n, 0);

  if (profile.blank >= Math.max(2, Math.round(size * 0.25))) {
    lines.push(
      "Too many items were passed. A board treats a high Cannot Say count as an incomplete protocol and does not trust the rest.",
    );
  }

  if (profile.clash >= 2) {
    lines.push(
      "More than one pair contradicts. That is the inconsistency problem (the VRIN idea). Content scales are not believed until answering looks careful.",
    );
  } else if (profile.clash === 1) {
    const [a, b] = profile.clashPairs[0];
    lines.push(
      `Items ${a} and ${b} were both True. One inconsistent pair is common. It is noted, not treated as a failed protocol.`,
    );
  }

  const guard = band(profile.counts.guard, profile.max.guard);
  const rare = band(profile.counts.rare, profile.max.rare);
  const correct = band(profile.counts.correct, profile.max.correct);

  const marked = profile.trueCount + profile.falseCount;
  const style =
    size > 0 &&
    marked >= Math.max(6, Math.round(size * 0.75)) &&
    (profile.trueCount / marked >= 0.85 || profile.falseCount / marked >= 0.85);

  if (style && profile.clash < 2) {
    if (profile.trueCount / marked >= 0.85) {
      lines.push(
        "Nearly every item is True. All-true answering can lift many scales at once, so a board discounts the heights.",
      );
    } else {
      lines.push(
        "Nearly every item is False. All-false answering flattens scales that are keyed True, so a quiet profile may be a style, not stability.",
      );
    }
  }

  const contentRaised = SCALES.some(
    (scale) =>
      scale.id !== "guard" &&
      scale.id !== "rare" &&
      scale.id !== "correct" &&
      band(profile.counts[scale.id], profile.max[scale.id]) === "raised",
  );
  const validityLoud =
    guard === "raised" || rare === "raised" || correct === "raised" || profile.clash >= 2 || style;

  if (validityLoud && contentRaised) {
    lines.push(
      "Training scales did move. A board would not use them until the validity problem is settled.",
    );
  } else if (lines.length === 0 && !contentRaised && guard === "quiet" && rare === "quiet" && correct !== "raised") {
    lines.push(
      "Nothing stands out. A quiet protocol is what selection hopes to see. They still interview. A real report also has norms this practice form does not have.",
    );
  }

  return lines.slice(0, 4);
}
