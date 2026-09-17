# 🐾 PetMaster - Santuário de Animais Virtuais (PWA)

PWA de criação, cuidados e reintrodução de animais na natureza com **35 espécies biológicas**, projetado para o curso **Técnico em Desenvolvimento de Sistemas**.

---

## 🌟 Funcionalidades Principais

- 🐣 **Ciclo de Vida Completo:** Incubação do Ovo $\rightarrow$ Filhote $\rightarrow$ Jovem $\rightarrow$ Adulto $\rightarrow$ Reintrodução no Santuário.
- 🧬 **35 Espécies Biológicas Reais:** 5 Classes (Mamíferos, Aves, Répteis, Anfíbios e Aquáticos), com metabolismo e dietas precisas.
- ⚡ **100% Offline-First:** Funciona sem sinal de internet via Service Worker e pode ser instalado na tela inicial do dispositivo móvel ou desktop.
- 🎵 **Áudio Procedural Nativo:** Zero arquivos de som pesados; síntese em tempo real usando a **Web Audio API**.
- 🎮 **Minigames em Canvas 2D:** "Chuva de Alimentos" e "Memória da Fauna" para ganho de XP e moedas ecológicas.
- 🌲 **Santuário Natural & Animaldex:** Catálogo didático e visualização dos animais protegidos em seus biomas.
- ☁️ **Persistência Dual-Mode:** LocalStorage imediato com suporte a backup `.json` + integração opcional com **Google Firebase (Auth + Cloud Firestore)**.
- 🎨 **5 Temas Visuais:** Santuário Esmeralda, Savana Sunset, Oceano Profundo, Neon Cyberpunk e Pastel Conforto.

---

## 🚀 Como Executar

Por ser uma aplicação web estática baseada em ES6 Modules e Service Workers, execute através de qualquer servidor HTTP local:

```bash
# Com Python 3:
python -m http.server 8080

# Com Node.js (npx serve):
npx serve .

# Ou com a extensão Live Server do VS Code / Antigravity
```

Acesse `http://localhost:8080` no navegador.
