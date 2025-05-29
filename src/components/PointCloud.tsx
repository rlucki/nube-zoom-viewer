
import React, { useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { Point } from './PointCloudViewer';

interface PointCloudProps {
  points: Point[];
  pointSize: number;
  colorMode: 'rgb' | 'intensity' | 'height';
}

export const PointCloud: React.FC<PointCloudProps> = ({ points, pointSize, colorMode }) => {
  const meshRef = useRef<THREE.Points>(null);

  const { geometry, material } = useMemo(() => {
    const positions = new Float32Array(points.length * 3);
    const colors = new Float32Array(points.length * 3);

    let minZ = Infinity, maxZ = -Infinity;
    let minI = Infinity, maxI = -Infinity;
    points.forEach(p => {
      minZ = Math.min(minZ, p.z);
      maxZ = Math.max(maxZ, p.z);
      if (p.intensity !== undefined) {
        minI = Math.min(minI, p.intensity);
        maxI = Math.max(maxI, p.intensity);
      }
    });

    points.forEach((p, i) => {
      const i3 = i * 3;
      positions[i3] = p.x;
      positions[i3 + 1] = p.y;
      positions[i3 + 2] = p.z;
      let r = 0.8, g = 0.8, b = 0.8;
      if (colorMode === 'rgb' && p.r !== undefined) {
        r = p.r / 255;
        g = p.g! / 255;
        b = p.b! / 255;
      } else if (colorMode === 'intensity' && p.intensity !== undefined && maxI > minI) {
        const t = (p.intensity - minI) / (maxI - minI);
        if (t < 0.25) { r = 0; g = t * 4; b = 1; }
        else if (t < 0.5) { r = 0; g = 1; b = 1 - (t - 0.25) * 4; }
        else if (t < 0.75) { r = (t - 0.5) * 4; g = 1; b = 0; }
        else { r = 1; g = 1 - (t - 0.75) * 4; b = 0; }
      } else if (colorMode === 'height' && maxZ > minZ) {
        const t = (p.z - minZ) / (maxZ - minZ);
        r = t;
        g = 1 - Math.abs(t - 0.5) * 2;
        b = 1 - t;
      }
      colors[i3] = r;
      colors[i3 + 1] = g;
      colors[i3 + 2] = b;
    });

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    geometry.computeBoundingBox();
    if (geometry.boundingBox) {
      const center = new THREE.Vector3();
      geometry.boundingBox.getCenter(center);
      geometry.translate(-center.x, -center.y, -center.z);
    }

    geometry.computeBoundingSphere();
    geometry.rotateX(-Math.PI / 2);

    const material = new THREE.PointsMaterial({
      size: pointSize * 0.1,
      vertexColors: true,
      sizeAttenuation: false,
    });

    return { geometry, material };
  }, [points, pointSize, colorMode]);

  return (
    <points
      ref={meshRef}
      geometry={geometry}
      material={material}
      frustumCulled={false}
    />
  );
};
