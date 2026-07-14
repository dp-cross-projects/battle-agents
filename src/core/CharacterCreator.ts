import { LLMProvider } from '../providers/LLMProvider.js';
import { BattleAgent, AgentStats, Archetype } from '../types/index.js';

export class CharacterCreator {
  private llm: LLMProvider;

  constructor(llm: LLMProvider) {
    this.llm = llm;
  }

  private static CHARACTER_SCHEMA = {
    type: 'object',
    properties: {
      name: { type: 'string', description: 'Nombre creativo para el personaje.' },
      archetype: { 
        type: 'string', 
        enum: ['cobarde_sarcastico', 'paladin_orgulloso', 'ansioso_inseguro', 'guerrero_pragmatico'],
        description: 'Arquetipo de personalidad que mejor encaja con la descripción.' 
      },
      stats: {
        type: 'object',
        properties: {
          strength: { type: 'integer', description: 'Fuerza física. Valor entre 5 y 50. La suma total de stats debe ser 100.' },
          agility: { type: 'integer', description: 'Velocidad y esquiva. Valor entre 5 y 50. La suma total de stats debe ser 100.' },
          perception: { type: 'integer', description: 'Puntería e instinto. Valor entre 5 y 50. La suma total de stats debe ser 100.' },
          resilience: { type: 'integer', description: 'Defensa y aguante. Valor entre 5 y 50. La suma total de stats debe ser 100.' },
          intelligence: { type: 'integer', description: 'Tecnología y táctica. Valor entre 5 y 50. La suma total de stats debe ser 100.' }
        },
        required: ['strength', 'agility', 'perception', 'resilience', 'intelligence']
      },
      uniqueAbility: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Nombre de la habilidad especial.' },
          description: { type: 'string', description: 'Descripción narrativa y mecánica de la habilidad especial.' }
        },
        required: ['name', 'description']
      },
      personalityDescription: { type: 'string', description: 'Descripción breve de cómo reacciona ante órdenes y cómo se comporta en batalla.' }
    },
    required: ['name', 'archetype', 'stats', 'uniqueAbility', 'personalityDescription']
  };

  /**
   * Generates a balanced Battle Agent based on a narrative description prompt.
   */
  async createCharacter(userPrompt: string): Promise<BattleAgent> {
    const systemInstruction = `Eres el generador de agentes del juego Battle Agents.
Tu tarea es tomar una descripción y generar un personaje con estadísticas balanceadas.
Reglas estrictas de balance:
1. Debes asignar exactamente 100 puntos en total distribuidos entre los 5 atributos (strength, agility, perception, resilience, intelligence).
2. Cada atributo individual debe ser de al menos 5 y como máximo 50.
3. El arquetipo debe ser uno de los cuatro permitidos.
4. Genera un nombre y una habilidad única adaptados a la descripción narrativa.`;

    const rawAgent = await this.llm.generateStructuredJSON<any>(
      `Genera un agente de batalla basado en este concepto: "${userPrompt}"`,
      CharacterCreator.CHARACTER_SCHEMA,
      systemInstruction
    );

    // Apply programmatic normalization to guarantee strict compliance with math rules
    const normalizedStats = this.normalizeStats(rawAgent.stats || {
      strength: 20,
      agility: 20,
      perception: 20,
      resilience: 20,
      intelligence: 20
    });

    return {
      id: Math.random().toString(36).substring(2, 11),
      name: rawAgent.name || 'Agente Sin Nombre',
      archetype: (rawAgent.archetype || 'guerrero_pragmatico') as Archetype,
      stats: normalizedStats,
      maxHp: 100,
      currentHp: 100,
      confidence: 50, // Starts at 50
      uniqueAbility: rawAgent.uniqueAbility || { name: 'Ataque Estándar', description: 'Golpe básico equilibrado.' },
      personalityDescription: rawAgent.personalityDescription || 'Guerrero estándar sin rasgos notables.'
    };
  }

  /**
   * Enforces stats constraints programmatically:
   * - Total stats sum must be exactly 100.
   * - Individual stats must be between 5 and 50.
   */
  private normalizeStats(rawStats: Record<string, number>): AgentStats {
    const keys = ['strength', 'agility', 'perception', 'resilience', 'intelligence'] as const;
    const stats: Record<string, number> = {};

    // 1. Clamp each stat to [5, 50]
    for (const key of keys) {
      let val = Math.round(Number(rawStats[key]));
      if (isNaN(val)) val = 20;
      stats[key] = Math.max(5, Math.min(50, val));
    }

    // 2. Adjust sum to exactly 100
    let currentSum = keys.reduce((sum, key) => sum + stats[key], 0);

    if (currentSum > 100) {
      // Subtract points from stats > 5
      let diff = currentSum - 100;
      while (diff > 0) {
        let reduced = false;
        for (const key of keys) {
          if (stats[key] > 5 && diff > 0) {
            stats[key]--;
            diff--;
            reduced = true;
          }
        }
        if (!reduced) break; // Safeguard
      }
    } else if (currentSum < 100) {
      // Add points to stats < 50
      let diff = 100 - currentSum;
      while (diff > 0) {
        let added = false;
        for (const key of keys) {
          if (stats[key] < 50 && diff > 0) {
            stats[key]++;
            diff--;
            added = true;
          }
        }
        if (!added) break; // Safeguard
      }
    }

    return {
      strength: stats.strength,
      agility: stats.agility,
      perception: stats.perception,
      resilience: stats.resilience,
      intelligence: stats.intelligence
    };
  }
}
