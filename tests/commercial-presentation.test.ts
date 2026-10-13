import { describe, expect, it } from "vitest";
import { isFullCommercialReport, isIsaborCommercialReport } from "@/features/commercial/presentation";

describe("apresentação comercial fiel aos relatórios originais", () => {
  it("Serenity e Isabor abrem um único relatório consolidado na visão do cliente", () => {
    expect(isFullCommercialReport("serenity-terapias", "commercial", "client")).toBe(true);
    expect(isFullCommercialReport("dra-isabor-sant-anna", "commercial", "client")).toBe(true);
    expect(isIsaborCommercialReport("dra-isabor-sant-anna")).toBe(true);
    expect(isIsaborCommercialReport("serenity-terapias")).toBe(false);
  });

  it("não altera a navegação dos outros clientes, módulos ou prévia administrativa", () => {
    expect(isFullCommercialReport("serenity-terapias", "traffic", "client")).toBe(false);
    expect(isFullCommercialReport("dra-isabor-sant-anna", "social", "client")).toBe(false);
    expect(isFullCommercialReport("serenity-terapias", "commercial", "preview")).toBe(false);
    expect(isFullCommercialReport("outra-clinica", "commercial", "client")).toBe(false);
  });
});
