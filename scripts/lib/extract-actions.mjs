import { createHash } from "node:crypto";
import * as XLSX from "xlsx";

/** Abas de apoio da planilha de ações (painel, laboratório, modelo e base): nunca são de um cliente. */
const SUPPORT_SHEETS = new Set(["dashboad", "dashboard", "planejar acoes", "modelo", "base dashboard"]);
const ALPHABET = "0123456789abcdefghijkmnpqrstuvwxyz";

const norm = (value) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
const text = (value) => String(value ?? "").replace(/\s+/g, " ").trim();
const pad = (n) => String(n).padStart(2, "0");

/**
 * Identificador estável da ação: aba + texto da ação + ocorrência (a mesma ação pode
 * aparecer duas vezes na aba). Inserir ou reordenar linhas não muda os IDs.
 */
export function actionId(sheet, action, occurrence) {
  const digest = createHash("sha256").update(`${norm(sheet)}|${norm(action)}|${occurrence}`).digest();
  let out = "";
  for (const byte of digest.subarray(0, 12)) out += ALPHABET[byte % ALPHABET.length];
  return `ac_${out}`;
}

/** Datas da planilha: número de série do Excel ou texto "dd/mm/aaaa". */
function isoDate(value) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") {
    const d = XLSX.SSF.parse_date_code(value);
    return d && d.y > 1900 ? `${d.y}-${pad(d.m)}-${pad(d.d)}` : null;
  }
  const s = text(value);
  const br = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (br) return `${br[3]}-${pad(br[2])}-${pad(br[1])}`;
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return iso ? `${iso[1]}-${iso[2]}-${iso[3]}` : null;
}

/**
 * Lê a planilha de ações da Look: uma aba por cliente, com o cabeçalho
 * Ação | Tipo de ação | Quando foi sugerido | Quando foi executado | Status | Observações | Última atualização | Andamento / Pendências.
 * Os valores saem como estão na planilha (status e tipo em texto); a leitura do status é feita no portal.
 */
export function extractActions(workbook) {
  const sheets = [];
  for (const name of workbook.SheetNames) {
    if (SUPPORT_SHEETS.has(norm(name))) continue;
    const ws = workbook.Sheets[name];
    if (!ws?.["!ref"]) continue;
    const firstRow = XLSX.utils.decode_range(ws["!ref"]).s.r;
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "", blankrows: true, raw: true });
    const headerIdx = rows.findIndex((r) => norm(r[0]) === "acao");
    if (headerIdx < 0) continue;
    const header = rows[headerIdx].map(norm);
    const col = (re) => header.findIndex((h) => re.test(h));
    const c = {
      type: col(/^tipo/),
      suggested: col(/sugerid/),
      executed: col(/executad/),
      status: col(/^status/),
      notes: col(/^observa/),
      updated: col(/^ultima atualizacao/),
      progress: col(/^andamento|pendencias?$/),
    };
    const cell = (r, i) => (i >= 0 ? r[i] : "");
    const seen = new Map();
    const actions = [];
    rows.slice(headerIdx + 1).forEach((r, i) => {
      const action = text(r[0]);
      if (!action) return;
      const key = norm(action);
      const occurrence = (seen.get(key) ?? 0) + 1;
      seen.set(key, occurrence);
      actions.push({
        id: actionId(name, action, occurrence),
        row: firstRow + headerIdx + i + 2,
        action,
        type: text(cell(r, c.type)),
        suggestedAt: isoDate(cell(r, c.suggested)),
        executedAt: isoDate(cell(r, c.executed)),
        status: text(cell(r, c.status)),
        notes: text(cell(r, c.notes)),
        lastUpdateAt: isoDate(cell(r, c.updated)),
        progress: text(cell(r, c.progress)),
      });
    });
    if (actions.length) sheets.push({ name: text(name), actions });
  }
  return { sheets };
}
