import { readFileSync, writeFileSync } from "node:fs";
import { extractLandim } from "./lib/extract-landim.mjs";

const base = new URL("../src/features/commercial/landim/", import.meta.url);
writeFileSync(new URL("report.json", base), JSON.stringify(extractLandim(readFileSync(new URL("original.html", base), "utf8")), null, 2) + "\n");
