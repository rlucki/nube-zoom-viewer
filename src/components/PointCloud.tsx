import React, { useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { Point } from './PointCloudViewer';

/**
 * Props that the PointCloud component expects.
 */
interface PointCloudProps {
  /** The full array of points to render. */
  points: Point[];
  /** Base screen-space size for every point (pixels before scaling below). */
  pointSize: number;
  /** How colours are assigned to the points. */
  colorMode: 'rgb' | 'intensity' | 'height';
}

/**
 * Renders a LAS/LAZ-style point cloud and
 * *automatically recentres it at (0, 0, 0)*
 * so it superimposes correctly on other models,
 * and aligns Z as vertical.
 */
export const PointCloud: React.FC<PointCloudProps> = ({
  points,
  pointSize,
  colorMode,
}) => {
  /** Reference to the THREE.Points instance (useful for future tweaks). */
  const meshRef = useRef<THREE.Points>(null);

  /**
   * Build `BufferGeometry` + `PointsMaterial` once and
   * only recreate them if points / size / colour mode change.
   */
  const { geometry, material } = useMemo(() => {
    /* ---------- 1. Create typed arrays for positions and colours ---------- */
    const positions = new Float32Array(points.length * 3);
    const colors    = new Float32Array(points.length * 3);

    /* ---------- 2. Prepare min/max values for normalisation ---------- */
    let minZ =  Infinity;
    let maxZ = -Infinity;
    let minIntensity =  Infinity;
    let maxIntensity = -Infinity;

    points.forEach((p) => {
      if (p.z < minZ) minZ = p.z;
      if (p.z > maxZ) maxZ = p.z;
      if (p.intensity !== undefined) {
        if (p.intensity < minIntensity) minIntensity = p.intensity;
        if (p.intensity > maxIntensity) maxIntensity = p.intensity;
      }
    });

    /* ---------- 3. Fill the arrays with vertex data ---------- */
    points.forEach((p, i) => {
      const base = i * 3;

      /* Positions --------------------------------------------------------- */
      positions[base    ] = p.x;
      positions[base + 1] = p.y;
      positions[base + 2] = p.z;

      /* Colours ----------------------------------------------------------- */
      let r = 0.8;
      let g = 0.8;
      let b = 0.8;

      if (colorMode === 'rgb') {
        if (p.r !== undefined && p.g !== undefined && p.b !== undefined) {
          r = p.r / 255;
          g = p.g / 255;
          b = p.b / 255;
        }
      } else if (colorMode === 'intensity' && p.intensity !== undefined && maxIntensity > minIntensity) {
        const t = (p.intensity - minIntensity) / (maxIntensity - minIntensity);
        if (t < 0.25)       { r = 0;        g = t * 4;            b = 1;               }
        else if (t < 0.50)  { r = 0;        g = 1;                b = 1 - (t - 0.25)*4;}
        else if (t < 0.75)  { r = (t - .5)*4; g = 1;              b = 0;               }
        else                { r = 1;        g = 1 - (t - 0.75)*4; b = 0;               }
      } else if (colorMode === 'height' && maxZ > minZ) {
        const t = (p.z - minZ) / (maxZ - minZ);         // 0 (low) .. 1 (high)
        r = t;
        g = 1 - Math.abs(t - 0.5) * 2;
        b = 1 - t;
      }

      colors[base    ] = r;
      colors[base + 1] = g;
      colors[base + 2] = b;
    });

    /* ---------- 4. Build THREE.BufferGeometry ---------- */
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color',    new THREE.BufferAttribute(colors,    3));

    /* ---------- 5. Centre the cloud at the origin ---------- */
    geometry.computeBoundingBox();
    if (geometry.boundingBox) {
      const centre = new THREE.Vector3();
      geometry.boundingBox.getCenter(centre);
      geometry.translate(-centre.x, -centre.y, -centre.z);
    }

    /* ---------- 6. Recompute boundingSphere so culling works ---------- */
    geometry.computeBoundingSphere();

    /* ---------- 6a. Rotate cloud so Z is vertical ---------- */
    geometry.rotateX(-Math.PI / 2);

    /* ---------- 7. Create material ---------- */
    const material = new THREE.PointsMaterial({
      size: pointSize * 0.1,    // screen pixels
      vertexColors: true,
      sizeAttenuation: false,   // keep size constant regardless of distance
    });

    return { geometry, material };
  }, [points, pointSize, colorMode]);

  return (
    <points
      ref={meshRef}
      geometry={geometry}
      material={material}
      frustumCulled={false}   /* render even if bounding sphere is mis-computed */
    />
  );
};
