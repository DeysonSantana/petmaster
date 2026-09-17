/**
 * PetMaster - Motor 3D Procedural & Sistema de Animação de Criaturas
 * Renderização WebGL nativa via Three.js (60 FPS, sem assets externos pesados).
 * Suporta as 35 espécies (5 classes biológicas) e estágio de Ovo com gestos em tempo real.
 */

export class Pet3DEngine {
  constructor(containerEl, app) {
    this.container = containerEl;
    this.app = app;
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.currentMeshGroup = null;
    this.petData = null;
    this.particles = [];

    // Estado da animação procedimental
    this.animTime = 0;
    this.isInteracting = false;
    this.interactionTimer = 0;
    this.lookTarget = { x: 0, y: 0.5, z: 0 };
    this.currentStage = null;
    this.currentSpeciesId = null;

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
    this.camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    this.camera.position.set(0, 1.2, 4.2);
    this.camera.lookAt(0, 0.3, 0);

    // 3. WebGL Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.canvas = this.renderer.domElement;
    this.canvas.className = 'w-full h-full block cursor-grab active:cursor-grabbing select-none';
    this.container.innerHTML = '';
    this.container.appendChild(this.canvas);

    // 4. Iluminação Imersiva
    this.setupLighting();

    // 5. Pedestal e Sombra de Contato
    this.setupGround();

    // 6. Eventos de Toque e Mouse (Orbit / Petting)
    this.bindPointerEvents();

    // 7. Resize Observer
    this.resizeObserver = new ResizeObserver(() => this.handleResize());
    this.resizeObserver.observe(this.container);

    console.log('🐾 PetMaster 3D Engine inicializado.');
  }

  setupLighting() {
    // Luz ambiente suave
    this.ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
    this.scene.add(this.ambientLight);

    // Luz principal direcional (Sol da mata / recife)
    this.dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
    this.dirLight.position.set(4, 6, 4);
    this.dirLight.castShadow = true;
    this.dirLight.shadow.mapSize.width = 1024;
    this.dirLight.shadow.mapSize.height = 1024;
    this.dirLight.shadow.camera.near = 0.5;
    this.dirLight.shadow.camera.far = 15;
    this.scene.add(this.dirLight);

    // Rim light para contorno suave
    this.rimLight = new THREE.DirectionalLight(0x10b981, 0.6);
    this.rimLight.position.set(-4, 3, -4);
    this.scene.add(this.rimLight);
  }

  setupGround() {
    // Pedestal cilíndrico decorativo com gradiente
    const pedestalGeo = new THREE.CylinderGeometry(1.6, 1.8, 0.12, 32);
    const pedestalMat = new THREE.MeshStandardMaterial({
      color: 0x062016,
      roughness: 0.8,
      metalness: 0.1
    });
    this.pedestal = new THREE.Mesh(pedestalGeo, pedestalMat);
    this.pedestal.position.y = -0.55;
    this.pedestal.receiveShadow = true;
    this.scene.add(this.pedestal);

    // Anel de brilho bio-luminescente
    const ringGeo = new THREE.RingGeometry(1.62, 1.72, 32);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x10b981,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.4
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = -0.48;
    this.scene.add(ring);
  }

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
        if (Math.abs(clientX - startX) > 4) hasMoved = true;
        this.targetRotationY += deltaX * 0.015;
        this.previousMousePosition = { x: clientX, y: clientY };
      }
    };

    const onUp = () => {
      if (!hasMoved) {
        // Foi um clique/toque de carinho!
        this.triggerAffectionGesture();
      }
      this.isDragging = false;
    };

    // Mouse Events
    this.canvas.addEventListener('mousedown', (e) => onDown(e.clientX, e.clientY));
    window.addEventListener('mousemove', (e) => onMove(e.clientX, e.clientY));
    window.addEventListener('mouseup', () => onUp());

    // Touch Events
    this.canvas.addEventListener('touchstart', (e) => {
      if (e.touches.length === 1) {
        onDown(e.touches[0].clientX, e.touches[0].clientY);
      }
    }, { passive: true });

    window.addEventListener('touchmove', (e) => {
      if (e.touches.length === 1) {
        onMove(e.touches[0].clientX, e.touches[0].clientY);
      }
    }, { passive: true });

    window.addEventListener('touchend', () => onUp());
  }

  handleResize() {
    if (!this.container || !this.renderer || !this.camera) return;
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    if (width > 0 && height > 0) {
      this.camera.aspect = width / height;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(width, height);
    }
  }

  // ==========================================
  // CONSTRUTOR PROCEDURAL DE CRIATURAS 3D
  // ==========================================
  buildPet(pet) {
    if (!this.scene) return;
    this.petData = pet;
    this.currentStage = pet.stage;
    this.currentSpeciesId = pet.speciesId;

    // Limpa malha anterior da GPU para evitar memory leaks
    if (this.currentMeshGroup) {
      this.disposeHierarchy(this.currentMeshGroup);
      this.scene.remove(this.currentMeshGroup);
      this.currentMeshGroup = null;
    }

    const species = pet.species;

    // 1. Estágio Ovo
    if (pet.stage === 'egg') {
      this.currentMeshGroup = this.createEggMesh(species);
    } else {
      // 2. Criatura Biológica (Classes: Mamíferos, Aves, Répteis, Anfíbios, Aquáticos)
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

    // Escala base do estágio (filhote é menor, adulto é imponente)
    let scale = 1.0;
    if (pet.stage === 'baby') scale = 0.75;
    else if (pet.stage === 'teen') scale = 0.95;
    else if (pet.stage === 'adult') scale = 1.2;

    this.currentMeshGroup.scale.set(scale, scale, scale);
    this.currentMeshGroup.position.set(0, 0, 0);
    this.scene.add(this.currentMeshGroup);
  }

  // Material estilizado Toon / Low-Poly vibrante
  createStylizedMaterial(colorHex, roughness = 0.4, metalness = 0.1) {
    return new THREE.MeshStandardMaterial({
      color: new THREE.Color(colorHex),
      roughness: roughness,
      metalness: metalness,
      flatShading: true
    });
  }

  // --- MODELO 1: OVO BIOLÓGICO 3D ---
  createEggMesh(species) {
    const group = new THREE.Group();

    // Geometria de Ovo Tapered (esfera deformada verticalmente)
    const eggGeo = new THREE.SphereGeometry(0.75, 24, 24);
    // Deforma o topo para afunilar suavemente como um ovo real
    const pos = eggGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      let y = pos.getY(i);
      let factor = 1.0 - (y * 0.25);
      pos.setX(i, pos.getX(i) * factor);
      pos.setZ(i, pos.getZ(i) * factor);
    }
    eggGeo.computeVertexNormals();

    const eggColor = species.eggColor || '#10b981';
    const eggMat = this.createStylizedMaterial(eggColor, 0.3, 0.15);
    const eggMesh = new THREE.Mesh(eggGeo, eggMat);
    eggMesh.castShadow = true;
    eggMesh.receiveShadow = true;
    eggMesh.position.y = 0.3;

    group.add(eggMesh);
    group.userData = { type: 'egg', eggMesh };

    // Ninho de galhos/folhas na base
    const nestGeo = new THREE.TorusGeometry(0.65, 0.18, 12, 24);
    const nestMat = this.createStylizedMaterial('#78350f', 0.9, 0.0);
    const nest = new THREE.Mesh(nestGeo, nestMat);
    nest.rotation.x = Math.PI / 2;
    nest.position.y = -0.35;
    nest.castShadow = true;
    group.add(nest);

    return group;
  }

  // --- MODELO 2: MAMÍFEROS 3D ---
  createMammalMesh(species, stage) {
    const group = new THREE.Group();
    const mainColor = species.eggColor || '#d97706';
    const matBody = this.createStylizedMaterial(mainColor, 0.6, 0.05);
    const matBelly = this.createStylizedMaterial('#fef3c7', 0.6, 0.05);
    const matDark = this.createStylizedMaterial('#1f2937', 0.4, 0.1);
    const matEye = this.createStylizedMaterial('#111827', 0.2, 0.8);
    const matNose = this.createStylizedMaterial('#451a03', 0.3, 0.2);

    // 1. Corpo
    const bodyGeo = new THREE.BoxGeometry(1.0, 0.9, 1.4);
    const body = new THREE.Mesh(bodyGeo, matBody);
    body.position.set(0, 0.3, 0);
    body.castShadow = true;
    group.add(body);

    // 2. Cabeça
    const headGroup = new THREE.Group();
    const headGeo = new THREE.BoxGeometry(0.8, 0.75, 0.85);
    const head = new THREE.Mesh(headGeo, matBody);
    head.position.set(0, 0, 0);
    head.castShadow = true;
    headGroup.add(head);

    // Focinho
    const snoutGeo = new THREE.BoxGeometry(0.45, 0.35, 0.4);
    const snout = new THREE.Mesh(snoutGeo, matBelly);
    snout.position.set(0, -0.12, 0.55);
    snout.castShadow = true;
    headGroup.add(snout);

    // Nariz
    const noseGeo = new THREE.BoxGeometry(0.18, 0.14, 0.1);
    const nose = new THREE.Mesh(noseGeo, matNose);
    nose.position.set(0, -0.05, 0.76);
    headGroup.add(nose);

    // Olhos
    [-0.26, 0.26].forEach((x) => {
      const eyeGeo = new THREE.SphereGeometry(0.08, 12, 12);
      const eye = new THREE.Mesh(eyeGeo, matEye);
      eye.position.set(x, 0.12, 0.42);
      headGroup.add(eye);
    });

    // Orelhas
    [-0.32, 0.32].forEach((x) => {
      const earGeo = new THREE.BoxGeometry(0.22, 0.28, 0.12);
      const ear = new THREE.Mesh(earGeo, matBody);
      ear.position.set(x, 0.45, -0.05);
      ear.rotation.z = x > 0 ? -0.2 : 0.2;
      headGroup.add(ear);
    });

    headGroup.position.set(0, 0.7, 0.8);
    group.add(headGroup);

    // 3. Quatro Patas Articuladas
    const legs = [];
    const legGeo = new THREE.BoxGeometry(0.26, 0.55, 0.28);
    const legPositions = [
      { x: -0.38, z: 0.45 },
      { x: 0.38, z: 0.45 },
      { x: -0.38, z: -0.45 },
      { x: 0.38, z: -0.45 }
    ];

    legPositions.forEach((p) => {
      const leg = new THREE.Mesh(legGeo, matBody);
      leg.position.set(p.x, -0.18, p.z);
      leg.castShadow = true;
      group.add(leg);
      legs.push(leg);
    });

    // 4. Cauda
    const tailGeo = new THREE.CylinderGeometry(0.08, 0.14, 0.55, 8);
    const tail = new THREE.Mesh(tailGeo, matBody);
    tail.rotation.x = Math.PI / 3;
    tail.position.set(0, 0.35, -0.85);
    tail.castShadow = true;
    group.add(tail);

    group.userData = { type: 'mammal', body, headGroup, legs, tail };
    return group;
  }

  // --- MODELO 3: AVES 3D ---
  createBirdMesh(species, stage) {
    const group = new THREE.Group();
    const color = species.eggColor || '#2563eb';
    const matFeather = this.createStylizedMaterial(color, 0.5, 0.1);
    const matBeak = this.createStylizedMaterial('#f97316', 0.3, 0.2);
    const matLegs = this.createStylizedMaterial('#f59e0b', 0.5, 0.1);
    const matEye = this.createStylizedMaterial('#111827', 0.2, 0.8);

    // Corpo estilizado em gota
    const bodyGeo = new THREE.ConeGeometry(0.65, 1.2, 16);
    const body = new THREE.Mesh(bodyGeo, matFeather);
    body.rotation.x = -Math.PI / 3;
    body.position.set(0, 0.3, 0);
    body.castShadow = true;
    group.add(body);

    // Cabeça
    const headGroup = new THREE.Group();
    const headGeo = new THREE.SphereGeometry(0.42, 16, 16);
    const head = new THREE.Mesh(headGeo, matFeather);
    headGroup.add(head);

    // Bico curvado marcante
    const beakGeo = new THREE.ConeGeometry(0.18, 0.65, 12);
    const beak = new THREE.Mesh(beakGeo, matBeak);
    beak.rotation.x = Math.PI / 2.2;
    beak.position.set(0, -0.05, 0.55);
    beak.castShadow = true;
    headGroup.add(beak);

    // Olhos
    [-0.26, 0.26].forEach((x) => {
      const eyeGeo = new THREE.SphereGeometry(0.07, 10, 10);
      const eye = new THREE.Mesh(eyeGeo, matEye);
      eye.position.set(x, 0.1, 0.28);
      headGroup.add(eye);
    });

    headGroup.position.set(0, 0.85, 0.45);
    group.add(headGroup);

    // Duas Asas
    const wings = [];
    [-0.55, 0.55].forEach((x) => {
      const wingGeo = new THREE.BoxGeometry(0.12, 0.6, 0.8);
      const wing = new THREE.Mesh(wingGeo, matFeather);
      wing.position.set(x, 0.35, -0.05);
      wing.rotation.z = x > 0 ? -0.2 : 0.2;
      wing.castShadow = true;
      group.add(wing);
      wings.push(wing);
    });

    // Pernas finas
    const legs = [];
    [-0.2, 0.2].forEach((x) => {
      const legGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.6, 8);
      const leg = new THREE.Mesh(legGeo, matLegs);
      leg.position.set(x, -0.22, -0.05);
      leg.castShadow = true;
      group.add(leg);
      legs.push(leg);
    });

    group.userData = { type: 'bird', body, headGroup, wings, legs };
    return group;
  }

  // --- MODELO 4: RÉPTEIS 3D ---
  createReptileMesh(species, stage) {
    const group = new THREE.Group();
    const color = species.eggColor || '#15803d';
    const matSkin = this.createStylizedMaterial(color, 0.7, 0.1);
    const matEye = this.createStylizedMaterial('#eab308', 0.2, 0.8);

    // Corpo rebaixado
    const bodyGeo = new THREE.BoxGeometry(1.0, 0.55, 1.5);
    const body = new THREE.Mesh(bodyGeo, matSkin);
    body.position.set(0, 0.1, 0);
    body.castShadow = true;
    group.add(body);

    // Se for tartaruga, adiciona casco proeminente
    if (species.id === 'green_turtle') {
      const shellGeo = new THREE.SphereGeometry(0.85, 16, 12);
      const shellMat = this.createStylizedMaterial('#064e3b', 0.6, 0.1);
      const shell = new THREE.Mesh(shellGeo, shellMat);
      shell.scale.set(1.0, 0.55, 1.2);
      shell.position.set(0, 0.45, 0);
      shell.castShadow = true;
      group.add(shell);
    }

    // Cabeça alongada
    const headGroup = new THREE.Group();
    const headGeo = new THREE.BoxGeometry(0.65, 0.45, 0.85);
    const head = new THREE.Mesh(headGeo, matSkin);
    head.castShadow = true;
    headGroup.add(head);

    // Olhos no topo
    [-0.25, 0.25].forEach((x) => {
      const eyeGeo = new THREE.SphereGeometry(0.08, 12, 12);
      const eye = new THREE.Mesh(eyeGeo, matEye);
      eye.position.set(x, 0.2, 0.2);
      headGroup.add(eye);
    });

    headGroup.position.set(0, 0.28, 1.0);
    group.add(headGroup);

    // Cauda longa e afunilada
    const tailGeo = new THREE.ConeGeometry(0.28, 1.3, 12);
    const tail = new THREE.Mesh(tailGeo, matSkin);
    tail.rotation.x = -Math.PI / 2.2;
    tail.position.set(0, 0.1, -1.35);
    tail.castShadow = true;
    group.add(tail);

    // 4 Patas rasteiras
    const legs = [];
    const legGeo = new THREE.BoxGeometry(0.35, 0.22, 0.35);
    [
      { x: -0.55, z: 0.5 },
      { x: 0.55, z: 0.5 },
      { x: -0.55, z: -0.5 },
      { x: 0.55, z: -0.5 }
    ].forEach((p) => {
      const leg = new THREE.Mesh(legGeo, matSkin);
      leg.position.set(p.x, -0.05, p.z);
      leg.castShadow = true;
      group.add(leg);
      legs.push(leg);
    });

    group.userData = { type: 'reptile', body, headGroup, tail, legs };
    return group;
  }

  // --- MODELO 5: ANFÍBIOS 3D ---
  createAmphibianMesh(species, stage) {
    const group = new THREE.Group();
    const color = species.eggColor || '#ec4899';
    // Pele brilhante / úmida
    const matSkin = this.createStylizedMaterial(color, 0.2, 0.2);
    const matEye = this.createStylizedMaterial('#111827', 0.1, 0.9);

    // Corpo roliço
    const bodyGeo = new THREE.SphereGeometry(0.7, 20, 16);
    const body = new THREE.Mesh(bodyGeo, matSkin);
    body.scale.set(1.1, 0.75, 1.3);
    body.position.set(0, 0.18, 0);
    body.castShadow = true;
    group.add(body);

    // Se for Axolote, brânquias externas plumosas nas laterais
    const gills = [];
    if (species.id === 'axolotl') {
      const matGills = this.createStylizedMaterial('#f43f5e', 0.4, 0.0);
      [-0.45, 0.45].forEach((x) => {
        for (let g = 0; g < 3; g++) {
          const gillGeo = new THREE.CylinderGeometry(0.04, 0.08, 0.45, 8);
          const gill = new THREE.Mesh(gillGeo, matGills);
          gill.position.set(x, 0.35 + g * 0.15, 0.45 - g * 0.1);
          gill.rotation.z = x > 0 ? -Math.PI / 3 : Math.PI / 3;
          group.add(gill);
          gills.push(gill);
        }
      });
    }

    // Olhos esbugalhados expressivos
    const eyes = [];
    [-0.32, 0.32].forEach((x) => {
      const eyeGeo = new THREE.SphereGeometry(0.15, 14, 14);
      const eye = new THREE.Mesh(eyeGeo, matEye);
      eye.position.set(x, 0.55, 0.65);
      eye.castShadow = true;
      group.add(eye);
      eyes.push(eye);
    });

    group.userData = { type: 'amphibian', body, gills, eyes };
    return group;
  }

  // --- MODELO 6: AQUÁTICOS 3D ---
  createAquaticMesh(species, stage) {
    const group = new THREE.Group();
    const color = species.eggColor || '#38bdf8';
    const matSkin = this.createStylizedMaterial(color, 0.25, 0.2);
    const matFin = this.createStylizedMaterial('#ffffff', 0.4, 0.1);
    const matEye = this.createStylizedMaterial('#0f172a', 0.1, 0.8);

    // Corpo hidrodinâmico fusiforme
    const bodyGeo = new THREE.SphereGeometry(0.65, 20, 16);
    const body = new THREE.Mesh(bodyGeo, matSkin);
    body.scale.set(0.7, 0.8, 1.8);
    body.position.set(0, 0.25, 0);
    body.castShadow = true;
    group.add(body);

    // Barbatana dorsal
    const dorsalGeo = new THREE.ConeGeometry(0.3, 0.7, 8);
    const dorsal = new THREE.Mesh(dorsalGeo, matFin);
    dorsal.rotation.x = -Math.PI / 3;
    dorsal.position.set(0, 0.85, -0.2);
    dorsal.castShadow = true;
    group.add(dorsal);

    // Barbatana Caudal (Rabo)
    const tailGroup = new THREE.Group();
    const tailGeo = new THREE.BoxGeometry(0.08, 0.75, 0.65);
    const tailFin = new THREE.Mesh(tailGeo, matFin);
    tailFin.position.set(0, 0, -0.3);
    tailGroup.add(tailFin);
    tailGroup.position.set(0, 0.25, -1.2);
    group.add(tailGroup);

    // Nadadeiras peitorais laterais
    const fins = [];
    [-0.55, 0.55].forEach((x) => {
      const finGeo = new THREE.BoxGeometry(0.5, 0.08, 0.35);
      const fin = new THREE.Mesh(finGeo, matFin);
      fin.position.set(x, 0.15, 0.35);
      fin.rotation.z = x > 0 ? -0.25 : 0.25;
      group.add(fin);
      fins.push(fin);
    });

    // Olhos
    [-0.32, 0.32].forEach((x) => {
      const eyeGeo = new THREE.SphereGeometry(0.1, 12, 12);
      const eye = new THREE.Mesh(eyeGeo, matEye);
      eye.position.set(x, 0.35, 0.8);
      group.add(eye);
    });

    group.userData = { type: 'aquatic', body, tailGroup, fins };
    return group;
  }

  // ==========================================
  // LOOP DE ANIMAÇÃO PROCEDURAL (60 FPS)
  // ==========================================
  update(deltaTime) {
    if (!this.renderer || !this.scene) return;

    this.animTime += deltaTime;
    const t = this.animTime;
    const pData = this.app.pet;

    // Interpolação suave da rotação do usuário (damping)
    this.currentRotationY += (this.targetRotationY - this.currentRotationY) * 0.1;
    if (this.currentMeshGroup) {
      this.currentMeshGroup.rotation.y = this.currentRotationY;
    }

    // Gestos temporários (ex: salto de carinho)
    if (this.isInteracting) {
      this.interactionTimer -= deltaTime;
      if (this.interactionTimer <= 0) {
        this.isInteracting = false;
      }
    }

    // Animação de acordo com a espécie e estado do pet
    if (this.currentMeshGroup && pData) {
      const state = pData.state;
      const uData = this.currentMeshGroup.userData;

      // 1. OVO
      if (uData.type === 'egg' && uData.eggMesh) {
        // Balanço suave e tremor do ninho
        uData.eggMesh.rotation.z = Math.sin(t * 3.5) * 0.08;
        uData.eggMesh.rotation.x = Math.cos(t * 2.8) * 0.06;
        uData.eggMesh.position.y = 0.28 + Math.sin(t * 2) * 0.03;

        if (this.isInteracting) {
          // Tremor forte ao receber toque
          uData.eggMesh.rotation.z += (Math.random() - 0.5) * 0.3;
        }
      }

      // 2. MAMÍFERO
      else if (uData.type === 'mammal') {
        this.animateMammal(uData, state, t, deltaTime);
      }

      // 3. AVE
      else if (uData.type === 'bird') {
        this.animateBird(uData, state, t, deltaTime);
      }

      // 4. RÉPTIL
      else if (uData.type === 'reptile') {
        this.animateReptile(uData, state, t, deltaTime);
      }

      // 5. ANFÍBIO
      else if (uData.type === 'amphibian') {
        this.animateAmphibian(uData, state, t, deltaTime);
      }

      // 6. AQUÁTICO
      else if (uData.type === 'aquatic') {
        this.animateAquatic(uData, state, t, deltaTime);
      }
    }

    // Atualiza partículas 3D ativas
    this.updateParticles(deltaTime);

    // Renderiza o frame
    this.renderer.render(this.scene, this.camera);
  }

  // Animação procedimental de Mamíferos
  animateMammal(u, state, t, dt) {
    // Respiração básica contínua
    const breathe = Math.sin(t * 2.5) * 0.03;
    u.body.scale.set(1.0 + breathe, 1.0 + breathe * 1.5, 1.0 - breathe);

    // Cauda abanando
    if (u.tail) {
      u.tail.rotation.y = Math.sin(t * 4.5) * 0.35;
    }

    switch (state) {
      case 'eating':
        u.headGroup.rotation.x = Math.sin(t * 12) * 0.2 + 0.3;
        u.headGroup.position.y = 0.55 + Math.sin(t * 12) * 0.08;
        break;

      case 'bathing':
        u.body.rotation.y = Math.sin(t * 6) * 0.4;
        u.headGroup.rotation.z = Math.sin(t * 8) * 0.2;
        this.spawnBubbleParticle();
        break;

      case 'sleeping':
        u.body.position.y = 0.1;
        u.headGroup.position.y = 0.35;
        u.headGroup.rotation.x = 0.3;
        break;

      case 'playing':
      case 'happy':
        const bounce = Math.abs(Math.sin(t * 7)) * 0.45;
        this.currentMeshGroup.position.y = bounce;
        u.headGroup.rotation.x = -0.15;
        if (u.legs && u.legs.length === 4) {
          u.legs[0].rotation.x = Math.sin(t * 14) * 0.4;
          u.legs[1].rotation.x = -Math.sin(t * 14) * 0.4;
        }
        break;

      case 'sick':
      case 'critical':
        u.headGroup.rotation.x = 0.35;
        u.body.position.y = 0.15 + (Math.random() - 0.5) * 0.02; // tremor
        break;

      default: // Idle
        u.headGroup.rotation.y = Math.sin(t * 1.2) * 0.15;
        u.headGroup.rotation.x = Math.cos(t * 0.8) * 0.08;
        this.currentMeshGroup.position.y = 0;
        break;
    }
  }

  // Animação procedimental de Aves
  animateBird(u, state, t, dt) {
    const breathe = Math.sin(t * 3.0) * 0.04;
    u.body.scale.set(1.0 + breathe, 1.0 + breathe, 1.0);

    // Bater de asas no idle / voo
    if (u.wings) {
      const wingFlap = Math.sin(t * 5.0) * 0.2;
      u.wings[0].rotation.z = -0.2 - wingFlap;
      u.wings[1].rotation.z = 0.2 + wingFlap;
    }

    if (state === 'eating') {
      u.headGroup.position.y = 0.65 + Math.sin(t * 14) * 0.12;
      u.headGroup.rotation.x = 0.4;
    } else if (state === 'playing') {
      this.currentMeshGroup.position.y = Math.abs(Math.sin(t * 8)) * 0.6;
      if (u.wings) {
        const rapidFlap = Math.sin(t * 22) * 0.8;
        u.wings[0].rotation.z = -rapidFlap;
        u.wings[1].rotation.z = rapidFlap;
      }
    }
  }

  // Animação procedimental de Répteis
  animateReptile(u, state, t, dt) {
    if (u.tail) {
      u.tail.rotation.y = Math.sin(t * 3.0) * 0.4;
    }

    if (state === 'playing') {
      this.currentMeshGroup.position.y = Math.abs(Math.sin(t * 6)) * 0.3;
    } else if (state === 'eating') {
      u.headGroup.position.z = 1.0 + Math.sin(t * 10) * 0.15;
    }
  }

  // Animação procedimental de Anfíbios
  animateAmphibian(u, state, t, dt) {
    // Inflar a garganta / papo
    const throatPulse = Math.sin(t * 4.0) * 0.08;
    u.body.scale.set(1.1 + throatPulse, 0.75 + throatPulse * 1.5, 1.3);

    // Se tiver brânquias, ondular
    if (u.gills) {
      u.gills.forEach((g, i) => {
        g.rotation.x = Math.sin(t * 4 + i) * 0.15;
      });
    }

    if (state === 'playing') {
      // Pulo alto de sapo
      this.currentMeshGroup.position.y = Math.abs(Math.sin(t * 6)) * 0.55;
    }
  }

  // Animação procedimental de Aquáticos
  animateAquatic(u, state, t, dt) {
    // Ondulação suave de natação contínua
    const swimWave = Math.sin(t * 4.0);
    this.currentMeshGroup.position.y = Math.sin(t * 2.5) * 0.12;

    if (u.tailGroup) {
      u.tailGroup.rotation.y = swimWave * 0.5;
    }
    if (u.fins) {
      u.fins[0].rotation.x = Math.cos(t * 4) * 0.3;
      u.fins[1].rotation.x = Math.cos(t * 4) * 0.3;
    }

    if (state === 'playing') {
      // Salto acrobático de golfinho
      this.currentMeshGroup.position.y = 0.5 + Math.sin(t * 6) * 0.4;
      this.currentMeshGroup.rotation.x = Math.sin(t * 6) * 0.5;
    } else {
      this.currentMeshGroup.rotation.x = 0;
    }
  }

  // ==========================================
  // GESTOS DE RESPOSTA A TOQUE (AFFECTION)
  // ==========================================
  triggerAffectionGesture() {
    this.isInteracting = true;
    this.interactionTimer = 1.2;

    // Notifica a aplicação para dar XP/Felicidade
    if (this.app) {
      if (this.app.pet.stage === 'egg') {
        const hatched = this.app.pet.warmEgg();
        if (hatched) {
          this.buildPet(this.app.pet);
          if (this.app.soundFx) this.app.soundFx.playHatch();
          this.app.showToast('🎉 O ovo chocou! O filhotinho nasceu em 3D!', 'success');
          if (window.confetti) window.confetti({ particleCount: 100, spread: 80 });
        } else {
          this.spawnSparkleParticles();
          if (this.app.soundFx) this.app.soundFx.playClick();
        }
      } else {
        this.app.pet.happiness = Math.min(100, this.app.pet.happiness + 3);
        if (this.app.soundFx) this.app.soundFx.playHappy();
        this.spawnHeartParticles();
      }
    }
  }

  // ==========================================
  // SISTEMA DE PARTÍCULAS 3D LEVE
  // ==========================================
  spawnHeartParticles() {
    const mat = new THREE.MeshBasicMaterial({ color: 0xec4899 });
    for (let i = 0; i < 6; i++) {
      const geo = new THREE.SphereGeometry(0.08, 8, 8);
      const p = new THREE.Mesh(geo, mat);
      p.position.set((Math.random() - 0.5) * 0.6, 0.4, (Math.random() - 0.5) * 0.6);
      p.userData = {
        velY: 0.8 + Math.random() * 0.6,
        velX: (Math.random() - 0.5) * 0.5,
        velZ: (Math.random() - 0.5) * 0.5,
        life: 1.0
      };
      this.scene.add(p);
      this.particles.push(p);
    }
  }

  spawnBubbleParticle() {
    if (Math.random() < 0.25) {
      const mat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.7 });
      const geo = new THREE.SphereGeometry(0.09, 8, 8);
      const p = new THREE.Mesh(geo, mat);
      p.position.set((Math.random() - 0.5) * 0.8, 0.2, (Math.random() - 0.5) * 0.8);
      p.userData = { velY: 0.6 + Math.random() * 0.4, velX: (Math.random() - 0.5) * 0.2, velZ: 0, life: 1.2 };
      this.scene.add(p);
      this.particles.push(p);
    }
  }

  spawnSparkleParticles() {
    const mat = new THREE.MeshBasicMaterial({ color: 0xfbbf24 });
    for (let i = 0; i < 5; i++) {
      const geo = new THREE.BoxGeometry(0.06, 0.06, 0.06);
      const p = new THREE.Mesh(geo, mat);
      p.position.set((Math.random() - 0.5) * 0.5, 0.3, (Math.random() - 0.5) * 0.5);
      p.userData = { velY: 0.5 + Math.random() * 0.5, velX: (Math.random() - 0.5) * 0.4, velZ: (Math.random() - 0.5) * 0.4, life: 0.8 };
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

  // Limpeza de memória defensiva (Zero GPU Leaks)
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
