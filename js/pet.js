/**
 * PetMaster - Máquina de Estados e POO do Animal Virtual
 * Gerenciamento de atributos vitais com decaimento temporal ponderado (delta-time).
 */

import { getSpeciesById } from './speciesData.js';

export const PET_STATES = {
  EGG: 'egg',
  IDLE: 'idle',
  EATING: 'eating',
  BATHING: 'bathing',
  SLEEPING: 'sleeping',
  PLAYING: 'playing',
  SICK: 'sick',
  CRITICAL: 'critical'
};

export const GROWTH_STAGES = {
  EGG: 'egg',
  BABY: 'baby',
  TEEN: 'teen',
  ADULT: 'adult'
};

export const XP_THRESHOLDS = {
  BABY: 0,
  TEEN: 150,
  ADULT: 450
};

export class Pet {
  constructor(data = {}) {
    this.id = data.id || 'pet_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
    this.name = data.name || 'Pipoca';
    this.speciesId = data.speciesId || 'capybara';
    this.stage = data.stage || GROWTH_STAGES.EGG;
    this.state = data.state || (this.stage === GROWTH_STAGES.EGG ? PET_STATES.EGG : PET_STATES.IDLE);
    
    // Atributos Vitais (0 a 100%)
    this.hunger = typeof data.hunger === 'number' ? data.hunger : 90;
    this.hygiene = typeof data.hygiene === 'number' ? data.hygiene : 90;
    this.energy = typeof data.energy === 'number' ? data.energy : 90;
    this.happiness = typeof data.happiness === 'number' ? data.happiness : 90;
    this.health = typeof data.health === 'number' ? data.health : 100;
    
    // Progressão
    this.xp = typeof data.xp === 'number' ? data.xp : 0;
    this.level = typeof data.level === 'number' ? data.level : 1;
    this.hatchClicks = typeof data.hatchClicks === 'number' ? data.hatchClicks : 0;
    this.hatchClicksRequired = 5;

    // Timestamps
    this.createdAt = data.createdAt || Date.now();
    this.lastUpdated = data.lastUpdated || Date.now();
    this.lastFed = data.lastFed || Date.now();
    this.lastCleaned = data.lastCleaned || Date.now();
    this.lastPlayed = data.lastPlayed || Date.now();

    // Estado interno temporário (não serializado permanentemente)
    this.stateTimer = 0;
    this.stateDuration = 0;
  }

  get species() {
    return getSpeciesById(this.speciesId);
  }

  // Taxa base de decaimento por hora convertida para por segundo
  // Em média: 100% de fome decai em 12 horas jogadas (aprox. 0.0023 por segundo)
  getDecayPerSecond() {
    const baseRatePerSecond = 0.0025; // ~9% por hora
    const rates = this.species.decayRates || { hunger: 1.0, hygiene: 1.0, energy: 1.0, happiness: 1.0 };
    
    // Durante o sono, energia recupera e fome/higiene decaem 60% mais devagar
    const sleepFactor = this.state === PET_STATES.SLEEPING ? 0.4 : 1.0;

    return {
      hunger: baseRatePerSecond * rates.hunger * sleepFactor,
      hygiene: baseRatePerSecond * rates.hygiene * sleepFactor,
      energy: baseRatePerSecond * rates.energy,
      happiness: baseRatePerSecond * rates.happiness
    };
  }

  // Atualização em tempo real chamada a cada tick do loop (delta em segundos)
  update(deltaSeconds) {
    if (this.stage === GROWTH_STAGES.EGG) {
      this.lastUpdated = Date.now();
      return;
    }

    // Gerenciador de estados com timer temporário (ex: mastigando, tomando banho)
    if (this.stateDuration > 0) {
      this.stateTimer += deltaSeconds;
      if (this.stateTimer >= this.stateDuration) {
        this.stateDuration = 0;
        this.stateTimer = 0;
        if (this.state !== PET_STATES.SLEEPING && this.state !== PET_STATES.CRITICAL) {
          this.state = PET_STATES.IDLE;
        }
      }
    }

    const rates = this.getDecayPerSecond();

    // Decaimento de Fome e Higiene
    this.hunger = Math.max(0, this.hunger - (rates.hunger * deltaSeconds * 10));
    this.hygiene = Math.max(0, this.hygiene - (rates.hygiene * deltaSeconds * 10));
    this.happiness = Math.max(0, this.happiness - (rates.happiness * deltaSeconds * 10));

    // Energia
    if (this.state === PET_STATES.SLEEPING) {
      // Regenera energia durante o sono (100% em ~10 minutos ou acelerado)
      this.energy = Math.min(100, this.energy + (0.05 * deltaSeconds * 10));
      if (this.energy >= 100) {
        this.state = PET_STATES.IDLE; // Acorda automaticamente
      }
    } else {
      this.energy = Math.max(0, this.energy - (rates.energy * deltaSeconds * 10));
    }

    // Lógica de Saúde e Enfermidade
    const isCritical = this.hunger < 15 || this.hygiene < 15 || this.energy < 10;
    if (isCritical) {
      this.health = Math.max(0, this.health - (0.02 * deltaSeconds * 10));
      if (this.health < 30 && this.state !== PET_STATES.CRITICAL && this.state !== PET_STATES.SLEEPING) {
        this.state = PET_STATES.SICK;
      }
    } else {
      // Recuperação gradual se bem cuidado
      if (this.health < 100) {
        this.health = Math.min(100, this.health + (0.01 * deltaSeconds * 10));
      }
      if (this.state === PET_STATES.SICK && this.health > 50) {
        this.state = PET_STATES.IDLE;
      }
    }

    if (this.health <= 5) {
      this.state = PET_STATES.CRITICAL;
    }

    this.lastUpdated = Date.now();
  }

  // Processa o decaimento acumulado enquanto a PWA esteve fechada
  applyOfflineDecay(now = Date.now()) {
    if (this.stage === GROWTH_STAGES.EGG) {
      this.lastUpdated = now;
      return null;
    }

    const elapsedSeconds = Math.max(0, (now - this.lastUpdated) / 1000);
    // Limite máximo de decaimento de 36 horas para não punir desproporcionalmente o aluno
    const cappedSeconds = Math.min(elapsedSeconds, 36 * 3600);

    if (cappedSeconds < 5) return null;

    const rates = this.getDecayPerSecond();
    const hungerLoss = rates.hunger * cappedSeconds * 10;
    const hygieneLoss = rates.hygiene * cappedSeconds * 10;
    const happinessLoss = rates.happiness * cappedSeconds * 10;

    this.hunger = Math.max(5, this.hunger - hungerLoss);
    this.hygiene = Math.max(5, this.hygiene - hygieneLoss);
    this.happiness = Math.max(5, this.happiness - happinessLoss);

    if (this.state === PET_STATES.SLEEPING) {
      this.energy = 100;
      this.state = PET_STATES.IDLE;
    } else {
      const energyLoss = rates.energy * cappedSeconds * 10;
      this.energy = Math.max(5, this.energy - energyLoss);
    }

    // Se passou muito tempo e os atributos zeraram, perde saúde
    if (this.hunger <= 10 || this.hygiene <= 10) {
      this.health = Math.max(20, this.health - 40);
      this.state = PET_STATES.SICK;
    }

    this.lastUpdated = now;

    return {
      hoursAway: (cappedSeconds / 3600).toFixed(1),
      hungerLost: Math.round(hungerLoss),
      hygieneLost: Math.round(hygieneLoss)
    };
  }

  // Interação: Chocar o ovo
  warmEgg() {
    if (this.stage !== GROWTH_STAGES.EGG) return false;
    this.hatchClicks++;
    if (this.hatchClicks >= this.hatchClicksRequired) {
      this.stage = GROWTH_STAGES.BABY;
      this.state = PET_STATES.IDLE;
      this.addXP(50);
      return true; // Chocou!
    }
    return false;
  }

  // Interação: Alimentar
  feed(foodItem) {
    if (this.stage === GROWTH_STAGES.EGG) return { success: false, reason: 'Ovo ainda não chocou!' };
    if (this.state === PET_STATES.SLEEPING) return { success: false, reason: 'O animal está dormindo!' };
    if (this.hunger >= 100) return { success: false, reason: 'O animal já está satisfeito!' };

    const isFav = this.species.favoriteFood === foodItem.name;
    const hungerGain = isFav ? Math.round(foodItem.hungerVal * 1.3) : foodItem.hungerVal;
    const happyGain = isFav ? (foodItem.happyVal + 10) : foodItem.happyVal;
    const xpGain = isFav ? 25 : 15;

    this.hunger = Math.min(100, this.hunger + hungerGain);
    this.happiness = Math.min(100, this.happiness + happyGain);
    this.lastFed = Date.now();

    this.state = PET_STATES.EATING;
    this.stateDuration = 2.5; // Animação de 2.5s
    this.stateTimer = 0;

    const evolved = this.addXP(xpGain);

    return {
      success: true,
      isFav,
      hungerGain,
      happyGain,
      xpGain,
      evolved
    };
  }

  // Interação: Banho / Higienizar
  clean(careItem = null) {
    if (this.stage === GROWTH_STAGES.EGG) return { success: false, reason: 'Ovo ainda não chocou!' };
    if (this.state === PET_STATES.SLEEPING) return { success: false, reason: 'O animal está dormindo!' };
    if (this.hygiene >= 100) return { success: false, reason: 'O animal já está bem limpinho!' };

    const boost = careItem ? careItem.hygieneVal : 35;
    this.hygiene = Math.min(100, this.hygiene + boost);
    this.happiness = Math.min(100, this.happiness + 8);
    this.lastCleaned = Date.now();

    this.state = PET_STATES.BATHING;
    this.stateDuration = 2.5;
    this.stateTimer = 0;

    const evolved = this.addXP(15);

    return { success: true, boost, evolved };
  }

  // Interação: Dormir / Acordar
  toggleSleep() {
    if (this.stage === GROWTH_STAGES.EGG) return { success: false, reason: 'Ovo ainda não chocou!' };

    if (this.state === PET_STATES.SLEEPING) {
      this.state = PET_STATES.IDLE;
      return { success: true, sleeping: false };
    } else {
      if (this.energy > 95) return { success: false, reason: 'O animal está cheio de energia!' };
      this.state = PET_STATES.SLEEPING;
      this.stateDuration = 0;
      return { success: true, sleeping: true };
    }
  }

  // Interação: Curar com remédio/poção
  heal(medicine) {
    if (this.health >= 100 && this.state !== PET_STATES.SICK) {
      return { success: false, reason: 'O animal está completamente saudável!' };
    }

    this.health = 100;
    this.state = PET_STATES.IDLE;
    this.stateDuration = 0;
    this.happiness = Math.min(100, this.happiness + 15);

    return { success: true };
  }

  // Interação: Brincadeira e Minigames
  play(score = 0, coinsEarned = 0) {
    if (this.stage === GROWTH_STAGES.EGG) return { success: false };
    if (this.state === PET_STATES.SLEEPING) return { success: false, reason: 'O animal está dormindo!' };

    const happyGain = Math.min(40, 15 + Math.floor(score / 5));
    const energyCost = 15;

    this.happiness = Math.min(100, this.happiness + happyGain);
    this.energy = Math.max(0, this.energy - energyCost);
    this.lastPlayed = Date.now();

    const xpEarned = 20 + Math.floor(score / 3);
    const evolved = this.addXP(xpEarned);

    return {
      success: true,
      happyGain,
      energyCost,
      xpEarned,
      evolved
    };
  }

  // Sistema de XP e Transição de Estágios
  addXP(amount) {
    this.xp += amount;
    this.level = 1 + Math.floor(this.xp / 100);

    let stageChanged = false;
    const oldStage = this.stage;

    if (this.stage === GROWTH_STAGES.BABY && this.xp >= XP_THRESHOLDS.TEEN) {
      this.stage = GROWTH_STAGES.TEEN;
      stageChanged = true;
    } else if (this.stage === GROWTH_STAGES.TEEN && this.xp >= XP_THRESHOLDS.ADULT) {
      this.stage = GROWTH_STAGES.ADULT;
      stageChanged = true;
    }

    return stageChanged ? { oldStage, newStage: this.stage } : null;
  }

  // Verifica se o animal atingiu a fase adulta e está pronto para o Santuário
  canRelease() {
    return this.stage === GROWTH_STAGES.ADULT && this.health >= 70;
  }

  // Serialização limpa para LocalStorage e Firebase
  serialize() {
    return {
      id: this.id,
      name: this.name,
      speciesId: this.speciesId,
      stage: this.stage,
      state: this.state === PET_STATES.SLEEPING ? PET_STATES.SLEEPING : PET_STATES.IDLE,
      hunger: Math.round(this.hunger),
      hygiene: Math.round(this.hygiene),
      energy: Math.round(this.energy),
      happiness: Math.round(this.happiness),
      health: Math.round(this.health),
      xp: this.xp,
      level: this.level,
      hatchClicks: this.hatchClicks,
      createdAt: this.createdAt,
      lastUpdated: this.lastUpdated,
      lastFed: this.lastFed,
      lastCleaned: this.lastCleaned,
      lastPlayed: this.lastPlayed
    };
  }

  static deserialize(json) {
    if (!json) return null;
    return new Pet(json);
  }
}
