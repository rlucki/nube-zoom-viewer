import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import type { IFCGeometry } from './PointCloudViewer';

/**
 * Props that the IFCModel component expects.
 */
interface IFCModelProps {
  /** Geometry container with the raw meshes already created by your loader. */
  geometry: IFCGeometry;
  /** Desired opacity (1 = fully opaque, 0 = fully transparent). */
  transparency: number;
}

/**
 * Displays an IFC model by cloning its meshes into a single <group>
 * and automatically recentring the whole model at the origin.
 */
export const IFCModel: React.FC<IFCModelProps> = ({
  geometry,
  transparency,
}) => {
  /** <group> that will hold every mesh clone. */
  const groupRef  = useRef<THREE.Group>(null);
  /** Array for quick access when updating material opacity. */
  const meshesRef = useRef<THREE.Mesh[]>([]);

  /* ---------- 1. Clone meshes the first time geometry arrives ---------- */
  useEffect(() => {
    if (!groupRef.current || !geometry.meshes) return;

    /* Remove anything that might already be in this group. */
    groupRef.current.clear();
    meshesRef.current = [];

    /* Clone every mesh so we can freely reposition without touching the loader-owned originals. */
    geometry.meshes.forEach((sourceMesh) => {
      const meshClone = sourceMesh.clone();
      meshesRef.current.push(meshClone);
      groupRef.current!.add(meshClone);
    });

    /* ---------- 2. Build one Box3 that encloses the entire model ---------- */
    const globalBox = new THREE.Box3();
    meshesRef.current.forEach((mesh) => {
      mesh.geometry.computeBoundingBox();          // make sure each mesh has a bounding box
      if (mesh.geometry.boundingBox) {
        globalBox.union(mesh.geometry.boundingBox);
      }
    });

    /* ---------- 3. Move the whole group so its centre becomes (0, 0, 0) ---------- */
    const centre = new THREE.Vector3();
    globalBox.getCenter(centre);
    groupRef.current.position.set(-centre.x, -centre.y, -centre.z);

    /* Optional: uniform scaling so IFC in millimetres matches point cloud in metres.
       Example (1/1000 => mm → m):
       const size = new THREE.Vector3();
       globalBox.getSize(size);
       const unitScale = 1 / 1000;
       groupRef.current.scale.set(unitScale, unitScale, unitScale);
    */
  }, [geometry]);

  /* ---------- 4. Update transparency every time the slider changes ---------- */
  useEffect(() => {
    meshesRef.current.forEach((mesh) => {
      const applyOpacity = (material: THREE.Material): void => {
        // @ts-expect-error mesh materials share 'transparent' but typing lacks it
        material.transparent = transparency < 1;
        // @ts-expect-error mesh materials share 'opacity' but typing lacks it
        material.opacity = transparency;
        material.needsUpdate = true;
      };

      if (Array.isArray(mesh.material)) {
        mesh.material.forEach(applyOpacity);
      } else {
        applyOpacity(mesh.material as THREE.Material);
      }
    });
  }, [transparency]);

  /* ---------- 5. Render only the group (meshes are inside). ---------- */
  return <group ref={groupRef} />;
};
