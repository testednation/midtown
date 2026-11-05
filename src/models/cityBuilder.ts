import * as THREE from 'three';
import { Checkpoint, DestructibleProp } from '../types';

export interface CityEnvironment {
  sceneGroup: THREE.Group;
  buildingColliders: {
    minX: number;
    maxX: number;
    minZ: number;
    maxZ: number;
    height: number;
  }[];
  props: DestructibleProp[];
  propMeshes: Map<number, THREE.Group>;
  checkpoints: Checkpoint[];
  checkpointMeshes: THREE.Group[];
  waterMesh?: THREE.Mesh;
  lTrainGroup?: THREE.Group;
  cityBounds: { minX: number; maxX: number; minZ: number; maxZ: number };
}

// Procedural building window texture
function createSkyscraperTexture(colorTheme: 'blue' | 'warm' | 'amber' | 'bronze'): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  const bgColors = {
    blue: '#0f172a',
    warm: '#27272a',
    amber: '#1c1917',
    bronze: '#18181b',
  };
  ctx.fillStyle = bgColors[colorTheme];
  ctx.fillRect(0, 0, 256, 512);

  const windowCols = 8;
  const windowRows = 20;
  const padX = 8;
  const padY = 6;
  const wWidth = (256 - (windowCols + 1) * padX) / windowCols;
  const wHeight = (512 - (windowRows + 1) * padY) / windowRows;

  for (let r = 0; r < windowRows; r++) {
    for (let c = 0; c < windowCols; c++) {
      const isLit = Math.random() > 0.38;
      if (isLit) {
        const warmLit = Math.random() > 0.4;
        ctx.fillStyle = warmLit ? '#fef08a' : '#bae6fd';
      } else {
        ctx.fillStyle = '#09090b';
      }
      const x = padX + c * (wWidth + padX);
      const y = padY + r * (wHeight + padY);
      ctx.fillRect(x, y, wWidth, wHeight);
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

// Procedural asphalt road texture with lane lines
function createRoadTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  // Dark asphalt base
  ctx.fillStyle = '#1c1d21';
  ctx.fillRect(0, 0, 512, 512);

  // Subtle asphalt grit noise
  for (let i = 0; i < 4000; i++) {
    ctx.fillStyle = Math.random() > 0.5 ? '#27272a' : '#141416';
    ctx.fillRect(Math.random() * 512, Math.random() * 512, 2, 2);
  }

  // Double yellow center divider lines
  ctx.strokeStyle = '#eab308';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(250, 0);
  ctx.lineTo(250, 512);
  ctx.moveTo(262, 0);
  ctx.lineTo(262, 512);
  ctx.stroke();

  // White dashed lane markers
  ctx.strokeStyle = '#f8fafc';
  ctx.lineWidth = 5;
  ctx.setLineDash([28, 28]);
  ctx.beginPath();
  ctx.moveTo(128, 0);
  ctx.lineTo(128, 512);
  ctx.moveTo(384, 0);
  ctx.lineTo(384, 512);
  ctx.stroke();

  // White road edge borders
  ctx.setLineDash([]);
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(14, 0);
  ctx.lineTo(14, 512);
  ctx.moveTo(498, 0);
  ctx.lineTo(498, 512);
  ctx.stroke();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

export function buildChicagoCity(): CityEnvironment {
  const root = new THREE.Group();
  root.name = 'chicago_city';

  const buildingColliders: CityEnvironment['buildingColliders'] = [];
  const props: DestructibleProp[] = [];
  const propMeshes = new Map<number, THREE.Group>();
  const checkpoints: Checkpoint[] = [];
  const checkpointMeshes: THREE.Group[] = [];

  const roadTex = createRoadTexture();
  roadTex.repeat.set(1, 10);

  const texBlue = createSkyscraperTexture('blue');
  const texWarm = createSkyscraperTexture('warm');
  const texAmber = createSkyscraperTexture('amber');
  const texBronze = createSkyscraperTexture('bronze');

  // Shared Materials
  const concreteMat = new THREE.MeshStandardMaterial({
    color: 0x94a3b8,
    roughness: 0.9,
    metalness: 0.05,
  });

  const sidewalkMat = new THREE.MeshStandardMaterial({
    color: 0x64748b,
    roughness: 0.85,
    metalness: 0.05,
  });

  const waterMat = new THREE.MeshStandardMaterial({
    color: 0x0284c7,
    roughness: 0.1,
    metalness: 0.8,
    transparent: true,
    opacity: 0.85,
  });

  const steelGreenMat = new THREE.MeshStandardMaterial({
    color: 0x166534, // Classic Chicago L-train dark green steel
    roughness: 0.5,
    metalness: 0.7,
  });

  // City Grid Dimensions
  const blockSize = 80;
  const roadWidth = 24;
  const gridCount = 5; // 5x5 blocks
  const cityExtent = (blockSize + roadWidth) * gridCount;
  const halfCity = cityExtent / 2;

  // 1. Vast Terrain Base
  const terrainGeo = new THREE.PlaneGeometry(cityExtent * 2.2, cityExtent * 2.2);
  terrainGeo.rotateX(-Math.PI / 2);
  const terrainMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    roughness: 0.95,
  });
  const terrain = new THREE.Mesh(terrainGeo, terrainMat);
  terrain.position.y = -0.05;
  terrain.receiveShadow = true;
  root.add(terrain);

  // 2. Chicago River Canal cutting across the city (Z = -20 to Z = 20)
  const canalZ = 0;
  const canalWidth = 44;
  const canalLength = cityExtent * 1.5;

  const waterGeo = new THREE.PlaneGeometry(canalLength, canalWidth);
  waterGeo.rotateX(-Math.PI / 2);
  const waterMesh = new THREE.Mesh(waterGeo, waterMat);
  waterMesh.position.set(0, -1.8, canalZ);
  root.add(waterMesh);

  // River canal concrete walls
  const wallGeo = new THREE.BoxGeometry(canalLength, 3.2, 2);
  const wallNorth = new THREE.Mesh(wallGeo, concreteMat);
  wallNorth.position.set(0, -0.2, canalZ + canalWidth / 2 + 1);
  const wallSouth = new THREE.Mesh(wallGeo, concreteMat);
  wallSouth.position.set(0, -0.2, canalZ - canalWidth / 2 - 1);
  root.add(wallNorth, wallSouth);

  // 3. Roads & Intersections & Drawbridges
  const roadStep = blockSize + roadWidth;
  const roadY = 0.01;

  for (let i = 0; i <= gridCount; i++) {
    const coord = -halfCity + i * roadStep;

    // North-South Roads
    // Two segments (North of canal, South of canal) + bridges
    const northRoadGeo = new THREE.PlaneGeometry(roadWidth, halfCity - canalWidth / 2);
    northRoadGeo.rotateX(-Math.PI / 2);
    const roadMatNS = new THREE.MeshStandardMaterial({ map: roadTex, roughness: 0.75 });
    const nRoad = new THREE.Mesh(northRoadGeo, roadMatNS);
    nRoad.position.set(coord, roadY, halfCity / 2 + canalWidth / 4);
    nRoad.receiveShadow = true;
    root.add(nRoad);

    const sRoad = new THREE.Mesh(northRoadGeo, roadMatNS);
    sRoad.position.set(coord, roadY, -(halfCity / 2 + canalWidth / 4));
    sRoad.receiveShadow = true;
    root.add(sRoad);

    // Drawbridge or Stunt Ramp over Canal on N-S roads!
    const isStuntBridge = i === 2 || i === 4; // Bridges on center & flank
    if (isStuntBridge) {
      // Chicago bascule drawbridge (two inclined ramps with a mid-air jump gap!)
      const rampLen = canalWidth * 0.44;
      const rampGeo = new THREE.BoxGeometry(roadWidth, 1.2, rampLen);

      // North ramp inclined up
      const nRamp = new THREE.Mesh(rampGeo, concreteMat);
      nRamp.position.set(coord, 1.6, canalZ + rampLen / 2 + 3);
      nRamp.rotation.x = -0.16; // Jump incline!
      nRamp.castShadow = true;
      nRamp.receiveShadow = true;
      root.add(nRamp);

      // South ramp inclined up
      const sRamp = new THREE.Mesh(rampGeo, concreteMat);
      sRamp.position.set(coord, 1.6, canalZ - rampLen / 2 - 3);
      sRamp.rotation.x = 0.16; // Jump incline!
      sRamp.castShadow = true;
      sRamp.receiveShadow = true;
      root.add(sRamp);

      // Bridge steel trusses
      const trussGeo = new THREE.BoxGeometry(1.2, 4.5, rampLen);
      const trussNL = new THREE.Mesh(trussGeo, steelGreenMat);
      trussNL.position.set(coord - roadWidth / 2, 3.2, canalZ + rampLen / 2 + 3);
      trussNL.rotation.x = -0.16;
      const trussNR = trussNL.clone();
      trussNR.position.x = coord + roadWidth / 2;
      root.add(trussNL, trussNR);
    } else {
      // Flat solid bridge deck
      const bridgeDeckGeo = new THREE.BoxGeometry(roadWidth, 1.2, canalWidth + 4);
      const bDeck = new THREE.Mesh(bridgeDeckGeo, concreteMat);
      bDeck.position.set(coord, 0.4, canalZ);
      bDeck.receiveShadow = true;
      root.add(bDeck);
    }

    // East-West Roads (skip canal zone)
    if (Math.abs(coord - canalZ) > canalWidth / 2) {
      const ewRoadGeo = new THREE.PlaneGeometry(cityExtent + roadWidth, roadWidth);
      ewRoadGeo.rotateX(-Math.PI / 2);
      const ewRoad = new THREE.Mesh(ewRoadGeo, roadMatNS);
      ewRoad.position.set(0, roadY, coord);
      ewRoad.receiveShadow = true;
      root.add(ewRoad);
    }
  }

  // 4. City Blocks with Sidewalks & Distinct Chicago Skyscrapers
  let propIdCounter = 1;

  for (let bx = 0; bx < gridCount; bx++) {
    for (let bz = 0; bz < gridCount; bz++) {
      const blockCenterX = -halfCity + roadStep * bx + roadStep / 2;
      const blockCenterZ = -halfCity + roadStep * bz + roadStep / 2;

      // Skip block if it overlaps the river canal
      if (Math.abs(blockCenterZ - canalZ) < (canalWidth / 2 + blockSize / 2 - 4)) {
        continue;
      }

      // Sidewalk slab (elevated curb +0.15 Y)
      const curbGeo = new THREE.BoxGeometry(blockSize, 0.28, blockSize);
      const curb = new THREE.Mesh(curbGeo, sidewalkMat);
      curb.position.set(blockCenterX, 0.14, blockCenterZ);
      curb.receiveShadow = true;
      root.add(curb);

      // Decide building profile for this block:
      // (a) Mega Landmark (Willis Tower style stepped setbacks with twin antennas) on center block
      // (b) Wrigley / Clock Tower Art Deco style
      // (c) Modern Twin Glass Towers with Plaza
      // (d) High-rise office monolith with helipad
      const isLandmarkCenter = bx === 2 && bz === 3;
      const isHistoric = (bx + bz) % 3 === 0;

      if (isLandmarkCenter) {
        // --- Iconic Chicago Willis Tower (110 stories tribute) ---
        const towerHeight = 180;
        const bldMat = new THREE.MeshStandardMaterial({
          map: texBronze,
          roughness: 0.2,
          metalness: 0.85,
        });

        // 9-tube bundled architecture (stepped setbacks)
        const base = new THREE.Mesh(new THREE.BoxGeometry(50, 70, 50), bldMat);
        base.position.set(blockCenterX, 35, blockCenterZ);
        base.castShadow = true;
        base.receiveShadow = true;

        const tier2 = new THREE.Mesh(new THREE.BoxGeometry(42, 60, 42), bldMat);
        tier2.position.set(blockCenterX, 100, blockCenterZ);
        tier2.castShadow = true;

        const tier3 = new THREE.Mesh(new THREE.BoxGeometry(26, 50, 26), bldMat);
        tier3.position.set(blockCenterX, 155, blockCenterZ);
        tier3.castShadow = true;

        // Twin broadcast antennas
        const antGeo = new THREE.CylinderGeometry(0.5, 1.2, 40, 8);
        const antMat = new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.9 });
        const ant1 = new THREE.Mesh(antGeo, antMat);
        ant1.position.set(blockCenterX - 6, 195, blockCenterZ);
        const ant2 = new THREE.Mesh(antGeo, antMat);
        ant2.position.set(blockCenterX + 6, 195, blockCenterZ);

        root.add(base, tier2, tier3, ant1, ant2);

        buildingColliders.push({
          minX: blockCenterX - 25,
          maxX: blockCenterX + 25,
          minZ: blockCenterZ - 25,
          maxZ: blockCenterZ + 25,
          height: towerHeight,
        });
      } else if (isHistoric) {
        // --- Art-Deco Historic Terracotta / Stone Tower ---
        const bldHeight = 85 + ((bx * 7 + bz * 13) % 40);
        const bldMat = new THREE.MeshStandardMaterial({
          map: texAmber,
          roughness: 0.8,
          metalness: 0.1,
        });
        const building = new THREE.Mesh(new THREE.BoxGeometry(52, bldHeight, 52), bldMat);
        building.position.set(blockCenterX, bldHeight / 2, blockCenterZ);
        building.castShadow = true;
        building.receiveShadow = true;

        // Crown / Spire
        const crown = new THREE.Mesh(
          new THREE.ConeGeometry(8, 22, 6),
          new THREE.MeshStandardMaterial({ color: 0xca8a04, metalness: 0.8, roughness: 0.25 })
        );
        crown.position.set(blockCenterX, bldHeight + 11, blockCenterZ);
        root.add(building, crown);

        buildingColliders.push({
          minX: blockCenterX - 26,
          maxX: blockCenterX + 26,
          minZ: blockCenterZ - 26,
          maxZ: blockCenterZ + 26,
          height: bldHeight,
        });
      } else {
        // --- Modern Corporate Glass High-Rise with Rooftop Details ---
        const bldHeight = 65 + ((bx * 17 + bz * 23) % 65);
        const selectedTex = (bx + bz) % 2 === 0 ? texBlue : texWarm;
        const bldMat = new THREE.MeshStandardMaterial({
          map: selectedTex,
          roughness: 0.25,
          metalness: 0.7,
        });
        const building = new THREE.Mesh(new THREE.BoxGeometry(54, bldHeight, 54), bldMat);
        building.position.set(blockCenterX, bldHeight / 2, blockCenterZ);
        building.castShadow = true;
        building.receiveShadow = true;

        // Helipad or rooftop AC unit
        const acUnit = new THREE.Mesh(new THREE.BoxGeometry(14, 5, 14), concreteMat);
        acUnit.position.set(blockCenterX, bldHeight + 2.5, blockCenterZ);
        root.add(building, acUnit);

        buildingColliders.push({
          minX: blockCenterX - 27,
          maxX: blockCenterX + 27,
          minZ: blockCenterZ - 27,
          maxZ: blockCenterZ + 27,
          height: bldHeight,
        });
      }

      // --- Street Furniture / Destructible Props along Block Curbs ---
      // We place fire hydrants, lampposts, trash cans, and construction barriers on sidewalk corners!
      const cornerOffsets = [
        { x: -blockSize / 2 + 3, z: -blockSize / 2 + 3 },
        { x: blockSize / 2 - 3, z: -blockSize / 2 + 3 },
        { x: -blockSize / 2 + 3, z: blockSize / 2 - 3 },
        { x: blockSize / 2 - 3, z: blockSize / 2 - 3 },
      ];

      cornerOffsets.forEach((offset, idx) => {
        const px = blockCenterX + offset.x;
        const pz = blockCenterZ + offset.z;
        const propTypeChoice = (bx * 3 + bz * 7 + idx) % 5;

        let propType: DestructibleProp['type'] = 'hydrant';
        if (propTypeChoice === 1) propType = 'lamppost';
        else if (propTypeChoice === 2) propType = 'trashcan';
        else if (propTypeChoice === 3) propType = 'barrier';
        else if (propTypeChoice === 4) propType = 'mailbox';

        const id = propIdCounter++;
        props.push({
          id,
          type: propType,
          x: px,
          y: 0.28,
          z: pz,
          knocked: false,
          vx: 0,
          vy: 0,
          vz: 0,
          rx: 0,
          ry: 0,
          rz: 0,
        });

        // 3D Prop Mesh
        const pGroup = new THREE.Group();
        pGroup.position.set(px, 0.28, pz);

        if (propType === 'hydrant') {
          const hydMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.4 });
          const body = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.8, 10), hydMat);
          body.position.y = 0.4;
          const cap = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), hydMat);
          cap.position.y = 0.8;
          pGroup.add(body, cap);
        } else if (propType === 'lamppost') {
          const postMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.8, roughness: 0.3 });
          const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 5.5, 8), postMat);
          pole.position.y = 2.75;
          const arm = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 1.2), postMat);
          arm.position.set(0, 5.3, 0.5);
          const lampLight = new THREE.Mesh(
            new THREE.BoxGeometry(0.35, 0.15, 0.5),
            new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff0c0, emissiveIntensity: 1.5 })
          );
          lampLight.position.set(0, 5.2, 1.0);
          pGroup.add(pole, arm, lampLight);
        } else if (propType === 'trashcan') {
          const binMat = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.6 });
          const bin = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.3, 0.9, 12), binMat);
          bin.position.y = 0.45;
          pGroup.add(bin);
        } else if (propType === 'barrier') {
          const barMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.5 });
          const plank = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.3, 0.1), barMat);
          plank.position.y = 0.7;
          const legL = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.8, 0.4), barMat);
          legL.position.set(-0.7, 0.4, 0);
          const legR = legL.clone();
          legR.position.x = 0.7;
          pGroup.add(plank, legL, legR);
        } else {
          // Mailbox
          const boxMat = new THREE.MeshStandardMaterial({ color: 0x1d4ed8, roughness: 0.5 });
          const box = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.0, 0.6), boxMat);
          box.position.y = 0.5;
          pGroup.add(box);
        }

        root.add(pGroup);
        propMeshes.set(id, pGroup);
      });
    }
  }

  // 5. Elevated Chicago "L-Train" Track & Train Passing Overhead!
  // Elevated track spans across Z = 104 from East to West
  const trackZ = 104;
  const trackHeight = 7.5;
  const trackLength = cityExtent * 1.2;

  const trackBeams = new THREE.Mesh(
    new THREE.BoxGeometry(trackLength, 0.8, 6.0),
    steelGreenMat
  );
  trackBeams.position.set(0, trackHeight, trackZ);
  root.add(trackBeams);

  // Trestle support columns every 40 meters
  for (let x = -halfCity; x <= halfCity; x += 40) {
    const colGeo = new THREE.BoxGeometry(0.8, trackHeight, 0.8);
    const colL = new THREE.Mesh(colGeo, steelGreenMat);
    colL.position.set(x, trackHeight / 2, trackZ - 2.8);
    const colR = colL.clone();
    colR.position.z = trackZ + 2.8;
    root.add(colL, colR);
  }

  // CTA L-Train Cars (Animated Group)
  const lTrainGroup = new THREE.Group();
  lTrainGroup.position.set(-halfCity, trackHeight + 1.8, trackZ);
  const trainCarMat = new THREE.MeshStandardMaterial({
    color: 0xd4d4d8,
    metalness: 0.8,
    roughness: 0.25,
  });
  const trainStripeMat = new THREE.MeshStandardMaterial({
    color: 0xef4444, // Red line Chicago train
  });

  for (let c = 0; c < 3; c++) {
    const carGroup = new THREE.Group();
    carGroup.position.x = c * 22;

    const carBody = new THREE.Mesh(new THREE.BoxGeometry(20, 3.2, 4.4), trainCarMat);
    const redStripe = new THREE.Mesh(new THREE.BoxGeometry(20.02, 0.4, 4.42), trainStripeMat);
    redStripe.position.y = 0.3;

    carGroup.add(carBody, redStripe);
    lTrainGroup.add(carGroup);
  }
  root.add(lTrainGroup);

  // 6. Blitz Checkpoints Setup (8 scenic checkpoints loop through Chicago)
  const checkpointPositions = [
    { x: -160, z: -160 },
    { x: -50, z: -160 },
    { x: 50, z: -160 },
    { x: 160, z: -80 },
    { x: 160, z: 0 },    // Near drawbridge!
    { x: 50, z: 104 },   // Under the L-Train!
    { x: -100, z: 120 },
    { x: -160, z: 0 },
  ];

  checkpointPositions.forEach((pos, idx) => {
    checkpoints.push({
      x: pos.x,
      z: pos.z,
      radius: 14,
      passed: false,
    });

    const cpGroup = new THREE.Group();
    cpGroup.position.set(pos.x, 3.5, pos.z);

    // Glowing arcade ring
    const ringGeo = new THREE.TorusGeometry(8, 0.45, 12, 32);
    const ringMat = new THREE.MeshStandardMaterial({
      color: 0x22c55e,
      emissive: 0x22c55e,
      emissiveIntensity: 1.8,
      transparent: true,
      opacity: 0.75,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = Math.PI / 2;

    // Center chevron arrow
    const arrowGeo = new THREE.ConeGeometry(2.5, 5, 4);
    arrowGeo.rotateZ(Math.PI);
    const arrowMat = new THREE.MeshStandardMaterial({
      color: 0xfacc15,
      emissive: 0xfacc15,
      emissiveIntensity: 1.5,
    });
    const arrow = new THREE.Mesh(arrowGeo, arrowMat);
    arrow.position.y = 2.5;

    cpGroup.add(ring, arrow);
    cpGroup.visible = idx === 0; // Only first checkpoint active at start
    root.add(cpGroup);
    checkpointMeshes.push(cpGroup);
  });

  return {
    sceneGroup: root,
    buildingColliders,
    props,
    propMeshes,
    checkpoints,
    checkpointMeshes,
    waterMesh,
    lTrainGroup,
    cityBounds: {
      minX: -halfCity - 20,
      maxX: halfCity + 20,
      minZ: -halfCity - 20,
      maxZ: halfCity + 20,
    },
  };
}
