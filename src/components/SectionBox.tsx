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
  const dragPlane = useRef(new THREE.Plane());
  const intersection = useRef(new THREE.Vector3());
  const startPosition = useRef(new THREE.Vector3());

  const { camera, gl } = useThree();

  // 1) Marcamos todos los nodos del SectionBox con userData.isSectionBox → true
  useEffect(() => {
    if (boxRef.current) {
      boxRef.current.traverse((child) => {
        (child as any).userData.isSectionBox = true;
      });
      (boxRef.current as any).userData.isSectionBox = true;
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

  // 3) Función para crear y aplicar clipping planes
  const applyClippingPlanes = (newBounds: { min: THREE.Vector3; max: THREE.Vector3 }) => {
    if (!targetObject) return;

    // Seis planos (uno para cada cara del box)
    const planes = [
      new THREE.Plane(new THREE.Vector3(-1, 0, 0), newBounds.max.x),
      new THREE.Plane(new THREE.Vector3(1, 0, 0), -newBounds.min.x),
      new THREE.Plane(new THREE.Vector3(0, -1, 0), newBounds.max.y),
      new THREE.Plane(new THREE.Vector3(0, 1, 0), -newBounds.min.y),
      new THREE.Plane(new THREE.Vector3(0, 0, -1), newBounds.max.z),
      new THREE.Plane(new THREE.Vector3(0, 0, 1), -newBounds.min.z),
    ];

    // Recorremos la jerarquía de targetObject y le asignamos planes a todos los materiales
    targetObject.traverse((child) => {
      if (child instanceof THREE.Mesh && child.material) {
        const mats = Array.isArray(child.material) ? child.material : [child.material];
        mats.forEach((mat) => {
          mat.clippingPlanes = planes;
          mat.needsUpdate = true;
        });
      } else if (child instanceof THREE.Points && child.material) {
        (child.material as THREE.PointsMaterial).clippingPlanes = planes;
        (child.material as THREE.PointsMaterial).needsUpdate = true;
      }
    });

    console.log('[SectionBox] Clipping aplicado:', newBounds.min, newBounds.max);
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

  // 5) Cada vez que cambian bounds, si NO estamos arrastrando ni se acaba de soltar, NO hacemos nada extra.
  //    Cuando se desactiva la sección, limpiamos.
  useEffect(() => {
    if (!isActive || !bounds) {
      removeClippingPlanes();
    }
  }, [bounds, isActive]);

  // 6) Iniciar arrastre (pointerDown sobre un cono)
  const handlePointerDown = (event: React.PointerEvent, face: string) => {
    if (!bounds) return;
    event.stopPropagation();
    event.nativeEvent.stopImmediatePropagation();

    setIsDragging(true);
    setDragFace(face);
    onDragStateChange?.(true);
    console.log('[SectionBox] pointerDown en cara:', face);

    // Definimos normal y punto del plano según la cara
    const normal = new THREE.Vector3();
    const point  = new THREE.Vector3();
    switch (face) {
      case 'x-min':
        normal.set(1, 0, 0);
        point.set(bounds.min.x, 0, 0);
        break;
      case 'x-max':
        normal.set(1, 0, 0);
        point.set(bounds.max.x, 0, 0);
        break;
      case 'y-min':
        normal.set(0, 1, 0);
        point.set(0, bounds.min.y, 0);
        break;
      case 'y-max':
        normal.set(0, 1, 0);
        point.set(0, bounds.max.y, 0);
        break;
      case 'z-min':
        normal.set(0, 0, 1);
        point.set(0, 0, bounds.min.z);
        break;
      case 'z-max':
        normal.set(0, 0, 1);
        point.set(0, 0, bounds.max.z);
        break;
    }

    dragPlane.current.setFromNormalAndCoplanarPoint(normal, point);

    // Calculamos la intersección inicial del ratón con el plano
    const rect = gl.domElement.getBoundingClientRect();
    const mouse = new THREE.Vector2(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1
    );
    raycaster.current.setFromCamera(mouse, camera);
    raycaster.current.ray.intersectPlane(dragPlane.current, startPosition.current);
    console.log('[SectionBox] startPosition del arrastre:', startPosition.current);
  };

  // 7) Durante el arrastre (pointerMove), sólo actualizamos “bounds”.
  const handlePointerMove = (event: MouseEvent) => {
    if (!isDragging || !dragFace || !bounds) return;

    const rect = gl.domElement.getBoundingClientRect();
    const mouse = new THREE.Vector2(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1
    );
    raycaster.current.setFromCamera(mouse, camera);

    if (raycaster.current.ray.intersectPlane(dragPlane.current, intersection.current)) {
      const delta = intersection.current.clone().sub(startPosition.current);
      const newBounds = {
        min: bounds.min.clone(),
        max: bounds.max.clone(),
      };
      const minSize = 0.1; // Evitar que la caja desaparezca completamente

      switch (dragFace) {
        case 'x-min':
          newBounds.min.x = Math.min(bounds.min.x + delta.x, newBounds.max.x - minSize);
          break;
        case 'x-max':
          newBounds.max.x = Math.max(bounds.max.x + delta.x, newBounds.min.x + minSize);
          break;
        case 'y-min':
          newBounds.min.y = Math.min(bounds.min.y + delta.y, newBounds.max.y - minSize);
          break;
        case 'y-max':
          newBounds.max.y = Math.max(bounds.max.y + delta.y, newBounds.min.y + minSize);
          break;
        case 'z-min':
          newBounds.min.z = Math.min(bounds.min.z + delta.z, newBounds.max.z - minSize);
          break;
        case 'z-max':
          newBounds.max.z = Math.max(bounds.max.z + delta.z, newBounds.min.z + minSize);
          break;
      }

      setBounds(newBounds);
      console.log('[SectionBox] handlePointerMove → bounds actualizados:', newBounds.min, newBounds.max);

      // — Opcional: si quieres ver el corte en tiempo real mientras arrastras,
      //   descomenta esta línea (ten en cuenta que puede afectar el rendimiento):
      // applyClippingPlanes(newBounds);
    }
  };

  // 8) Finalizar arrastre (pointerUp): aquí es donde SÍ aplicamos verdaderamente el clipping
  const handlePointerUp = (_event: MouseEvent) => {
    if (isDragging && bounds) {
      applyClippingPlanes(bounds);
      console.log('[SectionBox] pointerUp → clipping definitivo');
      onDragStateChange?.(false);
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
  }, [isDragging, dragFace, bounds]);

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
