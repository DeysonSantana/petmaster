/**
 * PetMaster - Gerenciador de Temas Visuais
 * Suporta 5 esquemas de cores imersivos com persistência no LocalStorage.
 */

import { soundFx } from './audio.js';

const STORAGE_THEME = 'PETMASTER_THEME';

export const THEMES = [
  { id: 'emerald', name: 'Santuário Esmeralda', icon: '🌲', desc: 'Verde esmeralda profundo da mata e folhagens tropicais', dark: true },
  { id: 'sunset', name: 'Savana Sunset', icon: '🌅', desc: 'Tons quentes de âmbar, laranja e pôr do sol no Cerrado', dark: true },
  { id: 'ocean', name: 'Oceano Profundo', icon: '🌊', desc: 'Azuis marinhos intensos e ciano bioluminescente de recifes', dark: true },
  { id: 'cyberpunk', name: 'Neon Cyberpunk', icon: '🌌', desc: 'Visual escuro de alto contraste com brilho magenta e índigo', dark: true },
  { id: 'pastel', name: 'Pastel Conforto', icon: '🌸', desc: 'Modo claro acolhedor com tons suaves de menta e lavanda', dark: false }
];

export class ThemeManager {
  constructor(app) {
    this.app = app;
    this.currentTheme = this.loadSavedTheme() || 'emerald';

    this.dom = {
      themeToggleBtn: document.getElementById('theme-toggle-btn'),
      themeModal: document.getElementById('theme-selector-modal'),
      closeThemeModalBtn: document.getElementById('close-theme-modal-btn'),
      themeOptionsContainer: document.getElementById('theme-options-container')
    };

    this.init();
  }

  init() {
    this.applyTheme(this.currentTheme, false);
    this.bindEvents();
    this.renderThemeOptions();
  }

  loadSavedTheme() {
    try {
      return localStorage.getItem(STORAGE_THEME);
    } catch (e) {
      return null;
    }
  }

  saveTheme(themeId) {
    try {
      localStorage.setItem(STORAGE_THEME, themeId);
    } catch (e) {}
  }

  applyTheme(themeId, save = true) {
    const theme = THEMES.find(t => t.id === themeId) || THEMES[0];
    this.currentTheme = theme.id;

    document.documentElement.setAttribute('data-theme', theme.id);

    if (!theme.dark) {
      document.documentElement.classList.add('light-theme');
      document.body.classList.add('light-theme');
    } else {
      document.documentElement.classList.remove('light-theme');
      document.body.classList.remove('light-theme');
    }

    if (save) {
      this.saveTheme(theme.id);
    }

    this.renderThemeOptions();
  }

  bindEvents() {
    if (this.dom.themeToggleBtn) {
      this.dom.themeToggleBtn.addEventListener('click', () => this.openThemeModal());
    }

    if (this.dom.closeThemeModalBtn) {
      this.dom.closeThemeModalBtn.addEventListener('click', () => this.closeThemeModal());
    }
  }

  openThemeModal() {
    if (!this.dom.themeModal) return;
    this.renderThemeOptions();
    this.dom.themeModal.classList.remove('hidden');
    document.body.classList.add('overflow-hidden');
    soundFx.playClick();
  }

  closeThemeModal() {
    if (!this.dom.themeModal) return;
    this.dom.themeModal.classList.add('hidden');
    document.body.classList.remove('overflow-hidden');
    soundFx.playClick();
  }

  renderThemeOptions() {
    if (!this.dom.themeOptionsContainer) return;
    this.dom.themeOptionsContainer.innerHTML = '';

    THEMES.forEach((theme) => {
      const isSelected = this.currentTheme === theme.id;
      const card = document.createElement('div');
      card.className = `p-3.5 rounded-2xl border cursor-pointer transition-all flex items-center justify-between ${
        isSelected
          ? 'bg-emerald-950/60 border-emerald-500 ring-2 ring-emerald-500/30'
          : 'bg-gray-900/50 border-gray-800 hover:bg-gray-800/60'
      }`;

      card.innerHTML = `
        <div class="flex items-center gap-3">
          <span class="text-2xl p-2 rounded-xl bg-gray-800/80 border border-gray-700/60">${theme.icon}</span>
          <div>
            <div class="text-sm font-bold text-white flex items-center gap-1.5">
              ${theme.name}
              ${isSelected ? '<span class="text-[10px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded font-mono">Ativo</span>' : ''}
            </div>
            <p class="text-xs text-gray-400 leading-snug mt-0.5">${theme.desc}</p>
          </div>
        </div>
        <div class="w-5 h-5 rounded-full border-2 flex items-center justify-center ${
          isSelected ? 'border-emerald-400 bg-emerald-500' : 'border-gray-600'
        }">
          ${isSelected ? '<svg class="w-3 h-3 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"></path></svg>' : ''}
        </div>
      `;

      card.addEventListener('click', () => {
        this.applyTheme(theme.id);
        soundFx.playClick();
      });

      this.dom.themeOptionsContainer.appendChild(card);
    });
  }
}
