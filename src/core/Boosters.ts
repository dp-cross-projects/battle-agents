import { Booster } from '../types/index.js';

export const BOOSTERS_DATABASE: Omit<Booster, 'currentDurability'>[] = [
  // 1. Armas (weapons) - Activas, se usan al atacar
  {
    id: 'booster_hoja_runica',
    name: 'Hoja Rúnica',
    type: 'weapon',
    description: 'Espada de energía rúnica pura. Otorga +8 Fuerza y +5 Agilidad al atacar. Consume 1 uso por ataque.',
    durability: 3,
    statsModifiers: { strength: 8, agility: 5 }
  },
  {
    id: 'booster_canon_plasma',
    name: 'Cañón de Plasma',
    type: 'weapon',
    description: 'Arma pesada a rango que dispara esferas de energía concentrada. +12 Percepción, -5 Agilidad. 2 usos.',
    durability: 2,
    statsModifiers: { perception: 12, agility: -5 }
  },
  {
    id: 'booster_daga_vibratoria',
    name: 'Daga Vibratoria',
    type: 'weapon',
    description: 'Daga de alta frecuencia. Facilita impactos rápidos y evasiones. +5 Agilidad, +5 Percepción. 4 usos.',
    durability: 4,
    statsModifiers: { agility: 5, perception: 5 }
  },
  {
    id: 'booster_subfusil_tactico',
    name: 'Subfusil Táctico',
    type: 'weapon',
    description: 'Arma automática ligera ideal para abrumar a media distancia. +8 Percepción, +4 Agilidad. 3 usos.',
    durability: 3,
    statsModifiers: { perception: 8, agility: 4 }
  },
  {
    id: 'booster_martillo_impulso',
    name: 'Martillo de Impulso',
    type: 'weapon',
    description: 'Martillo de demolición acoplado con propulsores. +15 Fuerza, -8 Agilidad. 2 usos.',
    durability: 2,
    statsModifiers: { strength: 15, agility: -8 }
  },
  {
    id: 'booster_rifle_electrico',
    name: 'Rifle Eléctrico',
    type: 'weapon',
    description: 'Rifle que dispara arcos voltios. +10 Inteligencia, +5 Percepción al hackear/apuntar. 3 usos.',
    durability: 3,
    statsModifiers: { intelligence: 10, perception: 5 }
  },

  // 2. Partes de Armadura (head, torso, arms, legs) - Pasivas, absorben daño y pierden durabilidad al recibir daño
  {
    id: 'booster_visor_tactico',
    name: 'Visor Táctico',
    type: 'head',
    description: 'Casco con interfaz de puntería. Pasivo: +8 Percepción, +4 Inteligencia. Absorbe 2 de daño. Pierde durabilidad al ser golpeado. (3 golpes)',
    durability: 3,
    statsModifiers: { perception: 8, intelligence: 4 },
    damageAbsorption: 2
  },
  {
    id: 'booster_placa_titanio',
    name: 'Placa de Titanio',
    type: 'torso',
    description: 'Coraza reforzada ultrarresistente. Pasivo: +15 Resiliencia, -4 Agilidad. Absorbe 5 de daño. (4 golpes)',
    durability: 4,
    statsModifiers: { resilience: 15, agility: -4 },
    damageAbsorption: 5
  },
  {
    id: 'booster_guanteletes_fuerza',
    name: 'Guanteletes de Fuerza',
    type: 'arms',
    description: 'Protección hidráulica de brazos. Pasivo: +8 Fuerza, +4 Resiliencia. Absorbe 2 de daño. (3 golpes)',
    durability: 3,
    statsModifiers: { strength: 8, resilience: 4 },
    damageAbsorption: 2
  },
  {
    id: 'booster_botas_impulso',
    name: 'Botas de Impulso',
    type: 'legs',
    description: 'Botas propulsoras para esquivas de emergencia. Pasivo: +10 Agilidad. Absorbe 2 de daño. (3 golpes)',
    durability: 3,
    statsModifiers: { agility: 10 },
    damageAbsorption: 2
  },
  {
    id: 'booster_casco_nanobots',
    name: 'Casco de Nanobots',
    type: 'head',
    description: 'Casco con nanoconductores autorreparadores. Pasivo: +6 Resiliencia, +6 Inteligencia. Absorbe 2 de daño. (3 golpes)',
    durability: 3,
    statsModifiers: { resilience: 6, intelligence: 6 },
    damageAbsorption: 2
  },
  {
    id: 'booster_chaleco_kevlar',
    name: 'Chaleco Kevlar',
    type: 'torso',
    description: 'Protección corporal balística y ligera. Pasivo: +10 Resiliencia. Absorbe 3 de daño. (3 golpes)',
    durability: 3,
    statsModifiers: { resilience: 10 },
    damageAbsorption: 3
  },
  {
    id: 'booster_hombreras_reforzadas',
    name: 'Hombreras Reforzadas',
    type: 'arms',
    description: 'Hombreras pesadas para mitigar impactos de retroceso. Pasivo: +8 Resiliencia. Absorbe 2 de daño. (3 golpes)',
    durability: 3,
    statsModifiers: { resilience: 8 },
    damageAbsorption: 2
  },
  {
    id: 'booster_espinilleras_fango',
    name: 'Espinilleras de Fango',
    type: 'legs',
    description: 'Espinilleras especiales para terrenos densos. Pasivo: +5 Resiliencia, +5 Agilidad. Anula penalizaciones del Pantano. Absorbe 2 de daño. (3 golpes)',
    durability: 3,
    statsModifiers: { resilience: 5, agility: 5 },
    damageAbsorption: 2
  },

  // 3. Herramientas (tools) - Activas, consumen 1 uso cuando el jugador decide usarlas
  {
    id: 'booster_inyector_adrenalina',
    name: 'Inyector de Adrenalina',
    type: 'tool',
    description: 'Inyección rápida de estimulantes. Activable: Cura 25 HP e incrementa +15 de Confianza temporal en la ronda. 1 uso.',
    durability: 1,
    value: 25
  },
  {
    id: 'booster_dispositivo_hackeo',
    name: 'Dispositivo de Hackeo',
    type: 'tool',
    description: 'Consola inalámbrica portátil. Activable: +15 Inteligencia y reduce en 10 la Confianza del oponente. 2 usos.',
    durability: 2,
    value: 15
  },
  {
    id: 'booster_escudo_energia',
    name: 'Escudo de Energía',
    type: 'tool',
    description: 'Generador de escudo estático temporal. Activable: Brinda +30 Resiliencia durante la ronda. 2 usos.',
    durability: 2,
    value: 30
  },
  {
    id: 'booster_granada_aturdidora',
    name: 'Granada Aturdidora',
    type: 'tool',
    description: 'Granada cegadora de alta intensidad. Activable: Reduce la Agilidad del oponente en -15 durante la ronda. 2 usos.',
    durability: 2,
    value: -15
  },
  {
    id: 'booster_bateria_respaldo',
    name: 'Batería de Respaldo',
    type: 'tool',
    description: 'Celda auxiliar de soporte vital. Activable: Recupera 20 HP y otorga +5 Fuerza temporal. 2 usos.',
    durability: 2,
    value: 20
  },
  {
    id: 'booster_proyector_holografico',
    name: 'Proyector Holográfico',
    type: 'tool',
    description: 'Crea copias fantasma de evasión. Activable: Otorga +20 Agilidad durante la ronda. 2 usos.',
    durability: 2,
    value: 20
  }
];

/**
 * Instantiates a booster from the database by its ID.
 */
export function createBoosterInstance(id: string): Booster | null {
  const base = BOOSTERS_DATABASE.find(b => b.id === id);
  if (!base) return null;
  return {
    ...base,
    currentDurability: base.durability
  };
}
