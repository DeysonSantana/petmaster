/**
 * PetMaster - Minigames Interativos
 * 1. Chuva de Alimentos (Canvas 2D com requestAnimationFrame e colisões AABB)
 * 2. Memória da Biodiversidade (Grid interativa de cartas e fatos biológicos)
 */

import { soundFx } from './audio.js';

export class MinigameManager {
  constructor(app) {
    this.app = app;
    this.currentGame = null;
    this.animationFrameId = null;

    this.dom = {
      minigamesModal: document.getElementById('minigames-modal'),
      closeMinigamesModalBtn: document.getElementById('close-minigames-modal-btn'),
      tabChuvaBtn: document.getElementById('tab-chuva-btn'),
      tabMemoriaBtn: document.getElementById('tab-memoria-btn'),
      chuvaContainer: document.getElementById('minigame-chuva-view'),
      memoriaContainer: document.getElementById('minigame-memoria-view'),
      
      // Canvas Chuva de Alimentos
      canvas: document.getElementById('chuva-canvas'),
      startChuvaBtn: document.getElementById('start-chuva-btn'),
      chuvaScoreDisplay: document.getElementById('chuva-score'),
      chuvaLivesDisplay: document.getElementById('chuva-lives'),
      chuvaOverlay: document.getElementById('chuva-overlay'),

      // Memória
      startMemoriaBtn: document.getElementById('start-memoria-btn'),
      memoriaGrid: document.getElementById('memoria-grid'),
      memoriaMovesDisplay: document.getElementById('memoria-moves'),
      memoriaMatchesDisplay: document.getElementById('memoria-matches')
    };

    this.init();
  }

  init() {
    this.bindEvents();
    this.switchTab('chuva');
  }

  bindEvents() {
    if (this.dom.closeMinigamesModalBtn) {
      this.dom.closeMinigamesModalBtn.addEventListener('click', () => this.closeModal());
    }

    if (this.dom.tabChuvaBtn) {
      this.dom.tabChuvaBtn.addEventListener('click', () => this.switchTab('chuva'));
    }

    if (this.dom.tabMemoriaBtn) {
      this.dom.tabMemoriaBtn.addEventListener('click', () => this.switchTab('memoria'));
    }

    if (this.dom.startChuvaBtn) {
      this.dom.startChuvaBtn.addEventListener('click', () => this.startChuvaGame());
    }

    if (this.dom.startMemoriaBtn) {
      this.dom.startMemoriaBtn.addEventListener('click', () => this.startMemoriaGame());
    }
  }

  openModal() {
    if (!this.dom.minigamesModal) return;
    this.dom.minigamesModal.classList.remove('hidden');
    document.body.classList.add('overflow-hidden');
    soundFx.playClick();
  }

  closeModal() {
    this.stopChuvaGame();
    if (this.dom.minigamesModal) {
      this.dom.minigamesModal.classList.add('hidden');
      document.body.classList.remove('overflow-hidden');
    }
    soundFx.playClick();
  }

  switchTab(tab) {
    if (tab === 'chuva') {
      if (this.dom.tabChuvaBtn) {
        this.dom.tabChuvaBtn.className = 'px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 text-white shadow-md transition-all';
      }
      if (this.dom.tabMemoriaBtn) {
        this.dom.tabMemoriaBtn.className = 'px-4 py-2 rounded-xl text-xs font-bold text-gray-400 hover:text-white transition-all';
      }
      if (this.dom.chuvaContainer) this.dom.chuvaContainer.classList.remove('hidden');
      if (this.dom.memoriaContainer) this.dom.memoriaContainer.classList.add('hidden');
    } else {
      this.stopChuvaGame();
      if (this.dom.tabMemoriaBtn) {
        this.dom.tabMemoriaBtn.className = 'px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 text-white shadow-md transition-all';
      }
      if (this.dom.tabChuvaBtn) {
        this.dom.tabChuvaBtn.className = 'px-4 py-2 rounded-xl text-xs font-bold text-gray-400 hover:text-white transition-all';
      }
      if (this.dom.memoriaContainer) this.dom.memoriaContainer.classList.remove('hidden');
      if (this.dom.chuvaContainer) this.dom.chuvaContainer.classList.add('hidden');
      this.startMemoriaGame();
    }
    soundFx.playClick();
  }

  // ==========================================
  // MINIGAME 1: CHUVA DE ALIMENTOS (CANVAS 2D)
  // ==========================================
  startChuvaGame() {
    if (!this.dom.canvas) return;
    const canvas = this.dom.canvas;
    const ctx = canvas.getContext('2d');

    // Configura resolução interna
    canvas.width = 360;
    canvas.height = 460;

    if (this.dom.chuvaOverlay) {
      this.dom.chuvaOverlay.classList.add('hidden');
    }

    const petEmoji = this.app.pet ? this.app.pet.species.emoji : '🐾';

    const state = {
      playerX: 180,
      playerWidth: 50,
      playerHeight: 40,
      score: 0,
      lives: 3,
      items: [],
      spawnTimer: 0,
      spawnInterval: 45, // frames entre spawns
      running: true,
      touchActive: false
    };

    this.gameStateChuva = state;
    this.updateChuvaHUD(state.score, state.lives);

    // Controles Touch e Mouse
    const handleMove = (clientX) => {
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const x = (clientX - rect.left) * scaleX;
      state.playerX = Math.max(state.playerWidth / 2, Math.min(canvas.width - state.playerWidth / 2, x));
    };

    const onTouchMove = (e) => {
      if (e.touches && e.touches[0]) {
        handleMove(e.touches[0].clientX);
      }
    };
    const onMouseMove = (e) => handleMove(e.clientX);

    canvas.onpointermove = onMouseMove;
    canvas.ontouchmove = onTouchMove;

    // Itens possíveis
    const goodTypes = [
      { emoji: '🫐', pts: 10, isGood: true },
      { emoji: '🌿', pts: 10, isGood: true },
      { emoji: '🦗', pts: 15, isGood: true },
      { emoji: '🐟', pts: 20, isGood: true },
      { emoji: '✨', pts: 50, isGood: true }
    ];
    const badTypes = [
      { emoji: '🪨', isGood: false },
      { emoji: '🥫', isGood: false },
      { emoji: '☣️', isGood: false }
    ];

    let lastTime = performance.now();

    const loop = (currentTime) => {
      if (!state.running) return;

      const dt = (currentTime - lastTime) / 1000;
      lastTime = currentTime;

      // Limpa Canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Fundo estilizado com gradiente de céu
      const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
      grad.addColorStop(0, '#062016');
      grad.addColorStop(1, '#020d09');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Linha de chão
      ctx.strokeStyle = '#10b98133';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, canvas.height - 20);
      ctx.lineTo(canvas.width, canvas.height - 20);
      ctx.stroke();

      // Spawner de itens
      state.spawnTimer++;
      if (state.spawnTimer >= state.spawnInterval) {
        state.spawnTimer = 0;
        const isBad = Math.random() < 0.28; // 28% de lixo/pedra
        const pool = isBad ? badTypes : goodTypes;
        const chosen = pool[Math.floor(Math.random() * pool.length)];

        state.items.push({
          x: 25 + Math.random() * (canvas.width - 50),
          y: -20,
          speed: 2.2 + Math.random() * 2.0 + Math.min(3, state.score * 0.015),
          emoji: chosen.emoji,
          isGood: chosen.isGood,
          pts: chosen.pts || 0,
          radius: 16
        });
      }

      // Atualiza e desenha itens caindo
      for (let i = state.items.length - 1; i >= 0; i--) {
        const item = state.items[i];
        item.y += item.speed;

        ctx.font = '24px serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(item.emoji, item.x, item.y);

        // Checagem de Colisão com Cesta/Player
        const playerY = canvas.height - 40;
        const dx = Math.abs(item.x - state.playerX);
        const dy = Math.abs(item.y - playerY);

        if (dx < (state.playerWidth / 2 + 10) && dy < 22) {
          // Colidiu!
          state.items.splice(i, 1);
          if (item.isGood) {
            state.score += item.pts;
            soundFx.playFeed();
            this.updateChuvaHUD(state.score, state.lives);
          } else {
            state.lives--;
            soundFx.playGameOver();
            this.updateChuvaHUD(state.score, state.lives);
            if (state.lives <= 0) {
              this.endChuvaGame(state.score);
              return;
            }
          }
          continue;
        }

        // Passou da tela
        if (item.y > canvas.height + 20) {
          state.items.splice(i, 1);
        }
      }

      // Desenha o Player (Cesta com Emoji do Pet)
      const playerY = canvas.height - 40;
      
      // Sombra
      ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
      ctx.beginPath();
      ctx.ellipse(state.playerX, canvas.height - 18, 22, 6, 0, 0, Math.PI * 2);
      ctx.fill();

      // Cesta
      ctx.fillStyle = '#059669';
      ctx.beginPath();
      ctx.roundRect(state.playerX - state.playerWidth / 2, playerY - 10, state.playerWidth, 22, 10);
      ctx.fill();

      // Emoji do Pet dentro da cesta
      ctx.font = '28px serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(petEmoji, state.playerX, playerY - 14);

      this.animationFrameId = requestAnimationFrame(loop);
    };

    this.animationFrameId = requestAnimationFrame(loop);
    soundFx.playHappy();
  }

  updateChuvaHUD(score, lives) {
    if (this.dom.chuvaScoreDisplay) {
      this.dom.chuvaScoreDisplay.textContent = score;
    }
    if (this.dom.chuvaLivesDisplay) {
      this.dom.chuvaLivesDisplay.textContent = '❤️'.repeat(Math.max(0, lives));
    }
  }

  stopChuvaGame() {
    if (this.gameStateChuva) {
      this.gameStateChuva.running = false;
    }
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  endChuvaGame(score) {
    this.stopChuvaGame();
    soundFx.playGameOver();

    const coinsEarned = Math.max(5, Math.floor(score / 4));
    this.app.addCoins(coinsEarned);

    // Aplica benefício no Pet
    if (this.app.pet) {
      const playResult = this.app.pet.play(score, coinsEarned);
      if (playResult.evolved) {
        this.app.handleEvolution(playResult.evolved);
      }
      this.app.saveGame();
    }

    if (this.dom.chuvaOverlay) {
      this.dom.chuvaOverlay.classList.remove('hidden');
      this.dom.chuvaOverlay.innerHTML = `
        <div class="text-center p-6 bg-gray-950/95 border border-emerald-500/40 rounded-3xl max-w-xs mx-auto shadow-2xl">
          <div class="text-4xl mb-2">🎉</div>
          <h3 class="text-lg font-black text-white">Partida Concluída!</h3>
          <p class="text-xs text-gray-300 mt-1">Pontuação Final: <strong class="text-emerald-400 text-base">${score}</strong></p>
          <div class="my-3 p-2 rounded-xl bg-emerald-950/50 border border-emerald-800 text-xs text-emerald-300 font-bold flex items-center justify-center gap-2">
            <span>🪙 +${coinsEarned} Moedas</span>
            <span>•</span>
            <span>💖 +Felicidade</span>
          </div>
          <button id="restart-chuva-btn" class="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 font-bold text-white text-xs shadow-lg shadow-emerald-600/30 transition-all">
            Jogar Novamente
          </button>
        </div>
      `;

      const restartBtn = document.getElementById('restart-chuva-btn');
      if (restartBtn) {
        restartBtn.addEventListener('click', () => this.startChuvaGame());
      }
    }
  }

  // ==========================================
  // MINIGAME 2: MEMÓRIA DA BIODIVERSIDADE
  // ==========================================
  startMemoriaGame() {
    if (!this.dom.memoriaGrid) return;
    this.dom.memoriaGrid.innerHTML = '';

    const animals = ['🐆', '🦜', '🐊', '🐸', '🐬', '🐾'];
    // Duplica e embaralha
    const deck = [...animals, ...animals].sort(() => Math.random() - 0.5);

    let moves = 0;
    let matches = 0;
    let flippedCards = [];
    let lockBoard = false;

    if (this.dom.memoriaMovesDisplay) this.dom.memoriaMovesDisplay.textContent = '0';
    if (this.dom.memoriaMatchesDisplay) this.dom.memoriaMatchesDisplay.textContent = '0/6';

    deck.forEach((emoji, index) => {
      const card = document.createElement('div');
      card.className = 'aspect-square rounded-2xl bg-gray-800/80 border border-gray-700/80 flex items-center justify-center text-3xl cursor-pointer select-none transition-all hover:scale-105 shadow-md';
      card.dataset.emoji = emoji;
      card.dataset.index = index;
      card.innerHTML = '<span class="opacity-0 transition-opacity">❓</span>';

      card.addEventListener('click', () => {
        if (lockBoard || card.classList.contains('matched') || flippedCards.includes(card)) return;

        // Revela
        card.classList.remove('bg-gray-800/80');
        card.classList.add('bg-emerald-950/80', 'border-emerald-500', 'ring-2', 'ring-emerald-400');
        card.innerHTML = `<span class="opacity-100 transition-opacity transform scale-110">${emoji}</span>`;
        soundFx.playClick();

        flippedCards.push(card);

        if (flippedCards.length === 2) {
          moves++;
          if (this.dom.memoriaMovesDisplay) this.dom.memoriaMovesDisplay.textContent = moves;

          const [card1, card2] = flippedCards;
          if (card1.dataset.emoji === card2.dataset.emoji) {
            // Acertou par!
            card1.classList.add('matched');
            card2.classList.add('matched');
            card1.classList.replace('ring-emerald-400', 'ring-emerald-600');
            card2.classList.replace('ring-emerald-400', 'ring-emerald-600');
            matches++;
            if (this.dom.memoriaMatchesDisplay) this.dom.memoriaMatchesDisplay.textContent = `${matches}/6`;
            soundFx.playCoin();
            flippedCards = [];

            if (matches === 6) {
              setTimeout(() => this.endMemoriaGame(moves), 500);
            }
          } else {
            // Errou par
            lockBoard = true;
            setTimeout(() => {
              card1.className = 'aspect-square rounded-2xl bg-gray-800/80 border border-gray-700/80 flex items-center justify-center text-3xl cursor-pointer select-none transition-all hover:scale-105 shadow-md';
              card2.className = 'aspect-square rounded-2xl bg-gray-800/80 border border-gray-700/80 flex items-center justify-center text-3xl cursor-pointer select-none transition-all hover:scale-105 shadow-md';
              card1.innerHTML = '<span class="opacity-0">❓</span>';
              card2.innerHTML = '<span class="opacity-0">❓</span>';
              flippedCards = [];
              lockBoard = false;
            }, 800);
          }
        }
      });

      this.dom.memoriaGrid.appendChild(card);
    });
  }

  endMemoriaGame(moves) {
    soundFx.playLevelUp();
    const coinsEarned = Math.max(15, 50 - moves * 2);
    this.app.addCoins(coinsEarned);

    if (this.app.pet) {
      this.app.pet.play(25, coinsEarned);
      this.app.saveGame();
    }

    if (window.confetti) {
      window.confetti({ particleCount: 70, spread: 60, origin: { y: 0.6 } });
    }

    alert(`🧠 Excelente Memória!\n\nVocê completou a Memória da Fauna em ${moves} jogadas.\nRecompensa: +${coinsEarned} Moedas e Felicidade para o Pet!`);
  }
}
