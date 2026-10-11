export type SymbolRule = { id: string; from: string; to: string };

export type MenuItem = {
  id: string;
  number: number;
  title: string;
  org: string;
  orgLocked: boolean;
  note: string;
  noteLocked: boolean;
};

export type MenuPhoto = {
  id: string;
  number: number;
  base64: string;
  preview: string;
};

export type Deck = {
  id: string;
  name: string;
  prompt: string;
  trigger: string;
  triggerLocked: boolean;
  orgTemplate: string;
  autoNote: boolean;
  rules: SymbolRule[];
  items: MenuItem[];
  photos: MenuPhoto[];
};

export const DEFAULT_RULES: SymbolRule[] = [
  { id: "dollar", from: "$", to: "s" },
  { id: "apos", from: "'", to: "" },
  { id: "curly", from: "’", to: "" },
  { id: "open", from: "(", to: "" },
  { id: "close", from: ")", to: "" },
  { id: "comma", from: ",", to: "" },
];

const SWATCHES = [
  "#c4552a",
  "#d4a017",
  "#3f6f4b",
  "#2f5f78",
  "#8d3d55",
  "#5c5278",
  "#b85a2a",
  "#6d7a3e",
  "#3c4e72",
  "#a3473a",
  "#7d5c3c",
  "#2f6d66",
  "#8a4568",
  "#4e6844",
  "#6e4e32",
  "#3a5678",
  "#9a4a32",
];

export function uid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return Math.random().toString(36).slice(2, 10);
}

export function slugify(title: string, rules: SymbolRule[]): string {
  let s = title;
  const ordered = [...rules]
    .filter((rule) => rule.from.length > 0)
    .sort((a, b) => b.from.length - a.from.length);
  for (const rule of ordered) s = s.split(rule.from).join(rule.to);
  s = s.toLowerCase();
  s = s.replace(/\s+/g, "_");
  s = s.replace(/[^a-z0-9_]/g, "");
  s = s.replace(/_+/g, "_").replace(/^_|_$/g, "");
  return s;
}

export function applyOrg(template: string, title: string): string {
  return template.replaceAll("{title}", title);
}

export function resync(deck: Deck): Deck {
  return {
    ...deck,
    items: deck.items.map((item) => ({
      ...item,
      note: item.noteLocked || !deck.autoNote ? item.note : slugify(item.title, deck.rules),
      org: item.orgLocked
        ? item.org
        : deck.orgTemplate.trim()
          ? applyOrg(deck.orgTemplate, item.title)
          : item.org,
    })),
  };
}

export function noteProblem(note: string): string | null {
  if (!note) return "This row has no note, so an If cannot see it.";
  if (!/^[a-z0-9_]+$/.test(note)) return "Notes stay lowercase, with underscores instead of spaces.";
  return null;
}

export function escapeVCard(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/\r?\n/g, "\\n").replace(/;/g, "\\;");
}

export function swatchHex(number: number): string {
  const index = ((number - 1) % SWATCHES.length + SWATCHES.length) % SWATCHES.length;
  return SWATCHES[index] ?? SWATCHES[0];
}

function crc32(data: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    c ^= data[i] ?? 0;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  return (c ^ 0xffffffff) >>> 0;
}

function concat(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

function chunk(type: string, data: Uint8Array): Uint8Array {
  const typeBytes = new Uint8Array([...type].map((char) => char.charCodeAt(0)));
  const length = new Uint8Array(4);
  new DataView(length.buffer).setUint32(0, data.length);
  const body = concat([typeBytes, data]);
  const crc = new Uint8Array(4);
  new DataView(crc.buffer).setUint32(0, crc32(body));
  return concat([length, body, crc]);
}

function storedZlib(raw: Uint8Array): Uint8Array {
  const bytes = [0x78, 0x01, 0x01, raw.length & 0xff, (raw.length >> 8) & 0xff];
  const nlen = (~raw.length) & 0xffff;
  bytes.push(nlen & 0xff, (nlen >> 8) & 0xff);
  for (const byte of raw) bytes.push(byte);
  let a = 1;
  let b = 0;
  for (const byte of raw) {
    a = (a + byte) % 65521;
    b = (b + a) % 65521;
  }
  const adler = ((b << 16) | a) >>> 0;
  bytes.push((adler >>> 24) & 0xff, (adler >>> 16) & 0xff, (adler >>> 8) & 0xff, adler & 0xff);
  return Uint8Array.from(bytes);
}

export function png1x1Base64(hex: string): string {
  const clean = hex.replace("#", "");
  const r = Number.parseInt(clean.slice(0, 2), 16);
  const g = Number.parseInt(clean.slice(2, 4), 16);
  const b = Number.parseInt(clean.slice(4, 6), 16);
  const sig = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = new Uint8Array([0, 0, 0, 1, 0, 0, 0, 1, 8, 2, 0, 0, 0]);
  const png = concat([
    sig,
    chunk("IHDR", ihdr),
    chunk("IDAT", storedZlib(new Uint8Array([0, r, g, b]))),
    chunk("IEND", new Uint8Array()),
  ]);
  let binary = "";
  for (const byte of png) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export function swatchPreview(number: number): string {
  return `data:image/png;base64,${png1x1Base64(swatchHex(number))}`;
}

function photoFor(deck: Deck, number: number): string {
  const photo = deck.photos.find((item) => item.number === number);
  const raw = photo?.base64 || png1x1Base64(swatchHex(number));
  return raw.replace(/\s/g, "");
}

export function cardRows(deck: Deck): MenuItem[] {
  return [...deck.items]
    .filter((item) => item.title.trim() || item.note.trim())
    .sort((a, b) => a.number - b.number || a.title.localeCompare(b.title));
}

export function buildVcf(deck: Deck, opts?: { photos?: boolean }): string {
  const showPhotos = opts?.photos !== false;
  const blocks = cardRows(deck).map((item) => {
    const photo = showPhotos ? photoFor(deck, item.number) : "…";
    return [
      "BEGIN:VCARD",
      "VERSION:3.0",
      `N;CHARSET=UTF-8:${escapeVCard(item.title)};;;;`,
      `ORG:${escapeVCard(item.org)}`,
      `NOTE:${escapeVCard(item.note)}`,
      `PHOTO;ENCODING=b:${photo}`,
      "END:VCARD",
    ].join("\n");
  });
  return blocks.join("\n");
}

export function fileNameFor(deck: Deck): string {
  return `${slugify(deck.name, deck.rules) || "menu"}.vcf`;
}

export type ParsedCard = { title: string; org: string; note: string; photo: string };

function unescapeVCard(value: string): string {
  return value.replace(/\\n/g, "\n").replace(/\\;/g, ";").replace(/\\\\/g, "\\");
}

export function parseVcf(raw: string): ParsedCard[] {
  const unfolded = raw.replace(/\r\n/g, "\n").replace(/\n[ \t]/g, "");
  return unfolded
    .split(/BEGIN:VCARD/i)
    .slice(1)
    .map((block) => {
      const body = block.split(/END:VCARD/i)[0] ?? "";
      let title = "";
      let org = "";
      let note = "";
      let photo = "";
      for (const line of body.split("\n")) {
        const colon = line.indexOf(":");
        if (colon < 0) continue;
        const key = line.slice(0, colon);
        const value = line.slice(colon + 1);
        if (/^N(;|$)/i.test(key)) title = unescapeVCard(value.split(";")[0] ?? "");
        else if (/^ORG/i.test(key)) org = unescapeVCard(value).replace(/;+$/g, "");
        else if (/^NOTE/i.test(key)) note = unescapeVCard(value).trim();
        else if (/^PHOTO/i.test(key)) photo = value.replace(/\s/g, "");
      }
      return { title, org, note, photo };
    })
    .filter((card) => card.title || card.note);
}

export function duplicateNotes(items: MenuItem[]): Set<string> {
  const counts = new Map<string, number>();
  for (const item of items) {
    if (!item.note) continue;
    counts.set(item.note, (counts.get(item.note) ?? 0) + 1);
  }
  return new Set([...counts].filter(([, count]) => count > 1).map(([note]) => note));
}

export function linkedDeck(decks: Deck[], item: MenuItem, currentId: string): Deck | undefined {
  if (!item.note) return undefined;
  return decks.find((deck) => deck.id !== currentId && deck.trigger === item.note);
}
