
import React, { useRef, useEffect, useState } from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';

interface ObjectSelectorProps {
  isActive: boolean;
  isDragging?: boolean;
  onObjectHover?: (obj: THREE.Object3D | null) => void;
  onObjectSelect?: (obj: THREE.Object3D | null) => void;
}

export const ObjectSelector: React.FC<ObjectSelectorProps> = ({
  isActive,
  isDragging = false,
  onObjectHover,
  onObjectSelect,
}) => {
  const { camera, scene, gl } = useThree();
  const [hovered, setHovered] = useState<THREE.Object3D | null>(null);
  const [selected, setSelected] = useState<THREE.Object3D | null>(null);
  const raycaster = useRef(new THREE.Raycaster());
  const originalMaterials = useRef(new Map<THREE.Object3D, any>());

  const getSelectableObjects = (): THREE.Object3D[] => {
    const objects: THREE.Object3D[] = [];
    scene.traverse((child) => {
      if (
        (child instanceof THREE.Mesh || child instanceof THREE.Points || child instanceof THREE.Group) &&
        !child.userData.isSectionBox &&
        !child.userData.isUI &&
        !child.userData.isTransformControl &&
        !child.name.includes('helper') &&
        !child.name.includes('grid') &&
        !child.name.includes('control') &&
        child.visible &&
        child.parent !== scene // Evitar seleccionar objetos directos de la escena
      ) {
        objects.push(child);
      }
    });
    console.log('Selectable objects found:', objects.length);
    return objects;
  };

  const restoreOriginalMaterial = (obj: THREE.Object3D) => {
    if (originalMaterials.current.has(obj)) {
      obj.traverse((child) => {
        if (child instanceof THREE.Mesh || child instanceof THREE.Points) {
          const originalMat = originalMaterials.current.get(obj);
          if (originalMat) {
            child.material = originalMat;
          }
        }
      });
      originalMaterials.current.delete(obj);
    }
  };

  const setHoverMaterial = (obj: THREE.Object3D) => {
    if (!originalMaterials.current.has(obj)) {
      // Guardar material original
      let originalMaterial = null;
      obj.traverse((child) => {
        if ((child instanceof THREE.Mesh || child instanceof THREE.Points) && !originalMaterial) {
          originalMaterial = child.material;
        }
      });
      if (originalMaterial) {
        originalMaterials.current.set(obj, originalMaterial);
      }
    }
    
    // Aplicar material de hover a todos los meshes del objeto
    const hoverMaterial = new THREE.MeshStandardMaterial({
      color: 0x88ccff,
      transparent: true,
      opacity: 0.8,
      emissive: 0x002244,
      emissiveIntensity: 0.3,
    });
    
    obj.traverse((child) => {
      if (child instanceof THREE.Mesh || child instanceof THREE.Points) {
        child.material = hoverMaterial;
      }
    });
  };

  const setSelectMaterial = (obj: THREE.Object3D) => {
    const selectMaterial = new THREE.MeshStandardMaterial({
      color: 0xffaa44,
      transparent: true,
      opacity: 0.9,
      emissive: 0x441100,
      emissiveIntensity: 0.5,
    });
    
    obj.traverse((child) => {
      if (child instanceof THREE.Mesh || child instanceof THREE.Points) {
        child.material = selectMaterial;
      }
    });
  };

  const findBestParent = (obj: THREE.Object3D): THREE.Object3D => {
    // Buscar el mejor padre para seleccionar (Group o el objeto más alto significativo)
    let current = obj;
    let bestParent = obj;
    
    while (current.parent && current.parent.type !== 'Scene') {
      current = current.parent;
      if (current instanceof THREE.Group || current.userData.isModel) {
        bestParent = current;
      }
    }
    
    return bestParent;
  };

  const handleMouseMove = (event: MouseEvent) => {
    if (!isActive || isDragging) return;

    const rect = gl.domElement.getBoundingClientRect();
    const mouse = new THREE.Vector2(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1
    );

    raycaster.current.setFromCamera(mouse, camera);
    const intersects = raycaster.current.intersectObjects(getSelectableObjects(), true);

    if (intersects.length > 0) {
      const targetObject = findBestParent(intersects[0].object);

      if (targetObject !== hovered) {
        // Restaurar material anterior
        if (hovered && hovered !== selected) {
          restoreOriginalMaterial(hovered);
        }
        
        // Aplicar hover solo si no está seleccionado
        if (targetObject !== selected) {
          setHoverMaterial(targetObject);
        }
        
        setHovered(targetObject);
        onObjectHover?.(targetObject);
        gl.domElement.style.cursor = 'pointer';
        
        console.log('Hovering object:', targetObject.name || targetObject.type, targetObject);
      }
    } else {
      if (hovered && hovered !== selected) {
        restoreOriginalMaterial(hovered);
      }
      setHovered(null);
      onObjectHover?.(null);
      gl.domElement.style.cursor = 'default';
    }
  };

  const handleClick = () => {
    if (!isActive || isDragging) return;

    if (hovered) {
      // Restaurar material del objeto previamente seleccionado
      if (selected && selected !== hovered) {
        restoreOriginalMaterial(selected);
      }
      
      setSelectMaterial(hovered);
      setSelected(hovered);
      onObjectSelect?.(hovered);
      gl.domElement.style.cursor = 'default';
      
      console.log('Selected object:', hovered.name || hovered.type, hovered);
    } else {
      // Deseleccionar si se hace clic en el vacío
      if (selected) {
        restoreOriginalMaterial(selected);
        setSelected(null);
        onObjectSelect?.(null);
      }
    }
  };

  useEffect(() => {
    if (isActive && !isDragging) {
      const canvas = gl.domElement;
      canvas.addEventListener('mousemove', handleMouseMove);
      canvas.addEventListener('click', handleClick);

      return () => {
        canvas.removeEventListener('mousemove', handleMouseMove);
        canvas.removeEventListener('click', handleClick);
      };
    }
  }, [isActive, isDragging, hovered, selected]);

  useEffect(() => {
    if (!isActive) {
      // Limpiar todo cuando se desactiva
      if (hovered) {
        restoreOriginalMaterial(hovered);
        setHovered(null);
      }
      if (selected) {
        restoreOriginalMaterial(selected);
        setSelected(null);
      }
      gl.domElement.style.cursor = 'default';
    }
  }, [isActive]);

  return null;
};
