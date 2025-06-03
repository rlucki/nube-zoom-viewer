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
  // Estado local de los límites (bounds) de la caja
  const [bounds, setBounds] = useState<{ min: THREE.Vector3; max: THREE.Vector3 } | null>(null);
  // Estado para saber si estamos arrastrando alguno de los “handles”
  const [isDragging, setIsDragging] = useState(false);
  // Qué cara (handle) estamos arrastrando: 'x-min', 'x-max', 'y-min', etc.
  const [dragFace, setDragFace] = useState<string | null>(null);
  // Si el cursor está encima (hover) de algún handle, para cambiar color
  const [hoveredHandle, setHoveredHandle] = useState<string | null>(null);

  // Refs para mantener referencias a ciertos objetos Three.js
  const boxRef = useRef<THREE.Group>(null);
  const raycaster = useRef(new THREE.Raycaster());
  const dragPlane = useRef(new THREE.Plane());
  const intersection = useRef(new THREE.Vector3());
  const startPosition = useRef(new THREE.Vector3());

  // Necesitamos acceso a cámara y DOM del canvas
  const { camera, gl } = useThree();

  // —————————————————————————————————————————————————————————
  // 1) Marcar (una sola vez) todos los nodos como parte de la SectionBox
  //    para que cualquier selector externo (ObjectSelector) los ignore.
  // —————————————————————————————————————————————————————————
  useEffect(() => {
    if (boxRef.current) {
      boxRef.current.traverse((child) => {
        (child as any).userData.isSectionBox = true;
      });
      // También marcamos la caja en sí
      (boxRef.current as any).userData.isSectionBox = true;
    }
  }, []);

  // —————————————————————————————————————————————————————————
  // 2) Cuando targetObject o isActive cambian, recalculamos la caja envolvente
  // —————————————————————————————————————————————————————————
  useEffect(() => {
    if (targetObject && isActive && targetObject.type !== 'Scene') {
      const box3 = new THREE.Box3().setFromObject(targetObject);

      if (!box3.isEmpty()) {
        // Le damos un pequeño “margen” del 10% para no hacer clipping justo en la piel
        const size = box3.getSize(new THREE.Vector3());
        const expansion = Math.max(size.x, size.y, size.z) * 0.1;
        box3.expandByScalar(expansion);

        setBounds({
          min: box3.min.clone(),
          max: box3.max.clone(),
        });
      } else {
        // Si el objeto no tenía geometría (box vacío),
        // ponemos unos límites ficticios de ±10m alrededor de su posición
        const center = new THREE.Vector3();
        targetObject.getWorldPosition(center);
        setBounds({
          min: new THREE.Vector3(center.x - 10, center.y - 10, center.z - 10),
          max: new THREE.Vector3(center.x + 10, center.y + 10, center.z + 10),
        });
      }
      console.log('[SectionBox] Bounds iniciales:', box3.min, box3.max);
    } else {
      // Si desactivamos la sección o no hay objeto, ocultamos la caja
      setBounds(null);
    }
  }, [targetObject, isActive]);

  // —————————————————————————————————————————————————————————
  // 3) Cada vez que cambian los bounds, aplicamos los clipping planes
  // —————————————————————————————————————————————————————————
  useEffect(() => {
    if (bounds && targetObject && isActive && targetObject.type !== 'Scene') {
      // Definimos los 6 planos que “recortan” fuera de [min..max]
      const clippingPlanes = [
        new THREE.Plane(new THREE.Vector3(-1, 0, 0), bounds.max.x),
        new THREE.Plane(new THREE.Vector3(1, 0, 0), -bounds.min.x),
        new THREE.Plane(new THREE.Vector3(0, -1, 0), bounds.max.y),
        new THREE.Plane(new THREE.Vector3(0, 1, 0), -bounds.min.y),
        new THREE.Plane(new THREE.Vector3(0, 0, -1), bounds.max.z),
        new THREE.Plane(new THREE.Vector3(0, 0, 1), -bounds.min.z),
      ];

      // Recorremos recursivamente el objeto y todos sus hijos Mesh/Points
      targetObject.traverse((child) => {
        if (child instanceof THREE.Mesh && child.material) {
          const mats = Array.isArray(child.material) ? child.material : [child.material];
          mats.forEach((mat) => {
            mat.clippingPlanes = clippingPlanes;
            mat.needsUpdate = true;
          });
        } else if (child instanceof THREE.Points && child.material) {
          (child.material as THREE.PointsMaterial).clippingPlanes = clippingPlanes;
          (child.material as THREE.PointsMaterial).needsUpdate = true;
        }
      });

      console.log('[SectionBox] Clipping aplicado. Bounds:', bounds.min, bounds.max);
      onSectionChange?.(bounds);
    } else if (targetObject && (!isActive || !bounds)) {
      // Si desactivamos la sección, limpiamos los clippingPlanes
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
      console.log('[SectionBox] Clipping removido (sección inactiva).');
    }
  }, [bounds, targetObject, isActive, onSectionChange]);

  // —————————————————————————————————————————————————————————
  // 4) Cuando se pulsa sobre uno de los conos: iniciamos el arrastre
  // —————————————————————————————————————————————————————————
  const handlePointerDown = (event: React.PointerEvent, face: string) => {
    if (!bounds) return;
    event.stopPropagation();         // ¡IMPRESCINDIBLE! que ningún otro listener “cace” este evento
    event.nativeEvent.stopImmediatePropagation();

    // Indicamos que arrancamos el “drag”
    setIsDragging(true);
    setDragFace(face);
    onDragStateChange?.(true);

    // Definimos un plano de arrastre según la cara que hemos clicado,
    // para que el ratón solo influya en esa coordenada concreta:
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

    // Calculamos la posición inicial del ratón sobre ese plano
    const rect = gl.domElement.getBoundingClientRect();
    const mouse = new THREE.Vector2(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1
    );
    raycaster.current.setFromCamera(mouse, camera);
    raycaster.current.ray.intersectPlane(dragPlane.current, startPosition.current);

    console.log('[SectionBox] pointerDown en cara:', face, 'startPosition:', startPosition.current);
  };

  // —————————————————————————————————————————————————————————
  // 5) Cada vez que movemos el ratón mientras arrastramos
  // —————————————————————————————————————————————————————————
  const handlePointerMove = (event: MouseEvent) => {
    if (!isDragging || !dragFace || !bounds) return;

    const rect = gl.domElement.getBoundingClientRect();
    const mouse = new THREE.Vector2(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1
    );
    raycaster.current.setFromCamera(mouse, camera);

    // Si intersecta el plano de arrastre, obtenemos delta
    if (raycaster.current.ray.intersectPlane(dragPlane.current, intersection.current)) {
      const delta = intersection.current.clone().sub(startPosition.current);
      const newBounds = {
        min: bounds.min.clone(),
        max: bounds.max.clone(),
      };
      const minSize = 0.1; // tamaño mínimo para no “colapsar” la caja

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
      console.log('[SectionBox] handlePointerMove, nuevo bounds:', newBounds.min, newBounds.max);
    }
  };

  // —————————————————————————————————————————————————————————
  // 6) Cuando soltamos el ratón, finalizamos el arrastre
  // —————————————————————————————————————————————————————————
  const handlePointerUp = (event: MouseEvent) => {
    if (isDragging) {
      setIsDragging(false);
      onDragStateChange?.(false);
      console.log('[SectionBox] pointerUp — arrastre finalizado.');
    }
    setDragFace(null);
  };

  // —————————————————————————————————————————————————————————
  // 7) Registramos / Eliminamos listeners globales mientras arrastramos
  // —————————————————————————————————————————————————————————
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

  // Si no hay bounds o sección inactiva, no renderizamos nada
  if (!bounds || !isActive || !targetObject || targetObject.type === 'Scene') {
    return null;
  }

  // Centro y tamaño de la caja, para situar correctamente la geometría
  const center = bounds.min.clone().lerp(bounds.max, 0.5);
  const size   = bounds.max.clone().sub(bounds.min);

  return (
    <group ref={boxRef}>
      {/* —————— 1) Caja wireframe azul claro —————— */}
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

      {/* —————— 2) Caras semitransparentes —————— */}
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

      {/* —————— 3) Conos de control (handles) —————— */}
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
              {/* Detalle: hacemos los conos MÁS PEQUEÑOS (radio=1, altura=2) */}
              <coneGeometry args={[1, 2, 16]} />
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
