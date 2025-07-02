import * as THREE from 'three';
import type { Point } from '../components/PointCloudViewer';
import { BVHContext, closestPoint } from './bvhIntersect';

/** Resultado de cobertura para un elemento IFC. */
export interface CoverageEntry {
  matchedPts: number;
  coverage: number;
}

export type CoverageMap = Record<string, CoverageEntry>;

/**
 * Calcula el número de puntos que se encuentran a menos de `tol` metros de
 * cada triángulo del modelo IFC. Se requiere un BVH previamente construido.
 */
export function computeCoverage(
  points: Point[],
  context: BVHContext,
  tol = 0.02,
): CoverageMap {
  const result: CoverageMap = {};
  const geom = context.mesh.geometry as THREE.BufferGeometry;
  const expressIDs = geom.getAttribute('expressID') as THREE.BufferAttribute | undefined;
  const tri = new THREE.Triangle();
  const temp = new THREE.Vector3();

  for (const p of points) {
    temp.set(p.x, p.y, p.z);
    const { distance, point } = closestPoint(context, temp);
    if (distance < tol) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const faceIndex = (context as any).bvh.closestFaceIndex!;
      const eid = expressIDs ? expressIDs.getX(faceIndex * 3) : 0;
      const key = String(eid);
      result[key] = result[key] || { matchedPts: 0, coverage: 0 };
      result[key].matchedPts += 1;
    }
  }

  // Calcular porcentaje de cobertura normalizado por área de triángulo
  if (expressIDs) {
    const areaById: Record<string, number> = {};
    const pos = geom.getAttribute('position');
    for (let i = 0; i < pos.count; i += 3) {
      tri.set(
        new THREE.Vector3(pos.getX(i), pos.getY(i), pos.getZ(i)),
        new THREE.Vector3(pos.getX(i+1), pos.getY(i+1), pos.getZ(i+1)),
        new THREE.Vector3(pos.getX(i+2), pos.getY(i+2), pos.getZ(i+2)),
      );
      const id = String(expressIDs.getX(i));
      areaById[id] = (areaById[id] || 0) + tri.getArea();
    }
    for (const id of Object.keys(result)) {
      result[id].coverage = (result[id].matchedPts / areaById[id]) * 100;
    }
  }

  return result;
}
