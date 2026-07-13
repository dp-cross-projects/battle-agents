export type Archetype = 'cobarde_sarcastico' | 'paladin_orgulloso' | 'ansioso_inseguro' | 'guerrero_pragmatico';

export interface AgentStats {
  strength: number;      // Daño cuerpo a cuerpo
  agility: number;       // Esquiva e iniciativa
  perception: number;    // Puntería a rango
  resilience: number;    // Reducción de daño
  intelligence: number;  // Hackeo y habilidades tácticas
}

export interface UniqueAbility {
  name: string;
  description: string;
}

export interface BattleAgent {
  id: string;
  name: string;
  archetype: Archetype;
  stats: AgentStats;
  maxHp: number;
  currentHp: number;
  confidence: number; // 0 a 100
  uniqueAbility: UniqueAbility;
  personalityDescription: string;
}

export type ActionType = 'melee_attack' | 'ranged_attack' | 'dodge' | 'defend' | 'tactical' | 'panic' | 'inappropriate';

export interface LLMActionResponse {
  action_type: ActionType;
  reasoning: string;
  adapted_prompt: string;
  confidence_modifier: number;
  verbal_reaction: string;
}

export interface MapScenario {
  name: string;
  statsModifiers: Partial<AgentStats>;
  tags: string[];
  impactDescription: string;
}

export interface InitiativeRoll {
  agentId: string;
  agentName: string;
  roll: number;
  total: number;
}

export interface CombatRoundResult {
  initiatives: InitiativeRoll[];
  actions: {
    [agentId: string]: {
      rawPrompt: string;
      adaptedAction: LLMActionResponse;
      appliedStats: AgentStats;
    };
  };
  mathLog: string[];
  narrative: string;
}
