import type { ReactNode } from "react";
import { Info } from "lucide-react";
import type { UploadPlatform } from "@/features/uploads/schema";
import type { ReportType } from "@/features/reports/schema";
type Cadence = "monthly" | "weekly";

const PLATFORM_NAME: Record<UploadPlatform, string> = { meta_ads: "Meta Ads", google_ads: "Google Ads" };

function Code({ children }: { children: ReactNode }) {
  return <code className="rounded bg-surface-3 px-1 py-px font-mono text-[12px] text-text">{children}</code>;
}

/** Exemplo pronto para colar — segue exatamente as regras do leitor (ver traffic/commercial normalize). */
export function pasteExample(type: ReportType, cadence: Cadence, platform: UploadPlatform | null): string {
  const period = cadence === "weekly" ? { head: "Período", values: ["21/09/2026 a 27/09/2026", "28/09/2026 a 04/10/2026"] } : { head: "Mês", values: ["01/2026", "02/2026"] };
  const table = (cols: string[], rows: string[][]) => [`| ${cols.join(" | ")} |`, `|${cols.map(() => "---").join("|")}|`, ...rows.map((r) => `| ${r.join(" | ")} |`)].join("\n");
  if (type === "media_plan") return MEDIA_PLAN_EXAMPLE(table);
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

/** Plano de mídia no formato do modelo "Estratégia de Mídia" (valores fictícios). Segue as regras de media-plan/normalize. */
function MEDIA_PLAN_EXAMPLE(table: (cols: string[], rows: string[][]) => string): string {
  return [
    "## Apresentação",
    table(["Campo", "Valor"], [
      ["Título", "Estratégia de Mídia — Clínica Exemplo"],
      ["Chamada", "Captação contínua + ações especiais"],
      ["Resumo", "R$ 50 por dia para manter a captação ativa o mês inteiro, com reforço flexível em semanas especiais."],
      ["Etiquetas", "Ciclo contínuo · 30 dias; Verba dinâmica; Meta Ads · WhatsApp"],
      ["Atualizado em", "22/09/2026"],
    ]),
    "",
    "## Resumo",
    table(["Indicador", "Valor", "Descrição"], [
      ["Orçamento-base", "R$ 1.500", "30 dias de captação"],
      ["Dia normal", "R$ 50", "campanha contínua"],
      ["Dia especial", "R$ 70", "R$ 40 contínua + R$ 30 ação"],
    ]),
    "",
    "## Plano",
    table(["Campanha", "Plataforma", "Objetivo", "Funil", "Verba", "Diário", "Público", "Ofertas", "Observações"], [
      ["Captação contínua — Implantes", "Meta Ads", "Conversas no WhatsApp", "Meio / fundo", "1.500,00", "50,00", "Cidade e região · público amplo", "Implantes; próteses e facetas como variações", "Operação permanente"],
    ]),
    "",
    "## Plataformas",
    table(["Plataforma", "Descrição"], [["Meta Ads", "R$ 50/dia durante 30 dias, com destino ao WhatsApp da clínica."]]),
    "",
    "## Metas",
    table(["Meta", "Valor", "Descrição"], [
      ["Conversas da contínua", "60–125", "R$ 1.500 ÷ R$ 12–25 · estimativa inicial"],
      ["Custo por conversa", "R$ 12–25", "investimento ÷ novas conversas"],
      ["Taxa de qualificação", "≥ 30%", "qualificadas ÷ conversas"],
    ]),
    "",
    "## Conteúdo",
    table(["Seção", "Formato", "Título", "Texto", "Etiqueta", "Posição"], [
      ["Direção executiva", "Texto", "", "Campanha contínua de R$ 50/dia; nas ações especiais, a contínua vai a R$ 40/dia e a especial recebe R$ 30/dia.", "", "Topo"],
      ["Direção executiva", "Destaque", "Modelo flexível", "Total do mês = R$ 1.500 + R$ 20 por dia de ação especial.", "", ""],
      ["Por que essas campanhas", "Cartão", "Captação contínua", "Mantém o aprendizado e o fluxo de conversas o mês inteiro.", "R$ 50/dia", ""],
      ["Por que essas campanhas", "Cartão", "Ação especial", "Gera um pico controlado de procura sem desligar a contínua.", "R$ 30/dia", ""],
      ["Como funciona uma semana especial", "Passo", "Definição", "A clínica informa procedimento, datas e condição aprovada.", "", ""],
      ["Como funciona uma semana especial", "Passo", "Encerramento", "Na data final, a especial é pausada e a contínua volta a R$ 50/dia.", "", ""],
      ["Atendimento no WhatsApp", "Mensagem", "Mensagem da captação", "Olá! Vi o anúncio e gostaria de saber mais.", "", ""],
      ["Atendimento no WhatsApp", "Item", "Conversa qualificada", "Interesse no tratamento anunciado.", "", ""],
      ["Atendimento no WhatsApp", "Item", "Conversa qualificada", "Responde serviço e prazo.", "", ""],
      ["Matriz de criativos", "Tabela", "", "Matriz de criativos", "", ""],
      ["Matriz de criativos", "Destaque", "Produção", "Quatro vídeos verticais e duas peças 4:5 para a campanha contínua.", "", ""],
      ["Compliance", "Alerta", "Sem antes/depois", "Casos clínicos só com identificação do profissional e TCLE.", "", ""],
      ["Plano de otimização", "Fase", "Dia normal", "Contínua a R$ 50/dia / Otimizar por conversa qualificada", "", ""],
      ["Plano de otimização", "Fase", "Durante a ação", "Contínua R$ 40/dia + especial R$ 30/dia / Acompanhar a capacidade de atendimento", "", ""],
    ]),
    "",
    "## Matriz de criativos",
    table(["Frente", "Ângulo", "Gancho", "CTA"], [
      ["Implantes", "Função e segurança", "Perdeu um dente e quer entender as opções?", "Agende sua avaliação."],
      ["Ação especial", "Janela temática", "Nesta semana, uma agenda especial para [procedimento].", "Consulte os horários."],
    ]),
  ].join("\n");
}

/**
 * "Formato esperado" do passo de envio: as regras que o leitor aplica, no texto
 * que o ADM vê antes de enviar. Qualquer mudança no normalizador deve vir para cá.
 */
export function FormatGuide({
  type,
  cadence,
  platform,
  source,
  periodChosen,
  retroactive,
  onUseExample,
}: {
  type: ReportType;
  cadence: Cadence;
  platform: UploadPlatform | null;
  source: "file" | "paste";
  periodChosen: boolean;
  retroactive?: boolean;
  onUseExample?: () => void;
}) {
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
              XLSX, XLS ou CSV com a 1ª linha de cabeçalho.{" "}
              {type === "commercial" ? "Cada aba é uma seção (Funil, Financeiro, Canais…)." : type === "media_plan" ? "Cada aba é uma seção do plano (Plano, Apresentação, Resumo, Metas, Conteúdo…)." : "Pode ser a exportação do Meta Ads ou do Google Ads, ou o modelo de tráfego."} A ordem das colunas não importa.
            </li>
          )}

          {type === "media_plan" ? (
            <>
              <li>
                {paste ? "Uma tabela por seção, cada uma com o título na linha de cima. " : null}
                <strong>{paste ? "## Plano" : "Aba Plano"}</strong> (obrigatória): uma linha por campanha, com <strong>Campanha</strong>, <strong>Plataforma</strong> e <strong>Verba</strong>. Opcionais: Objetivo, Funil, Diário, Público, Ofertas, Formato, Início e Fim, Meta e Tipo de resultado, Custo por resultado, Observações. O percentual de cada campanha é calculado pelo portal.
              </li>
              <li>
                <strong>Apresentação</strong> (Campo | Valor): Título, Chamada, Resumo, Etiquetas (separadas por <Code>;</Code>) e Atualizado em. <strong>Resumo</strong> e <strong>Metas</strong>: Indicador | Valor | Descrição — o valor pode ser uma faixa (<Code>60–125</Code>, <Code>≥ 30%</Code>) e aparece exatamente como foi escrito. <strong>Plataformas</strong>: Plataforma | Descrição.
              </li>
              <li>
                <strong>Conteúdo</strong>: Seção | Formato | Título | Texto | Etiqueta | Posição — uma linha por bloco, na ordem em que aparece. Formatos: Texto, Destaque, Cartão, Passo, Item, Mensagem, Alerta, Fase (na Fase, separe as linhas com <Code> / </Code>) e Tabela (no Texto, o título da tabela que entra naquele ponto). <Code>Topo</Code> na Posição põe a seção logo depois do resumo.
              </li>
              <li>
                Qualquer outro título (ex.: <Code>{paste ? "## Matriz de criativos" : "Matriz de criativos"}</Code>, <Code>Cenários</Code>) vira uma tabela no plano, exatamente como veio. Ela entra onde o Conteúdo marcar (Formato Tabela) ou na seção de mesmo nome; senão, no fim.
              </li>
              <li>
                {periodChosen ? "O mês escolhido no passo anterior vale para todas as tabelas." : "Escolha o mês no passo anterior."} Para enviar vários meses de uma vez, inclua a coluna <strong>Mês</strong> (<Code>10/2026</Code>) em todas as tabelas.
              </li>
            </>
          ) : type === "traffic" ? (
            <>
              {retroactive ? (
                <li>
                  <strong>Meses anteriores (retroativo):</strong> mande quantos meses quiser no mesmo envio, com a coluna <strong>Mês</strong> (ou Início e Fim) em cada linha. Os meses são sempre mensais, mesmo que o cliente receba tráfego semanal. Meses que já estão no portal ficam desmarcados na prévia e não são alterados.
                </li>
              ) : null}
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
