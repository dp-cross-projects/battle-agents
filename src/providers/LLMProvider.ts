export interface LLMProvider {
  /**
   * Generates standard text response.
   */
  generateText(prompt: string, systemInstruction?: string): Promise<string>;

  /**
   * Generates a structured JSON response matching the provided schema.
   */
  generateStructuredJSON<T>(prompt: string, schema: any, systemInstruction?: string): Promise<T>;
}
