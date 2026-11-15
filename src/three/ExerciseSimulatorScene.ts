import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import type { ExerciseProtocol, FormQuality } from '../domain/osteosense';
import type { SeverityLevelId } from '../domain/boneExerciseMatrix';
import { getExerciseBiomechanics } from '../domain/nasaBoneDatabase';

export type SimCameraPreset = 'isometric' | 'sagittal' | 'anterior';

export interface SimOverlayOptions {
  showAngles: boolean;
  showMuscles: boolean;
  showForce: boolean;
}

export interface SimulatorTelemetryFrame {
  rep: number;
  totalReps: number;
  phaseIndex: number;
  phaseLabelEn: string;
  phaseLabelAr: string;
  cycleProgress: number; // 0..1
  primaryAngleDeg: number;
  secondaryAngleDeg: number;
  instantForceBw: number;
  emgRightUv: number;
  emgLeftUv: number;
  symmetryPct: number;
}

const SIM_CAMERAS: Record<SimCameraPreset, { pos: [number, number, number]; target: [number, number, number] }> = {
  isometric: { pos: [1.72, 1.38, 2.18], target: [0, 0.92, 0] },
  sagittal: { pos: [2.45, 1.02, 0.04], target: [0, 0.92, 0] },
  anterior: { pos: [0.04, 1.12, 2.45], target: [0, 0.92, 0] },
};

const _vA = new THREE.Vector3();
const _vB = new THREE.Vector3();
const _vUp = new THREE.Vector3(0, 1, 0);

function detectSoftwareWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const gpu = String(gl.getParameter(ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER));
    const lose = gl.getExtension('WEBGL_lose_context');
    if (lose) lose.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return false;
  }
}

function createForcePlateTexture(maxAniso: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, 512, 512);

    ctx.strokeStyle = 'rgba(34, 211, 238, 0.25)';
    ctx.lineWidth = 2;
    for (let i = 32; i < 512; i += 32) {
      ctx.beginPath();
      ctx.moveTo(i, 16);
      ctx.lineTo(i, 496);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(16, i);
      ctx.lineTo(496, i);
      ctx.stroke();
    }

    // Bilateral footplate target zones
    ctx.strokeStyle = 'rgba(34, 211, 238, 0.72)';
    ctx.lineWidth = 3;
    ctx.strokeRect(128, 176, 92, 176);
    ctx.strokeRect(292, 176, 92, 176);

    ctx.fillStyle = 'rgba(34, 211, 238, 0.12)';
    ctx.fillRect(128, 176, 92, 176);
    ctx.fillRect(292, 176, 92, 176);

    ctx.strokeStyle = 'rgba(103, 232, 249, 0.85)';
    ctx.lineWidth = 3;
    ctx.strokeRect(18, 18, 476, 476);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAniso || 1;
  return tex;
}

export class ExerciseSimulatorScene {
  private mountEl: HTMLElement;
  private onTelemetry: (frame: SimulatorTelemetryFrame) => void;
  private isSoftwareGl: boolean;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private controls: OrbitControls;
  private envRT: THREE.WebGLRenderTarget;

  private geometries: THREE.BufferGeometry[] = [];
  private materials: THREE.Material[] = [];
  private textures: THREE.Texture[] = [];

  // Articulated Astronaut Rig
  private pelvisGroup = new THREE.Group();
  private lumbarGroup = new THREE.Group();
  private thoraxGroup = new THREE.Group();
  private headGroup = new THREE.Group();

  private hipR = new THREE.Group();
  private kneeR = new THREE.Group();
  private ankleR = new THREE.Group();
  private hipL = new THREE.Group();
  private kneeL = new THREE.Group();
  private ankleL = new THREE.Group();

  private shoulderR = new THREE.Group();
  private elbowR = new THREE.Group();
  private wristR = new THREE.Group();
  private shoulderL = new THREE.Group();
  private elbowL = new THREE.Group();
  private wristL = new THREE.Group();

  // Dynamic ARED Bar / Cable & Pistons
  private aredBarGroup = new THREE.Group();
  private cableMeshL!: THREE.Mesh;
  private cableMeshR!: THREE.Mesh;

  // Target Muscle Materials (animated by EMG recruitment)
  private muscleMats = {
    quadR: null as THREE.MeshStandardMaterial | null,
    quadL: null as THREE.MeshStandardMaterial | null,
    hamR: null as THREE.MeshStandardMaterial | null,
    hamL: null as THREE.MeshStandardMaterial | null,
    calfR: null as THREE.MeshStandardMaterial | null,
    calfL: null as THREE.MeshStandardMaterial | null,
    gluteR: null as THREE.MeshStandardMaterial | null,
    gluteL: null as THREE.MeshStandardMaterial | null,
    erector: null as THREE.MeshStandardMaterial | null,
    deltoidR: null as THREE.MeshStandardMaterial | null,
    deltoidL: null as THREE.MeshStandardMaterial | null,
    bicepsR: null as THREE.MeshStandardMaterial | null,
    bicepsL: null as THREE.MeshStandardMaterial | null,
  };

  // Biomechanical Overlays
  private angleOverlayGroup = new THREE.Group();
  private angleArcMesh!: THREE.Mesh;
  private angleArcMat!: THREE.MeshBasicMaterial;
  private angleArmRef!: THREE.Mesh;
  private angleArmLive!: THREE.Mesh;

  private forceOverlayGroup = new THREE.Group();
  private forceShaftMesh!: THREE.Mesh;
  private forceHeadMesh!: THREE.Mesh;
  private forceMat!: THREE.MeshBasicMaterial;

  // Runtime Simulation State
  private protocol: ExerciseProtocol;
  private severity: SeverityLevelId;
  private formQuality: FormQuality;
  private isPlaying: boolean;
  private isEvaluating = false;
  private speedMultiplier = 1;
  private overlays: SimOverlayOptions = { showAngles: true, showMuscles: true, showForce: true };

  private phaseRad = 0;
  private repCount = 1;
  private lastTelemetryEmit = 0;

  private camAnim = {
    active: false,
    pos: new THREE.Vector3(),
    target: new THREE.Vector3(),
  };

  private frameId = 0;
  private prevTime = performance.now();
  private disposed = false;

  constructor(
    mountEl: HTMLElement,
    initialProtocol: ExerciseProtocol,
    initialSeverity: SeverityLevelId,
    initialForm: FormQuality,
    initialPlaying: boolean,
    onTelemetry: (frame: SimulatorTelemetryFrame) => void,
  ) {
    this.mountEl = mountEl;
    this.protocol = initialProtocol;
    this.severity = initialSeverity;
    this.formQuality = initialForm;
    this.isPlaying = initialPlaying;
    this.onTelemetry = onTelemetry;
    this.isSoftwareGl = detectSoftwareWebGL();

    const width = mountEl.clientWidth || 640;
    const height = mountEl.clientHeight || 380;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x060911);
    this.scene.fog = new THREE.FogExp2(0x060911, 0.045);

    this.camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 30);
    const camInit = SIM_CAMERAS.isometric;
    this.camera.position.set(camInit.pos[0], camInit.pos[1], camInit.pos[2]);

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;
    this.renderer.setPixelRatio(this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(width, height);
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    mountEl.innerHTML = '';
    mountEl.appendChild(this.renderer.domElement);

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.envRT = pmrem.fromScene(new RoomEnvironment(), 0.04);
    this.scene.environment = this.envRT.texture;
    pmrem.dispose();

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = !this.isSoftwareGl;
    this.controls.dampingFactor = 0.07;
    this.controls.minDistance = 1.1;
    this.controls.maxDistance = 4.6;
    this.controls.maxPolarAngle = Math.PI * 0.52;
    this.controls.target.set(camInit.target[0], camInit.target[1], camInit.target[2]);
    this.controls.update();

    this.controls.addEventListener('start', () => {
      this.camAnim.active = false;
    });

    // Studio 3-point lighting rig
    const hemi = new THREE.HemisphereLight(0x9bd7ff, 0x0b1220, 0.85);
    this.scene.add(hemi);

    const keyLight = new THREE.DirectionalLight(0xfff1e0, 1.8);
    keyLight.position.set(2.2, 3.4, 2.5);
    if (!this.isSoftwareGl) {
      keyLight.castShadow = true;
      keyLight.shadow.mapSize.set(1024, 1024);
      keyLight.shadow.camera.left = -1.5;
      keyLight.shadow.camera.right = 1.5;
      keyLight.shadow.camera.top = 2.4;
      keyLight.shadow.camera.bottom = -0.3;
      keyLight.shadow.bias = -0.0005;
      keyLight.shadow.normalBias = 0.02;
    }
    this.scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x22d3ee, 1.3);
    rimLight.position.set(-2.2, 2.0, -2.2);
    this.scene.add(rimLight);

    const grid = new THREE.GridHelper(12, 28, 0x164e63, 0x0f172a);
    grid.position.y = -0.002;
    this.scene.add(grid);

    this.buildAredApparatus();
    this.buildAstronautRig();
    this.buildBiomechanicalOverlays();

    window.addEventListener('resize', this.onResize);
    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }

    this.applyPose(0);
    this.startLoop();
  }

  private trackGeo<T extends THREE.BufferGeometry>(g: T): T {
    this.geometries.push(g);
    return g;
  }

  private trackMat<T extends THREE.Material>(m: T): T {
    this.materials.push(m);
    return m;
  }

  private trackTex<T extends THREE.Texture>(t: T): T {
    this.textures.push(t);
    return t;
  }

  private buildAredApparatus() {
    const deckTex = this.trackTex(createForcePlateTexture(this.renderer.capabilities.getMaxAnisotropy()));
    const deckMat = this.trackMat(new THREE.MeshStandardMaterial({ map: deckTex, roughness: 0.45, metalness: 0.35 }));
    const frameMetalMat = this.trackMat(new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.3, metalness: 0.85 }));
    const titaniumMat = this.trackMat(new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.22, metalness: 0.9 }));
    const accentCyanMat = this.trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x22d3ee,
        emissive: 0x06b6d4,
        emissiveIntensity: 0.65,
        roughness: 0.25,
        metalness: 0.5,
      }),
    );

    // Force-plate platform
    const basePlate = new THREE.Mesh(this.trackGeo(new THREE.BoxGeometry(1.12, 0.045, 0.88)), frameMetalMat);
    basePlate.position.y = 0.0225;
    basePlate.receiveShadow = true;
    this.scene.add(basePlate);

    const topSensorPlate = new THREE.Mesh(this.trackGeo(new THREE.BoxGeometry(0.96, 0.012, 0.76)), deckMat);
    topSensorPlate.position.y = 0.051;
    topSensorPlate.receiveShadow = true;
    this.scene.add(topSensorPlate);

    // Twin ARED vacuum resistance cylinders + vertical guide posts
    [-0.52, 0.52].forEach((sx) => {
      const post = new THREE.Mesh(this.trackGeo(new THREE.CylinderGeometry(0.024, 0.026, 2.08, 16)), frameMetalMat);
      post.position.set(sx, 1.08, -0.22);
      post.castShadow = !this.isSoftwareGl;
      this.scene.add(post);

      const vacuumCyl = new THREE.Mesh(this.trackGeo(new THREE.CylinderGeometry(0.052, 0.052, 0.95, 20)), titaniumMat);
      vacuumCyl.position.set(sx * 0.84, 0.52, -0.22);
      vacuumCyl.castShadow = !this.isSoftwareGl;
      this.scene.add(vacuumCyl);

      const pistonRing = new THREE.Mesh(this.trackGeo(new THREE.TorusGeometry(0.055, 0.008, 10, 24)), accentCyanMat);
      pistonRing.rotation.x = Math.PI / 2;
      pistonRing.position.set(sx * 0.84, 0.99, -0.22);
      this.scene.add(pistonRing);
    });

    // Overhead ARED frame crossbeam
    const topBeam = new THREE.Mesh(this.trackGeo(new THREE.BoxGeometry(1.16, 0.055, 0.075)), frameMetalMat);
    topBeam.position.set(0, 2.12, -0.22);
    this.scene.add(topBeam);

    // Dynamic ARED barbell / harness bar
    const barShaft = new THREE.Mesh(this.trackGeo(new THREE.CylinderGeometry(0.016, 0.016, 1.28, 16)), titaniumMat);
    barShaft.rotation.z = Math.PI / 2;
    this.aredBarGroup.add(barShaft);

    [-0.56, 0.56].forEach((bx) => {
      const collar = new THREE.Mesh(this.trackGeo(new THREE.CylinderGeometry(0.036, 0.036, 0.045, 16)), accentCyanMat);
      collar.rotation.z = Math.PI / 2;
      collar.position.x = bx;
      this.aredBarGroup.add(collar);
    });
    this.scene.add(this.aredBarGroup);

    // Resistance cables linking vacuum cylinders to ARED bar
    const cableMat = this.trackMat(new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: 0x0284c7, emissiveIntensity: 0.45, roughness: 0.3 }));
    const cableGeo = this.trackGeo(new THREE.CylinderGeometry(0.005, 0.005, 1, 8));
    this.cableMeshL = new THREE.Mesh(cableGeo, cableMat);
    this.cableMeshR = new THREE.Mesh(cableGeo, cableMat);
    this.scene.add(this.cableMeshL);
    this.scene.add(this.cableMeshR);
  }

  private createMuscleMaterial(): THREE.MeshStandardMaterial {
    return this.trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x334155,
        emissive: 0x9333ea,
        emissiveIntensity: 0.1,
        roughness: 0.52,
        metalness: 0.15,
      }),
    );
  }

  private buildAstronautRig() {
    const suitMat = this.trackMat(new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.58, metalness: 0.25 }));
    const trimMat = this.trackMat(new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.28, metalness: 0.8 }));
    const visorMat = this.trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x0f172a,
        emissive: 0x0ea5e9,
        emissiveIntensity: 0.22,
        roughness: 0.12,
        metalness: 0.85,
      }),
    );
    const bootMat = this.trackMat(new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.72, metalness: 0.2 }));

    this.muscleMats.quadR = this.createMuscleMaterial();
    this.muscleMats.quadL = this.createMuscleMaterial();
    this.muscleMats.hamR = this.createMuscleMaterial();
    this.muscleMats.hamL = this.createMuscleMaterial();
    this.muscleMats.calfR = this.createMuscleMaterial();
    this.muscleMats.calfL = this.createMuscleMaterial();
    this.muscleMats.gluteR = this.createMuscleMaterial();
    this.muscleMats.gluteL = this.createMuscleMaterial();
    this.muscleMats.erector = this.createMuscleMaterial();
    this.muscleMats.deltoidR = this.createMuscleMaterial();
    this.muscleMats.deltoidL = this.createMuscleMaterial();
    this.muscleMats.bicepsR = this.createMuscleMaterial();
    this.muscleMats.bicepsL = this.createMuscleMaterial();

    // Pelvis root (height ~0.95m above floorplate)
    this.pelvisGroup.position.set(0, 0.96, 0);
    this.scene.add(this.pelvisGroup);

    const pelvisMesh = new THREE.Mesh(this.trackGeo(new THREE.BoxGeometry(0.28, 0.14, 0.18)), suitMat);
    pelvisMesh.castShadow = !this.isSoftwareGl;
    this.pelvisGroup.add(pelvisMesh);

    const beltRing = new THREE.Mesh(this.trackGeo(new THREE.BoxGeometry(0.295, 0.038, 0.192)), trimMat);
    beltRing.position.y = 0.055;
    this.pelvisGroup.add(beltRing);

    // Glute muscle belly overlays (posterior pelvis)
    const gluteGeo = this.trackGeo(new THREE.SphereGeometry(0.072, 14, 12));
    const gluteRMesh = new THREE.Mesh(gluteGeo, this.muscleMats.gluteR);
    gluteRMesh.position.set(-0.072, -0.02, -0.062);
    gluteRMesh.scale.set(1, 1.05, 0.78);
    this.pelvisGroup.add(gluteRMesh);

    const gluteLMesh = new THREE.Mesh(gluteGeo, this.muscleMats.gluteL);
    gluteLMesh.position.set(0.072, -0.02, -0.062);
    gluteLMesh.scale.set(1, 1.05, 0.78);
    this.pelvisGroup.add(gluteLMesh);

    // Lumbar Spine -> Thorax -> Head
    this.lumbarGroup.position.set(0, 0.07, 0);
    this.pelvisGroup.add(this.lumbarGroup);

    const lumbarMesh = new THREE.Mesh(this.trackGeo(new THREE.CylinderGeometry(0.115, 0.125, 0.17, 16)), suitMat);
    lumbarMesh.position.y = 0.085;
    lumbarMesh.castShadow = !this.isSoftwareGl;
    this.lumbarGroup.add(lumbarMesh);

    const erectorMesh = new THREE.Mesh(this.trackGeo(new THREE.BoxGeometry(0.11, 0.16, 0.05)), this.muscleMats.erector);
    erectorMesh.position.set(0, 0.09, -0.088);
    this.lumbarGroup.add(erectorMesh);

    this.thoraxGroup.position.set(0, 0.17, 0);
    this.lumbarGroup.add(this.thoraxGroup);

    const chestMesh = new THREE.Mesh(this.trackGeo(new THREE.CylinderGeometry(0.155, 0.122, 0.30, 18)), suitMat);
    chestMesh.position.y = 0.15;
    chestMesh.scale.set(1.12, 1, 0.76);
    chestMesh.castShadow = !this.isSoftwareGl;
    this.thoraxGroup.add(chestMesh);

    const chestPack = new THREE.Mesh(this.trackGeo(new THREE.BoxGeometry(0.15, 0.13, 0.05)), trimMat);
    chestPack.position.set(0, 0.17, 0.11);
    this.thoraxGroup.add(chestPack);

    // Head & Helmet
    this.headGroup.position.set(0, 0.34, 0);
    this.thoraxGroup.add(this.headGroup);

    const neckCollar = new THREE.Mesh(this.trackGeo(new THREE.CylinderGeometry(0.068, 0.075, 0.05, 16)), trimMat);
    neckCollar.position.y = 0.015;
    this.headGroup.add(neckCollar);

    const helmet = new THREE.Mesh(this.trackGeo(new THREE.SphereGeometry(0.105, 20, 16)), suitMat);
    helmet.position.y = 0.115;
    helmet.scale.set(0.95, 1.05, 1.02);
    helmet.castShadow = !this.isSoftwareGl;
    this.headGroup.add(helmet);

    const visor = new THREE.Mesh(this.trackGeo(new THREE.SphereGeometry(0.088, 18, 14, -Math.PI * 0.38, Math.PI * 0.76, Math.PI * 0.25, Math.PI * 0.45)), visorMat);
    visor.position.set(0, 0.115, 0.025);
    this.headGroup.add(visor);

    // Build Bilateral Legs (Right = -X, Left = +X)
    const buildLeg = (
      side: -1 | 1,
      hipGrp: THREE.Group,
      kneeGrp: THREE.Group,
      ankleGrp: THREE.Group,
      quadMat: THREE.MeshStandardMaterial,
      hamMat: THREE.MeshStandardMaterial,
      calfMat: THREE.MeshStandardMaterial,
    ) => {
      hipGrp.position.set(side * 0.105, -0.05, 0);
      this.pelvisGroup.add(hipGrp);

      const hipJoint = new THREE.Mesh(this.trackGeo(new THREE.SphereGeometry(0.056, 14, 12)), trimMat);
      hipGrp.add(hipJoint);

      const thighMesh = new THREE.Mesh(this.trackGeo(new THREE.CylinderGeometry(0.068, 0.055, 0.40, 14)), suitMat);
      thighMesh.position.y = -0.20;
      thighMesh.castShadow = !this.isSoftwareGl;
      hipGrp.add(thighMesh);

      const quadMesh = new THREE.Mesh(this.trackGeo(new THREE.CapsuleGeometry(0.036, 0.22, 6, 12)), quadMat);
      quadMesh.position.set(0, -0.19, 0.044);
      hipGrp.add(quadMesh);

      const hamMesh = new THREE.Mesh(this.trackGeo(new THREE.CapsuleGeometry(0.034, 0.21, 6, 12)), hamMat);
      hamMesh.position.set(0, -0.20, -0.042);
      hipGrp.add(hamMesh);

      kneeGrp.position.set(0, -0.40, 0);
      hipGrp.add(kneeGrp);

      const kneeJoint = new THREE.Mesh(this.trackGeo(new THREE.SphereGeometry(0.048, 14, 12)), trimMat);
      kneeGrp.add(kneeJoint);

      const shinMesh = new THREE.Mesh(this.trackGeo(new THREE.CylinderGeometry(0.052, 0.042, 0.40, 14)), suitMat);
      shinMesh.position.y = -0.20;
      shinMesh.castShadow = !this.isSoftwareGl;
      kneeGrp.add(shinMesh);

      const calfMesh = new THREE.Mesh(this.trackGeo(new THREE.CapsuleGeometry(0.032, 0.18, 6, 12)), calfMat);
      calfMesh.position.set(0, -0.16, -0.036);
      kneeGrp.add(calfMesh);

      ankleGrp.position.set(0, -0.40, 0);
      kneeGrp.add(ankleGrp);

      const bootMesh = new THREE.Mesh(this.trackGeo(new THREE.BoxGeometry(0.092, 0.055, 0.20)), bootMat);
      bootMesh.position.set(0, -0.03, 0.042);
      bootMesh.castShadow = !this.isSoftwareGl;
      ankleGrp.add(bootMesh);
    };

    buildLeg(-1, this.hipR, this.kneeR, this.ankleR, this.muscleMats.quadR, this.muscleMats.hamR, this.muscleMats.calfR);
    buildLeg(1, this.hipL, this.kneeL, this.ankleL, this.muscleMats.quadL, this.muscleMats.hamL, this.muscleMats.calfL);

    // Build Bilateral Arms
    const buildArm = (
      side: -1 | 1,
      shGrp: THREE.Group,
      elGrp: THREE.Group,
      wrGrp: THREE.Group,
      deltMat: THREE.MeshStandardMaterial,
      bicMat: THREE.MeshStandardMaterial,
    ) => {
      shGrp.position.set(side * 0.21, 0.27, 0);
      this.thoraxGroup.add(shGrp);

      const deltMesh = new THREE.Mesh(this.trackGeo(new THREE.SphereGeometry(0.056, 14, 12)), deltMat);
      shGrp.add(deltMesh);

      const upperArm = new THREE.Mesh(this.trackGeo(new THREE.CylinderGeometry(0.044, 0.038, 0.27, 12)), suitMat);
      upperArm.position.y = -0.135;
      upperArm.castShadow = !this.isSoftwareGl;
      shGrp.add(upperArm);

      const bicMesh = new THREE.Mesh(this.trackGeo(new THREE.CapsuleGeometry(0.026, 0.13, 6, 10)), bicMat);
      bicMesh.position.set(0, -0.135, 0.028);
      shGrp.add(bicMesh);

      elGrp.position.set(0, -0.27, 0);
      shGrp.add(elGrp);

      const elJoint = new THREE.Mesh(this.trackGeo(new THREE.SphereGeometry(0.036, 12, 10)), trimMat);
      elGrp.add(elJoint);

      const forearm = new THREE.Mesh(this.trackGeo(new THREE.CylinderGeometry(0.036, 0.030, 0.24, 12)), suitMat);
      forearm.position.y = -0.12;
      forearm.castShadow = !this.isSoftwareGl;
      elGrp.add(forearm);

      wrGrp.position.set(0, -0.24, 0);
      elGrp.add(wrGrp);

      const glove = new THREE.Mesh(this.trackGeo(new THREE.BoxGeometry(0.052, 0.065, 0.048)), trimMat);
      glove.position.y = -0.025;
      wrGrp.add(glove);
    };

    buildArm(-1, this.shoulderR, this.elbowR, this.wristR, this.muscleMats.deltoidR, this.muscleMats.bicepsR);
    buildArm(1, this.shoulderL, this.elbowL, this.wristL, this.muscleMats.deltoidL, this.muscleMats.bicepsL);
  }

  private buildBiomechanicalOverlays() {
    // 1. Live Joint Angle Goniometer Arc
    this.angleArcMat = this.trackMat(
      new THREE.MeshBasicMaterial({
        color: 0x10b981,
        transparent: true,
        opacity: 0.65,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    const ringGeo = this.trackGeo(new THREE.RingGeometry(0.09, 0.165, 28, 1, 0, Math.PI * 0.5));
    this.angleArcMesh = new THREE.Mesh(ringGeo, this.angleArcMat);
    this.angleArcMesh.rotation.y = Math.PI / 2;
    this.angleOverlayGroup.add(this.angleArcMesh);

    const armGeo = this.trackGeo(new THREE.BoxGeometry(0.008, 0.22, 0.008));
    const refMat = this.trackMat(new THREE.MeshBasicMaterial({ color: 0x38bdf8 }));
    this.angleArmRef = new THREE.Mesh(armGeo, refMat);
    this.angleArmLive = new THREE.Mesh(armGeo, this.angleArcMat);
    this.angleOverlayGroup.add(this.angleArmRef);
    this.angleOverlayGroup.add(this.angleArmLive);
    this.scene.add(this.angleOverlayGroup);

    // 2. Ground-Reaction Force (GRF) Vector Arrow
    this.forceMat = this.trackMat(
      new THREE.MeshBasicMaterial({
        color: 0x22d3ee,
        transparent: true,
        opacity: 0.85,
      }),
    );
    this.forceShaftMesh = new THREE.Mesh(this.trackGeo(new THREE.CylinderGeometry(0.012, 0.012, 1, 10)), this.forceMat);
    this.forceHeadMesh = new THREE.Mesh(this.trackGeo(new THREE.ConeGeometry(0.032, 0.085, 14)), this.forceMat);
    this.forceOverlayGroup.add(this.forceShaftMesh);
    this.forceOverlayGroup.add(this.forceHeadMesh);
    this.scene.add(this.forceOverlayGroup);
  }

  public updateConfig(
    protocol: ExerciseProtocol,
    severity: SeverityLevelId,
    formQuality: FormQuality,
    isPlaying: boolean,
    isEvaluating: boolean,
    speedMultiplier: number,
    overlays: SimOverlayOptions,
  ) {
    const modeChanged = this.protocol.id !== protocol.id;
    this.protocol = protocol;
    this.severity = severity;
    this.formQuality = formQuality;
    this.isPlaying = isPlaying;
    this.isEvaluating = isEvaluating;
    this.speedMultiplier = speedMultiplier;
    this.overlays = overlays;
    this.angleOverlayGroup.visible = overlays.showAngles;
    this.forceOverlayGroup.visible = overlays.showForce;

    if (modeChanged) {
      this.phaseRad = 0;
      this.repCount = 1;
    }
  }

  public restart() {
    this.phaseRad = 0;
    this.repCount = 1;
  }

  public setCameraPreset(preset: SimCameraPreset) {
    const p = SIM_CAMERAS[preset];
    if (!p) return;
    this.camAnim.pos.set(p.pos[0], p.pos[1], p.pos[2]);
    this.camAnim.target.set(p.target[0], p.target[1], p.target[2]);
    this.camAnim.active = true;
  }

  private resetPose() {
    this.pelvisGroup.position.set(0, 0.96, 0);
    this.pelvisGroup.rotation.set(0, 0, 0);
    this.lumbarGroup.rotation.set(0, 0, 0);
    this.thoraxGroup.rotation.set(0, 0, 0);
    this.headGroup.rotation.set(0, 0, 0);

    [this.hipR, this.hipL, this.kneeR, this.kneeL, this.ankleR, this.ankleL].forEach((g) => g.rotation.set(0, 0, 0));
    [this.shoulderR, this.shoulderL, this.elbowR, this.elbowL, this.wristR, this.wristL].forEach((g) => g.rotation.set(0, 0, 0));
  }

  private updateCableMesh(mesh: THREE.Mesh, from: THREE.Vector3, to: THREE.Vector3) {
    _vA.copy(from).add(to).multiplyScalar(0.5);
    mesh.position.copy(_vA);
    const dist = Math.max(0.01, from.distanceTo(to));
    mesh.scale.set(1, dist, 1);
    _vB.copy(to).sub(from).normalize();
    mesh.quaternion.setFromUnitVectors(_vUp, _vB);
  }

  private applyPose(phase: number) {
    this.resetPose();
    const spec = getExerciseBiomechanics(this.protocol.id);
    const dosing = spec.severityDosing[this.severity];
    const isOptimal = this.formQuality === 'optimal';

    // Smooth wave 0 -> 1 -> 0 across a rep
    const cycle = (1 - Math.cos(phase)) * 0.5;
    const depth = (isOptimal ? 1.0 : 0.56) * dosing.depthScale;
    const eff = cycle * depth;

    const mode = this.protocol.kinematicMode;
    let primaryAngleDeg = spec.standingAngleDeg;
    let secondaryAngleDeg = spec.secondaryOptimalDeg;

    if (mode === 'squat') {
      const hipFlex = eff * 1.15; // radians forward/up
      const kneeFlex = eff * 1.48;
      const trunkLean = isOptimal ? eff * 0.24 : eff * 0.58;
      const valgus = isOptimal ? 0 : eff * 0.14;
      const asymShift = isOptimal ? 0 : eff * 0.045;

      this.hipR.rotation.set(-hipFlex, 0, valgus);
      this.hipL.rotation.set(-hipFlex, 0, valgus * 0.5);
      this.kneeR.rotation.set(kneeFlex, 0, 0);
      this.kneeL.rotation.set(kneeFlex, 0, 0);
      this.ankleR.rotation.set(-kneeFlex + hipFlex * 0.55, 0, 0);
      this.ankleL.rotation.set(-kneeFlex + hipFlex * 0.55, 0, 0);

      // Keep feet grounded on plate (~y = 0.06)
      const dropY = 0.40 * (1 - Math.cos(hipFlex)) + 0.40 * (1 - Math.cos(kneeFlex - hipFlex));
      this.pelvisGroup.position.set(asymShift, 0.96 - dropY * 0.72, -eff * 0.09);
      this.lumbarGroup.rotation.set(trunkLean * 0.65, 0, isOptimal ? 0 : -0.08 * eff);
      this.thoraxGroup.rotation.set(trunkLean * 0.45, 0, 0);

      // Arms hold back-squat bar across upper traps
      this.shoulderR.rotation.set(-0.35, 0, -0.52);
      this.shoulderL.rotation.set(-0.35, 0, 0.52);
      this.elbowR.rotation.set(-1.75, 0, 0);
      this.elbowL.rotation.set(-1.75, 0, 0);

      // Position bar on shoulders
      this.thoraxGroup.updateMatrixWorld(true);
      this.thoraxGroup.localToWorld(_vA.set(0, 0.27, -0.11));
      this.aredBarGroup.position.copy(_vA);
      this.aredBarGroup.rotation.set(0, 0, isOptimal ? 0 : 0.08 * eff);

      primaryAngleDeg = Math.round(spec.standingAngleDeg - (spec.standingAngleDeg - spec.optimalPeakAngleDeg) * eff);
      secondaryAngleDeg = Math.round(172 - (172 - spec.secondaryOptimalDeg) * eff);
    } else if (mode === 'heel_raise') {
      const lift = eff * 0.085;
      const anklePlantar = eff * 0.52;
      this.pelvisGroup.position.set(isOptimal ? 0 : eff * 0.03, 0.96 + lift, 0);
      this.ankleR.rotation.set(anklePlantar, 0, isOptimal ? 0 : 0.12 * eff);
      this.ankleL.rotation.set(anklePlantar, 0, 0);
      this.lumbarGroup.rotation.set(isOptimal ? 0.03 : 0.16 * eff, 0, 0);

      this.shoulderR.rotation.set(0.1, 0, -0.25);
      this.shoulderL.rotation.set(0.1, 0, 0.25);
      this.elbowR.rotation.set(-1.35, 0, 0);
      this.elbowL.rotation.set(-1.35, 0, 0);

      this.thoraxGroup.updateMatrixWorld(true);
      this.thoraxGroup.localToWorld(_vA.set(0, 0.30, 0.02));
      this.aredBarGroup.position.copy(_vA);
      this.aredBarGroup.rotation.set(0, 0, 0);

      primaryAngleDeg = Math.round(spec.standingAngleDeg + (spec.optimalPeakAngleDeg - spec.standingAngleDeg) * eff);
      secondaryAngleDeg = isOptimal ? 176 : Math.round(176 - 18 * eff);
    } else if (mode === 'deadlift') {
      const hipHinge = eff * 1.05;
      const kneeBend = eff * 0.36;
      const lumbarRound = isOptimal ? eff * 0.08 : eff * 0.44;

      this.hipR.rotation.set(-hipHinge, 0, 0);
      this.hipL.rotation.set(-hipHinge, 0, 0);
      this.kneeR.rotation.set(kneeBend, 0, 0);
      this.kneeL.rotation.set(kneeBend, 0, 0);
      this.ankleR.rotation.set(-kneeBend * 0.65, 0, 0);
      this.ankleL.rotation.set(-kneeBend * 0.65, 0, 0);

      this.pelvisGroup.position.set(0, 0.96 - eff * 0.16, -eff * 0.12);
      this.lumbarGroup.rotation.set(lumbarRound, 0, isOptimal ? 0 : 0.12 * eff);
      this.thoraxGroup.rotation.set(lumbarRound * 0.6, 0, 0);

      // Arms hang vertically holding bar in front of thighs/shins
      const armHang = hipHinge * 0.85 + lumbarRound * 0.9;
      this.shoulderR.rotation.set(-armHang * 0.15 + 0.12, 0, -0.06);
      this.shoulderL.rotation.set(-armHang * 0.15 + 0.12, 0, 0.06);
      // Keep arms perpendicular to floor
      this.shoulderR.rotation.x = -(hipHinge + lumbarRound * 1.2) + 0.08;
      this.shoulderL.rotation.x = -(hipHinge + lumbarRound * 1.2) + 0.08;

      this.wristR.updateMatrixWorld(true);
      this.wristR.getWorldPosition(_vA);
      this.wristL.getWorldPosition(_vB);
      this.aredBarGroup.position.copy(_vA).add(_vB).multiplyScalar(0.5);
      this.aredBarGroup.rotation.set(0, 0, 0);

      primaryAngleDeg = Math.round(spec.standingAngleDeg - (spec.standingAngleDeg - spec.optimalPeakAngleDeg) * eff);
      secondaryAngleDeg = Math.round(isOptimal ? 6 : 6 + 22 * eff);
    } else if (mode === 'hip_abduction') {
      const abd = eff * 0.68;
      this.hipR.rotation.set(0, 0, -abd);
      this.pelvisGroup.rotation.set(0, 0, isOptimal ? 0 : 0.18 * eff);
      this.lumbarGroup.rotation.set(0, 0, isOptimal ? 0 : -0.14 * eff);
      this.shoulderR.rotation.set(0, 0, -0.14);
      this.shoulderL.rotation.set(0, 0, 0.14);

      this.ankleR.updateMatrixWorld(true);
      this.ankleR.getWorldPosition(_vA);
      this.aredBarGroup.position.set(0, 0.18, -0.18);
      this.aredBarGroup.rotation.set(0, 0, 0);

      primaryAngleDeg = Math.round(spec.standingAngleDeg + (spec.optimalPeakAngleDeg - spec.standingAngleDeg) * eff);
      secondaryAngleDeg = Math.round(isOptimal ? 3 : 3 + 14 * eff);
    } else if (mode === 'bicep_curl') {
      const curl = eff * 2.15;
      this.shoulderR.rotation.set(isOptimal ? 0.05 : 0.28 * eff, 0, -0.06);
      this.shoulderL.rotation.set(isOptimal ? 0.05 : 0.18 * eff, 0, 0.06);
      this.elbowR.rotation.set(-curl, 0, 0);
      this.elbowL.rotation.set(-curl * (isOptimal ? 1 : 0.82), 0, 0);
      this.lumbarGroup.rotation.set(isOptimal ? 0 : -0.15 * eff, 0, 0);

      this.wristR.updateMatrixWorld(true);
      this.wristR.getWorldPosition(_vA);
      this.wristL.getWorldPosition(_vB);
      this.aredBarGroup.position.copy(_vA).add(_vB).multiplyScalar(0.5);
      this.aredBarGroup.rotation.set(0, 0, isOptimal ? 0 : -0.08 * eff);

      primaryAngleDeg = Math.round(spec.standingAngleDeg - (spec.standingAngleDeg - spec.optimalPeakAngleDeg) * eff);
      secondaryAngleDeg = Math.round(isOptimal ? 4 : 4 + 18 * eff);
    } else {
      // overhead_press
      const press = eff * 1.92;
      this.shoulderR.rotation.set(-0.85 - press, 0, -0.25 + eff * 0.12);
      this.shoulderL.rotation.set(-0.85 - press, 0, 0.25 - eff * 0.12);
      this.elbowR.rotation.set(-1.65 + eff * 1.48, 0, 0);
      this.elbowL.rotation.set(-1.65 + eff * 1.48, 0, 0);
      this.lumbarGroup.rotation.set(isOptimal ? 0 : -0.22 * eff, 0, 0);

      this.wristR.updateMatrixWorld(true);
      this.wristR.getWorldPosition(_vA);
      this.wristL.getWorldPosition(_vB);
      this.aredBarGroup.position.copy(_vA).add(_vB).multiplyScalar(0.5);
      this.aredBarGroup.rotation.set(0, 0, isOptimal ? 0 : 0.1 * eff);

      primaryAngleDeg = Math.round(spec.standingAngleDeg + (spec.optimalPeakAngleDeg - spec.standingAngleDeg) * eff);
      secondaryAngleDeg = Math.round(48 + 124 * eff);
    }

    // Update ARED resistance cables from floor cylinders to bar ends
    this.updateCableMesh(
      this.cableMeshL,
      _vA.set(0.437, 0.99, -0.22),
      _vB.set(this.aredBarGroup.position.x + 0.52, this.aredBarGroup.position.y, this.aredBarGroup.position.z),
    );
    this.updateCableMesh(
      this.cableMeshR,
      _vA.set(-0.437, 0.99, -0.22),
      _vB.set(this.aredBarGroup.position.x - 0.52, this.aredBarGroup.position.y, this.aredBarGroup.position.z),
    );

    // Update target muscle recruitment glow
    const showMuscles = this.overlays.showMuscles;
    const rFactor = showMuscles ? (0.18 + eff * (isOptimal ? 1.45 : 0.65)) : 0.05;
    const lFactor = showMuscles ? (0.18 + eff * (isOptimal ? 1.45 : 1.05)) : 0.05;

    const resetGlow = (m: THREE.MeshStandardMaterial | null) => {
      if (m) m.emissiveIntensity = 0.05;
    };
    Object.values(this.muscleMats).forEach(resetGlow);

    if (mode === 'squat') {
      if (this.muscleMats.quadR) this.muscleMats.quadR.emissiveIntensity = rFactor;
      if (this.muscleMats.quadL) this.muscleMats.quadL.emissiveIntensity = lFactor;
      if (this.muscleMats.gluteR) this.muscleMats.gluteR.emissiveIntensity = rFactor * 0.9;
      if (this.muscleMats.gluteL) this.muscleMats.gluteL.emissiveIntensity = lFactor * 0.9;
      if (this.muscleMats.hamR) this.muscleMats.hamR.emissiveIntensity = rFactor * 0.6;
      if (this.muscleMats.hamL) this.muscleMats.hamL.emissiveIntensity = lFactor * 0.6;
    } else if (mode === 'heel_raise') {
      if (this.muscleMats.calfR) this.muscleMats.calfR.emissiveIntensity = rFactor;
      if (this.muscleMats.calfL) this.muscleMats.calfL.emissiveIntensity = lFactor;
    } else if (mode === 'deadlift') {
      if (this.muscleMats.erector) this.muscleMats.erector.emissiveIntensity = (rFactor + lFactor) * 0.55;
      if (this.muscleMats.gluteR) this.muscleMats.gluteR.emissiveIntensity = rFactor;
      if (this.muscleMats.gluteL) this.muscleMats.gluteL.emissiveIntensity = lFactor;
      if (this.muscleMats.hamR) this.muscleMats.hamR.emissiveIntensity = rFactor * 0.85;
      if (this.muscleMats.hamL) this.muscleMats.hamL.emissiveIntensity = lFactor * 0.85;
    } else if (mode === 'hip_abduction') {
      if (this.muscleMats.gluteR) this.muscleMats.gluteR.emissiveIntensity = rFactor;
      if (this.muscleMats.quadR) this.muscleMats.quadR.emissiveIntensity = rFactor * 0.75;
    } else if (mode === 'bicep_curl') {
      if (this.muscleMats.bicepsR) this.muscleMats.bicepsR.emissiveIntensity = rFactor;
      if (this.muscleMats.bicepsL) this.muscleMats.bicepsL.emissiveIntensity = lFactor;
      if (this.muscleMats.deltoidR) this.muscleMats.deltoidR.emissiveIntensity = rFactor * 0.45;
      if (this.muscleMats.deltoidL) this.muscleMats.deltoidL.emissiveIntensity = lFactor * 0.45;
    } else {
      if (this.muscleMats.deltoidR) this.muscleMats.deltoidR.emissiveIntensity = rFactor;
      if (this.muscleMats.deltoidL) this.muscleMats.deltoidL.emissiveIntensity = lFactor;
      if (this.muscleMats.bicepsR) this.muscleMats.bicepsR.emissiveIntensity = rFactor * 0.6;
      if (this.muscleMats.bicepsL) this.muscleMats.bicepsL.emissiveIntensity = lFactor * 0.6;
    }

    // Update Joint Angle Goniometer Overlay position & color
    const anchorJoint =
      mode === 'squat'
        ? this.kneeR
        : mode === 'heel_raise'
          ? this.ankleR
          : mode === 'deadlift' || mode === 'hip_abduction'
            ? this.hipR
            : mode === 'bicep_curl'
              ? this.elbowR
              : this.shoulderR;
    anchorJoint.updateMatrixWorld(true);
    anchorJoint.getWorldPosition(_vA);
    this.angleOverlayGroup.position.copy(_vA);
    this.angleOverlayGroup.position.x -= 0.08;
    this.angleArcMat.color.setHex(isOptimal ? 0x10b981 : 0xf59e0b);
    this.angleArmLive.rotation.x = eff * 1.2;

    // Update Ground-Reaction Force Vector scaling
    const baseForce = spec.peakForceBwByLevel[this.severity];
    const instantForce = Number((0.85 + (baseForce - 0.85) * eff).toFixed(2));
    const arrowH = 0.22 + (instantForce / 2.6) * 0.48;
    this.forceOverlayGroup.position.set(0, 0.06, 0.28);
    this.forceShaftMesh.scale.set(1, arrowH, 1);
    this.forceShaftMesh.position.y = arrowH * 0.5;
    this.forceHeadMesh.position.y = arrowH + 0.04;
    this.forceMat.color.setHex(isOptimal ? 0x22d3ee : 0xf59e0b);

    // Emit live telemetry to React HUD (~15Hz)
    const now = performance.now();
    if (now - this.lastTelemetryEmit >= 65) {
      this.lastTelemetryEmit = now;
      const normPhase = ((phase % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
      const cycleProgress = normPhase / (Math.PI * 2);
      const phaseIndex = cycleProgress < 0.15 ? 0 : cycleProgress < 0.48 ? 1 : cycleProgress < 0.62 ? 2 : 3;

      const emgLeftUv = Math.round((isOptimal ? 535 : 440) * (0.28 + eff * 0.72));
      const emgRightUv = Math.round((isOptimal ? 520 : 285) * (0.28 + eff * 0.72));
      const symmetryPct = isOptimal ? 95 - Math.round(eff * 2) : 64 + Math.round((1 - eff) * 8);

      this.onTelemetry({
        rep: this.repCount,
        totalReps: dosing.reps,
        phaseIndex,
        phaseLabelEn: spec.phasesEn[phaseIndex],
        phaseLabelAr: spec.phasesAr[phaseIndex],
        cycleProgress,
        primaryAngleDeg,
        secondaryAngleDeg,
        instantForceBw: instantForce,
        emgRightUv,
        emgLeftUv,
        symmetryPct,
      });
    }
  }

  private afterDraw(cb: () => void) {
    const rawGl = this.renderer.getContext();
    const gl = typeof WebGL2RenderingContext !== 'undefined' && rawGl instanceof WebGL2RenderingContext ? rawGl : null;
    const sync = gl ? gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0) : null;
    if (!gl || !sync) {
      this.frameId = window.setTimeout(cb, 80);
      return;
    }
    gl.flush();
    const poll = () => {
      if (this.disposed) return;
      const st = gl.getSyncParameter(sync, gl.SYNC_STATUS);
      if (st === gl.UNSIGNALED) {
        this.frameId = window.setTimeout(poll, 5);
      } else {
        gl.deleteSync(sync);
        this.frameId = window.setTimeout(cb, 80);
      }
    };
    this.frameId = window.setTimeout(poll, 5);
  }

  private startLoop() {
    const tick = () => {
      if (this.disposed) return;
      const now = performance.now();
      const dt = Math.min(0.05, Math.max(0.001, (now - this.prevTime) / 1000));
      this.prevTime = now;

      const spec = getExerciseBiomechanics(this.protocol.id);
      const dosing = spec.severityDosing[this.severity];

      if (this.isPlaying || this.isEvaluating) {
        const speed = ((Math.PI * 2) / dosing.cadenceSec) * this.speedMultiplier;
        const prev = this.phaseRad;
        this.phaseRad += dt * speed;
        if (Math.floor(this.phaseRad / (Math.PI * 2)) > Math.floor(prev / (Math.PI * 2))) {
          this.repCount = (this.repCount % dosing.reps) + 1;
        }
      }

      if (this.camAnim.active) {
        this.camera.position.x = THREE.MathUtils.damp(this.camera.position.x, this.camAnim.pos.x, 7, dt);
        this.camera.position.y = THREE.MathUtils.damp(this.camera.position.y, this.camAnim.pos.y, 7, dt);
        this.camera.position.z = THREE.MathUtils.damp(this.camera.position.z, this.camAnim.pos.z, 7, dt);
        this.controls.target.x = THREE.MathUtils.damp(this.controls.target.x, this.camAnim.target.x, 7, dt);
        this.controls.target.y = THREE.MathUtils.damp(this.controls.target.y, this.camAnim.target.y, 7, dt);
        this.controls.target.z = THREE.MathUtils.damp(this.controls.target.z, this.camAnim.target.z, 7, dt);
        if (this.camera.position.distanceTo(this.camAnim.pos) < 0.015) {
          this.camAnim.active = false;
        }
      }

      this.applyPose(this.phaseRad);
      this.controls.update();
      this.renderer.render(this.scene, this.camera);

      if (this.isSoftwareGl) {
        this.afterDraw(tick);
      } else {
        this.frameId = window.requestAnimationFrame(tick);
      }
    };

    if (this.isSoftwareGl) {
      this.afterDraw(tick);
    } else {
      this.frameId = window.requestAnimationFrame(tick);
    }
  }

  private onResize = () => {
    if (!this.mountEl || this.mountEl.clientWidth === 0) return;
    const w = this.mountEl.clientWidth;
    const h = this.mountEl.clientHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  };

  public dispose() {
    this.disposed = true;
    window.cancelAnimationFrame(this.frameId);
    window.clearTimeout(this.frameId);
    window.removeEventListener('resize', this.onResize);
    this.controls.dispose();
    this.geometries.forEach((g) => g.dispose());
    this.materials.forEach((m) => m.dispose());
    this.textures.forEach((t) => t.dispose());
    this.envRT.dispose();
    this.renderer.dispose();
  }
}
