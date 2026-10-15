import * as XLSX from "xlsx";
import { profileNames, type CommercialProfile } from "./profiles";

type Row = Array<string | number | null>;
/** Blank measures are intentional. Templates contain no fictional business values. */
export function clientCommercialWorkbook(
  profile: CommercialProfile,
): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();
  const add = (name: string, rows: Row[]) => {
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws["!cols"] = rows[0].map((_, i) => ({ wch: i === 0 ? 14 : 25 }));
    XLSX.utils.book_append_sheet(wb, ws, name);
  };
  const period = "09/2026";
  add("Layout comercial", [
    ["Perfil", "Versão"],
    [profile, 1],
  ]);
  add("Instruções", [
    [`Modelo comercial · ${profileNames[profile]}`],
    [
      "Mantenha a aba Layout comercial: ela identifica o formato e permite atualizar meses históricos com o modelo correto.",
    ],
    [
      "Troque o período em TODAS as linhas preenchidas. Uma linha por mês e item. Pode enviar vários meses.",
    ],
    [
      "Preencha as medidas em branco. Zero significa zero; célula vazia significa não informado. Nunca use uma linha Total.",
    ],
    [
      "Funil: mantenha os nomes e a ordem das etapas. Financeiro: receita total e receita atribuída à mídia são campos distintos.",
    ],
    [
      "Canais: use os nomes fornecidos. Receita e conversões correspondem somente a esse canal. Não repita o total em cada canal.",
    ],
    [
      "Preencha todas as seções do mês que deseja atualizar. Reenvio cria uma versão e substitui o mês; os meses anteriores são preservados.",
    ],
    [
      "Percentuais: use texto com % (ex.: 15%) ou células formatadas como percentual. ROI, ticket e conversão são calculados.",
    ],
    [
      "Insights, Notas, Comparativo e Plano de ação devem descrever o mês enviado; análises antigas não são copiadas automaticamente.",
    ],
    [
      "Remova linhas opcionais sem uso. Confira a validação e a prévia antes de publicar. O XLSX alimenta o painel; PDF/HTML comum é apenas documento.",
    ],
  ]);
  add(
    "Funil",
    profile === "landim"
      ? [
          ["Período", "Leads", "Conversões totais"],
          [period, null, null],
        ]
      : profile === "larplan"
        ? [
            ["Período", "Leads", "Em contato", "Propostas enviadas", "Vendas"],
            [period, null, null, null, null],
          ]
        : [
            [
              "Período",
              "Leads",
              "Agendamentos",
              "Comparecimentos",
              "Dias registrados",
            ],
            [period, null, null, null, null],
          ],
  );
  add("Financeiro", [
    [
      "Período",
      "Receita",
      "Investimento em mídia",
      "Vendas",
      "Receita atribuída",
    ],
    [period, null, null, null, null],
  ]);
  if (profile === "serenity" || profile === "landim")
    add("Clientes", [
      ["Período", "Novos clientes", "Clientes recorrentes"],
      [period, null, null],
    ]);
  const channels =
    profile === "serenity"
      ? [
          ["ADS (Meta) Instagram + Facebook", "Mídia paga"],
          ["Google", "Orgânico"],
          ["Cliente Recorrente VIP", "Recorrente"],
          ["Indicação", "Indicação"],
          ["Panfleto China", "Offline"],
          ["Sites de Massagem", "Mídia paga"],
          ["Sublocação", "Parceria"],
          ["Site da Isa", "Orgânico"],
        ]
      : profile === "isabor"
        ? [
            ["Instagram", "Mídia paga"],
            ["Google Ads", "Mídia paga"],
            ["Indicação", "Indicação"],
            ["Doctoralia", "Plataforma"],
            ["Outros", "Outro"],
          ]
        : profile === "landim"
          ? [
              ["Google Ads", "Mídia paga"],
              ["Meta Ads", "Mídia paga"],
              ["Indicação", "Indicação"],
            ]
          : [
              ["Google Ads", "Mídia paga"],
              ["Meta Ads", "Mídia paga"],
              ["Cliente Recorrente", "Recorrente"],
            ];
  add("Canais", [
    [
      "Período",
      "Canal",
      "Tipo",
      "Leads",
      "Conversões",
      "Receita",
      "Investimento",
      "Novos pacientes",
    ],
    ...channels.map(([label, kind]) => [
      period,
      label,
      kind,
      null,
      null,
      null,
      null,
      null,
    ]),
  ]);
  const dim = (name: string, labels: string[]) =>
    add(name, [
      ["Período", "Item", "Quantidade", "Receita", "Status"],
      ...labels.map((label) => [period, label, null, null, null]),
    ]);
  if (profile === "serenity") {
    dim("Massagens", ["Nuru", "Tailandesa", "Vivência", "Tântrica"]);
    dim("Terapeutas", []);
  }
  if (profile === "landim") {
    dim("Perfil dos leads", ["Convênio", "Particular", "Não informado"]);
    dim("Procedimentos", ["Consulta", "Fisioterapia", "Acupuntura"]);
    dim("Receita por tipo", ["Convênio", "Particular"]);
    add("Cirurgias geradas", [["Período", "Paciente", "Descrição", "Canal"]]);
    add("Receita detalhada", [
      ["Período", "Paciente", "Canal", "Tipo", "Valor"],
    ]);
    add("Indicadores", [
      ["Período", "Indicador", "Valor", "Formato"],
      ...[
        "IAD",
        "Clivale",
        "Conversões indiretas",
        "Cirurgias geradas",
        "Marcações para mês seguinte",
        "Custo por lead pago",
        "Custo por conversão pago",
        "Novos pacientes pago",
      ].map((label) => [
        period,
        label,
        null,
        label.startsWith("Custo") ? "Moeda" : "Número",
      ]),
    ]);
  }
  if (profile === "larplan")
    add("Indicadores", [
      ["Período", "Indicador", "Valor", "Formato"],
      [period, "Meta de conversão", null, "Percentual"],
    ]);
  add("Insights", [["Período", "Tipo", "Tema", "Título", "Descrição"]]);
  add("Notas", [["Período", "Seção", "Texto"]]);
  add("Comparativo", [["Período", "Indicador", "Leitura"]]);
  add("Contexto", [["Período", "Título", "Descrição"]]);
  add("Plano de ação", [["Período", "Prioridade", "Ação", "Detalhes"]]);
  if (profile === "isabor")
    add("Oportunidades", [["Período", "Origem", "Data agendada", "Situação"]]);
  return wb;
}
