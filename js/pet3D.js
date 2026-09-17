/**
 * PetMaster - Motor 3D Procedural & Sistema de Animação de Criaturas
 * Modelagem orgânica com Three.js (formas curvas e suaves, evitando estética voxel/Minecraft).
 * Suporta as 35 espécies (5 classes biológicas) e Ovo, com cenários de bioma, ciclo horário e gestos.
 */

export class Pet3DEngine {
  constructor(containerEl, app) {
    this.container = containerEl;
    this.app = app;
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.currentMeshGroup = null;
    this.biomeEnvironmentGroup = null;
    this.petData = null;
    this.particles = [];
    this.ambientParticles = [];
    this.eyesList = [];

    // Estado da animação procedimental
    this.animTime = 0;
    this.blinkTimer = 2.5;
    this.isBlinking = false;
    this.currentGesture = 'idle'; // 'idle', 'petting', 'jump', 'eating', 'bathing', 'sleeping', 'sad'
    this.gestureTimer = 0;

    // Período e Clima
    this.currentTimePeriod = 'day';
    this.currentWeather = 'clear';

    // Controles de rotação por toque/mouse
    this.isDragging = false;
    this.previousMousePosition = { x: 0, y: 0 };
    this.targetRotationY = 0;
    this.currentRotationY = 0;

    this.init();
  }

  init() {
    if (typeof THREE === 'undefined') {
      console.warn('Three.js não encontrado; mantendo visualização 2D.');
      return;
    }

    // 1. Criação da Cena
    this.scene = new THREE.Scene();

    // 2. Câmera Perspectiva
    const width = this.container.clientWidth || 340;
    const height = this.container.clientHeight || 340;
    this.camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 100);
    this.camera.position.set(0, 1.3, 4.4);
    this.camera.lookAt(0, 0.35, 0);

    // 3. WebGL Renderer
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.canvas = this.renderer.domElement;
    this.canvas.className = 'w-full h-full block cursor-grab active:cursor-grabbing select-none';
    this.container.innerHTML = '';
    this.container.appendChild(this.canvas);

    // 4. Iluminação
    this.setupLighting();

    // 5. Grupo de Cenário do Bioma
    this.biomeEnvironmentGroup = new THREE.Group();
    this.scene.add(this.biomeEnvironmentGroup);

    // 6. Controles de Toque e Mouse
    this.bindPointerEvents();

    // 7. Resize Observer
    this.resizeObserver = new ResizeObserver(() => this.handleResize());
    this.resizeObserver.observe(this.container);

    console.log('🐾 PetMaster 3D Engine Orgânico inicializado com sucesso.');
  }

  setupLighting() {
    this.ambientLight = new THREE.AmbientLight(0xffffff, 0.9);
    this.scene.add(this.ambientLight);

    this.dirLight = new THREE.DirectionalLight(0xffffff, 1.25);
    this.dirLight.position.set(4, 7, 5);
    this.dirLight.castShadow = true;
    this.dirLight.shadow.mapSize.width = 1024;
    this.dirLight.shadow.mapSize.height = 1024;
    this.dirLight.shadow.camera.near = 0.5;
    this.dirLight.shadow.camera.far = 16;
    this.scene.add(this.dirLight);

    // Luz de contorno suave (rim light)
    this.rimLight = new THREE.DirectionalLight(0x10b981, 0.5);
    this.rimLight.position.set(-4, 3, -4);
    this.scene.add(this.rimLight);
  }

  // ==========================================
  // CENÁRIO 3D ADAPTADO AO BIOMA DO ANIMAL
  // ==========================================
  setupBiomeEnvironment(biomeId = 'rainforest') {
    if (!this.biomeEnvironmentGroup) return;

    // Limpa cenário anterior
    this.disposeHierarchy(this.biomeEnvironmentGroup);
    while (this.biomeEnvironmentGroup.children.length > 0) {
      this.biomeEnvironmentGroup.remove(this.biomeEnvironmentGroup.children[0]);
    }

    // 1. Pedestal Base com relevo suave arredondado
    let groundColor = 0x064e3b; // Floresta
    let ringColor = 0x10b981;

    switch (biomeId) {
      case 'ocean':
      case 'coastal':
        groundColor = 0x0e7490; // Areia e recife azul-turquesa
        ringColor = 0x38bdf8;
        break;
      case 'savanna':
        groundColor = 0x78350f; // Terra avermelhada do cerrado
        ringColor = 0xf59e0b;
        break;
      case 'wetlands':
        groundColor = 0x065f46; // Várzea úmida
        ringColor = 0x34d399;
        break;
    }

    const pedestalGeo = new THREE.CylinderGeometry(1.65, 1.85, 0.16, 36);
    const pedestalMat = new THREE.MeshStandardMaterial({
      color: groundColor,
      roughness: 0.75,
      metalness: 0.08,
      flatShading: false
    });
    const pedestal = new THREE.Mesh(pedestalGeo, pedestalMat);
    pedestal.position.y = -0.55;
    pedestal.receiveShadow = true;
    this.biomeEnvironmentGroup.add(pedestal);

    // Anel Bioluminescente Suave
    const ringGeo = new THREE.RingGeometry(1.67, 1.76, 36);
    const ringMat = new THREE.MeshBasicMaterial({
      color: ringColor,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.55
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = -0.46;
    this.biomeEnvironmentGroup.add(ring);

    // 2. Elementos Cênicos Orgânicos do Bioma
    this.createBiomeDecorations(biomeId);
  }

  createBiomeDecorations(biomeId) {
    const group = this.biomeEnvironmentGroup;

    if (biomeId === 'ocean' || biomeId === 'coastal') {
      // Corais arredondados e Anêmonas
      const coralMat1 = this.createOrganicMaterial('#ec4899', 0.4, 0.0);
      const coralMat2 = this.createOrganicMaterial('#06b6d4', 0.3, 0.1);

      [-1.1, 1.15].forEach((x, idx) => {
        const coralBase = new THREE.Mesh(new THREE.SphereGeometry(0.24, 16, 16), idx === 0 ? coralMat1 : coralMat2);
        coralBase.position.set(x, -0.38, idx === 0 ? 0.6 : -0.5);
        coralBase.scale.set(1.0, 1.5, 1.0);
        group.add(coralBase);

        // Ramificações arredondadas
        for (let b = 0; b < 3; b++) {
          const branch = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.09, 0.32, 12), coralMat1);
          branch.position.set(x + (b - 1) * 0.12, -0.22, (idx === 0 ? 0.6 : -0.5) + (b % 2) * 0.1);
          branch.rotation.z = (b - 1) * 0.35;
          group.add(branch);
        }
      });
    } else if (biomeId === 'savanna') {
      // Tufos de Capim Dourado e Rocha do Cerrado
      const grassMat = this.createOrganicMaterial('#d97706', 0.8, 0.0);
      const rockMat = this.createOrganicMaterial('#b45309', 0.85, 0.05);

      const rock = new THREE.Mesh(new THREE.SphereGeometry(0.28, 14, 14), rockMat);
      rock.scale.set(1.4, 0.75, 1.1);
      rock.position.set(-1.1, -0.42, 0.4);
      group.add(rock);

      for (let i = 0; i < 4; i++) {
        const blade = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.45, 8), grassMat);
        blade.position.set(1.1 + (i - 1.5) * 0.1, -0.32, -0.2 + (i % 2) * 0.15);
        blade.rotation.z = (i - 1.5) * 0.18;
        group.add(blade);
      }
    } else if (biomeId === 'wetlands') {
      // Vitória-Régia e Relevo de Água
      const lilyMat = this.createOrganicMaterial('#10b981', 0.5, 0.05);
      const lilyPad = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.03, 24), lilyMat);
      lilyPad.position.set(1.0, -0.46, 0.5);
      group.add(lilyPad);

      // Flor da Vitória-Régia
      const flowerMat = this.createOrganicMaterial('#f472b6', 0.3, 0.0);
      const flower = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 12), flowerMat);
      flower.position.set(1.0, -0.41, 0.5);
      group.add(flower);
    } else {
      // Floresta Tropical / Amazônia: Samambaia e Folhagens Curvas
      const leafMat = this.createOrganicMaterial('#059669', 0.45, 0.0);
      const mossMat = this.createOrganicMaterial('#047857', 0.8, 0.0);

      const mossRock = new THREE.Mesh(new THREE.SphereGeometry(0.26, 16, 16), mossMat);
      mossRock.scale.set(1.3, 0.8, 1.1);
      mossRock.position.set(1.15, -0.42, 0.3);
      group.add(mossRock);

      // Folhas tropicais curvadas
      for (let i = 0; i < 3; i++) {
        const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 12), leafMat);
        leaf.scale.set(0.4, 0.08, 1.4);
        leaf.rotation.y = (i * Math.PI) / 3;
        leaf.rotation.x = -0.3;
        leaf.position.set(-1.0, -0.38, -0.4);
        group.add(leaf);
      }
    }
  }

  // ==========================================
  // MATERIAIS ORGÂNICOS SUAVES (ZERO MINECRAFT)
  // ==========================================
  createOrganicMaterial(colorHex, roughness = 0.45, metalness = 0.06) {
    return new THREE.MeshStandardMaterial({
      color: new THREE.Color(colorHex),
      roughness: roughness,
      metalness: metalness,
      flatShading: false // Suavização contínua de normais
    });
  }

  // Olhos expressivos com reflexo especular estilizado
  createCuteEye(x, y, z, parentGroup, scale = 1.0) {
    const eyeGroup = new THREE.Group();

    // 1. Globo ocular brilhante escuro
    const eyeMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.1,
      metalness: 0.15,
      flatShading: false
    });
    const eyeMesh = new THREE.Mesh(new THREE.SphereGeometry(0.09 * scale, 16, 16), eyeMat);
    eyeMesh.scale.set(1.0, 1.0, 0.7);
    eyeGroup.add(eyeMesh);

    // 2. Ponto de reflexo especular branco vivo (Glint)
    const glintMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const glint = new THREE.Mesh(new THREE.SphereGeometry(0.032 * scale, 10, 10), glintMat);
    glint.position.set(0.03 * scale, 0.032 * scale, 0.055 * scale);
    eyeGroup.add(glint);

    // Segundo pequeno brilho secundário
    const subGlint = new THREE.Mesh(new THREE.SphereGeometry(0.018 * scale, 8, 8), glintMat);
    subGlint.position.set(-0.02 * scale, -0.025 * scale, 0.05 * scale);
    eyeGroup.add(subGlint);

    eyeGroup.position.set(x, y, z);
    parentGroup.add(eyeGroup);

    this.eyesList.push(eyeGroup);
    return eyeGroup;
  }

  // ==========================================
  // CONSTRUTOR DE CRIATURAS ORGÂNICAS 3D
  // ==========================================
  buildPet(pet) {
    if (!this.scene || !pet) return;

    this.petData = pet;
    this.currentStage = pet.stage;
    this.currentSpeciesId = pet.species ? pet.species.id : null;
    this.eyesList = [];

    // Limpa malha anterior
    if (this.currentMeshGroup) {
      this.disposeHierarchy(this.currentMeshGroup);
      this.scene.remove(this.currentMeshGroup);
      this.currentMeshGroup = null;
    }

    const species = pet.species;

    // Atualiza o cenário com o bioma específico da espécie
    this.setupBiomeEnvironment(species.biome || 'rainforest');

    // 1. OVO ORGÂNICO
    if (pet.stage === 'egg') {
      this.currentMeshGroup = this.createEggMesh(species);
    } else {
      // 2. CRIATURA ORGÂNICA POR CLASSE BIOLÓGICA
      switch (species.class) {
        case 'Aves':
          this.currentMeshGroup = this.createBirdMesh(species, pet.stage);
          break;
        case 'Répteis':
          this.currentMeshGroup = this.createReptileMesh(species, pet.stage);
          break;
        case 'Anfíbios':
          this.currentMeshGroup = this.createAmphibianMesh(species, pet.stage);
          break;
        case 'Aquáticos':
          this.currentMeshGroup = this.createAquaticMesh(species, pet.stage);
          break;
        default: // Mamíferos
          this.currentMeshGroup = this.createMammalMesh(species, pet.stage);
          break;
      }
    }

    // Escala proporcional ao estágio de crescimento
    let scale = 1.0;
    if (pet.stage === 'baby') scale = 0.78;
    else if (pet.stage === 'teen') scale = 0.96;
    else if (pet.stage === 'adult') scale = 1.22;

    this.currentMeshGroup.scale.set(scale, scale, scale);
    this.currentMeshGroup.position.set(0, 0, 0);
    this.scene.add(this.currentMeshGroup);
  }

  // --- MODELO 1: OVO ORGÂNICO ---
  createEggMesh(species) {
    const group = new THREE.Group();

    // Geometria de Ovo Suave Tapered
    const eggGeo = new THREE.SphereGeometry(0.76, 32, 32);
    const pos = eggGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      let y = pos.getY(i);
      let factor = 1.0 - y * 0.22;
      pos.setX(i, pos.getX(i) * factor);
      pos.setZ(i, pos.getZ(i) * factor);
    }
    eggGeo.computeVertexNormals();

    const eggColor = species.eggColor || '#10b981';
    const eggMat = this.createOrganicMaterial(eggColor, 0.32, 0.12);
    const eggMesh = new THREE.Mesh(eggGeo, eggMat);
    eggMesh.castShadow = true;
    eggMesh.receiveShadow = true;
    eggMesh.position.y = 0.32;
    group.add(eggMesh);

    // Ninho suave arredondado
    const nestGeo = new THREE.TorusGeometry(0.68, 0.22, 16, 32);
    const nestMat = this.createOrganicMaterial('#78350f', 0.88, 0.0);
    const nest = new THREE.Mesh(nestGeo, nestMat);
    nest.rotation.x = Math.PI / 2;
    nest.position.y = -0.34;
    nest.castShadow = true;
    group.add(nest);

    group.userData = { type: 'egg', eggMesh };
    return group;
  }

  // --- MODELO 2: MAMÍFEROS ORGÂNICOS (Capivara, Lobo, Onça, Mico) ---
  createMammalMesh(species, stage) {
    const group = new THREE.Group();
    const mainColor = species.eggColor || '#d97706';

    const matBody = this.createOrganicMaterial(mainColor, 0.52, 0.05);
    const matBelly = this.createOrganicMaterial('#fef3c7', 0.55, 0.05);
    const matNose = this.createOrganicMaterial('#291807', 0.3, 0.2);

    // 1. Tronco Arredondado Orgânico (Sem caixas)
    const bodyGeo = new THREE.SphereGeometry(0.72, 24, 24);
    const body = new THREE.Mesh(bodyGeo, matBody);
    body.scale.set(0.95, 0.88, 1.35);
    body.position.set(0, 0.28, 0);
    body.castShadow = true;
    group.add(body);

    // Barriga Clara Suave
    const bellyGeo = new THREE.SphereGeometry(0.68, 20, 20);
    const belly = new THREE.Mesh(bellyGeo, matBelly);
    belly.scale.set(0.88, 0.75, 1.25);
    belly.position.set(0, 0.2, 0.1);
    group.add(belly);

    // 2. Cabeça Arredondada com Bochechas Fofas
    const headGroup = new THREE.Group();
    const headGeo = new THREE.SphereGeometry(0.56, 24, 24);
    const head = new THREE.Mesh(headGeo, matBody);
    head.scale.set(1.0, 0.95, 1.15);
    head.castShadow = true;
    headGroup.add(head);

    // Bochechas macias laterais
    [-0.32, 0.32].forEach((x) => {
      const cheekGeo = new THREE.SphereGeometry(0.24, 16, 16);
      const cheek = new THREE.Mesh(cheekGeo, matBelly);
      cheek.scale.set(0.9, 0.8, 1.1);
      cheek.position.set(x, -0.1, 0.2);
      headGroup.add(cheek);
    });

    // Focinho arredondado
    const snoutGeo = new THREE.SphereGeometry(0.32, 18, 18);
    const snout = new THREE.Mesh(snoutGeo, matBelly);
    snout.scale.set(0.9, 0.75, 1.2);
    snout.position.set(0, -0.12, 0.45);
    snout.castShadow = true;
    headGroup.add(snout);

    // Nariz suave
    const noseGeo = new THREE.SphereGeometry(0.12, 14, 14);
    const nose = new THREE.Mesh(noseGeo, matNose);
    nose.scale.set(1.2, 0.8, 1.0);
    nose.position.set(0, -0.06, 0.74);
    headGroup.add(nose);

    // Olhos Expressivos com Reflexo
    this.createCuteEye(-0.25, 0.16, 0.48, headGroup, 1.0);
    this.createCuteEye(0.25, 0.16, 0.48, headGroup, 1.0);

    // Orelhas Macias Curvas
    [-0.34, 0.34].forEach((x) => {
      const earGeo = new THREE.SphereGeometry(0.18, 16, 16);
      const ear = new THREE.Mesh(earGeo, matBody);
      ear.scale.set(0.7, 1.3, 0.4);
      ear.position.set(x, 0.42, -0.05);
      ear.rotation.z = x > 0 ? -0.35 : 0.35;
      headGroup.add(ear);
    });

    headGroup.position.set(0, 0.68, 0.65);
    group.add(headGroup);

    // 3. Quatro Patas Curvas Arredondadas
    const legs = [];
    const legPositions = [
      { x: -0.36, z: 0.42 },
      { x: 0.36, z: 0.42 },
      { x: -0.38, z: -0.42 },
      { x: 0.38, z: -0.42 }
    ];

    legPositions.forEach((p) => {
      const legGroup = new THREE.Group();
      const legGeo = new THREE.CylinderGeometry(0.14, 0.16, 0.52, 16);
      const leg = new THREE.Mesh(legGeo, matBody);
      leg.position.y = -0.12;
      leg.castShadow = true;
      legGroup.add(leg);

      // Pata arredondada na ponta
      const pawGeo = new THREE.SphereGeometry(0.17, 14, 14);
      const paw = new THREE.Mesh(pawGeo, matBody);
      paw.scale.set(1.0, 0.65, 1.25);
      paw.position.set(0, -0.34, 0.05);
      legGroup.add(paw);

      legGroup.position.set(p.x, -0.08, p.z);
      group.add(legGroup);
      legs.push(legGroup);
    });

    // 4. Cauda Articulada Orgânica
    const tailGroup = new THREE.Group();
    for (let s = 0; s < 4; s++) {
      const segmentGeo = new THREE.SphereGeometry(0.11 - s * 0.02, 12, 12);
      const segment = new THREE.Mesh(segmentGeo, matBody);
      segment.position.set(0, s * 0.12, -s * 0.14);
      tailGroup.add(segment);
    }
    tailGroup.position.set(0, 0.28, -0.85);
    group.add(tailGroup);

    group.userData = { type: 'mammal', body, headGroup, legs, tailGroup };
    return group;
  }

  // --- MODELO 3: AVES ORGÂNICAS (Arara, Tucano, Coruja) ---
  createBirdMesh(species, stage) {
    const group = new THREE.Group();
    const color = species.eggColor || '#2563eb';

    const matFeather = this.createOrganicMaterial(color, 0.45, 0.08);
    const matBelly = this.createOrganicMaterial('#fef08a', 0.5, 0.05);
    const matBeak = this.createOrganicMaterial('#f97316', 0.3, 0.15);
    const matLegs = this.createOrganicMaterial('#f59e0b', 0.5, 0.1);

    // 1. Corpo em Forma de Gota Suave
    const bodyGeo = new THREE.SphereGeometry(0.65, 24, 24);
    const body = new THREE.Mesh(bodyGeo, matFeather);
    body.scale.set(0.85, 1.1, 1.0);
    body.position.set(0, 0.32, 0);
    body.castShadow = true;
    group.add(body);

    // Peito / Papo Claro
    const bellyGeo = new THREE.SphereGeometry(0.58, 20, 20);
    const belly = new THREE.Mesh(bellyGeo, matBelly);
    belly.scale.set(0.75, 0.95, 0.85);
    belly.position.set(0, 0.25, 0.22);
    group.add(belly);

    // 2. Cabeça Arredondada
    const headGroup = new THREE.Group();
    const headGeo = new THREE.SphereGeometry(0.46, 20, 20);
    const head = new THREE.Mesh(headGeo, matFeather);
    head.castShadow = true;
    headGroup.add(head);

    // Bico Curvo Polido
    const beakGeo = new THREE.ConeGeometry(0.18, 0.68, 16);
    const beak = new THREE.Mesh(beakGeo, matBeak);
    beak.rotation.x = Math.PI / 2.15;
    beak.position.set(0, -0.06, 0.55);
    beak.castShadow = true;
    headGroup.add(beak);

    // Olhos Expressivos
    this.createCuteEye(-0.25, 0.14, 0.32, headGroup, 0.9);
    this.createCuteEye(0.25, 0.14, 0.32, headGroup, 0.9);

    headGroup.position.set(0, 0.88, 0.35);
    group.add(headGroup);

    // 3. Asas Aerodinâmicas Dobradas
    const wings = [];
    [-0.56, 0.56].forEach((x) => {
      const wingGeo = new THREE.SphereGeometry(0.48, 16, 16);
      const wing = new THREE.Mesh(wingGeo, matFeather);
      wing.scale.set(0.22, 0.95, 0.6);
      wing.position.set(x, 0.38, -0.05);
      wing.rotation.z = x > 0 ? -0.22 : 0.22;
      wing.castShadow = true;
      group.add(wing);
      wings.push(wing);
    });

    // 4. Pernas Suaves com Garrinhas
    const legs = [];
    [-0.18, 0.18].forEach((x) => {
      const legGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.45, 12);
      const leg = new THREE.Mesh(legGeo, matLegs);
      leg.position.set(x, -0.22, -0.02);
      leg.castShadow = true;
      group.add(leg);
      legs.push(leg);
    });

    group.userData = { type: 'bird', body, headGroup, wings, legs };
    return group;
  }

  // --- MODELO 4: RÉPTEIS ORGÂNICOS (Tartaruga, Camaleão, Jacaré) ---
  createReptileMesh(species, stage) {
    const group = new THREE.Group();
    const color = species.eggColor || '#15803d';

    const matSkin = this.createOrganicMaterial(color, 0.55, 0.1);
    const matShell = this.createOrganicMaterial('#064e3b', 0.65, 0.08);

    // 1. Corpo Elipsoidal Suave
    const bodyGeo = new THREE.SphereGeometry(0.72, 22, 22);
    const body = new THREE.Mesh(bodyGeo, matSkin);
    body.scale.set(1.05, 0.65, 1.45);
    body.position.set(0, 0.15, 0);
    body.castShadow = true;
    group.add(body);

    // Carapaça Cúpula Curva (Se for tartaruga)
    if (species.id === 'green_turtle') {
      const shellGeo = new THREE.SphereGeometry(0.82, 24, 24);
      const shell = new THREE.Mesh(shellGeo, matShell);
      shell.scale.set(1.02, 0.62, 1.25);
      shell.position.set(0, 0.38, -0.05);
      shell.castShadow = true;
      group.add(shell);
    }

    // 2. Cabeça Arredondada
    const headGroup = new THREE.Group();
    const headGeo = new THREE.SphereGeometry(0.48, 20, 20);
    const head = new THREE.Mesh(headGeo, matSkin);
    head.scale.set(0.9, 0.8, 1.2);
    head.castShadow = true;
    headGroup.add(head);

    // Olhos Expressivos
    this.createCuteEye(-0.24, 0.18, 0.28, headGroup, 0.95);
    this.createCuteEye(0.24, 0.18, 0.28, headGroup, 0.95);

    headGroup.position.set(0, 0.32, 0.95);
    group.add(headGroup);

    // 3. Cauda Sinuosa Cônica Suave
    const tailGeo = new THREE.ConeGeometry(0.25, 1.35, 16);
    const tail = new THREE.Mesh(tailGeo, matSkin);
    tail.rotation.x = -Math.PI / 2.15;
    tail.position.set(0, 0.12, -1.35);
    tail.castShadow = true;
    group.add(tail);

    // 4. Quatro Patas Curvas Rastejantes
    const legs = [];
    [
      { x: -0.54, z: 0.45 },
      { x: 0.54, z: 0.45 },
      { x: -0.54, z: -0.45 },
      { x: 0.54, z: -0.45 }
    ].forEach((p) => {
      const legGeo = new THREE.SphereGeometry(0.22, 14, 14);
      const leg = new THREE.Mesh(legGeo, matSkin);
      leg.scale.set(1.4, 0.7, 1.1);
      leg.position.set(p.x, -0.04, p.z);
      leg.castShadow = true;
      group.add(leg);
      legs.push(leg);
    });

    group.userData = { type: 'reptile', body, headGroup, tail, legs };
    return group;
  }

  // --- MODELO 5: ANFÍBIOS ORGÂNICOS (Sapo-Cururu, Perereca, Axolote) ---
  createAmphibianMesh(species, stage) {
    const group = new THREE.Group();
    const color = species.eggColor || '#10b981';

    // Pele lustrosa / úmida
    const matSkin = this.createOrganicMaterial(color, 0.18, 0.12);
    const matBelly = this.createOrganicMaterial('#fef9c3', 0.25, 0.08);

    // 1. Corpo Roliço Arredondado
    const bodyGeo = new THREE.SphereGeometry(0.72, 24, 24);
    const body = new THREE.Mesh(bodyGeo, matSkin);
    body.scale.set(1.15, 0.82, 1.3);
    body.position.set(0, 0.2, 0);
    body.castShadow = true;
    group.add(body);

    // Barriga Suave
    const bellyGeo = new THREE.SphereGeometry(0.65, 20, 20);
    const belly = new THREE.Mesh(bellyGeo, matBelly);
    belly.scale.set(1.05, 0.7, 1.18);
    belly.position.set(0, 0.12, 0.15);
    group.add(belly);

    // 2. Cabeça Integrada com Olhos Grandes Saltados no Topo
    const headGroup = new THREE.Group();
    [-0.32, 0.32].forEach((x) => {
      // Base da órbita saltada
      const orbitGeo = new THREE.SphereGeometry(0.22, 16, 16);
      const orbit = new THREE.Mesh(orbitGeo, matSkin);
      orbit.position.set(x, 0.42, 0.38);
      headGroup.add(orbit);

      // Olho expressivo no cume
      this.createCuteEye(x, 0.46, 0.46, headGroup, 1.15);
    });

    // Se for Axolote, brânquias externas ramificadas
    const gills = [];
    if (species.id === 'axolotl') {
      const matGills = this.createOrganicMaterial('#f43f5e', 0.3, 0.0);
      [-0.48, 0.48].forEach((x) => {
        for (let g = 0; g < 3; g++) {
          const gillGeo = new THREE.CylinderGeometry(0.04, 0.07, 0.42, 12);
          const gill = new THREE.Mesh(gillGeo, matGills);
          gill.position.set(x, 0.28 + g * 0.14, 0.2 - g * 0.08);
          gill.rotation.z = x > 0 ? -Math.PI / 3 : Math.PI / 3;
          group.add(gill);
          gills.push(gill);
        }
      });
    }

    headGroup.position.set(0, 0.1, 0.15);
    group.add(headGroup);

    // 3. Pernas Traseiras Curvadas para Pulo
    const legs = [];
    [-0.52, 0.52].forEach((x) => {
      const legGeo = new THREE.SphereGeometry(0.28, 16, 16);
      const leg = new THREE.Mesh(legGeo, matSkin);
      leg.scale.set(0.8, 1.2, 1.5);
      leg.position.set(x, 0.12, -0.32);
      leg.rotation.z = x > 0 ? -0.3 : 0.3;
      group.add(leg);
      legs.push(leg);
    });

    group.userData = { type: 'amphibian', body, headGroup, gills, legs };
    return group;
  }

  // --- MODELO 6: AQUÁTICOS ORGÂNICOS (Boto, Golfinho, Peixe-Boi) ---
  createAquaticMesh(species, stage) {
    const group = new THREE.Group();
    const color = species.eggColor || '#0284c7';

    const matSkin = this.createOrganicMaterial(color, 0.22, 0.14);
    const matBelly = this.createOrganicMaterial('#f0f9ff', 0.28, 0.08);
    const matFin = this.createOrganicMaterial(color, 0.25, 0.1);

    // 1. Corpo Fusiforme Hidrodinâmico Curvado
    const bodyGeo = new THREE.SphereGeometry(0.68, 24, 24);
    const body = new THREE.Mesh(bodyGeo, matSkin);
    body.scale.set(0.72, 0.78, 1.85);
    body.position.set(0, 0.25, 0);
    body.castShadow = true;
    group.add(body);

    // Ventre Claro
    const bellyGeo = new THREE.SphereGeometry(0.62, 20, 20);
    const belly = new THREE.Mesh(bellyGeo, matBelly);
    belly.scale.set(0.65, 0.65, 1.7);
    belly.position.set(0, 0.15, 0.05);
    group.add(belly);

    // 2. Barbatana Dorsal Curva
    const dorsalGeo = new THREE.ConeGeometry(0.26, 0.75, 16);
    const dorsal = new THREE.Mesh(dorsalGeo, matFin);
    dorsal.rotation.x = -Math.PI / 3;
    dorsal.position.set(0, 0.85, -0.25);
    dorsal.castShadow = true;
    group.add(dorsal);

    // 3. Barbatana Caudal Articulada (Flukes)
    const tailGroup = new THREE.Group();
    const flukeGeo = new THREE.SphereGeometry(0.38, 16, 16);
    const flukes = new THREE.Mesh(flukeGeo, matFin);
    flukes.scale.set(1.9, 0.12, 0.75);
    flukes.position.set(0, 0, -0.35);
    tailGroup.add(flukes);

    tailGroup.position.set(0, 0.25, -1.35);
    group.add(tailGroup);

    // 4. Nadadeiras Peitorais Suaves
    const fins = [];
    [-0.55, 0.55].forEach((x) => {
      const finGeo = new THREE.SphereGeometry(0.35, 14, 14);
      const fin = new THREE.Mesh(finGeo, matFin);
      fin.scale.set(0.9, 0.12, 0.55);
      fin.position.set(x, 0.15, 0.35);
      fin.rotation.z = x > 0 ? -0.32 : 0.32;
      group.add(fin);
      fins.push(fin);
    });

    // Olhos Expressivos
    this.createCuteEye(-0.35, 0.35, 0.85, group, 0.95);
    this.createCuteEye(0.35, 0.35, 0.85, group, 0.95);

    group.userData = { type: 'aquatic', body, tailGroup, fins };
    return group;
  }

  // ==========================================
  // ATUALIZAÇÃO DO CLIMA E PERÍODO DO DIA 3D
  // ==========================================
  updateTimeAndWeather(timePeriod = 'day', weatherType = 'clear') {
    this.currentTimePeriod = timePeriod;
    this.currentWeather = weatherType;

    if (!this.ambientLight || !this.dirLight) return;

    let ambColor = 0xffffff;
    let ambIntensity = 0.9;
    let dirColor = 0xffffff;
    let dirIntensity = 1.25;

    switch (timePeriod) {
      case 'dawn': // Alvorecer (Tons dourados e rosados suaves)
        ambColor = 0xffedd5;
        ambIntensity = 0.82;
        dirColor = 0xfb923c;
        dirIntensity = 1.15;
        break;
      case 'day': // Dia pleno natural
        ambColor = 0xffffff;
        ambIntensity = 0.95;
        dirColor = 0xfef08a;
        dirIntensity = 1.3;
        break;
      case 'sunset': // Entardecer (Âmbar e violeta dourado)
        ambColor = 0xfecdd3;
        ambIntensity = 0.78;
        dirColor = 0xf43f5e;
        dirIntensity = 1.2;
        break;
      case 'night': // Noite (Índigo e azul-marinho estrelado)
      case 'midnight':
        ambColor = 0x312e81;
        ambIntensity = 0.45;
        dirColor = 0x818cf8;
        dirIntensity = 0.55;
        break;
    }

    this.ambientLight.color.setHex(ambColor);
    this.ambientLight.intensity = ambIntensity;
    this.dirLight.color.setHex(dirColor);
    this.dirLight.intensity = dirIntensity;

    // Dispara partículas ambientais (vaga-lumes à noite, pólen de dia)
    this.spawnAmbientAtmosphere();
  }

  spawnAmbientAtmosphere() {
    if (this.ambientParticles.length > 15) return;

    const isNight = this.currentTimePeriod === 'night' || this.currentTimePeriod === 'midnight';
    const pColor = isNight ? 0xa7f3d0 : 0xfef08a;

    const mat = new THREE.MeshBasicMaterial({
      color: pColor,
      transparent: true,
      opacity: 0.6
    });
    const p = new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 6), mat);
    p.position.set((Math.random() - 0.5) * 2.8, Math.random() * 1.8 - 0.2, (Math.random() - 0.5) * 2.8);
    p.userData = {
      baseY: p.position.y,
      speed: 0.8 + Math.random() * 0.8,
      life: 8.0
    };
    this.scene.add(p);
    this.ambientParticles.push(p);
  }

  // ==========================================
  // DISPARO DE GESTOS ESPECIAIS
  // ==========================================
  playGesture(type) {
    this.currentGesture = type;
    this.gestureTimer = 2.0;

    if (type === 'jump') {
      this.spawnSparkleParticles();
    } else if (type === 'petting') {
      this.spawnHeartParticles();
    } else if (type === 'bathing') {
      for (let i = 0; i < 4; i++) this.spawnBubbleParticle();
    }
  }

  // ==========================================
  // LOOP DE ANIMAÇÃO PROCEDURAL (60 FPS)
  // ==========================================
  update(deltaTime) {
    if (!this.renderer || !this.scene) return;

    this.animTime += deltaTime;
    const t = this.animTime;
    const pData = this.app.pet;

    // 1. Interpolação suave de rotação (Orbit damping)
    this.currentRotationY += (this.targetRotationY - this.currentRotationY) * 0.12;
    if (this.currentMeshGroup) {
      this.currentMeshGroup.rotation.y = this.currentRotationY;
    }

    // 2. Temporizador do gesto ativo
    if (this.gestureTimer > 0) {
      this.gestureTimer -= deltaTime;
      if (this.gestureTimer <= 0) {
        this.currentGesture = 'idle';
      }
    }

    // 3. Sistema de Piscar de Olhos Natural (Blink Controller)
    this.blinkTimer -= deltaTime;
    if (this.blinkTimer <= 0) {
      this.isBlinking = true;
      if (this.blinkTimer <= -0.15) {
        this.isBlinking = false;
        this.blinkTimer = 3.2 + Math.random() * 2.5; // próximo piscar em 3 a 5 segundos
      }
    }
    const eyeScaleY = this.isBlinking ? 0.08 : 1.0;
    this.eyesList.forEach((eye) => {
      eye.scale.y += (eyeScaleY - eye.scale.y) * 0.4;
    });

    // 4. Animação cinemática por classe
    if (this.currentMeshGroup && pData) {
      const state = this.currentGesture !== 'idle' ? this.currentGesture : pData.state;
      const u = this.currentMeshGroup.userData;

      if (u.type === 'egg') {
        this.animateEgg(u, state, t);
      } else if (u.type === 'mammal') {
        this.animateMammal(u, state, t);
      } else if (u.type === 'bird') {
        this.animateBird(u, state, t);
      } else if (u.type === 'reptile') {
        this.animateReptile(u, state, t);
      } else if (u.type === 'amphibian') {
        this.animateAmphibian(u, state, t);
      } else if (u.type === 'aquatic') {
        this.animateAquatic(u, state, t);
      }
    }

    // Atualiza partículas 3D e atmosfera
    this.updateParticles(deltaTime);
    this.updateAtmosphere(deltaTime);

    // Renderiza o frame WebGL
    this.renderer.render(this.scene, this.camera);
  }

  animateEgg(u, state, t) {
    if (!u.eggMesh) return;
    const breathe = Math.sin(t * 2.5) * 0.04;
    u.eggMesh.scale.set(1.0 + breathe, 1.0 - breathe * 0.5, 1.0 + breathe);
    u.eggMesh.rotation.z = Math.sin(t * 3.0) * 0.06;

    if (this.currentGesture === 'petting') {
      u.eggMesh.rotation.z += (Math.random() - 0.5) * 0.25;
      u.eggMesh.position.y = 0.35 + Math.abs(Math.sin(t * 12)) * 0.08;
    } else {
      u.eggMesh.position.y = 0.32;
    }
  }

  animateMammal(u, state, t) {
    // Respiração suave com dilatação torácica
    const breathe = Math.sin(t * 2.8) * 0.028;
    u.body.scale.set(0.95 + breathe, 0.88 + breathe * 1.4, 1.35 - breathe);

    // Abanar de rabo suave
    if (u.tailGroup) {
      u.tailGroup.rotation.y = Math.sin(t * 4.2) * 0.35;
      u.tailGroup.rotation.x = Math.sin(t * 2.0) * 0.1;
    }

    switch (state) {
      case 'petting':
        // Inclina a cabeça com prazer e abana o rabo rápido
        u.headGroup.rotation.z = Math.sin(t * 8) * 0.15;
        u.headGroup.rotation.x = -0.2;
        if (u.tailGroup) u.tailGroup.rotation.y = Math.sin(t * 14) * 0.7;
        break;

      case 'jump':
      case 'happy':
      case 'playing':
        const bounce = Math.abs(Math.sin(t * 7)) * 0.55;
        this.currentMeshGroup.position.y = bounce;
        u.headGroup.rotation.x = -0.18;
        if (u.legs && u.legs.length === 4) {
          u.legs[0].rotation.x = Math.sin(t * 14) * 0.5;
          u.legs[1].rotation.x = -Math.sin(t * 14) * 0.5;
        }
        break;

      case 'eating':
        u.headGroup.rotation.x = Math.sin(t * 12) * 0.22 + 0.25;
        u.headGroup.position.y = 0.62 + Math.sin(t * 12) * 0.06;
        break;

      case 'bathing':
        // Sacudida de banho vigorosa
        u.body.rotation.y = Math.sin(t * 18) * 0.3;
        u.headGroup.rotation.z = Math.sin(t * 20) * 0.2;
        this.spawnBubbleParticle();
        break;

      case 'sleeping':
        // Deitado suavemente encolhido no pedestal
        this.currentMeshGroup.position.y = -0.15;
        u.headGroup.position.set(0, 0.35, 0.55);
        u.headGroup.rotation.x = 0.35;
        break;

      case 'sad':
      case 'sick':
      case 'critical':
        u.headGroup.rotation.x = 0.38;
        u.headGroup.position.y = 0.55;
        this.currentMeshGroup.position.y = -0.05;
        break;

      case 'deceased':
        // Deitado serenamente em descanso eterno
        this.currentMeshGroup.position.y = -0.22;
        this.currentMeshGroup.rotation.z = 1.35;
        this.currentMeshGroup.rotation.x = -0.25;
        u.headGroup.rotation.x = 0.5;
        break;

      default: // Idle natural
        u.headGroup.rotation.y = Math.sin(t * 1.3) * 0.14;
        u.headGroup.rotation.x = Math.cos(t * 0.9) * 0.07;
        this.currentMeshGroup.position.y = 0;
        break;
    }
  }

  animateBird(u, state, t) {
    const breathe = Math.sin(t * 3.2) * 0.035;
    u.body.scale.set(0.85 + breathe, 1.1 + breathe, 1.0);

    if (u.wings) {
      const wingIdle = Math.sin(t * 4.5) * 0.15;
      u.wings[0].rotation.z = -0.22 - wingIdle;
      u.wings[1].rotation.z = 0.22 + wingIdle;
    }

    if (state === 'jump' || state === 'playing') {
      this.currentMeshGroup.position.y = Math.abs(Math.sin(t * 8)) * 0.7;
      if (u.wings) {
        const rapidFlap = Math.sin(t * 24) * 0.85;
        u.wings[0].rotation.z = -rapidFlap;
        u.wings[1].rotation.z = rapidFlap;
      }
    } else if (state === 'petting') {
      u.headGroup.rotation.z = Math.sin(t * 7) * 0.18;
    } else if (state === 'eating') {
      u.headGroup.position.y = 0.75 + Math.sin(t * 14) * 0.12;
      u.headGroup.rotation.x = 0.42;
    }
  }

  animateReptile(u, state, t) {
    if (u.tail) {
      u.tail.rotation.y = Math.sin(t * 3.2) * 0.4;
    }

    if (state === 'jump' || state === 'playing') {
      this.currentMeshGroup.position.y = Math.abs(Math.sin(t * 6)) * 0.35;
    } else if (state === 'petting') {
      u.headGroup.rotation.x = -0.15;
    }
  }

  animateAmphibian(u, state, t) {
    // Inflar o papo da garganta
    const throatPulse = Math.sin(t * 4.2) * 0.09;
    u.body.scale.set(1.15 + throatPulse, 0.82 + throatPulse * 1.5, 1.3);

    if (u.gills) {
      u.gills.forEach((g, i) => {
        g.rotation.x = Math.sin(t * 4 + i) * 0.18;
      });
    }

    if (state === 'jump' || state === 'playing') {
      this.currentMeshGroup.position.y = Math.abs(Math.sin(t * 6)) * 0.65;
    }
  }

  animateAquatic(u, state, t) {
    const swimWave = Math.sin(t * 4.2);
    this.currentMeshGroup.position.y = Math.sin(t * 2.8) * 0.12;

    if (u.tailGroup) {
      u.tailGroup.rotation.y = swimWave * 0.55;
    }
    if (u.fins) {
      u.fins[0].rotation.x = Math.cos(t * 4) * 0.32;
      u.fins[1].rotation.x = Math.cos(t * 4) * 0.32;
    }

    if (state === 'jump' || state === 'playing') {
      this.currentMeshGroup.position.y = 0.55 + Math.sin(t * 6) * 0.45;
      this.currentMeshGroup.rotation.x = Math.sin(t * 6) * 0.55;
    } else {
      this.currentMeshGroup.rotation.x = 0;
    }
  }

  // ==========================================
  // CARINHO INTERATIVO E GESTOS DE TOQUE
  // ==========================================
  triggerAffectionGesture() {
    if (this.app && this.app.pet && this.app.pet.state === 'deceased') {
      if (this.app.openDeceasedModal) {
        this.app.openDeceasedModal();
      }
      return;
    }

    this.playGesture('petting');

    if (this.app && this.app.pet) {
      if (this.app.pet.stage === 'egg') {
        const hatched = this.app.pet.warmEgg();
        if (hatched) {
          this.buildPet(this.app.pet);
          if (this.app.soundFx) this.app.soundFx.playHatch();
          this.app.showToast('🎉 O ovo chocou! O filhotinho nasceu no santuário!', 'success');
          if (window.confetti) window.confetti({ particleCount: 120, spread: 85 });
        } else {
          this.spawnSparkleParticles();
          if (this.app.soundFx) this.app.soundFx.playClick();
        }
      } else {
        this.app.pet.happiness = Math.min(100, this.app.pet.happiness + 4);
        if (this.app.soundFx) this.app.soundFx.playHappy();
        this.spawnHeartParticles();
      }
    }
  }

  // ==========================================
  // PARTÍCULAS PROCEDURAIS
  // ==========================================
  spawnHeartParticles() {
    const mat = new THREE.MeshBasicMaterial({ color: 0xec4899 });
    for (let i = 0; i < 7; i++) {
      const p = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), mat);
      p.position.set((Math.random() - 0.5) * 0.65, 0.45, (Math.random() - 0.5) * 0.65);
      p.userData = {
        velY: 0.85 + Math.random() * 0.65,
        velX: (Math.random() - 0.5) * 0.55,
        velZ: (Math.random() - 0.5) * 0.55,
        life: 1.1
      };
      this.scene.add(p);
      this.particles.push(p);
    }
  }

  spawnBubbleParticle() {
    if (Math.random() < 0.3) {
      const mat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.75 });
      const p = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 8), mat);
      p.position.set((Math.random() - 0.5) * 0.8, 0.25, (Math.random() - 0.5) * 0.8);
      p.userData = { velY: 0.7 + Math.random() * 0.45, velX: (Math.random() - 0.5) * 0.25, velZ: 0, life: 1.2 };
      this.scene.add(p);
      this.particles.push(p);
    }
  }

  spawnSparkleParticles() {
    const mat = new THREE.MeshBasicMaterial({ color: 0xfbbf24 });
    for (let i = 0; i < 6; i++) {
      const p = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 8), mat);
      p.position.set((Math.random() - 0.5) * 0.6, 0.35, (Math.random() - 0.5) * 0.6);
      p.userData = { velY: 0.6 + Math.random() * 0.5, velX: (Math.random() - 0.5) * 0.4, velZ: (Math.random() - 0.5) * 0.4, life: 0.9 };
      this.scene.add(p);
      this.particles.push(p);
    }
  }

  updateParticles(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.userData.life -= dt;
      p.position.y += p.userData.velY * dt;
      p.position.x += p.userData.velX * dt;
      p.position.z += (p.userData.velZ || 0) * dt;

      if (p.userData.life <= 0) {
        this.scene.remove(p);
        p.geometry.dispose();
        p.material.dispose();
        this.particles.splice(i, 1);
      }
    }
  }

  updateAtmosphere(dt) {
    for (let i = this.ambientParticles.length - 1; i >= 0; i--) {
      const p = this.ambientParticles[i];
      p.userData.life -= dt;
      p.position.y = p.userData.baseY + Math.sin(this.animTime * p.userData.speed) * 0.18;

      if (p.userData.life <= 0) {
        this.scene.remove(p);
        p.geometry.dispose();
        p.material.dispose();
        this.ambientParticles.splice(i, 1);
      }
    }
  }

  // ==========================================
  // EVENTOS DE PONTEIRO & REDIMENSIONAMENTO
  // ==========================================
  bindPointerEvents() {
    let startX = 0;
    let startY = 0;
    let hasMoved = false;

    const onDown = (clientX, clientY) => {
      this.isDragging = true;
      startX = clientX;
      startY = clientY;
      hasMoved = false;
      this.previousMousePosition = { x: clientX, y: clientY };
    };

    const onMove = (clientX, clientY) => {
      if (this.isDragging) {
        const deltaX = clientX - this.previousMousePosition.x;
        if (Math.abs(clientX - startX) > 5) hasMoved = true;
        this.targetRotationY += deltaX * 0.014;
        this.previousMousePosition = { x: clientX, y: clientY };
      }
    };

    const onUp = () => {
      if (!hasMoved) {
        this.triggerAffectionGesture();
      }
      this.isDragging = false;
    };

    this.canvas.addEventListener('mousedown', (e) => onDown(e.clientX, e.clientY));
    window.addEventListener('mousemove', (e) => onMove(e.clientX, e.clientY));
    window.addEventListener('mouseup', () => onUp());

    this.canvas.addEventListener('touchstart', (e) => {
      if (e.touches.length > 0) onDown(e.touches[0].clientX, e.touches[0].clientY);
    }, { passive: true });

    window.addEventListener('touchmove', (e) => {
      if (e.touches.length > 0) onMove(e.touches[0].clientX, e.touches[0].clientY);
    }, { passive: true });

    window.addEventListener('touchend', () => onUp());
  }

  handleResize() {
    if (!this.container || !this.renderer || !this.camera) return;
    const width = this.container.clientWidth || 340;
    const height = this.container.clientHeight || 340;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  disposeHierarchy(obj) {
    if (!obj) return;
    obj.traverse((child) => {
      if (child.isMesh) {
        if (child.geometry) child.geometry.dispose();
        if (child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach((m) => m.dispose());
          } else {
            child.material.dispose();
          }
        }
      }
    });
  }
}
