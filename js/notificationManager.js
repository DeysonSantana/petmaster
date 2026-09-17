/**
 * PetMaster - Gerenciador de Notificações do Sistema e Alertas Reativos
 * Integra a Web Notifications API com Service Worker para envio de alertas nativos no celular e desktop.
 * Inclui sistema anti-spam com cooldown defensivo e vibração tátil (haptic feedback).
 */

import { soundFx } from './audio.js';

const STORAGE_NOTIF_ENABLED = 'PETMASTER_NOTIFS_ENABLED';

export class NotificationManager {
  constructor(app) {
    this.app = app;
    this.isSupported = 'Notification' in window;
    this.isEnabled = this.loadEnabledState();
    this.lastSentTimes = {};
    this.globalLastSent = 0;

    // Cooldown mínimo por tipo de alerta (em milissegundos)
    this.cooldowns = {
      hunger: 6 * 60 * 1000,     // 6 minutos
      hygiene: 6 * 60 * 1000,    // 6 minutos
      energy: 8 * 60 * 1000,     // 8 minutos
      health: 4 * 60 * 1000,     // 4 minutos (mais urgente)
      egg: 5 * 60 * 1000,        // 5 minutos
      release: 10 * 60 * 1000    // 10 minutos
    };

    this.dom = {
      drawerNotifBtn: document.getElementById('drawer-notif-btn'),
      drawerNotifStatus: document.getElementById('drawer-notif-status'),
      settingsNotifBtn: document.getElementById('settings-notif-btn'),
      settingsNotifStatus: document.getElementById('settings-notif-status')
    };

    this.init();
  }

  loadEnabledState() {
    try {
      const saved = localStorage.getItem(STORAGE_NOTIF_ENABLED);
      return saved !== null ? JSON.parse(saved) : true;
    } catch (e) {
      return true;
    }
  }

  saveEnabledState(enabled) {
    try {
      localStorage.setItem(STORAGE_NOTIF_ENABLED, JSON.stringify(enabled));
      this.isEnabled = enabled;
    } catch (e) {}
  }

  init() {
    this.updateUI();
    this.bindEvents();
    this.setupVisibilityListeners();
  }

  bindEvents() {
    if (this.dom.drawerNotifBtn) {
      this.dom.drawerNotifBtn.addEventListener('click', () => this.toggleNotifications());
    }
    if (this.dom.settingsNotifBtn) {
      this.dom.settingsNotifBtn.addEventListener('click', () => this.toggleNotifications());
    }
  }

  async requestPermission() {
    if (!this.isSupported) {
      alert('Seu navegador não suporta a API de Notificações do Sistema.');
      return false;
    }

    try {
      const permission = await Notification.requestPermission();
      this.updateUI();

      if (permission === 'granted') {
        this.saveEnabledState(true);
        this.sendNativeAlert(
          '🔔 Notificações Ativadas!',
          'Você receberá alertas importantes sobre a saúde e necessidades do seu pet no celular.',
          'welcome',
          true // Forçar envio sem cooldown
        );
        soundFx.playLevelUp();
        return true;
      } else {
        this.saveEnabledState(false);
        this.app.showToast('Notificações bloqueadas nas permissões do navegador.', 'warning');
        return false;
      }
    } catch (err) {
      console.warn('Erro ao solicitar permissão de notificação:', err);
      return false;
    }
  }

  async toggleNotifications() {
    if (!this.isSupported) {
      this.app.showToast('Notificações não são suportadas neste dispositivo.', 'warning');
      return;
    }

    if (Notification.permission !== 'granted') {
      await this.requestPermission();
      return;
    }

    this.saveEnabledState(!this.isEnabled);
    this.updateUI();
    this.app.showToast(
      this.isEnabled ? '🔔 Notificações do animalzinho ativadas!' : '🔕 Notificações desativadas.',
      'info'
    );
    soundFx.playClick();
  }

  updateUI() {
    let statusText = 'Desativado';
    let btnClass = 'px-2.5 py-1 rounded-lg bg-gray-800 text-gray-400 text-xs font-bold hover:bg-gray-700 transition-colors';

    if (!this.isSupported) {
      statusText = 'Indisponível';
    } else if (Notification.permission === 'denied') {
      statusText = 'Bloqueado';
      btnClass = 'px-2.5 py-1 rounded-lg bg-red-950/80 text-red-400 text-xs font-bold transition-colors';
    } else if (Notification.permission === 'granted' && this.isEnabled) {
      statusText = 'Ativado';
      btnClass = 'px-2.5 py-1 rounded-lg bg-emerald-600/30 text-emerald-300 text-xs font-bold hover:bg-emerald-600 hover:text-white transition-colors';
    }

    if (this.dom.drawerNotifStatus) this.dom.drawerNotifStatus.textContent = statusText;
    if (this.dom.drawerNotifBtn) {
      this.dom.drawerNotifBtn.textContent = statusText;
      this.dom.drawerNotifBtn.className = btnClass;
    }

    if (this.dom.settingsNotifStatus) this.dom.settingsNotifStatus.textContent = statusText;
    if (this.dom.settingsNotifBtn) {
      this.dom.settingsNotifBtn.textContent = statusText;
      this.dom.settingsNotifBtn.className = btnClass;
    }
  }

  // Envia notificação nativa via Service Worker ou Notification API
  async sendNativeAlert(title, body, alertType = 'general', force = false) {
    if (!this.isSupported || Notification.permission !== 'granted' || !this.isEnabled) {
      return false;
    }

    const now = Date.now();

    // Verificação de Cooldown por tipo de alerta
    if (!force) {
      const lastSent = this.lastSentTimes[alertType] || 0;
      const cooldown = this.cooldowns[alertType] || 180000;
      if (now - lastSent < cooldown) {
        return false; // Ainda no tempo de espera defensivo
      }
      if (now - this.globalLastSent < 30000) {
        return false; // Evita envio consecutivo em menos de 30s
      }
    }

    this.lastSentTimes[alertType] = now;
    this.globalLastSent = now;

    // Vibração tátil no celular (se suportado)
    if ('vibrate' in navigator) {
      try {
        navigator.vibrate([150, 80, 150]);
      } catch (e) {}
    }

    const options = {
      body: body,
      icon: './assets/icons/icon-192.svg',
      badge: './favicon.svg',
      vibrate: [200, 100, 200],
      tag: `petmaster-alert-${alertType}`,
      renotify: true,
      data: {
        url: './index.html',
        timestamp: now
      }
    };

    // 1. Tenta envio pelo Service Worker (padrão ideal para mobile e PWA em segundo plano)
    if ('serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.ready;
        if (registration && registration.showNotification) {
          await registration.showNotification(title, options);
          return true;
        }
      } catch (err) {
        console.warn('Falha no envio via Service Worker, tentando fallback:', err);
      }
    }

    // 2. Fallback direto da Notification API
    try {
      new Notification(title, options);
      return true;
    } catch (err) {
      console.warn('Erro ao disparar Notification:', err);
      return false;
    }
  }

  // Inspeciona as reações e sinais vitais do animal e dispara alertas pertinentes
  checkPetReactions(pet) {
    if (!pet || !this.isEnabled) return;

    const name = pet.name || 'Seu animalzinho';
    const species = pet.species ? pet.species.name : 'animal';

    // 0. Alerta de Falecimento por Negligência (Prioridade Absoluta)
    if (pet.state === 'deceased' || pet.health <= 0) {
      this.sendNativeAlert(
        `💔 ${name} faleceu por falta de cuidados`,
        `Infelizmente seu animalzinho não resistiu à negligência prolongada. Acesse o Hospital da Fauna para socorrê-lo ou honrar sua memória.`,
        'deceased',
        true
      );
      return;
    }

    // 1. Alerta de Risco Iminente de Morte (< 15% de saúde)
    if (pet.health <= 15) {
      this.sendNativeAlert(
        `⚠️ RISCO DE MORTE: ${name} está sucumbindo!`,
        `A saúde de ${name} está em ${Math.round(pet.health)}%! Sem alimento e tratamento imediato, o animal poderá falecer!`,
        'critical',
        true
      );
      return;
    }

    // 2. Alerta de Saúde Debilitada / Doença
    if (pet.health <= 35 || pet.state === 'sick' || pet.state === 'critical') {
      this.sendNativeAlert(
        `🚨 Alerta Veterinário: ${name} precisa de cuidados!`,
        `${name} está debilitado (Saúde: ${Math.round(pet.health)}%). Use um Elixir de Ervas para curá-lo imediatamente!`,
        'health'
      );
      return;
    }

    // 2. Alerta de Fome Severa (< 20%)
    if (pet.stage !== 'egg' && pet.hunger <= 20) {
      this.sendNativeAlert(
        `🍎 ${name} está faminto!`,
        `O nível de fome caiu para ${Math.round(pet.hunger)}%. Dê ${pet.species ? pet.species.favoriteFood : 'comida'} ao seu ${species}.`,
        'hunger'
      );
      return;
    }

    // 3. Alerta de Higiene Crítica (< 20%)
    if (pet.stage !== 'egg' && pet.hygiene <= 20) {
      this.sendNativeAlert(
        `🧼 Hora do Banho de ${name}!`,
        `${name} está coberto de sujeira (Higiene: ${Math.round(pet.hygiene)}%). Limpe-o com água e sabão ecológico!`,
        'hygiene'
      );
      return;
    }

    // 4. Alerta de Exaustão / Sono (< 15%)
    if (pet.stage !== 'egg' && pet.energy <= 15 && pet.state !== 'sleeping') {
      this.sendNativeAlert(
        `🥱 ${name} está caindo de sono...`,
        `A energia do animal está esgotada (${Math.round(pet.energy)}%). Coloque-o para dormir no ninho para descansar!`,
        'energy'
      );
      return;
    }

    // 5. Alerta de Ovo Prestes a Chocar
    if (pet.stage === 'egg' && pet.hatchClicks >= 3) {
      this.sendNativeAlert(
        `🥚 O ninho está tremendo!`,
        `O ovo de ${species} começou a trincar! Venha dar os últimos toques de carinho para o filhote nascer.`,
        'egg'
      );
      return;
    }

    // 6. Alerta de Reintrodução no Santuário (Adulto Saudável)
    if (pet.canRelease()) {
      this.sendNativeAlert(
        `🌿 ${name} atingiu a idade adulta!`,
        `Parabéns, Guardião! Seu animal está pronto para ser reintroduzido no bioma nativo e viver livre no Santuário!`,
        'release'
      );
    }
  }

  // Monitora mudança de visibilidade da página para alertar ao sair
  setupVisibilityListeners() {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden' && this.app.pet) {
        // Se o usuário minimizou o app e os atributos já estão baixos, agenda checagem
        setTimeout(() => {
          if (this.app.pet) {
            this.checkPetReactions(this.app.pet);
          }
        }, 3000);
      }
    });
  }
}
