
import React, { useRef, useEffect, useState } from 'react';
import * as THREE from 'three';
import { useThree, useFrame } from '@react-three/fiber';

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
  const originalMaterials = useRef(new Map<THREE.Mesh | THREE.Points, THREE.Material | THREE.Material[]>());
  const localRaycaster = useRef(new THREE.Raycaster());
  const localMouse = useRef(new THREE.Vector2());

  // Función para obtener objetos intersectables (IFC y point clouds)
  const getIntersectableObjects = (): THREE.Object3D[] => {
    const intersectable: THREE.Object3D[] = [];
    scene.traverse((child) => {
      if (child instanceof THREE.Mesh || child instanceof THREE.Points) {
        // Excluir helpers y UI elements
        if (!child.name.includes('helper') && 
            !child.name.includes('grid') && 
            !child.name.includes('axes') &&
            !child.name.includes('section') &&
            !child.userData.isUI) {
          intersectable.push(child);
        }
      }
    });
    return intersectable;
  };

  // Función para aplicar efecto de hover
  const applyHoverEffect = (object: THREE.Object3D) => {
    object.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        // Guardar material original si no se ha guardado
        if (!originalMaterials.current.has(child)) {
          originalMaterials.current.set(child, child.material);
        }

        // Crear material de hover
        const hoverMaterial = Array.isArray(child.material) 
          ? child.material.map(mat => mat.clone())
          : child.material.clone();

        if (Array.isArray(hoverMaterial)) {
          hoverMaterial.forEach(mat => {
            if ('color' in mat) {
              mat.color.multiplyScalar(1.3); // Hacer más brillante
            }
            if ('emissive' in mat) {
              mat.emissive.setRGB(0.1, 0.1, 0.2); // Añadir brillo azul
            }
          });
        } else {
          if ('color' in hoverMaterial) {
            hoverMaterial.color.multiplyScalar(1.3);
          }
          if ('emissive' in hoverMaterial) {
            hoverMaterial.emissive.setRGB(0.1, 0.1, 0.2);
          }
        }

        child.material = hoverMaterial;
      } else if (child instanceof THREE.Points) {
        // Para point clouds, cambiar el color del material
        if (!originalMaterials.current.has(child)) {
          originalMaterials.current.set(child, child.material);
        }
        
        const hoverMaterial = (child.material as THREE.PointsMaterial).clone();
        hoverMaterial.color.setRGB(0.5, 0.8, 1.0); // Color azul claro
        child.material = hoverMaterial;
      }
    });
  };

  // Función para aplicar efecto de selección
  const applySelectionEffect = (object: THREE.Object3D) => {
    object.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        // Guardar material original si no se ha guardado
        if (!originalMaterials.current.has(child)) {
          originalMaterials.current.set(child, child.material);
        }

        // Crear material de selección
        const selectedMaterial = Array.isArray(child.material) 
          ? child.material.map(mat => mat.clone())
          : child.material.clone();

        if (Array.isArray(selectedMaterial)) {
          selectedMaterial.forEach(mat => {
            if ('color' in mat) {
              mat.color.multiplyScalar(1.5);
            }
            if ('emissive' in mat) {
              mat.emissive.setRGB(0.2, 0.4, 0.0); // Brillo verde
            }
          });
        } else {
          if ('color' in selectedMaterial) {
            selectedMaterial.color.multiplyScalar(1.5);
          }
          if ('emissive' in selectedMaterial) {
            selectedMaterial.emissive.setRGB(0.2, 0.4, 0.0);
          }
        }

        child.material = selectedMaterial;
      } else if (child instanceof THREE.Points) {
        if (!originalMaterials.current.has(child)) {
          originalMaterials.current.set(child, child.material);
        }
        
        const selectedMaterial = (child.material as THREE.PointsMaterial).clone();
        selectedMaterial.color.setRGB(0.2, 1.0, 0.2); // Color verde claro
        child.material = selectedMaterial;
      }
    });
  };

  // Función para restaurar material original
  const restoreMaterial = (object: THREE.Object3D) => {
    object.traverse((child) => {
      if ((child instanceof THREE.Mesh || child instanceof THREE.Points) && 
          originalMaterials.current.has(child)) {
        child.material = originalMaterials.current.get(child)!;
      }
    });
  };

  const handleMouseMove = (event: MouseEvent) => {
    if (!isActive) return;

    const rect = gl.domElement.getBoundingClientRect();
    localMouse.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    localMouse.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    localRaycaster.current.setFromCamera(localMouse.current, camera);
    const intersectable = getIntersectableObjects();
    const intersects = localRaycaster.current.intersectObjects(intersectable, true);

    if (intersects.length > 0) {
      // Encontrar el objeto padre más relevante
      let newHoveredObject = intersects[0].object;
      while (newHoveredObject.parent && newHoveredObject.parent.type !== 'Scene') {
        newHoveredObject = newHoveredObject.parent;
      }

      if (newHoveredObject !== hoveredObject) {
        // Restaurar material del objeto anteriormente hovereado
        if (hoveredObject && hoveredObject !== selectedObject) {
          restoreMaterial(hoveredObject);
        }

        // Aplicar efecto hover al nuevo objeto (si no está seleccionado)
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

  const handleMouseClick = (event: MouseEvent) => {
    if (!isActive) return;

    if (hoveredObject) {
      // Restaurar material del objeto anteriormente seleccionado
      if (selectedObject) {
        restoreMaterial(selectedObject);
      }

      // Aplicar efecto de selección al nuevo objeto
      applySelectionEffect(hoveredObject);
      
      setSelectedObject(hoveredObject);
      onObjectSelect?.(hoveredObject);
    }
  };

  useEffect(() => {
    if (isActive) {
      gl.domElement.addEventListener('mousemove', handleMouseMove);
      gl.domElement.addEventListener('click', handleMouseClick);
    }

    return () => {
      gl.domElement.removeEventListener('mousemove', handleMouseMove);
      gl.domElement.removeEventListener('click', handleMouseClick);
      gl.domElement.style.cursor = 'default';
    };
  }, [isActive, hoveredObject, selectedObject]);

  // Limpiar efectos cuando se desactiva
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

  return null; // Este componente no renderiza nada visible
};
