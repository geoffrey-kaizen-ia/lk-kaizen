import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import InvitedFilters from "./InvitedFilters";

const PAGE_SIZE = 50;

export default async function InvitedPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const params = await searchParams;
  const page = Math.max(1, Number(params.page ?? 1));
  const campaign = params.campaign ?? null;
  const search = params.search?.trim() ?? null;
  const dateFrom = params.date_from ?? null;
  const dateTo = params.date_to ?? null;

  const supabase = await createClient();

  const { data: campaigns } = await supabase
    .from("lk_searches")
    .select("id, name")
    .order("created_at", { ascending: false });

  let query = supabase
    .from("lk_search_results")
    .select(
      "id, search_id, full_name, headline, location, current_company, sent_at, created_at",
      { count: "exact" }
    )
    .eq("status", "invited")
    .order("created_at", { ascending: false });

  if (campaign) query = query.eq("search_id", campaign);
  if (search) query = query.ilike("full_name", `%${search}%`);
  if (dateFrom) query = query.gte("created_at", dateFrom);
  if (dateTo) query = query.lte("created_at", dateTo + "T23:59:59.999Z");

  const from = (page - 1) * PAGE_SIZE;
  const { data: results, count } = await query.range(from, from + PAGE_SIZE - 1);

  const total = count ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  const campaignMap = new Map((campaigns ?? []).map((c) => [c.id, c.name]));

  function buildHref(overrides: Record<string, string | null>) {
    const base: Record<string, string> = {};
    if (campaign) base.campaign = campaign;
    if (search) base.search = search;
    if (dateFrom) base.date_from = dateFrom;
    if (dateTo) base.date_to = dateTo;
    base.page = String(page);
    const merged = { ...base, ...overrides };
    const qs = new URLSearchParams(
      Object.entries(merged).filter(([, v]) => v !== null && v !== "") as [string, string][]
    );
    return `/dashboard/prospects/invited?${qs.toString()}`;
  }

  return (
    <div>
      <div className="mb-6 flex items-center gap-3">
        <Link
          href="/dashboard/prospects"
          className="text-sm text-text-dim transition-colors hover:text-foreground"
        >
          ← Campagnes
        </Link>
        <span className="text-text-dim">/</span>
        <h1 className="font-display text-xl font-semibold tracking-tight text-foreground">
          Invitations envoyées
        </h1>
        <span className="rounded-full bg-panel-raised px-2 py-0.5 text-xs text-text-dim">
          {total.toLocaleString("fr-FR")} au total
        </span>
      </div>

      <InvitedFilters
        campaigns={campaigns ?? []}
        defaultCampaign={campaign}
        defaultSearch={search}
        defaultDateFrom={dateFrom}
        defaultDateTo={dateTo}
      />

      <div className="mt-4 overflow-hidden rounded-md border border-border bg-panel">
        {results && results.length > 0 ? (
          <>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-panel-raised">
                  <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-text-dim">
                    Prospect
                  </th>
                  <th className="hidden px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-text-dim sm:table-cell">
                    Campagne
                  </th>
                  <th className="hidden px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-text-dim md:table-cell">
                    Poste
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-text-dim">
                    Invité le
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {results.map((r) => (
                  <tr key={r.id} className="hover:bg-panel-raised">
                    <td className="px-4 py-3">
                      <p className="font-medium text-foreground">{r.full_name ?? "—"}</p>
                      {r.location && (
                        <p className="text-xs text-text-dim">{r.location}</p>
                      )}
                    </td>
                    <td className="hidden px-4 py-3 text-xs text-text-muted sm:table-cell">
                      {campaignMap.get(r.search_id) ?? "—"}
                    </td>
                    <td className="hidden max-w-xs px-4 py-3 md:table-cell">
                      {r.headline && (
                        <p className="truncate text-xs text-text-dim">{r.headline}</p>
                      )}
                      {r.current_company && (
                        <p className="truncate text-xs text-text-dim">{r.current_company}</p>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-text-dim">
                      {new Date(r.sent_at ?? r.created_at).toLocaleDateString("fr-FR")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-border px-4 py-3">
                <p className="text-xs text-text-dim">
                  {from + 1}–{Math.min(from + PAGE_SIZE, total)} sur {total.toLocaleString("fr-FR")}
                </p>
                <div className="flex items-center gap-1">
                  {page > 1 && (
                    <Link
                      href={buildHref({ page: String(page - 1) })}
                      className="rounded-md border border-border px-3 py-1.5 text-xs text-text-muted transition-colors hover:bg-panel-raised"
                    >
                      ← Précédent
                    </Link>
                  )}
                  <span className="px-2 text-xs text-text-dim">
                    Page {page} / {totalPages}
                  </span>
                  {page < totalPages && (
                    <Link
                      href={buildHref({ page: String(page + 1) })}
                      className="rounded-md border border-border px-3 py-1.5 text-xs text-text-muted transition-colors hover:bg-panel-raised"
                    >
                      Suivant →
                    </Link>
                  )}
                </div>
              </div>
            )}
          </>
        ) : (
          <p className="px-5 py-10 text-center text-sm text-text-dim">
            Aucune invitation trouvée{search || campaign || dateFrom ? " pour ces filtres" : ""}.
          </p>
        )}
      </div>
    </div>
  );
}
