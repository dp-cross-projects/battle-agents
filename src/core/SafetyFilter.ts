export class SafetyFilter {
  // A basic list of banned terms in Spanish/English to catch obvious violations locally and save API calls.
  private static readonly BANNED_PATTERNS = [
    /violaci[oó]n/i,
    /violar/i,
    /abuso sexual/i,
    /sexual abuse/i,
    /pornograf[ií]a/i,
    /torturar/i,
    /tortura/i,
    /mutilar de forma/i,
    /desmembrar/i,
    /gore expl[ií]cito/i,
    /suicidio/i,
    /suicidarse/i,
    /asesinar de forma s[aá]dica/i
  ];

  /**
   * Evaluates if a prompt is safe to process.
   * Returns false if the prompt contains obviously banned keywords.
   */
  public static isSafe(prompt: string): { isSafe: boolean; reason?: string } {
    const trimmed = prompt.trim();

    if (!trimmed) {
      return { isSafe: false, reason: 'La acción está vacía.' };
    }

    for (const pattern of this.BANNED_PATTERNS) {
      if (pattern.test(trimmed)) {
        return { 
          isSafe: false, 
          reason: 'Acción rechazada: El contenido de la acción infringe las directrices de seguridad (contenido +18 o violencia explícita extrema).' 
        };
      }
    }

    return { isSafe: true };
  }
}
