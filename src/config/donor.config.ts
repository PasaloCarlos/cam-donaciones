// ÚNICA FUENTE DE VERDAD para textos/ajustes del panel. (No hay datos editables
// públicos en este milestone.)
export const donor = {
  org: { name: "Comedores Sociales de Puerto Rico", shortName: "CAM Donaciones" },
  currency: "$",
  // Un donante recurrente sin pago en los últimos N meses cuenta como "lapsed".
  lapsedAfterMonths: 2,
  goals: {
    operacion_general: "Operación General",
    compras_solidarias: "Compras Solidarias",
  },
  sources: {
    cam_cash: "Efectivo (CAM)",
    paypal: "PayPal",
    stripe: "Stripe",
    special: "Donante Especial",
    other: "Otro",
  },
  onsite: { presetAmounts: [5, 10, 20, 50] },
} as const;

export type DonorConfig = typeof donor;
