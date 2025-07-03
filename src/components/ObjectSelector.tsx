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
        (child instanceof THREE.Mesh && child.geometry && child.material) &&
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
      const originalMat = originalMaterials.current.get(obj);
      if (originalMat && obj instanceof THREE.Mesh) {
        obj.material = originalMat;
        obj.material.needsUpdate = true;
      }
      originalMaterials.current.delete(obj);
    }
  };

  const setHoverMaterial = (obj: THREE.Object3D) => {
    if (!originalMaterials.current.has(obj) && obj instanceof THREE.Mesh) {
      originalMaterials.current.set(obj, obj.material);
    }
    
    if (obj instanceof THREE.Mesh) {
      const hoverMaterial = new THREE.MeshStandardMaterial({
        color: 0x88ccff,
        transparent: true,
        opacity: 0.7,
        emissive: 0x004488,
        emissiveIntensity: 0.2,
      });
      
      obj.material = hoverMaterial;
      obj.material.needsUpdate = true;
    }
  };

  const setSelectMaterial = (obj: THREE.Object3D) => {
    if (obj instanceof THREE.Mesh) {
      const selectMaterial = new THREE.MeshStandardMaterial({
        color: 0xffaa00,
        transparent: true,
        opacity: 0.8,
        emissive: 0x664400,
        emissiveIntensity: 0.3,
      });
      
      obj.material = selectMaterial;
      obj.material.needsUpdate = true;
    }
  };

  // Función mejorada para detectar controles de transformación
  const isTransformControlClick = (event: MouseEvent): boolean => {
    const rect = gl.domElement.getBoundingClientRect();
    const mouse = new THREE.Vector2(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1
    );

    raycaster.current.setFromCamera(mouse, camera);
    
    // Buscar objetos de transform controls con mayor tolerancia
    const transformObjects: THREE.Object3D[] = [];
    scene.traverse((child) => {
      if (
        child.userData.isTransformControl ||
        child.name.includes('TransformControls') ||
        child.name.includes('gizmo') ||
        child.name.includes('picker') ||
        child.name.includes('helper') ||
        (child.parent && child.parent.userData.isTransformControl)
      ) {
        transformObjects.push(child);
      }
    });

    if (transformObjects.length > 0) {
      // Configurar raycaster con mayor tolerancia para controles
      const originalThreshold = raycaster.current.params.Points?.threshold || 0;
      raycaster.current.params.Points = { threshold: 0.2 };
      raycaster.current.params.Line = { threshold: 0.2 };
      
      const intersects = raycaster.current.intersectObjects(transformObjects, true);
      
      // Restaurar threshold original
      raycaster.current.params.Points = { threshold: originalThreshold };
      raycaster.current.params.Line = { threshold: originalThreshold };
      
      const hasIntersection = intersects.length > 0;
      if (hasIntersection) {
        console.log('Transform control detected at mouse position');
      }
      return hasIntersection;
    }

    return false;
  };

  const handleMouseMove = (event: MouseEvent) => {
    if (!isActive || isDragging) return;

    // No hacer hover si estamos sobre controles de transformación
    if (isTransformControlClick(event)) {
      if (hovered && hovered !== selected) {
        restoreOriginalMaterial(hovered);
      }
      setHovered(null);
      onObjectHover?.(null);
      gl.domElement.style.cursor = 'default';
      return;
    }

    const rect = gl.domElement.getBoundingClientRect();
    const mouse = new THREE.Vector2(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1
    );

    raycaster.current.setFromCamera(mouse, camera);
    const intersects = raycaster.current.intersectObjects(getSelectableObjects(), false);

    if (intersects.length > 0) {
      const targetObject = intersects[0].object;

      if (targetObject !== hovered) {
        if (hovered && hovered !== selected) {
          restoreOriginalMaterial(hovered);
        }
        
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
  };

  const handleClick = (event: MouseEvent) => {
    if (!isActive || isDragging) return;

    // CRÍTICO: No interceptar clicks en controles de transformación
    if (isTransformControlClick(event)) {
      console.log('Click on transform controls detected - allowing event to pass through');
      return; // NO hacer stopPropagation aquí
    }

    // Solo prevenir propagación si NO es en controles de transformación
    event.stopPropagation();

    if (hovered) {
      if (selected && selected !== hovered) {
        restoreOriginalMaterial(selected);
      }
      
      setSelectMaterial(hovered);
      setSelected(hovered);
      onObjectSelect?.(hovered);
      gl.domElement.style.cursor = 'default';
      
      console.log('Selected object:', hovered.name || hovered.type);
    } else {
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
      // Usar passive: false para poder prevenir eventos cuando sea necesario
      canvas.addEventListener('mousemove', handleMouseMove, { passive: false });
      // Usar capture: false para permitir que los controles manejen eventos primero
      canvas.addEventListener('click', handleClick, { capture: false, passive: false });

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
