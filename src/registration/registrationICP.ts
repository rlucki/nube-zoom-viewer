
import * as THREE from 'three';
import { SVD } from 'svd-js';
import type { Point } from '../components/PointCloudViewer';

export interface ICPOptions {
  maxIterations?: number;
  tolerance?: number;
  sampleRatio?: number;
}

export interface ICPResult {
  matrix: THREE.Matrix4;
  iterations: number;
  error: number;
}

function bestFitTransform(src: THREE.Vector3[], dst: THREE.Vector3[]): THREE.Matrix4 {
  const n = src.length;
  const srcCentroid = new THREE.Vector3();
  const dstCentroid = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    srcCentroid.add(src[i]);
    dstCentroid.add(dst[i]);
  }
  srcCentroid.divideScalar(n);
  dstCentroid.divideScalar(n);

  const H: number[][] = [ [0,0,0],[0,0,0],[0,0,0] ];
  for (let i = 0; i < n; i++) {
    const a = src[i].clone().sub(srcCentroid);
    const b = dst[i].clone().sub(dstCentroid);
    H[0][0] += a.x * b.x; H[0][1] += a.x * b.y; H[0][2] += a.x * b.z;
    H[1][0] += a.y * b.x; H[1][1] += a.y * b.y; H[1][2] += a.y * b.z;
    H[2][0] += a.z * b.x; H[2][1] += a.z * b.y; H[2][2] += a.z * b.z;
  }

  const { u, v } = SVD(H, true, true);
  const R: number[][] = new Array(3).fill(0).map(() => new Array(3).fill(0));
  for (let i = 0; i < 3; i++)
    for (let j = 0; j < 3; j++)
      R[i][j] = v[i][0] * u[j][0] + v[i][1] * u[j][1] + v[i][2] * u[j][2];

  // Corregir reflexión
  const det = R[0][0]*R[1][1]*R[2][2] + R[0][1]*R[1][2]*R[2][0] + R[0][2]*R[1][0]*R[2][1]
            - R[0][2]*R[1][1]*R[2][0] - R[0][1]*R[1][0]*R[2][2] - R[0][0]*R[1][2]*R[2][1];
  if (det < 0) {
    for (let i = 0; i < 3; i++) v[2][i] *= -1;
    for (let i = 0; i < 3; i++)
      for (let j = 0; j < 3; j++)
        R[i][j] = v[i][0] * u[j][0] + v[i][1] * u[j][1] + v[i][2] * u[j][2];
  }

  // Convert Matrix3 to Matrix4 properly
  const rotationMatrix4 = new THREE.Matrix4().set(
    R[0][0], R[0][1], R[0][2], 0,
    R[1][0], R[1][1], R[1][2], 0,
    R[2][0], R[2][1], R[2][2], 0,
    0, 0, 0, 1
  );

  const rotation = new THREE.Matrix3().set(
    R[0][0], R[0][1], R[0][2],
    R[1][0], R[1][1], R[1][2],
    R[2][0], R[2][1], R[2][2],
  ).transpose();

  const t = dstCentroid.clone().sub(srcCentroid.applyMatrix3(rotation));

  const m = new THREE.Matrix4();
  const quaternion = new THREE.Quaternion().setFromRotationMatrix(rotationMatrix4);
  m.makeRotationFromQuaternion(quaternion);
  m.setPosition(t);
  return m;
}

function nearest(point: THREE.Vector3, cloud: THREE.Vector3[]): { point: THREE.Vector3; dist: number } {
  let min = Infinity;
  let closest = cloud[0];
  for (const p of cloud) {
    const d = point.distanceToSquared(p);
    if (d < min) { min = d; closest = p; }
  }
  return { point: closest, dist: Math.sqrt(min) };
}

/** Simple ICP registration between two point arrays. */
export function registrationICP(
  source: Point[],
  target: Point[],
  options: ICPOptions = {},
): ICPResult {
  const maxIterations = options.maxIterations ?? 20;
  const tolerance = options.tolerance ?? 1e-4;
  const sampleRatio = options.sampleRatio ?? 1;

  const srcVectors = source.map(p => new THREE.Vector3(p.x, p.y, p.z));
  const tgtVectors = target.map(p => new THREE.Vector3(p.x, p.y, p.z));

  let transform = new THREE.Matrix4();
  let prevError = Infinity;

  for (let iter = 0; iter < maxIterations; iter++) {
    const moved = srcVectors.map(v => v.clone().applyMatrix4(transform));

    const srcSample: THREE.Vector3[] = [];
    const dstSample: THREE.Vector3[] = [];
    for (const p of moved) {
      if (Math.random() > sampleRatio) continue;
      const { point: q, dist } = nearest(p, tgtVectors);
      srcSample.push(p);
      dstSample.push(q);
      prevError = Math.min(prevError, dist);
    }

    if (srcSample.length < 3) break;

    const delta = bestFitTransform(srcSample, dstSample);
    transform = delta.multiply(transform);

    const err = srcSample.reduce((acc, p, i) => acc + p.distanceTo(dstSample[i]), 0) / srcSample.length;
    if (Math.abs(prevError - err) < tolerance) {
      return { matrix: transform, iterations: iter + 1, error: err };
    }
    prevError = err;
  }

  return { matrix: transform, iterations: maxIterations, error: prevError };
}
