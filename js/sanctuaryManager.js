/**
 * PetMaster - Santuário Natural e Animaldex
 * Catálogo das 35 espécies biológicas, biomas preservados e soltura de animais adultos.
 */

import { SPECIES_DATABASE, BIOMES, ANIMAL_CLASSES, getSpeciesById } from './speciesData.js';
import { soundFx } from './audio.js';

export class SanctuaryManager {
  constructor(app) {
    this.app = app;
    this.data = this.loadData();

    this.dom = {
      sanctuaryModal: document.getElementById('sanctuary-modal'),
      closeSanctuaryModalBtn: document.getElementById('close-sanctuary-modal-btn'),
      tabBiomesBtn: document.getElementById('tab-sanctuary-biomes-btn'),
      tabDexBtn: document.getElementById('tab-sanctuary-dex-btn'),
      biomesContainer: document.getElementById('sanctuary-biomes-view'),
      dexContainer: document.getElementById('sanctuary-dex-view'),
      dexProgressText: document.getElementById('dex-progress-text'),
      dexProgressBar: document.getElementById('dex-progress-bar'),
      dexFilterClass: document.getElementById('dex-filter-class'),
      speciesGrid: document.getElementById('species-catalog-grid'),
      releasePetBtn: document.getElementById('release-pet-btn'),
      adoptEggModal: document.getElementById('adopt-egg-modal'),
      closeAdoptModalBtn: document.getElementById('close-adopt-modal-btn'),
      eggOptionsGrid: document.getElementById('egg-options-grid')
    };

    this.init();
  }

  loadData() {
    const saved = this.app.db ? this.app.db.loadSanctuary() : null;
    return saved || {
      discoveredSpecies: ['capybara'], // Capivara desbloqueada por padrão
      releasedAnimals: [],
      biomesProtectionLevel: {
        rainforest: 1,
        wetlands: 1,
        savanna: 1,
        ocean: 1,
        coastal: 1
      }
    };
  }

  saveData() {
    if (this.app.db) {
      this.app.db.saveSanctuary(this.data);
    }
  }

  serialize() {
    return this.data;
  }

  init() {
    this.bindEvents();
    this.updateStats();
  }

  bindEvents() {
    if (this.dom.closeSanctuaryModalBtn) {
      this.dom.closeSanctuaryModalBtn.addEventListener('click', () => this.closeSanctuaryModal());
    }

    if (this.dom.tabBiomesBtn) {
      this.dom.tabBiomesBtn.addEventListener('click', () => this.switchTab('biomes'));
    }

    if (this.dom.tabDexBtn) {
      this.dom.tabDexBtn.addEventListener('click', () => this.switchTab('dex'));
    }

    if (this.dom.dexFilterClass) {
      this.dom.dexFilterClass.addEventListener('change', () => this.renderAnimaldex());
    }

    if (this.dom.releasePetBtn) {
      this.dom.releasePetBtn.addEventListener('click', () => this.handleReleaseCurrentPet());
    }

    if (this.dom.closeAdoptModalBtn) {
      this.dom.closeAdoptModalBtn.addEventListener('click', () => this.closeAdoptModal());
    }
  }

  openSanctuaryModal(initialTab = 'biomes') {
    if (!this.dom.sanctuaryModal) return;
    this.switchTab(initialTab);
    this.renderSanctuaryBiomes();
    this.renderAnimaldex();
    this.updateStats();
    this.dom.sanctuaryModal.classList.remove('hidden');
    document.body.classList.add('overflow-hidden');
    soundFx.playClick();
  }

  closeSanctuaryModal() {
    if (!this.dom.sanctuaryModal) return;
    this.dom.sanctuaryModal.classList.add('hidden');
    document.body.classList.remove('overflow-hidden');
    soundFx.playClick();
  }

  switchTab(tab) {
    if (tab === 'biomes') {
      if (this.dom.tabBiomesBtn) {
        this.dom.tabBiomesBtn.className = 'px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 text-white shadow-md transition-all';
      }
      if (this.dom.tabDexBtn) {
        this.dom.tabDexBtn.className = 'px-4 py-2 rounded-xl text-xs font-bold text-gray-400 hover:text-white transition-all';
      }
      if (this.dom.biomesContainer) this.dom.biomesContainer.classList.remove('hidden');
      if (this.dom.dexContainer) this.dom.dexContainer.classList.add('hidden');
      this.renderSanctuaryBiomes();
    } else {
      if (this.dom.tabDexBtn) {
        this.dom.tabDexBtn.className = 'px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 text-white shadow-md transition-all';
      }
      if (this.dom.tabBiomesBtn) {
        this.dom.tabBiomesBtn.className = 'px-4 py-2 rounded-xl text-xs font-bold text-gray-400 hover:text-white transition-all';
      }
      if (this.dom.dexContainer) this.dom.dexContainer.classList.remove('hidden');
      if (this.dom.biomesContainer) this.dom.biomesContainer.classList.add('hidden');
      this.renderAnimaldex();
    }
    soundFx.playClick();
  }

  updateStats() {
    const total = SPECIES_DATABASE.length;
    const discovered = this.data.discoveredSpecies.length;
    const pct = Math.round((discovered / total) * 100);

    if (this.dom.dexProgressText) {
      this.dom.dexProgressText.textContent = `${discovered} de ${total} Espécies (${pct}%)`;
    }
    if (this.dom.dexProgressBar) {
      this.dom.dexProgressBar.style.width = `${pct}%`;
    }

    // Atualiza botão de soltura
    if (this.dom.releasePetBtn && this.app.pet) {
      const canRelease = this.app.pet.canRelease();
      this.dom.releasePetBtn.disabled = !canRelease;
      if (canRelease) {
        this.dom.releasePetBtn.className = 'w-full py-3 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 font-bold text-white text-xs shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 cursor-pointer transition-all animate-bounce';
      } else {
        this.dom.releasePetBtn.className = 'w-full py-3 rounded-2xl bg-gray-800 text-gray-500 font-bold text-xs flex items-center justify-center gap-2 cursor-not-allowed';
      }
    }
  }

  // Renderiza a visualização dos 5 Biomas com os animais libertados
  renderSanctuaryBiomes() {
    if (!this.dom.biomesContainer) return;
    this.dom.biomesContainer.innerHTML = '';

    const validBiomes = BIOMES.filter(b => b.id !== 'all');

    validBiomes.forEach((biome) => {
      const releasedInBiome = this.data.releasedAnimals.filter(a => {
        const sp = getSpeciesById(a.speciesId);
        return sp && sp.biome === biome.id;
      });

      const card = document.createElement('div');
      card.className = 'p-4 rounded-2xl bg-gray-900/60 border border-gray-800 flex flex-col gap-3 relative overflow-hidden';

      let animalsHtml = '';
      if (releasedInBiome.length === 0) {
        animalsHtml = '<div class="py-4 text-center text-xs text-gray-500 italic">Nenhum animal reintroduzido neste bioma ainda. Cuide de um filhote até a fase adulta para povoá-lo!</div>';
      } else {
        animalsHtml = `
          <div class="flex flex-wrap gap-2 pt-1">
            ${releasedInBiome.map(a => `
              <div class="px-2.5 py-1.5 rounded-xl bg-emerald-950/70 border border-emerald-800/80 flex items-center gap-1.5 shadow-sm text-xs" title="${a.name} (${a.speciesName}) - Libertado em ${new Date(a.releasedAt).toLocaleDateString()}">
                <span class="text-base">${a.emoji}</span>
                <span class="font-bold text-emerald-300">${a.name}</span>
                <span class="text-[10px] text-emerald-500/80">Nv.${a.level}</span>
              </div>
            `).join('')}
          </div>
        `;
      }

      card.innerHTML = `
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2.5">
            <span class="text-2xl">${biome.icon}</span>
            <div>
              <h4 class="text-sm font-bold text-white">${biome.name}</h4>
              <span class="text-[11px] text-gray-400">${releasedInBiome.length} animais vivendo livres</span>
            </div>
          </div>
          <span class="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-bold">Preservado</span>
        </div>
        ${animalsHtml}
      `;

      this.dom.biomesContainer.appendChild(card);
    });
  }

  // Renderiza a Animaldex com as 35 espécies
  renderAnimaldex() {
    if (!this.dom.speciesGrid) return;
    this.dom.speciesGrid.innerHTML = '';

    const filterVal = this.dom.dexFilterClass ? this.dom.dexFilterClass.value : 'all';
    const filtered = filterVal === 'all'
      ? SPECIES_DATABASE
      : SPECIES_DATABASE.filter(s => s.class === filterVal);

    filtered.forEach((sp) => {
      const isDiscovered = this.data.discoveredSpecies.includes(sp.id);
      const card = document.createElement('div');
      card.className = `p-3 rounded-2xl border transition-all flex flex-col justify-between ${
        isDiscovered
          ? 'bg-gray-900/80 border-emerald-500/40 hover:border-emerald-400'
          : 'bg-gray-950/40 border-gray-800/60 opacity-60'
      }`;

      if (isDiscovered) {
        card.innerHTML = `
          <div>
            <div class="flex items-start justify-between">
              <span class="text-3xl">${sp.emoji}</span>
              <span class="text-[10px] px-1.5 py-0.5 rounded bg-gray-800 text-gray-300 font-mono font-semibold">${sp.rarity.toUpperCase()}</span>
            </div>
            <h5 class="text-xs font-bold text-white mt-2">${sp.name}</h5>
            <p class="text-[10px] text-emerald-400 italic">${sp.scientificName}</p>
            <div class="mt-1 flex items-center gap-1 text-[10px] text-gray-400">
              <span>${sp.class}</span> • <span>${sp.biomeName}</span>
            </div>
            <p class="text-[11px] text-gray-300 mt-2 line-clamp-3 leading-tight">${sp.curiosity}</p>
          </div>
          <div class="mt-2 pt-2 border-t border-gray-800 text-[10px] text-emerald-300 flex items-center justify-between">
            <span>Comida Fav:</span>
            <strong>${sp.favoriteFood}</strong>
          </div>
        `;
      } else {
        card.innerHTML = `
          <div class="text-center py-4">
            <div class="text-3xl filter grayscale opacity-40">❓</div>
            <h5 class="text-xs font-bold text-gray-400 mt-2">Espécie Oculta</h5>
            <p class="text-[10px] text-gray-500 mt-1">${sp.class} • ${sp.biomeName}</p>
            <p class="text-[10px] text-gray-600 mt-2 italic">Choque ovos no Santuário para catalogar esta espécie.</p>
          </div>
        `;
      }

      this.dom.speciesGrid.appendChild(card);
    });
  }

  // Soltura do Animal Adulto no Santuário
  handleReleaseCurrentPet() {
    const pet = this.app.pet;
    if (!pet || !pet.canRelease()) {
      alert('Seu pet ainda precisa atingir a fase Adulta com pelo menos 70% de saúde para ser reintroduzido no bioma nativo!');
      return;
    }

    const confirmRelease = confirm(
      `🌿 PARABÉNS PELO TRABALHO DE GUARDIÃO!\n\n` +
      `Deseja reintroduzir ${pet.name} (${pet.species.name}) no bioma ${pet.species.biomeName}?\n\n` +
      `Ele viverá livre e protegido no Santuário. Você receberá:\n` +
      `• +100 Moedas de Recompensa Ecológica\n` +
      `• Desbloqueio de um novo ovo para cuidar!`
    );

    if (!confirmRelease) return;

    // Registra no Santuário
    this.data.releasedAnimals.push({
      id: pet.id,
      name: pet.name,
      speciesId: pet.speciesId,
      speciesName: pet.species.name,
      emoji: pet.species.emoji,
      level: pet.level,
      xp: pet.xp,
      releasedAt: Date.now()
    });

    this.saveData();
    this.app.addCoins(100);
    soundFx.playRelease();

    if (window.confetti) {
      window.confetti({ particleCount: 120, spread: 80, origin: { y: 0.5 } });
    }

    this.app.showToast(`🎓 ${pet.name} foi libertado com sucesso no Santuário!`, 'success');
    this.closeSanctuaryModal();

    // Abre modal para escolher novo ovo
    setTimeout(() => {
      this.openAdoptModal();
    }, 600);
  }

  // Adoção / Escolha de Novo Ovo
  openAdoptModal() {
    if (!this.dom.adoptEggModal) return;
    this.renderEggOptions();
    this.dom.adoptEggModal.classList.remove('hidden');
    document.body.classList.add('overflow-hidden');
    soundFx.playClick();
  }

  closeAdoptModal() {
    if (!this.dom.adoptEggModal) return;
    this.dom.adoptEggModal.classList.add('hidden');
    document.body.classList.remove('overflow-hidden');
  }

  renderEggOptions() {
    if (!this.dom.eggOptionsGrid) return;
    this.dom.eggOptionsGrid.innerHTML = '';

    // Sorteia 4 opções de ovos para escolha (ou desbloqueados)
    const options = SPECIES_DATABASE.slice().sort(() => Math.random() - 0.5).slice(0, 6);

    options.forEach((sp) => {
      const card = document.createElement('div');
      card.className = 'p-3 rounded-2xl bg-gray-900/90 border border-gray-700 hover:border-emerald-500 cursor-pointer flex flex-col items-center text-center transition-all hover:scale-105';
      card.innerHTML = `
        <div class="w-14 h-14 rounded-full flex items-center justify-center text-3xl shadow-inner mb-2" style="background-color: ${sp.eggColor}33; border: 2px dashed ${sp.eggColor}">
          🥚
        </div>
        <h5 class="text-xs font-bold text-white">${sp.name}</h5>
        <span class="text-[10px] text-emerald-400">${sp.class}</span>
        <span class="text-[9px] text-gray-400 mt-1">${sp.biomeName}</span>
      `;

      card.addEventListener('click', () => {
        const petName = prompt(`Qual será o nome do seu novo filhote de ${sp.name}?`, sp.name) || sp.name;
        this.app.startNewPet(sp.id, petName);
        if (!this.data.discoveredSpecies.includes(sp.id)) {
          this.data.discoveredSpecies.push(sp.id);
          this.saveData();
        }
        this.closeAdoptModal();
        this.app.showToast(`🥚 Você adotou um ovo de ${sp.name}! Aqueça-o com carinho.`, 'success');
        soundFx.playHatch();
      });

      this.dom.eggOptionsGrid.appendChild(card);
    });
  }
}
