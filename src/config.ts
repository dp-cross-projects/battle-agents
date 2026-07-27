import * as dotenv from 'dotenv';
dotenv.config();

export const CONFIG = {
  // Provider selection: 'gemini' | 'ollama' | 'mock'
  PROVIDER: (process.env.LLM_PROVIDER || 'gemini').toLowerCase() as 'gemini' | 'ollama' | 'mock',

  // Gemini configs
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',
  GEMINI_MODEL: process.env.GEMINI_MODEL || 'gemini-2.5-flash',

  // Ollama configs
  OLLAMA_ENDPOINT: process.env.OLLAMA_ENDPOINT || 'http://localhost:11434',
  OLLAMA_MODEL: process.env.OLLAMA_MODEL || 'llama3:8b', // recommended llama3:8b or gemma2:9b
};
