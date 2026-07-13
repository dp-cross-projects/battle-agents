import { GoogleGenerativeAI, Schema } from '@google/generative-ai';
import { LLMProvider } from './LLMProvider.js';

export class GeminiProvider implements LLMProvider {
  private genAI: GoogleGenerativeAI;
  private modelName: string;

  constructor(apiKey: string, modelName: string) {
    if (!apiKey) {
      throw new Error('Gemini API key is required. Please set the GEMINI_API_KEY environment variable.');
    }
    this.genAI = new GoogleGenerativeAI(apiKey);
    this.modelName = modelName;
  }

  async generateText(prompt: string, systemInstruction?: string): Promise<string> {
    const model = this.genAI.getGenerativeModel({
      model: this.modelName,
      systemInstruction: systemInstruction,
    });

    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text();
  }

  async generateStructuredJSON<T>(prompt: string, schema: Schema, systemInstruction?: string): Promise<T> {
    const model = this.genAI.getGenerativeModel({
      model: this.modelName,
      systemInstruction: systemInstruction,
    });

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: schema,
      },
    });

    const response = await result.response;
    const text = response.text();
    try {
      return JSON.parse(text) as T;
    } catch (error) {
      throw new Error(`Failed to parse structured JSON from Gemini response: ${text}. Error: ${error}`);
    }
  }
}
