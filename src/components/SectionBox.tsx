
import React, { useState, useRef, useEffect, useCallback } from 'react';
import * as THREE from 'three';
import { useThree, ThreeEvent } from '@react-three/fiber';

interface SectionBoxProps {
  isActive: boolean;
  onDragStateChange?: (isDragging: boolean, target?: string) => void;
}

export const SectionBox: React.FC<SectionBoxProps> = ({ isActive, onDragStateChange }) => {
  const [bounds, setBounds] = useState<{ min: THREE.Vector3; max: THREE.Vector3 } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragStateRef = useRef<{
    handle: string | null;
    axis: 'x' | 'y' | 'z' | null;
    startValue: number;
    startMouse: THREE.Vector2 | null;
    active: boolean;
  }>({
    handle: null,
    axis: null,
    startValue: 0,
    startMouse: null,
    active: false
  });

  const boxRef = useRef<THREE.Group>(null);
  const { camera, gl, scene } = useThree();

  // Calcular bounds iniciales
  useEffect(() => {
    if (isActive && !bounds) {
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
        const expansion = Math.max(size.x, size.y, size.z) * 0.05;
        globalBox.expandByScalar(expansion);
        setBounds({ min: globalBox.min.clone(), max: globalBox.max.clone() });
      } else {
        setBounds({ min: new THREE.Vector3(-10, -10, -10), max: new THREE.Vector3(10, 10, 10) });
      }
    }
  }, [isActive, scene, bounds]);

  // Aplicar clipping planes
  const applyClipping = useCallback((newBounds: { min: THREE.Vector3; max: THREE.Vector3 }) => {
    const planes = [
      new THREE.Plane(new THREE.Vector3(1, 0, 0), -newBounds.min.x),
      new THREE.Plane(new THREE.Vector3(-1, 0, 0), newBounds.max.x),
      new THREE.Plane(new THREE.Vector3(0, 1, 0), -newBounds.min.y),
      new THREE.Plane(new THREE.Vector3(0, -1, 0), newBounds.max.y),
      new THREE.Plane(new THREE.Vector3(0, 0, 1), -newBounds.min.z),
      new THREE.Plane(new THREE.Vector3(0, 0, -1), newBounds.max.z),
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

  // Remover clipping
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

  // Aplicar/remover clipping
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
      setIsDragging(false);
      dragStateRef.current = {
        handle: null,
        axis: null,
        startValue: 0,
        startMouse: null,
        active: false
      };
    }
  }, [isActive, removeClipping]);

  // Marcar elementos como parte de la section box
  useEffect(() => {
    if (boxRef.current) {
      boxRef.current.traverse((child) => {
        child.userData.isSectionBox = true;
      });
    }
  }, [bounds]);

  // Inicio del arrastre
  const handlePointerDown = useCallback((e: ThreeEvent<PointerEvent>, handle: string) => {
    if (!bounds) return;
    
    e.stopPropagation();
    
    const axis = handle.charAt(0) as 'x' | 'y' | 'z';
    const isMin = handle.endsWith('min');
    const currentValue = isMin ? bounds.min[axis] : bounds.max[axis];
    
    dragStateRef.current = {
      handle,
      axis,
      startValue: currentValue,
      startMouse: new THREE.Vector2(e.nativeEvent.clientX, e.nativeEvent.clientY),
      active: true
    };
    
    setIsDragging(true);
    onDragStateChange?.(true, handle);
    
    gl.domElement.style.cursor = 'grabbing';
    
    console.log('Section Box drag started:', handle, 'initial value:', currentValue);
  }, [bounds, gl, onDragStateChange]);

  // Movimiento durante el arrastre
  const handleGlobalPointerMove = useCallback((e: PointerEvent) => {
    if (!dragStateRef.current.active || !bounds || !dragStateRef.current.startMouse) {
      return;
    }

    e.preventDefault();
    e.stopPropagation();

    const deltaX = e.clientX - dragStateRef.current.startMouse.x;
    const deltaY = e.clientY - dragStateRef.current.startMouse.y;
    
    const cameraDistance = camera.position.length();
    const sensitivity = Math.max(cameraDistance * 0.001, 0.01);
    
    let movement = 0;
    switch (dragStateRef.current.axis) {
      case 'x':
        movement = deltaX * sensitivity;
        break;
      case 'y':
        movement = -deltaY * sensitivity;
        break;
      case 'z':
        movement = deltaY * sensitivity;
        break;
    }

    const finalMovement = e.shiftKey ? movement * 0.1 : movement;
    
    const newBounds = { min: bounds.min.clone(), max: bounds.max.clone() };
    const minSize = 0.1;
    
    if (dragStateRef.current.handle?.endsWith('min')) {
      const newValue = dragStateRef.current.startValue + finalMovement;
      newBounds.min[dragStateRef.current.axis!] = Math.min(newValue, newBounds.max[dragStateRef.current.axis!] - minSize);
    } else {
      const newValue = dragStateRef.current.startValue + finalMovement;
      newBounds.max[dragStateRef.current.axis!] = Math.max(newValue, newBounds.min[dragStateRef.current.axis!] + minSize);
    }
    
    setBounds(newBounds);
    // Aplicar clipping inmediatamente mientras arrastramos
    applyClipping(newBounds);
  }, [bounds, camera, applyClipping]);

  // Fin del arrastre
  const handleGlobalPointerUp = useCallback((e: PointerEvent) => {
    if (dragStateRef.current.active) {
      e.preventDefault();
      e.stopPropagation();
      
      console.log('Section Box drag ended');
      dragStateRef.current.active = false;
      setIsDragging(false);
      onDragStateChange?.(false);
      gl.domElement.style.cursor = 'default';
    }
  }, [onDragStateChange, gl]);

  // Event listeners globales
  useEffect(() => {
    if (isDragging && dragStateRef.current.active) {
      const moveOptions = { capture: true, passive: false };
      const upOptions = { capture: true };

      document.addEventListener('pointermove', handleGlobalPointerMove, moveOptions);
      document.addEventListener('pointerup', handleGlobalPointerUp, upOptions);
      document.addEventListener('pointercancel', handleGlobalPointerUp, upOptions);
      
      return () => {
        document.removeEventListener('pointermove', handleGlobalPointerMove, moveOptions);
        document.removeEventListener('pointerup', handleGlobalPointerUp, upOptions);
        document.removeEventListener('pointercancel', handleGlobalPointerUp, upOptions);
      };
    }
  }, [isDragging, handleGlobalPointerMove, handleGlobalPointerUp]);

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
          opacity={0.8} 
          depthTest={false} 
        />
      </mesh>
      
      {/* Caras semi-transparentes */}
      <mesh position={center} userData={{ isSectionBox: true }}>
        <boxGeometry args={[size.x, size.y, size.z]} />
        <meshBasicMaterial 
          color="#00FFFF" 
          transparent 
          opacity={0.05} 
          side={THREE.DoubleSide} 
          depthTest={false} 
        />
      </mesh>
      
      {/* Handles de control */}
      {[
        { handle: 'x-min', position: [bounds.min.x, center.y, center.z], color: '#ff4444' },
        { handle: 'x-max', position: [bounds.max.x, center.y, center.z], color: '#ff4444' },
        { handle: 'y-min', position: [center.x, bounds.min.y, center.z], color: '#44ff44' },
        { handle: 'y-max', position: [center.x, bounds.max.y, center.z], color: '#44ff44' },
        { handle: 'z-min', position: [center.x, center.y, bounds.min.z], color: '#4444ff' },
        { handle: 'z-max', position: [center.x, center.y, bounds.max.z], color: '#4444ff' },
      ].map(({ handle, position, color }) => (
        <mesh
          key={handle}
          position={position as [number, number, number]}
          userData={{ isSectionBox: true }}
          onPointerDown={(e) => handlePointerDown(e, handle)}
          onPointerEnter={() => !isDragging && (gl.domElement.style.cursor = 'grab')}
          onPointerLeave={() => !isDragging && (gl.domElement.style.cursor = 'default')}
        >
          <sphereGeometry args={[0.6, 16, 16]} />
          <meshBasicMaterial 
            color={color} 
            transparent 
            opacity={dragStateRef.current.handle === handle ? 1.0 : 0.8} 
            depthTest={false} 
          />
        </mesh>
      ))}
    </group>
  );
};
