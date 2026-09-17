/**
 * PetMaster - Gerenciador de Autenticação
 * Suporta Modo Convidado Instantâneo (1-clique) e Google Sign-In via Firebase Auth
 */

import { db } from './firebaseConfig.js';
import { soundFx } from './audio.js';

export const AVATAR_EMOJIS = ['🐾', '🦁', '🦊', '🦉', '🐢', '🐬', '🐸', '🐆', '🦜', '🦥'];

export class AuthManager {
  constructor(app) {
    this.app = app;
    this.currentUser = db.loadUser() || this.createDefaultGuest();

    this.dom = {
      userAvatar: document.getElementById('user-avatar-badge'),
      userName: document.getElementById('user-name-display'),
      authModal: document.getElementById('auth-modal'),
      closeAuthModalBtn: document.getElementById('close-auth-modal-btn'),
      guestNameInput: document.getElementById('guest-name-input'),
      saveGuestBtn: document.getElementById('save-guest-btn'),
      googleLoginBtn: document.getElementById('google-login-btn'),
      avatarOptionsContainer: document.getElementById('avatar-options-container')
    };

    this.init();
  }

  createDefaultGuest() {
    return {
      uid: 'guest_' + Math.random().toString(36).substring(2, 9),
      displayName: 'Guardião Novato',
      avatar: '🐾',
      isAnonymous: true
    };
  }

  init() {
    this.updateUserUI();
    this.bindEvents();
    this.renderAvatarOptions();
    this.checkAutoLogin();
  }

  // Verificação de Login com Google Automático na Inicialização
  async checkAutoLogin() {
    if (db.isCloudEnabled && db.auth) {
      try {
        const { onAuthStateChanged } = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js');
        onAuthStateChanged(db.auth, (user) => {
          if (user) {
            console.log('⚡ [AuthManager] Sessão Google autenticada automaticamente:', user.displayName);
            this.currentUser = {
              uid: user.uid,
              displayName: user.displayName || 'Guardião Google',
              email: user.email,
              avatar: this.currentUser.avatar || '🦁',
              isAnonymous: false
            };
            db.saveUser(this.currentUser);
            this.updateUserUI();
            this.app.showToast(`✨ Sessão Google ativa: ${this.currentUser.displayName}`, 'info');
          }
        });
      } catch (e) {
        console.warn('Falha no auto-login do Firebase Auth:', e);
      }
    }
  }

  bindEvents() {
    if (this.dom.userAvatar) {
      this.dom.userAvatar.addEventListener('click', () => this.openAuthModal());
    }

    if (this.dom.closeAuthModalBtn) {
      this.dom.closeAuthModalBtn.addEventListener('click', () => this.closeAuthModal());
    }

    if (this.dom.saveGuestBtn) {
      this.dom.saveGuestBtn.addEventListener('click', () => {
        const name = this.dom.guestNameInput.value.trim();
        if (name) {
          this.currentUser.displayName = name;
          db.saveUser(this.currentUser);
          this.updateUserUI();
          this.closeAuthModal();
          this.app.showToast('👤 Perfil atualizado com sucesso!', 'success');
          soundFx.playCoin();
        }
      });
    }

    if (this.dom.googleLoginBtn) {
      this.dom.googleLoginBtn.addEventListener('click', () => this.loginWithGoogle());
    }
  }

  renderAvatarOptions() {
    if (!this.dom.avatarOptionsContainer) return;
    this.dom.avatarOptionsContainer.innerHTML = '';

    AVATAR_EMOJIS.forEach((emoji) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `w-10 h-10 rounded-xl text-xl flex items-center justify-center transition-all ${
        this.currentUser.avatar === emoji
          ? 'bg-emerald-600 ring-2 ring-emerald-400 scale-110 shadow-lg'
          : 'bg-gray-800 hover:bg-gray-700'
      }`;
      btn.textContent = emoji;
      btn.addEventListener('click', () => {
        this.currentUser.avatar = emoji;
        this.renderAvatarOptions();
        soundFx.playClick();
      });
      this.dom.avatarOptionsContainer.appendChild(btn);
    });
  }

  openAuthModal() {
    if (!this.dom.authModal) return;
    if (this.dom.guestNameInput) {
      this.dom.guestNameInput.value = this.currentUser.displayName || '';
    }
    this.renderAvatarOptions();
    this.dom.authModal.classList.remove('hidden');
    document.body.classList.add('overflow-hidden');
    soundFx.playClick();
  }

  closeAuthModal() {
    if (!this.dom.authModal) return;
    this.dom.authModal.classList.add('hidden');
    document.body.classList.remove('overflow-hidden');
    soundFx.playClick();
  }

  updateUserUI() {
    if (this.dom.userAvatar) {
      this.dom.userAvatar.textContent = this.currentUser.avatar || '🐾';
    }
    if (this.dom.userName) {
      this.dom.userName.textContent = this.currentUser.displayName || 'Guardião';
    }
    const drawerAvatar = document.getElementById('drawer-user-avatar-text');
    const drawerName = document.getElementById('drawer-user-name');
    const drawerStatus = document.getElementById('drawer-user-status');
    const drawerAuthBtn = document.getElementById('drawer-auth-btn');
    if (drawerAvatar) drawerAvatar.textContent = this.currentUser.avatar || '🐾';
    if (drawerName) drawerName.textContent = this.currentUser.displayName || 'Guardião';
    if (drawerStatus) drawerStatus.textContent = this.currentUser.isAnonymous ? 'Banco Local (GitHub Pages)' : 'Nuvem Conectada';
    if (drawerAuthBtn) drawerAuthBtn.textContent = this.currentUser.isAnonymous ? 'Entrar' : 'Perfil';
  }

  async loginWithGoogle() {
    if (!db.isCloudEnabled || !db.auth) {
      alert('ℹ️ O login com Google requer a ativação do Firebase. Acesse Configurações para vincular suas chaves ou continue no Modo Convidado local!');
      return;
    }

    try {
      const { GoogleAuthProvider, signInWithPopup } = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js');
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(db.auth, provider);
      const user = result.user;

      this.currentUser = {
        uid: user.uid,
        displayName: user.displayName || 'Guardião Google',
        email: user.email,
        avatar: '🦁',
        isAnonymous: false
      };

      db.saveUser(this.currentUser);
      this.updateUserUI();
      this.closeAuthModal();
      this.app.showToast(`👋 Bem-vindo(a), ${this.currentUser.displayName}!`, 'success');
      soundFx.playLevelUp();
    } catch (err) {
      console.warn('Erro na autenticação com Google:', err);
      alert('Falha ao autenticar com o Google: ' + err.message);
    }
  }
}
