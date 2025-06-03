import React, { useRef, useEffect, useState } from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';

interface ObjectSelectorProps {
  isActive: boolean;
  onObjectHover?:  (object: THREE.Object3D | null) => void;
  onObjectSelect?: (object: THREE.Object3D | null) => void;
}

export const ObjectSelector: React.FC<ObjectSelectorProps> = ({
  isActive,
  onObjectHover,
  onObjectSelect,
}) => {
  const { camera, scene, gl } = useThree();
  const [hoveredObject,  setHoveredObject]  = useState<THREE.Object3D | null>(null);
  const [selectedObject, setSelectedObject] = useState<THREE.Object3D | null>(null);

  const originalMaterials = useRef(
    new Map<THREE.Mesh | THREE.Points, THREE.Material | THREE.Material[]>(),
  );
  const raycaster = useRef(new THREE.Raycaster());

  /* ----------------------------------------------------------------------- */
  /* 1. Objetos sobre los que sí queremos hacer raycast                      */
  /* ----------------------------------------------------------------------- */
  const getIntersectableObjects = () => {
    const list: THREE.Object3D[] = [];
    scene.traverse((child) => {
      if (
        (child instanceof THREE.Mesh || child instanceof THREE.Points) &&
        !(child.userData as any).isSectionBox &&          // ← fuera SectionBox
        !child.name.includes('helper') &&
        !child.name.includes('grid') &&
        !child.name.includes('axes') &&
        !(child.userData as any).isUI
      ) {
        list.push(child);
      }
    });
    return list;
  };

  /* ----------------------------------------------------------------------- */
  /* 2. Hover, selección, restauración (sin cambios de lógica)               */
  /* ----------------------------------------------------------------------- */
  const restoreMaterial = (object: THREE.Object3D) => {
    object.traverse((child) => {
      if (
        (child instanceof THREE.Mesh || child instanceof THREE.Points) &&
        originalMaterials.current.has(child)
      ) {
        (child as any).material = originalMaterials.current.get(child)!;
      }
    });
  };

  const applyHoverEffect = /* … idéntico a tu función … */;
  const applySelectionEffect = /* … idéntico a tu función … */;

  /* ----------------------------------------------------------------------- */
  /* 3. Mouse move → HOVER                                                   */
  /* ----------------------------------------------------------------------- */
  const handleMouseMove = (event: MouseEvent) => {
    if (!isActive) return;

    // 💥  Si ya hay objeto seleccionado, no hacemos hover
    if (selectedObject) return;

    const rect = gl.domElement.getBoundingClientRect();
    const mouse = new THREE.Vector2(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1,
    );

    raycaster.current.setFromCamera(mouse, camera);
    const picks = raycaster.current.intersectObjects(getIntersectableObjects(), true);

    if (picks.length) {
      let obj = picks[0].object;
      while (
        obj.parent &&
        obj.parent.type !== 'Scene' &&
        !(obj.parent instanceof THREE.Mesh) &&
        !(obj.parent instanceof THREE.Points)
      ) {
        obj = obj.parent;
      }

      if (obj !== hoveredObject) {
        if (hoveredObject) restoreMaterial(hoveredObject);
        applyHoverEffect(obj);
        setHoveredObject(obj);
        onObjectHover?.(obj);
        gl.domElement.style.cursor = 'pointer';
      }
    } else {
      if (hoveredObject) restoreMaterial(hoveredObject);
      setHoveredObject(null);
      onObjectHover?.(null);
      gl.domElement.style.cursor = 'default';
    }
  };

  /* ----------------------------------------------------------------------- */
  /* 4. Click → SELECCIÓN                                                    */
  /* ----------------------------------------------------------------------- */
  const handleMouseClick = () => {
    if (!isActive) return;

    // 💥  Si ya tenemos objeto seleccionado, ignoramos clicks
    if (selectedObject) return;

    if (hoveredObject) {
      applySelectionEffect(hoveredObject);
      setSelectedObject(hoveredObject);
      onObjectSelect?.(hoveredObject);
    }
  };

  /* ----------------------------------------------------------------------- */
  /* 5. Registrar / quitar listeners                                         */
  /* ----------------------------------------------------------------------- */
  useEffect(() => {
    if (isActive) {
      const canvas = gl.domElement;
      canvas.addEventListener('mousemove', handleMouseMove);
      canvas.addEventListener('click', handleMouseClick);
      return () => {
        canvas.removeEventListener('mousemove', handleMouseMove);
        canvas.removeEventListener('click', handleMouseClick);
        gl.domElement.style.cursor = 'default';
      };
    }
  }, [isActive, hoveredObject, selectedObject, gl.domElement]);

  /* ----------------------------------------------------------------------- */
  /* 6. Reset visual cuando cerramos la tool                                 */
  /* ----------------------------------------------------------------------- */
  useEffect(() => {
    if (!isActive) {
      if (hoveredObject)  restoreMaterial(hoveredObject);
      if (selectedObject) restoreMaterial(selectedObject);
      setHoveredObject(null);
      setSelectedObject(null);
    }
  }, [isActive]);

  return null;
};
