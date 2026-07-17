import { LLMProvider } from './LLMProvider.js';

export class MockProvider implements LLMProvider {
  async generateText(prompt: string, systemInstruction?: string): Promise<string> {
    // Artificial tiny delay to simulate network latency but stay extremely fast (50ms)
    await new Promise(resolve => setTimeout(resolve, 50));

    const promptLower = prompt.toLowerCase();
    if (promptLower.includes('narración') || promptLower.includes('narrativa') || promptLower.includes('registro matemático')) {
      return `[MOCK NARRATIVA] Los sistemas ambientales reportan actividad intensa. Un agente avanza buscando flanquear coberturas mientras la unidad enemiga recalcula vectores de respuesta, intercambiando disparos de advertencia en esta ronda.`;
    }

    if (promptLower.includes('genera la orden')) {
      const actions = [
        'Corro hacia la cobertura más cercana y disparo mi rifle de plasma.',
        'Intento hackear las torretas del mapa para crear una distracción.',
        'Me coloco en guardia defensiva esperando el ataque del rival.',
        'Me deslizo ágilmente a los flancos para esquivar cualquier agresión.'
      ];
      return actions[Math.floor(Math.random() * actions.length)];
    }

    return '[MOCK TEXT] Acción genérica ejecutada por el sistema.';
  }

  async generateStructuredJSON<T>(prompt: string, schema: any, systemInstruction?: string): Promise<T> {
    await new Promise(resolve => setTimeout(resolve, 50));

    const promptLower = prompt.toLowerCase();
    let action_type = 'melee_attack';
    let verbal_reaction = '¡Prepárate para el impacto!';
    let adapted_prompt = 'El agente ejecuta un ataque directo con fuerza física contra el oponente.';

    if (promptLower.includes('esquivar') || promptLower.includes('dodge') || promptLower.includes('evadir')) {
      action_type = 'dodge';
      verbal_reaction = '¡Demasiado lento!';
      adapted_prompt = 'El agente realiza una maniobra evasiva para evitar los proyectiles entrantes.';
    } else if (promptLower.includes('defender') || promptLower.includes('defend') || promptLower.includes('bloquear')) {
      action_type = 'defend';
      verbal_reaction = '¡No pasarás!';
      adapted_prompt = 'El agente se cubre tras su blindaje táctico esperando el embate.';
    } else if (promptLower.includes('hackear') || promptLower.includes('tactical') || promptLower.includes('dispositivo')) {
      action_type = 'tactical';
      verbal_reaction = 'Ejecutando protocolo táctico auxiliar...';
      adapted_prompt = 'El agente despliega contramedidas electrónicas o tácticas para desorientar.';
    } else if (promptLower.includes('disparar') || promptLower.includes('distancia') || promptLower.includes('ranged')) {
      action_type = 'ranged_attack';
      verbal_reaction = 'Blanco fijado, abriendo fuego.';
      adapted_prompt = 'El agente toma distancia y realiza un disparo de precisión a su rival.';
    }

    const mockResponse = {
      action_type,
      reasoning: `[Mock Reasoning] Basado en los parámetros de la orden y el entorno, el agente determina que la acción '${action_type}' maximiza la efectividad del combate.`,
      adapted_prompt,
      confidence_modifier: Math.floor(Math.random() * 7) - 3, // -3 to +3
      verbal_reaction
    };

    return mockResponse as unknown as T;
  }
}
