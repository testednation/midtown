import * as THREE from 'three';

interface Particle {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  size: number;
  opacity: number;
  life: number;
  maxLife: number;
  color: THREE.Color;
}

export class ParticleManager {
  private particles: Particle[] = [];
  private geometry: THREE.BufferGeometry;
  private material: THREE.PointsMaterial;
  private points: THREE.Points;
  private maxParticles = 900;

  private positions: Float32Array;
  private colors: Float32Array;

  constructor(scene: THREE.Object3D) {
    this.positions = new Float32Array(this.maxParticles * 3);
    this.colors = new Float32Array(this.maxParticles * 3);

    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    this.geometry.setAttribute('color', new THREE.BufferAttribute(this.colors, 3));

    // Procedural round soft particle texture
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext('2d')!;
    const grad = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
    grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
    grad.addColorStop(0.35, 'rgba(255, 255, 255, 0.75)');
    grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 32, 32);

    const texture = new THREE.CanvasTexture(canvas);

    this.material = new THREE.PointsMaterial({
      size: 0.95,
      map: texture,
      transparent: true,
      vertexColors: true,
      depthWrite: false,
      blending: THREE.NormalBlending,
    });

    this.points = new THREE.Points(this.geometry, this.material);
    this.points.frustumCulled = false;
    scene.add(this.points);
  }

  public emitDriftSmoke(x: number, y: number, z: number, count = 3) {
    for (let i = 0; i < count; i++) {
      if (this.particles.length >= this.maxParticles) break;
      this.particles.push({
        x: x + (Math.random() - 0.5) * 0.4,
        y: y + 0.1,
        z: z + (Math.random() - 0.5) * 0.4,
        vx: (Math.random() - 0.5) * 0.8,
        vy: 0.5 + Math.random() * 0.8,
        vz: (Math.random() - 0.5) * 0.8,
        size: 0.65 + Math.random() * 0.5,
        opacity: 0.65,
        life: 0,
        maxLife: 0.6 + Math.random() * 0.4,
        color: new THREE.Color(0xd4d4d8),
      });
    }
  }

  public emitCrashSparks(x: number, y: number, z: number, count = 18) {
    for (let i = 0; i < count; i++) {
      if (this.particles.length >= this.maxParticles) break;
      this.particles.push({
        x,
        y: y + 0.5,
        z,
        vx: (Math.random() - 0.5) * 14,
        vy: 3 + Math.random() * 9,
        vz: (Math.random() - 0.5) * 14,
        size: 0.42,
        opacity: 1.0,
        life: 0,
        maxLife: 0.35 + Math.random() * 0.25,
        color: new THREE.Color(Math.random() > 0.3 ? 0xf59e0b : 0xfacc15),
      });
    }
  }

  // Wood splinters when hitting construction barriers
  public emitWoodSplinters(x: number, y: number, z: number, count = 16) {
    for (let i = 0; i < count; i++) {
      if (this.particles.length >= this.maxParticles) break;
      this.particles.push({
        x,
        y: y + 0.4,
        z,
        vx: (Math.random() - 0.5) * 10,
        vy: 3 + Math.random() * 6,
        vz: (Math.random() - 0.5) * 10,
        size: 0.35 + Math.random() * 0.3,
        opacity: 0.95,
        life: 0,
        maxLife: 0.8 + Math.random() * 0.4,
        color: new THREE.Color(Math.random() > 0.5 ? 0xd97706 : 0xb45309), // Amber wood tones
      });
    }
  }

  // Glass shards when hitting street lampposts
  public emitGlassShards(x: number, y: number, z: number, count = 20) {
    for (let i = 0; i < count; i++) {
      if (this.particles.length >= this.maxParticles) break;
      this.particles.push({
        x,
        y: y + 1.2,
        z,
        vx: (Math.random() - 0.5) * 8,
        vy: 4 + Math.random() * 8,
        vz: (Math.random() - 0.5) * 8,
        size: 0.28,
        opacity: 0.9,
        life: 0,
        maxLife: 0.7 + Math.random() * 0.4,
        color: new THREE.Color(0xe0f2fe), // Bright cyan glass
      });
    }
  }

  public emitHydrantWater(x: number, z: number, count = 7) {
    for (let i = 0; i < count; i++) {
      if (this.particles.length >= this.maxParticles) break;
      this.particles.push({
        x: x + (Math.random() - 0.5) * 0.5,
        y: 0.6,
        z: z + (Math.random() - 0.5) * 0.5,
        vx: (Math.random() - 0.5) * 3.0,
        vy: 9 + Math.random() * 8, // Pressurized geyser
        vz: (Math.random() - 0.5) * 3.0,
        size: 0.75,
        opacity: 0.8,
        life: 0,
        maxLife: 1.3 + Math.random() * 0.6,
        color: new THREE.Color(0x38bdf8),
      });
    }
  }

  public emitEngineDamageSmoke(x: number, y: number, z: number) {
    if (this.particles.length >= this.maxParticles) return;
    this.particles.push({
      x: x + (Math.random() - 0.5) * 0.35,
      y: y + 0.6,
      z: z + (Math.random() - 0.5) * 0.35,
      vx: (Math.random() - 0.5) * 0.6,
      vy: 1.8 + Math.random() * 1.4,
      vz: (Math.random() - 0.5) * 0.6,
      size: 0.85,
      opacity: 0.8,
      life: 0,
      maxLife: 0.85,
      color: new THREE.Color(0x27272a),
    });
  }

  public update(dt: number) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life += dt;

      if (p.life >= p.maxLife) {
        this.particles.splice(i, 1);
        continue;
      }

      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;

      // Gravity for sparks, splinters, shards, and water
      p.vy -= 11.5 * dt;

      p.size += dt * 0.7;
      p.opacity = 1 - p.life / p.maxLife;
    }

    // Update GPU buffers
    let posIdx = 0;
    let colIdx = 0;

    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      this.positions[posIdx++] = p.x;
      this.positions[posIdx++] = p.y;
      this.positions[posIdx++] = p.z;

      this.colors[colIdx++] = p.color.r * p.opacity;
      this.colors[colIdx++] = p.color.g * p.opacity;
      this.colors[colIdx++] = p.color.b * p.opacity;
    }

    // Fill remaining buffer with zero
    for (let i = this.particles.length; i < this.maxParticles; i++) {
      this.positions[posIdx++] = 0;
      this.positions[posIdx++] = -1000;
      this.positions[posIdx++] = 0;
      this.colors[colIdx++] = 0;
      this.colors[colIdx++] = 0;
      this.colors[colIdx++] = 0;
    }

    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.attributes.color.needsUpdate = true;
  }
}
