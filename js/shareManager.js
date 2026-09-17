/**
 * PetMaster - Módulo de Compartilhamento, QR Code e Exportação JSON
 * Suporta compressão stateless de URL via LZ-String e exportação de backups físicos.
 */

import { generateQRCodeCanvas } from './qrcodeEngine.js';
import { soundFx } from './audio.js';

export class ShareManager {
  constructor(app) {
    this.app = app;
    this.dom = {
      shareModal: document.getElementById('share-modal'),
      closeShareModalBtn: document.getElementById('close-share-modal-btn'),
      qrContainer: document.getElementById('share-qr-container'),
      shareUrlInput: document.getElementById('share-url-input'),
      copyUrlBtn: document.getElementById('copy-share-url-btn'),
      exportJsonBtn: document.getElementById('export-json-btn'),
      importJsonInput: document.getElementById('import-json-input'),
      sharePetTitle: document.getElementById('share-pet-title'),
      sharePetSubtitle: document.getElementById('share-pet-subtitle')
    };

    this.bindEvents();
  }

  bindEvents() {
    if (this.dom.closeShareModalBtn) {
      this.dom.closeShareModalBtn.addEventListener('click', () => this.closeShareModal());
    }

    if (this.dom.copyUrlBtn) {
      this.dom.copyUrlBtn.addEventListener('click', () => this.copyShareUrl());
    }

    if (this.dom.exportJsonBtn) {
      this.dom.exportJsonBtn.addEventListener('click', () => this.exportBackupJSON());
    }

    if (this.dom.importJsonInput) {
      this.dom.importJsonInput.addEventListener('change', (e) => this.handleImportJSON(e));
    }
  }

  // Gera o payload condensado do Pet para URL
  generatePetPayload(pet) {
    if (!pet) return null;
    return {
      n: pet.name,
      s: pet.speciesId,
      g: pet.stage,
      l: pet.level,
      x: pet.xp,
      u: this.app.auth ? this.app.auth.currentUser.displayName : 'Guardião da Fauna',
      t: Date.now()
    };
  }

  // Abre o Modal com QR Code e Link de Compartilhamento
  openShareModal(pet) {
    if (!pet) return;
    const payload = this.generatePetPayload(pet);
    const jsonStr = JSON.stringify(payload);

    let compressed = '';
    if (window.LZString) {
      compressed = window.LZString.compressToEncodedURIComponent(jsonStr);
    } else {
      compressed = encodeURIComponent(btoa(jsonStr));
    }

    const shareUrl = `${window.location.origin}${window.location.pathname}#pet=${compressed}`;

    if (this.dom.sharePetTitle) {
      this.dom.sharePetTitle.textContent = `${pet.species.emoji} ${pet.name} (Nível ${pet.level})`;
    }
    if (this.dom.sharePetSubtitle) {
      this.dom.sharePetSubtitle.textContent = `${pet.species.name} • Estágio: ${pet.stage.toUpperCase()}`;
    }

    if (this.dom.shareUrlInput) {
      this.dom.shareUrlInput.value = shareUrl;
    }

    // Renderiza QR Code no Canvas
    if (this.dom.qrContainer) {
      this.dom.qrContainer.innerHTML = '';
      try {
        const qrCanvas = generateQRCodeCanvas(shareUrl, 200);
        this.dom.qrContainer.appendChild(qrCanvas);
      } catch (err) {
        console.warn('Erro ao gerar QR Code:', err);
        this.dom.qrContainer.innerHTML = '<p class="text-xs text-red-400">QR Code indisponível.</p>';
      }
    }

    if (this.dom.shareModal) {
      this.dom.shareModal.classList.remove('hidden');
      document.body.classList.add('overflow-hidden');
    }

    soundFx.playClick();
  }

  closeShareModal() {
    if (this.dom.shareModal) {
      this.dom.shareModal.classList.add('hidden');
      document.body.classList.remove('overflow-hidden');
    }
    soundFx.playClick();
  }

  async copyShareUrl() {
    if (!this.dom.shareUrlInput) return;
    try {
      await navigator.clipboard.writeText(this.dom.shareUrlInput.value);
      this.app.showToast('📋 Link do animal copiado para a área de transferência!', 'success');
      soundFx.playCoin();
    } catch (err) {
      this.dom.shareUrlInput.select();
      document.execCommand('copy');
      this.app.showToast('📋 Link copiado com sucesso!', 'success');
    }
  }

  // Exporta backup completo do jogo em arquivo .json
  exportBackupJSON() {
    const backupData = {
      version: '1.0.0',
      timestamp: Date.now(),
      app: 'PetMaster',
      user: this.app.auth ? this.app.auth.currentUser : null,
      currentPet: this.app.pet ? this.app.pet.serialize() : null,
      sanctuary: this.app.sanctuary ? this.app.sanctuary.serialize() : null,
      coins: this.app.coins,
      inventory: this.app.inventory
    };

    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(backupData, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `petmaster_backup_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();

    this.app.showToast('💾 Backup exportado com sucesso!', 'success');
    soundFx.playCoin();
  }

  // Importa backup a partir de arquivo .json
  handleImportJSON(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        if (data.app !== 'PetMaster' && !data.currentPet) {
          throw new Error('Arquivo de backup inválido ou incompatível.');
        }

        this.app.loadFromBackup(data);
        this.app.showToast('✅ Santuário e Animais restaurados com sucesso!', 'success');
        this.closeShareModal();
        soundFx.playLevelUp();
      } catch (err) {
        alert('Erro ao carregar backup: ' + err.message);
      }
    };
    reader.readAsText(file);
    event.target.value = ''; // Reset input
  }

  // Detecta e processa parâmetro de compartilhamento na URL (#pet=...)
  checkIncomingShare() {
    const hash = window.location.hash;
    if (!hash || !hash.includes('pet=')) return;

    try {
      const param = hash.split('pet=')[1];
      let jsonStr = '';
      if (window.LZString) {
        jsonStr = window.LZString.decompressFromEncodedURIComponent(param);
      }
      if (!jsonStr) {
        jsonStr = atob(decodeURIComponent(param));
      }

      const sharedPet = JSON.parse(jsonStr);
      if (sharedPet && sharedPet.n && sharedPet.s) {
        this.showSharedPetNotification(sharedPet);
      }
    } catch (err) {
      console.warn('Falha ao processar pet compartilhado da URL:', err);
    }
  }

  showSharedPetNotification(data) {
    setTimeout(() => {
      alert(`🌟 Visita Especial!\n\nVocê está visualizando o animal de um colega:\nNome: ${data.n}\nEspécie: ${data.s}\nNível: ${data.l} (${data.g})\nGuardião: ${data.u}`);
      // Limpa a hash da URL sem recarregar a página
      history.replaceState(null, null, ' ');
    }, 800);
  }
}
