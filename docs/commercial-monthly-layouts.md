# Importações mensais nos layouts comerciais

Os clientes `dra-isabor-sant-anna`, `serenity-terapias`, `instituto-landim` e `larplan` têm um adaptador mensal específico. Os demais clientes e áreas mantêm o fluxo existente.

No assistente de upload, selecione o cliente e baixe **Comercial · nome do cliente (XLSX)**. A rota autenticada `/api/adm/modelos/comercial/[profile]` gera um modelo sem valores fictícios. Troque o período em todas as linhas preenchidas. Cada linha representa um mês e um item. Não preencha totais ou acumulados.

## Contrato de entrada

| Cliente | Funil | Detalhamentos específicos |
| --- | --- | --- |
| Isabor | Leads, Agendamentos, Comparecimentos | Instagram, Google Ads, Indicação, Doctoralia e Outros; oportunidades futuras |
| Serenity | Leads, Agendamentos, Comparecimentos, Dias registrados | Novos e recorrentes; canais; Massagens; Terapeutas |
| Instituto Landim | Leads, Conversões totais | Novos pacientes, IAD, Clivale, conversões indiretas, cirurgias, marcações futuras, perfil dos leads, procedimentos, receita por tipo e tabelas de cirurgias e receita |
| Larplan | Leads, Em contato, Propostas enviadas, Vendas | Google Ads, Meta Ads, Cliente Recorrente e meta de conversão opcional |

Todos têm Financeiro, Canais, Insights, Notas, Comparativo, Contexto e Plano de ação. Os nomes dos canais, dimensões e indicadores do modelo são o contrato do adaptador. Novos itens dentro de uma dimensão são aceitos. Valores vazios permanecem ausentes; zero continua sendo zero. Use texto como `15%` ou uma célula percentual para taxas. Receita total e receita atribuída são independentes.

## Histórico e substituições

- O fechamento original continua disponível sem mudar os snapshots. Planilhas antigas, derivadas desses relatórios, não são tratadas como correções oficiais automaticamente.
- A aba **Layout comercial** identifica o cliente e permite substituir explicitamente um mês histórico pelo novo modelo. Não remova nem edite essa aba. Um modelo identificado para outro cliente é recusado na validação.
- Meses posteriores ao fechamento original entram automaticamente no layout próprio. HTML estruturado pode usar `layoutProfile` para corrigir um período histórico (`isabor`, `serenity`, `landim` ou `larplan`).
- Cada mês importado substitui o mês de referência inteiro. Envie todas as seções daquele mês. Correções não são somadas à versão anterior. O fluxo existente de importações parciais conserva o identificador do layout.
- A visão do cliente considera somente versões publicadas. A prévia considera rascunhos e prioriza a versão explicitamente aberta. Anos, clientes e periodicidades não são misturados. Um período que só contém documento não é substituído pelo mês anterior.
- Os dados mensais não existentes na origem permanecem ausentes. Na Serenity, receitas orgânicas, receitas de serviços e receitas de terapeutas constam apenas como acumulados no original. O adaptador preserva esses acumulados quando todo o intervalo histórico está intacto e acrescenta somente os novos meses explicitamente informados. Se um mês histórico desse intervalo for corrigido, o acumulado requer os dados mensais correspondentes e fica ausente quando não há base para recalculá-lo. Não é feita distribuição proporcional inventada.
- Totais com observações ausentes não viram zero. Os indicadores e gráficos não recebem valores de planilhas derivadas para preencher lacunas da fonte oficial.
- Conversão e ticket são ponderados pelos volumes. Retorno de canal usa receita daquele canal. Serenity usa ROI líquido dos canais pagos: `(receita atribuída − investimento pago) / investimento pago`. Isabor e Larplan usam multiplicador de retorno. Os insights editoriais antigos não são reapresentados como análise de um mês novo.

## Validação

`tests/commercial-live.test.ts` exercita modelos XLSX reais pelo fluxo de upload, normalização, rascunho, prévia, publicação, seleção do portal e geração de todos os gráficos. Inclui correção de mês sem duplicação, separação entre receita total e atribuída, percentuais, dados ausentes, troca de ano, isolamento de cliente e escape dos textos importados.

As configurações de gráficos são serializáveis e os formatadores de tooltip são adicionados no cliente, sem `eval`. A biblioteca é carregada sob demanda e cada instância é destruída ao trocar de aba. Dados e snapshots completos permanecem no servidor; somente o relatório autorizado é enviado ao navegador. A paleta usa os tokens existentes do portal.
