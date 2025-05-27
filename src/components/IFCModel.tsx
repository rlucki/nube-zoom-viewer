import React, { useRef, useEffect } from 'react';
import * as THREE from 'three';
import type { IFCGeometry } from './PointCloudViewer';

interface IFCModelProps {
  geometry: IFCGeometry;
  transparency: number;
  /** Vector que restamos para recentrar toda la escena (mismos ejes que la nube) */
  worldOffset: THREE.Vector3;
  /** Escala de unidades (mm→m = 0.001, m→m = 1, etc.) */
  unitScale?: number;
}

export const IFCModel: React.FC<IFCModelProps> = ({
  geometry,
  transparency,
  worldOffset,
  unitScale = 1,
}) => {
  const groupRef = useRef<THREE.Group>(null);
  const meshesRef = useRef<THREE.Mesh[]>([]);

  // ────────────────────────────────────────────────────────────────────────────────
  // 1. Crear / clonar los meshes UNA sola vez
  // ────────────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!groupRef.current || !geometry.meshes) return;

    // Limpia lo anterior
    groupRef.current.clear();
    meshesRef.current = [];

    // Clona los meshes originales para no modificarlos fuera
    geometry.meshes.forEach((mesh) => {
      const clone = mesh.clone();
      meshesRef.current.push(clone);
      groupRef.current!.add(clone);
    });

    // Aplica la misma transformación global que la nube de puntos
    groupRef.current.position.copy(worldOffset).multiplyScalar(-1); // restar offset
    groupRef.current.scale.setScalar(unitScale); // convertir unidades

    // Si no vas a animar nada, puedes congelar matrices:
    groupRef.current.updateMatrixWorld(true);
    groupRef.current.traverse((o) => (o.matrixAutoUpdate = false));

    // Limpieza al desmontar
    return () => {
      meshesRef.current.forEach((m) => {
        if ('dispose' in m.geometry) m.geometry.dispose();
        const mats = Array.isArray(m.material) ? m.material : [m.material];
        mats.forEach((mat) => {
          if ('dispose' in mat) mat.dispose();
        });
      });
      meshesRef.current = [];
      groupRef.current?.clear();
    };
  }, [geometry, worldOffset, unitScale]);

  // ────────────────────────────────────────────────────────────────────────────────
  // 2. Transparencia (se actualiza cuando cambie 'transparency')
  // ────────────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    meshesRef.current.forEach((mesh) => {
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      mats.forEach((mat) => {
        if (mat instanceof THREE.Material) {
          mat.transparent = transparency < 1;
          mat.opacity = transparency;
          mat.depthWrite = transparency === 1; // evitar z-fighting cuando es semi-opaco
          mat.needsUpdate = true;
        }
      });
    });
  }, [transparency]);

  return <group ref={groupRef} />;
};
