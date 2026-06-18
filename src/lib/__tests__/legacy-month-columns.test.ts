import { describe, it, expect } from "vitest";
import { normalizeHeader, parseGoal, parseLegacyDate, monthIso, findHeaderRow, parseLegacySheet }
  from "@/lib/ingest/importers/legacy-month-columns";

describe("helpers", () => {
  it("normalizeHeader lowercases, strips accents, collapses spaces", () => {
    expect(normalizeHeader("  Donación   Neta ")).toBe("donacion neta");
    expect(normalizeHeader("País - Pueblo - Estado")).toBe("pais - pueblo - estado");
    expect(normalizeHeader(null)).toBe("");
  });
  it("parseGoal maps the two known objetivos, else null", () => {
    expect(parseGoal("Operación General")).toBe("operacion_general");
    expect(parseGoal("Compras Solidarias")).toBe("compras_solidarias");
    expect(parseGoal("")).toBeNull();
    expect(parseGoal("otra cosa")).toBeNull();
  });
  it("parseLegacyDate handles 'YYYY-MM-DD hh:mm:ss', 'MM/DD/YYYY', blank", () => {
    expect(parseLegacyDate("2023-12-18 00:00:00")).toBe("2023-12-18");
    expect(parseLegacyDate("12/18/2023")).toBe("2023-12-18");
    expect(parseLegacyDate("")).toBeNull();
    expect(parseLegacyDate(null)).toBeNull();
  });
  it("monthIso builds first-of-month ISO", () => {
    expect(monthIso(2026, 0)).toBe("2026-01-01");
    expect(monthIso(2025, 11)).toBe("2025-12-01");
  });
});

// A STRIPE-style sheet: header on row 0, no Objetivo, address = País-Pueblo-Estado.
const stripeRows: unknown[][] = [
  ["Email","Nombre","Donación Mensual Bruta","Comisión","Donación Neta","Total Bruto - Año 2025","Fecha de Suscripción",
   "Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre",
   "","País - Pueblo - Estado","Teléfono"],
  ["abdel@x.com","Abdel Rivera","10","0.67","9.33","120","2023-07-24 00:00:00",
   "9.33","9.33","9.33","","","","","","","","","","", "PR - Ponce","7875551234"],
];

// A PAYPAL-style sheet: spurious top row, header on row 1, Objetivo present, address = Dirección, a CANCELADO cell.
const paypalRows: unknown[][] = [
  ["","","","","","","","Mes/Día/Año","2025"],
  ["Email","Nombre","Donación Mensual Bruta","Comisión","Donación Neta","Total Bruto - Año 2025","Objetivo de la Donación","Fecha de Suscripción",
   "Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre","","Dirección"],
  ["jean@x.com","Jeanette Lee","26.01","1.01","25","78.03","Compras Solidarias","2024-10-17 00:00:00",
   "25","25","25","CANCELADO","","","","","","","","","", "Calle 1, San Juan"],
  ["","","","","","","","","","","","","","","","","","","","","",""], // blank spacer row
];

describe("findHeaderRow", () => {
  it("finds the row containing Email+Nombre (row 0 for stripe, row 1 for paypal)", () => {
    expect(findHeaderRow(stripeRows)).toBe(0);
    expect(findHeaderRow(paypalRows)).toBe(1);
  });
});

describe("parseLegacySheet — stripe", () => {
  const { records, rowsParsed } = parseLegacySheet({ rows: stripeRows, source: "stripe", year: 2025, defaultYear: 2025 });
  it("parses one donor record", () => {
    expect(rowsParsed).toBe(1);
    expect(records).toHaveLength(1);
  });
  const r = records[0];
  it("maps donor + pledge fields (no objetivo on stripe)", () => {
    expect(r.donor).toMatchObject({ email: "abdel@x.com", name: "Abdel Rivera", phone: "7875551234", address: "PR - Ponce" });
    expect(r.pledge).toMatchObject({ source: "stripe", kind: "recurring", status: "active", goal: null,
      monthlyGrossCents: 1000, feeCents: 67, monthlyNetCents: 933, subscriptionDate: "2023-07-24", sourceYear: 2025 });
  });
  it("turns the 3 filled month cells into payments at the right periods, fee proportional", () => {
    expect(r.payments).toHaveLength(3);
    expect(r.payments[0]).toMatchObject({ source: "stripe", periodMonth: "2025-01-01", grossCents: 933 });
    // proportional fee: rowFee/rowGross = 67/1000 -> round(933*0.067)=63; net=870
    expect(r.payments[0].feeCents).toBe(63);
    expect(r.payments[0].netCents).toBe(933 - 63);
    expect(r.payments.map((p) => p.periodMonth)).toEqual(["2025-01-01","2025-02-01","2025-03-01"]);
  });
});

describe("parseLegacySheet — paypal (spurious top row, objetivo, CANCELADO, blank row)", () => {
  const { records, rowsParsed, rowsSkipped } = parseLegacySheet({ rows: paypalRows, source: "paypal", year: 2025, defaultYear: 2025 });
  it("skips the blank spacer row, parses one donor", () => {
    expect(rowsParsed).toBe(1);
    expect(rowsSkipped).toBe(1);
    expect(records).toHaveLength(1);
  });
  const r = records[0];
  it("reads objetivo + Dirección, marks pledge cancelled (a CANCELADO month), emits only real payments", () => {
    expect(r.donor).toMatchObject({ email: "jean@x.com", name: "Jeanette Lee", address: "Calle 1, San Juan" });
    expect(r.pledge).toMatchObject({ source: "paypal", goal: "compras_solidarias", status: "cancelled" });
    // Enero/Febrero/Marzo filled (25 each), Abril = CANCELADO (no payment), rest blank
    expect(r.payments).toHaveLength(3);
    expect(r.payments.every((p) => p.grossCents === 2500)).toBe(true);
    expect(r.payments.map((p) => p.periodMonth)).toEqual(["2025-01-01","2025-02-01","2025-03-01"]);
  });
});
