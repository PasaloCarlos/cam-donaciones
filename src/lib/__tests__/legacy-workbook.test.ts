import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";
import { readLegacyWorkbook } from "@/lib/ingest/legacy-workbook";

function makeBuffer(): ArrayBuffer {
  const wb = XLSX.utils.book_new();
  const stripe = XLSX.utils.aoa_to_sheet([
    ["Email","Nombre","Donación Mensual Bruta","Comisión","Donación Neta","Total Bruto - Año 2025","Fecha de Suscripción",
     "Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre",
     "","País - Pueblo - Estado","Teléfono"],
    ["a@x.com","Ana","10","0.67","9.33","120","2023-07-24","9.33","","","","","","","","","","","","","PR","7870000000"],
  ]);
  XLSX.utils.book_append_sheet(wb, stripe, "STRIPE 2025");
  const other = XLSX.utils.aoa_to_sheet([["just","some","notes"]]);
  XLSX.utils.book_append_sheet(wb, other, "Sheet2");
  const out = XLSX.write(wb, { type: "array", bookType: "xlsx" });
  return out as ArrayBuffer;
}

describe("readLegacyWorkbook", () => {
  const { records, tabs } = readLegacyWorkbook(makeBuffer(), 2025);
  it("parses recognized auto tabs and reports the rest", () => {
    expect(records).toHaveLength(1);
    expect(records[0].pledge?.source).toBe("stripe");
    const stripeTab = tabs.find((t) => t.name === "STRIPE 2025")!;
    expect(stripeTab).toMatchObject({ source: "stripe", auto: true, recognized: true, rowsParsed: 1 });
    const otherTab = tabs.find((t) => t.name === "Sheet2")!;
    expect(otherTab.recognized).toBe(false);
  });
  it("derives the year from the tab name", () => {
    expect(records[0].payments[0].periodMonth).toBe("2025-01-01");
  });
});
