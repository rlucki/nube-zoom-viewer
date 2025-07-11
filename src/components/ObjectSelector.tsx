import React, { useRef, useEffect, useState } from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';

interface ObjectSelectorProps {
  isActive: boolean;
  isDragging?: boolean;
  onObjectHover?: (obj: THREE.Object3D | null) => void;
  onObjectSelect?: (obj: THREE.Object3D | null) => void;
  hoverSensitivity?: number; // Nueva prop para controlar sensibilidad
}

export const ObjectSelector: React.FC<ObjectSelectorProps> = ({
  isActive,
  isDragging = false,
  onObjectHover,
  onObjectSelect,
  hoverSensitivity = 1.0, // Valor por defecto
}) => {
  const { camera, scene, gl } = useThree();
  const [hovered, setHovered] = useState<THREE.Object3D | null>(null);
  const [selected, setSelected] = useState<THREE.Object3D | null>(null);
  const raycaster = useRef(new THREE.Raycaster());
  const originalMaterials = useRef(new Map<THREE.Object3D, any>());
  const hoverTimeout = useRef<NodeJS.Timeout | null>(null);

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
        child.parent !== scene
      ) {
        objects.push(child);
      }
    });
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
    // No procesar eventos si no está activo o está arrastrando
    if (!isActive || isDragging) {
      if (hovered && hovered !== selected) {
        restoreOriginalMaterial(hovered);
      }
      setHovered(null);
      onObjectHover?.(null);
      gl.domElement.style.cursor = 'default';
      return;
    }

    // Limpiar timeout anterior
    if (hoverTimeout.current) {
      clearTimeout(hoverTimeout.current);
    }

    // Aplicar sensibilidad mediante timeout
    hoverTimeout.current = setTimeout(() => {
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
        }
      } else {
        if (hovered && hovered !== selected) {
          restoreOriginalMaterial(hovered);
        }
        setHovered(null);
        onObjectHover?.(null);
        gl.domElement.style.cursor = 'default';
      }
    }, (1 - hoverSensitivity) * 100); // Menor sensibilidad = mayor delay
  };

  const handleClick = (event: MouseEvent) => {
    // No procesar clicks si no está activo o está arrastrando
    if (!isActive || isDragging) {
      return;
    }

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
    // Solo activar eventos si el selector está activo Y no se está arrastrando
    if (isActive && !isDragging) {
      const canvas = gl.domElement;
      
      canvas.addEventListener('mousemove', handleMouseMove, { passive: true });
      canvas.addEventListener('click', handleClick);

      return () => {
        canvas.removeEventListener('mousemove', handleMouseMove);
        canvas.removeEventListener('click', handleClick);
        
        // Limpiar timeout
        if (hoverTimeout.current) {
          clearTimeout(hoverTimeout.current);
        }
      };
    }
  }, [isActive, isDragging, hovered, selected, hoverSensitivity]);

  // Limpiar todo cuando se desactiva o cuando el componente se desmonta
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

  // Cleanup al desmontar
  useEffect(() => {
    return () => {
      // Limpiar todos los materiales al desmontar
      originalMaterials.current.forEach((_, obj) => {
        restoreOriginalMaterial(obj);
      });
      originalMaterials.current.clear();
      gl.domElement.style.cursor = 'default';
    };
  }, []);

  return null;
};
