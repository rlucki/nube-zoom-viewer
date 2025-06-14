
import { useThree } from '@react-three/fiber';
import { useMemo } from 'react';
import * as THREE from 'three';

export function useHandleSize(target: THREE.Vector3, basePx = 25): number {
  // Debe ser usado dentro del Fiber/Three
  const { camera, size } = useThree();

  return useMemo(() => {
    // Proyectamos el centro del handle a pantalla para saber píxeles por unidad
    const vec = target.clone().project(camera);
    // La proyección va de -1 a 1 en X e Y
    const x = (vec.x * 0.5 + 0.5) * size.width;
    const y = (vec.y * -0.5 + 0.5) * size.height;

    // Ahora proyectamos un punto desplazado +1 en X world (para obtener escala)
    const worldOffset = target.clone().add(new THREE.Vector3(1, 0, 0));
    const vec2 = worldOffset.project(camera);
    const x2 = (vec2.x * 0.5 + 0.5) * size.width;
    const pxPerWorldUnit = Math.abs(x2 - x);

    // Si pxPerWorldUnit ~= 0 (demasiado lejos o cerca), ponemos un mínimo
    let scale = basePx / (pxPerWorldUnit || 1);

    // Protegemos tamaño mínimo y máximo en espacio world
    scale = Math.max(0.12, Math.min(2, scale));
    return scale;
  }, [camera, size, target.x, target.y, target.z, basePx]);
}
