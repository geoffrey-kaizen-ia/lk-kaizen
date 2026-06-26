"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { INDUSTRIES, type Industry } from "./industries";

// Normalise pour une recherche insensible aux accents et à la casse.
function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

// Champ secteur "tape + choisis", basé sur la liste LinkedIn FR embarquée
// (src/.../industries.ts). Toujours en français, quelle que soit la langue du
// compte LinkedIn. On stocke l'ID (industry_id) et le libellé (industry_label)
// dans des champs cachés soumis avec le formulaire de campagne.
export default function IndustryPicker({
  defaultId = null,
  defaultLabel = null,
}: {
  defaultId?: string | null;
  defaultLabel?: string | null;
}) {
  const [selected, setSelected] = useState<Industry | null>(
    defaultId && defaultLabel ? { id: defaultId, title: defaultLabel } : null
  );
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  const results = useMemo(() => {
    const q = normalize(query.trim());
    if (q.length < 2) return [];
    return INDUSTRIES.filter((i) => normalize(i.title).includes(q)).slice(0, 40);
  }, [query]);

  // Ferme le menu au clic extérieur.
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  function pick(opt: Industry) {
    setSelected(opt);
    setQuery("");
    setOpen(false);
  }

  function clearSelection() {
    setSelected(null);
    setQuery("");
  }

  return (
    <div ref={boxRef} className="relative">
      <input type="hidden" name="industry_id" value={selected?.id ?? ""} />
      <input type="hidden" name="industry_label" value={selected?.title ?? ""} />

      {selected ? (
        <div className="flex items-center justify-between gap-2 rounded-md border border-accent/40 bg-accent/5 px-3 py-2">
          <span className="text-sm text-foreground">{selected.title}</span>
          <button
            type="button"
            onClick={clearSelection}
            className="shrink-0 text-text-dim hover:text-danger"
            aria-label="Retirer le secteur"
          >
            &#x2715;
          </button>
        </div>
      ) : (
        <>
          <input
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => query.trim().length >= 2 && setOpen(true)}
            placeholder="Tape un secteur : banque, informatique, agro..."
            autoComplete="off"
            className="w-full rounded-md border border-border bg-panel-raised px-3 py-2 text-sm text-foreground outline-none focus:border-accent/50"
          />
          {open && query.trim().length >= 2 && (
            <div className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-md border border-border bg-panel shadow-lg">
              {results.length === 0 ? (
                <p className="px-3 py-2 text-xs text-text-dim">
                  Aucun secteur pour « {query} ». Essaie un autre mot.
                </p>
              ) : (
                results.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => pick(opt)}
                    className="block w-full px-3 py-2 text-left text-sm text-text-muted transition-colors hover:bg-panel-raised hover:text-foreground"
                  >
                    {opt.title}
                  </button>
                ))
              )}
            </div>
          )}
        </>
      )}
      <p className="mt-1 text-xs text-text-dim">
        Choisis un secteur officiel LinkedIn. Laisse vide pour ne pas filtrer.
      </p>
    </div>
  );
}
