/**
 * PetMaster - Conector Dual-Mode (Firebase Firestore + LocalStorage Fallback)
 * Compatível 100% com GitHub Pages e PWA Offline-First
 */

const STORAGE_FIREBASE_CONFIG = 'PETMASTER_FIREBASE_CONFIG';
const STORAGE_PET = 'PETMASTER_PET';
const STORAGE_SANCTUARY = 'PETMASTER_SANCTUARY';
const STORAGE_COINS = 'PETMASTER_COINS';
const STORAGE_INVENTORY = 'PETMASTER_INVENTORY';
const STORAGE_USER = 'PETMASTER_USER';

export class DualStorageDB {
  constructor() {
    this.firebaseApp = null;
    this.auth = null;
    this.firestore = null;
    this.isCloudEnabled = false;
    this.customConfig = this.loadConfig();
  }

  loadConfig() {
    try {
      const saved = localStorage.getItem(STORAGE_FIREBASE_CONFIG);
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      return null;
    }
  }

  saveConfig(config) {
    if (config && config.apiKey && config.projectId) {
      localStorage.setItem(STORAGE_FIREBASE_CONFIG, JSON.stringify(config));
      this.customConfig = config;
    } else {
      localStorage.removeItem(STORAGE_FIREBASE_CONFIG);
      this.customConfig = null;
    }
  }

  async init() {
    if (this.customConfig && this.customConfig.apiKey && this.customConfig.projectId) {
      try {
        const { initializeApp } = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js');
        const { getAuth } = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js');
        const { getFirestore } = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js');

        this.firebaseApp = initializeApp(this.customConfig);
        this.auth = getAuth(this.firebaseApp);
        this.firestore = getFirestore(this.firebaseApp);
        this.isCloudEnabled = true;
        console.log('✅ PetMaster Cloud Firestore inicializado com sucesso.');
        return;
      } catch (err) {
        console.warn('Falha ao inicializar Firebase com chaves informadas; operando em Modo Local:', err);
        this.isCloudEnabled = false;
      }
    }
    console.log('ℹ️ PetMaster operando em Modo de Persistência Local (LocalStorage 100% Offline).');
  }

  // Persistência do Pet Atual
  savePet(petData) {
    try {
      localStorage.setItem(STORAGE_PET, JSON.stringify(petData));
      if (this.isCloudEnabled && this.firestore && petData && petData.id) {
        // Sincronização em background no Firestore (se usuário logado)
        this.syncPetToCloud(petData).catch(() => {});
      }
    } catch (e) {
      console.warn('Erro ao salvar Pet localmente:', e);
    }
  }

  loadPet() {
    try {
      const data = localStorage.getItem(STORAGE_PET);
      return data ? JSON.parse(data) : null;
    } catch (e) {
      return null;
    }
  }

  // Persistência do Santuário / Coleção
  saveSanctuary(sanctuaryData) {
    try {
      localStorage.setItem(STORAGE_SANCTUARY, JSON.stringify(sanctuaryData));
      if (this.isCloudEnabled && this.firestore) {
        this.syncSanctuaryToCloud(sanctuaryData).catch(() => {});
      }
    } catch (e) {
      console.warn('Erro ao salvar Santuário localmente:', e);
    }
  }

  loadSanctuary() {
    try {
      const data = localStorage.getItem(STORAGE_SANCTUARY);
      return data ? JSON.parse(data) : null;
    } catch (e) {
      return null;
    }
  }

  // Moedas e Economia
  saveCoins(amount) {
    try {
      localStorage.setItem(STORAGE_COINS, String(amount));
    } catch (e) {}
  }

  loadCoins() {
    try {
      const val = localStorage.getItem(STORAGE_COINS);
      return val !== null ? parseInt(val, 10) : 100; // Começa com 100 moedas
    } catch (e) {
      return 100;
    }
  }

  // Inventário de itens
  saveInventory(inventory) {
    try {
      localStorage.setItem(STORAGE_INVENTORY, JSON.stringify(inventory));
    } catch (e) {}
  }

  loadInventory() {
    try {
      const data = localStorage.getItem(STORAGE_INVENTORY);
      return data ? JSON.parse(data) : {
        berry: 5,
        leaf: 5,
        insect: 3,
        soap: 3
      };
    } catch (e) {
      return { berry: 5, leaf: 5, insect: 3, soap: 3 };
    }
  }

  // Perfil de Usuário / Guardião
  saveUser(user) {
    try {
      localStorage.setItem(STORAGE_USER, JSON.stringify(user));
    } catch (e) {}
  }

  loadUser() {
    try {
      const data = localStorage.getItem(STORAGE_USER);
      return data ? JSON.parse(data) : null;
    } catch (e) {
      return null;
    }
  }

  // Sincronização assíncrona com Cloud Firestore
  async syncPetToCloud(petData) {
    if (!this.isCloudEnabled || !this.firestore) return;
    try {
      const { doc, setDoc } = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js');
      const petRef = doc(this.firestore, 'pets', petData.id);
      await setDoc(petRef, petData, { merge: true });
    } catch (e) {
      console.warn('Erro ao sincronizar Pet no Firestore:', e);
    }
  }

  async syncSanctuaryToCloud(sanctuaryData) {
    if (!this.isCloudEnabled || !this.firestore) return;
    try {
      const { doc, setDoc } = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js');
      const sancRef = doc(this.firestore, 'sanctuary', 'global_data');
      await setDoc(sancRef, sanctuaryData, { merge: true });
    } catch (e) {
      console.warn('Erro ao sincronizar Santuário no Firestore:', e);
    }
  }
}

export const db = new DualStorageDB();
