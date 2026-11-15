import * as THREE from 'three';

export interface BodyEnvelopePanel {
  mesh: THREE.Mesh;
  base: [number, number, number];
  explode: [number, number, number];
}

export interface NeurovascularAssets {
  group: THREE.Group;
  materials: THREE.MeshStandardMaterial[];
}

export interface SculptedBrainAssets {
  group: THREE.Group;
  material: THREE.MeshPhysicalMaterial;
}

type TrackGeoFn = <T extends THREE.BufferGeometry>(g: T) => T;
type TrackMatFn = <T extends THREE.Material>(m: T) => T;

/**
 * Generates a procedural cortical bone bump texture with longitudinal Haversian
 * canal striations and subtle trabecular grain (linear data texture).
 */
export function createCorticalBoneBumpTexture(maxAniso: number): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  if (ctx) {
    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, size, size);

    // Deterministic pseudo-random generator for crisp, repeatable osteon grain
    let seed = 42197;
    const rand = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };

    // Subtle longitudinal cortical fiber striations
    for (let i = 0; i < 420; i++) {
      const x = rand() * size;
      const y = rand() * size;
      const len = 28 + rand() * 110;
      const w = 0.6 + rand() * 1.8;
      const shade = Math.round(105 + rand() * 48);
      ctx.strokeStyle = `rgba(${shade}, ${shade}, ${shade}, 0.28)`;
      ctx.lineWidth = w;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + (rand() - 0.5) * 4, y + len);
      ctx.stroke();
    }

    // Fine trabecular micro-pores
    for (let i = 0; i < 1600; i++) {
      const x = rand() * size;
      const y = rand() * size;
      const r = 0.5 + rand() * 1.9;
      const dark = rand() > 0.45 ? 92 : 164;
      ctx.fillStyle = `rgba(${dark}, ${dark}, ${dark}, 0.16)`;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 2);
  tex.anisotropy = maxAniso || 1;
  return tex;
}

/**
 * Generates a radial hologram aura texture for the scanner base emitter disc.
 */
export function createHologramAuraTexture(maxAniso: number): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  if (ctx) {
    ctx.clearRect(0, 0, size, size);
    ctx.translate(size / 2, size / 2);

    const radial = ctx.createRadialGradient(0, 0, 12, 0, 0, 248);
    radial.addColorStop(0, 'rgba(34, 211, 238, 0.42)');
    radial.addColorStop(0.32, 'rgba(56, 189, 248, 0.22)');
    radial.addColorStop(0.68, 'rgba(14, 165, 233, 0.09)');
    radial.addColorStop(1, 'rgba(14, 165, 233, 0)');
    ctx.fillStyle = radial;
    ctx.beginPath();
    ctx.arc(0, 0, 248, 0, Math.PI * 2);
    ctx.fill();

    // Fine radial hologram emitter ticks
    for (let i = 0; i < 48; i++) {
      const a = (i / 48) * Math.PI * 2;
      const inner = i % 4 === 0 ? 52 : 95;
      const outer = 228;
      ctx.strokeStyle = i % 4 === 0 ? 'rgba(103, 232, 249, 0.28)' : 'rgba(56, 189, 248, 0.1)';
      ctx.lineWidth = i % 4 === 0 ? 1.5 : 0.8;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * inner, Math.sin(a) * inner);
      ctx.lineTo(Math.cos(a) * outer, Math.sin(a) * outer);
      ctx.stroke();
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAniso || 1;
  return tex;
}

/**
 * Custom GLSL Fresnel hologram shader for the sculpted anatomical body envelope.
 */
export function createFresnelBodyShaderMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uRimColor: { value: new THREE.Color(0x38bdf8) },
      uCoreColor: { value: new THREE.Color(0x0b1f3a) },
      uTime: { value: 0 },
      uOpacity: { value: 0.48 },
      uRimPower: { value: 2.2 },
    },
    vertexShader: `
      varying vec3 vWorldNormal;
      varying vec3 vWorldPosition;
      varying float vLocalY;

      void main() {
        vec4 worldPos = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPos.xyz;
        vWorldNormal = normalize(mat3(modelMatrix) * normal);
        vLocalY = worldPos.y;
        gl_Position = projectionMatrix * viewMatrix * worldPos;
      }
    `,
    fragmentShader: `
      uniform vec3 uRimColor;
      uniform vec3 uCoreColor;
      uniform float uTime;
      uniform float uOpacity;
      uniform float uRimPower;

      varying vec3 vWorldNormal;
      varying vec3 vWorldPosition;
      varying float vLocalY;

      void main() {
        vec3 N = normalize(vWorldNormal);
        vec3 V = normalize(cameraPosition - vWorldPosition);
        float ndotv = abs(dot(N, V));
        float fresnel = pow(1.0 - clamp(ndotv, 0.0, 1.0), uRimPower);

        // Subtle holographic micro-scanlines
        float scan = 0.88 + 0.12 * sin(vLocalY * 145.0 - uTime * 2.4);
        vec3 col = mix(uCoreColor, uRimColor, clamp(fresnel * 1.15, 0.0, 1.0)) * scan;
        float alpha = clamp((0.06 + fresnel * 0.88) * uOpacity, 0.0, 0.92);

        gl_FragColor = vec4(col, alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    side: THREE.FrontSide,
    blending: THREE.NormalBlending,
  });
}

function makeBonePart(
  root: THREE.Group,
  boneId: string,
  geo: THREE.BufferGeometry,
  mat: THREE.Material,
  trackGeo: TrackGeoFn,
  boneMeshes: THREE.Mesh[],
  isSoftwareGl: boolean,
  pos: [number, number, number],
  rot?: [number, number, number] | null,
  scale?: [number, number, number] | null,
): THREE.Mesh {
  trackGeo(geo);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(pos[0], pos[1], pos[2]);
  if (rot) mesh.rotation.set(rot[0], rot[1], rot[2]);
  if (scale) mesh.scale.set(scale[0], scale[1], scale[2]);
  mesh.castShadow = !isSoftwareGl;
  mesh.receiveShadow = true;
  mesh.renderOrder = 1;
  mesh.userData.boneId = boneId;
  root.add(mesh);
  boneMeshes.push(mesh);
  return mesh;
}

/**
 * Creates a tapered anatomical long-bone shaft with flared proximal & distal epiphyses.
 */
function createLongBoneLathe(
  length: number,
  midRadius: number,
  proxRadius: number,
  distRadius: number,
  radialSegments = 14,
): THREE.LatheGeometry {
  const half = length * 0.5;
  const pts = [
    new THREE.Vector2(0.001, -half),
    new THREE.Vector2(distRadius * 0.9, -half + length * 0.04),
    new THREE.Vector2(distRadius, -half + length * 0.11),
    new THREE.Vector2(midRadius * 1.12, -half + length * 0.24),
    new THREE.Vector2(midRadius, 0),
    new THREE.Vector2(midRadius * 1.14, half - length * 0.24),
    new THREE.Vector2(proxRadius, half - length * 0.1),
    new THREE.Vector2(proxRadius * 0.85, half - length * 0.03),
    new THREE.Vector2(0.001, half),
  ];
  return new THREE.LatheGeometry(pts, radialSegments);
}

/**
 * Helper to create a curved tube bone between 3D waypoints.
 */
function createCurvedTube(
  points: Array<[number, number, number]>,
  radius: number,
  tubularSegments = 16,
  radialSegments = 9,
): THREE.TubeGeometry {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(p[0], p[1], p[2])));
  return new THREE.TubeGeometry(curve, tubularSegments, radius, radialSegments, false);
}

/**
 * Mirrors a BufferGeometry across the X axis while preserving outward-facing
 * triangle winding for both indexed and non-indexed geometries.
 */
function mirrorGeometryX(geo: THREE.BufferGeometry): THREE.BufferGeometry {
  geo.scale(-1, 1, 1);
  if (geo.index) {
    const idx = geo.index;
    for (let i = 0; i < idx.count; i += 3) {
      const b = idx.getX(i + 1);
      const c = idx.getX(i + 2);
      idx.setX(i + 1, c);
      idx.setX(i + 2, b);
    }
    idx.needsUpdate = true;
  } else {
    const pos = geo.getAttribute('position');
    const uv = geo.getAttribute('uv');
    const count = pos.count;
    for (let i = 0; i < count; i += 3) {
      const x1 = pos.getX(i + 1);
      const y1 = pos.getY(i + 1);
      const z1 = pos.getZ(i + 1);
      pos.setXYZ(i + 1, pos.getX(i + 2), pos.getY(i + 2), pos.getZ(i + 2));
      pos.setXYZ(i + 2, x1, y1, z1);

      if (uv) {
        const u1 = uv.getX(i + 1);
        const v1 = uv.getY(i + 1);
        uv.setXY(i + 1, uv.getX(i + 2), uv.getY(i + 2));
        uv.setXY(i + 2, u1, v1);
      }
    }
    pos.needsUpdate = true;
    if (uv) uv.needsUpdate = true;
  }
  geo.computeVertexNormals();
  return geo;
}

/**
 * Helper to place a bone segment directly between two 3D points (oriented along Y).
 */
function placeSegmentBetween(
  root: THREE.Group,
  boneId: string,
  from: [number, number, number],
  to: [number, number, number],
  rProx: number,
  rMid: number,
  rDist: number,
  mat: THREE.Material,
  trackGeo: TrackGeoFn,
  boneMeshes: THREE.Mesh[],
  isSoftwareGl: boolean,
  radialSegments = 12,
) {
  const vFrom = new THREE.Vector3(from[0], from[1], from[2]);
  const vTo = new THREE.Vector3(to[0], to[1], to[2]);
  const dir = vTo.clone().sub(vFrom);
  const len = Math.max(0.004, dir.length());
  const mid = vFrom.clone().add(vTo).multiplyScalar(0.5);

  const geo = createLongBoneLathe(len, rMid, rProx, rDist, radialSegments);
  trackGeo(geo);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.copy(mid);
  const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  mesh.quaternion.copy(quat);
  mesh.castShadow = !isSoftwareGl;
  mesh.receiveShadow = true;
  mesh.renderOrder = 1;
  mesh.userData.boneId = boneId;
  root.add(mesh);
  boneMeshes.push(mesh);
}

/**
 * Builds the 18-bone procedural anatomical skeleton with sculpted cranium,
 * 24-vertebra articulated spine + intervertebral discs, 12 rib pairs + costal cartilage,
 * clavicles + scapulae, contoured pelvis + sacrum/coccyx, A-pose arms + splayed 5-finger hands,
 * femurs with angled femoral necks & trochanters, patellae, tibiae/fibulae, and articulated feet.
 */
export function buildAnatomicalSkeleton(
  root: THREE.Group,
  boneMaterials: Map<string, THREE.MeshStandardMaterial>,
  trackGeo: TrackGeoFn,
  trackMat: TrackMatFn,
  isSoftwareGl: boolean,
): THREE.Mesh[] {
  const boneMeshes: THREE.Mesh[] = [];
  const getMat = (id: string) => boneMaterials.get(id)!;

  const cavityMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x050811,
      roughness: 0.92,
      metalness: 0.05,
    }),
  );

  const discMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x334155,
      emissive: 0x000000,
      emissiveIntensity: 0,
      roughness: 0.78,
      metalness: 0.04,
      envMapIntensity: 0.12,
    }),
  );

  const cartilageMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x7b8696,
      emissive: 0x000000,
      emissiveIntensity: 0,
      roughness: 0.72,
      metalness: 0.04,
      envMapIntensity: 0.12,
      transparent: true,
      opacity: 0.82,
    }),
  );

  const toothMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xb0b8c2,
      roughness: 0.68,
      metalness: 0.02,
      envMapIntensity: 0.12,
    }),
  );

  // =========================================================================
  // 1. CRANIUM & MANDIBLE ('cranium')
  // =========================================================================
  const craniumMat = getMat('cranium');

  // Sculpted neurocranium vault with anatomical parietal/occipital/frontal contour
  const vaultGeo = new THREE.SphereGeometry(0.086, 28, 22);
  const vPos = vaultGeo.attributes.position;
  for (let i = 0; i < vPos.count; i++) {
    let x = vPos.getX(i);
    let y = vPos.getY(i);
    let z = vPos.getZ(i);
    // Narrow laterally, elongate anteroposteriorly, taper gently toward temporal fossa
    x *= 0.84;
    y *= 0.96;
    z *= 1.08;
    if (z < 0 && y < 0.02) {
      // Occipital curvature
      z *= 1.06;
    }
    if (y < -0.025 && Math.abs(x) > 0.045) {
      // Temporal hollow indentation
      x *= 0.9;
    }
    vPos.setXYZ(i, x, y, z);
  }
  vaultGeo.computeVertexNormals();
  makeBonePart(root, 'cranium', vaultGeo, craniumMat, trackGeo, boneMeshes, isSoftwareGl, [0, 1.692, -0.008]);

  // Supraorbital brow ridge
  makeBonePart(
    root,
    'cranium',
    new THREE.TorusGeometry(0.046, 0.009, 10, 20, Math.PI * 0.72),
    craniumMat,
    trackGeo,
    boneMeshes,
    isSoftwareGl,
    [0, 1.672, 0.046],
    [Math.PI * 0.46, 0, Math.PI * 0.14],
    [1.08, 0.7, 0.85],
  );

  // Bilateral zygomatic arches (cheekbones) & orbital rims
  [-1, 1].forEach((side) => {
    makeBonePart(
      root,
      'cranium',
      createCurvedTube(
        [
          [side * 0.042, 1.64, 0.072],
          [side * 0.062, 1.644, 0.045],
          [side * 0.064, 1.648, 0.004],
        ],
        0.0075,
        12,
        8,
      ),
      craniumMat,
      trackGeo,
      boneMeshes,
      isSoftwareGl,
      [0, 0, 0],
    );

    // Orbital socket ring
    makeBonePart(
      root,
      'cranium',
      new THREE.TorusGeometry(0.017, 0.0045, 8, 16),
      craniumMat,
      trackGeo,
      boneMeshes,
      isSoftwareGl,
      [side * 0.029, 1.662, 0.074],
      [0.08, side * 0.18, 0],
    );

    // Deep dark orbital recess
    makeBonePart(
      root,
      'cranium',
      new THREE.SphereGeometry(0.016, 12, 10),
      cavityMat,
      trackGeo,
      boneMeshes,
      isSoftwareGl,
      [side * 0.029, 1.662, 0.068],
      null,
      [1.0, 0.92, 0.65],
    );
  });

  // Nasal bridge + dark nasal piriform cavity
  makeBonePart(
    root,
    'cranium',
    new THREE.BoxGeometry(0.014, 0.028, 0.016),
    craniumMat,
    trackGeo,
    boneMeshes,
    isSoftwareGl,
    [0, 1.652, 0.084],
    [-0.28, 0, 0],
  );
  makeBonePart(
    root,
    'cranium',
    new THREE.ConeGeometry(0.011, 0.024, 6),
    cavityMat,
    trackGeo,
    boneMeshes,
    isSoftwareGl,
    [0, 1.635, 0.08],
    [-0.1, 0, 0],
  );

  // Maxilla + upper dental arch
  makeBonePart(
    root,
    'cranium',
    new THREE.CylinderGeometry(0.036, 0.032, 0.032, 16, 1, false, -Math.PI * 0.45, Math.PI * 0.9),
    craniumMat,
    trackGeo,
    boneMeshes,
    isSoftwareGl,
    [0, 1.616, 0.045],
  );
  makeBonePart(
    root,
    'cranium',
    new THREE.TorusGeometry(0.026, 0.0045, 8, 16, Math.PI * 0.82),
    toothMat,
    trackGeo,
    boneMeshes,
    isSoftwareGl,
    [0, 1.598, 0.052],
    [Math.PI / 2, 0, Math.PI * 0.09],
  );

  // Articulated Mandible (chin, body, ascending rami)
  makeBonePart(
    root,
    'cranium',
    createCurvedTube(
      [
        [-0.048, 1.638, 0.018],
        [-0.044, 1.585, 0.034],
        [-0.024, 1.568, 0.068],
        [0, 1.564, 0.078],
        [0.024, 1.568, 0.068],
        [0.044, 1.585, 0.034],
        [0.048, 1.638, 0.018],
      ],
      0.0115,
      24,
      10,
    ),
    craniumMat,
    trackGeo,
    boneMeshes,
    isSoftwareGl,
    [0, 0, 0],
  );
  makeBonePart(
    root,
    'cranium',
    new THREE.TorusGeometry(0.024, 0.0042, 8, 16, Math.PI * 0.8),
    toothMat,
    trackGeo,
    boneMeshes,
    isSoftwareGl,
    [0, 1.584, 0.05],
    [Math.PI / 2, 0, Math.PI * 0.1],
  );

  // =========================================================================
  // 2. CERVICAL SPINE C1-C7 ('cervical-spine')
  // =========================================================================
  const cervMat = getMat('cervical-spine');
  for (let c = 0; c < 7; c++) {
    const t = c / 6;
    const cy = 1.452 + t * 0.122;
    const cz = -0.024 + Math.sin(t * Math.PI) * 0.012;
    const r = 0.021 - t * 0.003;

    // Vertebral body
    makeBonePart(
      root,
      'cervical-spine',
      new THREE.CylinderGeometry(r, r * 1.05, 0.013, 14),
      cervMat,
      trackGeo,
      boneMeshes,
      isSoftwareGl,
      [0, cy, cz],
      null,
      [1.1, 1, 0.88],
    );
    // Posterior spinous process
    makeBonePart(
      root,
      'cervical-spine',
      new THREE.BoxGeometry(0.007, 0.008, 0.024),
      cervMat,
      trackGeo,
      boneMeshes,
      isSoftwareGl,
      [0, cy - 0.002, cz - 0.022],
      [0.25, 0, 0],
    );
    // Bilateral transverse processes
    makeBonePart(
      root,
      'cervical-spine',
      new THREE.BoxGeometry(r * 2.7, 0.006, 0.009),
      cervMat,
      trackGeo,
      boneMeshes,
      isSoftwareGl,
      [0, cy, cz - 0.008],
    );
    // Intervertebral disc
    if (c < 6) {
      makeBonePart(
        root,
        'cervical-spine',
        new THREE.CylinderGeometry(r * 0.94, r * 0.94, 0.0055, 14),
        discMat,
        trackGeo,
        boneMeshes,
        isSoftwareGl,
        [0, cy + 0.01, cz],
        null,
        [1.06, 1, 0.86],
      );
    }
  }

  // =========================================================================
  // 3. CLAVICLES & SCAPULAE ('clavicle-scapula')
  // =========================================================================
  const clavMat = getMat('clavicle-scapula');
  const scapShape = new THREE.Shape();
  scapShape.moveTo(0, 0.068);
  scapShape.lineTo(0.072, 0.058);
  scapShape.quadraticCurveTo(0.085, 0.032, 0.066, -0.012);
  scapShape.lineTo(0.016, -0.074);
  scapShape.quadraticCurveTo(0.0, -0.062, 0, 0.068);

  const scapGeoBase = new THREE.ExtrudeGeometry(scapShape, {
    depth: 0.008,
    bevelEnabled: true,
    bevelThickness: 0.003,
    bevelSize: 0.003,
    bevelSegments: 2,
  });
  scapGeoBase.center();

  [-1, 1].forEach((side) => {
    // S-curved anatomical clavicle
    makeBonePart(
      root,
      'clavicle-scapula',
      createCurvedTube(
        [
          [side * 0.018, 1.418, 0.072],
          [side * 0.075, 1.432, 0.082],
          [side * 0.145, 1.428, 0.048],
          [side * 0.195, 1.425, 0.015],
        ],
        0.009,
        18,
        10,
      ),
      clavMat,
      trackGeo,
      boneMeshes,
      isSoftwareGl,
      [0, 0, 0],
    );

    // Scapula blade
    const scapGeo = side < 0 ? mirrorGeometryX(scapGeoBase.clone()) : scapGeoBase.clone();
    makeBonePart(
      root,
      'clavicle-scapula',
      scapGeo,
      clavMat,
      trackGeo,
      boneMeshes,
      isSoftwareGl,
      [side * 0.095, 1.345, -0.084],
      [0.14, side * -0.24, 0],
      [1, 1, 1],
    );

    // Scapular spine ridge & acromion overhang
    makeBonePart(
      root,
      'clavicle-scapula',
      createCurvedTube(
        [
          [side * 0.046, 1.375, -0.092],
          [side * 0.125, 1.402, -0.076],
          [side * 0.198, 1.422, 0.005],
        ],
        0.0085,
        14,
        8,
      ),
      clavMat,
      trackGeo,
      boneMeshes,
      isSoftwareGl,
      [0, 0, 0],
    );

    // Coracoid process hook
    makeBonePart(
      root,
      'clavicle-scapula',
      new THREE.CylinderGeometry(0.006, 0.008, 0.032, 8),
      clavMat,
      trackGeo,
      boneMeshes,
      isSoftwareGl,
      [side * 0.172, 1.396, 0.024],
      [1.1, 0, side * -0.45],
    );
  });
  scapGeoBase.dispose();

  // =========================================================================
  // 4. THORACIC SPINE (T1-T12), 12 RIB PAIRS + COSTAL CARTILAGE + STERNUM
  // =========================================================================
  const thorMat = getMat('thoracic-cage');

  // Sculpted Sternum (manubrium + body + xiphoid)
  const sternumShape = new THREE.Shape();
  sternumShape.moveTo(-0.025, 0.095);
  sternumShape.quadraticCurveTo(0, 0.084, 0.025, 0.095); // Jugular notch
  sternumShape.lineTo(0.028, 0.068);
  sternumShape.lineTo(0.017, 0.048);
  sternumShape.lineTo(0.019, -0.055);
  sternumShape.lineTo(0.009, -0.088);
  sternumShape.lineTo(0, -0.108); // Xiphoid tip
  sternumShape.lineTo(-0.009, -0.088);
  sternumShape.lineTo(-0.019, -0.055);
  sternumShape.lineTo(-0.017, 0.048);
  sternumShape.lineTo(-0.028, 0.068);
  sternumShape.closePath();

  const sternumGeo = new THREE.ExtrudeGeometry(sternumShape, {
    depth: 0.012,
    bevelEnabled: true,
    bevelThickness: 0.0035,
    bevelSize: 0.003,
    bevelSegments: 2,
  });
  sternumGeo.center();
  makeBonePart(
    root,
    'thoracic-cage',
    sternumGeo,
    thorMat,
    trackGeo,
    boneMeshes,
    isSoftwareGl,
    [0, 1.328, 0.094],
    [-0.14, 0, 0],
  );

  // 12 Thoracic Vertebrae (T1-T12) along natural kyphotic arc
  const thoracicCenters: Array<[number, number, number]> = [];
  for (let i = 0; i < 12; i++) {
    const t = i / 11;
    const vy = 1.434 - t * 0.252;
    const vz = -0.036 - Math.sin(t * Math.PI) * 0.028;
    const r = 0.019 + t * 0.007;
    thoracicCenters.push([0, vy, vz]);

    makeBonePart(
      root,
      'thoracic-cage',
      new THREE.CylinderGeometry(r, r * 1.04, 0.017, 14),
      thorMat,
      trackGeo,
      boneMeshes,
      isSoftwareGl,
      [0, vy, vz],
      null,
      [1.06, 1, 0.9],
    );
    makeBonePart(
      root,
      'thoracic-cage',
      new THREE.BoxGeometry(0.007, 0.008, 0.032),
      thorMat,
      trackGeo,
      boneMeshes,
      isSoftwareGl,
      [0, vy - 0.007, vz - 0.024],
      [0.48, 0, 0],
    );
    makeBonePart(
      root,
      'thoracic-cage',
      new THREE.BoxGeometry(r * 2.9, 0.007, 0.011),
      thorMat,
      trackGeo,
      boneMeshes,
      isSoftwareGl,
      [0, vy, vz - 0.011],
    );
    if (i < 11) {
      makeBonePart(
        root,
        'thoracic-cage',
        new THREE.CylinderGeometry(r * 0.94, r * 0.94, 0.0055, 14),
        discMat,
        trackGeo,
        boneMeshes,
        isSoftwareGl,
        [0, vy - 0.0115, vz],
        null,
        [1.04, 1, 0.88],
      );
    }
  }

  // 12 Pairs of Anatomical Ribs + Costal Cartilage
  for (let i = 0; i < 12; i++) {
    const t = i / 11;
    const [, vy, vz] = thoracicCenters[i];
    // Barrel profile widest around ribs 6-8
    const widthProfile = 0.088 + Math.sin(Math.pow(t, 0.72) * Math.PI * 0.9) * 0.068;
    const depthProfile = 0.072 + Math.sin(t * Math.PI * 0.86) * 0.042;
    const anteriorDrop = 0.024 + t * 0.044;
    const isFloating = i >= 10;
    const isFalse = i >= 7 && i <= 9;

    [-1, 1].forEach((side) => {
      const pts: Array<[number, number, number]> = [
        [side * 0.016, vy, vz - 0.005],
        [side * (widthProfile * 0.62), vy - 0.005, vz - 0.022],
        [side * widthProfile, vy - anteriorDrop * 0.45, vz + depthProfile * 0.56],
        [side * (widthProfile * 0.76), vy - anteriorDrop * 0.82, vz + depthProfile * 1.18],
      ];

      if (!isFloating) {
        const frontX = isFalse ? side * (0.048 + (i - 7) * 0.016) : side * 0.052;
        pts.push([frontX, vy - anteriorDrop, vz + depthProfile * 1.38]);
      }

      makeBonePart(
        root,
        'thoracic-cage',
        createCurvedTube(pts, isFloating ? 0.0046 : 0.0058, 22, 8),
        thorMat,
        trackGeo,
        boneMeshes,
        isSoftwareGl,
        [0, 0, 0],
      );

      // Costal cartilage joining true ribs (1-7) & false ribs (8-10) to sternum
      if (!isFloating) {
        const ribEnd = pts[pts.length - 1];
        const sternTargetY = isFalse ? 1.242 : Math.max(1.238, 1.402 - i * 0.025);
        const sternTargetZ = 0.088 + (1 - Math.abs(sternTargetY - 1.32) * 2) * 0.012;
        const sternTargetX = side * (isFalse ? 0.014 : 0.019);

        makeBonePart(
          root,
          'thoracic-cage',
          createCurvedTube(
            [
              ribEnd,
              [
                (ribEnd[0] + sternTargetX) * 0.5,
                (ribEnd[1] + sternTargetY) * 0.5 - 0.006,
                Math.max(ribEnd[2], sternTargetZ) + 0.008,
              ],
              [sternTargetX, sternTargetY, sternTargetZ],
            ],
            0.0046,
            10,
            7,
          ),
          cartilageMat,
          trackGeo,
          boneMeshes,
          isSoftwareGl,
          [0, 0, 0],
        );
      }
    });
  }

  // =========================================================================
  // 5. LUMBAR SPINE (L1-L5) ('lumbar-spine')
  // =========================================================================
  const lumMat = getMat('lumbar-spine');
  for (let l = 0; l < 5; l++) {
    const t = l / 4;
    const ly = 1.158 - t * 0.132;
    const lz = -0.03 + Math.sin(t * Math.PI) * 0.018;
    const r = 0.027 + t * 0.0045;

    makeBonePart(
      root,
      'lumbar-spine',
      new THREE.CylinderGeometry(r, r * 1.04, 0.024, 16),
      lumMat,
      trackGeo,
      boneMeshes,
      isSoftwareGl,
      [0, ly, lz],
      null,
      [1.14, 1, 0.92],
    );
    makeBonePart(
      root,
      'lumbar-spine',
      new THREE.BoxGeometry(0.009, 0.014, 0.032),
      lumMat,
      trackGeo,
      boneMeshes,
      isSoftwareGl,
      [0, ly - 0.002, lz - 0.032],
    );
    makeBonePart(
      root,
      'lumbar-spine',
      new THREE.BoxGeometry(r * 3.1, 0.008, 0.012),
      lumMat,
      trackGeo,
      boneMeshes,
      isSoftwareGl,
      [0, ly, lz - 0.014],
    );
    makeBonePart(
      root,
      'lumbar-spine',
      new THREE.CylinderGeometry(r * 0.95, r * 0.95, 0.008, 16),
      discMat,
      trackGeo,
      boneMeshes,
      isSoftwareGl,
      [0, ly - 0.0165, lz],
      null,
      [1.1, 1, 0.9],
    );
  }

  // =========================================================================
  // 6. PELVIC GIRDLE (ILIUM, ISCHIUM, PUBIS, SACRUM & COCCYX) ('pelvis')
  // =========================================================================
  const pelvMat = getMat('pelvis');

  // Sculpted Sacrum & Coccyx
  const sacrumShape = new THREE.Shape();
  sacrumShape.moveTo(-0.048, 0.052);
  sacrumShape.lineTo(0.048, 0.052);
  sacrumShape.quadraticCurveTo(0.042, 0.0, 0.018, -0.054);
  sacrumShape.lineTo(0, -0.078);
  sacrumShape.lineTo(-0.018, -0.054);
  sacrumShape.quadraticCurveTo(-0.042, 0.0, -0.048, 0.052);

  const sacrumGeo = new THREE.ExtrudeGeometry(sacrumShape, {
    depth: 0.022,
    bevelEnabled: true,
    bevelThickness: 0.005,
    bevelSize: 0.004,
    bevelSegments: 2,
  });
  sacrumGeo.center();
  makeBonePart(
    root,
    'pelvis',
    sacrumGeo,
    pelvMat,
    trackGeo,
    boneMeshes,
    isSoftwareGl,
    [0, 0.945, -0.052],
    [0.24, 0, 0],
  );

  // Iliac wing contour with obturator foramen cutout
  const iliumShape = new THREE.Shape();
  iliumShape.moveTo(0.015, 0.005);
  iliumShape.quadraticCurveTo(0.032, 0.068, 0.088, 0.082); // Iliac crest
  iliumShape.quadraticCurveTo(0.118, 0.068, 0.108, 0.018); // ASIS
  iliumShape.quadraticCurveTo(0.095, -0.018, 0.086, -0.046); // Acetabular margin
  iliumShape.quadraticCurveTo(0.078, -0.092, 0.045, -0.096); // Ischial tuberosity
  iliumShape.lineTo(0.005, -0.072); // Pubic symphysis
  iliumShape.quadraticCurveTo(0.018, -0.032, 0.015, 0.005);

  const obturatorHole = new THREE.Path();
  obturatorHole.absellipse(0.046, -0.062, 0.018, 0.015, 0, Math.PI * 2, true, 0);
  iliumShape.holes.push(obturatorHole);

  const iliumGeoBase = new THREE.ExtrudeGeometry(iliumShape, {
    depth: 0.018,
    bevelEnabled: true,
    bevelThickness: 0.005,
    bevelSize: 0.004,
    bevelSegments: 3,
  });

  [-1, 1].forEach((side) => {
    const wing = side < 0 ? mirrorGeometryX(iliumGeoBase.clone()) : iliumGeoBase.clone();

    makeBonePart(
      root,
      'pelvis',
      wing,
      pelvMat,
      trackGeo,
      boneMeshes,
      isSoftwareGl,
      [side * 0.025, 0.94, -0.02],
      [0.12, side * -0.52, side * -0.14],
    );

    // Acetabular socket cup
    makeBonePart(
      root,
      'pelvis',
      new THREE.TorusGeometry(0.026, 0.008, 10, 18),
      pelvMat,
      trackGeo,
      boneMeshes,
      isSoftwareGl,
      [side * 0.104, 0.878, 0.008],
      [0, side * Math.PI * 0.44, 0],
    );
  });
  iliumGeoBase.dispose();

  // Pubic symphysis bridge
  makeBonePart(
    root,
    'pelvis',
    new THREE.BoxGeometry(0.026, 0.026, 0.016),
    discMat,
    trackGeo,
    boneMeshes,
    isSoftwareGl,
    [0, 0.866, 0.048],
  );

  // =========================================================================
  // 7-10. A-POSE UPPER LIMBS + ARTICULATED SPLAYED 5-FINGER HANDS
  // =========================================================================
  [-1, 1].forEach((side) => {
    const humId = side < 0 ? 'humerus-right' : 'humerus-left';
    const radId = side < 0 ? 'radius-ulna-right' : 'radius-ulna-left';
    const humMat = getMat(humId);
    const radMat = getMat(radId);

    const shoulderPt: [number, number, number] = [side * 0.205, 1.404, 0.008];
    const elbowPt: [number, number, number] = [side * 0.268, 1.142, 0.014];
    const wristPt: [number, number, number] = [side * 0.342, 0.922, 0.034];

    // Humeral head & greater tubercle
    makeBonePart(
      root,
      humId,
      new THREE.SphereGeometry(0.025, 16, 14),
      humMat,
      trackGeo,
      boneMeshes,
      isSoftwareGl,
      [shoulderPt[0] - side * 0.008, shoulderPt[1], shoulderPt[2]],
    );
    // Humerus shaft
    placeSegmentBetween(
      root,
      humId,
      shoulderPt,
      elbowPt,
      0.018,
      0.013,
      0.019,
      humMat,
      trackGeo,
      boneMeshes,
      isSoftwareGl,
      14,
    );
    // Distal humeral epicondyles
    makeBonePart(
      root,
      humId,
      new THREE.CylinderGeometry(0.011, 0.011, 0.042, 10),
      humMat,
      trackGeo,
      boneMeshes,
      isSoftwareGl,
      elbowPt,
      [0, 0, Math.PI / 2],
    );

    // Radius (lateral) & Ulna (medial) in natural A-pose supinated angle
    const radElbow: [number, number, number] = [elbowPt[0] + side * 0.012, elbowPt[1] - 0.006, elbowPt[2] + 0.006];
    const radWrist: [number, number, number] = [wristPt[0] + side * 0.01, wristPt[1], wristPt[2] + 0.008];
    const ulnElbow: [number, number, number] = [elbowPt[0] - side * 0.01, elbowPt[1] + 0.008, elbowPt[2] - 0.008];
    const ulnWrist: [number, number, number] = [wristPt[0] - side * 0.009, wristPt[1] + 0.003, wristPt[2] - 0.007];

    placeSegmentBetween(
      root,
      radId,
      radElbow,
      radWrist,
      0.009,
      0.0075,
      0.011,
      radMat,
      trackGeo,
      boneMeshes,
      isSoftwareGl,
      10,
    );
    placeSegmentBetween(
      root,
      radId,
      ulnElbow,
      ulnWrist,
      0.0115,
      0.0075,
      0.007,
      radMat,
      trackGeo,
      boneMeshes,
      isSoftwareGl,
      10,
    );

    // Carpal arch cluster
    makeBonePart(
      root,
      radId,
      new THREE.BoxGeometry(0.038, 0.022, 0.016),
      radMat,
      trackGeo,
      boneMeshes,
      isSoftwareGl,
      [wristPt[0] + side * 0.004, wristPt[1] - 0.014, wristPt[2]],
      [0.08, side * 0.15, side * 0.22],
    );

    // Splayed 5-finger articulated hand (Thumb + Index + Middle + Ring + Pinky)
    const fingerSpecs = [
      // Thumb (2 phalanges, splayed anteriorly & laterally)
      { sx: side * 0.022, sz: 0.016, spread: side * 0.58, fwd: 0.25, mcLen: 0.032, phLengths: [0.022, 0.017], r: 0.0048 },
      // Index
      { sx: side * 0.015, sz: 0.006, spread: side * 0.26, fwd: 0.08, mcLen: 0.048, phLengths: [0.028, 0.02, 0.014], r: 0.0042 },
      // Middle
      { sx: side * 0.005, sz: 0.001, spread: side * 0.16, fwd: 0.05, mcLen: 0.05, phLengths: [0.032, 0.023, 0.015], r: 0.0044 },
      // Ring
      { sx: side * -0.005, sz: -0.004, spread: side * 0.07, fwd: 0.06, mcLen: 0.047, phLengths: [0.029, 0.021, 0.014], r: 0.004 },
      // Pinky
      { sx: side * -0.015, sz: -0.009, spread: side * -0.03, fwd: 0.09, mcLen: 0.042, phLengths: [0.024, 0.016, 0.012], r: 0.0036 },
    ];

    fingerSpecs.forEach((f) => {
      const baseP: [number, number, number] = [wristPt[0] + f.sx, wristPt[1] - 0.022, wristPt[2] + f.sz];
      const mcDir = new THREE.Vector3(Math.sin(f.spread), -Math.cos(f.spread), f.fwd).normalize();
      const mcEnd: [number, number, number] = [
        baseP[0] + mcDir.x * f.mcLen,
        baseP[1] + mcDir.y * f.mcLen,
        baseP[2] + mcDir.z * f.mcLen,
      ];
      placeSegmentBetween(
        root,
        radId,
        baseP,
        mcEnd,
        f.r * 1.1,
        f.r * 0.85,
        f.r * 1.15,
        radMat,
        trackGeo,
        boneMeshes,
        isSoftwareGl,
        8,
      );

      let curr = mcEnd;
      f.phLengths.forEach((pLen, pIdx) => {
        const curlAngle = (pIdx + 1) * 0.14;
        const pDir = new THREE.Vector3(
          mcDir.x * 0.92,
          mcDir.y,
          mcDir.z - curlAngle * 0.35,
        ).normalize();
        const next: [number, number, number] = [
          curr[0] + pDir.x * pLen,
          curr[1] + pDir.y * pLen,
          curr[2] + pDir.z * pLen,
        ];
        placeSegmentBetween(
          root,
          radId,
          curr,
          next,
          f.r * (1 - pIdx * 0.14),
          f.r * (0.78 - pIdx * 0.12),
          f.r * (0.9 - pIdx * 0.15),
          radMat,
          trackGeo,
          boneMeshes,
          isSoftwareGl,
          7,
        );
        curr = next;
      });
    });
  });

  // =========================================================================
  // 11-18. LOWER LIMBS (FEMUR, PATELLA, TIBIA/FIBULA, ARTICULATED FOOT)
  // =========================================================================
  [-1, 1].forEach((side) => {
    const femId = side < 0 ? 'femur-right' : 'femur-left';
    const patId = side < 0 ? 'patella-right' : 'patella-left';
    const tibId = side < 0 ? 'tibia-right' : 'tibia-left';
    const calId = side < 0 ? 'calcaneus-right' : 'calcaneus-left';

    const femMat = getMat(femId);
    const patMat = getMat(patId);
    const tibMat = getMat(tibId);
    const calMat = getMat(calId);

    const femHead: [number, number, number] = [side * 0.098, 0.878, 0.008];
    const trochanter: [number, number, number] = [side * 0.142, 0.858, 0.006];
    const kneeCenter: [number, number, number] = [side * 0.102, 0.495, 0.012];
    const ankleCenter: [number, number, number] = [side * 0.102, 0.088, 0.002];

    // Femoral head + neck + greater trochanter
    makeBonePart(root, femId, new THREE.SphereGeometry(0.025, 16, 14), femMat, trackGeo, boneMeshes, isSoftwareGl, femHead);
    placeSegmentBetween(root, femId, femHead, trochanter, 0.016, 0.014, 0.02, femMat, trackGeo, boneMeshes, isSoftwareGl, 12);
    makeBonePart(
      root,
      femId,
      new THREE.SphereGeometry(0.023, 14, 12),
      femMat,
      trackGeo,
      boneMeshes,
      isSoftwareGl,
      trochanter,
      null,
      [0.92, 1.18, 0.95],
    );
    // Lesser trochanter bump
    makeBonePart(
      root,
      femId,
      new THREE.SphereGeometry(0.013, 10, 8),
      femMat,
      trackGeo,
      boneMeshes,
      isSoftwareGl,
      [side * 0.118, 0.822, -0.012],
    );

    // Femoral shaft
    placeSegmentBetween(
      root,
      femId,
      [trochanter[0] - side * 0.008, trochanter[1] - 0.012, trochanter[2] + 0.004],
      kneeCenter,
      0.022,
      0.0185,
      0.029,
      femMat,
      trackGeo,
      boneMeshes,
      isSoftwareGl,
      16,
    );

    // Medial & lateral femoral condyles at knee
    [-0.016, 0.016].forEach((dx) => {
      makeBonePart(
        root,
        femId,
        new THREE.SphereGeometry(0.021, 14, 12),
        femMat,
        trackGeo,
        boneMeshes,
        isSoftwareGl,
        [kneeCenter[0] + dx, kneeCenter[1] + 0.006, kneeCenter[2] - 0.004],
        null,
        [0.82, 0.95, 1.28],
      );
    });

    // Patella (triangular-rounded sesamoid kneecap)
    makeBonePart(
      root,
      patId,
      new THREE.SphereGeometry(0.02, 14, 12),
      patMat,
      trackGeo,
      boneMeshes,
      isSoftwareGl,
      [kneeCenter[0], kneeCenter[1] + 0.006, kneeCenter[2] + 0.032],
      [0.12, 0, 0],
      [0.95, 1.08, 0.52],
    );

    // Tibia plateau & shaft
    makeBonePart(
      root,
      tibId,
      new THREE.CylinderGeometry(0.028, 0.02, 0.028, 16),
      tibMat,
      trackGeo,
      boneMeshes,
      isSoftwareGl,
      [kneeCenter[0], kneeCenter[1] - 0.025, kneeCenter[2] - 0.002],
      null,
      [1.22, 1, 0.92],
    );
    placeSegmentBetween(
      root,
      tibId,
      [kneeCenter[0], kneeCenter[1] - 0.028, kneeCenter[2] - 0.002],
      ankleCenter,
      0.022,
      0.0165,
      0.019,
      tibMat,
      trackGeo,
      boneMeshes,
      isSoftwareGl,
      14,
    );

    // Fibula (slender lateral bone)
    placeSegmentBetween(
      root,
      tibId,
      [kneeCenter[0] + side * 0.025, kneeCenter[1] - 0.036, kneeCenter[2] - 0.012],
      [ankleCenter[0] + side * 0.021, ankleCenter[1] - 0.008, ankleCenter[2] - 0.008],
      0.01,
      0.007,
      0.0095,
      tibMat,
      trackGeo,
      boneMeshes,
      isSoftwareGl,
      10,
    );

    // Calcaneus (heel), Talus, Midfoot tarsal arch, 5 Metatarsals & Toes
    makeBonePart(
      root,
      calId,
      new THREE.SphereGeometry(0.021, 14, 12),
      calMat,
      trackGeo,
      boneMeshes,
      isSoftwareGl,
      [ankleCenter[0], 0.068, 0.008],
      null,
      [0.95, 0.85, 1.15],
    );
    makeBonePart(
      root,
      calId,
      createCurvedTube(
        [
          [ankleCenter[0], 0.034, -0.042],
          [ankleCenter[0], 0.042, -0.008],
          [ankleCenter[0], 0.048, 0.026],
        ],
        0.019,
        10,
        10,
      ),
      calMat,
      trackGeo,
      boneMeshes,
      isSoftwareGl,
      [0, 0, 0],
    );

    // 5 Metatarsals & articulated toes resting cleanly on pedestal (y >= 0.008)
    [-2, -1, 0, 1, 2].forEach((toeIdx) => {
      const lateralOffset = toeIdx * side * 0.011;
      const isBigToe = toeIdx === -2;
      const mtStart: [number, number, number] = [ankleCenter[0] + lateralOffset * 0.72, 0.042, 0.028];
      const mtEnd: [number, number, number] = [
        ankleCenter[0] + lateralOffset * 1.1,
        0.016,
        0.095 - Math.max(0, toeIdx) * 0.007,
      ];
      const toeEnd: [number, number, number] = [
        mtEnd[0] + side * (toeIdx * 0.0015),
        0.012,
        mtEnd[2] + (isBigToe ? 0.036 : 0.028 - Math.max(0, toeIdx) * 0.004),
      ];
      const r = isBigToe ? 0.0068 : 0.0046;
      placeSegmentBetween(root, calId, mtStart, mtEnd, r * 1.05, r * 0.82, r * 1.08, calMat, trackGeo, boneMeshes, isSoftwareGl, 8);
      placeSegmentBetween(root, calId, mtEnd, toeEnd, r * 0.95, r * 0.75, r * 0.85, calMat, trackGeo, boneMeshes, isSoftwareGl, 7);
    });
  });

  return boneMeshes;
}

/**
 * Builds a sculpted 3D holographic brain inside the cranial vault:
 * left & right cerebral hemispheres with gyri/sulci cortical folds, striated cerebellum, and brainstem.
 */
export function buildSculptedBrain(
  root: THREE.Group,
  trackGeo: TrackGeoFn,
  trackMat: TrackMatFn,
): SculptedBrainAssets {
  const group = new THREE.Group();
  const material = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0x38bdf8,
      emissive: 0x0284c7,
      emissiveIntensity: 0.18,
      roughness: 0.45,
      metalness: 0.08,
      transparent: true,
      opacity: 0.48,
      depthWrite: false,
    }),
  );

  // Left & Right Cerebral Hemispheres with procedural gyri/sulci displacement
  [-1, 1].forEach((side) => {
    const hemiGeo = new THREE.SphereGeometry(0.052, 26, 20);
    const pos = hemiGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      let x = pos.getX(i);
      let y = pos.getY(i);
      let z = pos.getZ(i);

      // Flatten medial longitudinal fissure wall
      if (side * x < 0) x *= 0.16;
      else x *= 0.72;
      y *= 0.88;
      z *= 1.18;

      // Multi-frequency gyri & sulci cortical folds
      const fold =
        Math.sin(x * 165 + z * 115) * 0.0024 +
        Math.cos(y * 150 - z * 130) * 0.002;
      const len = Math.sqrt(x * x + y * y + z * z) || 1;
      x += (x / len) * fold;
      y += (y / len) * fold;
      z += (z / len) * fold;

      pos.setXYZ(i, x, y, z);
    }
    hemiGeo.computeVertexNormals();
    trackGeo(hemiGeo);

    const hemiMesh = new THREE.Mesh(hemiGeo, material);
    hemiMesh.position.set(side * 0.017, 1.702, -0.004);
    hemiMesh.renderOrder = 2;
    group.add(hemiMesh);
  });

  // Striated Cerebellum nestled beneath occipital cortex
  [-1, 1].forEach((side) => {
    const cereGeo = new THREE.SphereGeometry(0.023, 18, 14);
    const pos = cereGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i) * 0.92;
      const y = pos.getY(i) * 0.78;
      const z = pos.getZ(i) * 0.9 + Math.sin(pos.getY(i) * 320) * 0.0018;
      pos.setXYZ(i, x, y, z);
    }
    cereGeo.computeVertexNormals();
    trackGeo(cereGeo);

    const cereMesh = new THREE.Mesh(cereGeo, material);
    cereMesh.position.set(side * 0.019, 1.648, -0.044);
    cereMesh.renderOrder = 2;
    group.add(cereMesh);
  });

  // Brainstem (pons + medulla oblongata)
  const stemGeo = trackGeo(
    createCurvedTube(
      [
        [0, 1.678, -0.016],
        [0, 1.648, -0.02],
        [0, 1.608, -0.022],
      ],
      0.011,
      10,
      10,
    ),
  );
  const stemMesh = new THREE.Mesh(stemGeo, material);
  stemMesh.renderOrder = 2;
  group.add(stemMesh);

  root.add(group);
  return { group, material };
}

/**
 * Builds the luminous central & peripheral neurovascular hologram plexus:
 * spinal cord + 18 pairs of segmental roots + brachial/lumbosacral wishbones +
 * branching peripheral limb, thoracic rib, and splayed hand/foot nerves.
 */
export function buildNeurovascularPlexus(
  root: THREE.Group,
  trackGeo: TrackGeoFn,
  trackMat: TrackMatFn,
): NeurovascularAssets {
  const group = new THREE.Group();

  const cordMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0284c7,
      emissiveIntensity: 0.2,
      roughness: 0.4,
      metalness: 0.08,
      transparent: true,
      opacity: 0.56,
      depthWrite: false,
    }),
  );

  const nerveMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0284c7,
      emissiveIntensity: 0.14,
      roughness: 0.45,
      metalness: 0.08,
      transparent: true,
      opacity: 0.48,
      depthWrite: false,
    }),
  );

  const plexusMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xa855f7,
      emissive: 0x7e22ce,
      emissiveIntensity: 0.14,
      roughness: 0.45,
      metalness: 0.08,
      transparent: true,
      opacity: 0.48,
      depthWrite: false,
    }),
  );

  const addNervePath = (pts: Array<[number, number, number]>, r: number, mat: THREE.Material, segs = 14) => {
    const geo = trackGeo(createCurvedTube(pts, r, segs, 6));
    const mesh = new THREE.Mesh(geo, mat);
    mesh.renderOrder = 2;
    group.add(mesh);
  };

  // Central Spinal Cord + Cauda Equina
  addNervePath(
    [
      [0, 1.608, -0.022],
      [0, 1.505, -0.022],
      [0, 1.33, -0.06],
      [0, 1.13, -0.032],
      [0, 0.96, -0.044],
    ],
    0.0062,
    cordMat,
    28,
  );

  // 18 Pairs of Segmental Spinal Nerve Roots (C2-L5)
  for (let i = 0; i < 18; i++) {
    const t = i / 17;
    const ry = 1.55 - t * 0.56;
    const rz = -0.024 - Math.sin(t * Math.PI * 0.85) * 0.034;

    [-1, 1].forEach((side) => {
      addNervePath(
        [
          [0, ry, rz],
          [side * 0.02, ry - 0.005, rz + 0.005],
          [side * 0.042, ry - 0.014, rz + 0.014],
        ],
        0.002,
        plexusMat,
        6,
      );
    });
  }

  // Bilateral Brachial Plexus Wishbone + Upper Limb & Digit Nerves
  [-1, 1].forEach((side) => {
    // Brachial plexus upper/middle/lower trunks converging to axilla
    addNervePath(
      [
        [side * 0.016, 1.495, -0.02],
        [side * 0.095, 1.445, 0.005],
        [side * 0.175, 1.385, 0.012],
      ],
      0.0032,
      plexusMat,
      12,
    );
    addNervePath(
      [
        [side * 0.018, 1.445, -0.024],
        [side * 0.1, 1.412, 0.004],
        [side * 0.175, 1.385, 0.012],
      ],
      0.0028,
      plexusMat,
      12,
    );

    // Main median/ulnar peripheral nerve trunk down arm & forearm
    addNervePath(
      [
        [side * 0.175, 1.385, 0.012],
        [side * 0.228, 1.27, 0.018],
        [side * 0.264, 1.142, 0.018],
        [side * 0.305, 1.03, 0.028],
        [side * 0.342, 0.922, 0.035],
      ],
      0.0028,
      nerveMat,
      20,
    );

    // Secondary radial branch spiraling laterally
    addNervePath(
      [
        [side * 0.195, 1.36, 0.005],
        [side * 0.25, 1.24, -0.008],
        [side * 0.278, 1.135, 0.012],
        [side * 0.348, 0.93, 0.042],
      ],
      0.002,
      nerveMat,
      16,
    );

    // Digital nerve filaments into the 5 splayed fingers
    [-0.02, -0.01, 0, 0.01, 0.02].forEach((offset, idx) => {
      addNervePath(
        [
          [side * 0.342, 0.92, 0.035],
          [side * 0.35 + offset, 0.87, 0.038 + (idx === 0 ? 0.012 : 0)],
          [side * 0.362 + offset * 1.4, 0.815, 0.036 + (idx === 0 ? 0.018 : 0)],
        ],
        0.0014,
        cordMat,
        6,
      );
    });

    // Thoracic intercostal rib nerves (5 representative arches)
    for (let r = 0; r < 5; r++) {
      const ry = 1.39 - r * 0.042;
      const rw = 0.115 + Math.sin((r / 4) * Math.PI) * 0.025;
      addNervePath(
        [
          [side * 0.022, ry, -0.052],
          [side * rw, ry - 0.015, 0.005],
          [side * (rw * 0.72), ry - 0.028, 0.078],
        ],
        0.0017,
        nerveMat,
        12,
      );
    }

    // Lumbosacral Plexus Wishbone + Femoral & Sciatic Leg Nerve Trunks
    addNervePath(
      [
        [side * 0.016, 1.045, -0.034],
        [side * 0.072, 0.955, 0.005],
        [side * 0.105, 0.845, 0.022],
        [side * 0.11, 0.69, 0.024],
      ],
      0.003,
      plexusMat,
      14,
    );

    // Primary Sciatic -> Tibial -> Plantar nerve trunk
    addNervePath(
      [
        [side * 0.022, 0.965, -0.045],
        [side * 0.095, 0.875, -0.026],
        [side * 0.114, 0.69, -0.018],
        [side * 0.104, 0.49, -0.012],
        [side * 0.102, 0.28, -0.01],
        [side * 0.102, 0.088, -0.005],
        [side * 0.104, 0.025, 0.085],
      ],
      0.0032,
      nerveMat,
      26,
    );

    // Common Peroneal lateral branch down shin to dorsum of foot
    addNervePath(
      [
        [side * 0.108, 0.51, -0.008],
        [side * 0.124, 0.43, 0.006],
        [side * 0.116, 0.27, 0.022],
        [side * 0.105, 0.085, 0.036],
        [side * 0.102, 0.028, 0.102],
      ],
      0.0021,
      cordMat,
      14,
    );
  });

  root.add(group);
  return { group, materials: [cordMat, nerveMat, plexusMat] };
}

/**
 * Builds the sculpted anatomical body envelope using contoured LatheGeometry profiles
 * for head/neck, chest/waist/hips torso, upper arms, forearms, thighs, and calves.
 */
export function buildBodyEnvelope(
  root: THREE.Group,
  initialMat: THREE.Material,
  trackGeo: TrackGeoFn,
): BodyEnvelopePanel[] {
  const panels: BodyEnvelopePanel[] = [];

  const addPanel = (
    geo: THREE.BufferGeometry,
    base: [number, number, number],
    explode: [number, number, number],
    rot?: [number, number, number] | null,
    scale?: [number, number, number] | null,
  ) => {
    trackGeo(geo);
    const mesh = new THREE.Mesh(geo, initialMat);
    mesh.position.set(base[0], base[1], base[2]);
    if (rot) mesh.rotation.set(rot[0], rot[1], rot[2]);
    if (scale) mesh.scale.set(scale[0], scale[1], scale[2]);
    mesh.renderOrder = 4;
    root.add(mesh);
    panels.push({ mesh, base, explode });
  };

  // 1. Sculpted Head & Neck Shell (Lathe profile)
  const headPts = [
    new THREE.Vector2(0.068, -0.155), // Collar base
    new THREE.Vector2(0.056, -0.095), // Neck taper
    new THREE.Vector2(0.062, -0.055), // Jaw transition
    new THREE.Vector2(0.096, 0.005), // Cheek/temples
    new THREE.Vector2(0.104, 0.068), // Cranial vault widest
    new THREE.Vector2(0.072, 0.125),
    new THREE.Vector2(0.001, 0.145), // Vertex
  ];
  addPanel(
    new THREE.LatheGeometry(headPts, 28),
    [0, 1.645, 0.006],
    [0, 0.12, 0.06],
    null,
    [0.92, 1, 1.05],
  );

  // 2. Sculpted Torso Envelope (clavicle -> chest -> ribcage -> waist -> hips)
  const torsoPts = [
    new THREE.Vector2(0.001, -0.265),
    new THREE.Vector2(0.145, -0.245), // Pelvis floor
    new THREE.Vector2(0.172, -0.165), // Greater trochanter / hip flare
    new THREE.Vector2(0.144, -0.055), // Waist curve
    new THREE.Vector2(0.162, 0.075), // Lower ribcage
    new THREE.Vector2(0.188, 0.185), // Pectoral / latissimus flare
    new THREE.Vector2(0.162, 0.245), // Shoulder slope
    new THREE.Vector2(0.074, 0.272), // Neck collar
    new THREE.Vector2(0.001, 0.275),
  ];
  addPanel(
    new THREE.LatheGeometry(torsoPts, 32),
    [0, 1.185, 0.004],
    [0, 0.03, 0.22],
    null,
    [1.14, 1, 0.72],
  );

  // 3. Sculpted Bilateral Limb Envelopes (A-pose arms, thighs, calves)
  [-1, 1].forEach((side) => {
    // Upper arm (deltoid cap -> bicep -> elbow)
    const uArmPts = [
      new THREE.Vector2(0.001, -0.142),
      new THREE.Vector2(0.044, -0.132),
      new THREE.Vector2(0.052, -0.02),
      new THREE.Vector2(0.062, 0.085),
      new THREE.Vector2(0.054, 0.135),
      new THREE.Vector2(0.001, 0.145),
    ];
    addPanel(
      new THREE.LatheGeometry(uArmPts, 20),
      [side * 0.236, 1.272, 0.011],
      [side * 0.24, 0.04, 0.02],
      [-0.02, 0, side * 0.23],
    );

    // Forearm & hand envelope
    const fArmPts = [
      new THREE.Vector2(0.001, -0.138),
      new THREE.Vector2(0.032, -0.125),
      new THREE.Vector2(0.038, -0.03),
      new THREE.Vector2(0.046, 0.085),
      new THREE.Vector2(0.042, 0.125),
      new THREE.Vector2(0.001, 0.135),
    ];
    addPanel(
      new THREE.LatheGeometry(fArmPts, 18),
      [side * 0.305, 1.032, 0.024],
      [side * 0.3, -0.02, 0.04],
      [-0.08, 0, side * 0.32],
    );

    // Thigh (gluteal/quad curve tapering to knee)
    const thighPts = [
      new THREE.Vector2(0.001, -0.205),
      new THREE.Vector2(0.062, -0.195),
      new THREE.Vector2(0.072, -0.06),
      new THREE.Vector2(0.086, 0.095),
      new THREE.Vector2(0.082, 0.188),
      new THREE.Vector2(0.001, 0.205),
    ];
    addPanel(
      new THREE.LatheGeometry(thighPts, 22),
      [side * 0.114, 0.695, 0.01],
      [side * 0.16, 0, 0.1],
      [0, 0, side * -0.05],
    );

    // Calf / Lower leg (knee -> gastrocnemius belly -> ankle)
    const calfPts = [
      new THREE.Vector2(0.001, -0.205),
      new THREE.Vector2(0.044, -0.195),
      new THREE.Vector2(0.05, -0.08),
      new THREE.Vector2(0.064, 0.065),
      new THREE.Vector2(0.06, 0.185),
      new THREE.Vector2(0.001, 0.2),
    ];
    addPanel(
      new THREE.LatheGeometry(calfPts, 20),
      [side * 0.104, 0.295, 0.006],
      [side * 0.16, -0.03, 0.1],
    );
  });

  return panels;
}
