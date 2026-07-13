import axios from 'axios';
import { LLMProvider } from './LLMProvider.js';

export class OllamaProvider implements LLMProvider {
  private endpoint: string;
  private modelName: string;

  constructor(endpoint: string, modelName: string) {
    this.endpoint = endpoint.replace(/\/$/, ''); // Remove trailing slash
    this.modelName = modelName;
  }

  async generateText(prompt: string, systemInstruction?: string): Promise<string> {
    try {
      const response = await axios.post(`${this.endpoint}/api/generate`, {
        model: this.modelName,
        prompt: prompt,
        system: systemInstruction,
        stream: false,
      });

      if (response.data && response.data.response) {
        return response.data.response;
      }
      throw new Error('Unexpected response format from Ollama.');
    } catch (error: any) {
      throw new Error(`Ollama generateText failed: ${error.message}`);
    }
  }

  async generateStructuredJSON<T>(prompt: string, schema: any, systemInstruction?: string): Promise<T> {
    try {
      // For Ollama, we append schema instructions to system prompt or prompt to help it structure correctly
      const schemaInstruction = `You MUST return a JSON object that strictly adheres to the following JSON Schema:
${JSON.stringify(schema, null, 2)}
Ensure no extra text, markdown formatting, or explanations are returned outside of the raw JSON object.`;

      const combinedSystem = systemInstruction 
        ? `${systemInstruction}\n\n${schemaInstruction}`
        : schemaInstruction;

      const response = await axios.post(`${this.endpoint}/api/generate`, {
        model: this.modelName,
        prompt: prompt,
        system: combinedSystem,
        format: 'json',
        stream: false,
        options: {
          temperature: 0.1 // lower temperature for more stable JSON structure
        }
      });

      if (response.data && response.data.response) {
        const jsonText = response.data.response.trim();
        // Sometimes models wrap JSON in markdown block even with JSON format, let's clean it up just in case
        const cleanedText = jsonText.replace(/^```json/, '').replace(/```$/, '').trim();
        return JSON.parse(cleanedText) as T;
      }
      throw new Error('Unexpected response format from Ollama.');
    } catch (error: any) {
      throw new Error(`Ollama generateStructuredJSON failed: ${error.message}`);
    }
  }
}
