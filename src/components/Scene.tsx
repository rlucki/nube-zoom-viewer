
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
    
    // Mejorar la iluminación para los modelos IFC
    // Luz ambiental más intensa
    const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
    scene.add(ambientLight);
    
    // Luz direccional principal
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(50, 50, 50);
    directionalLight.castShadow = true;
    scene.add(directionalLight);
    
    // Luz direccional secundaria para eliminar sombras duras
    const directionalLight2 = new THREE.DirectionalLight(0xffffff, 0.5);
    directionalLight2.position.set(-50, 50, -50);
    scene.add(directionalLight2);
    
    // Luz hemisférica para un relleno suave
    const hemisphereLight = new THREE.HemisphereLight(0xffffbb, 0x080820, 0.3);
    scene.add(hemisphereLight);
    
    return () => {
      scene.remove(gridHelper);
      scene.remove(ambientLight);
      scene.remove(directionalLight);
      scene.remove(directionalLight2);
      scene.remove(hemisphereLight);
    };
  }, [scene]);

  return (
    <>
      <color attach="background" args={['#1a1a1a']} />
      {children}
    </>
  );
};
