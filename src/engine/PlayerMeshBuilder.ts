import * as THREE from 'three';
import { KitConfig, PlayerData } from '../types/game';

export interface PlayerMeshParts {
  root: THREE.Group;
  bodyGroup: THREE.Group;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  headGroup: THREE.Group;
  selectionRing: THREE.Mesh;
  directionCone: THREE.Mesh;
  staminaBarFill: THREE.Mesh;
}

function createJerseyNumberTexture(
  shirtNumber: number,
  primaryColor: string,
  secondaryColor: string,
  pattern: KitConfig['pattern']
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = primaryColor;
  ctx.fillRect(0, 0, 256, 256);

  if (pattern === 'stripes') {
    ctx.fillStyle = secondaryColor;
    for (let x = 20; x < 256; x += 48) {
      ctx.fillRect(x, 0, 20, 256);
    }
  } else if (pattern === 'hoops') {
    ctx.fillStyle = secondaryColor;
    for (let y = 24; y < 256; y += 52) {
      ctx.fillRect(0, y, 256, 22);
    }
  } else if (pattern === 'sash') {
    ctx.strokeStyle = secondaryColor;
    ctx.lineWidth = 36;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(256, 256);
    ctx.stroke();
  }

  // Contrasting number plate on back/front
  ctx.fillStyle = 'rgba(9, 13, 22, 0.55)';
  ctx.beginPath();
  ctx.roundRect(68, 64, 120, 128, 18);
  ctx.fill();

  ctx.font = 'bold 96px "Barlow Condensed", sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(shirtNumber), 128, 132);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function createContactShadowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(64, 64, 8, 64, 64, 60);
  grad.addColorStop(0, 'rgba(0, 0, 0, 0.55)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

let sharedShadowTex: THREE.CanvasTexture | null = null;

/**
 * Builds a composite 10-part 3D footballer model (THREE.Group) grounded at y=0
 * with articulated limbs, distinctive height/build/hairstyle, kit colors, and selection ring.
 */
export function buildPlayerMesh(
  player: PlayerData,
  kit: KitConfig,
  isGoalkeeper: boolean,
  teamIndicatorColor: number
): PlayerMeshParts {
  const root = new THREE.Group();
  const bodyGroup = new THREE.Group();
  root.add(bodyGroup);

  const heightScale = player.appearance.heightCm / 180;
  const widthScale =
    player.appearance.build === 'stocky'
      ? 1.12
      : player.appearance.build === 'lean'
      ? 0.94
      : 1.0;

  bodyGroup.scale.set(widthScale, heightScale, widthScale);

  // 1. Contact Shadow Grounding Disc (y = 0.02, depthWrite: false)
  if (!sharedShadowTex) {
    sharedShadowTex = createContactShadowTexture();
  }
  const shadowPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(1.45, 1.45),
    new THREE.MeshBasicMaterial({
      map: sharedShadowTex,
      transparent: true,
      depthWrite: false,
      opacity: 0.65,
    })
  );
  shadowPlane.rotation.x = -Math.PI / 2;
  shadowPlane.position.y = 0.02;
  root.add(shadowPlane);

  // 2. Active Player Selection Ring & Directional Arrow (y = 0.03)
  const selectionRing = new THREE.Mesh(
    new THREE.RingGeometry(0.68, 0.86, 28),
    new THREE.MeshBasicMaterial({
      color: teamIndicatorColor,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.92,
      depthWrite: false,
    })
  );
  selectionRing.rotation.x = -Math.PI / 2;
  selectionRing.position.y = 0.03;
  selectionRing.visible = false;
  root.add(selectionRing);

  const directionCone = new THREE.Mesh(
    new THREE.ConeGeometry(0.24, 0.45, 12),
    new THREE.MeshBasicMaterial({
      color: teamIndicatorColor,
      transparent: true,
      opacity: 0.92,
    })
  );
  directionCone.rotation.x = Math.PI / 2;
  directionCone.position.set(0, 0.06, 1.05);
  directionCone.visible = false;
  root.add(directionCone);

  // Materials (varied roughness & metalness across adjacent parts per Three.js directives)
  const jerseyPrimary = isGoalkeeper ? kit.gkColor : kit.primaryColor;
  const jerseyTex = createJerseyNumberTexture(
    player.shirtNumber,
    jerseyPrimary,
    kit.secondaryColor,
    isGoalkeeper ? 'solid' : kit.pattern
  );

  const jerseyMat = new THREE.MeshStandardMaterial({
    map: jerseyTex,
    roughness: 0.68,
    metalness: 0.05,
  });
  const shortsMat = new THREE.MeshStandardMaterial({
    color: isGoalkeeper ? kit.gkColor : kit.shortsColor,
    roughness: 0.75,
    metalness: 0.04,
  });
  const skinMat = new THREE.MeshStandardMaterial({
    color: player.appearance.skinColor,
    roughness: 0.52,
    metalness: 0.08,
  });
  const socksMat = new THREE.MeshStandardMaterial({
    color: kit.socksColor,
    roughness: 0.8,
    metalness: 0.02,
  });
  const bootMat = new THREE.MeshStandardMaterial({
    color: player.appearance.bootColor,
    roughness: 0.25,
    metalness: 0.35,
  });
  const hairMat = new THREE.MeshStandardMaterial({
    color: player.appearance.hairColor,
    roughness: 0.85,
    metalness: 0.02,
  });

  // 3. Articulated Left & Right Legs (hip pivot at y = 0.85)
  const buildLeg = (xOffset: number): THREE.Group => {
    const legGroup = new THREE.Group();
    legGroup.position.set(xOffset, 0.85, 0);

    // Upper thigh (shorts + skin)
    const thigh = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.11, 0.38, 10), skinMat);
    thigh.position.y = -0.19;
    thigh.castShadow = true;
    legGroup.add(thigh);

    // Lower shin with sock
    const sock = new THREE.Mesh(new THREE.CylinderGeometry(0.105, 0.085, 0.38, 10), socksMat);
    sock.position.y = -0.55;
    sock.castShadow = true;
    legGroup.add(sock);

    // Studded Football Boot
    const boot = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.12, 0.34), bootMat);
    boot.position.set(0, -0.79, 0.06);
    boot.castShadow = true;
    legGroup.add(boot);

    return legGroup;
  };

  const leftLeg = buildLeg(-0.16);
  const rightLeg = buildLeg(0.16);
  bodyGroup.add(leftLeg);
  bodyGroup.add(rightLeg);

  // 4. Shorts Pelvis Block
  const pelvis = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.28, 0.32), shortsMat);
  pelvis.position.y = 0.92;
  pelvis.castShadow = true;
  bodyGroup.add(pelvis);

  // 5. Athletic Torso (Jersey with Number)
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.62, 0.32), jerseyMat);
  torso.position.y = 1.35;
  torso.castShadow = true;
  bodyGroup.add(torso);

  // 6. Articulated Left & Right Arms (shoulder pivot at y = 1.58)
  const buildArm = (xOffset: number): THREE.Group => {
    const armGroup = new THREE.Group();
    armGroup.position.set(xOffset, 1.58, 0);

    const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.09, 0.24, 8), jerseyMat);
    sleeve.position.y = -0.12;
    sleeve.castShadow = true;
    armGroup.add(sleeve);

    const forearm = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.07, 0.34, 8), skinMat);
    forearm.position.y = -0.38;
    forearm.castShadow = true;
    armGroup.add(forearm);

    if (isGoalkeeper) {
      const glove = new THREE.Mesh(
        new THREE.SphereGeometry(0.1, 10, 10),
        new THREE.MeshStandardMaterial({ color: 0xfef08a, roughness: 0.4 })
      );
      glove.position.y = -0.58;
      armGroup.add(glove);
    }

    return armGroup;
  };

  const leftArm = buildArm(-0.36);
  const rightArm = buildArm(0.36);
  bodyGroup.add(leftArm);
  bodyGroup.add(rightArm);

  // 7. Neck, Head & Distinct Hairstyle
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 1.72, 0);

  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.1, 0.12, 8), skinMat);
  neck.position.y = 0.04;
  headGroup.add(neck);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 16), skinMat);
  head.position.y = 0.24;
  head.castShadow = true;
  headGroup.add(head);

  // Hairstyle variations
  const style = player.appearance.hairStyle;
  if (style === 'afro' || style === 'curls') {
    const afro = new THREE.Mesh(new THREE.SphereGeometry(0.25, 14, 14), hairMat);
    afro.position.set(0, 0.3, -0.02);
    headGroup.add(afro);
  } else if (style === 'bun') {
    const cap = new THREE.Mesh(
      new THREE.SphereGeometry(0.225, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.55),
      hairMat
    );
    cap.position.y = 0.25;
    headGroup.add(cap);
    const bun = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 10), hairMat);
    bun.position.set(0, 0.38, -0.2);
    headGroup.add(bun);
  } else {
    const topHair = new THREE.Mesh(
      new THREE.BoxGeometry(0.36, style === 'fade' ? 0.14 : 0.1, 0.38),
      hairMat
    );
    topHair.position.set(0, 0.42, 0);
    headGroup.add(topHair);
  }

  bodyGroup.add(headGroup);

  // 8. Overhead Stamina Mini-Bar (only shown when controlled or active)
  const staminaBg = new THREE.Mesh(
    new THREE.PlaneGeometry(0.8, 0.1),
    new THREE.MeshBasicMaterial({ color: 0x090d16, side: THREE.DoubleSide })
  );
  staminaBg.position.set(0, 2.45, 0);
  root.add(staminaBg);

  const staminaBarFill = new THREE.Mesh(
    new THREE.PlaneGeometry(0.76, 0.06),
    new THREE.MeshBasicMaterial({ color: 0x10b981, side: THREE.DoubleSide })
  );
  staminaBarFill.position.set(0, 2.45, 0.01);
  root.add(staminaBarFill);

  return {
    root,
    bodyGroup,
    leftLeg,
    rightLeg,
    leftArm,
    rightArm,
    headGroup,
    selectionRing,
    directionCone,
    staminaBarFill,
  };
}

/**
 * Animates articulated limbs in real time according to movement speed, sprinting,
 * kicking, tackling, or goalkeeper diving without allocating any GC objects.
 */
export function animatePlayerMesh(
  parts: PlayerMeshParts,
  speed: number,
  isSprinting: boolean,
  actionType: 'idle' | 'kick' | 'tackle' | 'dive_left' | 'dive_right',
  actionTimer: number,
  elapsedTime: number,
  staminaRatio: number,
  isControlled: boolean
): void {
  // Update selection ring & stamina indicator
  parts.selectionRing.visible = isControlled;
  parts.directionCone.visible = isControlled;

  const clampedStamina = Math.max(0.05, Math.min(1, staminaRatio));
  parts.staminaBarFill.scale.x = clampedStamina;
  (parts.staminaBarFill.material as THREE.MeshBasicMaterial).color.setHex(
    clampedStamina > 0.45 ? 0x10b981 : clampedStamina > 0.2 ? 0xf59e0b : 0xef4444
  );

  // Reset dive posture
  parts.bodyGroup.rotation.z = 0;
  parts.bodyGroup.rotation.x = 0;
  parts.bodyGroup.position.y = 0;

  if (actionType === 'dive_left' && actionTimer > 0) {
    parts.bodyGroup.rotation.z = 1.15;
    parts.bodyGroup.position.y = 0.35;
    parts.leftArm.rotation.x = -2.4;
    parts.rightArm.rotation.x = -2.4;
    return;
  }

  if (actionType === 'dive_right' && actionTimer > 0) {
    parts.bodyGroup.rotation.z = -1.15;
    parts.bodyGroup.position.y = 0.35;
    parts.leftArm.rotation.x = -2.4;
    parts.rightArm.rotation.x = -2.4;
    return;
  }

  if (actionType === 'tackle' && actionTimer > 0) {
    parts.bodyGroup.rotation.x = -0.55;
    parts.bodyGroup.position.y = -0.25;
    parts.rightLeg.rotation.x = -1.25;
    parts.leftLeg.rotation.x = 0.6;
    return;
  }

  if (actionType === 'kick' && actionTimer > 0) {
    const swing = Math.sin(actionTimer * Math.PI * 4) * 1.35;
    parts.rightLeg.rotation.x = -swing;
    parts.leftLeg.rotation.x = swing * 0.35;
    parts.leftArm.rotation.x = -0.6;
    parts.rightArm.rotation.x = 0.5;
    return;
  }

  if (speed > 0.35) {
    const freq = isSprinting ? 13.5 : 9.5;
    const amp = Math.min(1.05, speed * 0.11);
    const phase = elapsedTime * freq;
    const sinP = Math.sin(phase);

    parts.leftLeg.rotation.x = sinP * amp;
    parts.rightLeg.rotation.x = -sinP * amp;
    parts.leftArm.rotation.x = -sinP * amp * 0.85;
    parts.rightArm.rotation.x = sinP * amp * 0.85;
    parts.bodyGroup.rotation.x = isSprinting ? 0.18 : 0.08;
    parts.bodyGroup.position.y = Math.abs(Math.cos(phase)) * 0.07;
  } else {
    // Subtle breathing idle
    const idleSin = Math.sin(elapsedTime * 2.5) * 0.05;
    parts.leftLeg.rotation.x = 0;
    parts.rightLeg.rotation.x = 0;
    parts.leftArm.rotation.x = idleSin;
    parts.rightArm.rotation.x = -idleSin;
  }
}
