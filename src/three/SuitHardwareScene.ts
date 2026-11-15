import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import {
  BONE_DEFINITIONS,
  BoneSegment,
  DEFAULT_STATUS_COLORS,
  SUIT_SENSORS,
  SensorType,
  StatusColorPalette,
  SuitLayerMode,
  resolveBoneColorHex,
} from '../domain/osteosense';
import {
  BodyEnvelopePanel,
  buildAnatomicalSkeleton,
  buildBodyEnvelope,
  buildNeurovascularPlexus,
  buildSculptedBrain,
  createCorticalBoneBumpTexture,
  createFresnelBodyShaderMaterial,
  createHologramAuraTexture,
} from './ProceduralSkeletonBuilder';

export type CameraPresetKey = 'full' | 'thorax' | 'pelvis' | 'tibia' | 'posterior';

export const CAMERA_PRESETS: Record<
  CameraPresetKey,
  { pos: [number, number, number]; target: [number, number, number]; labelEn: string; labelAr: string }
> = {
  full: {
    pos: [0, 1.18, 3.08],
    target: [0, 0.96, 0],
    labelEn: 'Full Body',
    labelAr: 'الجسم الكامل',
  },
  thorax: {
    pos: [0.18, 1.38, 1.46],
    target: [0, 1.3, 0],
    labelEn: 'Thorax & Spine',
    labelAr: 'الصدر والعمود',
  },
  pelvis: {
    pos: [0.22, 0.88, 1.42],
    target: [0, 0.78, 0],
    labelEn: 'Pelvis & Femur',
    labelAr: 'الحوض والفخذ',
  },
  tibia: {
    pos: [0.24, 0.36, 1.3],
    target: [0, 0.28, 0],
    labelEn: 'Tibia & Foot',
    labelAr: 'الساق والقدم',
  },
  posterior: {
    pos: [0.15, 1.18, -2.85],
    target: [0, 0.98, 0],
    labelEn: 'Posterior Array',
    labelAr: 'المنظور الخلفي',
  },
};

export interface HoverPayload {
  kind: 'bone' | 'sensor';
  id: string;
  x: number;
  y: number;
}

export interface SuitSceneCallbacks {
  onSelectBone: (boneId: string) => void;
  onSelectSensor: (sensorId: string) => void;
  onHoverItem: (item: HoverPayload | null) => void;
}

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

function createPedestalTexture(maxAniso: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.clearRect(0, 0, 512, 512);
    ctx.translate(256, 256);

    const grad = ctx.createRadialGradient(0, 0, 20, 0, 0, 246);
    grad.addColorStop(0, 'rgba(34, 211, 238, 0.16)');
    grad.addColorStop(0.68, 'rgba(15, 23, 42, 0.38)');
    grad.addColorStop(0.92, 'rgba(34, 211, 238, 0.42)');
    grad.addColorStop(1, 'rgba(34, 211, 238, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, 246, 0, Math.PI * 2);
    ctx.fill();

    [125, 180, 224].forEach((r, idx) => {
      ctx.strokeStyle = idx === 2 ? 'rgba(103, 232, 249, 0.92)' : 'rgba(34, 211, 238, 0.42)';
      ctx.lineWidth = idx === 2 ? 4 : 2;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.stroke();
    });

    for (let i = 0; i < 36; i++) {
      const a = (i / 36) * Math.PI * 2;
      const r0 = i % 3 === 0 ? 186 : 196;
      const r1 = 214;
      ctx.strokeStyle = i % 3 === 0 ? 'rgba(103, 232, 249, 0.8)' : 'rgba(34, 211, 238, 0.32)';
      ctx.lineWidth = i % 3 === 0 ? 2.5 : 1.2;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * r0, Math.sin(a) * r0);
      ctx.lineTo(Math.cos(a) * r1, Math.sin(a) * r1);
      ctx.stroke();
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAniso || 1;
  return tex;
}

export class SuitHardwareScene {
  private mountEl: HTMLElement;
  private callbacks: SuitSceneCallbacks;
  private isSoftwareGl: boolean;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private controls: OrbitControls;
  private envRT: THREE.WebGLRenderTarget;

  private boneMaterials = new Map<string, THREE.MeshStandardMaterial>();
  private boneMeshes: THREE.Mesh[] = [];
  private brainGroup!: THREE.Group;
  private neuroGroup!: THREE.Group;

  private sensorMeshes: THREE.Mesh[] = [];
  private sensorGroups: Array<{ id: string; type: SensorType; group: THREE.Group }> = [];
  private wireMeshes: Array<{ mesh: THREE.Mesh; type: SensorType }> = [];

  private suitPbrMat: THREE.MeshStandardMaterial;
  private fresnelMat: THREE.ShaderMaterial;
  private suitPanels: BodyEnvelopePanel[] = [];

  private scanRing: THREE.Mesh;
  private scanRingMat: THREE.MeshBasicMaterial;
  private scanActive = false;
  private scanProgress = 0;

  private layerMode: SuitLayerMode = 'xray';
  private sensorFilter: SensorType | 'ALL' = 'ALL';
  private selectedBoneId: string | null = null;
  private selectedSensorId: string | null = null;
  private drawerOpen = false;
  private currentBones: BoneSegment[] = [];
  private currentPalette: StatusColorPalette = DEFAULT_STATUS_COLORS;

  private camAnim = {
    active: false,
    pos: new THREE.Vector3(),
    target: new THREE.Vector3(),
  };

  private raycaster = new THREE.Raycaster();
  private pointer = new THREE.Vector2();
  private pointerDownPos = { x: 0, y: 0 };
  private lastMoveTime = 0;

  private geometries: THREE.BufferGeometry[] = [];
  private materials: THREE.Material[] = [];
  private textures: THREE.Texture[] = [];

  private frameId = 0;
  private renderBusy = false;
  private renderDirty = false;
  private prevTime = performance.now();
  private shaderElapsed = 0;
  private disposed = false;

  constructor(mountEl: HTMLElement, initialBones: BoneSegment[], callbacks: SuitSceneCallbacks) {
    this.mountEl = mountEl;
    this.callbacks = callbacks;
    this.currentBones = initialBones;
    this.isSoftwareGl = detectSoftwareWebGL();

    const width = mountEl.clientWidth || 720;
    const height = mountEl.clientHeight || 560;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x060911);
    this.scene.fog = new THREE.FogExp2(0x060911, 0.052);

    this.camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 40);
    const p = CAMERA_PRESETS.full;
    this.camera.position.set(p.pos[0], p.pos[1], p.pos[2]);

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.92;
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
    this.controls.minDistance = 0.85;
    this.controls.maxDistance = 5.4;
    this.controls.maxPolarAngle = Math.PI * 0.56;
    this.controls.target.set(p.target[0], p.target[1], p.target[2]);
    this.controls.update();

    this.controls.addEventListener('start', () => {
      this.camAnim.active = false;
      this.requestRender();
    });
    this.controls.addEventListener('change', () => {
      this.requestRender();
    });

    // Balanced Matte Studio Lighting Rig (no harsh glare or bottom glow)
    const hemi = new THREE.HemisphereLight(0xdbeafe, 0x0f172a, 0.52);
    this.scene.add(hemi);

    const keyLight = new THREE.DirectionalLight(0xf1f5f9, 0.88);
    keyLight.position.set(2.4, 3.6, 2.8);
    if (!this.isSoftwareGl) {
      keyLight.castShadow = true;
      keyLight.shadow.mapSize.set(1024, 1024);
      keyLight.shadow.camera.left = -1.6;
      keyLight.shadow.camera.right = 1.6;
      keyLight.shadow.camera.top = 2.4;
      keyLight.shadow.camera.bottom = -0.4;
      keyLight.shadow.bias = -0.0005;
      keyLight.shadow.normalBias = 0.02;
    }
    this.scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x64748b, 0.32);
    rimLight.position.set(-2.2, 2.2, -2.5);
    this.scene.add(rimLight);

    // Lab Grid & Pedestal with Radial Hologram Aura
    const grid = new THREE.GridHelper(16, 36, 0x164e63, 0x0f172a);
    grid.position.y = -0.002;
    this.scene.add(grid);

    const maxAniso = this.renderer.capabilities.getMaxAnisotropy();
    const pedTex = this.trackTex(createPedestalTexture(maxAniso));
    const auraTex = this.trackTex(createHologramAuraTexture(maxAniso));

    const pedBaseMat = this.trackMat(
      new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.78, roughness: 0.32 }),
    );
    const pedTrimMat = this.trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x38bdf8,
        emissive: 0x06b6d4,
        emissiveIntensity: 0.38,
        roughness: 0.35,
        metalness: 0.4,
      }),
    );
    const pedDecalMat = this.trackMat(
      new THREE.MeshBasicMaterial({
        map: pedTex,
        transparent: true,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -1,
      }),
    );
    const auraMat = this.trackMat(
      new THREE.MeshBasicMaterial({
        map: auraTex,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        opacity: 0.36,
      }),
    );

    const pedGroup = new THREE.Group();
    const baseCyl = new THREE.Mesh(this.trackGeo(new THREE.CylinderGeometry(0.68, 0.78, 0.06, 48)), pedBaseMat);
    baseCyl.position.y = 0.03;
    baseCyl.receiveShadow = true;
    pedGroup.add(baseCyl);

    const topPlate = new THREE.Mesh(this.trackGeo(new THREE.CylinderGeometry(0.62, 0.66, 0.02, 48)), pedBaseMat);
    topPlate.position.y = 0.068;
    topPlate.receiveShadow = true;
    pedGroup.add(topPlate);

    const glowRing = new THREE.Mesh(this.trackGeo(new THREE.TorusGeometry(0.64, 0.011, 16, 64)), pedTrimMat);
    glowRing.rotation.x = Math.PI / 2;
    glowRing.position.y = 0.078;
    pedGroup.add(glowRing);

    const decalDisc = new THREE.Mesh(this.trackGeo(new THREE.CircleGeometry(0.61, 48)), pedDecalMat);
    decalDisc.rotation.x = -Math.PI / 2;
    decalDisc.position.y = 0.081;
    pedGroup.add(decalDisc);

    const auraDisc = new THREE.Mesh(this.trackGeo(new THREE.CircleGeometry(0.58, 48)), auraMat);
    auraDisc.rotation.x = -Math.PI / 2;
    auraDisc.position.y = 0.083;
    auraDisc.renderOrder = 0;
    pedGroup.add(auraDisc);

    this.scene.add(pedGroup);

    // Cortical Bone Bump Texture & Per-Bone Diagnostic Materials
    const boneBumpTex = this.trackTex(createCorticalBoneBumpTexture(maxAniso));
    BONE_DEFINITIONS.forEach((b) => {
      const mat = this.trackMat(
        new THREE.MeshStandardMaterial({
          color: DEFAULT_STATUS_COLORS.unassessed,
          emissive: 0x000000,
          emissiveIntensity: 0,
          roughness: 0.82,
          metalness: 0.02,
          envMapIntensity: 0.12,
          bumpMap: boneBumpTex,
          bumpScale: 0.0045,
        }),
      );
      this.boneMaterials.set(b.id, mat);
    });

    // Build Procedural 18-Bone Anatomical Skeleton + Brain + Neurovascular Plexus
    const skeletonRoot = new THREE.Group();
    skeletonRoot.position.y = 0.082;
    this.scene.add(skeletonRoot);

    this.boneMeshes = buildAnatomicalSkeleton(
      skeletonRoot,
      this.boneMaterials,
      this.trackGeo.bind(this),
      this.trackMat.bind(this),
      this.isSoftwareGl,
    );

    const brainAssets = buildSculptedBrain(
      skeletonRoot,
      this.trackGeo.bind(this),
      this.trackMat.bind(this),
    );
    this.brainGroup = brainAssets.group;

    const neuroAssets = buildNeurovascularPlexus(
      skeletonRoot,
      this.trackGeo.bind(this),
      this.trackMat.bind(this),
    );
    this.neuroGroup = neuroAssets.group;

    // Sculpted Anatomical Body Envelope (GLSL Fresnel Hologram + Full Suit PBR)
    this.fresnelMat = this.trackMat(createFresnelBodyShaderMaterial());
    this.suitPbrMat = this.trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x0f1b2e,
        metalness: 0.28,
        roughness: 0.62,
        transparent: true,
        opacity: 0.94,
        depthWrite: true,
        side: THREE.FrontSide,
      }),
    );

    const suitRoot = new THREE.Group();
    suitRoot.position.y = 0.082;
    this.scene.add(suitRoot);
    this.suitPanels = buildBodyEnvelope(suitRoot, this.fresnelMat, this.trackGeo.bind(this));

    // Telemetry Hub + 30 Sensors + Wiring
    const sensorRoot = new THREE.Group();
    sensorRoot.position.y = 0.082;
    this.scene.add(sensorRoot);
    this.buildSensorArray(sensorRoot);

    // Ultrasound Sweep Ring
    this.scanRingMat = this.trackMat(
      new THREE.MeshBasicMaterial({
        color: 0x22d3ee,
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    this.scanRing = new THREE.Mesh(this.trackGeo(new THREE.TorusGeometry(0.46, 0.009, 12, 48)), this.scanRingMat);
    this.scanRing.rotation.x = Math.PI / 2;
    this.scanRing.renderOrder = 6;
    this.scanRing.visible = false;
    this.scene.add(this.scanRing);

    // Event Listeners
    this.renderer.domElement.addEventListener('pointerdown', this.onPointerDown);
    this.renderer.domElement.addEventListener('pointermove', this.onPointerMove);
    this.renderer.domElement.addEventListener('pointerup', this.onPointerUp);
    window.addEventListener('resize', this.onResize);

    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }

    this.syncVisuals();
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

  private buildSensorArray(root: THREE.Group) {
    const hubMat = this.trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x1e293b,
        metalness: 0.68,
        roughness: 0.25,
        emissive: 0x06b6d4,
        emissiveIntensity: 0.32,
      }),
    );
    const hubMesh = new THREE.Mesh(this.trackGeo(new THREE.BoxGeometry(0.11, 0.075, 0.026)), hubMat);
    hubMesh.position.set(0, 1.29, 0.125);
    hubMesh.renderOrder = 5;
    root.add(hubMesh);

    // Composite QUS Ultrasound Transducer Pod materials & shared geometries
    const qusPadMat = this.trackMat(
      new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.85, metalness: 0.05 }),
    );
    const qusHousingMat = this.trackMat(
      new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.24, metalness: 0.88 }),
    );
    const qusBridgeMat = this.trackMat(
      new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.36, metalness: 0.65 }),
    );
    const qusPiezoMat = this.trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x67e8f9,
        emissive: 0x06b6d4,
        emissiveIntensity: 1.05,
        metalness: 0.35,
        roughness: 0.18,
      }),
    );

    const qusPadGeo = this.trackGeo(new THREE.CylinderGeometry(0.019, 0.021, 0.004, 18));
    qusPadGeo.rotateX(Math.PI / 2);
    const qusCollarGeo = this.trackGeo(new THREE.CylinderGeometry(0.0155, 0.0175, 0.009, 18));
    qusCollarGeo.rotateX(Math.PI / 2);
    const qusPiezoGeo = this.trackGeo(new THREE.SphereGeometry(0.0052, 12, 10));
    qusPiezoGeo.scale(1, 1, 0.45);
    const qusBridgeGeo = this.trackGeo(new THREE.BoxGeometry(0.023, 0.0075, 0.007));
    const qusRingGeo = this.trackGeo(new THREE.TorusGeometry(0.0165, 0.0017, 8, 24));
    const qusBootGeo = this.trackGeo(new THREE.CylinderGeometry(0.0028, 0.004, 0.012, 10));

    // Composite Bipolar Ag/AgCl EMG Electrode Patch materials & shared geometries
    const emgFoamMat = this.trackMat(
      new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.78, metalness: 0.05 }),
    );
    const emgSnapMat = this.trackMat(
      new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.18, metalness: 0.92 }),
    );
    const emgPodMat = this.trackMat(
      new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.38, metalness: 0.55 }),
    );
    const emgLedMat = this.trackMat(
      new THREE.MeshStandardMaterial({
        color: 0xc084fc,
        emissive: 0x9333ea,
        emissiveIntensity: 0.95,
        metalness: 0.3,
        roughness: 0.22,
      }),
    );

    const padW = 0.0085;
    const padH = 0.0105;
    const emgShape = new THREE.Shape();
    emgShape.absarc(0, padH, padW, 0, Math.PI, false);
    emgShape.absarc(0, -padH, padW, Math.PI, Math.PI * 2, false);
    emgShape.closePath();
    const emgFoamGeo = this.trackGeo(
      new THREE.ExtrudeGeometry(emgShape, {
        depth: 0.0024,
        bevelEnabled: true,
        bevelThickness: 0.0008,
        bevelSize: 0.0008,
        bevelSegments: 2,
      }),
    );
    emgFoamGeo.center();

    const emgSnapGeo = this.trackGeo(new THREE.CylinderGeometry(0.0042, 0.0048, 0.0038, 14));
    emgSnapGeo.rotateX(Math.PI / 2);
    const emgPodGeo = this.trackGeo(new THREE.BoxGeometry(0.011, 0.008, 0.0055));
    const emgLedGeo = this.trackGeo(new THREE.BoxGeometry(0.0075, 0.0024, 0.0022));
    const emgBootGeo = this.trackGeo(new THREE.CylinderGeometry(0.002, 0.0028, 0.009, 8));

    const wireQusMat = this.trackMat(new THREE.MeshBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.55 }));
    const wireEmgMat = this.trackMat(new THREE.MeshBasicMaterial({ color: 0xa855f7, transparent: true, opacity: 0.42 }));

    const zAxis = new THREE.Vector3(0, 0, 1);
    const normalVec = new THREE.Vector3();

    SUIT_SENSORS.forEach((s, idx) => {
      const isQus = s.type === 'QUS';
      const group = new THREE.Group();
      group.position.set(s.position[0], s.position[1], s.position[2]);

      normalVec.set(s.normal[0], s.normal[1], s.normal[2]);
      if (normalVec.lengthSq() > 0.0001) {
        normalVec.normalize();
        group.quaternion.setFromUnitVectors(zAxis, normalVec);
      }

      const tagPart = (mesh: THREE.Mesh) => {
        mesh.renderOrder = 5;
        mesh.userData.sensorId = s.id;
        mesh.userData.sensorType = s.type;
        mesh.userData.boneId = s.targetBoneIds[0] || null;
        group.add(mesh);
        this.sensorMeshes.push(mesh);
      };

      if (isQus) {
        const pad = new THREE.Mesh(qusPadGeo, qusPadMat);
        pad.position.z = 0.002;
        tagPart(pad);

        const collar = new THREE.Mesh(qusCollarGeo, qusHousingMat);
        collar.position.z = 0.0075;
        tagPart(collar);

        const emitterL = new THREE.Mesh(qusPiezoGeo, qusPiezoMat);
        emitterL.position.set(-0.007, 0, 0.0118);
        tagPart(emitterL);

        const emitterR = new THREE.Mesh(qusPiezoGeo, qusPiezoMat);
        emitterR.position.set(0.007, 0, 0.0118);
        tagPart(emitterR);

        const bridge = new THREE.Mesh(qusBridgeGeo, qusBridgeMat);
        bridge.position.set(0, 0, 0.012);
        tagPart(bridge);

        const bezel = new THREE.Mesh(qusRingGeo, qusPiezoMat);
        bezel.position.set(0, 0, 0.0115);
        tagPart(bezel);

        const boot = new THREE.Mesh(qusBootGeo, qusBridgeMat);
        boot.position.set(0, 0.019, 0.006);
        tagPart(boot);
      } else {
        const foam = new THREE.Mesh(emgFoamGeo, emgFoamMat);
        foam.position.z = 0.0016;
        tagPart(foam);

        const snapTop = new THREE.Mesh(emgSnapGeo, emgSnapMat);
        snapTop.position.set(0, 0.0095, 0.0044);
        tagPart(snapTop);

        const snapBottom = new THREE.Mesh(emgSnapGeo, emgSnapMat);
        snapBottom.position.set(0, -0.0095, 0.0044);
        tagPart(snapBottom);

        const pod = new THREE.Mesh(emgPodGeo, emgPodMat);
        pod.position.set(0, 0, 0.0054);
        tagPart(pod);

        const led = new THREE.Mesh(emgLedGeo, emgLedMat);
        led.position.set(0, 0, 0.0085);
        tagPart(led);

        const boot = new THREE.Mesh(emgBootGeo, emgPodMat);
        boot.position.set(0, 0.019, 0.003);
        tagPart(boot);
      }

      root.add(group);
      this.sensorGroups.push({ id: s.id, type: s.type, group });

      if (isQus || idx % 3 === 0) {
        const midX = s.position[0] * 0.52 + (s.position[0] >= 0 ? 0.03 : -0.03);
        const midY = (s.position[1] + 1.29) * 0.5;
        const curve = new THREE.CatmullRomCurve3([
          new THREE.Vector3(0, 1.29, 0.12),
          new THREE.Vector3(midX, midY, 0.105),
          new THREE.Vector3(s.position[0], s.position[1], s.position[2]),
        ]);
        const tubeGeo = this.trackGeo(new THREE.TubeGeometry(curve, 14, 0.0026, 6, false));
        const wireMesh = new THREE.Mesh(tubeGeo, isQus ? wireQusMat : wireEmgMat);
        wireMesh.renderOrder = 5;
        root.add(wireMesh);
        this.wireMeshes.push({ mesh: wireMesh, type: s.type });
      }
    });
  }

  public updateBones(bones: BoneSegment[], palette: StatusColorPalette) {
    this.currentBones = bones;
    this.currentPalette = palette;
    this.syncVisuals();
  }

  public setLayerMode(mode: SuitLayerMode) {
    this.layerMode = mode;
    this.syncVisuals();
  }

  public setSensorFilter(filter: SensorType | 'ALL') {
    this.sensorFilter = filter;
    this.syncVisuals();
  }

  public setSelection(boneId: string | null, sensorId: string | null) {
    this.selectedBoneId = boneId;
    this.selectedSensorId = sensorId;
    this.syncVisuals();
  }

  public setDrawerOpen(open: boolean) {
    if (this.drawerOpen === open) return;
    this.drawerOpen = open;
    this.requestRender();
  }

  public setPreset(preset: CameraPresetKey) {
    const p = CAMERA_PRESETS[preset];
    if (!p) return;
    this.camAnim.pos.set(p.pos[0], p.pos[1], p.pos[2]);
    this.camAnim.target.set(p.target[0], p.target[1], p.target[2]);
    this.camAnim.active = true;
    this.requestRender();
  }

  public focusOnPoint(point: [number, number, number], offset: [number, number, number] = [0.22, 0.12, 1.18]) {
    const yWorld = point[1] + 0.082;
    this.camAnim.target.set(point[0], yWorld, point[2]);
    this.camAnim.pos.set(point[0] + offset[0], yWorld + offset[1], point[2] + offset[2]);
    this.camAnim.active = true;
    this.requestRender();
  }

  public triggerQusScan() {
    this.scanActive = true;
    this.scanProgress = 0;
    this.requestRender();
  }

  private syncVisuals() {
    this.currentBones.forEach((b) => {
      const mat = this.boneMaterials.get(b.id);
      if (!mat) return;
      const hex = resolveBoneColorHex(b, this.currentPalette);
      mat.color.set(hex);
      mat.emissive.setHex(0x000000);
      mat.emissiveIntensity = 0;
    });

    const isFull = this.layerMode === 'full';
    const isExploded = this.layerMode === 'exploded';

    // Inside-out X-ray vs Full Suit shell rendering
    this.brainGroup.visible = !isFull;
    this.neuroGroup.visible = !isFull;

    this.fresnelMat.uniforms.uOpacity.value = isExploded ? 0.56 : 0.44;
    this.suitPanels.forEach((sp) => {
      sp.mesh.material = isFull ? this.suitPbrMat : this.fresnelMat;
      sp.mesh.renderOrder = isFull ? 3 : 4;
    });

    this.sensorGroups.forEach((g) => {
      const visible = this.sensorFilter === 'ALL' || this.sensorFilter === g.type;
      g.group.visible = visible;
      const isSelected = g.id === this.selectedSensorId;
      g.group.scale.setScalar(isSelected ? 1.55 : 1.0);
    });

    this.sensorMeshes.forEach((m) => {
      const stype = m.userData.sensorType as SensorType;
      m.visible = this.sensorFilter === 'ALL' || this.sensorFilter === stype;
    });

    this.wireMeshes.forEach((w) => {
      w.mesh.visible = this.sensorFilter === 'ALL' || this.sensorFilter === w.type;
    });

    this.requestRender();
  }

  private updatePointer(ev: PointerEvent) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
  }

  private onPointerDown = (ev: PointerEvent) => {
    this.pointerDownPos = { x: ev.clientX, y: ev.clientY };
  };

  private onPointerMove = (ev: PointerEvent) => {
    const now = Date.now();
    if (now - this.lastMoveTime < 35) return;
    this.lastMoveTime = now;

    this.updatePointer(ev);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const visibleSensors = this.sensorMeshes.filter((m) => m.visible);
    const hits = this.raycaster.intersectObjects([...visibleSensors, ...this.boneMeshes], false);

    if (hits.length > 0) {
      const hitObj = hits[0].object;
      const sid = hitObj.userData.sensorId as string | undefined;
      const bid = hitObj.userData.boneId as string | undefined;
      const rect = this.mountEl.getBoundingClientRect();
      const x = Math.min(rect.width - 180, Math.max(12, ev.clientX - rect.left + 12));
      const y = Math.max(12, ev.clientY - rect.top - 28);

      if (sid) {
        this.renderer.domElement.style.cursor = 'pointer';
        this.callbacks.onHoverItem({ kind: 'sensor', id: sid, x, y });
        return;
      }
      if (bid) {
        this.renderer.domElement.style.cursor = 'pointer';
        this.callbacks.onHoverItem({ kind: 'bone', id: bid, x, y });
        return;
      }
    }

    this.renderer.domElement.style.cursor = 'grab';
    this.callbacks.onHoverItem(null);
  };

  private onPointerUp = (ev: PointerEvent) => {
    const dx = ev.clientX - this.pointerDownPos.x;
    const dy = ev.clientY - this.pointerDownPos.y;
    if (dx * dx + dy * dy > 25) return;

    this.updatePointer(ev);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const visibleSensors = this.sensorMeshes.filter((m) => m.visible);
    const hits = this.raycaster.intersectObjects([...visibleSensors, ...this.boneMeshes], false);

    if (hits.length > 0) {
      const hitObj = hits[0].object;
      const sid = hitObj.userData.sensorId as string | undefined;
      const bid = hitObj.userData.boneId as string | undefined;
      if (sid) {
        this.callbacks.onSelectSensor(sid);
      } else if (bid) {
        this.callbacks.onSelectBone(bid);
      }
    }
  };

  private onResize = () => {
    if (!this.mountEl || this.mountEl.clientWidth === 0) return;
    const w = this.mountEl.clientWidth;
    const h = this.mountEl.clientHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.requestRender();
  };

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

  public requestRender() {
    if (this.disposed) return;
    if (this.renderBusy) {
      this.renderDirty = true;
      return;
    }
    this.renderBusy = true;
    this.frameId = window.requestAnimationFrame((now) => {
      if (this.disposed) return;
      this.renderDirty = false;
      const dt = Math.min(0.05, Math.max(0.001, (now - this.prevTime) / 1000));
      this.prevTime = now;
      this.shaderElapsed += dt;
      this.fresnelMat.uniforms.uTime.value = this.shaderElapsed;

      let needsMore = false;
      const explodeFactor = this.layerMode === 'exploded' ? 1 : 0;

      for (const sp of this.suitPanels) {
        const tx = sp.base[0] + sp.explode[0] * explodeFactor;
        const ty = sp.base[1] + sp.explode[1] * explodeFactor;
        const tz = sp.base[2] + sp.explode[2] * explodeFactor;
        if (
          Math.abs(sp.mesh.position.x - tx) > 0.002 ||
          Math.abs(sp.mesh.position.y - ty) > 0.002 ||
          Math.abs(sp.mesh.position.z - tz) > 0.002
        ) {
          sp.mesh.position.x = THREE.MathUtils.damp(sp.mesh.position.x, tx, 7.5, dt);
          sp.mesh.position.y = THREE.MathUtils.damp(sp.mesh.position.y, ty, 7.5, dt);
          sp.mesh.position.z = THREE.MathUtils.damp(sp.mesh.position.z, tz, 7.5, dt);
          needsMore = true;
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
        } else {
          needsMore = true;
        }
      }

      if (this.scanActive) {
        this.scanProgress += dt * 0.48;
        if (this.scanProgress >= 1) {
          this.scanActive = false;
          this.scanRing.visible = false;
          this.scanRingMat.opacity = 0;
        } else {
          const wave = Math.sin(this.scanProgress * Math.PI);
          this.scanRing.visible = true;
          this.scanRing.position.y = 0.14 + wave * 1.76;
          this.scanRingMat.opacity = 0.85 * Math.sin(this.scanProgress * Math.PI);
          needsMore = true;
        }
      }

      if (this.controls.update() || needsMore) {
        this.renderDirty = true;
      }

      this.renderer.render(this.scene, this.camera);

      const done = () => {
        this.renderBusy = false;
        if (this.renderDirty && !this.disposed) this.requestRender();
      };
      if (this.isSoftwareGl) this.afterDraw(done);
      else done();
    });
  }

  public dispose() {
    this.disposed = true;
    window.cancelAnimationFrame(this.frameId);
    window.clearTimeout(this.frameId);
    window.removeEventListener('resize', this.onResize);
    this.renderer.domElement.removeEventListener('pointerdown', this.onPointerDown);
    this.renderer.domElement.removeEventListener('pointermove', this.onPointerMove);
    this.renderer.domElement.removeEventListener('pointerup', this.onPointerUp);
    this.controls.dispose();
    this.geometries.forEach((g) => g.dispose());
    this.materials.forEach((m) => m.dispose());
    this.textures.forEach((t) => t.dispose());
    this.envRT.dispose();
    this.renderer.dispose();
  }
}
