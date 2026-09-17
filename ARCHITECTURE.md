# 🐾 PetMaster - Documentação Arquitetural e de Engenharia

O **PetMaster** é uma Progressive Web App (PWA) de criação e preservação de animais virtuais com **35 espécies biológicas**, modelada segundo os padrões de gamificação MDA (*Mechanics, Dynamics, Aesthetics*) e engenharia de software para turmas de **Técnico em Desenvolvimento de Sistemas**.

---

## 🏛️ 1. Arquitetura de Sistemas

```
+-------------------------------------------------------------------------------+
|                            CAMADA DE APRESENTAÇÃO (UI/UX)                     |
|  [ Habitat / Pet Room ]  [ Santuário / Animaldex ]  [ Minigames ]  [ Loja/Mercado ] |
+-------------------------------------------------------------------------------+
                                      │
                                      ▼
+-------------------------------------------------------------------------------+
|                         CONTROLADOR CENTRAL (SPA APP)                         |
|                    Game Loop • Delta-Time Decay • State Machine               |
+-------------------------------------------------------------------------------+
         │                       │                      │
         ▼                       ▼                      ▼
┌───────────────────┐ ┌────────────────────┐ ┌──────────────────────────────────┐
│  MÓDULOS DE JOGO  │ │ MÓDULOS COMPARTILHO│ │   INFRAESTRUTURA & PERSISTÊNCIA  │
│ • pet.js (POO)    │ │ • shareManager.js  │ │ • firebaseConfig.js (Dual DB)    │
│ • speciesData.js  │ │ • qrcodeEngine.js  │ │ • offlineManager.js (PWA/Cache)  │
│ • minigames.js    │ │ • sanctuaryManager │ │ • authManager.js (Google/Guest)  │
│ • audio.js (Web)  │ │                    │ │ • LocalStorage / Backup JSON     │
│ • themeManager.js │ │                    │ │ • sw.js (Service Worker PWA)     │
└───────────────────┘ └────────────────────┘ └──────────────────────────────────┘
```

---

## ⚙️ 2. Módulos e Responsabilidades

1. **`pet.js` (POO & FSM):**
   * Encapsula a classe `Pet` com atributos vitais (Fome, Higiene, Energia, Alegria, Saúde).
   * Implementa a máquina de estados: `EGG`, `IDLE`, `EATING`, `BATHING`, `SLEEPING`, `PLAYING`, `SICK`, `CRITICAL`.
   * Suporta **cálculo de decaimento offline ponderado por delta-time** quando a aba ou aplicativo é reaberto.
2. **`speciesData.js` (Catálogo Taxonômico):**
   * 35 espécies divididas em 5 classes: Mamíferos, Aves, Répteis, Anfíbios e Aquáticos (7 de cada).
   * Atributos de dieta, bioma nativo, curiosidade biológica e multiplicadores de metabolismo.
3. **`audio.js` (Web Audio API):**
   * 100% sintetizado em tempo real por osciladores (`OscillatorNode`).
   * Zero arquivos externos `.mp3`/`.wav`, eliminando requisições de rede e consumo de armazenamento.
4. **`minigames.js` (Canvas 2D):**
   * Minigame "Chuva de Alimentos" com game loop a 60fps, detecção de colisão e spawn contínuo.
   * Minigame "Memória da Fauna" com lógica de correspondência de pares.
5. **`sanctuaryManager.js`:**
   * Animaldex completa com filtros por classe biológica.
   * Santuário vivo com visualização de espécimes adultos reintroduzidos nos biomas naturais.
6. **`firebaseConfig.js` (Dual-Mode Persistence):**
   * Modo Local padrão com `localStorage` e importação/exportação de backups JSON.
   * Conexão opcional com Google Cloud Firestore e Firebase Auth.
7. **`themeManager.js`:**
   * 5 temas visuais imersivos: *Santuário Esmeralda*, *Savana Sunset*, *Oceano Profundo*, *Neon Cyberpunk* e *Pastel Conforto*.
8. **`sw.js` (PWA Cache-First):**
   * Pré-carregamento dos ativos fundamentais para execução instantânea sem conexão de rede.

---

## 🎮 3. O Ciclo de Gamificação (MDA)

* **Incubação:** O jogador começa cuidando de um ovo no ninho através de calor e carinho.
* **Crescimento:** Filhote $\rightarrow$ Jovem $\rightarrow$ Adulto através do ganho de XP em cuidados e minigames.
* **Soltura Sustentável:** Ao atingir a maturidade com saúde plena, o animal é libertado em seu bioma nativo no Santuário, concedendo moedas de ouro e desbloqueando novos ninhos de espécies raras.
