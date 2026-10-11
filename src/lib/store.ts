import { create } from "zustand";
import {
  applyOrg,
  parseVcf,
  resync,
  slugify,
  uid,
  type Deck,
  type MenuItem,
  type MenuPhoto,
  type SymbolRule,
} from "./cards";
import { emptyDeck, seedDecks } from "./seed";

const STORAGE_KEY = "menu-cards-v1";

type State = {
  decks: Deck[];
  activeId: string;
  hydrated: boolean;
  hydrate: () => void;
  persist: () => void;
  setActive: (id: string) => void;
  addDeck: () => void;
  deleteDeck: (id: string) => void;
  updateDeck: (id: string, patch: Partial<Deck>) => void;
  addItem: (deckId: string) => void;
  updateItem: (deckId: string, itemId: string, patch: Partial<MenuItem>) => void;
  deleteItem: (deckId: string, itemId: string) => void;
  moveItem: (deckId: string, itemId: string, direction: -1 | 1) => void;
  setItemNumber: (deckId: string, itemId: string, number: number) => void;
  renumber: (deckId: string) => void;
  addPhotos: (deckId: string, photos: Array<Pick<MenuPhoto, "base64" | "preview">>) => void;
  replacePhoto: (deckId: string, number: number, photo: Pick<MenuPhoto, "base64" | "preview">) => void;
  setPhotoNumber: (deckId: string, photoId: string, number: number) => void;
  deletePhoto: (deckId: string, photoId: string) => void;
  addRule: (deckId: string) => void;
  updateRule: (deckId: string, ruleId: string, patch: Partial<SymbolRule>) => void;
  deleteRule: (deckId: string, ruleId: string) => void;
  unlockNote: (deckId: string, itemId: string) => void;
  unlockOrg: (deckId: string, itemId: string) => void;
  importVcf: (deckId: string, text: string) => number;
};

function writeDeck(decks: Deck[], id: string, next: Deck): Deck[] {
  return decks.map((deck) => (deck.id === id ? next : deck));
}

function withNumbersSwapped(deck: Deck, from: number, to: number): Deck {
  if (from === to) return deck;
  return {
    ...deck,
    items: deck.items.map((item) => {
      if (item.number === from) return { ...item, number: to };
      if (item.number === to) return { ...item, number: from };
      return item;
    }),
    photos: deck.photos.map((photo) => {
      if (photo.number === from) return { ...photo, number: to };
      if (photo.number === to) return { ...photo, number: from };
      return photo;
    }),
  };
}

function applyDeckPatch(deck: Deck, patch: Partial<Deck>): Deck {
  let next: Deck = { ...deck, ...patch };
  if (patch.rules || patch.orgTemplate !== undefined || patch.autoNote !== undefined) next = resync(next);
  if (patch.trigger !== undefined) {
    next = { ...next, trigger: slugify(patch.trigger, next.rules), triggerLocked: true };
  } else if (!next.triggerLocked && (patch.name !== undefined || patch.rules)) {
    next = { ...next, trigger: slugify(next.name, next.rules) };
  }
  return next;
}

export const useDecks = create<State>((set, get) => ({
  decks: seedDecks(),
  activeId: "master",
  hydrated: false,
  hydrate: () => {
    if (get().hydrated) return;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const data = JSON.parse(raw) as { decks?: Deck[]; activeId?: string };
        if (Array.isArray(data.decks) && data.decks.length > 0) {
          set({
            decks: data.decks.map((deck) => resync({ ...deck, rules: deck.rules?.length ? deck.rules : [] })),
            activeId: data.activeId || data.decks[0]?.id || "master",
            hydrated: true,
          });
          return;
        }
      }
    } catch {
      /* keep the starter lists */
    }
    set({ hydrated: true });
  },
  persist: () => {
    if (!get().hydrated) return;
    const { decks, activeId } = get();
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ decks, activeId }));
  },
  setActive: (id) => set({ activeId: id }),
  addDeck: () => {
    const deck = emptyDeck();
    set({ decks: [...get().decks, deck], activeId: deck.id });
  },
  deleteDeck: (id) => {
    const decks = get().decks.filter((deck) => deck.id !== id);
    if (decks.length === 0) return;
    set({ decks, activeId: get().activeId === id ? decks[0]!.id : get().activeId });
  },
  updateDeck: (id, patch) =>
    set({ decks: get().decks.map((deck) => (deck.id === id ? applyDeckPatch(deck, patch) : deck)) }),
  addItem: (deckId) => {
    const deck = get().decks.find((item) => item.id === deckId);
    if (!deck) return;
    const number =
      Math.max(0, ...deck.items.map((item) => item.number), ...deck.photos.map((photo) => photo.number)) + 1;
    const item: MenuItem = {
      id: uid(),
      number,
      title: "",
      org: deck.orgTemplate.trim() ? applyOrg(deck.orgTemplate, "") : "",
      orgLocked: false,
      note: "",
      noteLocked: false,
    };
    set({ decks: writeDeck(get().decks, deckId, { ...deck, items: [...deck.items, item] }) });
  },
  updateItem: (deckId, itemId, patch) =>
    set({
      decks: get().decks.map((deck) => {
        if (deck.id !== deckId) return deck;
        return {
          ...deck,
          items: deck.items.map((item) => {
            if (item.id !== itemId) return item;
            const next = { ...item, ...patch };
            if (patch.title !== undefined) {
              if (!next.noteLocked && deck.autoNote) next.note = slugify(next.title, deck.rules);
              if (!next.orgLocked && deck.orgTemplate.trim()) next.org = applyOrg(deck.orgTemplate, next.title);
            }
            if (patch.note !== undefined && patch.noteLocked === undefined) next.noteLocked = true;
            if (patch.org !== undefined && patch.orgLocked === undefined && deck.orgTemplate.trim()) {
              next.orgLocked = true;
            }
            return next;
          }),
        };
      }),
    }),
  deleteItem: (deckId, itemId) =>
    set({
      decks: get().decks.map((deck) =>
        deck.id === deckId ? { ...deck, items: deck.items.filter((item) => item.id !== itemId) } : deck,
      ),
    }),
  moveItem: (deckId, itemId, direction) =>
    set({
      decks: get().decks.map((deck) => {
        if (deck.id !== deckId) return deck;
        const sorted = [...deck.items].sort((a, b) => a.number - b.number);
        const index = sorted.findIndex((item) => item.id === itemId);
        const neighbor = sorted[index + direction];
        const current = sorted[index];
        if (!current || !neighbor) return deck;
        return withNumbersSwapped(deck, current.number, neighbor.number);
      }),
    }),
  setItemNumber: (deckId, itemId, number) =>
    set({
      decks: get().decks.map((deck) => {
        if (deck.id !== deckId) return deck;
        const item = deck.items.find((row) => row.id === itemId);
        if (!item) return deck;
        const next = Math.max(1, Math.round(number) || item.number);
        return withNumbersSwapped(deck, item.number, next);
      }),
    }),
  renumber: (deckId) =>
    set({
      decks: get().decks.map((deck) => {
        if (deck.id !== deckId) return deck;
        const items = [...deck.items].sort((a, b) => a.number - b.number || a.title.localeCompare(b.title));
        const map = new Map(items.map((item, index) => [item.id, index + 1]));
        const numberMap = new Map(items.map((item, index) => [item.number, index + 1]));
        return {
          ...deck,
          items: deck.items.map((item) => ({ ...item, number: map.get(item.id) ?? item.number })),
          photos: deck.photos.map((photo) => ({ ...photo, number: numberMap.get(photo.number) ?? photo.number })),
        };
      }),
    }),
  addPhotos: (deckId, incoming) =>
    set({
      decks: get().decks.map((deck) => {
        if (deck.id !== deckId) return deck;
        const taken = new Set(deck.photos.map((photo) => photo.number));
        const open = [...deck.items]
          .sort((a, b) => a.number - b.number)
          .map((item) => item.number)
          .filter((number) => !taken.has(number));
        let extra = Math.max(0, ...deck.items.map((item) => item.number), ...deck.photos.map((photo) => photo.number));
        const photos = [...deck.photos];
        for (const shot of incoming) {
          const number = open.length > 0 ? open.shift()! : ++extra;
          photos.push({ id: uid(), number, base64: shot.base64, preview: shot.preview });
        }
        return { ...deck, photos };
      }),
    }),
  replacePhoto: (deckId, number, photo) =>
    set({
      decks: get().decks.map((deck) => {
        if (deck.id !== deckId) return deck;
        return {
          ...deck,
          photos: [
            ...deck.photos.filter((item) => item.number !== number),
            { id: uid(), number, base64: photo.base64, preview: photo.preview },
          ],
        };
      }),
    }),
  setPhotoNumber: (deckId, photoId, number) =>
    set({
      decks: get().decks.map((deck) => {
        if (deck.id !== deckId) return deck;
        const photo = deck.photos.find((item) => item.id === photoId);
        if (!photo) return deck;
        const next = Math.max(1, Math.round(number) || photo.number);
        return {
          ...deck,
          photos: deck.photos.map((item) => {
            if (item.id === photoId) return { ...item, number: next };
            if (item.number === next) return { ...item, number: photo.number };
            return item;
          }),
        };
      }),
    }),
  deletePhoto: (deckId, photoId) =>
    set({
      decks: get().decks.map((deck) =>
        deck.id === deckId ? { ...deck, photos: deck.photos.filter((photo) => photo.id !== photoId) } : deck,
      ),
    }),
  addRule: (deckId) =>
    set({
      decks: get().decks.map((deck) =>
        deck.id === deckId ? resync({ ...deck, rules: [...deck.rules, { id: uid(), from: "", to: "" }] }) : deck,
      ),
    }),
  updateRule: (deckId, ruleId, patch) =>
    set({
      decks: get().decks.map((deck) => {
        if (deck.id !== deckId) return deck;
        return resync({
          ...deck,
          rules: deck.rules.map((rule) => (rule.id === ruleId ? { ...rule, ...patch } : rule)),
        });
      }),
    }),
  deleteRule: (deckId, ruleId) =>
    set({
      decks: get().decks.map((deck) =>
        deck.id === deckId ? resync({ ...deck, rules: deck.rules.filter((rule) => rule.id !== ruleId) }) : deck,
      ),
    }),
  unlockNote: (deckId, itemId) =>
    set({
      decks: get().decks.map((deck) => {
        if (deck.id !== deckId) return deck;
        return resync({
          ...deck,
          items: deck.items.map((item) => (item.id === itemId ? { ...item, noteLocked: false } : item)),
        });
      }),
    }),
  unlockOrg: (deckId, itemId) =>
    set({
      decks: get().decks.map((deck) => {
        if (deck.id !== deckId) return deck;
        return resync({
          ...deck,
          items: deck.items.map((item) => (item.id === itemId ? { ...item, orgLocked: false } : item)),
        });
      }),
    }),
  importVcf: (deckId, text) => {
    const parsed = parseVcf(text);
    if (parsed.length === 0) return 0;
    set({
      decks: get().decks.map((deck) => {
        if (deck.id !== deckId) return deck;
        const items: MenuItem[] = parsed.map((card, index) => ({
          id: uid(),
          number: index + 1,
          title: card.title,
          org: card.org,
          orgLocked: true,
          note: card.note || slugify(card.title, deck.rules),
          noteLocked: true,
        }));
        const photos: MenuPhoto[] = parsed.flatMap((card, index) => {
          if (!card.photo || card.photo.length < 400) return [];
          const mime = card.photo.startsWith("/9j/") ? "image/jpeg" : "image/png";
          return [
            {
              id: uid(),
              number: index + 1,
              base64: card.photo,
              preview: `data:${mime};base64,${card.photo}`,
            },
          ];
        });
        return { ...deck, items, photos };
      }),
    });
    return parsed.length;
  },
}));
