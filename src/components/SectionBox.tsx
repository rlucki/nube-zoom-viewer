import React, { useRef, useEffect, useCallback } from 'react';
import * as THREE from 'three';
import { useThree, ThreeEvent } from '@react-three/fiber';
import { useHandleSize } from '../hooks/useHandleSize';

interface SectionBoxProps {
  isActive: boolean;
  bounds: { min: THREE.Vector3; max: THREE.Vector3 } | null;
  setBounds: (
    b: { min: THREE.Vector3; max: THREE.Vector3 } | null
  ) => void;
  onDragStateChange?: (isDragging: boolean, target?: string) => void;
  dragSensitivity: number;
  onDragSensitivityChange?: (value: number) => void;
}

export const SectionBox: React.FC<SectionBoxProps> = ({
  isActive,
  bounds,
  setBounds,
  onDragStateChange,
  dragSensitivity,
  onDragSensitivityChange,
}) => {
  const [isDragging, setIsDragging] = React.useState(false);
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

  // Calcular bounds iniciales SOLO si no existen y SectionBox activo
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
  }, [isActive, bounds, setBounds, scene]);

  // Aplicar clipping igual que antes, pero solo si bounds existe
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

  // Limpiar solo al desmontar: ya NO reiniciamos bounds por desactivar tools.
  useEffect(() => {
    if (!isActive) {
      removeClipping();
      setIsDragging(false);
      dragStateRef.current = {
        handle: null,
        axis: null,
        startValue: 0,
        startMouse: null,
        active: false,
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

  // Inicio del arrastre - mejorado
  const handlePointerDown = useCallback((e: ThreeEvent<PointerEvent>, handle: string) => {
    if (!bounds || isDragging) return;
    
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
    
    // Prevenir eventos de cámara inmediatamente
    gl.domElement.style.pointerEvents = 'none';
    setTimeout(() => {
      gl.domElement.style.pointerEvents = 'auto';
    }, 0);
    
    gl.domElement.style.cursor = 'grabbing';
    
    console.log('Section Box drag started:', handle, 'initial value:', currentValue);
  }, [bounds, isDragging, gl, onDragStateChange]);

  // Movimiento durante el arrastre, usando sensibilidad proveniente de la UI
  const handleGlobalPointerMove = useCallback((e: PointerEvent) => {
    if (!dragStateRef.current.active || !bounds || !dragStateRef.current.startMouse) {
      return;
    }

    e.preventDefault();
    e.stopPropagation();

    const deltaX = e.clientX - dragStateRef.current.startMouse.x;
    const deltaY = e.clientY - dragStateRef.current.startMouse.y;

    const cameraDistance = camera.position.length();
    // Sensibilidad controlada por UI (dragSensitivity), a escalar por distancia
    const sensitivity = Math.max(cameraDistance * dragSensitivity, 0.001);

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

    // Aplicar modo fino con Shift
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
  }, [bounds, camera, dragSensitivity]);

  // Fin del arrastre - mejorado
  const handleGlobalPointerUp = useCallback((e: PointerEvent) => {
    if (dragStateRef.current.active) {
      e.preventDefault();
      e.stopPropagation();
      
      console.log('Section Box drag ended - position maintained');
      dragStateRef.current.active = false;
      setIsDragging(false);
      onDragStateChange?.(false);
      gl.domElement.style.cursor = 'default';
    }
  }, [onDragStateChange, gl]);

  // Event listeners globales - mejorados
  useEffect(() => {
    if (isDragging && dragStateRef.current.active) {
      // Usar capture para interceptar eventos antes que otros handlers
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

  // Helper para renderizar handle con tamaño adaptativo
  const Handle = ({
    handle,
    position,
    color,
  }: { handle: string, position: [number, number, number], color: string }) => {
    const vec = new THREE.Vector3(...position);
    const scale = useHandleSize(vec, 26); // 26px "base"

    return (
      <mesh
        key={handle}
        position={position}
        scale={scale}
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
    );
  };

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
      ].map((h) => (
        <Handle key={h.handle} {...h} />
      ))}

      {/* Slider UI para sensibilidad */}
      {/* Si lo necesitas dentro del canvas, activa esto...
      {onDragSensitivityChange && (
        <group position={[center.x, bounds.max.y + 2.8 * size.y, center.z]}>
        </group>
      )}
      */}
    </group>
  );
};
