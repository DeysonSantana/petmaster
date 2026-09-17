/**
 * PetMaster - Centro de Minigames Interativos
 * 1. Chuva de Alimentos (Canvas 2D - Catching)
 * 2. Memória da Fauna (Grid de Cartas Biológicas)
 * 3. Salto Ecológico (Canvas 2D - Biome Runner & Pulo com Física)
 * 4. Ritmo da Natureza (Simon Says Musical com Web Audio API)
 */

import { soundFx } from './audio.js';

export class MinigameManager {
  constructor(app) {
    this.app = app;
    this.currentTab = 'chuva';
    this.animationFrameId = null;
    this.saltoFrameId = null;

    // Estado do Ritmo da Natureza
    this.ritmoSequence = [];
    this.playerSequence = [];
    this.ritmoRound = 1;
    this.isShowingSequence = false;

    this.dom = {
      minigamesModal: document.getElementById('minigames-modal'),
      closeMinigamesModalBtn: document.getElementById('close-minigames-modal-btn'),

      // Abas
      tabChuvaBtn: document.getElementById('tab-chuva-btn'),
      tabMemoriaBtn: document.getElementById('tab-memoria-btn'),
      tabSaltoBtn: document.getElementById('tab-salto-btn'),
      tabRitmoBtn: document.getElementById('tab-ritmo-btn'),

      // Containers
      chuvaContainer: document.getElementById('minigame-chuva-view'),
      memoriaContainer: document.getElementById('minigame-memoria-view'),
      saltoContainer: document.getElementById('minigame-salto-view'),
      ritmoContainer: document.getElementById('minigame-ritmo-view'),

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
      memoriaMatchesDisplay: document.getElementById('memoria-matches'),

      // Salto Ecológico
      saltoCanvas: document.getElementById('salto-canvas'),
      startSaltoBtn: document.getElementById('start-salto-btn'),
      saltoScoreDisplay: document.getElementById('salto-score'),
      saltoDistanceDisplay: document.getElementById('salto-distance'),
      saltoOverlay: document.getElementById('salto-overlay'),

      // Ritmo da Natureza
      startRitmoBtn: document.getElementById('start-ritmo-btn'),
      ritmoRoundDisplay: document.getElementById('ritmo-round'),
      ritmoStatusDisplay: document.getElementById('ritmo-status'),
      ritmoPads: [
        document.getElementById('ritmo-pad-water'),
        document.getElementById('ritmo-pad-leaf'),
        document.getElementById('ritmo-pad-sun'),
        document.getElementById('ritmo-pad-earth')
      ]
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

    if (this.dom.tabSaltoBtn) {
      this.dom.tabSaltoBtn.addEventListener('click', () => this.switchTab('salto'));
    }

    if (this.dom.tabRitmoBtn) {
      this.dom.tabRitmoBtn.addEventListener('click', () => this.switchTab('ritmo'));
    }

    // Gatilhos de Início
    if (this.dom.startChuvaBtn) {
      this.dom.startChuvaBtn.addEventListener('click', () => this.startChuvaGame());
    }

    if (this.dom.startMemoriaBtn) {
      this.dom.startMemoriaBtn.addEventListener('click', () => this.startMemoriaGame());
    }

    if (this.dom.startSaltoBtn) {
      this.dom.startSaltoBtn.addEventListener('click', () => this.startSaltoGame());
    }

    if (this.dom.startRitmoBtn) {
      this.dom.startRitmoBtn.addEventListener('click', () => this.startRitmoGame());
    }

    // Pads do Ritmo
    this.dom.ritmoPads.forEach((pad, index) => {
      if (pad) {
        pad.addEventListener('click', () => this.handlePadPress(index));
      }
    });
  }

  openModal() {
    if (!this.dom.minigamesModal) return;
    this.dom.minigamesModal.classList.remove('hidden');
    document.body.classList.add('overflow-hidden');
    soundFx.playClick();
  }

  closeModal() {
    this.stopChuvaGame();
    this.stopSaltoGame();
    if (this.dom.minigamesModal) {
      this.dom.minigamesModal.classList.add('hidden');
      document.body.classList.remove('overflow-hidden');
    }
    soundFx.playClick();
  }

  switchTab(tab) {
    this.stopChuvaGame();
    this.stopSaltoGame();
    this.currentTab = tab;

    const tabs = ['chuva', 'memoria', 'salto', 'ritmo'];
    const tabBtns = {
      chuva: this.dom.tabChuvaBtn,
      memoria: this.dom.tabMemoriaBtn,
      salto: this.dom.tabSaltoBtn,
      ritmo: this.dom.tabRitmoBtn
    };
    const containers = {
      chuva: this.dom.chuvaContainer,
      memoria: this.dom.memoriaContainer,
      salto: this.dom.saltoContainer,
      ritmo: this.dom.ritmoContainer
    };

    tabs.forEach((t) => {
      if (tabBtns[t]) {
        tabBtns[t].className = t === tab
          ? 'py-2 px-1.5 rounded-xl font-bold bg-emerald-600 text-white shadow-md transition-all text-center'
          : 'py-2 px-1.5 rounded-xl font-bold text-gray-400 hover:text-white transition-all text-center';
      }
      if (containers[t]) {
        if (t === tab) {
          containers[t].classList.remove('hidden');
        } else {
          containers[t].classList.add('hidden');
        }
      }
    });

    if (tab === 'memoria') {
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

    canvas.width = 360;
    canvas.height = 420;

    if (this.dom.chuvaOverlay) {
      this.dom.chuvaOverlay.classList.add('hidden');
    }

    let score = 0;
    let lives = 3;
    let basketX = canvas.width / 2;
    const basketWidth = 72;
    const basketHeight = 18;
    const items = [];
    let spawnTimer = 0;
    let isGameOver = false;

    this.updateChuvaHUD(score, lives);

    const onPointerMove = (e) => {
      const rect = canvas.getBoundingClientRect();
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      basketX = ((clientX - rect.left) / rect.width) * canvas.width;
      basketX = Math.max(basketWidth / 2, Math.min(canvas.width - basketWidth / 2, basketX));
    };

    canvas.onmousemove = onPointerMove;
    canvas.ontouchmove = onPointerMove;

    const gameLoop = () => {
      if (isGameOver) return;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Fundo suave da clareira
      ctx.fillStyle = '#062016';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Gera novos itens que caem
      spawnTimer++;
      if (spawnTimer >= 35) {
        spawnTimer = 0;
        const isBad = Math.random() < 0.25;
        items.push({
          x: 25 + Math.random() * (canvas.width - 50),
          y: -20,
          speed: 2.8 + Math.random() * 2.2,
          emoji: isBad ? '🗑️' : ['🫐', '🍎', '🥕', '🍌', '🍒'][Math.floor(Math.random() * 5)],
          isBad: isBad,
          size: 26
        });
      }

      // Desenha e atualiza itens
      for (let i = items.length - 1; i >= 0; i--) {
        const it = items[i];
        it.y += it.speed;

        ctx.font = `${it.size}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(it.emoji, it.x, it.y);

        // Colisão com a cesta
        if (
          it.y + it.size / 2 >= canvas.height - 35 &&
          it.y - it.size / 2 <= canvas.height - 35 + basketHeight &&
          Math.abs(it.x - basketX) < basketWidth / 2 + 10
        ) {
          if (it.isBad) {
            lives--;
            soundFx.playHurt();
            this.updateChuvaHUD(score, lives);
            if (lives <= 0) {
              isGameOver = true;
              this.endChuvaGame(score);
              return;
            }
          } else {
            score += 10;
            soundFx.playCoin();
            this.updateChuvaHUD(score, lives);
          }
          items.splice(i, 1);
          continue;
        }

        // Passou da tela
        if (it.y > canvas.height + 20) {
          items.splice(i, 1);
        }
      }

      // Desenha a cesta ecológica
      ctx.fillStyle = '#10b981';
      ctx.beginPath();
      ctx.roundRect(basketX - basketWidth / 2, canvas.height - 35, basketWidth, basketHeight, [8, 8, 4, 4]);
      ctx.fill();

      ctx.fillStyle = '#064e3b';
      ctx.beginPath();
      ctx.roundRect(basketX - basketWidth / 2 + 4, canvas.height - 31, basketWidth - 8, 6, [3]);
      ctx.fill();

      this.animationFrameId = requestAnimationFrame(gameLoop);
    };

    this.animationFrameId = requestAnimationFrame(gameLoop);
  }

  stopChuvaGame() {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  updateChuvaHUD(score, lives) {
    if (this.dom.chuvaScoreDisplay) this.dom.chuvaScoreDisplay.textContent = score;
    if (this.dom.chuvaLivesDisplay) {
      this.dom.chuvaLivesDisplay.textContent = '❤️'.repeat(Math.max(0, lives));
    }
  }

  endChuvaGame(score) {
    this.stopChuvaGame();
    if (this.dom.chuvaOverlay) this.dom.chuvaOverlay.classList.remove('hidden');

    const coinsEarned = Math.floor(score / 2);
    this.app.addCoins(coinsEarned);

    if (this.app.pet) {
      this.app.pet.play(20, coinsEarned);
      this.app.saveGame();
    }

    if (window.confetti) {
      window.confetti({ particleCount: 50, spread: 60, origin: { y: 0.6 } });
    }

    alert(`🏁 Fim da Chuva de Alimentos!\n\nPontuação Final: ${score}\nRecompensa: +${coinsEarned} Moedas Ecológicas e Felicidade para o Pet!`);
  }

  // ==========================================
  // MINIGAME 2: MEMÓRIA DA FAUNA
  // ==========================================
  startMemoriaGame() {
    if (!this.dom.memoriaGrid) return;

    const cardsData = [
      { emoji: '🐾', name: 'Capivara' },
      { emoji: '🐆', name: 'Onça' },
      { emoji: '🦜', name: 'Arara' },
      { emoji: '🐢', name: 'Tartaruga' },
      { emoji: '🐸', name: 'Sapo' },
      { emoji: '🐬', name: 'Boto' }
    ];

    const deck = [...cardsData, ...cardsData].sort(() => Math.random() - 0.5);

    this.dom.memoriaGrid.innerHTML = '';
    let moves = 0;
    let matches = 0;
    let flippedCards = [];
    let lockBoard = false;

    if (this.dom.memoriaMovesDisplay) this.dom.memoriaMovesDisplay.textContent = '0';
    if (this.dom.memoriaMatchesDisplay) this.dom.memoriaMatchesDisplay.textContent = '0/6';

    deck.forEach((item) => {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'aspect-square rounded-2xl bg-gray-800/80 border border-gray-700/80 flex items-center justify-center text-3xl cursor-pointer select-none transition-all hover:scale-105 shadow-md';
      card.dataset.emoji = item.emoji;
      card.innerHTML = '<span class="opacity-0">❓</span>';

      card.addEventListener('click', () => {
        if (lockBoard || card.classList.contains('matched') || flippedCards.includes(card)) return;

        card.innerHTML = `<span>${item.emoji}</span>`;
        card.className = 'aspect-square rounded-2xl bg-emerald-950 border border-emerald-500 flex items-center justify-center text-3xl select-none scale-105 ring-2 ring-emerald-400 shadow-xl';
        soundFx.playClick();
        flippedCards.push(card);

        if (flippedCards.length === 2) {
          moves++;
          if (this.dom.memoriaMovesDisplay) this.dom.memoriaMovesDisplay.textContent = moves;

          const [card1, card2] = flippedCards;
          if (card1.dataset.emoji === card2.dataset.emoji) {
            card1.classList.add('matched');
            card2.classList.add('matched');
            matches++;
            if (this.dom.memoriaMatchesDisplay) this.dom.memoriaMatchesDisplay.textContent = `${matches}/6`;
            soundFx.playCoin();
            flippedCards = [];

            if (matches === 6) {
              setTimeout(() => this.endMemoriaGame(moves), 500);
            }
          } else {
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

  // ==========================================
  // MINIGAME 3: SALTO ECOLÓGICO (RUNNER 2D)
  // ==========================================
  startSaltoGame() {
    if (!this.dom.saltoCanvas) return;
    const canvas = this.dom.saltoCanvas;
    const ctx = canvas.getContext('2d');

    canvas.width = 360;
    canvas.height = 320;

    if (this.dom.saltoOverlay) this.dom.saltoOverlay.classList.add('hidden');

    let coins = 0;
    let distance = 0;
    let speed = 4.2;
    let isGameOver = false;

    // Jogador (Animal)
    const petEmoji = this.app.pet && this.app.pet.species ? this.app.pet.species.emoji : '🐾';
    const player = {
      x: 50,
      y: 220,
      vy: 0,
      gravity: 0.62,
      jumpForce: -11.5,
      isGrounded: true,
      size: 32
    };

    // Obstáculos e Coletáveis
    const obstacles = [];
    const items = [];
    let spawnTimer = 0;

    const doJump = () => {
      if (player.isGrounded && !isGameOver) {
        player.vy = player.jumpForce;
        player.isGrounded = false;
        soundFx.playClick();
      }
    };

    canvas.onclick = doJump;
    canvas.ontouchstart = (e) => { e.preventDefault(); doJump(); };
    window.onkeydown = (e) => {
      if (e.code === 'Space' && this.currentTab === 'salto') {
        e.preventDefault();
        doJump();
      }
    };

    const runnerLoop = () => {
      if (isGameOver) return;

      distance++;
      if (this.dom.saltoDistanceDisplay) this.dom.saltoDistanceDisplay.textContent = Math.floor(distance / 10);
      if (this.dom.saltoScoreDisplay) this.dom.saltoScoreDisplay.textContent = coins;

      // Física do Pulo
      player.vy += player.gravity;
      player.y += player.vy;
      if (player.y >= 220) {
        player.y = 220;
        player.vy = 0;
        player.isGrounded = true;
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Fundo em camadas
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Solo do Bioma
      ctx.fillStyle = '#064e3b';
      ctx.fillRect(0, 252, canvas.width, 68);
      ctx.fillStyle = '#10b981';
      ctx.fillRect(0, 250, canvas.width, 4);

      // Gerador de Obstáculos (troncos, plásticos) e Moedas
      spawnTimer++;
      if (spawnTimer >= 65) {
        spawnTimer = 0;
        if (Math.random() < 0.65) {
          obstacles.push({
            x: canvas.width + 20,
            y: 228,
            emoji: Math.random() < 0.5 ? '🪵' : '🧴',
            size: 26
          });
        } else {
          items.push({
            x: canvas.width + 20,
            y: 160 + Math.random() * 40,
            emoji: '🪙',
            size: 22
          });
        }
      }

      // Desenha Jogador
      ctx.font = `${player.size}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(petEmoji, player.x, player.y);

      // Atualiza e desenha Coletáveis
      for (let i = items.length - 1; i >= 0; i--) {
        const it = items[i];
        it.x -= speed;
        ctx.font = `${it.size}px sans-serif`;
        ctx.fillText(it.emoji, it.x, it.y);

        // Colisão com Moeda
        if (Math.hypot(it.x - player.x, it.y - player.y) < 28) {
          coins += 2;
          soundFx.playCoin();
          items.splice(i, 1);
          continue;
        }

        if (it.x < -30) items.splice(i, 1);
      }

      // Atualiza e desenha Obstáculos
      for (let i = obstacles.length - 1; i >= 0; i--) {
        const obs = obstacles[i];
        obs.x -= speed;
        ctx.font = `${obs.size}px sans-serif`;
        ctx.fillText(obs.emoji, obs.x, obs.y);

        // Colisão com Obstáculo
        if (Math.hypot(obs.x - player.x, obs.y - player.y) < 26) {
          isGameOver = true;
          soundFx.playHurt();
          this.endSaltoGame(coins, Math.floor(distance / 10));
          return;
        }

        if (obs.x < -30) obstacles.splice(i, 1);
      }

      this.saltoFrameId = requestAnimationFrame(runnerLoop);
    };

    this.saltoFrameId = requestAnimationFrame(runnerLoop);
  }

  stopSaltoGame() {
    if (this.saltoFrameId) {
      cancelAnimationFrame(this.saltoFrameId);
      this.saltoFrameId = null;
    }
  }

  endSaltoGame(coins, dist) {
    this.stopSaltoGame();
    if (this.dom.saltoOverlay) this.dom.saltoOverlay.classList.remove('hidden');

    const totalCoins = coins + Math.floor(dist / 5);
    this.app.addCoins(totalCoins);

    if (this.app.pet) {
      this.app.pet.play(20, totalCoins);
      this.app.saveGame();
    }

    if (window.confetti) {
      window.confetti({ particleCount: 50, spread: 60, origin: { y: 0.6 } });
    }

    alert(`🏃 Fim da Corrida no Bioma!\n\nDistância percorrida: ${dist} metros\nMoedas coletadas: ${coins}\nRecompensa Total: +${totalCoins} Moedas Ecológicas!`);
  }

  // ==========================================
  // MINIGAME 4: RITMO DA NATUREZA (SIMON SAYS)
  // ==========================================
  startRitmoGame() {
    this.ritmoSequence = [];
    this.playerSequence = [];
    this.ritmoRound = 1;
    this.updateRitmoHUD();
    this.nextRitmoRound();
  }

  nextRitmoRound() {
    this.playerSequence = [];
    this.ritmoSequence.push(Math.floor(Math.random() * 4));
    this.updateRitmoHUD();
    this.playSequence();
  }

  async playSequence() {
    this.isShowingSequence = true;
    if (this.dom.ritmoStatusDisplay) this.dom.ritmoStatusDisplay.textContent = 'Ouça os Elementos...';

    await new Promise((r) => setTimeout(r, 600));

    for (let i = 0; i < this.ritmoSequence.length; i++) {
      const padIdx = this.ritmoSequence[i];
      await this.highlightPad(padIdx);
      await new Promise((r) => setTimeout(r, 300));
    }

    this.isShowingSequence = false;
    if (this.dom.ritmoStatusDisplay) this.dom.ritmoStatusDisplay.textContent = 'Sua vez de repetir!';
  }

  async highlightPad(index) {
    const pad = this.dom.ritmoPads[index];
    if (!pad) return;

    // Frequências harmônicas da natureza
    const freqs = [261.63, 329.63, 392.0, 523.25];
    soundFx.playTone(freqs[index], 0.25);

    pad.classList.add('ring-4', 'ring-white', 'scale-105', 'brightness-125');
    await new Promise((r) => setTimeout(r, 260));
    pad.classList.remove('ring-4', 'ring-white', 'scale-105', 'brightness-125');
  }

  handlePadPress(index) {
    if (this.isShowingSequence || this.ritmoSequence.length === 0) return;

    this.highlightPad(index);
    this.playerSequence.push(index);

    const currentIndex = this.playerSequence.length - 1;
    if (this.playerSequence[currentIndex] !== this.ritmoSequence[currentIndex]) {
      // Errou
      soundFx.playHurt();
      if (this.dom.ritmoStatusDisplay) this.dom.ritmoStatusDisplay.textContent = 'Sequência incorreta!';
      const reward = Math.max(5, (this.ritmoRound - 1) * 8);
      this.app.addCoins(reward);
      if (this.app.pet) {
        this.app.pet.play(15, reward);
        this.app.saveGame();
      }
      alert(`🎵 Melodia interrompida!\n\nVocê alcançou a Rodada ${this.ritmoRound}.\nRecompensa: +${reward} Moedas Ecológicas!`);
      this.ritmoSequence = [];
      return;
    }

    // Completou a rodada
    if (this.playerSequence.length === this.ritmoSequence.length) {
      soundFx.playCoin();
      this.ritmoRound++;
      if (this.dom.ritmoStatusDisplay) this.dom.ritmoStatusDisplay.textContent = 'Parabéns! Próxima rodada...';
      setTimeout(() => this.nextRitmoRound(), 900);
    }
  }

  updateRitmoHUD() {
    if (this.dom.ritmoRoundDisplay) this.dom.ritmoRoundDisplay.textContent = this.ritmoRound;
  }
}
