import React, { useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { Point } from './PointCloudViewer';

interface PointCloudProps {
  points: Point[];                         // Array de puntos (x,y,z y opcionales r,g,b,intensity)
  pointSize: number;                      // Tamaño base de los puntos (en píxeles antes de escala)
  colorMode: 'rgb' | 'intensity' | 'height';  // Modo de color: por canales, intensidad o altura
}

export const PointCloud: React.FC<PointCloudProps> = ({ points, pointSize, colorMode }) => {
  const meshRef = useRef<THREE.Points>(null);

  // useMemo memoiza geometría y material para no reconstruirlos en cada render
  const { geometry, material } = useMemo(() => {
    // 1) Creamos buffers TypedArray para posiciones y colores
    const positions = new Float32Array(points.length * 3);
    const colors    = new Float32Array(points.length * 3);

    // 2) Calcular min/max de Z e intensidad para normalización
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

    // 3) Rellenar arrays de posición y color por cada punto
    points.forEach((p, i) => {
      const i3 = i * 3;
      // Posición
      positions[i3]     = p.x;
      positions[i3 + 1] = p.y;
      positions[i3 + 2] = p.z;

      // Color por defecto gris claro
      let r = 0.8, g = 0.8, b = 0.8;

      // Elegir color según modo
      if (colorMode === 'rgb' && p.r !== undefined) {
        // Color RGB normalizado a 0-1
        r = p.r / 255;
        g = p.g! / 255;
        b = p.b! / 255;
      } else if (colorMode === 'intensity' && p.intensity !== undefined && maxI > minI) {
        // Mapa de calor por intensidad
        const t = (p.intensity - minI) / (maxI - minI);
        if (t < 0.25)      { r = 0; g = t * 4;           b = 1; }
        else if (t < 0.5)  { r = 0; g = 1;               b = 1 - (t - 0.25)*4; }
        else if (t < 0.75) { r = (t - 0.5)*4; g = 1;      b = 0; }
        else               { r = 1; g = 1 - (t - 0.75)*4; b = 0; }
      } else if (colorMode === 'height' && maxZ > minZ) {
        // Color de altura: degradado azul-verde-rojo
        const t = (p.z - minZ) / (maxZ - minZ);
        r = t;
        g = 1 - Math.abs(t - 0.5)*2;
        b = 1 - t;
      }

      colors[i3]     = r;
      colors[i3 + 1] = g;
      colors[i3 + 2] = b;
    });

    // 4) Crear BufferGeometry y asignar atributos
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color',    new THREE.BufferAttribute(colors,    3));

    // 5) COMPUTE BOUNDING BOX: esto genera el "cubo limitador"
    geometry.computeBoundingBox();
    if (geometry.boundingBox) {
      // En versiones anteriores se usaba para centrar la nube:
      // const center = new THREE.Vector3();
      // geometry.boundingBox.getCenter(center);
      // geometry.translate(-center.x, -center.y, -center.z);
      // Pero si quieres ver la nube completa, COMENTA o ELIMINA ese translate.
    }

    // 6) Bounding sphere para culling y rotación Z→vertical
    geometry.computeBoundingSphere();
    geometry.rotateX(-Math.PI / 2);  // gira -90° en X para poner Z arriba

    // 7) Crear material de puntos con coloreado por vértice
    const material = new THREE.PointsMaterial({
      size: pointSize * 0.1,    // escala de tamaño
      vertexColors: true,
      sizeAttenuation: false,   // tamaño constante en la pantalla
    });

    return { geometry, material };
  }, [points, pointSize, colorMode]);

  // Renderizamos la nube como THREE.Points
  return (
    <points
      ref={meshRef}
      geometry={geometry}
      material={material}
      frustumCulled={false}  // evita que Three.js la descarte por la boundingSphere
    />
  );
};
