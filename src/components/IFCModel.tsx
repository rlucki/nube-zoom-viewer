import React, { useRef, useEffect } from 'react';
import * as THREE from 'three';
import type { IFCGeometry } from './PointCloudViewer';

interface IFCModelProps {
  geometry: IFCGeometry;      // Contiene un array de mallas THREE.Mesh ya cargadas
  transparency: number;       // Opacidad deseada entre 0 (invisible) y 1 (opaco)
}

export const IFCModel: React.FC<IFCModelProps> = ({ geometry, transparency }) => {
  // Referencia al <group> que contendrá todas las mallas del IFC
  const groupRef = useRef<THREE.Group>(null);
  // Para poder actualizar la transparencia sin volver a clonar todo
  const meshesRef = useRef<THREE.Mesh[]>([]);

  // ——— Montaje inicial de las mallas (solo cuando cambia `geometry`) ———
  useEffect(() => {
    if (!groupRef.current || !geometry.meshes) return;

    // 1) Limpia cualquier malla previa
    groupRef.current.clear();
    meshesRef.current = [];

    // 2) Clona e inserta cada mesh del IFC dentro del grupo
    geometry.meshes.forEach(mesh => {
      const clonedMesh = mesh.clone();
      meshesRef.current.push(clonedMesh);
      groupRef.current!.add(clonedMesh);
    });

    // ✋ Aquí NO se aplica ningún center() ni ningún scale.set(...)
    //    Se deja en “coordenadas originales” para que cuadre con la nube.

  }, [geometry]);


  // ——— Actualización de la transparencia ———
  // Así evitamos recrear/clonar todas las mallas cada vez
  useEffect(() => {
    if (!meshesRef.current.length) return;

    meshesRef.current.forEach(mesh => {
      if (mesh.material) {
        // Si hay varios materiales (material por lado), lo ajustamos en cada uno
        if (Array.isArray(mesh.material)) {
          mesh.material.forEach(mat => {
            mat.transparent = transparency < 1;
            mat.opacity = transparency;
            mat.needsUpdate = true;
          });
        } else {
          const mat = mesh.material as THREE.Material;
          mat.transparent = transparency < 1;
          mat.opacity = transparency;
          mat.needsUpdate = true;
        }
      }
    });
  }, [transparency]);


  // ——— Renderizamos un <group> vacío: las mallas se meten en él por el useEffect ———
  return <group ref={groupRef} />;
};
