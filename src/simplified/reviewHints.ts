import type { ReviewRow } from "./reviewModel";

export interface ReviewHint {
  kind: "check" | "error";
  label: "Verificar" | "Provável erro";
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
  for (const row of rows) {
    const text = normalize(row.text);
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
    } else if (uncertain || (text.split(" ").length >= 5 && seen.has(text))) {
      hints.set(row.id, {
        kind: "check",
        label: "Verificar",
        reason: uncertain
          ? `A expressão “${uncertain[0]}” pode indicar uma informação a conferir. Indício por regra de texto, sem análise de IA; pode fazer parte da fala desejada.`
          : "Este bloco repete as mesmas palavras de um bloco anterior. Indício por comparação de texto, sem análise de IA; a repetição pode ser intencional.",
      });
    }
    seen.add(text);
  }
  return hints;
}
