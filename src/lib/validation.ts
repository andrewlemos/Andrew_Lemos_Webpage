/**
 * Utilitários unificados de validação anti-bot e validação de nomes humanos
 */

export interface NameValidationResult {
  isValid: boolean;
  error?: string;
}

/**
 * Valida se um nome fornecido corresponde a um nome e sobrenome humanos válidos:
 * - Pelo menos 2 palavras (Nome e Sobrenome), cada uma com no mínimo 2 caracteres
 * - Não permite 3 ou mais letras idênticas seguidas (ex: "aaa", "zzzz")
 * - Não permite 5 ou mais consoantes seguidas (para barrar strings geradas por bot como "tvWBsPNDPrLgyYazFik")
 */
export function validateHumanName(name: string): NameValidationResult {
  const trimmed = (name || '').trim();
  if (!trimmed) {
    return { isValid: false, error: 'Por favor, informe seu nome completo.' };
  }

  const words = trimmed.split(/\s+/).filter(w => w.length > 0);
  if (words.length < 2 || words.some(w => w.length < 2)) {
    return { isValid: false, error: 'Por favor, informe seu nome e sobrenome completos.' };
  }

  // Bloqueio de 3 ou mais letras idênticas consecutivas (ex: "Jooaooo", "aaaa")
  if (/(.)\1{2,}/i.test(trimmed)) {
    return { isValid: false, error: 'O nome informado contém letras repetidas em excesso.' };
  }

  // Bloqueio de 5 ou mais consoantes consecutivas (strings aleatórias de bots)
  if (/([bcdfghjklmnpqrstvwxz]){5,}/i.test(trimmed)) {
    return { isValid: false, error: 'Por favor, informe um nome válido.' };
  }

  return { isValid: true };
}
