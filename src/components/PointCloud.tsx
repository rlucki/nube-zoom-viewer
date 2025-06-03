
// src/components/PointCloud.tsx
import React, { useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { Point } from './PointCloudViewer';

interface PointCloudProps {
  /** 
   * Array de puntos con sus coordenadas reales (rawX*scale+offset),
   * y opcionalmente colores RGB o intensidad.
   */
  points: Point[];
  /** Tamaño base de cada punto (en píxeles antes de escala). */
  pointSize: number;
  /** Modo de coloreado: 'rgb', 'intensity' o 'height'. */
  colorMode: 'rgb' | 'intensity' | 'height';
}

// Maximum number of points to prevent memory issues
const MAX_POINTS = 1000000; // 1 million points max

export const PointCloud: React.FC<PointCloudProps> = ({
  points,
  pointSize,
  colorMode,
}) => {
  /** Referencia al objeto THREE.Points para futuras manipulaciones. */
  const meshRef = useRef<THREE.Points>(null);

  /**
   * useMemo para construir la geometría y el material solo cuando
   * cambian los puntos, el tamaño o el modo de color.
   */
  const { geometry, material } = useMemo(() => {
    // Safety check: if no points or too many points, return empty geometry
    if (!points || points.length === 0) {
      console.log('No points to render');
      const emptyGeometry = new THREE.BufferGeometry();
      const material = new THREE.PointsMaterial({
        size: pointSize * 0.1,
        vertexColors: true,
        sizeAttenuation: false,
      });
      return { geometry: emptyGeometry, material };
    }

    // Limit points to prevent memory allocation failures
    const limitedPoints = points.length > MAX_POINTS ? points.slice(0, MAX_POINTS) : points;
    
    if (points.length > MAX_POINTS) {
      console.warn(`Point cloud too large (${points.length} points). Limited to ${MAX_POINTS} points to prevent memory issues.`);
    }

    console.log(`Rendering ${limitedPoints.length} points`);

    // Calculate required memory and check if it's reasonable
    const requiredMemory = limitedPoints.length * 3 * 4 * 2; // positions + colors, 4 bytes per float
    const maxMemory = 500 * 1024 * 1024; // 500MB limit
    
    if (requiredMemory > maxMemory) {
      console.error(`Required memory (${(requiredMemory / 1024 / 1024).toFixed(2)}MB) exceeds limit. Reducing points further.`);
      const safePointCount = Math.floor(maxMemory / (3 * 4 * 2));
      const safePoints = limitedPoints.slice(0, safePointCount);
      return createPointCloudGeometry(safePoints, pointSize, colorMode);
    }

    return createPointCloudGeometry(limitedPoints, pointSize, colorMode);
  }, [points, pointSize, colorMode]);

  // 8) Renderizamos el objeto THREE.Points:
  return (
    <points
      ref={meshRef}
      geometry={geometry}
      material={material}
      frustumCulled={false}  // evita que Three.js lo descarte si boundingSphere falla
    />
  );
};

function createPointCloudGeometry(points: Point[], pointSize: number, colorMode: 'rgb' | 'intensity' | 'height') {
  try {
    // 1) Creamos los buffers para posiciones y colores:
    const positions = new Float32Array(points.length * 3);
    const colors    = new Float32Array(points.length * 3);

    // 2) Calculamos min/max en Z y en intensidad (si existe) para normalizar:
    let minZ = Infinity,
        maxZ = -Infinity,
        minI = Infinity,
        maxI = -Infinity;
    points.forEach(p => {
      minZ = Math.min(minZ, p.z);
      maxZ = Math.max(maxZ, p.z);
      if (p.intensity !== undefined) {
        minI = Math.min(minI, p.intensity);
        maxI = Math.max(maxI, p.intensity);
      }
    });

    // 3) Rellenamos los buffers punto a punto:
    points.forEach((p, i) => {
      const i3 = i * 3;
      // → Posiciones absolutas:
      positions[i3]     = p.x;
      positions[i3 + 1] = p.y;
      positions[i3 + 2] = p.z;

      // → Color por defecto gris claro:
      let r = 0.8, g = 0.8, b = 0.8;

      //   • RGB:
      if (colorMode === 'rgb' && p.r !== undefined) {
        r = p.r / 255;
        g = p.g! / 255;
        b = p.b! / 255;

      //   • Intensidad (heatmap):
      } else if (
        colorMode === 'intensity' &&
        p.intensity !== undefined &&
        maxI > minI
      ) {
        const t = (p.intensity - minI) / (maxI - minI);
        if (t < 0.25)      { r = 0; g = t * 4;           b = 1; }
        else if (t < 0.5)  { r = 0; g = 1;               b = 1 - (t - 0.25)*4; }
        else if (t < 0.75) { r = (t - 0.5)*4; g = 1;      b = 0; }
        else               { r = 1; g = 1 - (t - 0.75)*4; b = 0; }

      //   • Altura (degradado azul→rojo):
      } else if (colorMode === 'height' && maxZ > minZ) {
        const t = (p.z - minZ) / (maxZ - minZ);
        r = t;
        g = 1 - Math.abs(t - 0.5) * 2;
        b = 1 - t;
      }

      colors[i3]     = r;
      colors[i3 + 1] = g;
      colors[i3 + 2] = b;
    });

    // 4) Construimos la geometría y asignamos los atributos:
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color',    new THREE.BufferAttribute(colors,    3));

    // 5) Bounding Box → "cubo limitador"
    geometry.computeBoundingBox();
    if (geometry.boundingBox) {
      // Aquí se podría centrar la nube:
      // const center = new THREE.Vector3();
      // geometry.boundingBox.getCenter(center);
      // geometry.translate(-center.x, -center.y, -center.z);
      //
      // Pero lo comentamos para mantener las coordenadas absolutas.
    }

    // 6) Bounding Sphere (para culling) y rotación Z→vertical:
    geometry.computeBoundingSphere();
    geometry.rotateX(-Math.PI / 2);

    // 7) Creamos el material de puntos:
    const material = new THREE.PointsMaterial({
      size: pointSize * 0.1,   // escala de píxeles
      vertexColors: true,      // usa nuestros colores por vértice
      sizeAttenuation: false,  // tamaño constante en pantalla
    });

    return { geometry, material };
  } catch (error) {
    console.error('Error creating point cloud geometry:', error);
    // Return empty geometry as fallback
    const emptyGeometry = new THREE.BufferGeometry();
    const material = new THREE.PointsMaterial({
      size: pointSize * 0.1,
      vertexColors: true,
      sizeAttenuation: false,
    });
    return { geometry: emptyGeometry, material };
  }
}
