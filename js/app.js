/**
 * PetMaster - Controlador Central da SPA e Game Loop
 * Orquestra máquina de estados, renderização a 60fps com delta-time e persistência.
 */

import { Pet, PET_STATES, GROWTH_STAGES } from './pet.js';
import { FOOD_ITEMS, CARE_ITEMS, getSpeciesById } from './speciesData.js';
import { db } from './firebaseConfig.js';
import { soundFx } from './audio.js';
import { AuthManager } from './authManager.js';
import { OfflineManager } from './offlineManager.js';
import { ThemeManager } from './themeManager.js';
import { MinigameManager } from './minigames.js';
import { SanctuaryManager } from './sanctuaryManager.js';
import { ShareManager } from './shareManager.js';
import { Pet3DEngine } from './pet3D.js';
import { NotificationManager } from './notificationManager.js';

class PetMasterApp {
  constructor() {
    this.db = db;
    this.pet = null;
    this.pet3D = null;
    this.coins = 100;
    this.inventory = { berry: 5, leaf: 5, insect: 3, soap: 3 };

    // Timestamp para cálculo preciso de delta-time
    this.lastFrameTime = performance.now();
    this.autoSaveTimer = 0;
    this.notificationTimer = 0;
    this.weatherTimer = 0;
    this.hasInitialWeather = false;

    // Cache de referências DOM para máxima eficiência
    this.dom = {};
  }

  async init() {
    console.log('🚀 Inicializando PetMaster...');
    await this.db.init();

    this.cacheDOM();
    this.loadGame();

    // Inicializa Módulos Especializados
    this.auth = new AuthManager(this);
    this.offline = new OfflineManager(this);
    this.theme = new ThemeManager(this);
    this.minigames = new MinigameManager(this);
    this.sanctuary = new SanctuaryManager(this);
    this.share = new ShareManager(this);
    this.notifications = new NotificationManager(this);

    // Inicializa Motor 3D Procedural (WebGL Three.js)
    if (this.dom.pet3DViewport && typeof THREE !== 'undefined') {
      try {
        this.pet3D = new Pet3DEngine(this.dom.pet3DViewport, this);
        this.pet3D.buildPet(this.pet);
      } catch (err) {
        console.warn('Falha ao inicializar WebGL 3D; fallback ativado:', err);
        if (this.dom.petAvatarContainer) this.dom.petAvatarContainer.classList.remove('hidden');
      }
    } else {
      if (this.dom.petAvatarContainer) this.dom.petAvatarContainer.classList.remove('hidden');
    }

    this.bindGlobalEvents();
    this.renderStore();
    this.renderInventory();

    // Processa decaimento offline decorrido
    const offlineDecay = this.pet.applyOfflineDecay();
    if (offlineDecay && offlineDecay.hoursAway > 0.1) {
      this.showToast(`⏰ Você esteve fora por ${offlineDecay.hoursAway}h. Seu pet sentiu sua falta!`, 'info');
    }

    // Inicia Game Loop
    this.startGameLoop();

    // Verifica link compartilhado
    this.share.checkIncomingShare();

    // Inicializa ícones Lucide
    if (window.lucide) {
      window.lucide.createIcons();
    }
  }

  cacheDOM() {
    this.dom = {
      // Indicadores Topo
      coinsDisplay: document.getElementById('user-coins-display'),
      petNameDisplay: document.getElementById('pet-name-display'),
      petSpeciesDisplay: document.getElementById('pet-species-display'),
      petStageBadge: document.getElementById('pet-stage-badge'),
      petLevelDisplay: document.getElementById('pet-level-display'),
      xpProgressBar: document.getElementById('xp-progress-bar'),
      xpProgressText: document.getElementById('xp-progress-text'),

      // Barras Vitais
      barHunger: document.getElementById('bar-hunger'),
      valHunger: document.getElementById('val-hunger'),
      barHygiene: document.getElementById('bar-hygiene'),
      valHygiene: document.getElementById('val-hygiene'),
      barEnergy: document.getElementById('bar-energy'),
      valEnergy: document.getElementById('val-energy'),
      barHappiness: document.getElementById('bar-happiness'),
      valHappiness: document.getElementById('val-happiness'),
      barHealth: document.getElementById('bar-health'),
      valHealth: document.getElementById('val-health'),

      // Habitat e Pet
      habitatRoom: document.getElementById('habitat-room'),
      pet3DViewport: document.getElementById('pet-3d-viewport'),
      petAvatarContainer: document.getElementById('pet-avatar-container'),
      petAvatar: document.getElementById('pet-avatar'),
      petSpeechBubble: document.getElementById('pet-speech-bubble'),
      petStatusEmoji: document.getElementById('pet-status-emoji'),
      floatingEffectsContainer: document.getElementById('floating-effects-container'),
      nightOverlay: document.getElementById('night-overlay'),

      // Dock de Ações
      dockFeedBtn: document.getElementById('dock-feed-btn'),
      dockCleanBtn: document.getElementById('dock-clean-btn'),
      dockSleepBtn: document.getElementById('dock-sleep-btn'),
      dockPlayBtn: document.getElementById('dock-play-btn'),
      dockHealBtn: document.getElementById('dock-heal-btn'),

      // Modais e Gavetas
      foodModal: document.getElementById('food-modal'),
      closeFoodModalBtn: document.getElementById('close-food-modal-btn'),
      foodOptionsGrid: document.getElementById('food-options-grid'),

      storeModal: document.getElementById('store-modal'),
      openStoreBtn: document.getElementById('open-store-btn'),
      closeStoreModalBtn: document.getElementById('close-store-modal-btn'),
      storeItemsGrid: document.getElementById('store-items-grid'),

      settingsModal: document.getElementById('settings-modal'),
      openSettingsBtn: document.getElementById('open-settings-btn'),
      closeSettingsModalBtn: document.getElementById('close-settings-modal-btn'),
      muteToggleBtn: document.getElementById('mute-toggle-btn'),
      muteIcon: document.getElementById('mute-icon'),
      saveFirebaseConfigBtn: document.getElementById('save-firebase-config-btn'),
      firebaseApiKeyInput: document.getElementById('firebase-api-key-input'),
      firebaseProjectIdInput: document.getElementById('firebase-project-id-input'),
      resetGameBtn: document.getElementById('reset-game-btn'),

      openSanctuaryBtn: document.getElementById('open-sanctuary-btn'),
      openShareBtn: document.getElementById('open-share-btn'),
      toastContainer: document.getElementById('toast-container'),

      // Mobile Drawer (QuizMaster Standard)
      mobileMenuToggleBtn: document.getElementById('mobile-menu-toggle-btn'),
      closeMobileDrawerBtn: document.getElementById('close-mobile-drawer-btn'),
      mobileDrawerContainer: document.getElementById('mobile-drawer-container'),
      mobileDrawerBackdrop: document.getElementById('mobile-drawer-backdrop'),
      mobileDrawerPanel: document.getElementById('mobile-drawer-panel'),
      drawerBrandLogo: document.getElementById('drawer-brand-logo'),
      drawerSanctuaryBtn: document.getElementById('drawer-sanctuary-btn'),
      drawerStoreBtn: document.getElementById('drawer-store-btn'),
      drawerGamesBtn: document.getElementById('drawer-games-btn'),
      drawerAdoptBtn: document.getElementById('drawer-adopt-btn'),
      drawerShareBtn: document.getElementById('drawer-share-btn'),
      drawerSettingsBtn: document.getElementById('drawer-settings-btn'),
      drawerAuthBtn: document.getElementById('drawer-auth-btn'),
      drawerSoundBtn: document.getElementById('drawer-sound-btn'),
      soundToggleBtn: document.getElementById('sound-toggle-btn'),
      headerSoundIcon: document.getElementById('header-sound-icon'),
      drawerThemeBtn: document.getElementById('drawer-theme-btn'),
      drawerThemeName: document.getElementById('drawer-theme-name'),
      drawerInstallBtn: document.getElementById('drawer-install-btn'),
      drawerNotifBtn: document.getElementById('drawer-notif-btn'),
      drawerNotifStatus: document.getElementById('drawer-notif-status'),
      settingsNotifBtn: document.getElementById('settings-notif-btn'),
      settingsNotifStatus: document.getElementById('settings-notif-status'),

      // Renomeação do Pet
      renamePetBtn: document.getElementById('rename-pet-btn'),
      renamePetModal: document.getElementById('rename-pet-modal'),
      closeRenameModalBtn: document.getElementById('close-rename-modal-btn'),
      petRenameInput: document.getElementById('pet-rename-input'),
      cancelRenameBtn: document.getElementById('cancel-rename-btn'),
      saveRenameBtn: document.getElementById('save-rename-btn'),

      // Período do Dia e Clima
      weatherPeriodBadge: document.getElementById('weather-period-badge'),
      weatherIcon: document.getElementById('weather-icon'),
      weatherText: document.getElementById('weather-text'),
      weatherTime: document.getElementById('weather-time'),
      habitatBiomeBadge: document.getElementById('habitat-biome-badge'),
      habitatBiomeIcon: document.getElementById('habitat-biome-icon'),
      habitatBiomeName: document.getElementById('habitat-biome-name')
    };
  }

  loadGame() {
    this.coins = this.db.loadCoins();
    this.inventory = this.db.loadInventory();

    const savedPetData = this.db.loadPet();
    if (savedPetData) {
      this.pet = Pet.deserialize(savedPetData);
    } else {
      // Cria primeiro animal (Ovo de Capivara)
      this.pet = new Pet({
        name: 'Pipoca',
        speciesId: 'capybara',
        stage: GROWTH_STAGES.EGG
      });
      this.saveGame();
    }

    this.updateCoinsUI();
  }

  saveGame() {
    if (this.pet) {
      this.db.savePet(this.pet.serialize());
    }
    this.db.saveCoins(this.coins);
    this.db.saveInventory(this.inventory);
  }

  startNewPet(speciesId, name) {
    this.pet = new Pet({
      name: name || 'Filhote',
      speciesId: speciesId,
      stage: GROWTH_STAGES.EGG
    });
    this.saveGame();
    this.updateStaticPetInfo();
    if (this.pet3D) this.pet3D.buildPet(this.pet);
  }

  loadFromBackup(data) {
    if (data.coins !== undefined) this.coins = data.coins;
    if (data.inventory) this.inventory = data.inventory;
    if (data.currentPet) this.pet = Pet.deserialize(data.currentPet);
    if (data.sanctuary && this.sanctuary) {
      this.sanctuary.data = data.sanctuary;
      this.sanctuary.saveData();
      this.sanctuary.updateStats();
    }
    this.saveGame();
    this.updateCoinsUI();
    this.updateStaticPetInfo();
    if (this.pet3D) this.pet3D.buildPet(this.pet);
  }

  addCoins(amount) {
    this.coins += amount;
    this.updateCoinsUI();
    this.saveGame();
  }

  spendCoins(amount) {
    if (this.coins >= amount) {
      this.coins -= amount;
      this.updateCoinsUI();
      this.saveGame();
      return true;
    }
    return false;
  }

  updateCoinsUI() {
    if (this.dom.coinsDisplay) {
      this.dom.coinsDisplay.textContent = this.coins;
    }
  }

  // ==========================================
  // GAME LOOP A 60 FPS COM DELTA-TIME
  // ==========================================
  startGameLoop() {
    this.updateStaticPetInfo();

    const loop = (currentTime) => {
      const deltaTime = (currentTime - this.lastFrameTime) / 1000;
      this.lastFrameTime = currentTime;

      // Protege contra saltos gigantes de delta em abas inativas
      const clampedDelta = Math.min(deltaTime, 0.5);

      if (this.pet) {
        this.pet.update(clampedDelta);
        this.renderPetHUD();
        this.renderPetAvatar();
        if (this.pet3D) {
          this.pet3D.update(clampedDelta);
        }
      }

      // Auto-save a cada 10 segundos
      this.autoSaveTimer += clampedDelta;
      if (this.autoSaveTimer >= 10) {
        this.autoSaveTimer = 0;
        this.saveGame();
      }

      // Verificação de Alertas e Notificações no Celular/Desktop a cada 5 segundos
      this.notificationTimer += clampedDelta;
      if (this.notificationTimer >= 5) {
        this.notificationTimer = 0;
        if (this.notifications && this.pet) {
          this.notifications.checkPetReactions(this.pet);
        }
      }

      // Atualização de Clima & Período do Dia a cada 10 segundos
      this.weatherTimer += clampedDelta;
      if (this.weatherTimer >= 10 || !this.hasInitialWeather) {
        this.weatherTimer = 0;
        this.hasInitialWeather = true;
        this.updateTimeAndWeatherCycle();
      }

      requestAnimationFrame(loop);
    };

    requestAnimationFrame(loop);
  }

  updateStaticPetInfo() {
    if (!this.pet) return;
    const sp = this.pet.species;

    if (this.dom.petNameDisplay) {
      this.dom.petNameDisplay.textContent = this.pet.name;
    }
    if (this.dom.petSpeciesDisplay) {
      this.dom.petSpeciesDisplay.textContent = `${sp.emoji} ${sp.name} (${sp.scientificName})`;
    }
    if (this.dom.habitatBiomeName && sp.biomeName) {
      this.dom.habitatBiomeName.textContent = sp.biomeName;
    }
  }

  // ==========================================
  // CICLO HORÁRIO & CLIMA DINÂMICO
  // ==========================================
  updateTimeAndWeatherCycle() {
    const now = new Date();
    const hour = now.getHours();
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const timeStr = `${String(hour).padStart(2, '0')}:${minutes}`;

    let period = 'day';
    let icon = '☀️';
    let text = 'Dia • Céu Limpo';
    let bgGradient = '';

    if (hour >= 0 && hour < 6) {
      period = 'midnight';
      icon = '🌌';
      text = 'Madrugada • Céu Estrelado';
      bgGradient = 'radial-gradient(ellipse at top, #020617 0%, #090d16 60%, #04130d 100%)';
    } else if (hour >= 6 && hour < 9) {
      period = 'dawn';
      icon = '🌅';
      text = 'Alvorecer • Sol Nascente';
      bgGradient = 'radial-gradient(ellipse at top, #2e1065 0%, #701a75 50%, #062016 100%)';
    } else if (hour >= 9 && hour < 17) {
      period = 'day';
      icon = '☀️';
      text = 'Dia Pleno • Céu Claro';
      bgGradient = 'radial-gradient(ellipse at top, #064e3b 0%, #062016 70%, #021a10 100%)';
    } else if (hour >= 17 && hour < 19) {
      period = 'sunset';
      icon = '🌇';
      text = 'Entardecer • Pôr do Sol';
      bgGradient = 'radial-gradient(ellipse at top, #7c2d12 0%, #831843 50%, #062016 100%)';
    } else {
      period = 'night';
      icon = '🌙';
      text = 'Noite • Brisa Serena';
      bgGradient = 'radial-gradient(ellipse at top, #0f172a 0%, #1e1b4b 60%, #062016 100%)';
    }

    if (this.dom.weatherIcon) this.dom.weatherIcon.textContent = icon;
    if (this.dom.weatherText) this.dom.weatherText.textContent = text;
    if (this.dom.weatherTime) this.dom.weatherTime.textContent = timeStr;

    if (this.dom.habitatRoom && bgGradient) {
      this.dom.habitatRoom.style.background = bgGradient;
    }

    if (this.dom.habitatBiomeName && this.pet && this.pet.species) {
      this.dom.habitatBiomeName.textContent = this.pet.species.biomeName || 'Santuário Natural';
    }

    if (this.pet3D) {
      this.pet3D.updateTimeAndWeather(period, 'clear');
    }
  }

  // ==========================================
  // MODAL DE RENOMEAÇÃO DO ANIMAL
  // ==========================================
  openRenameModal() {
    if (!this.dom.renamePetModal) return;
    if (this.dom.petRenameInput && this.pet) {
      this.dom.petRenameInput.value = this.pet.name || '';
    }
    this.dom.renamePetModal.classList.remove('hidden');
    document.body.classList.add('overflow-hidden');
    if (this.dom.petRenameInput) this.dom.petRenameInput.focus();
    soundFx.playClick();
  }

  closeRenameModal() {
    if (!this.dom.renamePetModal) return;
    this.dom.renamePetModal.classList.add('hidden');
    document.body.classList.remove('overflow-hidden');
    soundFx.playClick();
  }

  savePetName() {
    if (!this.dom.petRenameInput || !this.pet) return;
    const newName = this.dom.petRenameInput.value.trim();
    if (!newName) {
      this.showToast('Por favor, digite um nome válido.', 'warning');
      return;
    }

    this.pet.name = newName;
    this.saveGame();
    this.updateStaticPetInfo();
    this.closeRenameModal();
    soundFx.playLevelUp();
    this.showToast(`🐾 Nome atualizado para "${newName}"!`, 'success');

    if (this.pet3D) {
      this.pet3D.playGesture('happy');
    }
  }

  renderPetHUD() {
    const p = this.pet;
    if (!p) return;

    // Estágio e Nível
    if (this.dom.petStageBadge) {
      const stageMap = { egg: '🥚 Ovo', baby: '🐹 Filhote', teen: '🦫 Jovem', adult: '🐾 Adulto' };
      this.dom.petStageBadge.textContent = stageMap[p.stage] || p.stage;
    }
    if (this.dom.petLevelDisplay) {
      this.dom.petLevelDisplay.textContent = `Nv. ${p.level}`;
    }

    // Barra de XP (calcula progresso dentro do nível de 100 em 100)
    const currentLevelXP = p.xp % 100;
    if (this.dom.xpProgressBar) {
      this.dom.xpProgressBar.style.width = `${currentLevelXP}%`;
    }
    if (this.dom.xpProgressText) {
      this.dom.xpProgressText.textContent = `${p.xp} XP`;
    }

    // Atributos Vitais
    this.updateVitalBar(this.dom.barHunger, this.dom.valHunger, p.hunger, '#f97316');
    this.updateVitalBar(this.dom.barHygiene, this.dom.valHygiene, p.hygiene, '#06b6d4');
    this.updateVitalBar(this.dom.barEnergy, this.dom.valEnergy, p.energy, '#eab308');
    this.updateVitalBar(this.dom.barHappiness, this.dom.valHappiness, p.happiness, '#ec4899');
    this.updateVitalBar(this.dom.barHealth, this.dom.valHealth, p.health, '#10b981');
  }

  updateVitalBar(barEl, valEl, value, color) {
    if (barEl) {
      barEl.style.width = `${Math.max(0, Math.min(100, value))}%`;
      // Alerta visual de perigo se abaixo de 20%
      if (value < 20) {
        barEl.style.backgroundColor = '#ef4444';
      } else {
        barEl.style.backgroundColor = color;
      }
    }
    if (valEl) {
      valEl.textContent = `${Math.round(value)}%`;
    }
  }

  // Renderiza visual e animações de acordo com a máquina de estados
  renderPetAvatar() {
    const p = this.pet;
    if (!p || !this.dom.petAvatar) return;

    const sp = p.species;

    // Visual especial de OVO
    if (p.stage === GROWTH_STAGES.EGG) {
      this.dom.petAvatar.textContent = '🥚';
      this.dom.petAvatar.className = 'text-7xl sm:text-8xl select-none cursor-pointer transition-transform filter drop-shadow-2xl animate-egg-wiggle';
      this.dom.petAvatar.style.filter = `drop-shadow(0 10px 20px ${sp.eggColor}66)`;
      if (this.dom.petSpeechBubble) {
        this.dom.petSpeechBubble.textContent = `Aqueça o ninho! (${p.hatchClicks}/${p.hatchClicksRequired})`;
      }
      return;
    }

    // Ícone correspondente ao estágio biológico
    const stageIcons = sp.stageIcons || { baby: sp.emoji, teen: sp.emoji, adult: sp.emoji };
    const currentIcon = stageIcons[p.stage] || sp.emoji;
    this.dom.petAvatar.textContent = currentIcon;

    // Máquina de Animações CSS
    let animClass = 'animate-pet-idle';
    let bubbleText = 'Estou bem!';

    switch (p.state) {
      case PET_STATES.EATING:
        animClass = 'animate-pet-eating';
        bubbleText = 'Nham nham! 😋';
        break;
      case PET_STATES.BATHING:
        animClass = 'animate-pet-bathing';
        bubbleText = 'Banho refrescante! 🫧';
        break;
      case PET_STATES.SLEEPING:
        animClass = 'animate-pet-sleeping opacity-80';
        bubbleText = 'Zzz... 💤';
        break;
      case PET_STATES.PLAYING:
        animClass = 'animate-pet-jump';
        bubbleText = 'Isso é divertido! 🎾';
        break;
      case PET_STATES.SICK:
        animClass = 'animate-pet-sick opacity-75';
        bubbleText = 'Não me sinto bem... 🤒';
        break;
      case PET_STATES.CRITICAL:
        animClass = 'animate-pet-sick opacity-60';
        bubbleText = 'Preciso de remédio urgente! 🚨';
        break;
      default:
        if (p.hunger < 25) bubbleText = 'Estou com fome! 🍎';
        else if (p.hygiene < 25) bubbleText = 'Preciso de banho! 🧼';
        else if (p.energy < 25) bubbleText = 'Estou com sono... 🥱';
        else if (p.happiness < 25) bubbleText = 'Vamos brincar? 🥺';
        break;
    }

    this.dom.petAvatar.className = `text-7xl sm:text-8xl select-none cursor-pointer transition-all filter drop-shadow-2xl ${animClass}`;

    if (this.dom.petSpeechBubble) {
      this.dom.petSpeechBubble.textContent = bubbleText;
    }

    // Efeito de escuridão durante o sono
    if (this.dom.nightOverlay) {
      if (p.state === PET_STATES.SLEEPING) {
        this.dom.nightOverlay.classList.remove('hidden');
      } else {
        this.dom.nightOverlay.classList.add('hidden');
      }
    }
  }

  // ==========================================
  // DISPATCHER DE AÇÕES DO DOCK
  // ==========================================
  bindGlobalEvents() {
    // Interação de Carinho / Toque direto no Pet
    if (this.dom.petAvatar) {
      this.dom.petAvatar.addEventListener('click', () => {
        if (this.pet3D) this.pet3D.triggerAffectionGesture();
        if (this.pet.stage === GROWTH_STAGES.EGG) {
          const hatched = this.pet.warmEgg();
          if (hatched) {
            soundFx.playHatch();
            this.showToast('🎉 O ovo chocou! Bem-vindo(a) ao mundo, filhotinho!', 'success');
            if (window.confetti) window.confetti({ particleCount: 80, spread: 70 });
          } else {
            soundFx.playClick();
            this.spawnFloatingEffect('✨');
          }
        } else {
          // Carinho: dá pequena dose de felicidade
          this.pet.happiness = Math.min(100, this.pet.happiness + 3);
          soundFx.playHappy();
          this.spawnFloatingEffect('❤️');
        }
      });
    }

    // Renomeação do Pet
    if (this.dom.renamePetBtn) this.dom.renamePetBtn.addEventListener('click', () => this.openRenameModal());
    if (this.dom.closeRenameModalBtn) this.dom.closeRenameModalBtn.addEventListener('click', () => this.closeRenameModal());
    if (this.dom.cancelRenameBtn) this.dom.cancelRenameBtn.addEventListener('click', () => this.closeRenameModal());
    if (this.dom.saveRenameBtn) this.dom.saveRenameBtn.addEventListener('click', () => this.savePetName());
    if (this.dom.petRenameInput) {
      this.dom.petRenameInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') this.savePetName();
      });
    }

    // Dock: Alimentar
    if (this.dom.dockFeedBtn) {
      this.dom.dockFeedBtn.addEventListener('click', () => this.openFoodModal());
    }

    // Dock: Banho
    if (this.dom.dockCleanBtn) {
      this.dom.dockCleanBtn.addEventListener('click', () => {
        if (this.inventory.soap > 0) {
          const res = this.pet.clean();
          if (res.success) {
            this.inventory.soap--;
            this.saveGame();
            soundFx.playBath();
            if (this.pet3D) this.pet3D.playGesture('bathing');
            this.spawnFloatingEffect('🫧');
            this.showToast('🧼 Banho tomado! O pet está perfumado e limpo.', 'success');
            if (res.evolved) this.handleEvolution(res.evolved);
          } else {
            this.showToast(res.reason, 'info');
          }
        } else {
          this.showToast('Você não tem sabão! Visite o Mercado Ecológico para comprar.', 'warning');
          this.openStoreModal();
        }
      });
    }

    // Dock: Dormir / Acordar
    if (this.dom.dockSleepBtn) {
      this.dom.dockSleepBtn.addEventListener('click', () => {
        const res = this.pet.toggleSleep();
        if (res.success) {
          if (res.sleeping) {
            soundFx.playSleep();
            if (this.pet3D) this.pet3D.playGesture('sleeping');
            this.showToast('💤 Shhh... O pet foi dormir e está recuperando energia.', 'info');
          } else {
            soundFx.playClick();
            if (this.pet3D) this.pet3D.playGesture('happy');
            this.showToast('☀️ Bom dia! O animalzinho acordou com as energias renovadas.', 'success');
          }
        } else {
          this.showToast(res.reason, 'info');
        }
      });
    }

    // Dock: Minigames
    if (this.dom.dockPlayBtn) {
      this.dom.dockPlayBtn.addEventListener('click', () => {
        if (this.minigames) this.minigames.openModal();
      });
    }

    // Dock: Remédio
    if (this.dom.dockHealBtn) {
      this.dom.dockHealBtn.addEventListener('click', () => {
        if (this.pet.health >= 100 && this.pet.state !== PET_STATES.SICK) {
          this.showToast('O pet já está perfeitamente saudável!', 'info');
          return;
        }

        if (this.inventory.health_potion > 0) {
          this.inventory.health_potion--;
          this.pet.heal();
          this.saveGame();
          soundFx.playHeal();
          this.spawnFloatingEffect('💚');
          this.showToast('🧪 Remédio administrado! A saúde do pet foi totalmente restaurada.', 'success');
        } else {
          const buy = confirm('Você não tem Elixir de Ervas no inventário. Deseja comprar um no Mercado por 50 moedas?');
          if (buy) {
            if (this.spendCoins(50)) {
              this.pet.heal();
              this.saveGame();
              soundFx.playHeal();
              this.showToast('🧪 Curado com sucesso com elixir adquirido!', 'success');
            } else {
              this.showToast('Moedas insuficientes! Jogue minigames para ganhar moedas.', 'warning');
            }
          }
        }
      });
    }

    // Modais e Navegação
    if (this.dom.openStoreBtn) this.dom.openStoreBtn.addEventListener('click', () => this.openStoreModal());
    if (this.dom.closeStoreModalBtn) this.dom.closeStoreModalBtn.addEventListener('click', () => this.closeStoreModal());

    if (this.dom.closeFoodModalBtn) this.dom.closeFoodModalBtn.addEventListener('click', () => this.closeFoodModal());

    if (this.dom.openSanctuaryBtn) {
      this.dom.openSanctuaryBtn.addEventListener('click', () => {
        if (this.sanctuary) this.sanctuary.openSanctuaryModal();
      });
    }

    if (this.dom.openShareBtn) {
      this.dom.openShareBtn.addEventListener('click', () => {
        if (this.share) this.share.openShareModal(this.pet);
      });
    }

    if (this.dom.openSettingsBtn) this.dom.openSettingsBtn.addEventListener('click', () => this.openSettingsModal());
    if (this.dom.closeSettingsModalBtn) this.dom.closeSettingsModalBtn.addEventListener('click', () => this.closeSettingsModal());

    // Configurações: Mudo
    if (this.dom.muteToggleBtn) {
      this.dom.muteToggleBtn.addEventListener('click', () => {
        const isMuted = soundFx.toggleMute();
        this.dom.muteIcon.textContent = isMuted ? '🔇' : '🔊';
        this.showToast(isMuted ? 'Áudio silenciado.' : 'Áudio reativado.', 'info');
      });
    }

    // Configurações: Salvar Firebase
    if (this.dom.saveFirebaseConfigBtn) {
      this.dom.saveFirebaseConfigBtn.addEventListener('click', () => {
        const apiKey = this.dom.firebaseApiKeyInput.value.trim();
        const projectId = this.dom.firebaseProjectIdInput.value.trim();
        if (apiKey && projectId) {
          db.saveConfig({ apiKey, projectId });
          alert('Configuração do Firebase salva! Recarregue a página para ativar a nuvem.');
        } else {
          db.saveConfig(null);
          alert('Configuração do Firebase removida. Operando em Modo Local (LocalStorage).');
        }
      });
    }

    // Configurações: Reset
    if (this.dom.resetGameBtn) {
      this.dom.resetGameBtn.addEventListener('click', () => {
        const confirmReset = confirm('⚠️ Tem certeza que deseja reiniciar todo o jogo? Isso apagará seu pet e santuário atuais.');
        if (confirmReset) {
          localStorage.clear();
          window.location.reload();
        }
      });
    }

    // ==========================================
    // CONTROLES DO PAINEL LATERAL (MOBILE DRAWER)
    // ==========================================
    if (this.dom.mobileMenuToggleBtn) {
      this.dom.mobileMenuToggleBtn.addEventListener('click', () => {
        soundFx.playClick();
        this.openMobileDrawer();
      });
    }

    if (this.dom.closeMobileDrawerBtn) {
      this.dom.closeMobileDrawerBtn.addEventListener('click', () => {
        soundFx.playClick();
        this.closeMobileDrawer();
      });
    }

    if (this.dom.mobileDrawerBackdrop) {
      this.dom.mobileDrawerBackdrop.addEventListener('click', () => this.closeMobileDrawer());
    }

    if (this.dom.drawerBrandLogo) {
      this.dom.drawerBrandLogo.addEventListener('click', () => {
        soundFx.playClick();
        this.closeMobileDrawer();
      });
    }

    if (this.dom.drawerSanctuaryBtn) {
      this.dom.drawerSanctuaryBtn.addEventListener('click', () => {
        soundFx.playClick();
        this.closeMobileDrawer();
        if (this.sanctuary) this.sanctuary.openSanctuaryModal();
      });
    }

    if (this.dom.drawerStoreBtn) {
      this.dom.drawerStoreBtn.addEventListener('click', () => {
        soundFx.playClick();
        this.closeMobileDrawer();
        this.openStoreModal();
      });
    }

    if (this.dom.drawerGamesBtn) {
      this.dom.drawerGamesBtn.addEventListener('click', () => {
        soundFx.playClick();
        this.closeMobileDrawer();
        if (this.minigames) this.minigames.openModal();
      });
    }

    if (this.dom.drawerAdoptBtn) {
      this.dom.drawerAdoptBtn.addEventListener('click', () => {
        soundFx.playClick();
        this.closeMobileDrawer();
        if (this.sanctuary) this.sanctuary.openAdoptModal();
      });
    }

    if (this.dom.drawerShareBtn) {
      this.dom.drawerShareBtn.addEventListener('click', () => {
        soundFx.playClick();
        this.closeMobileDrawer();
        if (this.share) this.share.openShareModal(this.pet);
      });
    }

    if (this.dom.drawerSettingsBtn) {
      this.dom.drawerSettingsBtn.addEventListener('click', () => {
        soundFx.playClick();
        this.closeMobileDrawer();
        this.openSettingsModal();
      });
    }

    if (this.dom.drawerAuthBtn) {
      this.dom.drawerAuthBtn.addEventListener('click', () => {
        soundFx.playClick();
        this.closeMobileDrawer();
        if (this.auth) this.auth.openAuthModal();
      });
    }

    if (this.dom.drawerThemeBtn) {
      this.dom.drawerThemeBtn.addEventListener('click', () => {
        soundFx.playClick();
        this.closeMobileDrawer();
        if (this.theme) this.theme.openThemeModal();
      });
    }

    if (this.dom.drawerSoundBtn) {
      this.dom.drawerSoundBtn.addEventListener('click', () => this.toggleSound());
    }

    if (this.dom.soundToggleBtn) {
      this.dom.soundToggleBtn.addEventListener('click', () => this.toggleSound());
    }
  }

  openMobileDrawer() {
    if (this.dom.mobileDrawerContainer) this.dom.mobileDrawerContainer.classList.remove('pointer-events-none');
    if (this.dom.mobileDrawerBackdrop) this.dom.mobileDrawerBackdrop.classList.add('active');
    if (this.dom.mobileDrawerPanel) this.dom.mobileDrawerPanel.classList.add('active');
    document.body.classList.add('overflow-hidden');
    if (window.lucide) window.lucide.createIcons();
  }

  closeMobileDrawer() {
    if (this.dom.mobileDrawerBackdrop) this.dom.mobileDrawerBackdrop.classList.remove('active');
    if (this.dom.mobileDrawerPanel) this.dom.mobileDrawerPanel.classList.remove('active');
    if (this.dom.mobileDrawerContainer) this.dom.mobileDrawerContainer.classList.add('pointer-events-none');
    document.body.classList.remove('overflow-hidden');
  }

  toggleSound() {
    const isMuted = soundFx.toggleMute();
    this.updateAudioUI(isMuted);
    this.showToast(isMuted ? 'Áudio silenciado.' : 'Áudio reativado.', 'info');
  }

  updateAudioUI(isMuted) {
    if (this.dom.drawerSoundBtn) {
      this.dom.drawerSoundBtn.textContent = isMuted ? 'Mudo' : 'Ligado';
      this.dom.drawerSoundBtn.className = isMuted
        ? 'px-2.5 py-1 rounded-lg bg-gray-800 text-gray-400 text-xs font-bold hover:bg-gray-700 transition-colors'
        : 'px-2.5 py-1 rounded-lg bg-emerald-600/30 text-emerald-300 text-xs font-bold hover:bg-emerald-600 hover:text-white transition-colors';
    }
    if (this.dom.headerSoundIcon) {
      this.dom.headerSoundIcon.setAttribute('data-lucide', isMuted ? 'volume-x' : 'volume-2');
      if (window.lucide) window.lucide.createIcons();
    }
    if (this.dom.muteIcon) {
      this.dom.muteIcon.textContent = isMuted ? '🔇' : '🔊';
    }
  }

  // ==========================================
  // MODAL DE ALIMENTAÇÃO
  // ==========================================
  openFoodModal() {
    if (!this.dom.foodModal) return;
    this.renderFoodOptions();
    this.dom.foodModal.classList.remove('hidden');
    document.body.classList.add('overflow-hidden');
    soundFx.playClick();
  }

  closeFoodModal() {
    if (!this.dom.foodModal) return;
    this.dom.foodModal.classList.add('hidden');
    document.body.classList.remove('overflow-hidden');
  }

  renderFoodOptions() {
    if (!this.dom.foodOptionsGrid) return;
    this.dom.foodOptionsGrid.innerHTML = '';

    FOOD_ITEMS.forEach((food) => {
      const count = this.inventory[food.id] || 0;
      const isFav = this.pet && this.pet.species.favoriteFood === food.name;

      const card = document.createElement('div');
      card.className = `p-3 rounded-2xl border flex items-center justify-between transition-all ${
        count > 0 ? 'bg-gray-900/80 border-gray-700 hover:border-emerald-500 cursor-pointer' : 'bg-gray-950/40 border-gray-800 opacity-50'
      }`;

      card.innerHTML = `
        <div class="flex items-center gap-3">
          <span class="text-3xl">${food.icon}</span>
          <div>
            <div class="text-xs font-bold text-white flex items-center gap-1.5">
              ${food.name}
              ${isFav ? '<span class="text-[9px] bg-pink-500/20 text-pink-300 px-1 rounded font-bold">FAVORITO! ❤️</span>' : ''}
            </div>
            <div class="text-[10px] text-gray-400 mt-0.5">
              +${food.hungerVal}% Fome • Em estoque: <strong class="text-emerald-400">${count}</strong>
            </div>
          </div>
        </div>
        <button class="px-3 py-1.5 rounded-xl text-xs font-bold ${
          count > 0 ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-md' : 'bg-gray-800 text-gray-500 cursor-not-allowed'
        }">
          Dar
        </button>
      `;

      if (count > 0) {
        card.addEventListener('click', () => {
          const res = this.pet.feed(food);
          if (res.success) {
            this.inventory[food.id]--;
            this.saveGame();
            soundFx.playFeed();
            if (this.pet3D) this.pet3D.playGesture('eating');
            this.spawnFloatingEffect(food.icon);
            this.showToast(`🍎 ${this.pet.name} comeu ${food.name}! (+${res.hungerGain}% fome, +${res.xpGain} XP)`, 'success');
            this.closeFoodModal();
            if (res.evolved) this.handleEvolution(res.evolved);
          } else {
            this.showToast(res.reason, 'info');
          }
        });
      }

      this.dom.foodOptionsGrid.appendChild(card);
    });
  }

  // ==========================================
  // LOJA / MERCADO ECOLÓGICO
  // ==========================================
  openStoreModal() {
    if (!this.dom.storeModal) return;
    this.renderStore();
    this.dom.storeModal.classList.remove('hidden');
    document.body.classList.add('overflow-hidden');
    soundFx.playClick();
  }

  closeStoreModal() {
    if (!this.dom.storeModal) return;
    this.dom.storeModal.classList.add('hidden');
    document.body.classList.remove('overflow-hidden');
  }

  renderStore() {
    if (!this.dom.storeItemsGrid) return;
    this.dom.storeItemsGrid.innerHTML = '';

    const allStoreItems = [...FOOD_ITEMS, ...CARE_ITEMS];

    allStoreItems.forEach((item) => {
      const card = document.createElement('div');
      card.className = 'p-3 rounded-2xl bg-gray-900/80 border border-gray-800 flex items-center justify-between hover:border-emerald-500/50 transition-all';

      card.innerHTML = `
        <div class="flex items-center gap-3">
          <span class="text-3xl p-2 rounded-xl bg-gray-800/80 border border-gray-700/60">${item.icon}</span>
          <div>
            <h5 class="text-xs font-bold text-white">${item.name}</h5>
            <p class="text-[10px] text-gray-400 mt-0.5">${item.desc}</p>
          </div>
        </div>
        <button class="px-3 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-black text-xs font-extrabold shadow-md flex items-center gap-1">
          <span>🪙</span>
          <span>${item.cost}</span>
        </button>
      `;

      const buyBtn = card.querySelector('button');
      buyBtn.addEventListener('click', () => {
        if (this.spendCoins(item.cost)) {
          this.inventory[item.id] = (this.inventory[item.id] || 0) + 1;
          this.saveGame();
          soundFx.playCoin();
          this.showToast(`🛒 Comprou 1x ${item.name}!`, 'success');
        } else {
          this.showToast('Moedas insuficientes! Jogue os minigames para juntar moedas.', 'warning');
        }
      });

      this.dom.storeItemsGrid.appendChild(card);
    });
  }

  renderInventory() {
    // Mantém inventário sincronizado
  }

  // ==========================================
  // MODAL DE CONFIGURAÇÕES
  // ==========================================
  openSettingsModal() {
    if (!this.dom.settingsModal) return;
    if (this.dom.firebaseApiKeyInput && db.customConfig) {
      this.dom.firebaseApiKeyInput.value = db.customConfig.apiKey || '';
      this.dom.firebaseProjectIdInput.value = db.customConfig.projectId || '';
    }
    this.dom.settingsModal.classList.remove('hidden');
    document.body.classList.add('overflow-hidden');
    soundFx.playClick();
  }

  closeSettingsModal() {
    if (!this.dom.settingsModal) return;
    this.dom.settingsModal.classList.add('hidden');
    document.body.classList.remove('overflow-hidden');
  }

  // Trata evolução biológica
  handleEvolution(evolveData) {
    soundFx.playEvolve();
    if (window.confetti) {
      window.confetti({ particleCount: 150, spread: 100, origin: { y: 0.5 } });
    }

    const stageNames = { baby: 'Filhote', teen: 'Jovem', adult: 'Adulto' };
    const newStageName = stageNames[evolveData.newStage] || evolveData.newStage;

    alert(`✨ EVOLUÇÃO BIOLÓGICA!\n\nSeu animalzinho cresceu e atingiu a fase: ${newStageName.toUpperCase()}!\nNovos cuidados e comportamentos foram desbloqueados.`);
    this.updateStaticPetInfo();
    if (this.pet3D) this.pet3D.buildPet(this.pet);
    this.saveGame();
  }

  // Efeito flutuante na tela (corações, bolhas, moedas subindo)
  spawnFloatingEffect(symbol) {
    if (!this.dom.floatingEffectsContainer) return;
    const el = document.createElement('div');
    el.className = 'absolute text-2xl animate-float-fade select-none pointer-events-none';
    el.textContent = symbol;
    el.style.left = `${40 + Math.random() * 20}%`;
    el.style.top = `${40 + Math.random() * 10}%`;

    this.dom.floatingEffectsContainer.appendChild(el);
    setTimeout(() => el.remove(), 1200);
  }

  // Sistema de Feedback Visual (Toast)
  showToast(message, type = 'info') {
    if (!this.dom.toastContainer) return;

    const toast = document.createElement('div');
    const colorMap = {
      success: 'bg-emerald-950/90 border-emerald-500/80 text-emerald-200',
      warning: 'bg-amber-950/90 border-amber-500/80 text-amber-200',
      info: 'bg-gray-900/90 border-indigo-500/80 text-gray-200',
      error: 'bg-red-950/90 border-red-500/80 text-red-200'
    };

    toast.className = `px-4 py-3 rounded-2xl border shadow-xl backdrop-blur-md text-xs font-semibold flex items-center gap-2 animate-slide-up transition-all ${
      colorMap[type] || colorMap.info
    }`;
    toast.textContent = message;

    this.dom.toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(-10px)';
      setTimeout(() => toast.remove(), 300);
    }, 3200);
  }
}

// Inicialização segura após o carregamento completo do DOM
window.addEventListener('DOMContentLoaded', () => {
  window.PetApp = new PetMasterApp();
  window.PetApp.init();
});
