
import React, { useState, useRef, useEffect, useCallback } from 'react';
import * as THREE from 'three';
import { useThree, ThreeEvent } from '@react-three/fiber';

interface SectionBoxProps {
  isActive: boolean;
  onDragStateChange?: (isDragging: boolean) => void;
}

export const SectionBox: React.FC<SectionBoxProps> = ({ isActive, onDragStateChange }) => {
  const [bounds, setBounds] = useState<{ min: THREE.Vector3; max: THREE.Vector3 } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragHandle, setDragHandle] = useState<string | null>(null);
  const [dragAxis, setDragAxis] = useState<'x' | 'y' | 'z' | null>(null);
  const [userModified, setUserModified] = useState(false);
  const [dragStartPos, setDragStartPos] = useState<{ x: number; y: number } | null>(null);
  const [initialBoundValue, setInitialBoundValue] = useState<number>(0);

  const boxRef = useRef<THREE.Group>(null);
  const { camera, gl, scene } = useThree();

  // Calcular bounds iniciales
  useEffect(() => {
    if (isActive && !userModified && !bounds) {
      const globalBox = new THREE.Box3();
      let hasObjects = false;
      
      scene.traverse((child) => {
        if (
          (child instanceof THREE.Mesh || child instanceof THREE.Points) &&
          !child.userData.isSectionBox &&
          !child.userData.isUI &&
          !child.name.includes('helper') &&
          !child.name.includes('grid')
        ) {
          if (child instanceof THREE.Mesh) {
            const boundingBox = new THREE.Box3().setFromObject(child);
            if (!boundingBox.isEmpty()) {
              globalBox.union(boundingBox);
              hasObjects = true;
            }
          }
          if (child instanceof THREE.Points && child.geometry.boundingBox) {
            const boundingBox = child.geometry.boundingBox.clone();
            boundingBox.applyMatrix4(child.matrixWorld);
            if (!boundingBox.isEmpty()) {
              globalBox.union(boundingBox);
              hasObjects = true;
            }
          }
        }
      });

      if (hasObjects && !globalBox.isEmpty()) {
        const size = globalBox.getSize(new THREE.Vector3());
        globalBox.expandByScalar(Math.max(size.x, size.y, size.z) * 0.05);
        setBounds({ min: globalBox.min.clone(), max: globalBox.max.clone() });
      } else {
        setBounds({ min: new THREE.Vector3(-10, -10, -10), max: new THREE.Vector3(10, 10, 10) });
      }
    }
  }, [isActive, scene, userModified, bounds]);

  // Aplicar clipping
  const applyClipping = useCallback((b: { min: THREE.Vector3; max: THREE.Vector3 }) => {
    const planes = [
      new THREE.Plane(new THREE.Vector3(1, 0, 0), -b.min.x),
      new THREE.Plane(new THREE.Vector3(-1, 0, 0), b.max.x),
      new THREE.Plane(new THREE.Vector3(0, 1, 0), -b.min.y),
      new THREE.Plane(new THREE.Vector3(0, -1, 0), b.max.y),
      new THREE.Plane(new THREE.Vector3(0, 0, 1), -b.min.z),
      new THREE.Plane(new THREE.Vector3(0, 0, -1), b.max.z),
    ];

    scene.traverse((child) => {
      if ((child instanceof THREE.Mesh || child instanceof THREE.Points) && !child.userData.isSectionBox) {
        const materials = Array.isArray(child.material) ? child.material : [child.material];
        materials.forEach((material) => {
          if (material) {
            material.clippingPlanes = planes;
            material.needsUpdate = true;
          }
        });
      }
    });
  }, [scene]);

  const removeClipping = useCallback(() => {
    scene.traverse((child) => {
      if ((child instanceof THREE.Mesh || child instanceof THREE.Points) && !child.userData.isSectionBox) {
        const materials = Array.isArray(child.material) ? child.material : [child.material];
        materials.forEach((material) => {
          if (material) {
            material.clippingPlanes = [];
            material.needsUpdate = true;
          }
        });
      }
    });
  }, [scene]);

  useEffect(() => {
    if (isActive && bounds) {
      applyClipping(bounds);
    } else {
      removeClipping();
    }
  }, [isActive, bounds, applyClipping, removeClipping]);

  // Limpiar al desactivar
  useEffect(() => {
    if (!isActive) {
      removeClipping();
      setBounds(null);
      setUserModified(false);
      setIsDragging(false);
      setDragHandle(null);
      setDragAxis(null);
    }
  }, [isActive, removeClipping]);

  // Marcar elementos de la sección
  useEffect(() => {
    if (boxRef.current) {
      boxRef.current.traverse((child) => {
        child.userData.isSectionBox = true;
      });
    }
  }, [bounds]);

  // Manejador de inicio de arrastre
  const handlePointerDown = (e: ThreeEvent<PointerEvent>, handle: string) => {
    if (!bounds) return;
    
    e.stopPropagation();
    
    const axis = handle.charAt(0) as 'x' | 'y' | 'z';
    const isMin = handle.endsWith('min');
    const currentValue = isMin ? bounds.min[axis] : bounds.max[axis];
    
    setIsDragging(true);
    setDragHandle(handle);
    setDragAxis(axis);
    setDragStartPos({ x: e.clientX, y: e.clientY });
    setInitialBoundValue(currentValue);
    setUserModified(true);
    
    onDragStateChange?.(true);
    gl.domElement.style.cursor = 'grabbing';
    
    console.log('Drag started:', handle, 'initial value:', currentValue);
  };

  // Manejador de movimiento
  const handlePointerMove = useCallback((e: PointerEvent) => {
    if (!isDragging || !dragHandle || !dragAxis || !bounds || !dragStartPos) return;

    const deltaX = e.clientX - dragStartPos.x;
    const deltaY = e.clientY - dragStartPos.y;
    
    // Calcular el movimiento basado en el eje
    let movement = 0;
    switch (dragAxis) {
      case 'x':
        movement = deltaX * 0.05; // Factor de escala ajustable
        break;
      case 'y':
        movement = -deltaY * 0.05; // Invertido para Y
        break;
      case 'z':
        movement = deltaY * 0.05;
        break;
    }
    
    // Aplicar modo fino con Shift
    if (e.shiftKey) {
      movement *= 0.1;
    }
    
    const newBounds = { min: bounds.min.clone(), max: bounds.max.clone() };
    const minSize = 0.5; // Tamaño mínimo de la caja
    
    if (dragHandle.endsWith('min')) {
      const newValue = initialBoundValue + movement;
      newBounds.min[dragAxis] = Math.min(newValue, newBounds.max[dragAxis] - minSize);
    } else {
      const newValue = initialBoundValue + movement;
      newBounds.max[dragAxis] = Math.max(newValue, newBounds.min[dragAxis] + minSize);
    }
    
    setBounds(newBounds);
    console.log('New bounds:', newBounds);
    
  }, [isDragging, dragHandle, dragAxis, bounds, dragStartPos, initialBoundValue]);

  // Manejador de fin de arrastre
  const handlePointerUp = useCallback(() => {
    if (isDragging) {
      console.log('Drag ended - bounds should be maintained');
      setIsDragging(false);
      setDragHandle(null);
      setDragAxis(null);
      setDragStartPos(null);
      onDragStateChange?.(false);
      gl.domElement.style.cursor = 'default';
    }
  }, [isDragging, onDragStateChange, gl]);

  // Event listeners globales
  useEffect(() => {
    if (isDragging) {
      document.addEventListener('pointermove', handlePointerMove);
      document.addEventListener('pointerup', handlePointerUp);
      document.addEventListener('pointercancel', handlePointerUp);
      
      return () => {
        document.removeEventListener('pointermove', handlePointerMove);
        document.removeEventListener('pointerup', handlePointerUp);
        document.removeEventListener('pointercancel', handlePointerUp);
      };
    }
  }, [isDragging, handlePointerMove, handlePointerUp]);

  if (!bounds || !isActive) return null;

  const center = bounds.min.clone().lerp(bounds.max, 0.5);
  const size = bounds.max.clone().sub(bounds.min);

  return (
    <group ref={boxRef}>
      {/* Wireframe del cubo */}
      <mesh position={center} userData={{ isSectionBox: true }}>
        <boxGeometry args={[size.x, size.y, size.z]} />
        <meshBasicMaterial 
          wireframe 
          color="#00FFFF" 
          transparent 
          opacity={0.6} 
          depthTest={false} 
        />
      </mesh>
      
      {/* Caras semi-transparentes */}
      <mesh position={center} userData={{ isSectionBox: true }}>
        <boxGeometry args={[size.x, size.y, size.z]} />
        <meshBasicMaterial 
          color="#00FFFF" 
          transparent 
          opacity={0.1} 
          side={THREE.DoubleSide} 
          depthTest={false} 
        />
      </mesh>
      
      {/* Handles de control */}
      {[
        { handle: 'x-min', position: [bounds.min.x, center.y, center.z], color: '#ff0000' },
        { handle: 'x-max', position: [bounds.max.x, center.y, center.z], color: '#ff0000' },
        { handle: 'y-min', position: [center.x, bounds.min.y, center.z], color: '#00ff00' },
        { handle: 'y-max', position: [center.x, bounds.max.y, center.z], color: '#00ff00' },
        { handle: 'z-min', position: [center.x, center.y, bounds.min.z], color: '#0000ff' },
        { handle: 'z-max', position: [center.x, center.y, bounds.max.z], color: '#0000ff' },
      ].map(({ handle, position, color }) => (
        <mesh
          key={handle}
          position={position as [number, number, number]}
          userData={{ isSectionBox: true }}
          onPointerDown={(e) => handlePointerDown(e, handle)}
          onPointerEnter={() => !isDragging && (gl.domElement.style.cursor = 'grab')}
          onPointerLeave={() => !isDragging && (gl.domElement.style.cursor = 'default')}
        >
          <sphereGeometry args={[0.4, 16, 16]} />
          <meshBasicMaterial 
            color={color} 
            transparent 
            opacity={0.8} 
            depthTest={false} 
          />
        </mesh>
      ))}
    </group>
  );
};
