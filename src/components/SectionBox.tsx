
import React, { useState, useRef, useEffect } from 'react';
import * as THREE from 'three';
import { useThree, ThreeEvent } from '@react-three/fiber';

interface SectionBoxProps {
  targetObject: THREE.Object3D | null;
  isActive: boolean;
  onSectionChange?: (bounds: { min: THREE.Vector3; max: THREE.Vector3 }) => void;
  onDragStateChange?: (isDragging: boolean) => void;
}

export const SectionBox: React.FC<SectionBoxProps> = ({
  targetObject,
  isActive,
  onSectionChange,
  onDragStateChange,
}) => {
  const [bounds, setBounds] = useState<{ min: THREE.Vector3; max: THREE.Vector3 } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragHandle, setDragHandle] = useState<string | null>(null);
  const [dragStart, setDragStart] = useState<THREE.Vector3 | null>(null);

  const boxRef = useRef<THREE.Group>(null);
  const { camera, gl, scene } = useThree();
  const raycaster = useRef(new THREE.Raycaster());

  // Crear bounds iniciales cuando se activa y hay un objeto target
  useEffect(() => {
    if (targetObject && isActive) {
      const box = new THREE.Box3().setFromObject(targetObject);
      
      if (!box.isEmpty()) {
        const size = box.getSize(new THREE.Vector3());
        const expansion = Math.max(size.x, size.y, size.z) * 0.1;
        box.expandByScalar(expansion);
        
        setBounds({
          min: box.min.clone(),
          max: box.max.clone(),
        });
      } else {
        // Fallback para objetos sin geometría
        const center = new THREE.Vector3();
        targetObject.getWorldPosition(center);
        setBounds({
          min: new THREE.Vector3(center.x - 5, center.y - 5, center.z - 5),
          max: new THREE.Vector3(center.x + 5, center.y + 5, center.z + 5),
        });
      }
    }
  }, [targetObject, isActive]);

  // Aplicar clipping planes
  const applyClipping = (newBounds: { min: THREE.Vector3; max: THREE.Vector3 }) => {
    if (!targetObject) return;

    // Crear los planos de clipping
    const planes = [
      new THREE.Plane(new THREE.Vector3(-1, 0, 0), newBounds.min.x),   // x >= min.x
      new THREE.Plane(new THREE.Vector3(1, 0, 0), -newBounds.max.x),   // x <= max.x
      new THREE.Plane(new THREE.Vector3(0, -1, 0), newBounds.min.y),   // y >= min.y
      new THREE.Plane(new THREE.Vector3(0, 1, 0), -newBounds.max.y),   // y <= max.y
      new THREE.Plane(new THREE.Vector3(0, 0, -1), newBounds.min.z),   // z >= min.z
      new THREE.Plane(new THREE.Vector3(0, 0, 1), -newBounds.max.z),   // z <= max.z
    ];

    // Aplicar a todos los objetos relevantes en la escena
    scene.traverse((child) => {
      if (child instanceof THREE.Mesh && child.material && !child.userData.isSectionBox && !child.userData.isUI) {
        const materials = Array.isArray(child.material) ? child.material : [child.material];
        materials.forEach((material) => {
          material.clippingPlanes = planes;
          material.clipShadows = true;
          material.needsUpdate = true;
        });
      }
      if (child instanceof THREE.Points && child.material && !child.userData.isSectionBox) {
        child.material.clippingPlanes = planes;
        child.material.clipShadows = true;
        child.material.needsUpdate = true;
      }
    });

    onSectionChange?.(newBounds);
  };

  // Remover clipping planes
  const removeClipping = () => {
    scene.traverse((child) => {
      if (child instanceof THREE.Mesh && child.material && !child.userData.isSectionBox) {
        const materials = Array.isArray(child.material) ? child.material : [child.material];
        materials.forEach((material) => {
          material.clippingPlanes = [];
          material.needsUpdate = true;
        });
      }
      if (child instanceof THREE.Points && child.material && !child.userData.isSectionBox) {
        child.material.clippingPlanes = [];
        child.material.needsUpdate = true;
      }
    });
  };

  // Aplicar clipping cuando cambien los bounds
  useEffect(() => {
    if (isActive && bounds) {
      applyClipping(bounds);
    } else {
      removeClipping();
    }
  }, [bounds, isActive, scene]);

  // Limpiar cuando se desactiva
  useEffect(() => {
    if (!isActive) {
      removeClipping();
      setBounds(null);
    }
  }, [isActive]);

  // Marcar elementos del section box
  useEffect(() => {
    if (boxRef.current) {
      boxRef.current.traverse((child) => {
        child.userData.isSectionBox = true;
      });
    }
  }, [bounds]);

  // Handlers de arrastre
  const handlePointerDown = (event: ThreeEvent<PointerEvent>, handle: string) => {
    if (!bounds) return;
    
    event.stopPropagation();
    setIsDragging(true);
    setDragHandle(handle);
    onDragStateChange?.(true);
    
    // Guardar posición inicial del mouse en mundo
    const rect = gl.domElement.getBoundingClientRect();
    const mouse = new THREE.Vector2(
      ((event.nativeEvent.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.nativeEvent.clientY - rect.top) / rect.height) * 2 + 1
    );

    raycaster.current.setFromCamera(mouse, camera);
    
    // Crear un plano para el arrastre
    const center = bounds.min.clone().lerp(bounds.max, 0.5);
    let planeNormal = new THREE.Vector3();
    
    switch (handle) {
      case 'x-min':
      case 'x-max':
        planeNormal.set(0, 0, 1);
        break;
      case 'y-min':
      case 'y-max':
        planeNormal.set(1, 0, 1);
        break;
      case 'z-min':
      case 'z-max':
        planeNormal.set(1, 0, 0);
        break;
    }

    const dragPlane = new THREE.Plane(planeNormal, 0);
    dragPlane.setFromNormalAndCoplanarPoint(planeNormal, center);
    
    const intersection = new THREE.Vector3();
    if (raycaster.current.ray.intersectPlane(dragPlane, intersection)) {
      setDragStart(intersection);
    }

    gl.domElement.style.cursor = 'grabbing';
  };

  const handlePointerMove = (event: MouseEvent) => {
    if (!isDragging || !dragHandle || !bounds || !dragStart) return;

    const rect = gl.domElement.getBoundingClientRect();
    const mouse = new THREE.Vector2(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1
    );

    raycaster.current.setFromCamera(mouse, camera);

    // Crear plano de arrastre basado en el handle
    const center = bounds.min.clone().lerp(bounds.max, 0.5);
    let planeNormal = new THREE.Vector3();
    
    switch (dragHandle) {
      case 'x-min':
      case 'x-max':
        planeNormal.set(0, 0, 1);
        break;
      case 'y-min':
      case 'y-max':
        planeNormal.set(1, 0, 1);
        break;
      case 'z-min':
      case 'z-max':
        planeNormal.set(1, 0, 0);
        break;
    }

    const dragPlane = new THREE.Plane(planeNormal, 0);
    dragPlane.setFromNormalAndCoplanarPoint(planeNormal, center);
    
    const intersection = new THREE.Vector3();
    if (raycaster.current.ray.intersectPlane(dragPlane, intersection)) {
      const newBounds = {
        min: bounds.min.clone(),
        max: bounds.max.clone(),
      };

      const minSize = 0.1;
      
      switch (dragHandle) {
        case 'x-min':
          newBounds.min.x = Math.min(intersection.x, newBounds.max.x - minSize);
          break;
        case 'x-max':
          newBounds.max.x = Math.max(intersection.x, newBounds.min.x + minSize);
          break;
        case 'y-min':
          newBounds.min.y = Math.min(intersection.y, newBounds.max.y - minSize);
          break;
        case 'y-max':
          newBounds.max.y = Math.max(intersection.y, newBounds.min.y + minSize);
          break;
        case 'z-min':
          newBounds.min.z = Math.min(intersection.z, newBounds.max.z - minSize);
          break;
        case 'z-max':
          newBounds.max.z = Math.max(intersection.z, newBounds.min.z + minSize);
          break;
      }

      setBounds(newBounds);
    }
  };

  const handlePointerUp = () => {
    setIsDragging(false);
    setDragHandle(null);
    setDragStart(null);
    onDragStateChange?.(false);
    gl.domElement.style.cursor = 'default';
  };

  // Event listeners globales
  useEffect(() => {
    if (isDragging) {
      const canvas = gl.domElement;
      canvas.addEventListener('pointermove', handlePointerMove);
      canvas.addEventListener('pointerup', handlePointerUp);
      
      return () => {
        canvas.removeEventListener('pointermove', handlePointerMove);
        canvas.removeEventListener('pointerup', handlePointerUp);
      };
    }
  }, [isDragging, dragHandle, bounds, dragStart]);

  if (!bounds || !isActive || !targetObject) {
    return null;
  }

  const center = bounds.min.clone().lerp(bounds.max, 0.5);
  const size = bounds.max.clone().sub(bounds.min);

  return (
    <group ref={boxRef}>
      {/* Caja wireframe */}
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

      {/* Caja semitransparente */}
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
      ].map((item) => (
        <mesh
          key={item.handle}
          position={item.position as [number, number, number]}
          userData={{ isSectionBox: true }}
          onPointerDown={(e) => handlePointerDown(e, item.handle)}
          onPointerEnter={() => {
            gl.domElement.style.cursor = 'grab';
          }}
          onPointerLeave={() => {
            if (!isDragging) gl.domElement.style.cursor = 'default';
          }}
        >
          <sphereGeometry args={[0.5, 16, 16]} />
          <meshBasicMaterial
            color={item.color}
            transparent
            opacity={0.8}
            depthTest={false}
          />
        </mesh>
      ))}
    </group>
  );
};
