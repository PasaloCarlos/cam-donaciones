import type { DonationSource } from "@/types";

// Pestañas del libro histórico "Plan de Apoyo Mensual". `auto` = se importa por
// el importador de columnas-mensuales. special/desconocidas se entran a mano.
export const legacyTabs: { match: RegExp; source: DonationSource; auto: boolean }[] = [
  { match: /^pagos\s*cam/i, source: "cam_cash", auto: true },
  { match: /^paypal/i, source: "paypal", auto: true },
  { match: /^stripe/i, source: "stripe", auto: true },
  { match: /^donantes\s*especiales/i, source: "special", auto: false },
];

// Sinónimos de encabezado → campo lógico. Comparados contra encabezados
// normalizados (minúsculas, sin acentos, espacios colapsados).
export const LEGACY_HEADERS = {
  email: ["email", "correo"],
  name: ["nombre"],
  gross: ["donacion mensual bruta", "bruto"],
  fee: ["comision"],
  net: ["donacion neta", "neto"],
  goal: ["objetivo de la donacion", "objetivo"],
  subscriptionDate: ["fecha de suscripcion"],
  address: ["direccion", "pais - pueblo - estado", "pais-pueblo-estado"],
  phone: ["telefono"],
} as const;

// Meses en español (índice 0 = Enero) para mapear las 12 columnas mensuales.
export const SPANISH_MONTHS = [
  "enero","febrero","marzo","abril","mayo","junio",
  "julio","agosto","septiembre","octubre","noviembre","diciembre",
] as const;

// Año embebido en el nombre de la pestaña ("Paypal 2025" -> 2025), si lo hay.
export function tabYear(sheetName: string): number | null {
  const m = sheetName.match(/(20\d{2})/);
  return m ? Number(m[1]) : null;
}
