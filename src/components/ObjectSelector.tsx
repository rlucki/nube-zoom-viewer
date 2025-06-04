import React, { useRef, useEffect, useState } from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';

/* -------------------------------------------------------------------------- */
/*  Props                                                                     */
/* -------------------------------------------------------------------------- */
interface ObjectSelectorProps {
  isActive: boolean;                   // herramienta encendida
  isDragging?: boolean;                // la SectionBox está en drag
  onObjectHover?:  (obj: THREE.Object3D | null) => void;
  onObjectSelect?: (obj: THREE.Object3D | null) => void;
}

/* -------------------------------------------------------------------------- */
/*  Componente                                                                */
/* -------------------------------------------------------------------------- */
export const ObjectSelector: React.FC<ObjectSelectorProps> = ({
  isActive,
  isDragging = false,
  onObjectHover,
  onObjectSelect,
}) => {
  const { camera, scene, gl } = useThree();

  const [hovered,  setHovered ]  = useState<THREE.Object3D | null>(null);
  const [selected, setSelected]  = useState<THREE.Object3D | null>(null);

  const originals = useRef(
    new Map<THREE.Mesh | THREE.Points, THREE.Material | THREE.Material[]>(),
  );
  const raycaster = useRef(new THREE.Raycaster());

  /* ---------------------------------------------------------------------- */
  /* 1. Filtrar objetos válidos para raycast                                 */
  /* ---------------------------------------------------------------------- */
  const getPickables = (): THREE.Object3D[] => {
    const list: THREE.Object3D[] = [];
    scene.traverse((c) => {
      if (
        (c instanceof THREE.Mesh || c instanceof THREE.Points) &&
        !(c.userData as { isSectionBox?: boolean }).isSectionBox && // fuera de la caja
        !c.name.match(/helper|grid|axes/) &&
        !(c.userData as { isUI?: boolean }).isUI
      ) {
        list.push(c);
      }
    });
    return list;
  };

  /* ---------------------------------------------------------------------- */
  /* 2. Utils: restaurar / hover / selección                                 */
  /* ---------------------------------------------------------------------- */
  const restoreMaterial = (obj: THREE.Object3D) => {
    obj.traverse((c) => {
      if (
        (c instanceof THREE.Mesh || c instanceof THREE.Points) &&
        originals.current.has(c)
      ) {
        (c as THREE.Mesh | THREE.Points).material = originals.current.get(c)!;
      }
    });
  };

  const setTempMaterial = (obj: THREE.Object3D, color: THREE.ColorRepresentation) => {
    obj.traverse((c) => {
      if (c instanceof THREE.Mesh || c instanceof THREE.Points) {
        if (!originals.current.has(c)) {
          originals.current.set(
            c,
            (c as THREE.Mesh | THREE.Points).material as THREE.Material,
          );
        }

        (c as THREE.Mesh | THREE.Points).material = new THREE.MeshBasicMaterial({
          color,
          transparent : true,
          opacity     : 0.8,
          depthWrite  : false,
        });
      }
    });
  };

  /* ---------------------------------------------------------------------- */
  /* 3. Mouse-move → HOVER                                                  */
  /* ---------------------------------------------------------------------- */
  const onMouseMove = (ev: MouseEvent) => {
    if (!isActive || isDragging) return;
    if (selected) return;

    const rect = gl.domElement.getBoundingClientRect();
    const mouse = new THREE.Vector2(
      ((ev.clientX - rect.left) / rect.width) * 2 - 1,
      -((ev.clientY - rect.top) / rect.height) * 2 + 1,
    );

    raycaster.current.setFromCamera(mouse, camera);
    const hits = raycaster.current.intersectObjects(getPickables(), true);

    if (hits.length) {
      let obj = hits[0].object;
      while (
        obj.parent &&
        obj.parent.type !== 'Scene' &&
        !(obj.parent instanceof THREE.Mesh) &&
        !(obj.parent instanceof THREE.Points)
      ) {
        obj = obj.parent;
      }

      if (obj !== hovered) {
        if (hovered) restoreMaterial(hovered);
        setTempMaterial(obj, 0x80c2ff);         // azul claro para hover
        setHovered(obj);
        onObjectHover?.(obj);
        gl.domElement.style.cursor = 'pointer';
      }
    } else {
      if (hovered) restoreMaterial(hovered);
      setHovered(null);
      onObjectHover?.(null);
      gl.domElement.style.cursor = 'default';
    }
  };

  /* ---------------------------------------------------------------------- */
  /* 4. Click → SELECCIÓN                                                   */
  /* ---------------------------------------------------------------------- */
  const onMouseClick = () => {
    if (!isActive || isDragging) return;
    if (selected) return;

    if (hovered) {
      setTempMaterial(hovered, 0xff6600);       // naranja para selección
      setSelected(hovered);
      onObjectSelect?.(hovered);
    }
  };

  /* ---------------------------------------------------------------------- */
  /* 5. (De)registrar listeners                                             */
  /* ---------------------------------------------------------------------- */
  useEffect(() => {
    if (isActive && !isDragging) {
      const canvas = gl.domElement;
      canvas.addEventListener('mousemove', onMouseMove);
      canvas.addEventListener('click',     onMouseClick);
      return () => {
        canvas.removeEventListener('mousemove', onMouseMove);
        canvas.removeEventListener('click',     onMouseClick);
        gl.domElement.style.cursor = 'default';
      };
    }
  }, [isActive, isDragging, hovered, selected, gl.domElement]);

  /* ---------------------------------------------------------------------- */
  /* 6. Reset al desactivar la herramienta                                  */
  /* ---------------------------------------------------------------------- */
  useEffect(() => {
    if (!isActive) {
      if (hovered)  restoreMaterial(hovered);
      if (selected) restoreMaterial(selected);
      setHovered(null);
      setSelected(null);
      gl.domElement.style.cursor = 'default';
    }
  }, [isActive]);

  return null; // — no renderiza nada
};
