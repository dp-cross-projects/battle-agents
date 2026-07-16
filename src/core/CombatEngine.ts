import { LLMProvider } from '../providers/LLMProvider.js';
import { SafetyFilter } from './SafetyFilter.js';
import { 
  BattleAgent, 
  MapScenario, 
  CombatRoundResult, 
  LLMActionResponse, 
  AgentStats, 
  ActionType,
  Booster
} from '../types/index.js';

export class CombatEngine {
  private llm: LLMProvider;

  // The 5 maps defined for Phase 3
  public static readonly MAPS: MapScenario[] = [
    {
      name: 'Coliseo de Acero',
      statsModifiers: {},
      tags: ['cerrado', 'plano', 'iluminado'],
      impactDescription: 'Combate neutral y equilibrado sin alteración de atributos.'
    },
    {
      name: 'Pantano Neblinoso',
      statsModifiers: { agility: -10, perception: -10, resilience: 5 },
      tags: ['humedad', 'niebla_densa', 'fango'],
      impactDescription: 'Dificulta la agilidad y la visión. El fango espeso incrementa la resistencia al amortiguar golpes.'
    },
    {
      name: 'Fábrica Abandonada',
      statsModifiers: { intelligence: 10, strength: 5, perception: -5 },
      tags: ['maquinaria', 'cobertura', 'sombras'],
      impactDescription: 'Mejora las tácticas tecnológicas e incrementa la fuerza con objetos de metal. La chatarra bloquea líneas de visión.'
    },
    {
      name: 'Desierto Calcinante',
      statsModifiers: { agility: -5, resilience: -5, perception: -5, strength: 10 },
      tags: ['calor_extremo', 'tormenta_arena', 'abierto'],
      impactDescription: 'El calor extremo agota la energía y desorienta, pero la adrenalina desértica desata golpes de fuerza brutales.'
    },
    {
      name: 'Laboratorio de Gravedad Cero',
      statsModifiers: { agility: 10, intelligence: 5, resilience: -10 },
      tags: ['gravedad_cero', 'conductores_electricos', 'tecnologico'],
      impactDescription: 'La falta de gravedad potencia la agilidad y las interacciones de hackeo, pero la fragilidad del entorno expone a recibir más daño.'
    }
  ];

  private static ACTION_SCHEMA = {
    type: 'object',
    properties: {
      action_type: { 
        type: 'string', 
        enum: ['melee_attack', 'ranged_attack', 'dodge', 'defend', 'tactical', 'panic', 'inappropriate'],
        description: 'Tipo técnico de la acción.' 
      },
      reasoning: { type: 'string', description: 'Por qué el agente reacciona de esta forma basada en sus stats y personalidad.' },
      adapted_prompt: { type: 'string', description: 'Acción adaptada y realista redactada en tercera persona.' },
      confidence_modifier: { type: 'integer', description: 'Cambio de confianza sugerido (-10 a 10).' },
      verbal_reaction: { type: 'string', description: 'Diálogo que dice el personaje en voz alta sobre la orden recibida.' }
    },
    required: ['action_type', 'reasoning', 'adapted_prompt', 'confidence_modifier', 'verbal_reaction']
  };

  constructor(llm: LLMProvider) {
    this.llm = llm;
  }

  /**
   * Applies scenario and booster modifiers to character base stats.
   */
  public getModifiedStats(
    agent: BattleAgent, 
    map: MapScenario, 
    activeBooster?: Booster, 
    allBoosters?: Booster[]
  ): AgentStats {
    const s = agent.stats;
    const m = map.statsModifiers;

    let bonusStrength = 0;
    let bonusAgility = 0;
    let bonusPerception = 0;
    let bonusResilience = 0;
    let bonusIntelligence = 0;

    // Apply map modifiers (negate swamp agility penalty if espinilleras de fango is equipped and active)
    let mapAgilityMod = m.agility || 0;
    if (map.name === 'Pantano Neblinoso' && allBoosters) {
      const hasFango = allBoosters.some(b => b.id === 'booster_espinilleras_fango' && b.currentDurability > 0);
      if (hasFango) {
        mapAgilityMod = 0; // Negate the -10 Agility penalty
      }
    }

    // Apply passive boosters (armor parts that are not broken)
    if (allBoosters) {
      for (const b of allBoosters) {
        if (b.currentDurability > 0 && b.type !== 'weapon' && b.type !== 'tool') {
          if (b.statsModifiers) {
            bonusStrength += b.statsModifiers.strength || 0;
            bonusAgility += b.statsModifiers.agility || 0;
            bonusPerception += b.statsModifiers.perception || 0;
            bonusResilience += b.statsModifiers.resilience || 0;
            bonusIntelligence += b.statsModifiers.intelligence || 0;
          }
        }
      }
    }

    // Apply active booster (weapon or tool actively used in the current round)
    if (activeBooster && activeBooster.currentDurability > 0) {
      if (activeBooster.statsModifiers) {
        bonusStrength += activeBooster.statsModifiers.strength || 0;
        bonusAgility += activeBooster.statsModifiers.agility || 0;
        bonusPerception += activeBooster.statsModifiers.perception || 0;
        bonusResilience += activeBooster.statsModifiers.resilience || 0;
        bonusIntelligence += activeBooster.statsModifiers.intelligence || 0;
      }
    }

    return {
      strength: Math.max(5, s.strength + (m.strength || 0) + bonusStrength),
      agility: Math.max(5, s.agility + mapAgilityMod + bonusAgility),
      perception: Math.max(5, s.perception + (m.perception || 0) + bonusPerception),
      resilience: Math.max(5, s.resilience + (m.resilience || 0) + bonusResilience),
      intelligence: Math.max(5, s.intelligence + (m.intelligence || 0) + bonusIntelligence),
    };
  }

  /**
   * Filters the user input using the agent's identity and safety checks.
   */
  async filterAgentAction(
    agent: BattleAgent, 
    rawPrompt: string, 
    map: MapScenario,
    forcePanic: boolean,
    activeBooster?: Booster,
    allBoosters?: Booster[]
  ): Promise<LLMActionResponse> {
    // 1. Safety Filter Check
    const safetyCheck = SafetyFilter.isSafe(rawPrompt);
    if (!safetyCheck.isSafe) {
      return {
        action_type: 'inappropriate',
        reasoning: 'La acción viola las directrices de seguridad o contiene elementos +18.',
        adapted_prompt: 'El agente se niega a realizar la acción solicitada por ir en contra de su código ético.',
        confidence_modifier: -15,
        verbal_reaction: '¡No pienso hacer algo tan depravado u horrendo! Olvídalo.'
      };
    }

    const modifiedStats = this.getModifiedStats(agent, map, activeBooster, allBoosters);

    // 2. LLM Call to adapt the prompt
    const systemInstruction = `Eres la conciencia de ${agent.name} (género: ${agent.gender}), un agente de batalla con arquetipo "${agent.archetype}" y personalidad: "${agent.personalityDescription}".
Debes evaluar la orden (prompt) dada por tu operador (el jugador) y traducirla a una acción de combate realista considerando tus atributos modificados por el mapa y tu confianza actual.
Tus estadísticas modificadas en este combate son:
- Fuerza: ${modifiedStats.strength}
- Agilidad: ${modifiedStats.agility}
- Percepción: ${modifiedStats.perception}
- Resiliencia: ${modifiedStats.resilience}
- Inteligencia: ${modifiedStats.intelligence}
Nivel de confianza: ${agent.confidence}/100.
Escenario actual: ${map.name} (Tags: ${map.tags.join(', ')}).
${activeBooster ? `Estás usando activamente el booster: ${activeBooster.name} (${activeBooster.description})` : ''}

Reglas de adaptación:
- Si el operador pide hacer algo exageradamente tramposo o imposible para tus estadísticas, debes moderarlo hacia algo realista.
- Si tu confianza es alta (>70), eres audaz y optimista.
- Si tu confianza es baja (<30) o si te obligan a entrar en pánico (${forcePanic ? 'SÍ, estás en pánico' : 'no'}), tu acción debe volverse instintivamente defensiva o errática.
- Debes devolver la respuesta estrictamente en el formato JSON especificado.`;

    const prompt = `Orden del operador: "${rawPrompt}"
${forcePanic ? 'NOTA: Debes reaccionar con pánico debido a tu baja moral.' : ''}`;

    try {
      const response = await this.llm.generateStructuredJSON<LLMActionResponse>(
        prompt, 
        CombatEngine.ACTION_SCHEMA, 
        systemInstruction
      );
      // Sanitize confidence_modifier to be a valid number
      if (response) {
        response.confidence_modifier = typeof response.confidence_modifier === 'number' && !isNaN(response.confidence_modifier)
          ? response.confidence_modifier
          : parseInt(response.confidence_modifier as any) || 0;
      }
      return response;
    } catch (error) {
      // Fallback in case of LLM parse failure
      return this.getFallbackAction(rawPrompt, agent);
    }
  }


  /**
   * Generates a basic CPU action based on agent archetype and stats.
   */
  async generateCPUPrompt(cpuAgent: BattleAgent, playerAgent: BattleAgent): Promise<string> {
    const systemInstruction = `Eres la IA enemiga que controla a ${cpuAgent.name} (género: ${cpuAgent.gender}, Arquetipo: ${cpuAgent.archetype}).
Tu objetivo es derrotar a ${playerAgent.name} (género: ${playerAgent.gender}). Debes generar una acción corta de combate en una sola línea (máximo 150 caracteres).
Ejemplos:
- "Me cubro tras la maquinaria y disparo mi rifle láser."
- "Corro de frente e intento golpear al oponente con mi escudo."
- "Hackeo el sistema ambiental para activar los rociadores y desorientar al enemigo."`;

    const prompt = `Genera la orden de acción para este turno contra ${playerAgent.name}.`;
    try {
      return await this.llm.generateText(prompt, systemInstruction);
    } catch {
      // Return a basic action as fallback
      return cpuAgent.stats.strength > cpuAgent.stats.perception 
        ? 'Ataco cuerpo a cuerpo con un golpe directo.'
        : 'Disparo a distancia buscando un punto débil.';
    }
  }

  /**
   * Resolves the turn mathematically based on actions, stats, and boosters.
   */
  public resolveCombatTurn(
    agentA: BattleAgent, // Player
    actionA: LLMActionResponse,
    agentB: BattleAgent, // CPU
    actionB: LLMActionResponse,
    map: MapScenario,
    boostersA: Booster[] = [],
    boostersB: Booster[] = [],
    activeBoosterIdA: string | null = null,
    activeBoosterIdB: string | null = null
  ): CombatRoundResult {
    const mathLog: string[] = [];

    // Temporary round-based stat bonuses/penalties
    const tempA = { strength: 0, agility: 0, perception: 0, resilience: 0, intelligence: 0 };
    const tempB = { strength: 0, agility: 0, perception: 0, resilience: 0, intelligence: 0 };

    // Find active boosters
    const activeBoosterA = boostersA.find(b => b.id === activeBoosterIdA && b.currentDurability > 0);
    const activeBoosterB = boostersB.find(b => b.id === activeBoosterIdB && b.currentDurability > 0);

    // Apply active tool effects before initiative rolls
    if (activeBoosterA && activeBoosterA.type === 'tool') {
      activeBoosterA.currentDurability--;
      const val = activeBoosterA.value || 0;
      if (activeBoosterA.id === 'booster_inyector_adrenalina') {
        agentA.currentHp = Math.min(agentA.maxHp, agentA.currentHp + val);
        agentA.confidence = Math.min(100, agentA.confidence + 15);
        mathLog.push(`[Herramienta] ${agentA.name} activó ${activeBoosterA.name}: Cura ${val} HP y +15 Confianza. Usos restantes: ${activeBoosterA.currentDurability}/${activeBoosterA.durability}.`);
      } else if (activeBoosterA.id === 'booster_dispositivo_hackeo') {
        tempA.intelligence += val;
        agentB.confidence = Math.max(0, agentB.confidence - 10);
        mathLog.push(`[Herramienta] ${agentA.name} activó ${activeBoosterA.name}: +${val} Inteligencia temporal y -10 Confianza al rival. Usos restantes: ${activeBoosterA.currentDurability}/${activeBoosterA.durability}.`);
      } else if (activeBoosterA.id === 'booster_escudo_energia') {
        tempA.resilience += val;
        mathLog.push(`[Herramienta] ${agentA.name} activó ${activeBoosterA.name}: +${val} Resiliencia temporal. Usos restantes: ${activeBoosterA.currentDurability}/${activeBoosterA.durability}.`);
      } else if (activeBoosterA.id === 'booster_granada_aturdidora') {
        tempB.agility += val; // negative value (-15)
        mathLog.push(`[Herramienta] ${agentA.name} lanzó ${activeBoosterA.name}: -15 Agilidad temporal al oponente. Usos restantes: ${activeBoosterA.currentDurability}/${activeBoosterA.durability}.`);
      } else if (activeBoosterA.id === 'booster_bateria_respaldo') {
        agentA.currentHp = Math.min(agentA.maxHp, agentA.currentHp + val);
        tempA.strength += 5;
        mathLog.push(`[Herramienta] ${agentA.name} activó ${activeBoosterA.name}: Cura ${val} HP y +5 Fuerza temporal. Usos restantes: ${activeBoosterA.currentDurability}/${activeBoosterA.durability}.`);
      } else if (activeBoosterA.id === 'booster_proyector_holografico') {
        tempA.agility += val;
        mathLog.push(`[Herramienta] ${agentA.name} activó ${activeBoosterA.name}: +${val} Agilidad temporal. Usos restantes: ${activeBoosterA.currentDurability}/${activeBoosterA.durability}.`);
      }
    }

    if (activeBoosterB && activeBoosterB.type === 'tool') {
      activeBoosterB.currentDurability--;
      const val = activeBoosterB.value || 0;
      if (activeBoosterB.id === 'booster_inyector_adrenalina') {
        agentB.currentHp = Math.min(agentB.maxHp, agentB.currentHp + val);
        agentB.confidence = Math.min(100, agentB.confidence + 15);
        mathLog.push(`[Herramienta] ${agentB.name} activó ${activeBoosterB.name}: Cura ${val} HP y +15 Confianza. Usos restantes: ${activeBoosterB.currentDurability}/${activeBoosterB.durability}.`);
      } else if (activeBoosterB.id === 'booster_dispositivo_hackeo') {
        tempB.intelligence += val;
        agentA.confidence = Math.max(0, agentA.confidence - 10);
        mathLog.push(`[Herramienta] ${agentB.name} activó ${activeBoosterB.name}: +${val} Inteligencia temporal y -10 Confianza al rival. Usos restantes: ${activeBoosterB.currentDurability}/${activeBoosterB.durability}.`);
      } else if (activeBoosterB.id === 'booster_escudo_energia') {
        tempB.resilience += val;
        mathLog.push(`[Herramienta] ${agentB.name} activó ${activeBoosterB.name}: +${val} Resiliencia temporal. Usos restantes: ${activeBoosterB.currentDurability}/${activeBoosterB.durability}.`);
      } else if (activeBoosterB.id === 'booster_granada_aturdidora') {
        tempA.agility += val; // negative value (-15)
        mathLog.push(`[Herramienta] ${agentB.name} lanzó ${activeBoosterB.name}: -15 Agilidad temporal al oponente. Usos restantes: ${activeBoosterB.currentDurability}/${activeBoosterB.durability}.`);
      } else if (activeBoosterB.id === 'booster_bateria_respaldo') {
        agentB.currentHp = Math.min(agentB.maxHp, agentB.currentHp + val);
        tempB.strength += 5;
        mathLog.push(`[Herramienta] ${agentB.name} activó ${activeBoosterB.name}: Cura ${val} HP y +5 Fuerza temporal. Usos restantes: ${activeBoosterB.currentDurability}/${activeBoosterB.durability}.`);
      } else if (activeBoosterB.id === 'booster_proyector_holografico') {
        tempB.agility += val;
        mathLog.push(`[Herramienta] ${agentB.name} activó ${activeBoosterB.name}: +${val} Agilidad temporal. Usos restantes: ${activeBoosterB.currentDurability}/${activeBoosterB.durability}.`);
      }
    }

    // Apply map stats modification + passives + actives
    const statsA = this.getModifiedStats(agentA, map, activeBoosterA, boostersA);
    const statsB = this.getModifiedStats(agentB, map, activeBoosterB, boostersB);

    // Apply temporary round modifiers
    statsA.strength = Math.max(5, statsA.strength + tempA.strength);
    statsA.agility = Math.max(5, statsA.agility + tempA.agility);
    statsA.perception = Math.max(5, statsA.perception + tempA.perception);
    statsA.resilience = Math.max(5, statsA.resilience + tempA.resilience);
    statsA.intelligence = Math.max(5, statsA.intelligence + tempA.intelligence);

    statsB.strength = Math.max(5, statsB.strength + tempB.strength);
    statsB.agility = Math.max(5, statsB.agility + tempB.agility);
    statsB.perception = Math.max(5, statsB.perception + tempB.perception);
    statsB.resilience = Math.max(5, statsB.resilience + tempB.resilience);
    statsB.intelligence = Math.max(5, statsB.intelligence + tempB.intelligence);

    // Apply confidence modifiers
    agentA.confidence = Math.max(0, Math.min(100, agentA.confidence + actionA.confidence_modifier));
    agentB.confidence = Math.max(0, Math.min(100, agentB.confidence + actionB.confidence_modifier));

    // A. Roll Initiative: Agility + random(1-20)
    // Bonus +5 if confidence is high (>70). Penalty -5 if confidence is low (<30).
    const confBonusA = agentA.confidence > 70 ? 5 : (agentA.confidence < 30 ? -5 : 0);
    const confBonusB = agentB.confidence > 70 ? 5 : (agentB.confidence < 30 ? -5 : 0);

    const rollA = Math.floor(Math.random() * 20) + 1;
    const rollB = Math.floor(Math.random() * 20) + 1;
    const initA = statsA.agility + rollA + confBonusA;
    const initB = statsB.agility + rollB + confBonusB;

    mathLog.push(`Iniciativa: ${agentA.name} tiró ${rollA} (+Agility ${statsA.agility} +Confianza ${confBonusA}) = Total ${initA}.`);
    mathLog.push(`Iniciativa: ${agentB.name} tiró ${rollB} (+Agility ${statsB.agility} +Confianza ${confBonusB}) = Total ${initB}.`);

    const initiatives = [
      { agentId: agentA.id, agentName: agentA.name, roll: rollA, total: initA },
      { agentId: agentB.id, agentName: agentB.name, roll: rollB, total: initB }
    ].sort((a, b) => b.total - a.total);

    // Determine target actions
    const agentMap: Record<string, { 
      agent: BattleAgent; 
      action: LLMActionResponse; 
      stats: AgentStats; 
      activeBooster: Booster | undefined;
      ownBoosters: Booster[];
    }> = {
      [agentA.id]: { agent: agentA, action: actionA, stats: statsA, activeBooster: activeBoosterA, ownBoosters: boostersA },
      [agentB.id]: { agent: agentB, action: actionB, stats: statsB, activeBooster: activeBoosterB, ownBoosters: boostersB }
    };

    // Execute turns in initiative order
    for (const initUnit of initiatives) {
      const attackerId = initUnit.agentId;
      const defenderId = attackerId === agentA.id ? agentB.id : agentA.id;

      const { agent: attacker, action: attackAction, stats: aStats, activeBooster: aBooster } = agentMap[attackerId];
      const { agent: defender, action: defendAction, stats: dStats, ownBoosters: defBoosters } = agentMap[defenderId];

      if (attacker.currentHp <= 0) {
        mathLog.push(`${attacker.name} está fuera de combate y no puede actuar.`);
        continue;
      }

      const actionType = attackAction.action_type;

      if (actionType === 'inappropriate') {
        mathLog.push(`${attacker.name} se paraliza debido al comando inapropiado y pierde su turno.`);
        continue;
      }

      if (actionType === 'panic') {
        mathLog.push(`${attacker.name} está preso del pánico, huye buscando cobertura y no ataca.`);
        continue;
      }

      if (actionType === 'dodge' || actionType === 'defend') {
        mathLog.push(`${attacker.name} asume una postura defensiva (${actionType}).`);
        continue;
      }

      // Attack actions: melee_attack, ranged_attack, tactical
      let hitChance = 50;
      let isHit = false;

      // Temporary defense modifiers from defender's action
      const defenseBonus = defendAction.action_type === 'dodge' ? 15 : 0;
      const resilienceMultiplier = defendAction.action_type === 'defend' ? 2 : 1;

      // Check active weapon booster use
      let weaponDmgBonus = 0;
      if (aBooster && aBooster.type === 'weapon' && aBooster.currentDurability > 0) {
        // Enforce matching weapon type
        const isMeleeWeapon = ['booster_hoja_runica', 'booster_daga_vibratoria', 'booster_martillo_impulso'].includes(aBooster.id);
        const isRangedWeapon = ['booster_canon_plasma', 'booster_subfusil_tactico', 'booster_rifle_electrico'].includes(aBooster.id);

        if ((actionType === 'melee_attack' && isMeleeWeapon) || 
            (actionType === 'ranged_attack' && isRangedWeapon) || 
            (actionType === 'tactical' && aBooster.id === 'booster_rifle_electrico')) {
          aBooster.currentDurability--;
          if (aBooster.id === 'booster_hoja_runica') weaponDmgBonus = 6;
          else if (aBooster.id === 'booster_canon_plasma') weaponDmgBonus = 12;
          else if (aBooster.id === 'booster_daga_vibratoria') weaponDmgBonus = 4;
          else if (aBooster.id === 'booster_subfusil_tactico') weaponDmgBonus = 6;
          else if (aBooster.id === 'booster_martillo_impulso') weaponDmgBonus = 10;
          else if (aBooster.id === 'booster_rifle_electrico') weaponDmgBonus = 8;
          mathLog.push(`[Arma] ${attacker.name} ataca usando ${aBooster.name} (+${weaponDmgBonus} Daño). Usos restantes: ${aBooster.currentDurability}/${aBooster.durability}.`);
        }
      }

      if (actionType === 'melee_attack') {
        hitChance = 60 + (aStats.strength * 2) - ((dStats.agility + defenseBonus) * 2);
        hitChance = Math.max(10, Math.min(95, hitChance));
        const roll = Math.floor(Math.random() * 100) + 1;
        isHit = roll <= hitChance;
        mathLog.push(`Ataque Melee de ${attacker.name}: Precisión requerida <= ${hitChance}%. Sacó ${roll}%. ${isHit ? '¡IMPACTO!' : '¡FALLÓ!'}`);
      } else if (actionType === 'ranged_attack') {
        hitChance = 50 + (aStats.perception * 2) - ((dStats.agility + defenseBonus) * 2);
        hitChance = Math.max(10, Math.min(95, hitChance));
        const roll = Math.floor(Math.random() * 100) + 1;
        isHit = roll <= hitChance;
        mathLog.push(`Ataque Rango de ${attacker.name}: Precisión requerida <= ${hitChance}%. Sacó ${roll}%. ${isHit ? '¡IMPACTO!' : '¡FALLÓ!'}`);
      } else if (actionType === 'tactical') {
        hitChance = 55 + (aStats.intelligence * 2) - ((dStats.intelligence + defenseBonus) * 2);
        hitChance = Math.max(15, Math.min(90, hitChance));
        const roll = Math.floor(Math.random() * 100) + 1;
        isHit = roll <= hitChance;
        mathLog.push(`Acción Táctica de ${attacker.name}: Precisión requerida <= ${hitChance}%. Sacó ${roll}%. ${isHit ? '¡ÉXITO TÁCTICO!' : '¡FALLÓ!'}`);
      }

      if (isHit) {
        let rawDamage = 0;
        let randomFactor = Math.floor(Math.random() * 6) + 1; // 1d6 for variability

        if (actionType === 'melee_attack') {
          rawDamage = aStats.strength + randomFactor + weaponDmgBonus;
        } else if (actionType === 'ranged_attack') {
          rawDamage = aStats.perception + randomFactor + weaponDmgBonus;
        } else if (actionType === 'tactical') {
          rawDamage = Math.round(aStats.intelligence * 1.2) + randomFactor + weaponDmgBonus;
        }

        // Apply resilience (reduced for tactical hack)
        const finalResilience = actionType === 'tactical' ? 0 : dStats.resilience * resilienceMultiplier;
        const damageReduction = Math.floor(finalResilience * 0.5);

        // Apply passive armor damage absorption
        let armorAbsorption = 0;
        const activeArmors = defBoosters.filter(b => b.currentDurability > 0 && b.type !== 'weapon' && b.type !== 'tool');
        if (activeArmors.length > 0 && actionType !== 'tactical') {
          armorAbsorption = activeArmors.reduce((sum, arm) => sum + (arm.damageAbsorption || 0), 0);
          // Deduct 1 durability from the first active armor piece that contributed
          const hitArmor = activeArmors[0];
          hitArmor.currentDurability--;
          mathLog.push(`[Armadura] La armadura de ${defender.name} (${hitArmor.name}) absorbió ${hitArmor.damageAbsorption} de daño. Golpes restantes: ${hitArmor.currentDurability}/${hitArmor.durability}.`);
          if (hitArmor.currentDurability <= 0) {
            mathLog.push(`[Armadura] ⚠️ ¡La pieza de armadura (${hitArmor.name}) de ${defender.name} ha sido destruida!`);
          }
        }

        const finalDamage = Math.max(1, rawDamage - damageReduction - armorAbsorption);

        defender.currentHp = Math.max(0, defender.currentHp - finalDamage);
        mathLog.push(`Daño: ${attacker.name} causó ${finalDamage} HP de daño a ${defender.name} (Base ${rawDamage} - Reducción Resiliencia ${damageReduction} - Absorción Armadura ${armorAbsorption}). HP restante de ${defender.name}: ${defender.currentHp}/100.`);

        // Adjust confidence on success/failure
        attacker.confidence = Math.min(100, attacker.confidence + 5);
        defender.confidence = Math.max(0, defender.confidence - 5);
      } else {
        // If attack missed, defender might gain confidence
        if (defendAction.action_type === 'dodge') {
          defender.confidence = Math.min(100, defender.confidence + 3);
          mathLog.push(`${defender.name} esquivó exitosamente el ataque de ${attacker.name} (+3 Confianza).`);
        }
      }
    }

    return {
      initiatives,
      actions: {
        [agentA.id]: { rawPrompt: actionA.adapted_prompt, adaptedAction: actionA, appliedStats: statsA },
        [agentB.id]: { rawPrompt: actionB.adapted_prompt, adaptedAction: actionB, appliedStats: statsB }
      },
      mathLog,
      narrative: '', // Will be generated in the next step
      p1Boosters: boostersA,
      p2Boosters: boostersB
    };
  }

  /**
   * Generates the epic narrative text for the combat round using the LLM.
   */
  async generateNarrative(
    agentA: BattleAgent, 
    agentB: BattleAgent, 
    roundResult: CombatRoundResult,
    map: MapScenario
  ): Promise<string> {
    const systemInstruction = `Eres el "Máster de IA" de Battle Agents.
Tu tarea es convertir un registro matemático frío de una ronda de combate en un relato literario, emocionante y épico de un solo párrafo (máximo 6 líneas).
Usa el escenario y sus tags ambientales para describir los detalles.
Sé coherente con las estadísticas de daño y fallos reportadas.
No inventes daño o muertes adicionales que no estén en el registro matemático.`;

    const prompt = `Escenario: ${map.name} (Tags: ${map.tags.join(', ')})
Agente A: ${agentA.name} (Género: ${agentA.gender}, ${agentA.archetype}, HP: ${agentA.currentHp}/100, Confianza: ${agentA.confidence})
Agente B: ${agentB.name} (Género: ${agentB.gender}, ${agentB.archetype}, HP: ${agentB.currentHp}/100, Confianza: ${agentB.confidence})

Acciones planteadas:
- ${agentA.name}: "${roundResult.actions[agentA.id].adaptedAction.adapted_prompt}" (Reacción verbal: "${roundResult.actions[agentA.id].adaptedAction.verbal_reaction}")
- ${agentB.name}: "${roundResult.actions[agentB.id].adaptedAction.adapted_prompt}" (Reacción verbal: "${roundResult.actions[agentB.id].adaptedAction.verbal_reaction}")

Registro matemático de resolución:
${roundResult.mathLog.join('\n')}

Escribe la narración del turno en español:`;

    try {
      return await this.llm.generateText(prompt, systemInstruction);
    } catch {
      // Fallback Narrator
      return this.getFallbackNarrative(agentA, agentB, roundResult, map);
    }
  }

  /**
   * Deterministic fallback action if Filtro LLM fails.
   */
  private getFallbackAction(rawPrompt: string, agent: BattleAgent): LLMActionResponse {
    const lower = rawPrompt.toLowerCase();
    let action_type: ActionType = 'melee_attack';
    let verbal_reaction = '¡Entendido! Al ataque.';

    if (lower.includes('esquivar') || lower.includes('correr') || lower.includes('escapar')) {
      action_type = 'dodge';
      verbal_reaction = '¡Es hora de moverse rápido!';
    } else if (lower.includes('defender') || lower.includes('cubrir') || lower.includes('bloquear')) {
      action_type = 'defend';
      verbal_reaction = '¡Me cubro de los impactos!';
    } else if (lower.includes('hackear') || lower.includes('tecnologia') || lower.includes('gadget') || lower.includes('tactica')) {
      action_type = 'tactical';
      verbal_reaction = 'Usando mis sistemas auxiliares...';
    } else if (agent.stats.perception > agent.stats.strength) {
      action_type = 'ranged_attack';
      verbal_reaction = 'Apuntando al blanco.';
    }

    return {
      action_type,
      reasoning: 'Fallback determinista por error del proveedor de IA.',
      adapted_prompt: `El agente ejecuta una acción de combate instintiva: ${action_type === 'dodge' ? 'defensa móvil' : action_type === 'defend' ? 'bloqueo' : 'ataque básico'}.`,
      confidence_modifier: 0,
      verbal_reaction
    };
  }

  /**
   * Deterministic fallback narrative if Narrator LLM fails.
   */
  private getFallbackNarrative(
    agentA: BattleAgent, 
    agentB: BattleAgent, 
    roundResult: CombatRoundResult,
    map: MapScenario
  ): string {
    const damageLines = roundResult.mathLog.filter(line => line.includes('Daño:'));
    const missLines = roundResult.mathLog.filter(line => line.includes('esquivó') || line.includes('FALLÓ'));

    let summary = `[Motor de Continuidad] En el ${map.name}, se desata el enfrentamiento. `;
    
    if (damageLines.length > 0) {
      summary += damageLines.join(' ') + ' ';
    }
    if (missLines.length > 0) {
      summary += missLines.join(' ') + ' ';
    }
    if (damageLines.length === 0 && missLines.length === 0) {
      summary += 'Ambos contendientes se posicionan y analizan los movimientos del rival sin lograr asestar un golpe efectivo.';
    }

    summary += ` Estado actual - ${agentA.name} HP: ${agentA.currentHp}/100, ${agentB.name} HP: ${agentB.currentHp}/100.`;
    return summary;
  }
}
