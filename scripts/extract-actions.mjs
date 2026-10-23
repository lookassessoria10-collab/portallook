import { readFileSync, writeFileSync } from "node:fs";
import * as XLSX from "xlsx";
import { extractActions } from "./lib/extract-actions.mjs";

// Uso: npm run actions:snapshot -- "caminho/da/planilha de ações.xlsx"
// (no Google Sheets: Arquivo → Fazer download → Microsoft Excel)
const file = process.argv[2];
if (!file) {
  console.error('Informe a planilha: npm run actions:snapshot -- "planilha de ações.xlsx"');
  process.exit(1);
}

const workbook = XLSX.read(readFileSync(file), { type: "buffer" });
const snapshot = { source: "Planilha de ações da Look", extractedAt: new Date().toISOString().slice(0, 10), ...extractActions(workbook) };
writeFileSync(new URL("../src/features/actions/sheet-snapshot.json", import.meta.url), JSON.stringify(snapshot, null, 2) + "\n");
for (const s of snapshot.sheets) console.log(`${s.name}: ${s.actions.length} ações`);
console.log(`Total: ${snapshot.sheets.reduce((n, s) => n + s.actions.length, 0)} ações em ${snapshot.sheets.length} abas.`);
