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
  name?: string;
  userData?: Record<string, any>;
}

/**
 * Displays an IFC model by cloning its meshes into a single <group>
 * and automatically recentring the whole model at the origin.
 */
export const IFCModel: React.FC<IFCModelProps> = ({
  geometry,
  transparency,
  name,
  userData,
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

    // Se ha eliminado la lógica de recentrado que estaba aquí.
    // El componente ahora renderiza los meshes en sus coordenadas originales,
    // y el centrado se gestionará de forma global en el componente padre.
    
  }, [geometry]);

  /* ---------- 4. Update transparency every time the slider changes ---------- */
  useEffect(() => {
    meshesRef.current.forEach((mesh) => {
      const applyOpacity = (material: THREE.Material): void => {
        (material as any).transparent = transparency < 1;
        (material as any).opacity = transparency;
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
  return <group ref={groupRef} name={name} userData={userData} />;
};
