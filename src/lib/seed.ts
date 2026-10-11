import { resync, slugify, type Deck, type MenuItem, DEFAULT_RULES } from "./cards";

function blankItem(id: string, number: number, title: string, org = ""): MenuItem {
  return {
    id,
    number,
    title,
    org,
    orgLocked: false,
    note: "",
    noteLocked: false,
  };
}

const MASTER_ROWS: Array<[string, string]> = [
  ["Lights", "Lights"],
  ["AI", "AI apps"],
  ["Google Apps", "Google apps"],
  ["Text Format Menu", "Text formatting"],
  ["Wispr Flow", "Wispr Flow"],
  ["System Apps", "System apps"],
  ["Utility", "Control Center"],
  ["Quick Note", "Quick note"],
  ["Obsidian Note", "Obsidian"],
  ["Drake", "Albums"],
];

const DRAKE_TITLES = [
  "ICEMAN",
  "HABIBTI (FOMO)",
  "MAID OF HONOUR",
  "$ome $exy $ongs 4 U",
  "For All The Dogs Scary Hours Edition",
  "Her Loss",
  "Honestly, Nevermind",
  "Certified Lover Boy",
  "Dark Lane Demo Tapes",
  "Scorpion",
  "More Life",
  "Views",
  "If You're Reading This It's Too Late",
  "Nothing Was the Same (Deluxe)",
  "Take Care (Deluxe Version)",
  "Thank Me Later",
  "So Far Gone",
];

export function seedDecks(): Deck[] {
  const master = resync({
    id: "master",
    name: "Master",
    prompt: "Select a shortcut to run",
    trigger: "master",
    triggerLocked: true,
    orgTemplate: "",
    autoNote: true,
    rules: DEFAULT_RULES.map((rule) => ({ ...rule })),
    items: MASTER_ROWS.map(([title, org], index) => blankItem(`master-${index + 1}`, index + 1, title, org)),
    photos: [],
  });

  const drake = resync({
    id: "drake",
    name: "Drake",
    prompt: "Drake",
    trigger: "drake",
    triggerLocked: true,
    orgTemplate: "Play {title} on Apple Music",
    autoNote: true,
    rules: DEFAULT_RULES.map((rule) => ({ ...rule })),
    items: DRAKE_TITLES.map((title, index) => blankItem(`drake-${index + 1}`, index + 1, title)),
    photos: [],
  });

  drake.items = drake.items.map((item) =>
    item.title.startsWith("For All The Dogs")
      ? { ...item, note: "for_all_the_dogs", noteLocked: true }
      : item,
  );

  return [master, drake];
}

export function emptyDeck(name = "New list"): Deck {
  const rules = DEFAULT_RULES.map((rule) => ({ ...rule }));
  return resync({
    id: `deck-${Math.random().toString(36).slice(2, 8)}`,
    name,
    prompt: name,
    trigger: slugify(name, rules),
    triggerLocked: false,
    orgTemplate: "",
    autoNote: true,
    rules,
    items: [blankItem(`item-${Math.random().toString(36).slice(2, 8)}`, 1, "")],
    photos: [],
  });
}
