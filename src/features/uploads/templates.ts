import * as XLSX from "xlsx";

/**
 * Modelos de planilha oferecidos no assistente (public/modelos) — também usados
 * como fixtures nos testes do importador. Valores fictícios.
 */
type Row = Array<string | number | Date | null>;

function sheet(rows: Row[], widths?: number[]) {
  const ws = XLSX.utils.aoa_to_sheet(rows, { cellDates: true });
  if (widths) ws["!cols"] = widths.map((w) => ({ wch: w }));
  return ws;
}

export function commercialTemplateWorkbook(): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    wb,
    sheet(
      [
        ["Modelo Portal Look — Relatório Comercial"],
        ["Cada aba é opcional, exceto Funil. Use uma linha por período (mês) e item."],
        ["Funil: as colunas depois de Período são as etapas, na ordem (Leads, Agendamentos, Comparecimentos… — use os nomes do cliente)."],
        ["Deixe a célula vazia quando a etapa não foi registrada (diferente de zero)."],
        ["Canais — Tipo: Mídia paga, Orgânico, Indicação, Recorrente, Plataforma, Offline, Parceria ou Outro."],
        ["Abas extras (Serviços, Profissionais, Unidades, Produtos…) viram detalhamentos automaticamente."],
        ["Insights — Tipo: Positivo, Atenção, Recomendação ou Neutro."],
      ],
      [110],
    ),
    "Instruções",
  );
  XLSX.utils.book_append_sheet(
    wb,
    sheet(
      [
        ["Período", "Leads", "Agendamentos", "Comparecimentos"],
        ["08/2026", 257, 14, 8],
        ["09/2026", 281, 17, 11],
      ],
      [12, 10, 16, 18],
    ),
    "Funil",
  );
  XLSX.utils.book_append_sheet(
    wb,
    sheet(
      [
        ["Período", "Receita", "Investimento em mídia", "Vendas", "Receita atribuída"],
        ["08/2026", 3400, 1208.17, null, null],
        ["09/2026", 4675, 1260.4, null, null],
      ],
      [12, 12, 22, 10, 18],
    ),
    "Financeiro",
  );
  XLSX.utils.book_append_sheet(
    wb,
    sheet(
      [
        ["Período", "Canal", "Tipo", "Leads", "Conversões", "Receita", "Investimento"],
        ["09/2026", "Instagram", "Mídia paga", 231, 3, 1275, 700.2],
        ["09/2026", "Google Ads", "Mídia paga", 30, 2, 850, 560.2],
        ["09/2026", "Indicação", "Indicação", 8, 4, 1700, null],
        ["09/2026", "Doctoralia", "Plataforma", 7, 1, 425, null],
        ["09/2026", "Outros", "Outro", 5, 1, 425, null],
      ],
      [12, 16, 14, 8, 12, 10, 14],
    ),
    "Canais",
  );
  XLSX.utils.book_append_sheet(
    wb,
    sheet(
      [
        ["Período", "Serviço", "Atendimentos", "Receita"],
        ["09/2026", "Consulta", 9, 3825],
        ["09/2026", "Retorno", 2, 850],
      ],
      [12, 20, 14, 10],
    ),
    "Serviços",
  );
  XLSX.utils.book_append_sheet(
    wb,
    sheet(
      [
        ["Período", "Indicador", "Valor", "Formato", "Direção"],
        ["09/2026", "Marcações para o mês seguinte", 4, "Número", "Maior é melhor"],
      ],
      [12, 32, 8, 10, 16],
    ),
    "Indicadores",
  );
  XLSX.utils.book_append_sheet(
    wb,
    sheet(
      [
        ["Período", "Tipo", "Título", "Descrição"],
        ["09/2026", "Positivo", "Mais comparecimentos", "Os comparecimentos subiram em relação a agosto."],
        ["09/2026", "Recomendação", "Reforçar indicação", "Indicação segue como o canal de maior conversão."],
      ],
      [12, 14, 30, 60],
    ),
    "Insights",
  );
  return wb;
}

export function trafficTemplateWorkbook(): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    wb,
    sheet(
      [
        ["Modelo Portal Look — Relatório de Tráfego"],
        ["Uma linha por campanha. Início e Fim no formato DD/MM/AAAA (semana de segunda a domingo)."],
        ["Obrigatórias: Plataforma, Campanha, Investimento, Impressões. As demais são opcionais."],
        ["Tipo de resultado: Conversas no WhatsApp, Leads, Formulários, Compras, Agendamentos, Ligações, Conversões, Visitas ou outro texto."],
        ["CTR, CPC, CPM e custo por resultado são calculados pelo portal — não precisam ser preenchidos."],
      ],
      [110],
    ),
    "Instruções",
  );
  XLSX.utils.book_append_sheet(
    wb,
    sheet(
      [
        ["Cliente", "Início", "Fim", "Plataforma", "Campanha", "Investimento", "Impressões", "Alcance", "Cliques", "Cliques no link", "Resultados", "Tipo de resultado"],
        ["Dra. Isabor Sant'Anna", "21/09/2026", "27/09/2026", "Meta Ads", "CAMP. 02 — Captação | Novo Site", 144.68, 5755, 3860, null, 75, 11, "Conversas no WhatsApp"],
        ["Dra. Isabor Sant'Anna", "21/09/2026", "27/09/2026", "Google Ads", "Look Assessoria | Pesquisa | Leads", 175.82, 6513, null, 216, null, 9, "Leads"],
      ],
      [22, 12, 12, 12, 36, 13, 12, 10, 9, 14, 11, 22],
    ),
    "Campanhas",
  );
  XLSX.utils.book_append_sheet(
    wb,
    sheet(
      [
        ["Início", "Tipo", "Título", "Descrição"],
        ["21/09/2026", "Positivo", "Google Ads com CTR acima de 3%", "A campanha de pesquisa manteve boa taxa de cliques."],
      ],
      [12, 12, 34, 60],
    ),
    "Insights",
  );
  return wb;
}

/** Plano de mídia no formato do modelo "Estratégia de Mídia" (ver media-plan/normalize). */
export function mediaPlanTemplateWorkbook(): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    wb,
    sheet(
      [
        ["Modelo Portal Look — Plano de mídia"],
        ["Plano (obrigatória): uma linha por campanha. Campanha, Plataforma e Verba são obrigatórias; o percentual é calculado pelo portal."],
        ["Mês: escolha no assistente ou inclua a coluna Mês (ex.: 10/2026) em todas as abas para enviar vários meses."],
        ["Apresentação: Campo | Valor (Título, Chamada, Resumo, Etiquetas separadas por ;, Atualizado em)."],
        ["Resumo e Metas: Indicador | Valor | Descrição. O valor pode ser faixa (60–125) ou texto (≥ 30%) e aparece como foi escrito."],
        ["Conteúdo: uma linha por bloco. Formatos: Texto, Destaque, Cartão, Passo, Item, Mensagem, Alerta, Fase (linhas separadas por ' / ') e Tabela. Posição 'Topo' = logo depois do resumo."],
        ["Qualquer outra aba (ex.: Matriz de criativos) aparece no plano como tabela, exatamente como está — no ponto marcado com Formato 'Tabela' (Texto = nome da aba)."],
      ],
      [120],
    ),
    "Instruções",
  );
  XLSX.utils.book_append_sheet(
    wb,
    sheet(
      [
        ["Campo", "Valor"],
        ["Título", "Estratégia de Mídia — Clínica Exemplo"],
        ["Chamada", "Captação contínua + ações especiais"],
        ["Resumo", "R$ 50 por dia para manter a captação ativa o mês inteiro, com reforço flexível em semanas especiais."],
        ["Etiquetas", "Ciclo contínuo · 30 dias; Verba dinâmica; Meta Ads · WhatsApp"],
        ["Atualizado em", "22/09/2026"],
      ],
      [16, 90],
    ),
    "Apresentação",
  );
  XLSX.utils.book_append_sheet(
    wb,
    sheet(
      [
        ["Indicador", "Valor", "Descrição"],
        ["Orçamento-base", "R$ 1.500", "30 dias de captação"],
        ["Dia normal", "R$ 50", "campanha contínua"],
        ["Dia especial", "R$ 70", "R$ 40 contínua + R$ 30 ação"],
      ],
      [18, 12, 30],
    ),
    "Resumo",
  );
  XLSX.utils.book_append_sheet(
    wb,
    sheet(
      [
        ["Campanha", "Plataforma", "Objetivo", "Funil", "Verba", "Diário", "Público", "Ofertas", "Início", "Fim", "Observações"],
        ["Captação contínua — Implantes", "Meta Ads", "Conversas no WhatsApp", "Meio / fundo", 1500, 50, "Cidade e região · público amplo", "Implantes; próteses e facetas como variações", null, null, "Operação permanente"],
      ],
      [32, 12, 22, 14, 10, 10, 30, 36, 12, 12, 30],
    ),
    "Plano",
  );
  XLSX.utils.book_append_sheet(wb, sheet([["Plataforma", "Descrição"], ["Meta Ads", "R$ 50/dia durante 30 dias, com destino ao WhatsApp da clínica."]], [14, 70]), "Plataformas");
  XLSX.utils.book_append_sheet(
    wb,
    sheet(
      [
        ["Meta", "Valor", "Descrição"],
        ["Conversas da contínua", "60–125", "R$ 1.500 ÷ R$ 12–25 · estimativa inicial"],
        ["Custo por conversa", "R$ 12–25", "investimento ÷ novas conversas"],
        ["Taxa de qualificação", "≥ 30%", "qualificadas ÷ conversas"],
      ],
      [24, 12, 40],
    ),
    "Metas",
  );
  XLSX.utils.book_append_sheet(
    wb,
    sheet(
      [
        ["Seção", "Formato", "Título", "Texto", "Etiqueta", "Posição"],
        ["Direção executiva", "Texto", null, "Campanha contínua de R$ 50/dia; nas ações especiais, a contínua vai a R$ 40/dia e a especial recebe R$ 30/dia.", null, "Topo"],
        ["Direção executiva", "Destaque", "Modelo flexível", "Total do mês = R$ 1.500 + R$ 20 por dia de ação especial.", null, null],
        ["Por que essas campanhas", "Cartão", "Captação contínua", "Mantém o aprendizado e o fluxo de conversas o mês inteiro.", "R$ 50/dia", null],
        ["Como funciona uma semana especial", "Passo", "Definição", "A clínica informa procedimento, datas e condição aprovada.", null, null],
        ["Atendimento no WhatsApp", "Mensagem", "Mensagem da captação", "Olá! Vi o anúncio e gostaria de saber mais.", null, null],
        ["Atendimento no WhatsApp", "Item", "Conversa qualificada", "Interesse no tratamento anunciado.", null, null],
        ["Matriz de criativos", "Tabela", null, "Matriz de criativos", null, null],
        ["Matriz de criativos", "Destaque", "Produção", "Quatro vídeos verticais e duas peças 4:5 para a campanha contínua.", null, null],
        ["Compliance", "Alerta", "Sem antes/depois", "Casos clínicos só com identificação do profissional e TCLE.", null, null],
        ["Plano de otimização", "Fase", "Durante a ação", "Contínua R$ 40/dia + especial R$ 30/dia / Acompanhar a capacidade de atendimento", null, null],
      ],
      [30, 12, 22, 70, 12, 10],
    ),
    "Conteúdo",
  );
  XLSX.utils.book_append_sheet(
    wb,
    sheet(
      [
        ["Frente", "Ângulo", "Gancho", "CTA"],
        ["Implantes", "Função e segurança", "Perdeu um dente e quer entender as opções?", "Agende sua avaliação."],
      ],
      [16, 20, 46, 24],
    ),
    "Matriz de criativos",
  );
  return wb;
}

export function workbookBuffer(wb: XLSX.WorkBook, bookType: "xlsx" | "xls" = "xlsx"): Buffer {
  return Buffer.from(XLSX.write(wb, { type: "buffer", bookType }) as Buffer);
}

export const CSV_TRAFFIC_EXAMPLE = `Início;Fim;Plataforma;Campanha;Investimento;Impressões;Alcance;Resultados;Tipo de resultado
21/09/2026;27/09/2026;Meta Ads;SETEMBRO-26 | Itens em promoção;174,91;6.220;4.343;37;Conversas no WhatsApp
21/09/2026;27/09/2026;Meta Ads;Lauro de Freitas - campanha;132,66;3.361;2.065;16;Conversas no WhatsApp
21/09/2026;27/09/2026;Meta Ads;Cidades com Unidade IL | Captação de Leads | WhatsApp;193,42;26.457;25.087;51;Conversas no WhatsApp
`;

export const CSV_FUNNEL_EXAMPLE = `Período;Etapa;Ordem;Quantidade
09/2026;Leads;1;52
09/2026;Em contato;2;
09/2026;Propostas enviadas;3;
09/2026;Vendas;4;5
`;

export function structuredHtmlExample(): string {
  const payload = {
    type: "commercial",
    client: "isabor",
    data: {
      schemaVersion: 1,
      period: { start: "2026-09-01", end: "2026-09-30", granularity: "month" },
      currency: "BRL",
      funnel: [
        { key: "leads", label: "Leads", order: 1, value: 281 },
        { key: "agendamentos", label: "Agendamentos", order: 2, value: 17 },
        { key: "comparecimentos", label: "Comparecimentos", order: 3, value: 11 },
      ],
      financial: { revenue: 4675, mediaInvestment: 1260.4 },
      channels: [{ key: "instagram", label: "Instagram", kind: "paid", leads: 231, conversions: 3, revenue: 1275, investment: 700.2 }],
    },
    insights: [{ type: "positive", title: "Mais comparecimentos", description: "Subiram em relação a agosto." }],
  };
  return `<!doctype html>
<html lang="pt-BR">
<head><meta charset="utf-8"><title>Relatório comercial — setembro de 2026</title></head>
<body>
<!-- O Portal Look lê apenas o bloco abaixo; o restante do HTML é ignorado. -->
<script type="application/json" id="portal-look-data">
${JSON.stringify(payload, null, 2)}
</script>
</body>
</html>
`;
}
