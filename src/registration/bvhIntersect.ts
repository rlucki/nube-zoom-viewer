import { MeshBVH, acceleratedRaycast } from 'three-mesh-bvh';
import * as THREE from 'three';

// three-mesh-bvh requiere parchear el método raycast
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(THREE.Mesh as any).prototype.raycast = acceleratedRaycast;

export interface BVHContext {
  mesh: THREE.Mesh;
  bvh: MeshBVH;
}

/** Construye un BVH para un mesh dado. */
export function buildBVH(mesh: THREE.Mesh): BVHContext {
  const geometry = mesh.geometry as THREE.BufferGeometry & { boundsTree?: MeshBVH };
  if (!geometry.boundsTree) {
    geometry.boundsTree = new MeshBVH(geometry, { lazyGeneration: false });
  }
  return { mesh, bvh: geometry.boundsTree };
}

/** Encuentra el punto más cercano en el BVH y devuelve la distancia al mismo. */
export function closestPoint(context: BVHContext, point: THREE.Vector3): { point: THREE.Vector3; distance: number } {
  const target = new THREE.Vector3();
  const distance = context.bvh.closestPointToPoint(point, target);
  return { point: target, distance: Math.sqrt(distance) };
}
