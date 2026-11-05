import * as THREE from 'three';

export class SkidMarkManager {
  private mesh: THREE.InstancedMesh;
  private maxSkids = 280;
  private currentIdx = 0;
  private dummy = new THREE.Object3D();
  private lastPosL = new THREE.Vector3();
  private lastPosR = new THREE.Vector3();
  private hasLast = false;

  constructor(scene: THREE.Object3D) {
    const geo = new THREE.PlaneGeometry(0.36, 1.4);
    geo.rotateX(-Math.PI / 2);

    const mat = new THREE.MeshBasicMaterial({
      color: 0x111113,
      transparent: true,
      opacity: 0.65,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });

    this.mesh = new THREE.InstancedMesh(geo, mat, this.maxSkids);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;

    // Initialize off-screen
    for (let i = 0; i < this.maxSkids; i++) {
      this.dummy.position.set(0, -1000, 0);
      this.dummy.updateMatrix();
      this.mesh.setMatrixAt(i, this.dummy.matrix);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    scene.add(this.mesh);
  }

  public addSkidPair(
    posLX: number,
    posLZ: number,
    posRX: number,
    posRZ: number,
    heading: number,
    opacity = 0.7
  ) {
    // Check distance from previous point to avoid dense overlapping
    if (this.hasLast) {
      const dist = Math.hypot(posLX - this.lastPosL.x, posLZ - this.lastPosL.z);
      if (dist < 0.65) return;
    }

    this.lastPosL.set(posLX, 0.025, posLZ);
    this.lastPosR.set(posRX, 0.025, posRZ);
    this.hasLast = true;

    // Left tire mark
    this.dummy.position.set(posLX, 0.025, posLZ);
    this.dummy.rotation.set(0, heading, 0);
    this.dummy.scale.set(1, 1, 1);
    this.dummy.updateMatrix();
    this.mesh.setMatrixAt(this.currentIdx % this.maxSkids, this.dummy.matrix);
    this.currentIdx++;

    // Right tire mark
    this.dummy.position.set(posRX, 0.025, posRZ);
    this.dummy.rotation.set(0, heading, 0);
    this.dummy.scale.set(1, 1, 1);
    this.dummy.updateMatrix();
    this.mesh.setMatrixAt(this.currentIdx % this.maxSkids, this.dummy.matrix);
    this.currentIdx++;

    this.mesh.count = Math.min(this.currentIdx, this.maxSkids);
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  public breakStreak() {
    this.hasLast = false;
  }

  public clear() {
    this.currentIdx = 0;
    this.mesh.count = 0;
    this.hasLast = false;
  }
}
