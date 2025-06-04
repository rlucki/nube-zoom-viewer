// src/components/SectionBox.tsx
import React, { useState, useRef, useEffect } from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';

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
  // Estado local
  const [bounds, setBounds] = useState<{ min: THREE.Vector3; max: THREE.Vector3 } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragFace, setDragFace] = useState<string | null>(null);
  const [hoveredHandle, setHoveredHandle] = useState<string | null>(null);

  // Referencias de THREE.js
  const boxRef = useRef<THREE.Group>(null);
  const raycaster = useRef(new THREE.Raycaster());
  const dragPlane = useRef<THREE.Plane & { axis?: THREE.Vector3 }>(
    new THREE.Plane(),
  );
  const intersection = useRef(new THREE.Vector3());
  const startPosition = useRef(new THREE.Vector3());
  const captureTarget = useRef<EventTarget | null>(null);

  const { camera, gl } = useThree();

  // 1) Marcamos todos los nodos del SectionBox con userData.isSectionBox → true
  useEffect(() => {
    if (boxRef.current) {
      boxRef.current.traverse((child) => {
        (child as THREE.Object3D & {
          userData: { isSectionBox?: boolean };
        }).userData.isSectionBox = true;
      });
      (boxRef.current as THREE.Object3D & {
        userData: { isSectionBox?: boolean };
      }).userData.isSectionBox = true;
      console.log('[SectionBox] Todos los nodos marcados isSectionBox=true');
    }
  }, []);

  // 2) Cuando targetObject o isActive cambian, calculamos bounds iniciales ÚNICAMENTE cuando se activa
  useEffect(() => {
    if (targetObject && isActive && targetObject.type !== 'Scene') {
      const box3 = new THREE.Box3().setFromObject(targetObject);

      if (!box3.isEmpty()) {
        const size = box3.getSize(new THREE.Vector3());
        const expansion = Math.max(size.x, size.y, size.z) * 0.1;
        box3.expandByScalar(expansion);

        setBounds({
          min: box3.min.clone(),
          max: box3.max.clone(),
        });
        console.log('[SectionBox] Bounds iniciales calculados:', box3.min, box3.max);
      } else {
        const center = new THREE.Vector3();
        targetObject.getWorldPosition(center);
        setBounds({
          min: new THREE.Vector3(center.x - 10, center.y - 10, center.z - 10),
          max: new THREE.Vector3(center.x + 10, center.y + 10, center.z + 10),
        });
        console.log('[SectionBox] Bounds de fallback (sin geometría):', center);
      }
    }
  }, [targetObject, isActive]);

// 3) Crear y aplicar clipping planes
const applyClippingPlanes = (newBounds: { min: THREE.Vector3; max: THREE.Vector3 }) => {
  if (!targetObject) return;

  // Helper
  const plane = (n: THREE.Vector3, p: THREE.Vector3) =>
    new THREE.Plane().setFromNormalAndCoplanarPoint(n, p).clone();

  // Normales apuntando hacia el centro
  const planes = [
    /*  X ≥ minX */ plane(new THREE.Vector3( 1, 0, 0), new THREE.Vector3(newBounds.min.x, 0, 0)),
    /*  X ≤ maxX */ plane(new THREE.Vector3(-1, 0, 0), new THREE.Vector3(newBounds.max.x, 0, 0)),
    /*  Y ≥ minY */ plane(new THREE.Vector3(0,  1, 0), new THREE.Vector3(0, newBounds.min.y, 0)),
    /*  Y ≤ maxY */ plane(new THREE.Vector3(0, -1, 0), new THREE.Vector3(0, newBounds.max.y, 0)),
    /*  Z ≥ minZ */ plane(new THREE.Vector3(0, 0,  1), new THREE.Vector3(0, 0, newBounds.min.z)),
    /*  Z ≤ maxZ */ plane(new THREE.Vector3(0, 0, -1), new THREE.Vector3(0, 0, newBounds.max.z)),
  ];

  // Asignar los planos e INTERSECTARLOS
  targetObject.traverse((child) => {
    if (
      (child instanceof THREE.Mesh || child instanceof THREE.Points) &&
      child.material
    ) {
      const mats = Array.isArray(child.material) ? child.material : [child.material];
      mats.forEach((mat: THREE.Material) => {
        mat.clippingPlanes    = planes;
        mat.clipIntersection  = true;   // 👈  ¡esta línea hace la magia!
        mat.needsUpdate       = true;
      });
    }
  });

  console.log('[SectionBox] Clipping aplicado:', newBounds.min, newBounds.max);
  onSectionChange?.(newBounds);
};


  // 4) Función para remover clipping planes
  const removeClippingPlanes = () => {
    if (!targetObject) return;

    targetObject.traverse((child) => {
      if (child instanceof THREE.Mesh && child.material) {
        const mats = Array.isArray(child.material) ? child.material : [child.material];
        mats.forEach((mat) => {
          mat.clippingPlanes = [];
          mat.needsUpdate = true;
        });
      } else if (child instanceof THREE.Points && child.material) {
        (child.material as THREE.PointsMaterial).clippingPlanes = [];
        (child.material as THREE.PointsMaterial).needsUpdate = true;
      }
    });

    console.log('[SectionBox] Clipping removido (sección inactiva o reseteo).');
  };

  // 5) Actualizar clipping cuando cambian los límites o el estado activo.
  //    Si la herramienta está activa aplicamos los planos; en caso contrario los quitamos.
  useEffect(() => {
    if (isActive && bounds) {
      applyClippingPlanes(bounds);
    } else {
      removeClippingPlanes();
    }
  }, [bounds, isActive]);

  // 6) Iniciar arrastre (pointerDown sobre un cono)
  const handlePointerDown = (
    event: React.PointerEvent<HTMLElement>,
    face: string,
  ) => {
    if (!bounds) return;
    event.stopPropagation();
    event.nativeEvent?.stopImmediatePropagation?.();

    // Capture pointer to avoid losing events
    captureTarget.current = event.currentTarget;
    (captureTarget.current as HTMLElement | null)?.setPointerCapture?.(event.pointerId);

    setIsDragging(true);
    setDragFace(face);
    onDragStateChange?.(true);

    // El plano de arrastre es paralelo a la cámara
    const planeNormal = camera.getWorldDirection(new THREE.Vector3()).normalize();
    
    // Pasa por la posición del handle
    const handlePosition = new THREE.Vector3();
    switch (face) {
      case 'x-min': handlePosition.set(bounds.min.x, (bounds.min.y + bounds.max.y) / 2, (bounds.min.z + bounds.max.z) / 2); break;
      case 'x-max': handlePosition.set(bounds.max.x, (bounds.min.y + bounds.max.y) / 2, (bounds.min.z + bounds.max.z) / 2); break;
      case 'y-min': handlePosition.set((bounds.min.x + bounds.max.x) / 2, bounds.min.y, (bounds.min.z + bounds.max.z) / 2); break;
      case 'y-max': handlePosition.set((bounds.min.x + bounds.max.x) / 2, bounds.max.y, (bounds.min.z + bounds.max.z) / 2); break;
      case 'z-min': handlePosition.set((bounds.min.x + bounds.max.x) / 2, (bounds.min.y + bounds.max.y) / 2, bounds.min.z); break;
      case 'z-max': handlePosition.set((bounds.min.x + bounds.max.x) / 2, (bounds.min.y + bounds.max.y) / 2, bounds.max.z); break;
    }
    
    dragPlane.current.setFromNormalAndCoplanarPoint(planeNormal, handlePosition);

    // Vector del eje de movimiento
    const axis = ((): THREE.Vector3 => {
      switch (face) {
        case 'x-min':
        case 'x-max': return new THREE.Vector3(1, 0, 0);
        case 'y-min':
        case 'y-max': return new THREE.Vector3(0, 1, 0);
        default:      return new THREE.Vector3(0, 0, 1); // z-min / z-max
      }
    })().normalize();

    // Guardamos posición inicial y eje
    startPosition.current.set(0, 0, 0);
    
    // Use the pointer position from the Three.js event
    const rect = gl.domElement.getBoundingClientRect();
    const clientX = event.nativeEvent?.clientX || event.clientX || 0;
    const clientY = event.nativeEvent?.clientY || event.clientY || 0;
    
    raycaster.current.setFromCamera(
      new THREE.Vector2(
        ((clientX - rect.left) / rect.width) * 2 - 1,
        -((clientY - rect.top) / rect.height) * 2 + 1,
      ),
      camera,
    );
    raycaster.current.ray.intersectPlane(dragPlane.current, startPosition.current);

    // Guardamos también el eje para usarlo en pointerMove
    dragPlane.current.axis = axis;
  };

  // 7) Durante el arrastre (pointerMove)
  const handlePointerMove = (event: MouseEvent) => {
    if (!isDragging || !dragFace || !bounds) return;

    const rect = gl.domElement.getBoundingClientRect();
    const mouse = new THREE.Vector2(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1
    );
    raycaster.current.setFromCamera(mouse, camera);

    if (raycaster.current.ray.intersectPlane(dragPlane.current, intersection.current)) {
      const delta = intersection.current
        .clone()
        .sub(startPosition.current);            // movimiento completo
      const axis = dragPlane.current.axis as THREE.Vector3;
      const move = delta.dot(axis);            // proyección sobre el eje

      const newBounds = {
        min: bounds.min.clone(),
        max: bounds.max.clone(),
      };
      const minSize = 0.1;

      switch (dragFace) {
        case 'x-min': newBounds.min.x = Math.min(bounds.min.x + move, newBounds.max.x - minSize); break;
        case 'x-max': newBounds.max.x = Math.max(bounds.max.x + move, newBounds.min.x + minSize); break;
        case 'y-min': newBounds.min.y = Math.min(bounds.min.y + move, newBounds.max.y - minSize); break;
        case 'y-max': newBounds.max.y = Math.max(bounds.max.y + move, newBounds.min.y + minSize); break;
        case 'z-min': newBounds.min.z = Math.min(bounds.min.z + move, newBounds.max.z - minSize); break;
        case 'z-max': newBounds.max.z = Math.max(bounds.max.z + move, newBounds.min.z + minSize); break;
      }

      setBounds(newBounds);
      console.log('[SectionBox] handlePointerMove → bounds actualizados:', newBounds.min, newBounds.max);

      // Aplicamos el clipping en tiempo real mientras arrastras
      applyClippingPlanes(newBounds);
    }
  };

  // 8) Finalizar arrastre (pointerUp): aquí es donde SÍ aplicamos verdaderamente el clipping
  const handlePointerUp = (_event: MouseEvent) => {
    if (isDragging && bounds) {
      applyClippingPlanes(bounds);
      console.log('[SectionBox] pointerUp → clipping definitivo');
      onDragStateChange?.(false);
    }
    if (captureTarget.current) {
      (captureTarget.current as HTMLElement | null)?.releasePointerCapture?.(_event.pointerId);
      captureTarget.current = null;
    }
    setIsDragging(false);
    setDragFace(null);
  };

  // 9) Registrar listeners globales mientras isDragging = true
  useEffect(() => {
    if (isDragging) {
      const canvas = gl.domElement;
      canvas.style.cursor = 'grabbing';
      canvas.addEventListener('pointermove', handlePointerMove);
      canvas.addEventListener('pointerup', handlePointerUp);
      return () => {
        canvas.removeEventListener('pointermove', handlePointerMove);
        canvas.removeEventListener('pointerup', handlePointerUp);
        canvas.style.cursor = 'default';
      };
    }
  }, [isDragging, dragFace]);

  // 10) Si se desactiva el tool (isActive=false), borramos todo
  useEffect(() => {
    if (!isActive) {
      removeClippingPlanes();
      setBounds(null);
      console.log('[SectionBox] Sección desactivada → reseteando bounds');
    }
  }, [isActive]);

  // No renderizamos nada si no tenemos bounds o sección inactiva
  if (!bounds || !isActive || !targetObject || targetObject.type === 'Scene') {
    return null;
  }

  // Centro y tamaño de la caja, utilizado para situar la geometría
  const center = bounds.min.clone().lerp(bounds.max, 0.5);
  const size   = bounds.max.clone().sub(bounds.min);

  return (
    <group ref={boxRef}>
      {/* —————— 1) Caja en modo wireframe —————— */}
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

      {/* —————— 2) Caja semitransparente —————— */}
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

      {/* —————— 3) Conos de control (más pequeños) —————— */}
      {[
        { face: 'x-min', position: [bounds.min.x, center.y, center.z], rotation: [0, 0,  Math.PI / 2] },
        { face: 'x-max', position: [bounds.max.x, center.y, center.z], rotation: [0, 0, -Math.PI / 2] },
        { face: 'y-min', position: [center.x, bounds.min.y, center.z], rotation: [0, 0,  Math.PI    ] },
        { face: 'y-max', position: [center.x, bounds.max.y, center.z], rotation: [0, 0,  0          ] },
        { face: 'z-min', position: [center.x, center.y, bounds.min.z], rotation: [ Math.PI / 2, 0, 0  ] },
        { face: 'z-max', position: [center.x, center.y, bounds.max.z], rotation: [-Math.PI / 2, 0, 0  ] },
      ].map((handle) => {
        const isHoveredThis  = hoveredHandle === handle.face;
        const isDraggingThis = isDragging   && dragFace   === handle.face;
        return (
          <group
            key={handle.face}
            position={handle.position as [number, number, number]}
            rotation={handle.rotation as [number, number, number]}
            userData={{ isSectionBox: true }}
          >
            <mesh
              userData={{ isSectionBox: true }}
              onPointerDown={(e) => handlePointerDown(e, handle.face)}
              onPointerEnter={(e) => {
                e.stopPropagation();
                setHoveredHandle(handle.face);
                gl.domElement.style.cursor = 'grab';
              }}
              onPointerLeave={(e) => {
                e.stopPropagation();
                setHoveredHandle(null);
                if (!isDragging) gl.domElement.style.cursor = 'default';
              }}
            >
              {/* Conos aún más pequeños (radio=0.6, altura=1.2) */}
              <coneGeometry args={[0.6, 1.2, 12]} />
              <meshBasicMaterial
                color={isDraggingThis ? '#FF0000' : (isHoveredThis ? '#FFA500' : '#0066FF')}
                transparent
                opacity={0.9}
                depthTest={false}
              />
            </mesh>
          </group>
        );
      })}
    </group>
  );
};
