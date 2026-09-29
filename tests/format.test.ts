import { describe, expect, it } from "vitest";
import { formatCurrency, formatDecimal, formatHeadlineValue, formatInteger, formatMultiplier, formatPercent, parseLocaleNumber } from "@/lib/format/number";
import { costPerLabel, singularizePt } from "@/lib/format/text";

describe("formatação pt-BR", () => {
  it("formata moeda como R$ 1.234,56", () => {
    expect(formatCurrency(1234.56)).toBe("R$ 1.234,56");
    expect(formatCurrency(144.68)).toBe("R$ 144,68");
    expect(formatCurrency(0)).toBe("R$ 0,00");
  });

  it("formata inteiros e percentuais", () => {
    expect(formatInteger(26457)).toBe("26.457");
    expect(formatPercent(0.0332, 2)).toBe("3,32%");
    expect(formatPercent(0.054)).toBe("5,4%");
    expect(formatMultiplier(3.16)).toBe("3,16x");
    expect(formatDecimal(1.5)).toBe("1,50");
  });

  it("nunca exibe NaN ou Infinity", () => {
    for (const v of [NaN, Infinity, -Infinity, null, undefined]) {
      expect(formatCurrency(v as number)).toBe("—");
      expect(formatPercent(v as number)).toBe("—");
      expect(formatInteger(v as number)).toBe("—");
    }
  });

  it("compacta valores grandes nos cards", () => {
    expect(formatHeadlineValue(139560.89, "currency")).toMatch(/^R\$ 139,6\s?mil$/);
    expect(formatHeadlineValue(26000, "currency")).toBe("R$ 26.000");
    expect(formatHeadlineValue(3400, "currency")).toBe("R$ 3.400,00");
  });
});

describe("parseLocaleNumber", () => {
  it.each([
    ["R$ 1.234,56", 1234.56],
    ["R$ 144,68", 144.68],
    ["5.755", 5755],
    ["26.457", 26457],
    ["3,32%", 0.0332],
    ["0.125", 0.125],
    ["3.32", 3.32],
    ["1,5", 1.5],
    ["1,234,567", 1234567],
    ["(120,00)", -120],
    [42, 42],
  ])("%s → %s", (input, expected) => {
    expect(parseLocaleNumber(input)).toBeCloseTo(expected as number, 6);
  });

  it("vazio, traço e texto viram null", () => {
    expect(parseLocaleNumber("")).toBeNull();
    expect(parseLocaleNumber("-")).toBeNull();
    expect(parseLocaleNumber("abc")).toBeNull();
    expect(parseLocaleNumber(NaN)).toBeNull();
  });
});

describe("rótulos", () => {
  it("singulariza rótulos do funil", () => {
    expect(singularizePt("Comparecimentos")).toBe("Comparecimento");
    expect(singularizePt("Conversões")).toBe("Conversão");
    expect(singularizePt("Propostas enviadas")).toBe("Proposta enviada");
    expect(costPerLabel("Conversas no WhatsApp")).toBe("Custo por conversa no WhatsApp");
  });
});
