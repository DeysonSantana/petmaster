/**
 * PetMaster - Gerenciador de Recursos Offline e PWA
 * Mantém 100% de funcionalidade sem sinal de internet e gerencia instalação do app.
 */

import { soundFx } from './audio.js';

export class OfflineManager {
  constructor(app) {
    this.app = app;
    this.isOnline = navigator.onLine;
    this.deferredInstallPrompt = null;

    this.dom = {
      statusBadge: document.getElementById('network-status-badge'),
      statusDot: document.getElementById('network-status-dot'),
      statusText: document.getElementById('network-status-text'),
      installPwaBtn: document.getElementById('install-pwa-btn')
    };

    this.init();
  }

  init() {
    this.registerServiceWorker();
    this.bindNetworkEvents();
    this.bindInstallPrompt();
    this.updateStatusUI();
  }

  registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
          .then((reg) => {
            console.log('[OfflineManager] PetMaster Service Worker registrado:', reg.scope);
          })
          .catch((err) => {
            console.warn('[OfflineManager] Falha no Service Worker:', err);
          });
      });
    }
  }

  bindNetworkEvents() {
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.updateStatusUI();
      this.app.showToast('🟢 Conexão restabelecida! Sincronização ativada.', 'success');
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
      this.updateStatusUI();
      this.app.showToast('⚡ Modo Offline ativado. O Santuário continua funcionando 100%!', 'warning');
    });
  }

  bindInstallPrompt() {
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this.deferredInstallPrompt = e;
      if (this.dom.installPwaBtn) {
        this.dom.installPwaBtn.classList.remove('hidden');
      }
    });

    if (this.dom.installPwaBtn) {
      this.dom.installPwaBtn.addEventListener('click', async () => {
        if (!this.deferredInstallPrompt) return;
        this.deferredInstallPrompt.prompt();
        const choiceResult = await this.deferredInstallPrompt.userChoice;
        if (choiceResult.outcome === 'accepted') {
          console.log('Usuário aceitou a instalação do PetMaster PWA');
          this.dom.installPwaBtn.classList.add('hidden');
          soundFx.playLevelUp();
        }
        this.deferredInstallPrompt = null;
      });
    }

    window.addEventListener('appinstalled', () => {
      console.log('PetMaster PWA instalado com sucesso no sistema');
      if (this.dom.installPwaBtn) {
        this.dom.installPwaBtn.classList.add('hidden');
      }
      this.app.showToast('🎉 PetMaster instalado com sucesso no seu dispositivo!', 'success');
    });
  }

  updateStatusUI() {
    if (this.dom.statusBadge) {
      if (this.isOnline) {
        if (this.dom.statusDot) {
          this.dom.statusDot.className = 'w-2 h-2 rounded-full bg-emerald-400 animate-pulse';
        }
        if (this.dom.statusText) {
          this.dom.statusText.textContent = 'Online';
          this.dom.statusText.className = 'text-xs font-semibold text-emerald-400';
        }
      } else {
        if (this.dom.statusDot) {
          this.dom.statusDot.className = 'w-2 h-2 rounded-full bg-amber-400';
        }
        if (this.dom.statusText) {
          this.dom.statusText.textContent = 'Offline';
          this.dom.statusText.className = 'text-xs font-semibold text-amber-400';
        }
      }
    }

    const drawerStatusBadge = document.getElementById('drawer-network-status-badge');
    if (drawerStatusBadge) {
      if (this.isOnline) {
        drawerStatusBadge.innerHTML = '🟢 <span class="text-emerald-400">Conectado (Nuvem)</span>';
      } else {
        drawerStatusBadge.innerHTML = '⚡ <span class="text-amber-400">Modo Local (Offline)</span>';
      }
    }

    const drawerInstallBtn = document.getElementById('drawer-install-btn');
    if (drawerInstallBtn && this.deferredInstallPrompt) {
      drawerInstallBtn.classList.remove('hidden');
      drawerInstallBtn.onclick = async () => {
        this.deferredInstallPrompt.prompt();
        const choice = await this.deferredInstallPrompt.userChoice;
        if (choice.outcome === 'accepted') {
          drawerInstallBtn.classList.add('hidden');
          soundFx.playLevelUp();
        }
        this.deferredInstallPrompt = null;
      };
    }
  }
}
