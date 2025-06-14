
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
  const [dragState, setDragState] = useState<{
    handle: string | null;
    axis: 'x' | 'y' | 'z' | null;
    startMouse: { x: number; y: number } | null;
    startValue: number;
    camera: THREE.Camera | null;
  }>({
    handle: null,
    axis: null,
    startMouse: null,
    startValue: 0,
    camera: null
  });

  const boxRef = useRef<THREE.Group>(null);
  const { camera, gl, scene } = useThree();

  // Calcular bounds iniciales solo cuando se activa por primera vez
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

  // Aplicar/remover clipping cuando cambian los bounds o la activación
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
      setDragState({
        handle: null,
        axis: null,
        startMouse: null,
        startValue: 0,
        camera: null
      });
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

  // Calcular movimiento 3D desde coordenadas 2D del mouse
  const calculateMovement = useCallback((
    mouseX: number, 
    mouseY: number, 
    startMouseX: number, 
    startMouseY: number, 
    axis: 'x' | 'y' | 'z'
  ): number => {
    const deltaX = mouseX - startMouseX;
    const deltaY = mouseY - startMouseY;
    
    // Factor de sensibilidad basado en la distancia de la cámara
    const cameraDistance = camera.position.length();
    const sensitivity = cameraDistance * 0.003;
    
    switch (axis) {
      case 'x':
        return deltaX * sensitivity;
      case 'y':
        return -deltaY * sensitivity; // Invertido para Y
      case 'z':
        return deltaY * sensitivity;
      default:
        return 0;
    }
  }, [camera]);

  // Inicio del arrastre
  const handlePointerDown = useCallback((e: ThreeEvent<PointerEvent>, handle: string) => {
    if (!bounds) return;
    
    e.stopPropagation();
    
    const axis = handle.charAt(0) as 'x' | 'y' | 'z';
    const isMin = handle.endsWith('min');
    const currentValue = isMin ? bounds.min[axis] : bounds.max[axis];
    
    setIsDragging(true);
    setDragState({
      handle,
      axis,
      startMouse: { x: e.nativeEvent.clientX, y: e.nativeEvent.clientY },
      startValue: currentValue,
      camera: camera
    });
    
    onDragStateChange?.(true);
    gl.domElement.style.cursor = 'grabbing';
    
    console.log('Section Box drag started:', handle, 'initial value:', currentValue);
  }, [bounds, camera, gl, onDragStateChange]);

  // Movimiento durante el arrastre
  const handleGlobalPointerMove = useCallback((e: PointerEvent) => {
    if (!isDragging || !dragState.handle || !dragState.axis || !bounds || !dragState.startMouse) {
      return;
    }

    const movement = calculateMovement(
      e.clientX,
      e.clientY,
      dragState.startMouse.x,
      dragState.startMouse.y,
      dragState.axis
    );

    // Aplicar modo fino con Shift
    const finalMovement = e.shiftKey ? movement * 0.1 : movement;
    
    const newBounds = { min: bounds.min.clone(), max: bounds.max.clone() };
    const minSize = 0.5;
    
    if (dragState.handle.endsWith('min')) {
      const newValue = dragState.startValue + finalMovement;
      newBounds.min[dragState.axis] = Math.min(newValue, newBounds.max[dragState.axis] - minSize);
    } else {
      const newValue = dragState.startValue + finalMovement;
      newBounds.max[dragState.axis] = Math.max(newValue, newBounds.min[dragState.axis] + minSize);
    }
    
    setBounds(newBounds);
  }, [isDragging, dragState, bounds, calculateMovement]);

  // Fin del arrastre
  const handleGlobalPointerUp = useCallback(() => {
    if (isDragging) {
      console.log('Section Box drag ended - bounds maintained');
      setIsDragging(false);
      setDragState({
        handle: null,
        axis: null,
        startMouse: null,
        startValue: 0,
        camera: null
      });
      onDragStateChange?.(false);
      gl.domElement.style.cursor = 'default';
    }
  }, [isDragging, onDragStateChange, gl]);

  // Event listeners globales para el arrastre
  useEffect(() => {
    if (isDragging) {
      document.addEventListener('pointermove', handleGlobalPointerMove);
      document.addEventListener('pointerup', handleGlobalPointerUp);
      document.addEventListener('pointercancel', handleGlobalPointerUp);
      
      return () => {
        document.removeEventListener('pointermove', handleGlobalPointerMove);
        document.removeEventListener('pointerup', handleGlobalPointerUp);
        document.removeEventListener('pointercancel', handleGlobalPointerUp);
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
      
      {/* Handles de control más grandes y visibles */}
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
            opacity={dragState.handle === handle ? 1.0 : 0.8} 
            depthTest={false} 
          />
        </mesh>
      ))}
    </group>
  );
};
