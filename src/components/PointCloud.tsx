
import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { Point } from './PointCloudViewer';

interface PointCloudProps {
  points: Point[];
  pointSize: number;
  colorMode: 'rgb' | 'intensity' | 'height';
}

export const PointCloud: React.FC<PointCloudProps> = ({ 
  points, 
  pointSize, 
  colorMode 
}) => {
  const meshRef = useRef<THREE.Points>(null);

  const { geometry, material } = useMemo(() => {
    const geometry = new THREE.BufferGeometry();
    
    // Create position array
    const positions = new Float32Array(points.length * 3);
    const colors = new Float32Array(points.length * 3);
    
    // Calculate bounds for height-based coloring
    let minZ = Infinity;
    let maxZ = -Infinity;
    let minIntensity = Infinity;
    let maxIntensity = -Infinity;
    
    points.forEach(point => {
      minZ = Math.min(minZ, point.z);
      maxZ = Math.max(maxZ, point.z);
      if (point.intensity !== undefined) {
        minIntensity = Math.min(minIntensity, point.intensity);
        maxIntensity = Math.max(maxIntensity, point.intensity);
      }
    });
    
    points.forEach((point, i) => {
      const i3 = i * 3;
      
      // Positions
      positions[i3] = point.x;
      positions[i3 + 1] = point.y;
      positions[i3 + 2] = point.z;
      
      // Colors
      let r = 1, g = 1, b = 1;
      
      switch (colorMode) {
        case 'rgb':
          if (point.r !== undefined && point.g !== undefined && point.b !== undefined) {
            r = point.r / 255;
            g = point.g / 255;
            b = point.b / 255;
          } else {
            // Default white if no color data
            r = g = b = 0.8;
          }
          break;
          
        case 'intensity':
          if (point.intensity !== undefined && maxIntensity > minIntensity) {
            const normalized = (point.intensity - minIntensity) / (maxIntensity - minIntensity);
            // Create a heat map: blue -> green -> yellow -> red
            if (normalized < 0.25) {
              r = 0;
              g = normalized * 4;
              b = 1;
            } else if (normalized < 0.5) {
              r = 0;
              g = 1;
              b = 1 - (normalized - 0.25) * 4;
            } else if (normalized < 0.75) {
              r = (normalized - 0.5) * 4;
              g = 1;
              b = 0;
            } else {
              r = 1;
              g = 1 - (normalized - 0.75) * 4;
              b = 0;
            }
          } else {
            r = g = b = 0.8;
          }
          break;
          
        case 'height':
          if (maxZ > minZ) {
            const normalized = (point.z - minZ) / (maxZ - minZ);
            // Height-based color: blue (low) to red (high)
            r = normalized;
            g = 1 - Math.abs(normalized - 0.5) * 2;
            b = 1 - normalized;
          } else {
            r = g = b = 0.8;
          }
          break;
      }
      
      colors[i3] = r;
      colors[i3 + 1] = g;
      colors[i3 + 2] = b;
    });
    
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.computeBoundingSphere();
    
    const material = new THREE.PointsMaterial({
      size: pointSize,
      vertexColors: true,
      sizeAttenuation: true,
    });
    
    return { geometry, material };
  }, [points, pointSize, colorMode]);

  return <points ref={meshRef} geometry={geometry} material={material} />;
};
