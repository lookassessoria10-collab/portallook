/**
 * Gera os modelos de importação em public/modelos.
 *   npm run templates
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { commercialTemplateWorkbook, CSV_FUNNEL_EXAMPLE, CSV_TRAFFIC_EXAMPLE, mediaPlanTemplateWorkbook, structuredHtmlExample, trafficTemplateWorkbook, workbookBuffer } from "@/features/uploads/templates";

const dir = path.resolve(process.cwd(), "public/modelos");
mkdirSync(dir, { recursive: true });
writeFileSync(path.join(dir, "modelo-comercial.xlsx"), workbookBuffer(commercialTemplateWorkbook()));
writeFileSync(path.join(dir, "modelo-trafego.xlsx"), workbookBuffer(trafficTemplateWorkbook()));
writeFileSync(path.join(dir, "modelo-plano-de-midia.xlsx"), workbookBuffer(mediaPlanTemplateWorkbook()));
writeFileSync(path.join(dir, "exemplo-trafego.csv"), "﻿" + CSV_TRAFFIC_EXAMPLE, "utf8");
writeFileSync(path.join(dir, "exemplo-funil.csv"), "﻿" + CSV_FUNNEL_EXAMPLE, "utf8");
writeFileSync(path.join(dir, "exemplo-html-estruturado.html"), structuredHtmlExample(), "utf8");
console.log(`Modelos gerados em ${dir}`);
