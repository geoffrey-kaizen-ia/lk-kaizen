// Seuils du verdict qualité, V1 en dur (réglables plus tard via config).
export const QUALITY_MEAN_THRESHOLD = 7;
export const QUALITY_FLOOR = 4;

// Au lancement, la qualité est en mode observation (shadow) : elle est
// calculée et affichée mais ne bloque pas. Seule la sécurité bloque.
export const QUALITY_MODE: "shadow" | "blocking" = "shadow";
