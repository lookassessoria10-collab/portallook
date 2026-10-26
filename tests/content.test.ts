import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  process.env.CLICKUP_API_TOKEN = "pk_test_token";
});

import { useMemoryStorage } from "./helpers/setup";
import type { MemoryStorageProvider } from "./helpers/memory-storage";
import { createClient } from "@/features/clients/service";
import type { ClientInput } from "@/features/clients/input";
import { normalizeTask } from "@/features/content/normalize";
import { applyContentRules, contentStatus, findClickUpList, hiddenReason } from "@/features/content/rules";
import { DEFAULT_CONTENT_RULES, type ClickUpListRef, type ContentItem } from "@/features/content/schema";
import { buildPortalContent, channelLabel, formatLabel } from "@/features/content/view-model";
import { getContentSettings, loadContentAdmin, loadPortalContent, refreshContent, saveContentSettings } from "@/features/content/service";

const TZ = "America/Sao_Paulo";
const NOW = new Date("2026-10-26T15:00:00Z");

const FORMATS = [
  { id: "o-card", name: "CARD", orderindex: 0 },
  { id: "o-carrossel", name: "CARROSSEL", orderindex: 1 },
  { id: "o-cs", name: "CARD E STORY", orderindex: 2 },
  { id: "o-stories", name: "STORIES", orderindex: 3 },
];
const TYPES = [
  { id: "t-acao", name: "AÇÃO", orderindex: 0 },
  { id: "t-conteudo", name: "CONTEÚDO", orderindex: 1 },
];

interface TaskOpts {
  fmt?: string | number | null;
  tipo?: string | null;
  caption?: string | null;
  text?: string;
  tags?: string[];
  type?: string;
  due?: number | null;
}

/** Tarefa no formato da API v2 do ClickUp (data à meia-noite de Brasília). */
function task(id: string, name: string, date: string, status: string, o: TaskOpts = {}) {
  return {
    id,
    name,
    url: `https://app.clickup.com/t/${id}`,
    text_content: o.text ?? "",
    status: { status, color: "#87909e", type: o.type ?? "custom" },
    due_date: o.due === null ? null : String(o.due ?? Date.parse(`${date}T03:00:00Z`)),
    tags: (o.tags ?? []).map((t) => ({ name: t })),
    custom_fields: [
      { id: "f-formato", name: "Formato", type: "drop_down", type_config: { options: FORMATS }, value: o.fmt ?? undefined },
      { id: "f-canal", name: "CANAL", type: "drop_down", type_config: { options: [{ id: "o-ig", name: "INSTAGRAM/FACEBOOK", orderindex: 0 }] }, value: "o-ig" },
      { id: "f-tipo", name: "TIPO", type: "drop_down", type_config: { options: TYPES }, value: o.tipo ?? undefined },
      { id: "f-legenda", name: "Legenda", type: "text", value: o.caption ?? undefined },
      { id: "f-andamento", name: "Andamento", type: "labels", type_config: { options: [{ id: "l-postado", label: "Postado" }] }, value: [] },
    ],
  };
}

const TASKS = [
  task("a1", "Rotina cheia", "2026-10-07", "postado", { fmt: "o-card", tipo: "t-conteudo", caption: "Legenda da rotina." }),
  task("a2", "Massagem é só quando algo dói?", "2026-10-12", "aguardando o cliente", { fmt: 0, tipo: "t-conteudo", caption: "Legenda." }),
  task("a3", "AÇÃO OUTUBRO", "2026-10-03", "planejamento"),
  task("a4", "Nova linha editorial", "2026-10-17", "aprovado ✅", { tipo: "t-acao" }),
  task("a5", "Qual experiência?", "2026-10-19", "planejamento", { fmt: "o-carrossel", tipo: "t-conteudo", caption: "Legenda." }),
  task("a6", "O corpo sente", "2026-10-26", "planejamento", { fmt: "o-card", tipo: "t-conteudo", caption: "Nem sempre percebemos.", text: "CARD\nTexto do card (podemos usar um mockup)" }),
  task("a7", "TEMA", "2026-10-31", "planejamento", { tipo: "t-conteudo" }),
  task("a8", "Novembro Azul", "2026-11-02", "planejamento", { fmt: "o-cs", caption: "Novembro Azul é um período…" }),
  task("a9", "FERIADO DE FINADOS (confirmar funcionamento)", "2026-11-02", "planejamento", { fmt: "o-stories" }),
  task("a10", "Desbloqueios emocionais", "2026-11-16", "planejamento", { tipo: "t-conteudo" }),
  task("a11", "Bastidores da equipe", "2026-11-20", "planejamento", { fmt: "o-card", tipo: "t-conteudo", tags: ["interno"] }),
  task("a12", "Sem data", "2026-11-21", "planejamento", { fmt: "o-card", due: null }),
];

const LISTS = [
  { id: "901", name: "SERENITY", folder: "BIANCA" },
  { id: "902", name: "ISABOR", folder: "BIANCA" },
  { id: "903", name: "LARPLAN", folder: "ANTIGO" },
  { id: "904", name: "LUCAS", folder: "BIANCA" },
  { id: "905", name: "ROSE", folder: "ANTIGO" },
  { id: "906", name: "ROSE", folder: "BIANCA" },
  { id: "907", name: "List", folder: "ANTIGO" },
];

const items = () => TASKS.map((t) => normalizeTask(t, TZ)).filter((i): i is ContentItem => i !== null);

describe("ClickUp → itens do portal", () => {
  it("lê formato, canal, tipo e legenda pelo nome do campo (id da opção ou posição) e a data no fuso do portal", () => {
    const [rotina, doi] = items();
    expect(rotina).toMatchObject({ id: "a1", date: "2026-10-07", format: "CARD", channel: "INSTAGRAM/FACEBOOK", type: "CONTEÚDO", caption: "Legenda da rotina.", statusName: "postado" });
    // Lista antiga: a lista suspensa guarda a posição da opção.
    expect(doi.format).toBe("CARD");
    // 01:30 UTC ainda é o dia anterior em Brasília.
    expect(normalizeTask(task("x", "x", "2026-10-07", "planejamento", { due: Date.parse("2026-10-08T01:30:00Z") }), TZ)?.date).toBe("2026-10-07");
    expect(normalizeTask(TASKS[11], TZ)).toBeNull();
    expect(normalizeTask({ id: 1 }, TZ)).toBeNull();
  });

  it("traduz os status reais da lista para a linguagem do cliente", () => {
    const status = (statusName: string, statusType = "custom") => contentStatus({ statusName, statusType, progress: [] });
    expect(["planejamento", "rascunho - plan.", "extra - marcelo", "a fazer - pautas semanais", "aleatórios"].map((s) => status(s))).toEqual(Array(5).fill("planning"));
    expect(["revisão ⚠️", "correção 🛑", "feito - enviar para aprova"].map((s) => status(s))).toEqual(Array(3).fill("production"));
    expect(["aguardando o cliente", "pendente cliente"].map((s) => status(s))).toEqual(["awaiting", "awaiting"]);
    expect(status("aprovado ✅")).toBe("approved");
    expect([status("postado"), status("Closed", "closed")]).toEqual(["published", "published"]);
    expect(contentStatus({ statusName: "aprovado ✅", statusType: "custom", progress: ["Postado"] })).toBe("published");
  });

  it("esconde TEMA, itens a confirmar, tipo Ação, itens vazios e a etiqueta interno", () => {
    const { visible, hidden } = applyContentRules(items(), DEFAULT_CONTENT_RULES);
    expect(hidden.map((h) => [h.item.name, h.reason])).toEqual([
      ["AÇÃO OUTUBRO", "untyped"],
      ["Nova linha editorial", "type"],
      ["TEMA", "placeholder"],
      ["FERIADO DE FINADOS (confirmar funcionamento)", "to_confirm"],
      ["Bastidores da equipe", "internal"],
    ]);
    expect(visible.map((i) => i.id)).toEqual(["a1", "a2", "a5", "a6", "a8", "a10"]);
    // Com legenda, "TEMA" já é um conteúdo de verdade.
    expect(hiddenReason({ ...items()[6], caption: "Pronto" }, DEFAULT_CONTENT_RULES)).toBeNull();
    // Regras desligadas no painel.
    expect(hiddenReason(items()[8], { ...DEFAULT_CONTENT_RULES, hideToConfirm: false })).toBeNull();
  });

  it("monta o portal sem a descrição (notas internas) e com rótulos legíveis", () => {
    const vm = buildPortalContent(items(), DEFAULT_CONTENT_RULES, "2026-10-26", NOW.toISOString())!;
    expect(vm.items.map((i) => i.title)).toEqual(["Rotina cheia", "Massagem é só quando algo dói?", "Qual experiência?", "O corpo sente", "Novembro Azul", "Desbloqueios emocionais"]);
    expect(JSON.stringify(vm)).not.toContain("mockup");
    expect(vm.items.every((i) => i.description === null)).toBe(true);
    expect(vm.items[3]).toMatchObject({ format: "Card", formatColor: "#4f8ff7", channel: "Instagram / Facebook", status: "planning", caption: "Nem sempre percebemos." });
    expect(vm.items[5]).toMatchObject({ format: "Formato a definir" });
    expect(vm.months.map((m) => m.label)).toEqual(["Outubro de 2026", "Novembro de 2026"]);
    expect([vm.defaultMonth, vm.rangeLabel]).toEqual(["2026-10", "Out – Nov / 2026"]);
    const withDescription = buildPortalContent(items(), { ...DEFAULT_CONTENT_RULES, showDescription: true, showCaption: false }, "2026-10-26", NOW.toISOString())!;
    expect(withDescription.items[3]).toMatchObject({ caption: null, description: "CARD\nTexto do card (podemos usar um mockup)" });
    expect([formatLabel("CARD E STORY"), channelLabel("WHATSAPP E STORIES"), channelLabel("TV INTERNA")]).toEqual(["Card e story", "WhatsApp e Stories", "TV Interna"]);
    expect(buildPortalContent([items()[2]], DEFAULT_CONTENT_RULES, "2026-10-26", NOW.toISOString())).toBeNull();
  });

  it("encontra a lista do cliente pelo nome, preferindo a pasta atual a 'ANTIGO'", () => {
    const lists: ClickUpListRef[] = LISTS.map((l) => ({ ...l, space: "PROCESSOS - LOOK" }));
    const find = (name: string, slug: string, shortName = name) => findClickUpList({ name, slug, shortName }, lists)?.id ?? null;
    expect(find("Serenity Terapias", "serenity-terapias")).toBe("901");
    expect(find("Dra. Isabor Sant'Anna", "dra-isabor-sant-anna")).toBe("902");
    expect(find("Larplan Móveis Planejados", "larplan", "Larplan")).toBe("903");
    expect(find("Dr. Lucas Fraga", "lucas-fraga")).toBe("904");
    expect(find("Rose Meire", "rose-meire")).toBe("906");
    expect(find("Cliente Novo", "cliente-novo")).toBeNull();
  });
});

describe("serviço da área Conteúdo", () => {
  let storage: MemoryStorageProvider;
  let calls: string[];
  let fail: boolean;

  const moduleOn = { enabled: true, cadence: "monthly" as const, dueDay: 5, allowOriginalDownload: false };
  const input = (name: string, slug: string): ClientInput => ({ name, shortName: name, slug, greetingName: "", segment: "", currency: "BRL", notes: "", roiMetric: "roas", commercial: moduleOn, traffic: moduleOn });

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
    storage = useMemoryStorage();
    calls = [];
    fail = false;
    vi.stubGlobal("fetch", async (url: URL | string, init?: RequestInit) => {
      const u = new URL(String(url));
      calls.push(u.pathname);
      expect((init?.headers as Record<string, string>).Authorization).toBe("pk_test_token");
      if (fail) return new Response("{}", { status: 503 });
      const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
      const path = u.pathname.replace(/^\/api\/v2/, "");
      if (path === "/team") return json({ teams: [{ id: "9011" }] });
      if (path === "/team/9011/space") return json({ spaces: [{ id: "s1", name: "PROCESSOS - LOOK" }] });
      if (path === "/space/s1/folder") {
        const folders = [...new Set(LISTS.map((l) => l.folder))].map((f) => ({ id: f, name: f, lists: LISTS.filter((l) => l.folder === f).map((l) => ({ id: l.id, name: l.name })) }));
        return json({ folders });
      }
      if (path === "/space/s1/list") return json({ lists: [] });
      if (path === "/list/901") return json({ id: "901", name: "SERENITY", statuses: [{ status: "planejamento", color: "#87909e", type: "open" }, { status: "postado", color: "#30a46c", type: "custom" }] });
      if (path === "/list/901/task") {
        expect(u.searchParams.get("include_closed")).toBe("true");
        const gt = Number(u.searchParams.get("due_date_gt"));
        const lt = Number(u.searchParams.get("due_date_lt"));
        return json({ tasks: TASKS.filter((t) => t.due_date === null || (Number(t.due_date) > gt && Number(t.due_date) < lt)), last_page: true });
      }
      return new Response("{}", { status: 404 });
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("mostra o calendário do cliente da lista certa e guarda a leitura por 10 minutos", async () => {
    const client = await createClient(input("Serenity Terapias", "serenity-terapias"), null);
    const before = (await storage.list("")).map((f) => f.path);
    const vm = await loadPortalContent(client);
    expect(vm?.items.map((i) => i.id)).toEqual(["a1", "a2", "a5", "a6", "a8", "a10"]);
    expect(calls.filter((c) => c.endsWith("/task"))).toHaveLength(1);
    const written = (await storage.list("")).map((f) => f.path).filter((p) => !before.includes(p));
    expect(written.sort()).toEqual([`clients/${client.id}/content-cache.json`, "integrations/clickup/lists.json"]);

    await loadPortalContent(client);
    expect(calls.filter((c) => c.endsWith("/task"))).toHaveLength(1);
  });

  it("com o ClickUp fora do ar, o portal continua com a última leitura e o painel mostra o erro", async () => {
    const client = await createClient(input("Serenity Terapias", "serenity-terapias"), null);
    await loadPortalContent(client);
    vi.setSystemTime(new Date(NOW.getTime() + 11 * 60_000));
    fail = true;
    expect((await loadPortalContent(client))?.items).toHaveLength(6);
    const admin = await loadContentAdmin(client);
    expect(admin.data?.items).toHaveLength(11);
    expect(admin.error).toMatch(/ClickUp/);
    await expect(refreshContent(client.id)).rejects.toThrow(/ClickUp/);
    expect((await loadPortalContent(client))?.items).toHaveLength(6);
  });

  it("respeita as regras salvas no painel e não mexe em outros dados do cliente", async () => {
    const client = await createClient(input("Serenity Terapias", "serenity-terapias"), null);
    expect((await getContentSettings(client.id)).enabled).toBe(true);
    const clientJson = (await storage.get(`clients/${client.id}/client.json`))?.etag;
    await saveContentSettings(client.id, { enabled: true, listId: null, rules: { ...DEFAULT_CONTENT_RULES, showDescription: true } }, "adm@look");
    expect((await loadPortalContent(client))?.items.find((i) => i.id === "a6")?.description).toContain("mockup");
    await saveContentSettings(client.id, { enabled: false, listId: null, rules: DEFAULT_CONTENT_RULES }, "adm@look");
    expect(await loadPortalContent(client)).toBeNull();
    expect((await storage.get(`clients/${client.id}/client.json`))?.etag).toBe(clientJson);
  });

  it("cliente sem lista correspondente fica sem a área; a lista escolhida no painel vale no lugar do nome", async () => {
    const client = await createClient(input("Cliente Novo", "cliente-novo"), null);
    expect(await loadPortalContent(client)).toBeNull();
    await saveContentSettings(client.id, { enabled: true, listId: "901", rules: DEFAULT_CONTENT_RULES }, null);
    expect((await loadPortalContent(client))?.items).toHaveLength(6);
    const admin = await loadContentAdmin(client);
    expect(admin.resolved).toMatchObject({ auto: false, list: { id: "901", name: "SERENITY", folder: "BIANCA" } });
  });
});
