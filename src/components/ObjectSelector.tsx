import React, { useRef, useEffect, useState } from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';

/* -------------------------------------------------------------------------- */
/*  Props                                                                     */
/* -------------------------------------------------------------------------- */
interface ObjectSelectorProps {
  /** Herramienta de selección activa */
  isActive: boolean;
  /** La SectionBox está en drag → deshabilita hover/click */
  isDragging?: boolean;
  /** Callback al pasar el ratón                              */
  onObjectHover?:  (object: THREE.Object3D | null) => void;
  /** Callback al hacer click / seleccionar                   */
  onObjectSelect?: (object: THREE.Object3D | null) => void;
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

  const [hoveredObject,  setHoveredObject]  = useState<THREE.Object3D | null>(null);
  const [selectedObject, setSelectedObject] = useState<THREE.Object3D | null>(null);

  /* Mapa con materiales originales para restaurar luego */
  const originalMaterials = useRef(
    new Map<THREE.Mesh | THREE.Points, THREE.Material | THREE.Material[]>(),
  );
  const raycaster = useRef(new THREE.Raycaster());

  /* ---------------------------------------------------------------------- */
  /* 1. Objetos sobre los que SÍ queremos hacer raycast                      */
  /* ---------------------------------------------------------------------- */
  const getIntersectableObjects = (): THREE.Object3D[] => {
    const list: THREE.Object3D[] = [];
    scene.traverse((child) => {
      if (
        (child instanceof THREE.Mesh || child instanceof THREE.Points) &&
        !(child.userData as any).isSectionBox &&
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

  /* ---------------------------------------------------------------------- */
  /* 2. Utilidades: restaurar / hover / selección                            */
  /* ---------------------------------------------------------------------- */
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

  const applyHoverEffect = (object: THREE.Object3D) => {
    object.traverse((child) => {
      if (child instanceof THREE.Mesh || child instanceof THREE.Points) {
        if (!originalMaterials.current.has(child)) {
          originalMaterials.current.set(child, (child as any).material);
        }

        const mat = (child as any).material;
        const hoverMat = Array.isArray(mat)
          ? mat.map((m: any) =>
              new THREE.MeshBasicMaterial({
                color: new THREE.Color(m.color ?? 0xffffff).multiplyScalar(1.5),
                transparent: true,
                opacity: 0.8,
              }),
            )
          : new THREE.MeshBasicMaterial({
              color: new THREE.Color(mat.color ?? 0xffffff).multiplyScalar(1.5),
              transparent: true,
              opacity: 0.8,
            });

        (child as any).material = hoverMat;
      }
    });
  };

  const applySelectionEffect = (object: THREE.Object3D) => {
    object.traverse((child) => {
      if (child instanceof THREE.Mesh || child instanceof THREE.Points) {
        if (!originalMaterials.current.has(child)) {
          originalMaterials.current.set(child, (child as any).material);
        }
        (child as any).material = new THREE.MeshBasicMaterial({
          color: 0xff6600,
          transparent: true,
          opacity: 0.9,
        });
      }
    });
  };

  /* ---------------------------------------------------------------------- */
  /* 3. Mouse move → HOVER                                                  */
  /* ---------------------------------------------------------------------- */
  const handleMouseMove = (event: MouseEvent) => {
    if (!isActive || isDragging) return;
    if (selectedObject) return; // con objeto ya seleccionado, ignoramos hover

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

  /* ---------------------------------------------------------------------- */
  /* 4. Click → SELECCIÓN                                                   */
  /* ---------------------------------------------------------------------- */
  const handleMouseClick = () => {
    if (!isActive || isDragging) return;
    if (selectedObject) return;

    if (hoveredObject) {
      applySelectionEffect(hoveredObject);
      setSelectedObject(hoveredObject);
      onObjectSelect?.(hoveredObject);
    }
  };

  /* ---------------------------------------------------------------------- */
  /* 5. Registrar / quitar listeners                                        */
  /* ---------------------------------------------------------------------- */
  useEffect(() => {
    if (isActive && !isDragging) {
      const canvas = gl.domElement;
      canvas.addEventListener('mousemove', handleMouseMove);
      canvas.addEventListener('click', handleMouseClick);
      return () => {
        canvas.removeEventListener('mousemove', handleMouseMove);
        canvas.removeEventListener('click', handleMouseClick);
        gl.domElement.style.cursor = 'default';
      };
    }
  }, [isActive, isDragging, hoveredObject, selectedObject, gl.domElement]);

  /* ---------------------------------------------------------------------- */
  /* 6. Reset visual cuando desactivamos la tool                            */
  /* ---------------------------------------------------------------------- */
  useEffect(() => {
    if (!isActive) {
      if (hoveredObject) restoreMaterial(hoveredObject);
      if (selectedObject) restoreMaterial(selectedObject);
      setHoveredObject(null);
      setSelectedObject(null);
      gl.domElement.style.cursor = 'default';
    }
  }, [isActive]);

  return null; // no renderiza nada en la escena
};
