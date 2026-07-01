// Lien vers le profil LinkedIn d'un prospect, reconstruit depuis le provider_id
// Unipile (identifiant membre type "ACoAA..."). LinkedIn resout ce format via
// la route /in/. Composant purement presentationnel : pas de hook ni de
// handler, donc utilisable aussi bien cote serveur que client.
export default function LinkedInLink({
  providerId,
  className = "",
}: {
  providerId: string | null | undefined;
  className?: string;
}) {
  if (!providerId) return null;
  return (
    <a
      href={`https://www.linkedin.com/in/${encodeURIComponent(providerId)}`}
      target="_blank"
      rel="noopener noreferrer"
      title="Ouvrir le profil LinkedIn"
      aria-label="Ouvrir le profil LinkedIn"
      className={`inline-flex shrink-0 items-center text-text-dim transition-colors hover:text-[#0a66c2] ${className}`}
    >
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" />
      </svg>
    </a>
  );
}
