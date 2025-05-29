
import React, { useRef, useEffect } from 'react';
import * as THREE from 'three';
import type { IFCGeometry } from './PointCloudViewer';

interface IFCModelProps {
  geometry: IFCGeometry;
  transparency: number;
}

export const IFCModel: React.FC<IFCModelProps> = ({ geometry, transparency }) => {
  const groupRef = useRef<THREE.Group>(null);
  const meshesRef = useRef<THREE.Mesh[]>([]);

  // Initialize meshes only once
  useEffect(() => {
    if (!groupRef.current || !geometry.meshes) return;

    // Clear existing meshes
    groupRef.current.clear();
    meshesRef.current = [];

    // Add all meshes to the group (only once)
    geometry.meshes.forEach(mesh => {
      const clonedMesh = mesh.clone();
      meshesRef.current.push(clonedMesh);
      groupRef.current!.add(clonedMesh);
    });

    // No aplicar offset automático - dejar el modelo en su posición original
    // Esto ayuda a que coincida mejor con la nube de puntos

  }, [geometry]);

  // Update transparency without recreating meshes
  useEffect(() => {
    if (!meshesRef.current.length) return;

    meshesRef.current.forEach(mesh => {
      if (mesh.material) {
        if (Array.isArray(mesh.material)) {
          mesh.material.forEach(mat => {
            mat.transparent = transparency < 1;
            mat.opacity = transparency;
            mat.needsUpdate = true;
          });
        } else {
          const material = mesh.material as THREE.Material;
          material.transparent = transparency < 1;
          material.opacity = transparency;
          material.needsUpdate = true;
        }
      }
    });
  }, [transparency]);

  return <group ref={groupRef} />;
};
