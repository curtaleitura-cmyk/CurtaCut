import type { ReviewRow } from "./reviewModel";

export interface ReviewHint {
  kind: "check" | "error";
  label: "Verificar" | "Provável erro" | "Possível repetição";
  reason: string;
}

const normalize = (text: string) =>
  text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/** Conservative text clues, never an AI verdict or an instruction to cut. */
export function transcriptReviewHints(
  rows: readonly Pick<ReviewRow, "id" | "text">[],
) {
  const hints = new Map<string, ReviewHint>();
  const seen = new Set<string>();
  const phrases = new Set<string>();
  let tail: string[] = [];
  for (const row of rows) {
    const text = normalize(row.text);
    const tokens = text.split(" ");
    const context = [...tail, ...tokens];
    const grams = context.flatMap((_, i) => i + 5 <= context.length ? [context.slice(i, i + 5).join(" ")] : []);
    const repeated = (tokens.length >= 5 && seen.has(text)) || grams.some(gram => phrases.has(gram)) || new Set(grams).size < grams.length;
    const retake = text.match(
      /\b(falei errado|errei|nao espera|vou comecar de novo|vou recomecar|vamos recomecar)\b/,
    );
    const uncertain = text.match(
      /\b(se nao me engano|nao tenho certeza|acho que|talvez)\b/,
    );
    const negated =
      retake && /\b(nao|nunca) $/.test(text.slice(0, retake.index));
    if (retake && !negated) {
      hints.set(row.id, {
        kind: "error",
        label: "Provável erro",
        reason: `A expressão “${retake[0]}” pode indicar uma retomada de gravação. Indício por regra de texto, sem análise de IA; ouça e confira o contexto antes de cortar.`,
      });
    } else if (uncertain || repeated) {
      hints.set(row.id, {
        kind: "check",
        label: repeated ? "Possível repetição" : "Verificar",
        reason: uncertain && !repeated
          ? `A expressão “${uncertain[0]}” pode indicar uma informação a conferir. Indício por regra de texto, sem análise de IA; pode fazer parte da fala desejada.`
          : "Este trecho contém uma sequência de pelo menos cinco palavras já usada antes. Indício por comparação de texto, sem análise de IA; a repetição pode ser intencional.",
      });
    }
    seen.add(text);
    grams.forEach(gram => phrases.add(gram));
    tail = context.slice(-4);
  }
  return hints;
}
