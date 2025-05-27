
import React, { useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { IFCGeometry } from './PointCloudViewer';

interface IFCModelProps {
  geometry: IFCGeometry;
  transparency: number;
}

export const IFCModel: React.FC<IFCModelProps> = ({ geometry, transparency }) => {
  const groupRef = useRef<THREE.Group>(null);

  useEffect(() => {
    if (!groupRef.current || !geometry.meshes) return;

    // Clear existing meshes
    groupRef.current.clear();

    // Add all meshes to the group
    geometry.meshes.forEach(mesh => {
      const clonedMesh = mesh.clone();
      
      // Update material with transparency
      if (clonedMesh.material) {
        if (Array.isArray(clonedMesh.material)) {
          clonedMesh.material.forEach(mat => {
            mat.transparent = true;
            mat.opacity = transparency;
            mat.needsUpdate = true;
          });
        } else {
          const material = clonedMesh.material as THREE.Material;
          material.transparent = true;
          material.opacity = transparency;
          material.needsUpdate = true;
        }
      }
      
      groupRef.current!.add(clonedMesh);
    });

    // Center the model
    const box = new THREE.Box3().setFromObject(groupRef.current);
    const center = box.getCenter(new THREE.Vector3());
    groupRef.current.position.copy(center.negate());

  }, [geometry, transparency]);

  return <group ref={groupRef} />;
};
