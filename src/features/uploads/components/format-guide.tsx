import type { ReactNode } from "react";
import { Info } from "lucide-react";
import type { UploadPlatform } from "@/features/uploads/schema";

type ReportType = "commercial" | "traffic";
type Cadence = "monthly" | "weekly";

const PLATFORM_NAME: Record<UploadPlatform, string> = { meta_ads: "Meta Ads", google_ads: "Google Ads" };

function Code({ children }: { children: ReactNode }) {
  return <code className="rounded bg-surface-3 px-1 py-px font-mono text-[12px] text-text">{children}</code>;
}

/** Exemplo pronto para colar — segue exatamente as regras do leitor (ver traffic/commercial normalize). */
export function pasteExample(type: ReportType, cadence: Cadence, platform: UploadPlatform | null): string {
  const period = cadence === "weekly" ? { head: "Período", values: ["21/09/2026 a 27/09/2026", "28/09/2026 a 04/10/2026"] } : { head: "Mês", values: ["01/2026", "02/2026"] };
  const table = (cols: string[], rows: string[][]) => [`| ${cols.join(" | ")} |`, `|${cols.map(() => "---").join("|")}|`, ...rows.map((r) => `| ${r.join(" | ")} |`)].join("\n");
  if (type === "commercial") {
    return [
      "## Funil",
      table([period.head, "Leads", "Agendamentos", "Comparecimentos"], [
        [period.values[0], "120", "30", "18"],
        [period.values[1], "140", "36", "22"],
      ]),
      "",
      "## Financeiro",
      table([period.head, "Receita", "Investimento em mídia", "Vendas"], [
        [period.values[0], "12.500,00", "1.800,00", "15"],
        [period.values[1], "14.200,00", "1.900,00", "17"],
      ]),
      "",
      "## Canais",
      table([period.head, "Canal", "Tipo", "Leads", "Vendas", "Receita"], [
        [period.values[0], "Instagram", "Mídia paga", "90", "10", "8.000,00"],
        [period.values[0], "Indicação", "Indicação", "30", "5", "4.500,00"],
        [period.values[1], "Instagram", "Mídia paga", "105", "12", "9.400,00"],
        [period.values[1], "Indicação", "Indicação", "35", "5", "4.800,00"],
      ]),
    ].join("\n");
  }
  const meta = ["Meta Ads", "Mensagens WhatsApp", "Conversas no WhatsApp"];
  const google = ["Google Ads", "Pesquisa", "Conversões"];
  const [first, second] = platform === "meta_ads" ? [meta, meta] : platform === "google_ads" ? [google, google] : [meta, google];
  const cols = [period.head, ...(platform ? [] : ["Plataforma"]), "Campanha", "Investimento", "Impressões", "Cliques", "Resultados", "Tipo de resultado"];
  const row = (p: string, [plat, campaign, kind]: string[], numbers: string[]) => [p, ...(platform ? [] : [plat]), campaign, ...numbers, kind];
  return table(cols, [row(period.values[0], first, ["397,88", "27.850", "640", "12"]), row(period.values[1], second, ["602,86", "41.300", "820", "54"])]);
}

/**
 * "Formato esperado" do passo de envio: as regras que o leitor aplica, no texto
 * que o ADM vê antes de enviar. Qualquer mudança no normalizador deve vir para cá.
 */
export function FormatGuide({ type, cadence, platform, source, periodChosen, onUseExample }: { type: ReportType; cadence: Cadence; platform: UploadPlatform | null; source: "file" | "paste"; periodChosen: boolean; onUseExample?: () => void }) {
  const paste = source === "paste";
  const weekly = cadence === "weekly";
  const periodRule = weekly ? (
    <>
      colunas <strong>Início</strong> e <strong>Fim</strong> da semana (<Code>21/09/2026</Code> e <Code>27/09/2026</Code>) ou uma coluna <strong>Período</strong> com <Code>21/09/2026 a 27/09/2026</Code>
    </>
  ) : (
    <>
      uma coluna <strong>Mês</strong> (<Code>01/2026</Code>, <Code>jan/2026</Code> ou <Code>janeiro de 2026</Code>) ou as colunas <strong>Início</strong> e <strong>Fim</strong>
    </>
  );
  const periodNote = periodChosen ? " Como você escolheu o período no passo anterior, a coluna de período pode ficar de fora." : "";

  return (
    <details open={paste} className="group rounded-[var(--radius-md)] border border-border-strong bg-surface-2/60 text-[13px] text-text-2">
      <summary className="flex items-center gap-2 px-3.5 py-2.5 font-bold text-text">
        <Info className="size-4 shrink-0 text-info" aria-hidden />
        Formato esperado {paste ? "dos dados colados" : "da planilha"}
        <span className="ml-auto text-xs font-semibold text-text-3 group-open:hidden">ver</span>
      </summary>
      <div className="space-y-2.5 border-t border-border px-3.5 pb-3.5 pt-3 leading-relaxed">
        <ul className="list-disc space-y-1.5 pl-4 marker:text-text-3">
          {paste ? (
            <li>
              Tabela em Markdown: a 1ª linha tem os nomes das colunas (<Code>| Mês | Investimento | Impressões |</Code>) e cada linha seguinte é um registro; a linha separadora <Code>|---|---|</Code> é opcional. Também dá para colar células copiadas do Excel ou do Google Sheets, <strong>com a linha de cabeçalho</strong>. A ordem das colunas não importa.
            </li>
          ) : (
            <li>
              XLSX, XLS ou CSV com a 1ª linha de cabeçalho. {type === "commercial" ? "Cada aba é uma seção (Funil, Financeiro, Canais…)." : "Pode ser a exportação do Meta Ads ou do Google Ads, ou o modelo de tráfego."} A ordem das colunas não importa.
            </li>
          )}

          {type === "traffic" ? (
            <>
              <li>
                <strong>Obrigatórias:</strong> {platform ? null : <><strong>Plataforma</strong> (Meta, Google, TikTok…), </>}
                <strong>Investimento</strong>, <strong>Impressões</strong> e o período: {periodRule}.{periodNote}
              </li>
              <li>
                Este cliente recebe tráfego <strong>{weekly ? "semanal" : "mensal"}</strong>:{" "}
                {weekly
                  ? "cada linha precisa caber numa semana (dias da mesma semana são somados). Linhas com o mês inteiro são recusadas."
                  : "cada linha precisa caber num mês (dias e semanas do mesmo mês são somados). Linhas que atravessam dois meses são recusadas."}
              </li>
              <li>
                <strong>Opcionais:</strong> Campanha (sem ela, cada linha vale como o total {platform ? `do ${PLATFORM_NAME[platform]}` : "da plataforma"} no período), Cliques, Cliques no link, Alcance, Resultados com Tipo de resultado (WhatsApp, Lead, Formulário, Ligação…), Conversões e Receita atribuída.
              </li>
              <li>
                O nome da coluna de resultado aparece para o cliente: uma coluna <strong>Contatos</strong> vira “Contatos” no portal. Sem resultados, as <strong>Conversões</strong> contam como resultado. Alcance, cliques e visualizações nunca contam como resultado.
              </li>
              {platform ? (
                <li>
                  Pode trazer <strong>vários períodos de uma vez</strong>. Em cada {weekly ? "semana" : "mês"}, só os dados de {PLATFORM_NAME[platform]} são trocados; as outras plataformas do relatório são mantidas. Linhas de outras plataformas são ignoradas.
                </li>
              ) : null}
            </>
          ) : (
            <>
              {paste ? (
                <li>
                  <strong>Uma tabela por seção</strong>, cada uma com o título na linha de cima: <Code>## Funil</Code> (obrigatória), <Code>## Financeiro</Code>, <Code>## Canais</Code>, <Code>## Indicadores</Code>, <Code>## Insights</Code>, <Code>## Contexto</Code>. Outro título (ex.: <Code>## Serviços</Code>) vira um detalhamento com esse nome. Só a primeira tabela pode ficar sem título: ela é lida como Funil.
                </li>
              ) : null}
              <li>
                Cada tabela tem a coluna do período: {weekly ? <><strong>Período</strong> com a data da semana (<Code>21/09/2026</Code> ou <Code>21/09/2026 a 27/09/2026</Code>)</> : <><strong>Mês</strong> (<Code>01/2026</Code> ou <Code>janeiro de 2026</Code>)</>}, uma linha por {weekly ? "semana" : "mês"}.{periodNote}
              </li>
              <li>
                <strong>Funil:</strong> as colunas além do período são as etapas, na ordem (Leads, Agendamentos, Comparecimentos…); colunas de taxa ou total são ignoradas. <strong>Financeiro:</strong> Receita, Investimento em mídia, Vendas, Receita atribuída. <strong>Canais:</strong> Canal, Tipo (Mídia paga, Orgânico, Indicação…), Leads, Vendas, Receita, Investimento.
              </li>
            </>
          )}

          <li>
            Números como <Code>1.234,56</Code> ou <Code>1234.56</Code>; pode ter <Code>R$</Code> e <Code>%</Code>. Célula vazia ou com <Code>-</Code> é “não informado”, não zero. Linhas de <strong>Total</strong> são ignoradas.
          </li>
        </ul>
        {paste && onUseExample ? (
          <button type="button" onClick={onUseExample} className="text-[13px] font-semibold text-primary hover:underline">
            Inserir exemplo no campo
          </button>
        ) : null}
      </div>
    </details>
  );
}
