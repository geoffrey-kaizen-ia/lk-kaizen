"use client";

import { useState } from "react";

// Construit la requête LinkedIn à partir des titres saisis : chaque titre devient
// une phrase exacte entre guillemets, et on les relie par l'opérateur booléen OR.
// LinkedIn ne traite PAS la virgule comme un OU, d'où cet assemblage côté code.
// Ex : ["directeur marketing", "CMO"] -> "directeur marketing" OR "CMO"
export function buildKeywordsQuery(titles: string[]): string {
  return titles
    .map((t) => t.replace(/"/g, "").trim())
    .filter(Boolean)
    .map((t) => `"${t}"`)
    .join(" OR ");
}

// Champ "titres de poste" à puces. L'utilisateur ajoute autant de titres qu'il
// veut (Entrée, virgule, ou simplement en cliquant ailleurs) ; chaque titre
// devient une puce supprimable. On soumet deux champs cachés :
//  - keywords      : la requête finale "x" OR "y" envoyée à n8n/Unipile
//  - keywords_list : la liste brute (JSON) pour pouvoir ré-éditer à la duplication
export default function TitlePicker({
  defaultTitles = [],
}: {
  defaultTitles?: string[];
}) {
  const [titles, setTitles] = useState<string[]>(defaultTitles);
  const [input, setInput] = useState("");

  // Le texte en cours de frappe compte aussi : ainsi, si l'utilisateur oublie
  // d'appuyer sur Entrée avant de lancer la campagne, son titre est inclus.
  const pending = input.trim();
  const allTitles = pending && !titles.some((t) => t.toLowerCase() === pending.toLowerCase())
    ? [...titles, pending]
    : titles;

  function addTitle(raw: string) {
    const t = raw.trim();
    if (!t) return;
    if (titles.some((x) => x.toLowerCase() === t.toLowerCase())) {
      setInput("");
      return;
    }
    setTitles((prev) => [...prev, t]);
    setInput("");
  }

  function removeTitle(idx: number) {
    setTitles((prev) => prev.filter((_, i) => i !== idx));
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTitle(input);
    } else if (e.key === "Backspace" && input === "" && titles.length > 0) {
      // Backspace sur un champ vide retire la dernière puce.
      removeTitle(titles.length - 1);
    }
  }

  return (
    <div>
      <input type="hidden" name="keywords" value={buildKeywordsQuery(allTitles)} />
      <input type="hidden" name="keywords_list" value={JSON.stringify(allTitles)} />

      <div className="flex flex-wrap items-center gap-1.5 rounded-md border border-border bg-panel-raised px-2 py-1.5 focus-within:border-accent/50">
        {titles.map((t, i) => (
          <span
            key={`${t}-${i}`}
            className="flex items-center gap-1 rounded-sm bg-accent/10 px-2 py-0.5 text-sm text-accent"
          >
            {t}
            <button
              type="button"
              onClick={() => removeTitle(i)}
              className="text-accent/60 hover:text-danger"
              aria-label={`Retirer ${t}`}
            >
              &#x2715;
            </button>
          </span>
        ))}
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          onBlur={() => addTitle(input)}
          placeholder={titles.length === 0 ? "Ex : directeur marketing" : "Ajouter un titre..."}
          autoComplete="off"
          className="min-w-[8rem] flex-1 bg-transparent px-1 py-0.5 text-sm text-foreground outline-none"
        />
      </div>
      <p className="mt-1 text-xs text-text-dim">
        Ajoute un ou plusieurs titres (Entrée ou virgule). Les variantes d&apos;un même
        métier élargissent la recherche : directeur marketing, responsable marketing, CMO...
      </p>
    </div>
  );
}
