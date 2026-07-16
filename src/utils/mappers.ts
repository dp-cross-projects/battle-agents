import { BattleAgent, Archetype } from '../types/index.js';

export function dbAgentToBattleAgent(dbAgent: any): BattleAgent {
  return {
    id: dbAgent.id,
    name: dbAgent.name,
    gender: dbAgent.gender as 'hombre' | 'mujer',
    archetype: dbAgent.archetype as Archetype,
    stats: {
      strength: dbAgent.strength,
      agility: dbAgent.agility,
      perception: dbAgent.perception,
      resilience: dbAgent.resilience,
      intelligence: dbAgent.intelligence,
    },
    maxHp: dbAgent.maxHp,
    currentHp: dbAgent.maxHp, // Initialize HP to maxHp for combat session
    confidence: dbAgent.confidence,
    uniqueAbility: {
      name: dbAgent.uniqueAbilityName,
      description: dbAgent.uniqueAbilityDesc,
    },
    personalityDescription: dbAgent.personalityDescription,
  };
}
