import * as THREE from 'three';
import { VehicleConfig, VehicleId } from '../types';

export interface VehicleMeshBundle {
  group: THREE.Group;
  bodyMesh: THREE.Mesh | THREE.Group;
  materials: {
    paint: THREE.MeshStandardMaterial;
    glass: THREE.MeshStandardMaterial;
    chrome: THREE.MeshStandardMaterial;
    rubber: THREE.MeshStandardMaterial;
    rim: THREE.MeshStandardMaterial;
    headlights: THREE.MeshStandardMaterial;
    taillights: THREE.MeshStandardMaterial;
    strobeBlue?: THREE.MeshStandardMaterial;
    strobeRed?: THREE.MeshStandardMaterial;
  };
  frontWheels: THREE.Group[];
  rearWheels: THREE.Group[];
  strobeTime?: number;
  config: VehicleConfig;
}

// Procedural texture for checkered taxi stripe
function createTaxiStripeTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#facc15';
  ctx.fillRect(0, 0, 256, 64);

  ctx.fillStyle = '#1e293b';
  const size = 16;
  for (let x = 0; x < 256; x += size * 2) {
    ctx.fillRect(x, 16, size, size);
    ctx.fillRect(x + size, 32, size, size);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.repeat.set(4, 1);
  return texture;
}

// Procedural bus destination sign texture
function createBusSignTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#09090b';
  ctx.fillRect(0, 0, 512, 128);

  ctx.fillStyle = '#f59e0b'; // Amber LED display
  ctx.font = 'bold 54px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('147 MICHIGAN EXP', 256, 64);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// Helper to build a detailed wheel assembly (tire + rim + brake caliper)
function createWheel(
  radius: number,
  width: number,
  rubberMat: THREE.MeshStandardMaterial,
  rimMat: THREE.MeshStandardMaterial
): THREE.Group {
  const wheelGroup = new THREE.Group();

  // Rubber tire
  const tireGeo = new THREE.CylinderGeometry(radius, radius, width, 18);
  tireGeo.rotateZ(Math.PI / 2);
  const tire = new THREE.Mesh(tireGeo, rubberMat);
  tire.castShadow = true;
  wheelGroup.add(tire);

  // Rim face / hubcap
  const rimRadius = radius * 0.72;
  const rimGeo = new THREE.CylinderGeometry(rimRadius, rimRadius, width + 0.02, 12);
  rimGeo.rotateZ(Math.PI / 2);
  const rim = new THREE.Mesh(rimGeo, rimMat);
  wheelGroup.add(rim);

  // Spokes detail
  const spokeCount = 5;
  for (let i = 0; i < spokeCount; i++) {
    const spokeGeo = new THREE.BoxGeometry(rimRadius * 1.8, width + 0.03, rimRadius * 0.16);
    const spoke = new THREE.Mesh(spokeGeo, rimMat);
    spoke.rotation.x = (i * Math.PI) / spokeCount;
    wheelGroup.add(spoke);
  }

  // Center bolt nut
  const boltGeo = new THREE.CylinderGeometry(radius * 0.2, radius * 0.2, width + 0.05, 6);
  boltGeo.rotateZ(Math.PI / 2);
  const bolt = new THREE.Mesh(boltGeo, rimMat);
  wheelGroup.add(bolt);

  return wheelGroup;
}

export function buildVehicleMesh(config: VehicleConfig, customColor?: string): VehicleMeshBundle {
  const root = new THREE.Group();
  root.name = `vehicle_${config.id}`;

  const chosenColor = customColor || config.defaultColor;

  // Shared PBR materials with varied roughness / metalness per skill guidelines
  const paintMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(chosenColor),
    metalness: 0.65,
    roughness: 0.22,
  });

  const glassMat = new THREE.MeshStandardMaterial({
    color: 0x182430,
    metalness: 0.9,
    roughness: 0.08,
    transparent: true,
    opacity: 0.85,
  });

  const chromeMat = new THREE.MeshStandardMaterial({
    color: 0xeeeeee,
    metalness: 0.95,
    roughness: 0.12,
  });

  const rubberMat = new THREE.MeshStandardMaterial({
    color: 0x1f1f1f,
    metalness: 0.05,
    roughness: 0.88,
  });

  const rimMat = new THREE.MeshStandardMaterial({
    color: 0xd4d4d8,
    metalness: 0.85,
    roughness: 0.25,
  });

  const headlightMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0xfff0c0,
    emissiveIntensity: 1.2,
    metalness: 0.1,
    roughness: 0.1,
  });

  const taillightMat = new THREE.MeshStandardMaterial({
    color: 0x990000,
    emissive: 0xff1010,
    emissiveIntensity: 1.0,
    metalness: 0.1,
    roughness: 0.1,
  });

  const strobeBlueMat = new THREE.MeshStandardMaterial({
    color: 0x0055ff,
    emissive: 0x0066ff,
    emissiveIntensity: 0.2,
  });

  const strobeRedMat = new THREE.MeshStandardMaterial({
    color: 0xff0000,
    emissive: 0xff0000,
    emissiveIntensity: 0.2,
  });

  const materials = {
    paint: paintMat,
    glass: glassMat,
    chrome: chromeMat,
    rubber: rubberMat,
    rim: rimMat,
    headlights: headlightMat,
    taillights: taillightMat,
    strobeBlue: strobeBlueMat,
    strobeRed: strobeRedMat,
  };

  const frontWheels: THREE.Group[] = [];
  const rearWheels: THREE.Group[] = [];

  const bodyGroup = new THREE.Group();
  bodyGroup.name = 'car_body';
  root.add(bodyGroup);

  const dim = config.dimensions;
  const wheelR = dim.wheelRadius;
  const wheelW = dim.wheelWidth;

  // Assembly logic specific to vehicle type
  switch (config.id) {
    case 'cruiser': {
      // 1. Lower chassis
      const baseGeo = new THREE.BoxGeometry(dim.width, 0.45, dim.length);
      const baseMesh = new THREE.Mesh(baseGeo, paintMat);
      baseMesh.position.y = wheelR + 0.25;
      baseMesh.castShadow = true;
      bodyGroup.add(baseMesh);

      // 2. Rounded bubble cabin
      const cabinGeo = new THREE.BoxGeometry(dim.width * 0.88, 0.65, dim.length * 0.58);
      const cabin = new THREE.Mesh(cabinGeo, paintMat);
      cabin.position.set(0, wheelR + 0.72, -0.15);
      cabin.castShadow = true;
      bodyGroup.add(cabin);

      // 3. Windows
      const windshieldGeo = new THREE.BoxGeometry(dim.width * 0.89, 0.52, 0.1);
      const windshield = new THREE.Mesh(windshieldGeo, glassMat);
      windshield.position.set(0, wheelR + 0.75, dim.length * 0.14);
      windshield.rotation.x = -Math.PI * 0.12;
      bodyGroup.add(windshield);

      const rearWindow = new THREE.Mesh(windshieldGeo, glassMat);
      rearWindow.position.set(0, wheelR + 0.75, -dim.length * 0.44);
      rearWindow.rotation.x = Math.PI * 0.14;
      bodyGroup.add(rearWindow);

      // 4. Bumper trim
      const fgrille = new THREE.Mesh(new THREE.BoxGeometry(dim.width * 0.7, 0.18, 0.1), chromeMat);
      fgrille.position.set(0, wheelR + 0.2, dim.length * 0.5 + 0.02);
      bodyGroup.add(fgrille);

      // 5. Headlights
      const hlGeo = new THREE.CylinderGeometry(0.16, 0.16, 0.08, 12);
      hlGeo.rotateX(Math.PI / 2);
      const hlL = new THREE.Mesh(hlGeo, headlightMat);
      hlL.position.set(-dim.width * 0.35, wheelR + 0.35, dim.length * 0.5);
      const hlR = hlL.clone();
      hlR.position.x = dim.width * 0.35;
      bodyGroup.add(hlL, hlR);

      // 6. Taillights
      const tlGeo = new THREE.BoxGeometry(0.24, 0.15, 0.06);
      const tlL = new THREE.Mesh(tlGeo, taillightMat);
      tlL.position.set(-dim.width * 0.35, wheelR + 0.35, -dim.length * 0.5);
      const tlR = tlL.clone();
      tlR.position.x = dim.width * 0.35;
      bodyGroup.add(tlL, tlR);
      break;
    }

    case 'taxi': {
      // 1. Lower chassis / sedan hull
      const lowerGeo = new THREE.BoxGeometry(dim.width, 0.5, dim.length);
      const lower = new THREE.Mesh(lowerGeo, paintMat);
      lower.position.y = wheelR + 0.28;
      lower.castShadow = true;
      bodyGroup.add(lower);

      // 2. Checker stripe decal sides
      const stripeGeo = new THREE.BoxGeometry(dim.width + 0.02, 0.12, dim.length * 0.9);
      const stripeMat = new THREE.MeshStandardMaterial({
        map: createTaxiStripeTexture(),
        roughness: 0.3,
      });
      const stripe = new THREE.Mesh(stripeGeo, stripeMat);
      stripe.position.y = wheelR + 0.32;
      bodyGroup.add(stripe);

      // 3. Cabin & roof
      const cabinGeo = new THREE.BoxGeometry(dim.width * 0.85, 0.62, dim.length * 0.52);
      const cabin = new THREE.Mesh(cabinGeo, paintMat);
      cabin.position.set(0, wheelR + 0.78, -0.1);
      cabin.castShadow = true;
      bodyGroup.add(cabin);

      // 4. Windows
      const windshield = new THREE.Mesh(new THREE.BoxGeometry(dim.width * 0.86, 0.52, 0.08), glassMat);
      windshield.position.set(0, wheelR + 0.78, dim.length * 0.16);
      windshield.rotation.x = -Math.PI * 0.15;
      bodyGroup.add(windshield);

      const rearWindow = new THREE.Mesh(new THREE.BoxGeometry(dim.width * 0.86, 0.5, 0.08), glassMat);
      rearWindow.position.set(0, wheelR + 0.78, -dim.length * 0.36);
      rearWindow.rotation.x = Math.PI * 0.14;
      bodyGroup.add(rearWindow);

      // 5. TAXI illuminated roof sign
      const signBase = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.05, 0.3), chromeMat);
      signBase.position.set(0, wheelR + 1.12, -0.1);
      const signLight = new THREE.Mesh(
        new THREE.BoxGeometry(0.65, 0.22, 0.24),
        new THREE.MeshStandardMaterial({
          color: 0xffea00,
          emissive: 0xffd000,
          emissiveIntensity: 0.9,
          roughness: 0.2,
        })
      );
      signLight.position.set(0, wheelR + 1.24, -0.1);
      bodyGroup.add(signBase, signLight);

      // 6. Chrome Grille & Bumpers
      const frontBumper = new THREE.Mesh(new THREE.BoxGeometry(dim.width * 1.02, 0.2, 0.2), chromeMat);
      frontBumper.position.set(0, wheelR + 0.2, dim.length * 0.5 + 0.05);
      const rearBumper = frontBumper.clone();
      rearBumper.position.z = -dim.length * 0.5 - 0.05;
      bodyGroup.add(frontBumper, rearBumper);

      // 7. Headlights & Taillights
      const hlL = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.18, 0.08), headlightMat);
      hlL.position.set(-dim.width * 0.35, wheelR + 0.35, dim.length * 0.5);
      const hlR = hlL.clone();
      hlR.position.x = dim.width * 0.35;
      bodyGroup.add(hlL, hlR);

      const tlL = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.24, 0.08), taillightMat);
      tlL.position.set(-dim.width * 0.36, wheelR + 0.35, -dim.length * 0.5);
      const tlR = tlL.clone();
      tlR.position.x = dim.width * 0.36;
      bodyGroup.add(tlL, tlR);
      break;
    }

    case 'muscle': {
      // 1. Low-slung muscle body
      const bodyMesh = new THREE.Mesh(new THREE.BoxGeometry(dim.width, 0.48, dim.length), paintMat);
      bodyMesh.position.y = wheelR + 0.26;
      bodyMesh.castShadow = true;
      bodyGroup.add(bodyMesh);

      // 2. Sculpted fastback cabin
      const cabinGeo = new THREE.BoxGeometry(dim.width * 0.86, 0.54, dim.length * 0.48);
      const cabin = new THREE.Mesh(cabinGeo, paintMat);
      cabin.position.set(0, wheelR + 0.72, -0.3);
      cabin.castShadow = true;
      bodyGroup.add(cabin);

      // 3. Dual Hood Scoops (Chrome)
      const scoopGeo = new THREE.BoxGeometry(0.22, 0.1, 0.7);
      const scoopL = new THREE.Mesh(scoopGeo, chromeMat);
      scoopL.position.set(-0.35, wheelR + 0.54, 0.8);
      const scoopR = scoopL.clone();
      scoopR.position.x = 0.35;
      bodyGroup.add(scoopL, scoopR);

      // 4. Sloped Windshield & Fastback rear glass
      const windshield = new THREE.Mesh(new THREE.BoxGeometry(dim.width * 0.87, 0.52, 0.08), glassMat);
      windshield.position.set(0, wheelR + 0.74, dim.length * 0.02);
      windshield.rotation.x = -Math.PI * 0.22;
      bodyGroup.add(windshield);

      const fastbackGlass = new THREE.Mesh(new THREE.BoxGeometry(dim.width * 0.84, 0.62, 0.08), glassMat);
      fastbackGlass.position.set(0, wheelR + 0.68, -dim.length * 0.35);
      fastbackGlass.rotation.x = Math.PI * 0.3;
      bodyGroup.add(fastbackGlass);

      // 5. Ducktail rear spoiler
      const spoiler = new THREE.Mesh(new THREE.BoxGeometry(dim.width * 0.95, 0.08, 0.3), paintMat);
      spoiler.position.set(0, wheelR + 0.58, -dim.length * 0.48);
      spoiler.rotation.x = -Math.PI * 0.08;
      bodyGroup.add(spoiler);

      // 6. Dual Quad round headlights
      for (const side of [-1, 1]) {
        const hl1 = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.08, 12).rotateX(Math.PI / 2), headlightMat);
        hl1.position.set(side * (dim.width * 0.25), wheelR + 0.32, dim.length * 0.5 + 0.02);
        const hl2 = hl1.clone();
        hl2.position.x = side * (dim.width * 0.38);
        bodyGroup.add(hl1, hl2);
      }

      // 7. Triple vertical taillight bars (iconic muscle)
      for (const side of [-1, 1]) {
        for (let b = 0; b < 3; b++) {
          const tl = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.2, 0.05), taillightMat);
          tl.position.set(side * (dim.width * 0.24 + b * 0.09), wheelR + 0.32, -dim.length * 0.5 - 0.01);
          bodyGroup.add(tl);
        }
      }

      // 8. Dual chrome exhaust tips
      const exhaustGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.3, 10).rotateX(Math.PI / 2);
      const exL = new THREE.Mesh(exhaustGeo, chromeMat);
      exL.position.set(-0.45, wheelR + 0.12, -dim.length * 0.5 - 0.1);
      const exR = exL.clone();
      exR.position.x = 0.45;
      bodyGroup.add(exL, exR);
      break;
    }

    case 'supercar': {
      // 1. Ultra-low aerodynamic wedge hull
      const mainHull = new THREE.Mesh(new THREE.BoxGeometry(dim.width, 0.4, dim.length), paintMat);
      mainHull.position.y = wheelR + 0.2;
      mainHull.castShadow = true;
      bodyGroup.add(mainHull);

      // 2. Carbon front splitter
      const splitterMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.8 });
      const splitter = new THREE.Mesh(new THREE.BoxGeometry(dim.width * 1.05, 0.06, 0.5), splitterMat);
      splitter.position.set(0, wheelR + 0.05, dim.length * 0.48);
      bodyGroup.add(splitter);

      // 3. Canopy cockpit
      const cockpit = new THREE.Mesh(new THREE.BoxGeometry(dim.width * 0.72, 0.46, dim.length * 0.44), glassMat);
      cockpit.position.set(0, wheelR + 0.56, -0.05);
      bodyGroup.add(cockpit);

      // 4. Massive GT3 rear wing with pylons
      const wingMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.6 });
      const wingBlade = new THREE.Mesh(new THREE.BoxGeometry(dim.width * 1.02, 0.05, 0.45), wingMat);
      wingBlade.position.set(0, wheelR + 0.85, -dim.length * 0.45);
      const pylonL = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.35, 0.15), wingMat);
      pylonL.position.set(-0.6, wheelR + 0.65, -dim.length * 0.45);
      const pylonR = pylonL.clone();
      pylonR.position.x = 0.6;
      bodyGroup.add(wingBlade, pylonL, pylonR);

      // 5. Aggressive LED headlamp strips
      const ledGeo = new THREE.BoxGeometry(0.35, 0.06, 0.12);
      const ledL = new THREE.Mesh(ledGeo, headlightMat);
      ledL.position.set(-dim.width * 0.35, wheelR + 0.3, dim.length * 0.48);
      ledL.rotation.y = -Math.PI * 0.08;
      const ledR = ledL.clone();
      ledR.position.x = dim.width * 0.35;
      ledR.rotation.y = Math.PI * 0.08;
      bodyGroup.add(ledL, ledR);

      // 6. Rear thin LED taillight bar
      const rearBar = new THREE.Mesh(new THREE.BoxGeometry(dim.width * 0.85, 0.06, 0.06), taillightMat);
      rearBar.position.set(0, wheelR + 0.32, -dim.length * 0.5 - 0.01);
      bodyGroup.add(rearBar);
      break;
    }

    case 'bus': {
      // 1. Massive monolithic bus body
      const busBody = new THREE.Mesh(new THREE.BoxGeometry(dim.width, dim.height * 0.75, dim.length), paintMat);
      busBody.position.y = wheelR + dim.height * 0.42;
      busBody.castShadow = true;
      bodyGroup.add(busBody);

      // 2. White roof cap
      const roofMat = new THREE.MeshStandardMaterial({ color: 0xf4f4f5, roughness: 0.4 });
      const busRoof = new THREE.Mesh(new THREE.BoxGeometry(dim.width * 0.98, 0.25, dim.length * 0.98), roofMat);
      busRoof.position.y = wheelR + dim.height * 0.82;
      bodyGroup.add(busRoof);

      // 3. Giant panoramic windshield
      const frontGlass = new THREE.Mesh(new THREE.BoxGeometry(dim.width * 0.92, 1.1, 0.1), glassMat);
      frontGlass.position.set(0, wheelR + 1.25, dim.length * 0.5 + 0.01);
      bodyGroup.add(frontGlass);

      // 4. Passenger side window strip
      const sideGlassGeo = new THREE.BoxGeometry(dim.width + 0.02, 0.8, dim.length * 0.75);
      const sideGlass = new THREE.Mesh(sideGlassGeo, glassMat);
      sideGlass.position.set(0, wheelR + 1.35, -0.4);
      bodyGroup.add(sideGlass);

      // 5. LED Destination sign banner ("LOOP - DOWNTOWN")
      const signMesh = new THREE.Mesh(
        new THREE.BoxGeometry(dim.width * 0.78, 0.32, 0.05),
        new THREE.MeshStandardMaterial({
          map: createBusSignTexture(),
          emissive: 0xffaa00,
          emissiveIntensity: 0.8,
        })
      );
      signMesh.position.set(0, wheelR + 2.05, dim.length * 0.5 + 0.02);
      bodyGroup.add(signMesh);

      // 6. Heavy rubber front and rear bumpers
      const busBumperGeo = new THREE.BoxGeometry(dim.width * 1.02, 0.35, 0.3);
      const frontBumper = new THREE.Mesh(busBumperGeo, rubberMat);
      frontBumper.position.set(0, wheelR + 0.35, dim.length * 0.5 + 0.12);
      const rearBumper = frontBumper.clone();
      rearBumper.position.z = -dim.length * 0.5 - 0.12;
      bodyGroup.add(frontBumper, rearBumper);

      // 7. Bus Headlights & Marker lights
      const hlL = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.2, 0.08), headlightMat);
      hlL.position.set(-dim.width * 0.38, wheelR + 0.45, dim.length * 0.5 + 0.1);
      const hlR = hlL.clone();
      hlR.position.x = dim.width * 0.38;
      bodyGroup.add(hlL, hlR);
      break;
    }

    case 'police': {
      // 1. Sedan interceptor lower body (Gloss black)
      const policeBody = new THREE.Mesh(new THREE.BoxGeometry(dim.width, 0.52, dim.length), paintMat);
      policeBody.position.y = wheelR + 0.28;
      policeBody.castShadow = true;
      bodyGroup.add(policeBody);

      // 2. White side doors & white roof section (classic patrol look)
      const whiteMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 });
      const doorWhiteL = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.46, dim.length * 0.45), whiteMat);
      doorWhiteL.position.set(-dim.width * 0.5 - 0.01, wheelR + 0.28, -0.1);
      const doorWhiteR = doorWhiteL.clone();
      doorWhiteR.position.x = dim.width * 0.5 + 0.01;
      bodyGroup.add(doorWhiteL, doorWhiteR);

      // 3. White cabin roof
      const cabin = new THREE.Mesh(new THREE.BoxGeometry(dim.width * 0.88, 0.6, dim.length * 0.54), whiteMat);
      cabin.position.set(0, wheelR + 0.78, -0.15);
      cabin.castShadow = true;
      bodyGroup.add(cabin);

      // 4. Tinted Police Glass
      const windshield = new THREE.Mesh(new THREE.BoxGeometry(dim.width * 0.89, 0.54, 0.08), glassMat);
      windshield.position.set(0, wheelR + 0.78, dim.length * 0.13);
      windshield.rotation.x = -Math.PI * 0.16;
      bodyGroup.add(windshield);

      const rearWindow = new THREE.Mesh(new THREE.BoxGeometry(dim.width * 0.89, 0.5, 0.08), glassMat);
      rearWindow.position.set(0, wheelR + 0.78, -dim.length * 0.42);
      rearWindow.rotation.x = Math.PI * 0.15;
      bodyGroup.add(rearWindow);

      // 5. Steel push bumper / Bullbar on front
      const barMat = new THREE.MeshStandardMaterial({ color: 0x18181b, metalness: 0.8, roughness: 0.3 });
      const pushBar = new THREE.Mesh(new THREE.BoxGeometry(dim.width * 0.75, 0.5, 0.2), barMat);
      pushBar.position.set(0, wheelR + 0.32, dim.length * 0.5 + 0.12);
      bodyGroup.add(pushBar);

      // 6. Rooftop Pursuit Strobe Lightbar (Dual Blue / Red)
      const lightbarMount = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.06, 0.2), barMat);
      lightbarMount.position.set(0, wheelR + 1.1, -0.15);

      const redStrobe = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.14, 0.16), strobeRedMat);
      redStrobe.position.set(-0.3, wheelR + 1.18, -0.15);

      const blueStrobe = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.14, 0.16), strobeBlueMat);
      blueStrobe.position.set(0.3, wheelR + 1.18, -0.15);

      bodyGroup.add(lightbarMount, redStrobe, blueStrobe);

      // 7. Headlights & Taillights
      const hlL = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.18, 0.08), headlightMat);
      hlL.position.set(-dim.width * 0.36, wheelR + 0.35, dim.length * 0.5);
      const hlR = hlL.clone();
      hlR.position.x = dim.width * 0.36;
      bodyGroup.add(hlL, hlR);

      const tlL = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.22, 0.08), taillightMat);
      tlL.position.set(-dim.width * 0.36, wheelR + 0.35, -dim.length * 0.5);
      const tlR = tlL.clone();
      tlR.position.x = dim.width * 0.36;
      bodyGroup.add(tlL, tlR);
      break;
    }

    case 'truck': {
      // 1. Semi tractor main cab
      const cabGeo = new THREE.BoxGeometry(dim.width * 0.9, dim.height * 0.65, dim.length * 0.55);
      const cab = new THREE.Mesh(cabGeo, paintMat);
      cab.position.set(0, wheelR + dim.height * 0.36, -dim.length * 0.05);
      cab.castShadow = true;
      bodyGroup.add(cab);

      // 2. Long engine hood / nose
      const hoodGeo = new THREE.BoxGeometry(dim.width * 0.82, dim.height * 0.38, dim.length * 0.42);
      const hood = new THREE.Mesh(hoodGeo, paintMat);
      hood.position.set(0, wheelR + dim.height * 0.22, dim.length * 0.32);
      hood.castShadow = true;
      bodyGroup.add(hood);

      // 3. Huge vertical chrome front grille
      const grille = new THREE.Mesh(new THREE.BoxGeometry(dim.width * 0.72, dim.height * 0.38, 0.1), chromeMat);
      grille.position.set(0, wheelR + dim.height * 0.22, dim.length * 0.53);
      bodyGroup.add(grille);

      // 4. Split dual windshield
      const wsGeo = new THREE.BoxGeometry(dim.width * 0.38, 0.7, 0.08);
      const wsL = new THREE.Mesh(wsGeo, glassMat);
      wsL.position.set(-0.48, wheelR + dim.height * 0.52, dim.length * 0.12);
      const wsR = wsL.clone();
      wsR.position.x = 0.48;
      bodyGroup.add(wsL, wsR);

      // 5. Dual Tall Chrome Exhaust Stacks
      const stackGeo = new THREE.CylinderGeometry(0.1, 0.1, dim.height * 0.85, 12);
      const stackL = new THREE.Mesh(stackGeo, chromeMat);
      stackL.position.set(-dim.width * 0.46, wheelR + dim.height * 0.55, -dim.length * 0.15);
      const stackR = stackL.clone();
      stackR.position.x = dim.width * 0.46;
      bodyGroup.add(stackL, stackR);

      // 6. Rear chassis beams / fifth wheel coupling plate
      const beamMat = new THREE.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.7 });
      const rearBeams = new THREE.Mesh(new THREE.BoxGeometry(dim.width * 0.75, 0.3, dim.length * 0.48), beamMat);
      rearBeams.position.set(0, wheelR + 0.18, -dim.length * 0.32);
      bodyGroup.add(rearBeams);

      const fifthWheel = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.1, 14), beamMat);
      fifthWheel.position.set(0, wheelR + 0.35, -dim.length * 0.35);
      bodyGroup.add(fifthWheel);

      // 7. Headlights & Roof Air Horns
      const hlL = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.25, 0.08), headlightMat);
      hlL.position.set(-dim.width * 0.38, wheelR + 0.4, dim.length * 0.52);
      const hlR = hlL.clone();
      hlR.position.x = dim.width * 0.38;
      bodyGroup.add(hlL, hlR);

      const hornGeo = new THREE.CylinderGeometry(0.08, 0.04, 0.6, 8).rotateX(Math.PI / 2);
      const hornL = new THREE.Mesh(hornGeo, chromeMat);
      hornL.position.set(-0.4, wheelR + dim.height * 0.72, -0.05);
      const hornR = hornL.clone();
      hornR.position.x = 0.4;
      bodyGroup.add(hornL, hornR);
      break;
    }
  }

  // Wheels installation
  const trackWidth = dim.width * 0.94;
  const wheelBaseHalf = dim.length * 0.35;

  // Front wheels (left + right) with steering mount groups
  const frontLeftMount = new THREE.Group();
  frontLeftMount.position.set(-trackWidth / 2, wheelR, wheelBaseHalf);
  const frontLeftWheel = createWheel(wheelR, wheelW, rubberMat, rimMat);
  frontLeftMount.add(frontLeftWheel);

  const frontRightMount = new THREE.Group();
  frontRightMount.position.set(trackWidth / 2, wheelR, wheelBaseHalf);
  const frontRightWheel = createWheel(wheelR, wheelW, rubberMat, rimMat);
  frontRightMount.add(frontRightWheel);

  root.add(frontLeftMount, frontRightMount);
  frontWheels.push(frontLeftMount, frontRightMount);

  // Rear wheels
  const rearLeftMount = new THREE.Group();
  rearLeftMount.position.set(-trackWidth / 2, wheelR, -wheelBaseHalf);
  const rearLeftWheel = createWheel(wheelR, wheelW, rubberMat, rimMat);
  rearLeftMount.add(rearLeftWheel);

  const rearRightMount = new THREE.Group();
  rearRightMount.position.set(trackWidth / 2, wheelR, -wheelBaseHalf);
  const rearRightWheel = createWheel(wheelR, wheelW, rubberMat, rimMat);
  rearRightMount.add(rearRightWheel);

  root.add(rearLeftMount, rearRightMount);
  rearWheels.push(rearLeftMount, rearRightMount);

  // Extra axle for Bus and Truck (dual rear axles for authentic heavy vehicle look!)
  if (config.id === 'bus' || config.id === 'truck') {
    const extraZ = -wheelBaseHalf - wheelR * 2.2;
    const extraLeft = new THREE.Group();
    extraLeft.position.set(-trackWidth / 2, wheelR, extraZ);
    extraLeft.add(createWheel(wheelR, wheelW, rubberMat, rimMat));

    const extraRight = new THREE.Group();
    extraRight.position.set(trackWidth / 2, wheelR, extraZ);
    extraRight.add(createWheel(wheelR, wheelW, rubberMat, rimMat));

    root.add(extraLeft, extraRight);
    rearWheels.push(extraLeft, extraRight);
  }

  // Soft contact shadow disc under car
  const shadowGeo = new THREE.PlaneGeometry(dim.width * 1.3, dim.length * 1.25);
  shadowGeo.rotateX(-Math.PI / 2);
  const shadowMat = new THREE.MeshBasicMaterial({
    color: 0x000000,
    transparent: true,
    opacity: 0.45,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  const shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
  shadowMesh.position.y = 0.02;
  root.add(shadowMesh);

  return {
    group: root,
    bodyMesh: bodyGroup,
    materials,
    frontWheels,
    rearWheels,
    config,
  };
}

/**
 * Updates wheel visual spin and steering yaw
 */
export function updateVehicleWheelVisuals(
  bundle: VehicleMeshBundle,
  steeringAngle: number,
  distanceTraveledDelta: number
) {
  const wheelR = bundle.config.dimensions.wheelRadius;
  const spinDelta = distanceTraveledDelta / wheelR;

  // Steering angle applied to front mounts
  for (const mount of bundle.frontWheels) {
    mount.rotation.y = steeringAngle;
    const wheelChild = mount.children[0];
    if (wheelChild) {
      wheelChild.rotation.x += spinDelta;
    }
  }

  // Rear wheels spin only
  for (const mount of bundle.rearWheels) {
    const wheelChild = mount.children[0];
    if (wheelChild) {
      wheelChild.rotation.x += spinDelta;
    }
  }

  // Strobe flashing for police
  if (bundle.config.id === 'police' && bundle.materials.strobeBlue && bundle.materials.strobeRed) {
    bundle.strobeTime = (bundle.strobeTime || 0) + 0.15;
    const phase = Math.sin(bundle.strobeTime * 14) > 0;
    bundle.materials.strobeBlue.emissiveIntensity = phase ? 3.5 : 0.1;
    bundle.materials.strobeRed.emissiveIntensity = !phase ? 3.5 : 0.1;
  }
}
