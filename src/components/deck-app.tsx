import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Copy,
  Download,
  ImagePlus,
  Plus,
  Trash2,
} from "lucide-react";
import {
  buildVcf,
  cardRows,
  duplicateNotes,
  fileNameFor,
  linkedDeck,
  noteProblem,
  swatchPreview,
  type Deck,
  type MenuItem,
} from "@/lib/cards";
import { squashFiles } from "@/lib/images";
import { useDecks } from "@/lib/store";

export function DeckApp() {
  const hydrate = useDecks((state) => state.hydrate);
  const persist = useDecks((state) => state.persist);
  const hydrated = useDecks((state) => state.hydrated);
  const decks = useDecks((state) => state.decks);
  const activeId = useDecks((state) => state.activeId);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (hydrated) persist();
  }, [hydrated, decks, activeId, persist]);

  const deck = decks.find((item) => item.id === activeId) ?? decks[0];
  if (!deck) return null;

  return (
    <main className="mx-auto min-h-dvh max-w-6xl px-4 pt-6 pb-28 lg:px-8 lg:pb-10">
      <header className="flex items-end justify-between gap-4">
        <div>
          <p className="text-sm text-faint">Shortcut lists</p>
          <h1 className="text-3xl font-semibold tracking-tight">Menu Cards</h1>
        </div>
      </header>
      <DeckSwitcher />
      <div className="mt-6 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <Editor deck={deck} />
        <Preview deck={deck} />
      </div>
      <CopyDock deck={deck} />
    </main>
  );
}

function DeckSwitcher() {
  const decks = useDecks((state) => state.decks);
  const activeId = useDecks((state) => state.activeId);
  const setActive = useDecks((state) => state.setActive);
  const addDeck = useDecks((state) => state.addDeck);

  return (
    <div className="mt-5 flex gap-2 overflow-x-auto pb-1">
      {decks.map((deck) => {
        const active = deck.id === activeId;
        return (
          <button
            key={deck.id}
            type="button"
            onClick={() => setActive(deck.id)}
            className={
              active
                ? "min-h-11 shrink-0 rounded-full bg-accent px-4 text-sm font-medium text-ink"
                : "min-h-11 shrink-0 rounded-full bg-surface px-4 text-sm text-fg"
            }
          >
            {deck.name || "Untitled"}
          </button>
        );
      })}
      <button
        type="button"
        onClick={addDeck}
        className="flex min-h-11 shrink-0 items-center gap-1 rounded-full bg-raised px-4 text-sm text-fg"
      >
        <Plus className="size-4" />
        List
      </button>
    </div>
  );
}

function Editor({ deck }: { deck: Deck }) {
  const updateDeck = useDecks((state) => state.updateDeck);
  const deleteDeck = useDecks((state) => state.deleteDeck);
  const decks = useDecks((state) => state.decks);

  return (
    <div className="order-2 flex min-w-0 flex-col gap-6 lg:order-1">
      <section className="rounded-3xl bg-surface p-4">
        <div className="grid gap-3">
          <label className="grid gap-1">
            <span className="text-sm text-muted">List name</span>
            <input
              className="field"
              value={deck.name}
              onChange={(event) => updateDeck(deck.id, { name: event.target.value })}
            />
          </label>
          <label className="grid gap-1">
            <span className="text-sm text-muted">Menu title</span>
            <input
              className="field"
              value={deck.prompt}
              onChange={(event) => updateDeck(deck.id, { prompt: event.target.value })}
            />
          </label>
          <label className="grid gap-1">
            <span className="text-sm text-muted">Opens when the note is</span>
            <input
              className="field font-mono"
              spellCheck={false}
              value={deck.trigger}
              onChange={(event) =>
                updateDeck(deck.id, { trigger: event.target.value, triggerLocked: true })
              }
            />
          </label>
          <label className="grid gap-1">
            <span className="text-sm text-muted">Description template</span>
            <input
              className="field"
              placeholder="Play {title} on Apple Music"
              value={deck.orgTemplate}
              onChange={(event) => updateDeck(deck.id, { orgTemplate: event.target.value })}
            />
            <span className="text-sm text-faint">{"{title}"} is replaced with each row.</span>
          </label>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm text-fg">Notes from titles</p>
              <p className="text-sm text-faint">Lowercase, spaces become underscores.</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={deck.autoNote}
              onClick={() => updateDeck(deck.id, { autoNote: !deck.autoNote })}
              className={
                deck.autoNote
                  ? "min-h-11 rounded-full bg-accent px-4 text-sm font-medium text-ink"
                  : "min-h-11 rounded-full bg-raised px-4 text-sm text-muted"
              }
            >
              {deck.autoNote ? "On" : "Off"}
            </button>
          </div>
        </div>
        {decks.length > 1 ? (
          <button
            type="button"
            className="mt-4 text-sm text-faint"
            onClick={() => {
              if (confirm(`Delete ${deck.name || "this list"}?`)) deleteDeck(deck.id);
            }}
          >
            Delete this list
          </button>
        ) : null}
      </section>
      <ItemList deck={deck} />
      <PhotoTray deck={deck} />
      <SymbolTable deck={deck} />
      <ImportBox deck={deck} />
    </div>
  );
}

function ItemList({ deck }: { deck: Deck }) {
  const addItem = useDecks((state) => state.addItem);
  const renumber = useDecks((state) => state.renumber);
  const decks = useDecks((state) => state.decks);
  const rows = [...deck.items].sort((a, b) => a.number - b.number || a.title.localeCompare(b.title));
  const dupes = useMemo(() => duplicateNotes(deck.items), [deck.items]);
  const numbers = rows.map((row) => row.number);
  const messy = new Set(numbers).size !== numbers.length || numbers.some((number, index) => number !== index + 1);

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-medium">Rows</h2>
        <div className="flex gap-2">
          {messy ? (
            <button type="button" className="min-h-11 rounded-full bg-raised px-3 text-sm" onClick={() => renumber(deck.id)}>
              Renumber
            </button>
          ) : null}
          <button
            type="button"
            className="flex min-h-11 items-center gap-1 rounded-full bg-raised px-3 text-sm"
            onClick={() => addItem(deck.id)}
          >
            <Plus className="size-4" />
            Row
          </button>
        </div>
      </div>
      {rows.map((item, index) => (
        <ItemRow
          key={item.id}
          deck={deck}
          item={item}
          first={index === 0}
          last={index === rows.length - 1}
          duplicate={dupes.has(item.note)}
          opens={linkedDeck(decks, item, deck.id)}
        />
      ))}
    </section>
  );
}

function ItemRow({
  deck,
  item,
  first,
  last,
  duplicate,
  opens,
}: {
  deck: Deck;
  item: MenuItem;
  first: boolean;
  last: boolean;
  duplicate: boolean;
  opens: Deck | undefined;
}) {
  const updateItem = useDecks((state) => state.updateItem);
  const deleteItem = useDecks((state) => state.deleteItem);
  const moveItem = useDecks((state) => state.moveItem);
  const setItemNumber = useDecks((state) => state.setItemNumber);
  const unlockNote = useDecks((state) => state.unlockNote);
  const unlockOrg = useDecks((state) => state.unlockOrg);
  const replacePhoto = useDecks((state) => state.replacePhoto);
  const setActive = useDecks((state) => state.setActive);
  const photo = deck.photos.find((shot) => shot.number === item.number);
  const problem = noteProblem(item.note);
  const [busy, setBusy] = useState(false);

  return (
    <article className="rounded-3xl bg-surface p-3">
      <div className="flex gap-3">
        <div className="flex w-14 shrink-0 flex-col items-center gap-2">
          <NumberBox
            value={item.number}
            label={`Number for ${item.title || "row"}`}
            onCommit={(number) => setItemNumber(deck.id, item.id, number)}
          />
          <label className="relative size-12 overflow-hidden rounded-xl bg-raised">
            <img
              src={photo?.preview || swatchPreview(item.number)}
              alt=""
              className="size-full object-cover"
            />
            <input
              className="sr-only"
              type="file"
              accept="image/*"
              aria-label={`Cover for ${item.title || item.number}`}
              onChange={async (event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (!file) return;
                setBusy(true);
                const { photos } = await squashFiles([file]);
                const shot = photos[0];
                if (shot) replacePhoto(deck.id, item.number, shot);
                setBusy(false);
              }}
            />
            {busy ? <span className="absolute inset-0 bg-bg/70" /> : null}
          </label>
        </div>
        <div className="grid min-w-0 flex-1 gap-2">
          <input
            className="field"
            placeholder="Title"
            aria-label="Title"
            value={item.title}
            onChange={(event) => updateItem(deck.id, item.id, { title: event.target.value })}
          />
          <div className="flex gap-2">
            <input
              className="field"
              placeholder="Description"
              aria-label="Description"
              value={item.org}
              onChange={(event) => updateItem(deck.id, item.id, { org: event.target.value })}
            />
            {item.orgLocked ? (
              <button type="button" className="min-h-11 shrink-0 text-sm text-faint" onClick={() => unlockOrg(deck.id, item.id)}>
                Auto
              </button>
            ) : null}
          </div>
          <div className="flex gap-2">
            <input
              className={
                problem || duplicate
                  ? "field border-warn font-mono text-warn"
                  : "field font-mono"
              }
              spellCheck={false}
              placeholder="note"
              aria-label="Note"
              value={item.note}
              onChange={(event) => updateItem(deck.id, item.id, { note: event.target.value })}
            />
            {item.noteLocked ? (
              <button type="button" className="min-h-11 shrink-0 text-sm text-faint" onClick={() => unlockNote(deck.id, item.id)}>
                Auto
              </button>
            ) : null}
          </div>
          {duplicate ? <p className="text-sm text-warn">Another row uses this note.</p> : null}
          {problem && item.title.trim() ? <p className="text-sm text-warn">{problem}</p> : null}
          {opens ? (
            <button
              type="button"
              className="flex min-h-11 items-center gap-1 text-sm text-accent"
              onClick={() => setActive(opens.id)}
            >
              Opens {opens.name}
              <ChevronRight className="size-4" />
            </button>
          ) : null}
        </div>
      </div>
      <div className="mt-2 flex justify-end gap-1">
        <IconButton label="Move up" disabled={first} onClick={() => moveItem(deck.id, item.id, -1)}>
          <ChevronUp className="size-4" />
        </IconButton>
        <IconButton label="Move down" disabled={last} onClick={() => moveItem(deck.id, item.id, 1)}>
          <ChevronDown className="size-4" />
        </IconButton>
        <IconButton label="Delete row" onClick={() => deleteItem(deck.id, item.id)}>
          <Trash2 className="size-4" />
        </IconButton>
      </div>
    </article>
  );
}

function PhotoTray({ deck }: { deck: Deck }) {
  const addPhotos = useDecks((state) => state.addPhotos);
  const deletePhoto = useDecks((state) => state.deletePhoto);
  const setPhotoNumber = useDecks((state) => state.setPhotoNumber);
  const [message, setMessage] = useState("");
  const photos = [...deck.photos].sort((a, b) => a.number - b.number);
  const matched = new Set(deck.items.map((item) => item.number));

  return (
    <section className="flex flex-col gap-3">
      <div>
        <h2 className="text-lg font-medium">Covers</h2>
        <p className="text-sm text-faint">Photo 1 fills row 1. Tap a row’s cover to replace just that one.</p>
      </div>
      <label className="flex cursor-pointer flex-col items-center gap-2 rounded-3xl border border-dashed border-line bg-surface px-4 py-6 text-center">
        <ImagePlus className="size-5 text-accent" />
        <span className="text-sm">Add covers</span>
        <input
          className="sr-only"
          type="file"
          accept="image/*"
          multiple
          onChange={async (event) => {
            const files = [...(event.target.files ?? [])];
            event.target.value = "";
            if (files.length === 0) return;
            setMessage("Reading photos…");
            const { photos: shots, failed } = await squashFiles(files);
            if (shots.length) addPhotos(deck.id, shots);
            setMessage(
              failed.length
                ? `Skipped ${failed.length}. Use a JPEG or PNG.`
                : shots.length
                  ? `Added ${shots.length}.`
                  : "No photos added.",
            );
          }}
        />
      </label>
      {message ? <p className="text-sm text-muted">{message}</p> : null}
      {photos.length > 0 ? (
        <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4">
          {photos.map((photo) => (
            <li key={photo.id} className="rounded-2xl bg-surface p-2">
              <img src={photo.preview} alt="" className="aspect-square w-full rounded-xl object-cover" />
              <div className="mt-2 flex items-center justify-between gap-2">
                <NumberBox
                  value={photo.number}
                  label="Photo number"
                  onCommit={(number) => setPhotoNumber(deck.id, photo.id, number)}
                />
                <button
                  type="button"
                  className="min-h-11 min-w-11 text-faint"
                  aria-label="Remove photo"
                  onClick={() => deletePhoto(deck.id, photo.id)}
                >
                  <Trash2 className="mx-auto size-4" />
                </button>
              </div>
              {!matched.has(photo.number) ? <p className="text-sm text-warn">No row</p> : null}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

function SymbolTable({ deck }: { deck: Deck }) {
  const addRule = useDecks((state) => state.addRule);
  const updateRule = useDecks((state) => state.updateRule);
  const deleteRule = useDecks((state) => state.deleteRule);

  return (
    <section className="rounded-3xl bg-surface p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-medium">Symbols</h2>
        <button type="button" className="min-h-11 text-sm text-accent" onClick={() => addRule(deck.id)}>
          Add
        </button>
      </div>
      <p className="mt-1 text-sm text-faint">
        Replaced first. Then lowercase. Leftover spaces become underscores. Anything else is dropped.
      </p>
      <ul className="mt-3 flex flex-col gap-2">
        {deck.rules.map((rule) => (
          <li key={rule.id} className="flex items-center gap-2">
            <input
              className="field w-20 text-center font-mono"
              aria-label="Symbol"
              value={rule.from}
              onChange={(event) => updateRule(deck.id, rule.id, { from: event.target.value })}
            />
            <span className="shrink-0 text-sm text-faint">becomes</span>
            <input
              className="field font-mono"
              aria-label="Replacement"
              placeholder="drop"
              value={rule.to}
              onChange={(event) => updateRule(deck.id, rule.id, { to: event.target.value })}
            />
            <button
              type="button"
              className="min-h-11 min-w-11 shrink-0 text-faint"
              aria-label="Remove symbol"
              onClick={() => deleteRule(deck.id, rule.id)}
            >
              <Trash2 className="mx-auto size-4" />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function ImportBox({ deck }: { deck: Deck }) {
  const importVcf = useDecks((state) => state.importVcf);
  const [text, setText] = useState("");
  const [message, setMessage] = useState("");

  return (
    <section className="rounded-3xl bg-surface p-4">
      <h2 className="text-lg font-medium">Paste a card</h2>
      <p className="mt-1 text-sm text-faint">Replaces the rows in this list. Notes stay exactly as pasted.</p>
      <textarea
        className="field mt-3 min-h-32 font-mono"
        spellCheck={false}
        value={text}
        placeholder="BEGIN:VCARD"
        onChange={(event) => setText(event.target.value)}
      />
      <button
        type="button"
        className="mt-3 min-h-11 rounded-full bg-raised px-4 text-sm"
        onClick={() => {
          const count = importVcf(deck.id, text);
          setMessage(count ? `Imported ${count} rows.` : "No cards found in that text.");
          if (count) setText("");
        }}
      >
        Replace this list
      </button>
      {message ? <p className="mt-2 text-sm text-muted">{message}</p> : null}
    </section>
  );
}

function Preview({ deck }: { deck: Deck }) {
  const decks = useDecks((state) => state.setActive);
  const all = useDecks((state) => state.decks);
  const rows = cardRows(deck);
  const setActive = decks;

  return (
    <aside className="order-1 lg:sticky lg:top-4 lg:order-2">
      <div className="rounded-3xl bg-surface p-3">
        <p className="px-2 pt-2 pb-3 text-lg font-medium">{deck.prompt || deck.name}</p>
        <ul className="overflow-hidden rounded-2xl bg-bg">
          {rows.length === 0 ? (
            <li className="px-4 py-6 text-sm text-faint">Add a title to see the menu.</li>
          ) : (
            rows.map((item) => {
              const photo = deck.photos.find((shot) => shot.number === item.number);
              const opens = linkedDeck(all, item, deck.id);
              const inner = (
                <>
                  <img
                    src={photo?.preview || swatchPreview(item.number)}
                    alt=""
                    className="size-12 shrink-0 rounded-xl object-cover"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{item.title || "Untitled"}</span>
                    {item.org ? <span className="block truncate text-sm text-muted">{item.org}</span> : null}
                  </span>
                  {opens ? <ChevronRight className="size-4 shrink-0 text-faint" /> : null}
                </>
              );
              return (
                <li key={item.id} className="border-b border-line last:border-b-0">
                  {opens ? (
                    <button
                      type="button"
                      className="flex min-h-16 w-full items-center gap-3 px-3 py-2 text-left"
                      onClick={() => setActive(opens.id)}
                    >
                      {inner}
                    </button>
                  ) : (
                    <div className="flex min-h-16 items-center gap-3 px-3 py-2">{inner}</div>
                  )}
                </li>
              );
            })
          )}
        </ul>
      </div>
      <p className="mt-3 text-sm text-muted">
        Paste into a Text action, set the name to {fileNameFor(deck)}, choose from that file as a Contact, then Get Notes.
        {deck.trigger ? ` Other lists open this one when the note is ${deck.trigger}.` : ""}
      </p>
      <div className="mt-3 hidden gap-2 lg:flex">
        <CopyButtons deck={deck} />
      </div>
      <CardText deck={deck} />
    </aside>
  );
}

function CardText({ deck }: { deck: Deck }) {
  const preview = useMemo(() => buildVcf(deck, { photos: false }), [deck]);
  if (!preview) return null;
  return (
    <details className="mt-3">
      <summary className="min-h-11 cursor-pointer text-sm text-faint">Card text</summary>
      <pre className="mt-2 max-h-64 overflow-auto rounded-2xl bg-surface p-3 font-mono text-xs break-all whitespace-pre-wrap text-muted">
        {preview}
      </pre>
    </details>
  );
}

function CopyDock({ deck }: { deck: Deck }) {
  return (
    <div className="dock fixed inset-x-0 bottom-0 z-10 border-t border-line bg-bg px-4 pt-3 lg:hidden">
      <div className="mx-auto flex max-w-6xl gap-2">
        <CopyButtons deck={deck} />
      </div>
    </div>
  );
}

function CopyButtons({ deck }: { deck: Deck }) {
  const [copied, setCopied] = useState(false);
  const count = cardRows(deck).length;

  async function copy() {
    const text = buildVcf(deck);
    const ok = await copyText(text);
    if (!ok) return;
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <>
      <button
        type="button"
        disabled={count === 0}
        onClick={copy}
        className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-2xl bg-accent px-4 font-medium text-ink disabled:opacity-40"
      >
        <Copy className="size-4" />
        {copied ? "Copied" : "Copy card"}
      </button>
      <button
        type="button"
        disabled={count === 0}
        onClick={() => download(fileNameFor(deck), buildVcf(deck))}
        className="flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-raised px-4 text-fg disabled:opacity-40"
      >
        <Download className="size-4" />
        <span className="sr-only sm:not-sr-only">Download</span>
      </button>
    </>
  );
}

function NumberBox({
  value,
  label,
  onCommit,
}: {
  value: number;
  label: string;
  onCommit: (number: number) => void;
}) {
  const [text, setText] = useState(String(value));
  useEffect(() => setText(String(value)), [value]);
  return (
    <input
      aria-label={label}
      inputMode="numeric"
      className="field w-14 px-0 text-center font-mono"
      value={text}
      onChange={(event) => setText(event.target.value.replace(/[^\d]/g, ""))}
      onBlur={() => {
        const number = Number.parseInt(text, 10);
        if (!number || number < 1) setText(String(value));
        else onCommit(number);
      }}
    />
  );
}

function IconButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="flex size-11 items-center justify-center rounded-full text-muted disabled:opacity-30"
    >
      {children}
    </button>
  );
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.left = "-9999px";
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    area.remove();
    return ok;
  }
}

function download(filename: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/vcard" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
