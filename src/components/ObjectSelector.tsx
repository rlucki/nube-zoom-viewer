
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
  const raycaster = useRef(new THREE.Raycaster());
  const originalMaterials = useRef(new Map<THREE.Object3D, any>());

  const getSelectableObjects = (): THREE.Object3D[] => {
    const objects: THREE.Object3D[] = [];
    scene.traverse((child) => {
      if (
        (child instanceof THREE.Mesh || child instanceof THREE.Points) &&
        !child.userData.isSectionBox &&
        !child.userData.isUI &&
        !child.userData.isTransformControl &&
        !child.name.includes('helper') &&
        !child.name.includes('grid')
      ) {
        objects.push(child);
      }
    });
    return objects;
  };

  const restoreOriginalMaterial = (obj: THREE.Object3D) => {
    if (originalMaterials.current.has(obj)) {
      if (obj instanceof THREE.Mesh || obj instanceof THREE.Points) {
        obj.material = originalMaterials.current.get(obj);
      }
      originalMaterials.current.delete(obj);
    }
  };

  const setHoverMaterial = (obj: THREE.Object3D) => {
    if (obj instanceof THREE.Mesh || obj instanceof THREE.Points) {
      if (!originalMaterials.current.has(obj)) {
        originalMaterials.current.set(obj, obj.material);
      }
      
      const hoverMaterial = new THREE.MeshBasicMaterial({
        color: 0x80c2ff,
        transparent: true,
        opacity: 0.8,
      });
      
      obj.material = hoverMaterial;
    }
  };

  const setSelectMaterial = (obj: THREE.Object3D) => {
    if (obj instanceof THREE.Mesh || obj instanceof THREE.Points) {
      const selectMaterial = new THREE.MeshBasicMaterial({
        color: 0xff6600,
        transparent: true,
        opacity: 0.8,
      });
      
      obj.material = selectMaterial;
    }
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
      let targetObject = intersects[0].object;
      
      // Buscar el objeto padre más relevante
      while (targetObject.parent && targetObject.parent.type !== 'Scene') {
        if (targetObject.parent instanceof THREE.Group) {
          targetObject = targetObject.parent;
          break;
        }
        targetObject = targetObject.parent;
      }

      if (targetObject !== hovered) {
        if (hovered) {
          restoreOriginalMaterial(hovered);
        }
        
        setHoverMaterial(targetObject);
        setHovered(targetObject);
        onObjectHover?.(targetObject);
        gl.domElement.style.cursor = 'pointer';
      }
    } else {
      if (hovered) {
        restoreOriginalMaterial(hovered);
        setHovered(null);
        onObjectHover?.(null);
        gl.domElement.style.cursor = 'default';
      }
    }
  };

  const handleClick = () => {
    if (!isActive || isDragging) return;

    if (hovered) {
      setSelectMaterial(hovered);
      onObjectSelect?.(hovered);
      gl.domElement.style.cursor = 'default';
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
  }, [isActive, isDragging, hovered]);

  useEffect(() => {
    if (!isActive) {
      if (hovered) {
        restoreOriginalMaterial(hovered);
        setHovered(null);
      }
      gl.domElement.style.cursor = 'default';
    }
  }, [isActive]);

  return null;
};
