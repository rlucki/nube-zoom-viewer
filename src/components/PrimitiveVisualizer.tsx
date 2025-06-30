
import React, { useMemo } from 'react';
import * as THREE from 'three';
import { DetectedPrimitive } from '../utils/primitiveDetection';

interface PrimitiveVisualizerProps {
  primitives: DetectedPrimitive[];
  visible: boolean;
}

export const PrimitiveVisualizer: React.FC<PrimitiveVisualizerProps> = ({
  primitives,
  visible,
}) => {
  const visualizations = useMemo(() => {
    if (!visible || primitives.length === 0) return [];

    return primitives.map((primitive, index) => {
      const key = `${primitive.type}_${index}`;
      
      if (primitive.type === 'plane') {
        // Crear un plano visual
        const size = 5;
        const geometry = new THREE.PlaneGeometry(size, size);
        const material = new THREE.MeshBasicMaterial({
          color: new THREE.Color().setHSL(index * 0.3, 0.7, 0.5),
          transparent: true,
          opacity: 0.3,
          side: THREE.DoubleSide,
        });

        // Posicionar y orientar el plano
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.copy(primitive.point);
        mesh.lookAt(primitive.point.clone().add(primitive.normal));
        
        return (
          <primitive key={key} object={mesh} />
        );
      } else if (primitive.type === 'cylinder') {
        // Crear un cilindro visual
        const height = 2;
        const geometry = new THREE.CylinderGeometry(primitive.radius, primitive.radius, height, 16);
        const material = new THREE.MeshBasicMaterial({
          color: new THREE.Color().setHSL((index + 0.5) * 0.3, 0.7, 0.5),
          transparent: true,
          opacity: 0.4,
          wireframe: true,
        });

        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.copy(primitive.axis);
        
        // Orientar el cilindro según su dirección
        const up = new THREE.Vector3(0, 1, 0);
        const quaternion = new THREE.Quaternion().setFromUnitVectors(up, primitive.direction);
        mesh.setRotationFromQuaternion(quaternion);

        return (
          <primitive key={key} object={mesh} />
        );
      }
      
      return null;
    }).filter(Boolean);
  }, [primitives, visible]);

  return <>{visualizations}</>;
};
