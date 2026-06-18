import { describe, it, expect } from "vitest";
import { parseMoneyToCents, formatCents } from "@/lib/money";

describe("parseMoneyToCents", () => {
  it("parses a plain decimal to cents", () => {
    expect(parseMoneyToCents("26.01")).toBe(2601);
    expect(parseMoneyToCents(26.01)).toBe(2601);
  });
  it("strips currency symbols, commas and spaces", () => {
    expect(parseMoneyToCents("$1,858.74")).toBe(185874);
    expect(parseMoneyToCents(" $ 50 ")).toBe(5000);
  });
  it("rounds to the nearest cent (no float drift)", () => {
    expect(parseMoneyToCents("10.005")).toBe(1001);
    expect(parseMoneyToCents(189.60000000000002)).toBe(18960);
  });
  it("returns null for blank or non-numeric (e.g. CANCELADO)", () => {
    expect(parseMoneyToCents("")).toBeNull();
    expect(parseMoneyToCents("   ")).toBeNull();
    expect(parseMoneyToCents("CANCELADO")).toBeNull();
    expect(parseMoneyToCents(null)).toBeNull();
    expect(parseMoneyToCents(undefined)).toBeNull();
  });
  it("handles zero", () => {
    expect(parseMoneyToCents("0")).toBe(0);
    expect(parseMoneyToCents(0)).toBe(0);
  });
});

describe("formatCents", () => {
  it("formats cents as a currency string with 2 decimals", () => {
    expect(formatCents(2601)).toBe("$26.01");
    expect(formatCents(185874)).toBe("$1,858.74");
    expect(formatCents(0)).toBe("$0.00");
  });
  it("accepts a custom currency symbol", () => {
    expect(formatCents(5000, "USD ")).toBe("USD 50.00");
  });
});
