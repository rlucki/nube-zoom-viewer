
import React, { useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';

interface SceneProps {
  children: React.ReactNode;
}

export const Scene: React.FC<SceneProps> = ({ children }) => {
  const { scene } = useThree();

  useEffect(() => {
    // Crear grilla personalizada con opacidad reducida
    const gridHelper = new THREE.GridHelper(100, 100, '#ffffff', '#ffffff');
    
    // Reducir la opacidad de la grilla al 20%
    if (gridHelper.material) {
      if (Array.isArray(gridHelper.material)) {
        gridHelper.material.forEach(material => {
          material.transparent = true;
          material.opacity = 0.2;
        });
      } else {
        gridHelper.material.transparent = true;
        gridHelper.material.opacity = 0.2;
      }
    }
    
    scene.add(gridHelper);
    
    return () => {
      scene.remove(gridHelper);
    };
  }, [scene]);

  return (
    <>
      <color attach="background" args={['#1a1a1a']} />
      {children}
    </>
  );
};
