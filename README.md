# Portal Look

Portal de relatórios e dashboards dos clientes da **Look Assessoria de Comunicação**.

**A mesma aplicação, com dados e configurações diferentes, gera um dashboard personalizado para cada cliente.** Não é preciso criar páginas novas para um cliente novo.

- **Painel da Look (`/adm`):** cadastro de clientes, periodicidade das entregas, upload de relatórios, validação, rascunho → publicação, status de pendências, links exclusivos e histórico.
- **Portal do cliente (`/c/{slug}/{token}`):** sem login. O cliente abre um link exclusivo e vê Comercial e Tráfego, período a período, pensado primeiro para o celular.

---

## Sumário

1. [Arquitetura](#arquitetura)
2. [Instalação e desenvolvimento](#instalação-e-desenvolvimento)
3. [Build, testes e qualidade](#build-testes-e-qualidade)
4. [Variáveis de ambiente](#variáveis-de-ambiente)
5. [Storage](#storage)
6. [Autenticação do ADM](#autenticação-do-adm)
7. [Links dos clientes e segurança](#links-dos-clientes-e-segurança)
8. [Estrutura de arquivos](#estrutura-de-arquivos)
9. [Modelo de dados](#modelo-de-dados)
10. [Como criar um cliente](#como-criar-um-cliente)
11. [Como fazer upload](#como-fazer-upload)
12. [Como publicar](#como-publicar)
13. [Formatos de arquivo aceitos](#formatos-de-arquivo-aceitos)
14. [Status de entrega](#status-de-entrega)
15. [Vercel Blob](#como-configurar-o-vercel-blob)
16. [Deploy na Vercel](#deploy-na-vercel)
17. [Evolução: trocar JSON por banco](#evolução-trocar-json-por-banco)
18. [Limitações conhecidas do MVP](#limitações-conhecidas-do-mvp)

---

## Arquitetura

| Camada | Tecnologia |
| --- | --- |
| Framework | Next.js 16 (App Router, Server Components, Server Actions, `proxy.ts`) |
| UI | React 19, Tailwind CSS 4 (design tokens em CSS variables), lucide-react |
| Gráficos | Recharts 3, carregado sob demanda. Sparklines e funil são SVG/HTML renderizados no servidor. |
| Validação | Zod 4, com schemas para todos os documentos e para os dados normalizados |
| Planilhas | SheetJS 0.20.3 (distribuição oficial, com correções de segurança) e PapaParse para CSV |
| PDF | react-pdf / pdf.js (visualizador responsivo) |
| Sessão ADM | JWT HS256 (`jose`) em cookie HttpOnly e senha com hash scrypt |
| Storage | `StorageProvider`: disco local (desenvolvimento) ou **Vercel Blob privado** (produção) |
| Testes | Vitest |

### Princípio de dados

```
ARQUIVO ORIGINAL → VALIDAÇÃO → INTERPRETAÇÃO → NORMALIZAÇÃO → JSON PADRONIZADO → DASHBOARD
   (preservado)     (sniff +     (lib/parsers)   (features/*/     (Zod schemas)    (view-models
                     metadados)                   normalize.ts)                      + componentes)
```

- **Os componentes nunca leem planilhas.** Eles recebem `CommercialData` ou `TrafficData`. Se o Excel mudar, só o normalizador muda.
- **Métricas derivadas são calculadas pelo sistema, nunca digitadas:** conversão, ticket médio, CPL, CPA, ROAS, ROI%, CTR, CPC, CPM e custo por resultado.
  - Divisão por zero e dados ausentes resultam em `null`, que aparece como "—". A interface nunca mostra NaN ou Infinity.
- **Comparações usam a direção desejável de cada métrica** (`higherIsBetter`, `lowerIsBetter` ou `neutral`). Custo por lead menor aparece em verde.
  - Taxas são comparadas em pontos percentuais (p.p.).
- **Funil dinâmico:** cada cliente tem suas etapas, de 2 a N. `value: null` significa "não registrado", que é diferente de zero.

### Camadas de código

```
app/          rotas finas: carregam dados e compõem componentes
features/     domínios: clients, reports, commercial, traffic, uploads, portal, auth, events, admin
  */schema.ts        schemas Zod + tipos
  */service.ts       regras de negócio (server-only)
  */actions.ts       Server Actions (sempre chamam requireAdmin)
  */normalize.ts     planilha → modelo padronizado
  */metrics.ts       cálculos puros (testados)
  */view-model.ts    dados → o que cada tela mostra (fora do JSX)
  */components/      componentes do domínio
components/   ui/ (botões, cards, diálogo, menu), charts/, dashboard/, brand/
lib/          storage/, parsers/, format/, dates/, metrics/, crypto/, env.ts
server/       repositories/ (interfaces + implementação JSON sobre o StorageProvider)
```

---

## Instalação e desenvolvimento

Requisitos: **Node.js 20.9+** (testado com Node 24) e npm.

```bash
npm install
```

```bash
npm run setup
```

Isso cria um `.env.local` com segredos aleatórios e **credenciais de desenvolvimento**. O e-mail e a senha ficam comentados no topo do arquivo.

```bash
npm run seed
```

O seed cria 5 clientes de demonstração com dados fictícios:

| Cliente | O que o seed demonstra |
| --- | --- |
| Dra. Isabor | Funil de 3 etapas, canais, mais tráfego Meta e Google semanal, PDF e HTML legado |
| Serenity | Serviços, profissionais, novos x recorrentes, ROI%; agosto fica em **rascunho** |
| Larplan | Funil de 4 etapas com etapas "não registradas"; tráfego **com erro** de importação |
| IL Distribuidora | Só tráfego, com resultado em conversas no WhatsApp |
| Instituto Landim | Funil de 2 etapas, dimensões, indicadores avulsos e banner de contexto; agosto **pendente** |

```bash
npm run dev
```

- Painel: http://localhost:3000/adm (use as credenciais do `.env.local`)
- Links dos clientes: `npm run links` lista o link exclusivo atual de cada um.

Outros scripts:

| Script | Uso |
| --- | --- |
| `npm run seed -- --reset` | Apaga `.data/` e recria os dados de demonstração (só com o driver local) |
| `npm run links` | Lista os links exclusivos atuais |
| `npm run hash-password -- "senha"` | Gera o valor de `ADMIN_PASSWORD_HASH` |
| `npm run templates` | Regenera os modelos em `public/modelos/` |

---

## Build, testes e qualidade

```bash
npm run typecheck
```

```bash
npm run lint
```

```bash
npm run test
```

```bash
npm run build
```

`npm run check` roda typecheck, lint, testes e build em sequência.

Os testes cobrem as partes críticas:

- cálculos comerciais e de tráfego (inclui os valores reais do briefing, como R$ 4,73 / R$ 8,29 / R$ 3,79 e CTR 3,32%);
- comparações e direção das métricas;
- formatação pt-BR e parsing de números brasileiros;
- períodos e fuso;
- status de entrega;
- tokens e sessão;
- controle de acesso (um cliente não abre outro; rascunhos invisíveis);
- storage com path traversal e ETag;
- parsers e normalizadores;
- fluxo completo de importação (XLSX, CSV parcial, PDF, HTML legado e estruturado, arquivo com extensão falsa).

---

## Variáveis de ambiente

Veja `.env.example`. Nenhuma credencial tem valor padrão no código.

| Variável | Obrigatória | Descrição |
| --- | --- | --- |
| `STORAGE_DRIVER` | não | `local` ou `vercel-blob`. Se omitida, usa Blob quando `BLOB_READ_WRITE_TOKEN` existe. |
| `LOCAL_STORAGE_DIR` | não | Pasta do driver local (padrão `.data`) |
| `BLOB_READ_WRITE_TOKEN` | produção | Token do store **privado** do Vercel Blob |
| `ADMIN_EMAIL` | sim | E-mail de login do painel |
| `ADMIN_PASSWORD_HASH` | sim | Hash scrypt (`npm run hash-password -- "…"`) |
| `SESSION_SECRET` | sim | ≥ 32 caracteres aleatórios; assina a sessão do ADM |
| `PORTAL_TOKEN_SECRET` | sim | ≥ 32 caracteres; HMAC e cifragem dos tokens. **Trocar invalida todos os links.** |
| `PUBLIC_BASE_URL` | recomendado | URL pública dos links, ex. `https://clientes.lookassessoria.com.br` |
| `SESSION_TTL_HOURS` | não | Duração da sessão (padrão 12 h) |
| `UPLOAD_MAX_MB` | não | Tamanho máximo de upload (padrão 25 MB) |
| `SERVER_UPLOAD_MAX_MB` | não | Acima disso, o upload vai direto ao Blob (padrão 4 MB; a função da Vercel aceita no máximo 4,5 MB) |
| `APP_TIMEZONE` | não | Fuso usado para "hoje" e para exibição (padrão `America/Sao_Paulo`) |

Para gerar um segredo:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

---

## Storage

Toda leitura e escrita passa pela interface `StorageProvider` (`src/lib/storage/types.ts`):

- `LocalFileStorageProvider`: arquivos em `.data/`, só para desenvolvimento. É disco local, não `window.localStorage`.
- `VercelBlobStorageProvider`: Vercel Blob com `access: "private"`. Nenhum arquivo tem URL pública. O servidor lê com o token e só repassa o arquivo depois de validar quem pode vê-lo.

Organização (`src/lib/storage/paths.ts`):

```
clients/{clientId}/client.json            perfil e configuração
clients/{clientId}/access.json            token do link (hash HMAC + cópia cifrada)
clients/{clientId}/index.json             resumo de relatórios e uploads (reconstruível)
clients/{clientId}/logo.{png|jpg|webp}
clients/{clientId}/reports/{commercial|traffic}/{reportId}/manifest.json
clients/{clientId}/reports/{commercial|traffic}/{reportId}/data.json
clients/{clientId}/reports/{commercial|traffic}/{reportId}/original.{ext}
slugs/{slug}.json                         slug → clientId (reserva atômica)
imports/{importId}/record.json            registro do upload (status, erros, prévia)
imports/{importId}/original.{ext}         arquivo temporário até a confirmação
imports/{importId}/parsed.json            dados normalizados aguardando confirmação
events/{aaaa}/{mm}/{timestamp}_{clientId}_{eventId}.json   log básico (append-only)
```

**Decisões para o ambiente serverless, sem banco de dados:**

- **Documentos pequenos e independentes.** Não existe um JSON gigante com todos os clientes.
- **Concorrência otimista com ETag.** O `updateJSON` relê e reaplica a alteração quando outra escrita acontece ao mesmo tempo (`ifMatch` do Blob). Se não conseguir, a pessoa recebe "Este registro foi alterado por outra pessoa…".
- **Slug reservado com `ifNotExists`.** Isso impede dois clientes com o mesmo endereço.
- **O índice por cliente guarda os indicadores-chave de cada período.** O histórico, a evolução e as comparações não abrem `data.json` de outros meses. Se algo sair do lugar, use **Configurações → Reconstruir índice**, que recalcula tudo a partir dos manifests.
- **Leituras de JSON no Blob usam `useCache: false`.** Assim nunca se lê uma versão antiga do CDN.

---

## Autenticação do ADM

- Login com e-mail e senha definidos por variáveis de ambiente. A senha é guardada como hash **scrypt**, nunca em texto.
- A sessão é um JWT assinado em cookie **HttpOnly**, **SameSite=Lax**, **Secure** em produção e com expiração configurável. O logout remove o cookie.
- **Defesa em profundidade:**
  - o `proxy.ts` barra `/adm` e `/api/adm` sem sessão;
  - toda página, Server Action e rota confirma a sessão de novo (`requireAdmin` / `getSession`);
  - Server Actions têm verificação de origem nativa do Next;
  - as rotas de upload também exigem `Origin` igual ao host.
- **Limite de tentativas de login** em memória (proteção parcial em serverless; ver limitações).
- **Trocar de provedor** (Auth.js, Clerk, Supabase Auth): implemente a interface `AdminAuthProvider` (`src/features/auth/provider.ts`) e ajuste `session.ts`. O restante do código só usa `requireAdmin()` e `getSession()`.

---

## Links dos clientes e segurança

- **O token tem 32 bytes aleatórios** (`crypto.randomBytes`), ou seja, 43 caracteres base64url. Nunca é sequencial.
- **A URL segue o formato** `/c/{slug}/{token}`.
- **O token é validado no servidor**, com HMAC-SHA256 e comparação em tempo constante:
  - o HMAC é calculado mesmo quando o slug não existe, para que o tempo de resposta não revele quais clientes existem;
  - qualquer falha (slug inexistente, token errado, revogado, cliente inativo) devolve a mesma página "Link indisponível", com HTTP 404.
- **O token é armazenado de duas formas:** como hash, para validar, e cifrado com AES-256-GCM, para o ADM poder copiar o link de novo. Logs e interface mostram só os 4 últimos caracteres.
- **Ações no ADM:**
  - **Copiar link**;
  - **Gerar novo link** (o anterior deixa de funcionar na hora);
  - **Revogar link** (fica sem link);
  - **Desativar acesso** (mantém o link, mas bloqueia).
- **O servidor só envia ao navegador os dados do próprio cliente e só relatórios publicados.** Nada é "escondido por JavaScript". Arquivos originais passam por uma rota que confere cliente, status e permissão de download.
- **Rotas `/c/*` enviam três cabeçalhos:**
  - `Referrer-Policy: no-referrer`, para o token não vazar para sites externos;
  - `X-Robots-Tag: noindex`;
  - `Cache-Control: private`.
- **HTML legado** é exibido em `<iframe sandbox="allow-scripts allow-popups">`, **sem `allow-same-origin`**, e o arquivo é servido com `Content-Security-Policy: sandbox …`:
  - o documento roda com origem opaca;
  - não acessa cookies, sessão, `localStorage` do portal nem APIs internas, mesmo se aberto direto em uma aba;
  - scripts continuam funcionando, para dashboards legados interativos;
  - HTML nunca é inserido na aplicação principal.
- **Upload validado em várias camadas:**
  - extensão, MIME declarado e tamanho;
  - assinatura real dos bytes: um `.xlsx` que é texto é recusado;
  - nome sanitizado;
  - caminho interno gerado pelo sistema a partir de IDs validados, o que impede path traversal;
  - limite de linhas e de abas por planilha;
  - fórmulas não são avaliadas.

---

## Estrutura de arquivos

```
src/
  app/
    adm/login/                       login
    adm/(painel)/                    layout com sidebar + páginas do ADM
      page.tsx                       visão geral (indicadores, atenção, uploads)
      clientes/ …/novo  …/[id]/{comercial,trafego,arquivos,configuracoes,acesso,portal,relatorios/[reportId]}
      uploads/ …/[importId]          assistente de upload e retomada
      pendencias/
    c/[slug]/[token]/                portal do cliente (+ relatorio/[id], arquivo/[id], logo)
    api/adm/…                        arquivos para o ADM, upload (servidor e Blob), logo
  proxy.ts                           barreira de rotas + cabeçalhos do portal
  features/  components/  lib/  server/   (ver "Camadas de código")
scripts/     setup-env, seed, links, hash-password, generate-templates, demo-documents
tests/       testes Vitest + helpers (storage em memória)
public/brand     logos (branco e colorido, fundo transparente) e ícones
public/modelos   modelos de importação (XLSX, CSV, HTML estruturado)
```

---

## Modelo de dados

Todos os schemas estão em `src/features/*/schema.ts` (Zod).

- **Client:** `id`, `slug`, `name`, `shortName`, `greetingName`, `segment`, `status` (active/inactive/archived), `logo`, `currency`, `modules.{commercial,traffic}` (`enabled`, `cadence` monthly/weekly, `dueDay`, `allowOriginalDownload`), `dashboard` (`roiMetric`: roas/roiPercent; `highlightMetrics`), `notes`, datas e `version`.
- **ClientAccess:** `enabled`, `token { hash, ciphertext, hint, createdAt } | null` e `history`.
- **ReportManifest:** `id`, `clientId`, `type` (commercial/traffic), `kind` (dataset/document), `period { start, end, granularity }`, `periodKey`, `status`, `source` (arquivo original), `dataPath`, `insights`, `warnings`, `summary`, `labels`, `allowDownload`, `createdAt`, `publishedAt` etc.
  - Os status possíveis são draft, published, unpublished, superseded e archived.
  - `summary` guarda os indicadores usados em histórico e comparação.
- **CommercialData:**
  - `funnel[] { key, label, order, value|null }` (funil dinâmico);
  - `financial { revenue, mediaInvestment, sales, attributedRevenue, otherCosts, averageTicket }`;
  - `channels[] { key, label, kind, leads, conversions, revenue, investment }`;
  - `dimensions[] { key, label, quantityLabel, rows[] }`, genéricas: serviços, profissionais, unidades…;
  - `extraMetrics[]` (ex.: "Cirurgias geradas");
  - `context` (banner do período).
- **TrafficData:** `campaigns[] { platform, name, investment, impressions, reach, clicks, linkClicks, results, resultType, resultLabel, conversions, attributedRevenue }`.
  - `resultType` pode ser whatsapp, lead, form, purchase, appointment, call, conversion, visit ou other. Tipos diferentes nunca são somados como se fossem iguais.
- **Insight:** `type` (positive, attention, neutral, recommendation), `title`, `description` e `source` (manual, import ou auto). Insights automáticos aparecem sinalizados. O MVP não gera recomendações automáticas.
- **ImportRecord:** status do upload, erros e avisos, prévia por período e IDs dos rascunhos criados.
  - Os status são awaiting_file, uploaded, validated, invalid, imported, discarded e failed.

---

## Como criar um cliente

1. **Painel → Clientes → Novo cliente.**
2. Preencha nome, endereço (slug), saudação e segmento.
3. Ative os módulos. Para cada um, escolha a periodicidade e o prazo. Exemplos: Comercial *mensal até o dia 5*; Tráfego *semanal até segunda-feira*.
4. Salve. O **link exclusivo é gerado na hora** e aparece na visão geral do cliente e na aba **Acesso**.
5. Opcional: envie o logo em **Configurações**.

---

## Como fazer upload

**Painel → Novo upload** (ou "Enviar relatório" em qualquer pendência, que já chega com cliente, tipo e período preenchidos).

1. **Cliente**
2. **Tipo** (Comercial ou Tráfego)
3. **Período.** Planilhas podem "detectar pelo arquivo". PDF exige o período.
4. **Arquivo:** arraste e solte ou selecione. Para CSV, informe o conteúdo (funil, financeiro, canais, dimensão ou tráfego).
5. **Validação:**
   - **ERRO** impede a importação (ex.: aba Funil ausente, período inválido, cliente incompatível, arquivo corrompido);
   - **AVISO** permite continuar (ex.: receita não informada, canal sem conversão, campanha sem alcance, sem período anterior para comparar, CTR informado diferente do calculado).
6. **Prévia:** abas reconhecidas e períodos encontrados, com os números principais. Escolha quais períodos importar. Uma planilha anual pode criar vários meses de uma vez.
7. **Confirmação**
8. **Rascunho criado.** Nada é publicado automaticamente.

Arquivos maiores que `SERVER_UPLOAD_MAX_MB` vão direto do navegador para o Blob privado, com progresso e token de uso único restrito ao caminho daquele upload.

**CSV parcial:** um CSV de canais, financeiro ou dimensão atualiza só aquela seção. O sistema cria um novo rascunho copiando as outras seções do relatório mais recente do período.

---

## Como publicar

1. Abra o rascunho (**Cliente → Comercial/Tráfego** ou pela pendência).
2. Confira a **prévia "como o cliente verá"** e os avisos da importação.
3. Edite título, permissão de download e **insights da Look**.
4. Clique em **Publicar** e confirme. O cliente vê na hora, no mesmo link de sempre.

Outras ações:

- **Retirar publicação:** o relatório volta a ficar invisível para o cliente e nada é apagado.
- **Arquivar:** tira o relatório das listas, mas preserva o conteúdo; é possível restaurar.
- **Publicar uma nova versão do mesmo período:** a anterior vira "substituída" e continua no histórico interno.
- **Prévia com rascunhos:** mostra o portal inteiro como o cliente veria, incluindo rascunhos.

---

## Formatos de arquivo aceitos

| Formato | Comportamento |
| --- | --- |
| **XLSX / XLS** | Interpretado e convertido para o modelo padronizado. Baixe os modelos em `public/modelos/` ou no próprio assistente. |
| **CSV** | Uma tabela por arquivo; o ADM informa o conteúdo. Separador `;` ou `,`, UTF-8 ou Windows-1252. |
| **PDF** | Documento visual, sem extração de dados no MVP. Visualizador com páginas, zoom e download opcional. |
| **HTML estruturado** | Contém `<script type="application/json" id="portal-look-data">` com `{ type, client, data, insights }`, onde `data` segue `CommercialData` ou `TrafficData` (exemplo em `public/modelos/exemplo-html-estruturado.html`). Vira dashboard. |
| **HTML legado** | Qualquer outro HTML. Exibido isolado em iframe sandbox. |

**Planilha comercial:**

- **Abas reconhecidas:** Funil (obrigatória), Financeiro, Canais, Indicadores, Insights, Contexto e Dimensões.
- **Formatos do funil:**
  - largo: `Período | Leads | Agendamentos | …`;
  - longo: `Período | Etapa | Ordem | Quantidade`.
- **Qualquer outra aba** com colunas numéricas (Serviços, Profissionais, Unidades…) vira um detalhamento com o nome da aba.

**Planilha de tráfego:**

- **Colunas obrigatórias:** Plataforma, Campanha, Investimento e Impressões.
- **Colunas opcionais:** Cliente, Início e Fim, Alcance, Cliques, Cliques no link, Resultados, Tipo de resultado, Conversões e Receita atribuída.

Os nomes de coluna são reconhecidos com tolerância a acentos, maiúsculas e variações ("Valor investido", "Impressões", "Mês").

---

## Status de entrega

Calculado em `src/features/reports/delivery.ts`. Existir um arquivo não significa estar atualizado: vale o período esperado e o prazo.

- **Mensal com prazo no dia 5:** o relatório de agosto vence em 05/09. Em 29/09, o período esperado é agosto.
- **Semanal com prazo na segunda-feira:** a semana 21 a 27/09 vence na segunda 28/09.

| Estado | Quando |
| --- | --- |
| Atualizado | Período esperado (ou posterior) publicado |
| Pendente | Prazo vencido sem publicação (mostra os dias de atraso) |
| Rascunho | Existe rascunho do período esperado |
| Com erro | A última importação do módulo falhou e não foi resolvida |
| No prazo | Cliente cadastrado depois do prazo do último período (primeiro relatório ainda não vence) |
| Não aplicável | Módulo desativado |

---

## Como configurar o Vercel Blob

1. No painel da Vercel, abra o projeto e vá em **Storage → Create → Blob**.
2. Crie o store com acesso **Private**.
3. Conecte o store ao projeto. A variável `BLOB_READ_WRITE_TOKEN` é criada automaticamente nos ambientes escolhidos.
4. Defina `STORAGE_DRIVER=vercel-blob` (opcional; é detectado pelo token).
5. Para popular um ambiente novo com os dados de demonstração, puxe as variáveis e rode o seed:

```bash
vercel env pull .env.local
```

```bash
npm run seed
```

Para usar o Blob também em desenvolvimento, basta ter `BLOB_READ_WRITE_TOKEN` no `.env.local`.

---

## Deploy na Vercel

1. Suba o repositório para o GitHub e importe o projeto na Vercel (framework: Next.js).
2. Configure as variáveis de ambiente (seção acima):
   - `ADMIN_EMAIL`;
   - `ADMIN_PASSWORD_HASH`;
   - `SESSION_SECRET`;
   - `PORTAL_TOKEN_SECRET`;
   - `PUBLIC_BASE_URL`;
   - o Blob conectado.
3. Faça o deploy. O build roda `next build`.
4. Domínio: aponte `clientes.lookassessoria.com.br` para o projeto (Settings → Domains) e ajuste `PUBLIC_BASE_URL`.
5. Entre em `/adm/login`, cadastre os clientes e envie os relatórios.

> Em produção **não use `STORAGE_DRIVER=local`**: o filesystem das funções é efêmero. O sistema avisa no log se isso acontecer.

---

## Evolução: trocar JSON por banco

Serviços, páginas e componentes falam com as interfaces em `src/server/repositories/types.ts`: `ClientRepository`, `AccessRepository`, `ReportRepository`, `ImportRepository` e `EventRepository`.

Para migrar para PostgreSQL ou Supabase:

1. Implemente essas interfaces.
2. Troque a composição em `src/server/repositories/index.ts`.
3. Mantenha os arquivos originais no Blob, ou migre também o `StorageProvider`.

Os schemas Zod continuam valendo como contrato.

---

## Limitações conhecidas do MVP

- **Sem transações entre documentos.** Cada escrita é atômica por documento (ETag). O índice por cliente pode ficar defasado em uma falha no meio de uma operação; "Reconstruir índice" corrige.
- **O rate limit de login é em memória, por instância.** Para mais tráfego, use Upstash/Redis.
- **Um único usuário ADM** (via variáveis de ambiente). Vários usuários e perfis ficam para a troca de provedor de autenticação.
- **Não há CSP estrita para as páginas da aplicação.** Só o HTML legado recebe CSP. Adicionar CSP com nonce é o próximo passo recomendado.
- **PDF não tem extração de dados** (fora do escopo do MVP).
- **O callback `onUploadCompleted` do Blob não é necessário.** O próprio assistente valida o arquivo após o envio.
