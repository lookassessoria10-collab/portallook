import { beforeEach, describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { useMemoryStorage } from "./helpers/setup";
import type { MemoryStorageProvider } from "./helpers/memory-storage";
import { actionId, extractActions } from "../scripts/lib/extract-actions.mjs";
import { createClient } from "@/features/clients/service";
import type { ClientInput } from "@/features/clients/input";
import { actionKindFromText, actionStatusFromText, splitActionTitle } from "@/features/actions/schema";
import { ACTIONS_SNAPSHOT, actionFromSheetRow, findActionsSheet } from "@/features/actions/sheet";
import { summarizeActions } from "@/features/actions/view-model";
import { deleteAction, getClientActions, importActionsFromSheet, listActionsOverview, loadPortalActions, saveAction, setActionsEnabled, setActionVisible } from "@/features/actions/service";
import { loadPortalModel } from "@/features/portal/model";

const moduleOn = { enabled: true, cadence: "monthly" as const, dueDay: 5, allowOriginalDownload: false };
const input = (name: string, slug: string, shortName = name): ClientInput => ({
  name,
  shortName,
  slug,
  greetingName: "",
  segment: "",
  currency: "BRL",
  notes: "",
  roiMetric: "roas",
  commercial: moduleOn,
  traffic: moduleOn,
});

const HEADER = ["Ação", "Tipo de ação", "Quando foi sugerido", "Quando foi executado", "Status", "Observações", "Última atualização", "Andamento / Pendências"];

describe("planilha de ações: extração", () => {
  it("lê uma aba por cliente, ignora as abas de apoio e mantém IDs estáveis", () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["LOOK • PAINEL DE AÇÕES"], ["Cliente", "Todos"]]), "Dashboad");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([HEADER]), "Modelo");
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet([
        [],
        [],
        HEADER,
        ["Blog educativo para fortalecer autoridade (Autoridade)", "Contínua", 45809, "01/06/2025", "Aprovado", "", "", ""],
        ["Ação de Páscoa (Relacionamento)", "Pontual", "17/04/2025", "17/04/2025", "Aprovado"],
        [],
        ["Ação de Páscoa (Relacionamento)", "Pontual", "17/04/2025", "17/04/2025", "Aprovado"],
      ]),
      "Cliente Teste",
    );
    const { sheets } = extractActions(wb);
    expect(sheets.map((s: { name: string }) => s.name)).toEqual(["Cliente Teste"]);
    const [blog, pascoa1, pascoa2] = sheets[0].actions;
    expect(blog).toMatchObject({ row: 4, type: "Contínua", suggestedAt: "2025-06-01", executedAt: "2025-06-01", status: "Aprovado" });
    expect(pascoa2.row).toBe(7);
    // A mesma ação repetida na aba vira duas ações, com IDs diferentes e reproduzíveis.
    expect(pascoa1.id).not.toBe(pascoa2.id);
    expect(pascoa1.id).toBe(actionId("Cliente Teste", "Ação de Páscoa (Relacionamento)", 1));
  });

  it("lê status, tipo e frente como a planilha", () => {
    expect(["", "Aprovado", "Em andamento", "Andamento", "Finalizado", "Não aprovado", "Aguardando cliente", "Concluída"].map(actionStatusFromText)).toEqual([
      "suggested",
      "approved",
      "in_progress",
      "in_progress",
      "done",
      "rejected",
      "pending",
      "done",
    ]);
    expect([actionKindFromText("Contínua"), actionKindFromText("Pontual"), actionKindFromText("")]).toEqual(["continuous", "one_off", null]);
    expect(splitActionTitle("Grupo Telegram para relacionamento (Comunidade)")).toEqual({ title: "Grupo Telegram para relacionamento", category: "Comunidade" });
    expect(splitActionTitle("Ação sem frente")).toEqual({ title: "Ação sem frente", category: "" });
  });

  it("o snapshot bate com o painel da planilha (229 ações, 28 em andamento, 147 executadas, 16 concluídas, 78 sem status)", () => {
    const items = ACTIONS_SNAPSHOT.sheets.flatMap((s) => s.actions);
    expect(ACTIONS_SNAPSHOT.sheets).toHaveLength(19);
    expect(new Set(items.map((a) => a.id)).size).toBe(items.length);
    const summary = summarizeActions(items.map(actionFromSheetRow));
    expect(summary.total).toBe(229);
    expect(summary.byStatus.in_progress).toBe(28);
    expect(summary.executed).toBe(147);
    expect(summary.byStatus.done).toBe(16);
    expect(summary.byStatus.suggested).toBe(78);
    expect(summary.byStatus.approved).toBe(104);
    expect(summary.byStatus.rejected).toBe(3);
    expect([summary.oneOff, summary.continuous]).toEqual([172, 56]);
  });
});

describe("planilha de ações: aba de cada cliente", () => {
  it("encontra a aba pelo nome, nome curto ou slug — e ignora quem não está na planilha", () => {
    const find = (name: string, slug: string, shortName = name) => findActionsSheet({ name, slug, shortName });
    expect(find("Dra. Isabor Sant'Anna", "dra-isabor-sant-anna", "Isabor Sant'Anna")).toBe("Isabor Santana");
    expect(find("Dra. Isabor Sant'Anna", "isabor", "Dra. Isabor")).toBe("Isabor Santana");
    expect(find("Serenity Terapias", "serenity-terapias", "Serenity Terapias")).toBe("Serenity");
    expect(find("Larplan Móveis Planejados", "larplan", "Larplan")).toBe("Larplan");
    expect(find("IL Distribuidora", "il-distribuidora")).toBe("IL Distribuidora");
    expect(find("Instituto Landim", "instituto-landim")).toBe("Instituto Landim");
    expect(find("SENGE-BA", "senge-ba")).toBe("SENGE BA");
    expect(find("Dr. Lucas Fraga", "lucas-fraga")).toBe("Lucas Fraga");
    expect(find("Cliente Novo Ltda", "cliente-novo")).toBeNull();
  });
});

describe("módulo de ações", () => {
  let storage: MemoryStorageProvider;
  beforeEach(() => {
    storage = useMemoryStorage();
  });

  const keys = async () => (await storage.list("")).map((f) => f.path);

  it("cliente fora da planilha fica sem ações e sem a área no portal", async () => {
    const client = await createClient(input("Cliente Novo", "cliente-novo"), null);
    expect((await getClientActions(client)).origin).toBe("none");
    expect(await loadPortalActions(client)).toBeNull();
  });

  it("cliente da planilha vê as ações dela sem nenhuma gravação; o portal não recebe observações internas", async () => {
    const client = await createClient(input("Serenity Terapias", "serenity", "Serenity"), null);
    const before = await keys();
    const actions = await getClientActions(client);
    expect(actions).toMatchObject({ origin: "sheet", sheet: "Serenity" });
    expect(actions.items).toHaveLength(12);
    const portal = await loadPortalActions(client);
    expect(portal?.summary.total).toBe(12);
    expect(portal?.groups.map((g) => g.status)).toEqual(["in_progress", "done", "approved", "suggested"]);
    const ritual = portal!.groups.flatMap((g) => g.items).find((a) => a.title.startsWith("Ritual Serenity"))!;
    expect(ritual).toMatchObject({ category: "Eventos e ativações", status: "approved", suggestedAt: "2026-08-26", executedAt: "2026-09-03", note: "" });
    expect(Object.keys(ritual)).not.toContain("notes");
    expect(JSON.stringify(portal)).not.toContain("Dia do Sexo");
    expect(await keys()).toEqual(before);
  });

  it("a 1ª edição grava só o actions.json, a partir das ações da planilha", async () => {
    const client = await createClient(input("Larplan Móveis Planejados", "larplan", "Larplan"), null);
    const before = (await keys()).filter((k) => !k.startsWith("events/"));
    const created = await saveAction(client.id, { title: "Nova vitrine digital", category: "Presença digital", kind: "one_off", status: "in_progress", suggestedAt: "2026-10-20", executedAt: "", clientNote: "Primeira versão no ar em novembro." }, "adm@look");
    const after = (await keys()).filter((k) => !k.startsWith("events/"));
    expect(after.filter((k) => !before.includes(k))).toEqual([`clients/${client.id}/actions.json`]);
    const actions = await getClientActions(client);
    expect(actions.origin).toBe("stored");
    expect(actions.sheet).toBe("Larplan");
    expect(actions.items).toHaveLength(6);
    expect(actions.items.at(-1)).toMatchObject({ id: created.id, title: "Nova vitrine digital", executedAt: null, visible: true });

    await saveAction(client.id, { ...created, status: "done", executedAt: "2026-11-05" }, "adm@look");
    expect((await getClientActions(client)).items.find((a) => a.id === created.id)).toMatchObject({ status: "done", executedAt: "2026-11-05" });

    const olx = actions.items[0];
    await setActionVisible(client.id, olx.id, false, "adm@look");
    const portal = await loadPortalActions(client);
    expect(portal?.summary.total).toBe(5);
    expect(portal?.groups.flatMap((g) => g.items).some((a) => a.id === olx.id)).toBe(false);

    await deleteAction(client.id, created.id, "adm@look");
    expect((await getClientActions(client)).items).toHaveLength(5);

    await setActionsEnabled(client.id, false, "adm@look");
    expect(await loadPortalActions(client)).toBeNull();
    await expect(deleteAction(client.id, created.id, "adm@look")).rejects.toThrow(/não existe/);
  });

  it("importa as ações de uma aba escolhida e lista as abas que não são de nenhum cliente", async () => {
    const client = await createClient(input("Clínica Rose Moreira", "clinica-rose", "Clínica Rose"), null);
    await createClient(input("Serenity Terapias", "serenity", "Serenity"), null);
    expect(await importActionsFromSheet(client.id, "Rose", null)).toBe(13);
    const { rows, unmatchedSheets } = await listActionsOverview();
    expect(rows.map((r) => [r.client.slug, r.actions.origin, r.actions.sheet])).toEqual([
      ["clinica-rose", "stored", "Rose"],
      ["serenity", "sheet", "Serenity"],
    ]);
    expect(unmatchedSheets).toHaveLength(17);
    expect(unmatchedSheets).not.toContain("Rose");
    await expect(importActionsFromSheet(client.id, "Aba inexistente", null)).rejects.toThrow(/não encontrada/);
  });

  it("o portal de relatórios continua igual (a área Ações não muda o modelo)", async () => {
    const client = await createClient(input("Serenity Terapias", "serenity", "Serenity"), null);
    const model = await loadPortalModel(client, { mode: "client", tab: "acoes" });
    expect(model.tabs).toEqual(["commercial", "traffic"]);
    expect(model.tab).toBe("commercial");
  });
});
