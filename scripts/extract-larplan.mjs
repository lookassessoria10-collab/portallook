import { readFileSync, writeFileSync } from "node:fs";
import { extractLarplan } from "./lib/extract-larplan.mjs";

const base = new URL("../src/features/commercial/larplan/", import.meta.url);
writeFileSync(new URL("report.json", base), JSON.stringify(extractLarplan(readFileSync(new URL("original.html", base), "utf8")), null, 2) + "\n");
