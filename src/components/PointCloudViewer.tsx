import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber'; // Hook para ejecutar código cada frame (no usado aquí, podrías retirarlo)
import * as THREE from 'three';
import type { Point } from './PointCloudViewer';

interface PointCloudProps {
  points: Point[];                 // Array de puntos a dibujar
  pointSize: number;               // Tamaño base de cada punto
  colorMode: 'rgb' | 'intensity' | 'height'; // Modo de color
}

export const PointCloud: React.FC<PointCloudProps> = ({ 
  points, 
  pointSize, 
  colorMode 
}) => {
  // Referencia al objeto THREE.Points para, por ejemplo, actualizarlo dinámicamente
  const meshRef = useRef<THREE.Points>(null);

  // useMemo memoriza la geometría y el material para no recrearlos en cada render
  const { geometry, material } = useMemo(() => {
    const geometry = new THREE.BufferGeometry();

    // Creamos arrays Float32 para posiciones y colores (r,g,b) de todos los puntos
    const positions = new Float32Array(points.length * 3);
    const colors    = new Float32Array(points.length * 3);

    // Variables para determinar rangos de Z e intensidad (para normalizar)
    let minZ = Infinity;
    let maxZ = -Infinity;
    let minIntensity = Infinity;
    let maxIntensity = -Infinity;

    // Primer pase: calcular los valores mínimos y máximos de altura (Z) e intensidad
    points.forEach(point => {
      minZ = Math.min(minZ, point.z);
      maxZ = Math.max(maxZ, point.z);
      if (point.intensity !== undefined) {
        minIntensity = Math.min(minIntensity, point.intensity);
        maxIntensity = Math.max(maxIntensity, point.intensity);
      }
    });

    // Segundo pase: rellenar arrays de posiciones y colores
    points.forEach((point, i) => {
      const i3 = i * 3; // índice base en los arrays

      // ––––––––––––––––––––––––
      // 1) Posiciones XYZ
      positions[i3    ] = point.x;
      positions[i3 + 1] = point.y;
      positions[i3 + 2] = point.z;

      // ––––––––––––––––––––––––
      // 2) Selección de color según el modo elegido
      let r = 1, g = 1, b = 1; // valores por defecto

      switch (colorMode) {
        case 'rgb':
          // Si el punto trae colores RGB, los normalizamos a [0,1]
          if (point.r !== undefined && point.g !== undefined && point.b !== undefined) {
            r = point.r / 255;
            g = point.g / 255;
            b = point.b / 255;
          } else {
            // Si no trae color, usamos un gris claro
            r = g = b = 0.8;
          }
          break;

        case 'intensity':
          // Mapa de calor basado en intensidad; necesita rango válido
          if (point.intensity !== undefined && maxIntensity > minIntensity) {
            const normalized = (point.intensity - minIntensity) / (maxIntensity - minIntensity);
            // Divide el espectro en 4 rangos para un gradiente de color
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
            // Intensidad no válida → color neutro
            r = g = b = 0.8;
          }
          break;

        case 'height':
          // Mapa de color desde azul (bajo) a rojo (alto) según altura
          if (maxZ > minZ) {
            const normalized = (point.z - minZ) / (maxZ - minZ);
            r = normalized;                                  // crece con la altura
            g = 1 - Math.abs(normalized - 0.5) * 2;          // pico en la mitad
            b = 1 - normalized;                              // decrece con la altura
          } else {
            r = g = b = 0.8; // sin rango de alturas
          }
          break;
      }

      // Asignamos colores al array
      colors[i3    ] = r;
      colors[i3 + 1] = g;
      colors[i3 + 2] = b;
    });

    // Añadimos atributos al BufferGeometry
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color',    new THREE.BufferAttribute(colors,    3));
    geometry.computeBoundingSphere(); // necesario para frustum culling y controles

    // Creamos el material de puntos
    const material = new THREE.PointsMaterial({
      size: pointSize * 0.1,   // ajusta el tamaño real: aquí lo escalamos a 1/10
      vertexColors: true,      // usa los colores definidos por vértice
      sizeAttenuation: false,  // false = mismo tamaño en pantalla sin importar la distancia
    });

    return { geometry, material };
  }, [points, pointSize, colorMode]); // se recalcula solo si cambian estos props

  // Devolvemos el mesh de puntos; frustumCulled=false desactiva recorte automático
  return (
    <points
      ref={meshRef}
      geometry={geometry}
      material={material}
      frustumCulled={false} // opcional: fuerza a siempre renderizar la nube completa
    />
  );
};
