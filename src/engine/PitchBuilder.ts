import * as THREE from 'three';
import { MatchSettings } from '../types/game';

export interface PitchDimensions {
  length: number; // X axis (-halfLength to +halfLength)
  width: number; // Z axis (-halfWidth to +halfWidth)
  halfLength: number;
  halfWidth: number;
  goalWidth: number;
  goalHeight: number;
  goalDepth: number;
  penaltyBoxLength: number;
  penaltyBoxWidth: number;
  goalBoxLength: number;
  goalBoxWidth: number;
  isStreet: boolean;
}

export function getPitchDimensions(mode: MatchSettings['mode']): PitchDimensions {
  if (mode === 'street') {
    const length = 60;
    const width = 40;
    return {
      length,
      width,
      halfLength: length / 2,
      halfWidth: width / 2,
      goalWidth: 6.2,
      goalHeight: 2.4,
      goalDepth: 1.8,
      penaltyBoxLength: 10,
      penaltyBoxWidth: 18,
      goalBoxLength: 4.5,
      goalBoxWidth: 10,
      isStreet: true,
    };
  }
  const length = 96;
  const width = 62;
  return {
    length,
    width,
    halfLength: length / 2,
    halfWidth: width / 2,
    goalWidth: 7.6,
    goalHeight: 2.65,
    goalDepth: 2.4,
    penaltyBoxLength: 15.5,
    penaltyBoxWidth: 36,
    goalBoxLength: 5.5,
    goalBoxWidth: 17,
    isStreet: false,
  };
}

function createPitchTexture(
  dims: PitchDimensions,
  maxAnisotropy: number
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 2048;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d')!;

  const w = canvas.width;
  const h = canvas.height;

  // Base turf or street asphalt turf
  if (dims.isStreet) {
    ctx.fillStyle = '#133829';
    ctx.fillRect(0, 0, w, h);
    const stripes = 14;
    for (let i = 0; i < stripes; i++) {
      ctx.fillStyle = i % 2 === 0 ? '#164230' : '#113325';
      ctx.fillRect((i * w) / stripes, 0, w / stripes, h);
    }
  } else {
    const stripes = 18;
    for (let i = 0; i < stripes; i++) {
      ctx.fillStyle = i % 2 === 0 ? '#1b6332' : '#165329';
      ctx.fillRect((i * w) / stripes, 0, w / stripes, h);
    }
    // Subtle cross-cut grass grid
    ctx.fillStyle = 'rgba(255, 255, 255, 0.025)';
    const hStripes = 12;
    for (let j = 0; j < hStripes; j += 2) {
      ctx.fillRect(0, (j * h) / hStripes, w, h / hStripes);
    }
  }

  // Draw crisp regulation pitch markings inside playable area
  // Canvas maps to full turf plane (dims.length + 14 by dims.width + 14)
  const totalW = dims.length + 14;
  const totalH = dims.width + 14;

  const toX = (worldX: number) => ((worldX + totalW / 2) / totalW) * w;
  const toY = (worldZ: number) => ((worldZ + totalH / 2) / totalH) * h;
  const scaleX = (len: number) => (len / totalW) * w;
  const scaleY = (len: number) => (len / totalH) * h;

  ctx.strokeStyle = dims.isStreet ? 'rgba(56, 189, 248, 0.92)' : 'rgba(255, 255, 255, 0.92)';
  ctx.fillStyle = dims.isStreet ? 'rgba(56, 189, 248, 0.92)' : 'rgba(255, 255, 255, 0.92)';
  ctx.lineWidth = 4.5;

  const left = toX(-dims.halfLength);
  const right = toX(dims.halfLength);
  const top = toY(-dims.halfWidth);
  const bottom = toY(dims.halfWidth);

  // Outer touchlines & goal lines
  ctx.strokeRect(left, top, right - left, bottom - top);

  // Halfway line
  ctx.beginPath();
  ctx.moveTo(toX(0), top);
  ctx.lineTo(toX(0), bottom);
  ctx.stroke();

  // Center circle & spot
  const centerR = scaleX(dims.isStreet ? 6 : 9.15);
  ctx.beginPath();
  ctx.arc(toX(0), toY(0), centerR, 0, Math.PI * 2);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(toX(0), toY(0), 5.5, 0, Math.PI * 2);
  ctx.fill();

  // Left & Right Penalty Areas
  const pBoxW = scaleX(dims.penaltyBoxLength);
  const pBoxH = scaleY(dims.penaltyBoxWidth);
  ctx.strokeRect(left, toY(-dims.penaltyBoxWidth / 2), pBoxW, pBoxH);
  ctx.strokeRect(right - pBoxW, toY(-dims.penaltyBoxWidth / 2), pBoxW, pBoxH);

  // Left & Right 6-yard Goal Boxes
  const gBoxW = scaleX(dims.goalBoxLength);
  const gBoxH = scaleY(dims.goalBoxWidth);
  ctx.strokeRect(left, toY(-dims.goalBoxWidth / 2), gBoxW, gBoxH);
  ctx.strokeRect(right - gBoxW, toY(-dims.goalBoxWidth / 2), gBoxW, gBoxH);

  // Penalty Spots & Penalty Arcs
  const penDist = dims.isStreet ? 7.5 : 11;
  const leftPenX = toX(-dims.halfLength + penDist);
  const rightPenX = toX(dims.halfLength - penDist);
  ctx.beginPath();
  ctx.arc(leftPenX, toY(0), 4.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(rightPenX, toY(0), 4.5, 0, Math.PI * 2);
  ctx.fill();

  if (!dims.isStreet) {
    ctx.beginPath();
    ctx.arc(leftPenX, toY(0), scaleX(9.15), -0.64, 0.64);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(rightPenX, toY(0), scaleX(9.15), Math.PI - 0.64, Math.PI + 0.64);
    ctx.stroke();
  }

  // Corner arcs
  const cornerR = scaleX(1.5);
  [
    [left, top, 0, Math.PI / 2],
    [right, top, Math.PI / 2, Math.PI],
    [right, bottom, Math.PI, Math.PI * 1.5],
    [left, bottom, Math.PI * 1.5, Math.PI * 2],
  ].forEach(([cx, cy, a0, a1]) => {
    ctx.beginPath();
    ctx.arc(cx, cy, cornerR, a0, a1);
    ctx.stroke();
  });

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  tex.needsUpdate = true;
  return tex;
}

function createGoalGroup(dims: PitchDimensions, side: -1 | 1): THREE.Group {
  const goalGroup = new THREE.Group();
  const postMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.2,
    metalness: 0.6,
  });
  const netMat = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    roughness: 0.8,
    metalness: 0.05,
    wireframe: true,
    transparent: true,
    opacity: 0.45,
  });

  const postRadius = 0.09;
  const hw = dims.goalWidth / 2;
  const h = dims.goalHeight;
  const d = dims.goalDepth * side;

  // Left & Right Vertical Posts
  const postGeo = new THREE.CylinderGeometry(postRadius, postRadius, h, 12);
  const leftPost = new THREE.Mesh(postGeo, postMat);
  leftPost.position.set(0, h / 2, -hw);
  leftPost.castShadow = true;
  goalGroup.add(leftPost);

  const rightPost = new THREE.Mesh(postGeo, postMat);
  rightPost.position.set(0, h / 2, hw);
  rightPost.castShadow = true;
  goalGroup.add(rightPost);

  // Crossbar
  const crossbarGeo = new THREE.CylinderGeometry(postRadius, postRadius, dims.goalWidth + postRadius * 2, 12);
  const crossbar = new THREE.Mesh(crossbarGeo, postMat);
  crossbar.rotation.x = Math.PI / 2;
  crossbar.position.set(0, h, 0);
  crossbar.castShadow = true;
  goalGroup.add(crossbar);

  // Back Stanchions
  const backSupportGeo = new THREE.CylinderGeometry(0.05, 0.05, h, 8);
  const backLeft = new THREE.Mesh(backSupportGeo, postMat);
  backLeft.position.set(d, h / 2, -hw);
  goalGroup.add(backLeft);

  const backRight = new THREE.Mesh(backSupportGeo, postMat);
  backRight.position.set(d, h / 2, hw);
  goalGroup.add(backRight);

  // Net Panels (Back, Top, Left, Right)
  const backNet = new THREE.Mesh(new THREE.PlaneGeometry(dims.goalWidth, h, 18, 8), netMat);
  backNet.rotation.y = Math.PI / 2;
  backNet.position.set(d, h / 2, 0);
  goalGroup.add(backNet);

  const topNet = new THREE.Mesh(
    new THREE.PlaneGeometry(Math.abs(d), dims.goalWidth, 6, 16),
    netMat
  );
  topNet.rotation.x = Math.PI / 2;
  topNet.position.set(d / 2, h, 0);
  goalGroup.add(topNet);

  const sideNetGeo = new THREE.PlaneGeometry(Math.abs(d), h, 6, 8);
  const leftNet = new THREE.Mesh(sideNetGeo, netMat);
  leftNet.position.set(d / 2, h / 2, -hw);
  goalGroup.add(leftNet);

  const rightNet = new THREE.Mesh(sideNetGeo, netMat);
  rightNet.position.set(d / 2, h / 2, hw);
  goalGroup.add(rightNet);

  goalGroup.position.set(dims.halfLength * side, 0, 0);
  return goalGroup;
}

function createAdBoardTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#090d16';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Accent borders
  ctx.fillStyle = '#10b981';
  ctx.fillRect(0, 0, canvas.width, 6);
  ctx.fillStyle = '#38bdf8';
  ctx.fillRect(0, canvas.height - 6, canvas.width, 6);

  ctx.font = 'bold 44px "Barlow Condensed", sans-serif';
  ctx.textBaseline = 'middle';
  const banners = [
    { text: 'APEX PITCH 26', color: '#f8fafc', x: 40 },
    { text: 'GLOBAL CHAMPIONS CUP', color: '#eab308', x: 350 },
    { text: 'NEXT-GEN 3D FOOTBALL', color: '#38bdf8', x: 740 },
  ];
  banners.forEach((b) => {
    ctx.fillStyle = b.color;
    ctx.fillText(b.text, b.x, canvas.height / 2);
  });

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.repeat.set(4, 1);
  tex.anisotropy = maxAnisotropy;
  return tex;
}

export function buildStadiumEnvironment(
  dims: PitchDimensions,
  settings: MatchSettings,
  maxAnisotropy: number,
  homeColorHex: string,
  awayColorHex: string,
  graphicsQuality: 'Low' | 'Medium' | 'High' = 'High'
): THREE.Group {
  const root = new THREE.Group();

  // 1. Outer Surround Apron (Track / Stadium Floor)
  const surroundGeo = new THREE.PlaneGeometry(dims.length + 80, dims.width + 80);
  const surroundMat = new THREE.MeshStandardMaterial({
    color: dims.isStreet ? 0x0f172a : 0x1e293b,
    roughness: 0.9,
    metalness: 0.05,
  });
  const surround = new THREE.Mesh(surroundGeo, surroundMat);
  surround.rotation.x = -Math.PI / 2;
  surround.position.y = -0.03;
  surround.receiveShadow = true;
  root.add(surround);

  // 2. Main Textured Pitch Plane
  const pitchTex = createPitchTexture(dims, maxAnisotropy);
  const pitchGeo = new THREE.PlaneGeometry(dims.length + 14, dims.width + 14);
  const pitchMat = new THREE.MeshStandardMaterial({
    map: pitchTex,
    roughness: 0.82,
    metalness: 0.02,
  });
  const pitchMesh = new THREE.Mesh(pitchGeo, pitchMat);
  pitchMesh.rotation.x = -Math.PI / 2;
  pitchMesh.position.y = 0;
  pitchMesh.receiveShadow = true;
  root.add(pitchMesh);

  // 3. Left & Right Goals
  root.add(createGoalGroup(dims, -1));
  root.add(createGoalGroup(dims, 1));

  // 4. Corner Flags
  const poleGeo = new THREE.CylinderGeometry(0.03, 0.03, 1.5, 6);
  const poleMat = new THREE.MeshStandardMaterial({ color: 0xfef08a, roughness: 0.4 });
  const flagGeo = new THREE.PlaneGeometry(0.45, 0.3);
  const flagMat = new THREE.MeshStandardMaterial({
    color: 0xef4444,
    side: THREE.DoubleSide,
    roughness: 0.6,
  });

  [
    [-dims.halfLength, -dims.halfWidth],
    [dims.halfLength, -dims.halfWidth],
    [-dims.halfLength, dims.halfWidth],
    [dims.halfLength, dims.halfWidth],
  ].forEach(([cx, cz]) => {
    const cornerGroup = new THREE.Group();
    const pole = new THREE.Mesh(poleGeo, poleMat);
    pole.position.y = 0.75;
    cornerGroup.add(pole);

    const flag = new THREE.Mesh(flagGeo, flagMat);
    flag.position.set(0.22, 1.35, 0);
    cornerGroup.add(flag);

    cornerGroup.position.set(cx, 0, cz);
    root.add(cornerGroup);
  });

  // 5. Perimeter Advertising Boards
  const adTex = createAdBoardTexture(maxAnisotropy);
  const adMat = new THREE.MeshStandardMaterial({
    map: adTex,
    roughness: 0.4,
    metalness: 0.2,
    emissive: new THREE.Color(0x111827),
    emissiveIntensity: 0.35,
  });

  const boardHeight = dims.isStreet ? 1.6 : 1.15;
  const margin = 4.2;

  const northBoard = new THREE.Mesh(
    new THREE.BoxGeometry(dims.length + 4, boardHeight, 0.25),
    adMat
  );
  northBoard.position.set(0, boardHeight / 2, -(dims.halfWidth + margin));
  northBoard.castShadow = true;
  root.add(northBoard);

  const southBoard = new THREE.Mesh(
    new THREE.BoxGeometry(dims.length + 4, boardHeight, 0.25),
    adMat
  );
  southBoard.position.set(0, boardHeight / 2, dims.halfWidth + margin);
  southBoard.castShadow = true;
  root.add(southBoard);

  // 6. Stadium Grandstands & Instanced Spectators
  const standMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    roughness: 0.75,
    metalness: 0.2,
  });
  const roofMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    roughness: 0.4,
    metalness: 0.65,
  });

  const standOffsetZ = dims.halfWidth + 12;
  const standOffsetX = dims.halfLength + 13;

  // North & South Stands
  [-1, 1].forEach((dir) => {
    const stand = new THREE.Mesh(new THREE.BoxGeometry(dims.length + 16, 11, 14), standMat);
    stand.position.set(0, 5.2, dir * (standOffsetZ + 5));
    stand.rotation.x = dir * -0.28;
    root.add(stand);

    if (!dims.isStreet) {
      const roof = new THREE.Mesh(new THREE.BoxGeometry(dims.length + 20, 0.8, 16), roofMat);
      roof.position.set(0, 13.5, dir * (standOffsetZ + 4));
      root.add(roof);
    }
  });

  // West & East Stands
  [-1, 1].forEach((dir) => {
    const stand = new THREE.Mesh(new THREE.BoxGeometry(14, 11, dims.width + 12), standMat);
    stand.position.set(dir * (standOffsetX + 5), 5.2, 0);
    stand.rotation.z = dir * 0.28;
    root.add(stand);
  });

  // InstancedMesh Stadium Crowd (High performance single draw call)
  const crowdCount = graphicsQuality === 'Low' ? 180 : 420;
  const fanGeo = new THREE.BoxGeometry(0.65, 1.1, 0.55);
  const fanMat = new THREE.MeshStandardMaterial({ roughness: 0.65, metalness: 0.1 });
  const crowdInstanced = new THREE.InstancedMesh(fanGeo, fanMat, crowdCount);

  const dummy = new THREE.Object3D();
  const color = new THREE.Color();
  const homeCol = new THREE.Color(homeColorHex);
  const awayCol = new THREE.Color(awayColorHex);
  const neutralCol = new THREE.Color(0xe2e8f0);

  for (let i = 0; i < crowdCount; i++) {
    const section = i % 4;
    const row = Math.floor((i / 4) % 5);
    const elevation = 2.2 + row * 1.65;
    const depth = row * 2.2;

    if (section === 0) {
      // North
      dummy.position.set(
        (Math.random() - 0.5) * dims.length,
        elevation,
        -(standOffsetZ + depth)
      );
    } else if (section === 1) {
      // South
      dummy.position.set(
        (Math.random() - 0.5) * dims.length,
        elevation,
        standOffsetZ + depth
      );
    } else if (section === 2) {
      // West (Home end)
      dummy.position.set(
        -(standOffsetX + depth),
        elevation,
        (Math.random() - 0.5) * dims.width
      );
    } else {
      // East (Away end)
      dummy.position.set(
        standOffsetX + depth,
        elevation,
        (Math.random() - 0.5) * dims.width
      );
    }

    dummy.scale.setScalar(0.85 + (i % 5) * 0.08);
    dummy.updateMatrix();
    crowdInstanced.setMatrixAt(i, dummy.matrix);

    if (i % 3 === 0) color.copy(homeCol);
    else if (i % 3 === 1) color.copy(awayCol);
    else color.copy(neutralCol);
    crowdInstanced.setColorAt(i, color);
  }
  crowdInstanced.instanceMatrix.needsUpdate = true;
  if (crowdInstanced.instanceColor) crowdInstanced.instanceColor.needsUpdate = true;
  crowdInstanced.computeBoundingSphere();
  root.add(crowdInstanced);

  // 7. Corner Floodlight Towers
  const towerPoleGeo = new THREE.CylinderGeometry(0.45, 0.7, 28, 8);
  const towerRackGeo = new THREE.BoxGeometry(5.5, 2.6, 1.2);
  const towerRackMat = new THREE.MeshStandardMaterial({
    color: 0xf8fafc,
    emissive: new THREE.Color(0xfef08a),
    emissiveIntensity: 0.9,
    roughness: 0.2,
  });

  [
    [-(dims.halfLength + 14), -(dims.halfWidth + 14)],
    [dims.halfLength + 14, -(dims.halfWidth + 14)],
    [-(dims.halfLength + 14), dims.halfWidth + 14],
    [dims.halfLength + 14, dims.halfWidth + 14],
  ].forEach(([tx, tz]) => {
    const tower = new THREE.Group();
    const pole = new THREE.Mesh(towerPoleGeo, roofMat);
    pole.position.y = 14;
    tower.add(pole);

    const rack = new THREE.Mesh(towerRackGeo, towerRackMat);
    rack.position.y = 28;
    rack.lookAt(0, 0, 0);
    tower.add(rack);

    tower.position.set(tx, 0, tz);
    root.add(tower);
  });

  return root;
}
