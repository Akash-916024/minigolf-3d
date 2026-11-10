import * as THREE from 'three';

export interface CourseMaterials {
  ball: THREE.MeshPhysicalMaterial;
  fairway: THREE.MeshStandardMaterial;
  roughGround: THREE.MeshStandardMaterial;
  woodRail: THREE.MeshStandardMaterial;
  stoneRail: THREE.MeshStandardMaterial;
  bumper: THREE.MeshStandardMaterial;
  ice: THREE.MeshPhysicalMaterial;
  tubeIce: THREE.MeshPhysicalMaterial;
  loopTrack: THREE.MeshStandardMaterial;
  sand: THREE.MeshStandardMaterial;
  water: THREE.MeshPhysicalMaterial;
  cupMetal: THREE.MeshStandardMaterial;
  cupInterior: THREE.MeshBasicMaterial;
  flagCloth: THREE.MeshStandardMaterial;
  jumpPad: THREE.MeshStandardMaterial;
  boostPad: THREE.MeshStandardMaterial;
  boostTexture: THREE.CanvasTexture;
}

/**
 * Generates procedural canvas PBR textures so every surface looks crisp,
 * tactile, and realistic without relying on external texture downloads.
 */
export function createCourseMaterials(maxAnisotropy: number): CourseMaterials {
  const turfColorTex = createTurfStripeTexture(maxAnisotropy);
  const turfBumpTex = createNoiseBumpTexture(256, 256, 28, maxAnisotropy);

  const roughColorTex = createRoughGrassTexture(maxAnisotropy);
  const woodColorTex = createOakWoodTexture(maxAnisotropy);
  const stoneColorTex = createStoneTexture(maxAnisotropy);
  const sandColorTex = createSandTexture(maxAnisotropy);
  const boostTexture = createBoostChevronTexture(maxAnisotropy);
  const ballDimpleTex = createBallDimpleBumpTexture();

  const ball = new THREE.MeshPhysicalMaterial({
    color: 0xfbfbfa,
    roughness: 0.16,
    metalness: 0.0,
    clearcoat: 1.0,
    clearcoatRoughness: 0.08,
    bumpMap: ballDimpleTex,
    bumpScale: 0.012,
  });

  const fairway = new THREE.MeshStandardMaterial({
    map: turfColorTex,
    bumpMap: turfBumpTex,
    bumpScale: 0.018,
    roughness: 0.84,
    metalness: 0.02,
  });

  const roughGround = new THREE.MeshStandardMaterial({
    map: roughColorTex,
    bumpMap: turfBumpTex,
    bumpScale: 0.03,
    roughness: 0.94,
    metalness: 0.0,
  });

  const woodRail = new THREE.MeshStandardMaterial({
    map: woodColorTex,
    roughness: 0.42,
    metalness: 0.05,
  });

  const stoneRail = new THREE.MeshStandardMaterial({
    map: stoneColorTex,
    bumpMap: turfBumpTex,
    bumpScale: 0.024,
    roughness: 0.82,
    metalness: 0.06,
  });

  const bumper = new THREE.MeshStandardMaterial({
    color: 0xe63946,
    emissive: 0x3f0a10,
    roughness: 0.28,
    metalness: 0.15,
  });

  const ice = new THREE.MeshPhysicalMaterial({
    color: 0xbde8ff,
    roughness: 0.08,
    metalness: 0.02,
    clearcoat: 1.0,
    clearcoatRoughness: 0.04,
    reflectivity: 0.9,
  });

  const tubeIce = new THREE.MeshPhysicalMaterial({
    color: 0xa3dfff,
    roughness: 0.12,
    metalness: 0.05,
    transmission: 0.42,
    transparent: true,
    opacity: 0.72,
    side: THREE.DoubleSide,
  });

  const loopTrack = new THREE.MeshStandardMaterial({
    color: 0x334155,
    roughness: 0.35,
    metalness: 0.2,
    transparent: true,
    opacity: 0.88,
    side: THREE.DoubleSide,
  });

  const sand = new THREE.MeshStandardMaterial({
    map: sandColorTex,
    bumpMap: turfBumpTex,
    bumpScale: 0.035,
    roughness: 0.96,
    metalness: 0.0,
  });

  const water = new THREE.MeshPhysicalMaterial({
    color: 0x168aad,
    emissive: 0x052c3b,
    roughness: 0.1,
    metalness: 0.08,
    clearcoat: 1.0,
    clearcoatRoughness: 0.05,
    transparent: true,
    opacity: 0.84,
  });

  const cupMetal = new THREE.MeshStandardMaterial({
    color: 0xd4d9dd,
    roughness: 0.25,
    metalness: 0.88,
  });

  const cupInterior = new THREE.MeshBasicMaterial({
    color: 0x090c0a,
  });

  const flagCloth = new THREE.MeshStandardMaterial({
    color: 0xe63946,
    roughness: 0.65,
    side: THREE.DoubleSide,
  });

  const jumpPad = new THREE.MeshStandardMaterial({
    color: 0x10b981,
    emissive: 0x059669,
    emissiveIntensity: 0.75,
    roughness: 0.25,
    metalness: 0.35,
  });

  const boostPad = new THREE.MeshStandardMaterial({
    map: boostTexture,
    emissive: 0xf59e0b,
    emissiveMap: boostTexture,
    emissiveIntensity: 0.9,
    roughness: 0.32,
  });

  return {
    ball,
    fairway,
    roughGround,
    woodRail,
    stoneRail,
    bumper,
    ice,
    tubeIce,
    loopTrack,
    sand,
    water,
    cupMetal,
    cupInterior,
    flagCloth,
    jumpPad,
    boostPad,
    boostTexture,
  };
}

function createTurfStripeTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  const stripeCount = 8;
  const stripeH = canvas.height / stripeCount;
  for (let i = 0; i < stripeCount; i++) {
    ctx.fillStyle = i % 2 === 0 ? '#2f8c47' : '#287a3e';
    ctx.fillRect(0, i * stripeH, canvas.width, stripeH);
  }

  for (let i = 0; i < 9000; i++) {
    const x = Math.random() * canvas.width;
    const y = Math.random() * canvas.height;
    ctx.fillStyle = Math.random() > 0.5 ? 'rgba(255,255,255,0.045)' : 'rgba(0,0,0,0.055)';
    ctx.fillRect(x, y, 2, 2);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 5);
  tex.anisotropy = Math.min(8, maxAnisotropy);
  return tex;
}

function createRoughGrassTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#1b4727';
  ctx.fillRect(0, 0, 256, 256);

  for (let i = 0; i < 6000; i++) {
    const x = Math.random() * 256;
    const y = Math.random() * 256;
    ctx.fillStyle = Math.random() > 0.45 ? 'rgba(62, 130, 74, 0.14)' : 'rgba(8, 22, 12, 0.18)';
    ctx.fillRect(x, y, 2, 3);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(18, 18);
  tex.anisotropy = Math.min(8, maxAnisotropy);
  return tex;
}

function createOakWoodTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#6f4726';
  ctx.fillRect(0, 0, 256, 256);

  for (let y = 0; y < 256; y += 2) {
    const shade = Math.sin(y * 0.17) * 14 + (Math.random() - 0.5) * 10;
    const r = Math.max(40, Math.min(200, 112 + shade));
    const g = Math.max(25, Math.min(160, 72 + shade * 0.7));
    const b = Math.max(15, Math.min(120, 38 + shade * 0.4));
    ctx.fillStyle = `rgb(${r | 0}, ${g | 0}, ${b | 0})`;
    ctx.fillRect(0, y, 256, 2);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 1);
  tex.anisotropy = Math.min(8, maxAnisotropy);
  return tex;
}

function createStoneTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#6b7075';
  ctx.fillRect(0, 0, 256, 256);

  for (let i = 0; i < 4500; i++) {
    const x = Math.random() * 256;
    const y = Math.random() * 256;
    ctx.fillStyle = Math.random() > 0.5 ? 'rgba(255,255,255,0.07)' : 'rgba(20,24,28,0.12)';
    ctx.fillRect(x, y, 3, 2);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 2);
  tex.anisotropy = Math.min(8, maxAnisotropy);
  return tex;
}

function createSandTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#dfbe83';
  ctx.fillRect(0, 0, 256, 256);

  for (let i = 0; i < 6500; i++) {
    const x = Math.random() * 256;
    const y = Math.random() * 256;
    ctx.fillStyle = Math.random() > 0.5 ? 'rgba(255,244,214,0.18)' : 'rgba(162,126,72,0.16)';
    ctx.fillRect(x, y, 2, 2);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 3);
  tex.anisotropy = Math.min(8, maxAnisotropy);
  return tex;
}

function createBoostChevronTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#18181b';
  ctx.fillRect(0, 0, 256, 256);

  ctx.strokeStyle = '#fbbf24';
  ctx.lineWidth = 22;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  for (let row = 0; row < 2; row++) {
    const baseY = 92 + row * 124;
    ctx.beginPath();
    ctx.moveTo(46, baseY + 42);
    ctx.lineTo(128, baseY - 26);
    ctx.lineTo(210, baseY + 42);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1, 2);
  tex.anisotropy = Math.min(8, maxAnisotropy);
  return tex;
}

function createNoiseBumpTexture(width: number, height: number, variance: number, maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(width, height);
  for (let i = 0; i < img.data.length; i += 4) {
    const val = 128 + (Math.random() - 0.5) * variance * 2;
    img.data[i] = val;
    img.data[i + 1] = val;
    img.data[i + 2] = val;
    img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(4, 8);
  tex.anisotropy = Math.min(8, maxAnisotropy);
  return tex;
}

function createBallDimpleBumpTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const cols = 20;
  const rows = 10;
  const dx = canvas.width / cols;
  const dy = canvas.height / rows;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cx = (c + (r % 2) * 0.5) * dx;
      const cy = (r + 0.5) * dy;
      const grad = ctx.createRadialGradient(cx, cy, 0.5, cx, cy, dx * 0.34);
      grad.addColorStop(0, '#787878');
      grad.addColorStop(0.75, '#c8c8c8');
      grad.addColorStop(1, '#ffffff');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cx, cy, dx * 0.34, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}
