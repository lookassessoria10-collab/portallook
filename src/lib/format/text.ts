const CONNECTORS = new Set(["de", "da", "do", "das", "dos", "no", "na", "nos", "nas", "e", "em", "por", "para", "com", "a", "o"]);

function singularWord(word: string): string {
  const lower = word.toLowerCase();
  if (word.length <= 3 || CONNECTORS.has(lower) || /[A-Z].*[A-Z]/.test(word)) return word;
  if (/ões$/i.test(word)) return word.replace(/ões$/i, "ão");
  if (/ães$/i.test(word)) return word.replace(/ães$/i, "ão");
  if (/ais$/i.test(word)) return word.replace(/ais$/i, "al");
  if (/eis$/i.test(word)) return word.replace(/eis$/i, "el");
  if (/ns$/i.test(word)) return word.replace(/ns$/i, "m");
  if (/(r|z)es$/i.test(word)) return word.replace(/es$/i, "");
  if (/s$/i.test(word)) return word.slice(0, -1);
  return word;
}

/** Singular aproximado em português para rótulos ("Comparecimentos" → "Comparecimento"). */
export function singularizePt(label: string): string {
  return label
    .split(" ")
    .map((w, i, arr) => (i > 0 && CONNECTORS.has(arr[i - 1].toLowerCase()) ? w : singularWord(w)))
    .join(" ");
}

/** Primeira letra minúscula, preservando siglas e nomes próprios no restante. */
export function lowerFirst(label: string): string {
  if (/^[A-Z]{2,}/.test(label)) return label;
  return label.charAt(0).toLowerCase() + label.slice(1);
}

/** "Custo por comparecimento", "Custo por conversa no WhatsApp". */
export function costPerLabel(pluralLabel: string): string {
  return `Custo por ${lowerFirst(singularizePt(pluralLabel))}`;
}
