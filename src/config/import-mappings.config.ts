import type { DonationSource } from "@/types";

// Reconoce las pestañas del libro histórico "Plan de Apoyo Mensual".
// La pestaña define (source, year). Nombres normalizados en minúsculas.
export const legacyTabs: { match: RegExp; source: DonationSource; yearFrom: "name" | null }[] = [
  { match: /^pagos\s*cam/i, source: "cam_cash", yearFrom: null },
  { match: /^paypal/i, source: "paypal", yearFrom: "name" },
  { match: /^stripe/i, source: "stripe", yearFrom: "name" },
  { match: /^donantes\s*especiales/i, source: "special", yearFrom: null },
];

// Meses en español (índice 0 = Enero) para mapear las 12 columnas mensuales.
export const SPANISH_MONTHS = [
  "enero","febrero","marzo","abril","mayo","junio",
  "julio","agosto","septiembre","octubre","noviembre","diciembre",
] as const;
