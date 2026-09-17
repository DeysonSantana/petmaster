/**
 * PetMaster - Gerenciador de Autenticação Dual (Google Firebase + Modo Convidado Local)
 * Alinhado 100% à experiência ágil do QuizMaster (1-Clique, Auto-Login e Offline-First)
 */

import { db } from './firebaseConfig.js';
import { soundFx } from './audio.js';

export const AVATAR_EMOJIS = [
  '🐾', '🦁', '🦊', '🦉', '🐢', '🐬', '🐸', '🐆', '🦜', '🦥',
  '🐼', '🐺', '🦄', '🐯', '🦅', '🐧', '🦖', '🐙', '🐝', '🦔'
];

export class AuthManager {
  constructor(app) {
    this.app = app;
    this.currentUser = db.loadUser() || this.createDefaultGuest();

    this.dom = {
      // Header Elements
      userAvatar: document.getElementById('user-avatar-badge'),
      userName: document.getElementById('user-name-display'),

      // Modal Elements
      authModal: document.getElementById('auth-modal'),
      closeAuthModalBtn: document.getElementById('close-auth-modal-btn'),
      guestNameInput: document.getElementById('guest-name-input'),
      saveGuestBtn: document.getElementById('save-guest-btn'),
      avatarOptionsContainer: document.getElementById('avatar-options-container'),

      // Google Auth Sections
      authLoggedSection: document.getElementById('auth-logged-section'),
      authGuestSection: document.getElementById('auth-guest-section'),
      loggedUserAvatar: document.getElementById('logged-user-avatar'),
      loggedUserName: document.getElementById('logged-user-name'),
      loggedUserEmail: document.getElementById('logged-user-email'),
      googleLoginBtn: document.getElementById('google-login-btn'),
      googleLogoutBtn: document.getElementById('google-logout-btn')
    };

    this.init();
  }

  createDefaultGuest() {
    return {
      uid: 'guest_' + Math.random().toString(36).substring(2, 9),
      displayName: 'Guardião Novato',
      avatar: '🐾',
      email: null,
      isAnonymous: true
    };
  }

  init() {
    this.updateUserUI();
    this.bindEvents();
    this.renderAvatarOptions();
    this.checkAutoLogin();
  }

  // ==========================================
  // AUTO-LOGIN & MONITORAMENTO SILENCIOSO
  // ==========================================
  async checkAutoLogin() {
    if (!db.isCloudEnabled || !db.auth) {
      try {
        await db.init();
      } catch (e) {
        console.warn('Firebase init offline notice:', e);
      }
    }

    if (db.isCloudEnabled && db.auth) {
      try {
        const { onAuthStateChanged, getRedirectResult } = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js');

        // Tratamento para redirecionamento mobile/PWA
        try {
          const redirectResult = await getRedirectResult(db.auth);
          if (redirectResult && redirectResult.user) {
            this.handleFirebaseUser(redirectResult.user, false);
          }
        } catch (redirectErr) {
          console.warn('Redirect check notice:', redirectErr);
        }

        // Listener reativo de estado de autenticação
        onAuthStateChanged(db.auth, (user) => {
          if (user) {
            this.handleFirebaseUser(user, true);
          } else {
            // Se estava como google user mas deslogou no Firebase
            if (this.currentUser && !this.currentUser.isAnonymous) {
              this.currentUser = this.createDefaultGuest();
              db.saveUser(this.currentUser);
              this.updateUserUI();
              this.renderAuthStateInModal();
            }
          }
        });
      } catch (e) {
        console.warn('Monitoramento do Firebase Auth indisponível:', e);
      }
    }
  }

  handleFirebaseUser(user, isSilent = true) {
    console.log('⚡ [AuthManager] Sessão Google autenticada:', user.displayName || user.email);

    this.currentUser = {
      uid: user.uid,
      displayName: user.displayName || (user.email ? user.email.split('@')[0] : 'Guardião Google'),
      email: user.email || null,
      avatar: this.currentUser?.avatar || '🦁',
      photoURL: user.photoURL || null,
      isAnonymous: false
    };

    db.saveUser(this.currentUser);
    this.updateUserUI();
    this.renderAuthStateInModal();

    if (!isSilent) {
      this.app.showToast(`✨ Bem-vindo(a), ${this.currentUser.displayName}!`, 'success');
      soundFx.playEvolve ? soundFx.playEvolve() : soundFx.playCoin();
    }
  }

  // ==========================================
  // EVENT LISTENERS
  // ==========================================
  bindEvents() {
    if (this.dom.userAvatar) {
      this.dom.userAvatar.addEventListener('click', () => this.openAuthModal());
    }

    if (this.dom.userName) {
      this.dom.userName.addEventListener('click', () => this.openAuthModal());
    }

    if (this.dom.closeAuthModalBtn) {
      this.dom.closeAuthModalBtn.addEventListener('click', () => this.closeAuthModal());
    }

    if (this.dom.saveGuestBtn) {
      this.dom.saveGuestBtn.addEventListener('click', () => {
        const name = this.dom.guestNameInput ? this.dom.guestNameInput.value.trim() : '';
        if (name) {
          this.currentUser.displayName = name;
          db.saveUser(this.currentUser);
          this.updateUserUI();
          this.renderAuthStateInModal();
          this.closeAuthModal();
          this.app.showToast('👤 Perfil atualizado com sucesso!', 'success');
          soundFx.playCoin();
        } else {
          this.app.showToast('Por favor, informe um nome ou apelido.', 'warning');
        }
      });
    }

    if (this.dom.googleLoginBtn) {
      this.dom.googleLoginBtn.addEventListener('click', () => this.loginWithGoogle());
    }

    if (this.dom.googleLogoutBtn) {
      this.dom.googleLogoutBtn.addEventListener('click', () => this.logout());
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
        this.updateUserUI();
        this.renderAuthStateInModal();
        db.saveUser(this.currentUser);
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
    this.renderAuthStateInModal();
    this.dom.authModal.classList.remove('hidden');
    document.body.classList.add('overflow-hidden');
    if (window.lucide) window.lucide.createIcons();
    soundFx.playClick();
  }

  closeAuthModal() {
    if (!this.dom.authModal) return;
    this.dom.authModal.classList.add('hidden');
    document.body.classList.remove('overflow-hidden');
    soundFx.playClick();
  }

  renderAuthStateInModal() {
    const isLogged = !this.currentUser.isAnonymous;

    if (this.dom.authLoggedSection) {
      this.dom.authLoggedSection.classList.toggle('hidden', !isLogged);
    }
    if (this.dom.authGuestSection) {
      this.dom.authGuestSection.classList.toggle('hidden', isLogged);
    }

    if (isLogged) {
      if (this.dom.loggedUserName) {
        this.dom.loggedUserName.textContent = this.currentUser.displayName || 'Guardião';
      }
      if (this.dom.loggedUserEmail) {
        this.dom.loggedUserEmail.textContent = this.currentUser.email || 'Conta Google Conectada';
      }
      if (this.dom.loggedUserAvatar) {
        this.dom.loggedUserAvatar.textContent = this.currentUser.avatar || '🦁';
      }
    }

    if (window.lucide) window.lucide.createIcons();
  }

  updateUserUI() {
    // Header Desktop
    if (this.dom.userAvatar) {
      this.dom.userAvatar.textContent = this.currentUser.avatar || '🐾';
    }
    if (this.dom.userName) {
      this.dom.userName.textContent = this.currentUser.displayName || 'Guardião';
    }

    // Drawer Mobile
    const drawerAvatar = document.getElementById('drawer-user-avatar-text');
    const drawerName = document.getElementById('drawer-user-name');
    const drawerStatus = document.getElementById('drawer-user-status');
    const drawerAuthBtn = document.getElementById('drawer-auth-btn');

    if (drawerAvatar) drawerAvatar.textContent = this.currentUser.avatar || '🐾';
    if (drawerName) drawerName.textContent = this.currentUser.displayName || 'Guardião';
    if (drawerStatus) {
      drawerStatus.textContent = this.currentUser.isAnonymous 
        ? 'Modo Local (Offline)' 
        : 'Google Cloud Conectado';
    }
    if (drawerAuthBtn) {
      drawerAuthBtn.textContent = this.currentUser.isAnonymous ? 'Entrar' : 'Perfil';
    }
  }

  // ==========================================
  // LOGIN COM O GOOGLE (FLUIDO E 1-CLIQUE)
  // ==========================================
  async loginWithGoogle() {
    if (!db.isCloudEnabled || !db.auth) {
      await db.init();
      if (!db.isCloudEnabled || !db.auth) {
        this.app.showToast('⚠️ Nuvem Firebase temporariamente indisponível. Operando em Modo Convidado local.', 'info');
        return;
      }
    }

    try {
      this.app.showToast('Iniciando login com Google...', 'info');
      const { GoogleAuthProvider, signInWithPopup, signInWithRedirect } = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js');
      
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });

      let user = null;
      try {
        const result = await signInWithPopup(db.auth, provider);
        user = result.user;
      } catch (popupErr) {
        if (popupErr.code === 'auth/popup-blocked') {
          this.app.showToast('Pop-up bloqueado. Alternando para redirecionamento...', 'info');
          await signInWithRedirect(db.auth, provider);
          return;
        } else if (popupErr.code === 'auth/popup-closed-by-user') {
          this.app.showToast('Login cancelado.', 'info');
          return;
        } else if (popupErr.code === 'auth/unauthorized-domain') {
          const currentHost = window.location.hostname;
          this.app.showToast(`Domínio "${currentHost}" requer autorização no Console Firebase.`, 'warning');
          console.warn('Firebase Unauthorized Domain:', currentHost);
          return;
        }
        throw popupErr;
      }

      if (user) {
        this.handleFirebaseUser(user, false);
        this.closeAuthModal();
      }
    } catch (err) {
      console.warn('Erro ao autenticar com Google:', err);
      this.app.showToast(`Falha no login com o Google: ${err.message}`, 'error');
    }
  }

  // ==========================================
  // DESCONECTAR / LOGOUT
  // ==========================================
  async logout() {
    try {
      if (db.isCloudEnabled && db.auth) {
        const { signOut } = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js');
        await signOut(db.auth);
      }
    } catch (err) {
      console.warn('Aviso ao sair da conta Firebase:', err);
    }

    this.currentUser = this.createDefaultGuest();
    db.saveUser(this.currentUser);
    this.updateUserUI();
    this.renderAuthStateInModal();
    this.closeAuthModal();
    this.app.showToast('👋 Desconectado. Você agora está no Modo Convidado local.', 'info');
    soundFx.playClick();
  }
}
