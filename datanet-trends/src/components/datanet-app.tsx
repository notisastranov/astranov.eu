import { useEffect, useMemo, useState } from "react";
import { useNavigate, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Download, LayoutGrid, Plus, RefreshCw, Search, Table2, Trash2 } from "lucide-react";
import { UserButton } from "@/lib/auth/gates";
import {
  adoptListing,
  copySharedMenu,
  createMenuRow,
  deleteMenuRow,
  refreshShopFacts,
  researchEfood,
  saveMenuRow,
} from "@/lib/datanet/fns";
import { downloadBlob, toCsv, toOds } from "@/lib/datanet/spreadsheet";
import type { Board, ListingHit, MediaKind, MenuRow } from "@/lib/datanet/types";

type View = "sheet" | "cards";
type Stock = "all" | "in" | "out";

function euro(value: number | null): string {
  if (value == null) return "—";
  return new Intl.NumberFormat("el-GR", { style: "currency", currency: "EUR" }).format(value);
}

function readFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("Could not read that file."));
    reader.readAsDataURL(file);
  });
}

function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      const scale = Math.min(1, 720 / Math.max(image.width, image.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        URL.revokeObjectURL(url);
        reject(new Error("Could not prepare that photo."));
        return;
      }
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", 0.72));
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read that photo."));
    };
    image.src = url;
  });
}

function Field({
  label,
  value,
  onCommit,
  multiline,
  locked,
}: {
  label: string;
  value: string;
  onCommit: (value: string) => void;
  multiline?: boolean;
  locked?: boolean;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  if (locked) return <p className="max-w-xs px-2 py-2 text-sm">{value || "—"}</p>;
  const className =
    "w-full min-w-40 rounded-md bg-transparent px-2 py-2 text-sm outline-none focus:bg-brass-soft";
  const commit = () => {
    if (draft !== value) onCommit(draft);
  };
  if (multiline) {
    return (
      <textarea
        aria-label={label}
        className={`${className} min-h-16 min-w-56`}
        value={draft}
        rows={3}
        suppressHydrationWarning
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
      />
    );
  }
  return (
    <input
      aria-label={label}
      className={className}
      value={draft}
      suppressHydrationWarning
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
    />
  );
}

export function DataNetApp({ board }: { board: Board }) {
  const router = useRouter();
  const navigate = useNavigate();
  const save = useServerFn(saveMenuRow);
  const add = useServerFn(createMenuRow);
  const remove = useServerFn(deleteMenuRow);
  const research = useServerFn(researchEfood);
  const refresh = useServerFn(refreshShopFacts);
  const adopt = useServerFn(adoptListing);
  const copy = useServerFn(copySharedMenu);
  const canEdit = board.canEdit;

  const [rows, setRows] = useState(board.rows);
  const [view, setView] = useState<View>("sheet");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [stock, setStock] = useState<Stock>("all");
  const [lookup, setLookup] = useState("Ειρήνη");
  const [hits, setHits] = useState<ListingHit[]>([]);
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    setRows(board.rows);
  }, [board.rows]);

  const categories = useMemo(() => {
    const seen = new Map<string, string>();
    for (const row of rows) {
      if (row.categoryEl) seen.set(row.categoryEl, row.categoryEn);
    }
    return [...seen.entries()];
  }, [rows]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((row) => {
      if (category !== "all" && row.categoryEl !== category) return false;
      if (stock === "in" && !row.available) return false;
      if (stock === "out" && row.available) return false;
      if (!q) return true;
      const hay = `${row.nameEl} ${row.nameEn} ${row.descriptionEl} ${row.descriptionEn} ${row.categoryEl} ${row.categoryEn}`.toLowerCase();
      return hay.includes(q);
    });
  }, [rows, query, category, stock]);

  async function persist(next: MenuRow) {
    setRows((current) => current.map((row) => (row.id === next.id ? next : row)));
    try {
      await save({ data: next });
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not save that cell.");
      await router.invalidate();
    }
  }

  async function onFile(row: MenuRow, file: File) {
    try {
      let mediaUrl = "";
      let mediaKind: MediaKind = "image";
      if (file.type.startsWith("video/")) {
        if (file.size > 1_200_000) {
          setNotice("Clip is too large for a cell. Keep it under about a second or two, or paste a link.");
          return;
        }
        mediaUrl = await readFile(file);
        mediaKind = "video";
      } else if (file.type.startsWith("image/")) {
        mediaUrl = await compressImage(file);
      } else {
        setNotice("Use a photo or a short video.");
        return;
      }
      await persist({ ...row, mediaUrl, mediaKind });
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not attach that file.");
    }
  }

  async function onAdd() {
    if (!board.shop) return;
    setBusy("add");
    try {
      const sample = rows.find((row) => category === "all" || row.categoryEl === category);
      await add({
        data: {
          shopId: board.shop.id,
          categoryEl: sample?.categoryEl ?? "",
          categoryEn: sample?.categoryEn ?? "",
        },
      });
      await router.invalidate();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not add a row.");
    } finally {
      setBusy("");
    }
  }

  async function onDelete(id: string) {
    if (!window.confirm("Remove this row from the menu?")) return;
    setRows((current) => current.filter((row) => row.id !== id));
    try {
      await remove({ data: { id } });
      await router.invalidate();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not remove that row.");
      await router.invalidate();
    }
  }

  async function onResearch() {
    setBusy("search");
    setNotice("");
    try {
      const result = await research({ data: { query: lookup } });
      setHits(result.hits);
      if (result.hits.length === 0) setNotice("No Rhodes listing matched that search.");
    } catch (error) {
      setHits([]);
      setNotice(error instanceof Error ? error.message : "efood search failed.");
    } finally {
      setBusy("");
    }
  }

  async function onRefresh() {
    if (!board.shop?.efoodId) return;
    setBusy("refresh");
    setNotice("");
    try {
      const result = await refresh({ data: { efoodId: board.shop.efoodId } });
      setNotice(result.open ? "Live shop facts updated. The item catalog was not overwritten." : "Shop facts updated. efood currently marks it closed.");
      await router.invalidate();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not refresh shop facts.");
    } finally {
      setBusy("");
    }
  }

  async function onAdopt(hit: ListingHit) {
    setBusy(`open-${hit.efoodId}`);
    try {
      const result = await adopt({ data: hit });
      await navigate({ to: "/", search: { shop: result.slug } });
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not open that sheet.");
    } finally {
      setBusy("");
    }
  }

  async function onCopy() {
    if (!board.shop) return;
    setBusy("copy");
    setNotice("");
    try {
      const result = await copy({ data: { slug: board.shop.slug } });
      await navigate({ to: "/", search: { shop: result.slug } });
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not copy that menu.");
    } finally {
      setBusy("");
    }
  }

  const shop = board.shop;
  const inStock = rows.filter((row) => row.available).length;

  useEffect(() => {
    if (board.signedIn && !board.shop && board.shops[0]) {
      void navigate({ to: "/", search: { shop: board.shops[0].slug }, replace: true });
    }
  }, [board.signedIn, board.shop, board.shops, navigate]);

  return (
    <div className="min-h-screen max-w-full overflow-x-clip bg-paper text-ink">
      <header className="border-b border-line bg-sheet">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="font-display text-2xl leading-none">DataNet</p>
            <p className="mt-1 text-sm text-muted">Menu engine for SpaceNet · datanet.astranov.eu</p>
          </div>
          <UserButton />
          <label className="min-w-0 max-w-full text-sm">
            <span className="sr-only">Sheet</span>
            <select
              className="h-11 max-w-full rounded-lg border border-line bg-sheet px-3"
              value={shop?.slug ?? ""}
              onChange={(event) => navigate({ to: "/", search: { shop: event.target.value } })}
            >
              {board.shops.map((link) => (
                <option key={link.slug} value={link.slug}>
                  {link.nameEl} · {link.city} ({link.itemCount})
                </option>
              ))}
            </select>
          </label>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl grid-cols-[minmax(0,1fr)] gap-4 px-4 py-4 lg:grid-cols-[minmax(0,300px)_minmax(0,1fr)]">
        <aside className="min-w-0 space-y-4">
          {shop ? (
            <section className="overflow-hidden rounded-xl border border-line bg-sheet">
              {shop.coverUrl ? (
                <img src={shop.coverUrl} alt="" className="h-36 w-full object-cover" />
              ) : null}
              <div className="space-y-3 p-4">
                <div className="flex items-center gap-3">
                  {shop.logoUrl ? (
                    <img src={shop.logoUrl} alt="" className="h-12 w-12 rounded-lg bg-ink object-contain" />
                  ) : null}
                  <div>
                    <h1 className="font-display text-xl leading-tight">
                      {shop.nameEl}
                      <span className="text-muted"> / {shop.nameEn}</span>
                    </h1>
                    <p className="text-sm text-muted">
                      {shop.tradeEl} · {shop.tradeEn}
                    </p>
                  </div>
                </div>
                <p className="text-sm">
                  {shop.address}, {shop.neighborhood ? `${shop.neighborhood}, ` : ""}
                  {shop.city} {shop.postal}
                </p>
                <p className="text-sm text-muted">
                  {shop.cuisinesEl}
                  <br />
                  {shop.cuisinesEn}
                </p>
                <dl className="grid grid-cols-2 gap-2 text-sm">
                  <div className="rounded-lg bg-paper px-3 py-2">
                    <dt className="text-muted">Status</dt>
                    <dd className={shop.efoodId ? (shop.isOpen ? "text-good" : "text-bad") : "text-ink"}>
                      {shop.efoodId ? (shop.isOpen ? "Open on efood" : "Closed on efood") : board.role === "owner" ? "Yours to correct" : "Shared, read only"}
                    </dd>
                  </div>
                  <div className="rounded-lg bg-paper px-3 py-2">
                    <dt className="text-muted">Rating</dt>
                    <dd>{shop.rating ?? "—"} · {shop.ratingCount ?? 0}</dd>
                  </div>
                  <div className="rounded-lg bg-paper px-3 py-2">
                    <dt className="text-muted">Hours</dt>
                    <dd>{shop.hoursEl || shop.hours}</dd>
                  </div>
                  <div className="rounded-lg bg-paper px-3 py-2">
                    <dt className="text-muted">Order</dt>
                    <dd>
                      Min {euro(shop.minOrder)} · delivery {euro(shop.deliveryFee)} · {shop.etaMin ?? "—"} min
                    </dd>
                  </div>
                </dl>
                <p className="text-sm text-muted">
                  {shop.payCard ? "Card" : ""}
                  {shop.payCash ? " · Cash" : ""}
                  {shop.pickup ? " · Pickup" : ""}
                  {shop.ownDelivery ? " · Shop delivery" : ""}
                </p>
                {shop.lat != null && shop.lng != null ? (
                  <a
                    className="inline-flex h-11 items-center text-sm text-brass underline"
                    href={`https://www.openstreetmap.org/?mlat=${shop.lat}&mlon=${shop.lng}#map=18/${shop.lat}/${shop.lng}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Map
                  </a>
                ) : null}
                <p className="text-sm leading-relaxed text-muted">{shop.sourceNote}</p>
                <p className="text-xs text-muted">
                  Catalog {shop.catalogAsOf || "—"} · shop facts {shop.factsAsOf || "—"}
                  {shop.efoodUrl ? (
                    <>
                      {" "}
                      ·{" "}
                      <a className="text-brass underline" href={shop.efoodUrl} target="_blank" rel="noreferrer">
                        efood listing
                      </a>
                    </>
                  ) : null}
                </p>
                <button
                  type="button"
                  className="inline-flex h-11 items-center gap-2 rounded-lg border border-line px-3 text-sm disabled:opacity-60"
                  onClick={onCopy}
                  disabled={busy === "copy"}
                >
                  Copy into my menu
                </button>
                <button
                  type="button"
                  className="inline-flex h-11 items-center gap-2 rounded-lg bg-brass px-3 text-sm text-sheet disabled:opacity-60"
                  onClick={onRefresh}
                  disabled={!canEdit || busy === "refresh" || !shop.efoodId}
                >
                  <RefreshCw className="size-4" />
                  Refresh shop facts
                </button>
              </div>
            </section>
          ) : (
            <p className="rounded-xl border border-line bg-sheet p-4 text-sm">
              This menu is not on your account. Eirini stays with the owner. Rodos Island Trends is the shared starting point.
            </p>
          )}

          <section className="space-y-3 rounded-xl border border-line bg-sheet p-4">
            <h2 className="font-display text-lg">Research a listing</h2>
            <p className="text-sm text-muted">
              Searches the public efood shop list around Rhodes town. Item prices stay behind an efood login, so a new sheet opens empty.
            </p>
            <div className="flex gap-2">
              <input
                aria-label="Search efood"
                className="h-11 min-w-0 flex-1 rounded-lg border border-line bg-paper px-3 text-sm"
                value={lookup}
                onChange={(event) => setLookup(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") void onResearch();
                }}
              />
              <button
                type="button"
                className="inline-flex h-11 items-center gap-2 rounded-lg border border-line px-3 text-sm"
                onClick={onResearch}
                disabled={busy === "search"}
              >
                <Search className="size-4" />
                Find
              </button>
            </div>
            <ul className="space-y-2">
              {hits.map((hit) => (
                <li key={hit.efoodId} className="rounded-lg border border-line p-3 text-sm">
                  <p className="font-medium">{hit.title}</p>
                  <p className="text-muted">
                    {hit.street}
                    {hit.area ? `, ${hit.area}` : ""} {hit.zip}
                  </p>
                  <p className="text-muted">
                    {hit.cuisines || hit.basicCuisine} · {hit.rating ?? "—"} · {hit.isOpen ? "open" : "closed"}
                  </p>
                  <button
                    type="button"
                    className="mt-2 inline-flex h-11 items-center text-sm text-brass"
                    onClick={() => onAdopt(hit)}
                    disabled={busy === `open-${hit.efoodId}`}
                  >
                    Open sheet
                  </button>
                </li>
              ))}
            </ul>
          </section>
        </aside>

        <main className="min-w-0 space-y-3">
          {shop && shop.audience === "owner" ? (
            <p className="rounded-lg bg-brass-soft px-3 py-2 text-sm">Private. Only your account can open Eirini.</p>
          ) : null}
          {shop && !canEdit ? (
            <p className="rounded-lg bg-brass-soft px-3 py-2 text-sm">
              Read only. Copy this into your account before you change a price. The shared sheet is rewritten every Sunday at midnight, Athens time.
            </p>
          ) : null}
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <input
              aria-label="Filter rows"
              placeholder="Filter the sheet"
              className="h-11 min-w-0 w-full flex-1 rounded-lg border border-line bg-sheet px-3 text-sm sm:min-w-40 sm:w-auto"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <select
              aria-label="Category"
              className="h-11 max-w-full min-w-0 flex-1 rounded-lg border border-line bg-sheet px-3 text-sm sm:max-w-xs"
              value={category}
              onChange={(event) => setCategory(event.target.value)}
            >
              <option value="all">All categories</option>
              {categories.map(([el, en]) => (
                <option key={el} value={el}>
                  {el} / {en}
                </option>
              ))}
            </select>
            <select
              aria-label="Availability"
              className="h-11 max-w-full rounded-lg border border-line bg-sheet px-3 text-sm"
              value={stock}
              onChange={(event) => setStock(event.target.value as Stock)}
            >
              <option value="all">Any stock</option>
              <option value="in">Available</option>
              <option value="out">Unavailable</option>
            </select>
            <button
              type="button"
              className="inline-flex h-11 items-center gap-2 rounded-lg border border-line bg-sheet px-3 text-sm"
              onClick={() => setView(view === "sheet" ? "cards" : "sheet")}
            >
              {view === "sheet" ? <LayoutGrid className="size-4" /> : <Table2 className="size-4" />}
              {view === "sheet" ? "Cards" : "Sheet"}
            </button>
          </div>

          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <button
              type="button"
              className="inline-flex h-11 items-center gap-2 rounded-lg bg-ink px-3 text-sm text-sheet disabled:opacity-60"
              onClick={onAdd}
              disabled={!canEdit || !shop || busy === "add"}
            >
              <Plus className="size-4" />
              Add row
            </button>
            <button
              type="button"
              className="inline-flex h-11 items-center gap-2 rounded-lg border border-line bg-sheet px-3 text-sm"
              disabled={!shop}
              onClick={() => {
                if (!shop) return;
                downloadBlob(`${shop.slug}-datanet.csv`, new Blob([toCsv(rows)], { type: "text/csv;charset=utf-8" }));
              }}
            >
              <Download className="size-4" />
              CSV
            </button>
            <button
              type="button"
              className="inline-flex h-11 items-center gap-2 rounded-lg border border-line bg-sheet px-3 text-sm"
              disabled={!shop}
              onClick={() => {
                if (!shop) return;
                const bytes = toOds(shop, rows);
                const copy = new Uint8Array(bytes.byteLength);
                copy.set(bytes);
                downloadBlob(
                  `${shop.slug}-datanet.ods`,
                  new Blob([copy], { type: "application/vnd.oasis.opendocument.spreadsheet" }),
                );
              }}
            >
              <Download className="size-4" />
              ODS
            </button>
            {shop ? (
              <a className="inline-flex h-11 items-center text-sm text-brass underline" href={`/api/menus/${shop.slug}`}>
                SpaceNet JSON
              </a>
            ) : null}
            <p className="text-sm text-muted">
              {visible.length} shown · {rows.length} rows · {inStock} marked available
            </p>
          </div>

          {notice ? (
            <p className="rounded-lg bg-brass-soft px-3 py-2 text-sm" role="status">
              {notice}
            </p>
          ) : null}

          {view === "sheet" ? (
            <div className="sheet-scroll w-full min-w-0 rounded-xl border border-line bg-sheet">
              <p className="px-3 py-2 text-xs text-muted sm:hidden">Swipe the sheet sideways.</p>
              <table className="w-max min-w-full border-collapse text-left">
                <thead className="sticky-head text-xs uppercase tracking-wide text-muted">
                  <tr>
                    {["Media", "Name EL", "Name EN", "Category", "€", "Stock", "Description EL", "Description EN", ""].map((label) => (
                      <th key={label || "act"} className="border-b border-line px-2 py-2 font-medium">
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visible.map((row) => (
                    <tr key={row.id} className="border-b border-line align-top">
                      <td className="p-2">
                        <MediaCell locked={!canEdit} row={row} onFile={(file) => onFile(row, file)} onUrl={(url, mediaKind) => persist({ ...row, mediaUrl: url, mediaKind })} />
                      </td>
                      <td className="p-1">
                        <Field locked={!canEdit} label="Greek name" value={row.nameEl} onCommit={(nameEl) => persist({ ...row, nameEl })} />
                      </td>
                      <td className="p-1">
                        <Field locked={!canEdit} label="English name" value={row.nameEn} onCommit={(nameEn) => persist({ ...row, nameEn })} />
                      </td>
                      <td className="p-1">
                        <Field locked={!canEdit} label="Greek category" value={row.categoryEl} onCommit={(categoryEl) => persist({ ...row, categoryEl })} />
                        <Field locked={!canEdit} label="English category" value={row.categoryEn} onCommit={(categoryEn) => persist({ ...row, categoryEn })} />
                      </td>
                      <td className="p-1">
                        <PriceField locked={!canEdit} value={row.price} onCommit={(price) => persist({ ...row, price })} />
                        {row.prevPrice != null && row.price != null && row.prevPrice !== row.price ? (
                          <p className={`px-2 text-xs ${row.price > row.prevPrice ? "text-bad" : "text-good"}`}>
                            {row.price > row.prevPrice ? "Up" : "Down"} from {euro(row.prevPrice)}
                          </p>
                        ) : row.observedOn ? (
                          <p className="px-2 text-xs text-muted">{row.observedOn}</p>
                        ) : null}
                        <p className="px-2 text-xs text-muted">{row.priceNoteEn}</p>
                      </td>
                      <td className="p-2">
                        <label className="inline-flex h-11 items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={row.available}
                            disabled={!canEdit}
                            suppressHydrationWarning
                            onChange={(event) => persist({ ...row, available: event.target.checked })}
                          />
                          {row.available ? "Yes" : "No"}
                        </label>
                        {row.hasOptions ? <p className="text-xs text-muted">Has options</p> : null}
                      </td>
                      <td className="p-1">
                        <Field locked={!canEdit} label="Greek description" multiline value={row.descriptionEl} onCommit={(descriptionEl) => persist({ ...row, descriptionEl })} />
                        {row.catalogTextEl ? <p className="px-2 text-xs text-muted">efood: {row.catalogTextEl}</p> : null}
                      </td>
                      <td className="p-1">
                        <Field locked={!canEdit} label="English description" multiline value={row.descriptionEn} onCommit={(descriptionEn) => persist({ ...row, descriptionEn })} />
                      </td>
                      <td className="p-2">
                        {canEdit ? (
                          <button type="button" aria-label="Remove row" className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-bad" onClick={() => onDelete(row.id)}>
                            <Trash2 className="size-4" />
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {visible.length === 0 ? <p className="p-6 text-sm text-muted">No rows match this filter.</p> : null}
            </div>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2">
              {visible.map((row) => (
                <li key={row.id} className="overflow-hidden rounded-xl border border-line bg-sheet">
                  {row.mediaKind === "image" && row.mediaUrl ? (
                    <img src={row.mediaUrl} alt="" className="h-36 w-full object-cover" />
                  ) : null}
                  {row.mediaKind === "video" && row.mediaUrl ? (
                    <video src={row.mediaUrl} className="h-36 w-full object-cover" controls muted playsInline />
                  ) : null}
                  <div className="space-y-2 p-4">
                    <p className="text-xs text-muted">
                      {row.categoryEl} · {row.categoryEn}
                    </p>
                    <h2 className="font-display text-lg leading-tight">{row.nameEl}</h2>
                    <p className="text-sm text-muted">{row.nameEn}</p>
                    <p className="text-sm">{row.descriptionEl}</p>
                    <p className="text-sm text-muted">{row.descriptionEn}</p>
                    <p className="text-sm">
                      <span className="font-medium">{euro(row.price)}</span>
                      <span className="text-muted"> · {row.available ? "available" : "unavailable"}</span>
                    </p>
                    <p className="text-xs text-muted">{row.priceNoteEl}</p>
                    <p className="text-xs text-muted">{row.priceNoteEn}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </main>
      </div>
    </div>
  );
}

function PriceField({
  value,
  onCommit,
  locked,
}: {
  value: number | null;
  onCommit: (value: number | null) => void;
  locked?: boolean;
}) {
  const [draft, setDraft] = useState(value == null ? "" : String(value));
  useEffect(() => setDraft(value == null ? "" : String(value)), [value]);
  if (locked) return <p className="px-2 py-2 text-sm">{euro(value)}</p>;
  return (
    <input
      aria-label="Price in euro"
      inputMode="decimal"
      className="w-24 rounded-md bg-transparent px-2 py-2 text-sm outline-none focus:bg-brass-soft"
      value={draft}
      suppressHydrationWarning
      onChange={(event) => setDraft(event.target.value)}
      onBlur={() => {
        const trimmed = draft.trim().replace(",", ".");
        const price = trimmed === "" ? null : Number(trimmed);
        if (price != null && Number.isNaN(price)) return;
        if (price !== value) onCommit(price);
      }}
    />
  );
}

function MediaCell({
  row,
  onFile,
  onUrl,
  locked,
}: {
  row: MenuRow;
  onFile: (file: File) => void;
  onUrl: (url: string, kind: MediaKind) => void;
  locked?: boolean;
}) {
  const [link, setLink] = useState("");
  return (
    <div className="w-36 space-y-2">
      {row.mediaKind === "image" && row.mediaUrl ? (
        <img src={row.mediaUrl} alt="" className="h-16 w-full rounded-md object-cover" />
      ) : null}
      {row.mediaKind === "video" && row.mediaUrl ? (
        <video src={row.mediaUrl} className="h-16 w-full rounded-md object-cover" muted playsInline />
      ) : null}
      {locked ? null : (
        <>
          <label className="inline-flex h-11 cursor-pointer items-center rounded-lg border border-line px-2 text-xs">
            Photo or clip
            <input
              className="sr-only"
              type="file"
              accept="image/*,video/*"
              suppressHydrationWarning
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) onFile(file);
                event.target.value = "";
              }}
            />
          </label>
          <input
            aria-label="Media link"
            placeholder="Paste a link"
            className="h-11 w-full rounded-md border border-line px-2 text-xs"
            value={link}
            suppressHydrationWarning
            onChange={(event) => setLink(event.target.value)}
            onBlur={() => {
              const url = link.trim();
              if (!url) return;
              const mediaKind: MediaKind = /\.(mp4|webm|mov)(\?|$)/i.test(url) ? "video" : "image";
              onUrl(url, mediaKind);
              setLink("");
            }}
          />
        </>
      )}
    </div>
  );
}
