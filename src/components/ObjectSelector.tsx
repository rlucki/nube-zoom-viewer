import React, { useRef, useEffect, useState } from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';

interface ObjectSelectorProps {
  isActive: boolean;
  onObjectHover?: (object: THREE.Object3D | null) => void;
  onObjectSelect?: (object: THREE.Object3D | null) => void;
}

export const ObjectSelector: React.FC<ObjectSelectorProps> = ({
  isActive,
  onObjectHover,
  onObjectSelect,
}) => {
  const { camera, scene, gl } = useThree();
  const [hoveredObject, setHoveredObject] = useState<THREE.Object3D | null>(null);
  const [selectedObject, setSelectedObject] = useState<THREE.Object3D | null>(null);

  // Guardamos materiales originales para restaurar
  const originalMaterials = useRef(new Map<THREE.Mesh | THREE.Points, THREE.Material | THREE.Material[]>());
  const localRaycaster    = useRef(new THREE.Raycaster());

  // —————————————————————  
  // 1) Función para recopilar OBJETOS sobre los que raycastear
  //    Excluye cualquier mesh/points que tenga `userData.isSectionBox === true`.
  // —————————————————————
  const getIntersectableObjects = (): THREE.Object3D[] => {
    const intersectable: THREE.Object3D[] = [];
    scene.traverse((child) => {
      if ((child instanceof THREE.Mesh || child instanceof THREE.Points)
          // ❌ si está marcado como parte de SectionBox, lo ignoramos:
          && !(child.userData as any).isSectionBox
          // ❌ ignoramos helpers, grids, ejes, UI, etc.:
          && !child.name.includes('helper')
          && !child.name.includes('grid')
          && !child.name.includes('axes')
          && !(child.userData as any).isUI
      ) {
        intersectable.push(child);
      }
    });
    return intersectable;
  };

  // —————————————————————  
  // 2) Lógica de “hover” (idéntica a la tuya, nada cambia excepto que ya no
  //    raycasteará sobre los conos/SectionBox porque getIntersectableObjects los excluye)
  // —————————————————————
  const applyHoverEffect = (object: THREE.Object3D) => {
    object.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        if (!originalMaterials.current.has(child)) {
          originalMaterials.current.set(child, child.material);
        }
        const hoverMaterial = Array.isArray(child.material)
          ? child.material.map(mat => mat.clone())
          : (child.material as THREE.Material).clone();

        if (Array.isArray(hoverMaterial)) {
          hoverMaterial.forEach((mat) => {
            if ('color' in mat)      (mat as any).color.multiplyScalar(1.3);
            if ('emissive' in mat)   (mat as any).emissive.setRGB(0.1, 0.1, 0.2);
          });
        } else {
          if ('color' in hoverMaterial)    (hoverMaterial as any).color.multiplyScalar(1.3);
          if ('emissive' in hoverMaterial) (hoverMaterial as any).emissive.setRGB(0.1, 0.1, 0.2);
        }
        (child as THREE.Mesh).material = hoverMaterial;
      } else if (child instanceof THREE.Points) {
        if (!originalMaterials.current.has(child)) {
          originalMaterials.current.set(child, child.material);
        }
        const hoverMaterial = ((child as THREE.Points).material as THREE.PointsMaterial).clone();
        hoverMaterial.color.setRGB(0.5, 0.8, 1.0);
        (child as THREE.Points).material = hoverMaterial;
      }
    });
  };

  // —————————————————————  
  // 3) Lógica de “selección” (idéntica a tu código)
  // —————————————————————
  const applySelectionEffect = (object: THREE.Object3D) => {
    object.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        if (!originalMaterials.current.has(child)) {
          originalMaterials.current.set(child, child.material);
        }
        const selectedMaterial = Array.isArray(child.material)
          ? child.material.map(mat => mat.clone())
          : (child.material as THREE.Material).clone();

        if (Array.isArray(selectedMaterial)) {
          selectedMaterial.forEach((mat) => {
            if ('color' in mat)      (mat as any).color.multiplyScalar(1.5);
            if ('emissive' in mat)   (mat as any).emissive.setRGB(0.2, 0.4, 0.0);
          });
        } else {
          if ('color' in selectedMaterial)    (selectedMaterial as any).color.multiplyScalar(1.5);
          if ('emissive' in selectedMaterial) (selectedMaterial as any).emissive.setRGB(0.2, 0.4, 0.0);
        }
        (child as THREE.Mesh).material = selectedMaterial;
      } else if (child instanceof THREE.Points) {
        if (!originalMaterials.current.has(child)) {
          originalMaterials.current.set(child, child.material);
        }
        const selectedMaterial = ((child as THREE.Points).material as THREE.PointsMaterial).clone();
        selectedMaterial.color.setRGB(0.2, 1.0, 0.2);
        (child as THREE.Points).material = selectedMaterial;
      }
    });
  };

  // —————————————————————  
  // 4) Restaurar material original
  // —————————————————————
  const restoreMaterial = (object: THREE.Object3D) => {
    object.traverse((child) => {
      if ((child instanceof THREE.Mesh || child instanceof THREE.Points)
          && originalMaterials.current.has(child)) {
        (child as any).material = originalMaterials.current.get(child)!;
      }
    });
  };

  // —————————————————————  
  // 5) Handle Mouse Move (hover)
  // —————————————————————
  const handleMouseMove = (event: MouseEvent) => {
    if (!isActive) return;

    const rect = gl.domElement.getBoundingClientRect();
    const mouse = new THREE.Vector2(
      ((event.clientX - rect.left) / rect.width)  * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1
    );

    localRaycaster.current.setFromCamera(mouse, camera);
    // Con nuestro filtro ya aplicado:
    const intersectable = getIntersectableObjects();
    const intersects = localRaycaster.current.intersectObjects(intersectable, true);

    if (intersects.length > 0) {
      let newHoveredObject = intersects[0].object;
      while (
        newHoveredObject.parent &&
        newHoveredObject.parent.type !== 'Scene' &&
        !(newHoveredObject.parent instanceof THREE.Points) &&
        !(newHoveredObject.parent instanceof THREE.Mesh)
      ) {
        newHoveredObject = newHoveredObject.parent;
      }

      if (newHoveredObject !== hoveredObject) {
        if (hoveredObject && hoveredObject !== selectedObject) {
          restoreMaterial(hoveredObject);
        }
        if (newHoveredObject !== selectedObject) {
          applyHoverEffect(newHoveredObject);
        }
        setHoveredObject(newHoveredObject);
        onObjectHover?.(newHoveredObject);
        gl.domElement.style.cursor = 'pointer';
      }
    } else {
      if (hoveredObject && hoveredObject !== selectedObject) {
        restoreMaterial(hoveredObject);
      }
      setHoveredObject(null);
      onObjectHover?.(null);
      gl.domElement.style.cursor = 'default';
    }
  };

  // —————————————————————  
  // 6) Handle Mouse Click (select)
  // —————————————————————
  const handleMouseClick = (event: MouseEvent) => {
    if (!isActive) return;

    if (hoveredObject) {
      if (selectedObject) {
        restoreMaterial(selectedObject);
      }
      applySelectionEffect(hoveredObject);
      setSelectedObject(hoveredObject);
      onObjectSelect?.(hoveredObject);
    }
  };

  // —————————————————————  
  // 7) Registrar / Desregistrar listeners cuando isActive cambia
  // —————————————————————
  useEffect(() => {
    if (isActive) {
      const canvas = gl.domElement;
      canvas.addEventListener('mousemove', handleMouseMove);
      canvas.addEventListener('click',     handleMouseClick);
      return () => {
        canvas.removeEventListener('mousemove', handleMouseMove);
        canvas.removeEventListener('click',     handleMouseClick);
        gl.domElement.style.cursor = 'default';
      };
    }
  }, [isActive, hoveredObject, selectedObject, gl.domElement]);

  // —————————————————————  
  // 8) Limpiar efectos cuando isActive se desactiva
  // —————————————————————
  useEffect(() => {
    if (!isActive) {
      if (hoveredObject) {
        restoreMaterial(hoveredObject);
        setHoveredObject(null);
      }
      if (selectedObject) {
        restoreMaterial(selectedObject);
        setSelectedObject(null);
      }
    }
  }, [isActive]);

  return null;
};
