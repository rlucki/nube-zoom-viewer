import React, { useState, useRef, useEffect } from 'react';
import * as THREE from 'three';
import { useThree, ThreeEvent } from '@react-three/fiber';

interface SectionBoxProps {
  isActive: boolean;
  onDragStateChange?: (isDragging: boolean) => void;
}

/**
 * Herramienta de seccionado con movimiento incremental y modo "fino" (⇧‑Shift).
 */
export const SectionBox: React.FC<SectionBoxProps> = ({ isActive, onDragStateChange }) => {
  const [bounds, setBounds] = useState<{ min: THREE.Vector3; max: THREE.Vector3 } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragHandle, setDragHandle] = useState<string | null>(null);
  const [dragStart, setDragStart] = useState<THREE.Vector3 | null>(null);
  const [dragAxis, setDragAxis] = useState<'x' | 'y' | 'z' | null>(null);
  const [speed, setSpeed] = useState(1); // 1 normal, 0.1 con ⇧
  const [userModified, setUserModified] = useState(false);

  const boxRef = useRef<THREE.Group>(null);
  const { camera, gl, scene } = useThree();
  const raycaster = useRef(new THREE.Raycaster());

  /* ----------------------------------------------------------- */
  /*  Calcular bounds iniciales                                  */
  /* ----------------------------------------------------------- */
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
            const box = new THREE.Box3().setFromObject(child);
            if (!box.isEmpty()) {
              globalBox.union(box);
              hasObjects = true;
            }
          }

          if (child instanceof THREE.Points && child.geometry.boundingBox) {
            const box = child.geometry.boundingBox.clone();
            box.applyMatrix4(child.matrixWorld);
            if (!box.isEmpty()) {
              globalBox.union(box);
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
        // fallback genérico
        setBounds({
          min: new THREE.Vector3(-10, -10, -10),
          max: new THREE.Vector3(10, 10, 10),
        });
      }
    }
  }, [isActive, scene, userModified, bounds]);

  /* ----------------------------------------------------------- */
  /*  Clipping                                                   */
  /* ----------------------------------------------------------- */
  const applyClipping = (newBounds: { min: THREE.Vector3; max: THREE.Vector3 }) => {
    const planes = [
      new THREE.Plane(new THREE.Vector3(1, 0, 0), -newBounds.min.x),
      new THREE.Plane(new THREE.Vector3(-1, 0, 0), newBounds.max.x),
      new THREE.Plane(new THREE.Vector3(0, 1, 0), -newBounds.min.y),
      new THREE.Plane(new THREE.Vector3(0, -1, 0), newBounds.max.y),
      new THREE.Plane(new THREE.Vector3(0, 0, 1), -newBounds.min.z),
      new THREE.Plane(new THREE.Vector3(0, 0, -1), newBounds.max.z),
    ];

    scene.traverse((child) => {
      if (
        (child instanceof THREE.Mesh || child instanceof THREE.Points) &&
        !child.userData.isSectionBox &&
        !child.userData.isUI &&
        !child.name.includes('helper') &&
        !child.name.includes('grid')
      ) {
        if (child instanceof THREE.Mesh && child.material) {
          const materials = Array.isArray(child.material) ? child.material : [child.material];
          materials.forEach((m) => {
            m.clippingPlanes = planes;
            m.clipShadows = true;
            m.needsUpdate = true;
          });
        }

        if (child instanceof THREE.Points && child.material) {
          child.material.clippingPlanes = planes;
          child.material.clipShadows = true;
          child.material.needsUpdate = true;
        }
      }
    });
  };

  const removeClipping = () => {
    scene.traverse((child) => {
      if ((child instanceof THREE.Mesh || child instanceof THREE.Points) && !child.userData.isSectionBox) {
        if (child instanceof THREE.Mesh && child.material) {
          const materials = Array.isArray(child.material) ? child.material : [child.material];
          materials.forEach((m) => {
            m.clippingPlanes = [];
            m.needsUpdate = true;
          });
        }
        if (child instanceof THREE.Points && child.material) {
          child.material.clippingPlanes = [];
          child.material.needsUpdate = true;
        }
      }
    });
  };

  useEffect(() => {
    if (isActive && bounds) {
      applyClipping(bounds);
    } else {
      removeClipping();
    }
  }, [bounds, isActive, scene]);

  /* ----------------------------------------------------------- */
  /*  Limpieza al desactivar                                     */
  /* ----------------------------------------------------------- */
  useEffect(() => {
    if (!isActive) {
      removeClipping();
      setBounds(null);
      setUserModified(false);
    }
  }, [isActive]);

  /* ----------------------------------------------------------- */
  /*  Marca visual del section‑box                               */
  /* ----------------------------------------------------------- */
  useEffect(() => {
    if (boxRef.current) {
      boxRef.current.traverse((child) => (child.userData.isSectionBox = true));
    }
  }, [bounds]);

  /* ----------------------------------------------------------- */
  /*  Pointer‑handlers                                           */
  /* ----------------------------------------------------------- */
  const handlePointerDown = (event: ThreeEvent<PointerEvent>, handle: string) => {
    if (!bounds) return;

    event.stopPropagation();
    setIsDragging(true);
    setDragHandle(handle);
    onDragStateChange?.(true);

    const rect = gl.domElement.getBoundingClientRect();
    const mouse = new THREE.Vector2(
      ((event.nativeEvent.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.nativeEvent.clientY - rect.top) / rect.height) * 2 + 1,
    );
    raycaster.current.setFromCamera(mouse, camera);

    // plano de arrastre según el eje del asa
    const center = bounds.min.clone().lerp(bounds.max, 0.5);
    const axis = handle.charAt(0) as 'x' | 'y' | 'z';
    let planeNormal = new THREE.Vector3();
    if (axis === 'x') planeNormal.set(1, 0, 0);
    if (axis === 'y') planeNormal.set(0, 1, 0);
    if (axis === 'z') planeNormal.set(0, 0, 1);
    const dragPlane = new THREE.Plane().setFromNormalAndCoplanarPoint(planeNormal, center);

    const hit = new THREE.Vector3();
    if (raycaster.current.ray.intersectPlane(dragPlane, hit)) {
      setDragStart(hit.clone());
    }

    setDragAxis(axis);
    setSpeed(event.nativeEvent.shiftKey ? 0.1 : 1);
    gl.domElement.style.cursor = 'grabbing';
  };

  const handlePointerMove = (event: MouseEvent) => {
    if (!isDragging || !dragHandle || !bounds || !dragStart || !dragAxis) return;

    const rect = gl.domElement.getBoundingClientRect();
    const mouse = new THREE.Vector2(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1,
    );
    raycaster.current.setFromCamera(mouse, camera);

    const center = bounds.min.clone().lerp(bounds.max, 0.5);
    let planeNormal = new THREE.Vector3();
    if (dragAxis === 'x') planeNormal.set(1, 0, 0);
    if (dragAxis === 'y') planeNormal.set(0, 1, 0);
    if (dragAxis === 'z') planeNormal.set(0, 0, 1);
    const dragPlane = new THREE.Plane().setFromNormalAndCoplanarPoint(planeNormal, center);

    const hit = new THREE.Vector3();
    if (!raycaster.current.ray.intersectPlane(dragPlane, hit)) return;

    // desplazamiento incremental en el eje
    let delta = (hit[dragAxis] - dragStart[dragAxis]) * speed;
    if (Math.abs(delta) < 1e-6) return; // evita ruido mínimo

    /* --- snapping opcional a pasos de 0.05u --- */
    const step = 0.05;
    delta = Math.round(delta / step) * step;

    const newBounds = {
      min: bounds.min.clone(),
      max: bounds.max.clone(),
    };

    const minSize = 0.1;
    if (dragHandle.endsWith('min')) {
      newBounds.min[dragAxis] = Math.min(newBounds.min[dragAxis] + delta, newBounds.max[dragAxis] - minSize);
    } else {
      newBounds.max[dragAxis] = Math.max(newBounds.max[dragAxis] + delta, newBounds.min[dragAxis] + minSize);
    }

    setBounds(newBounds);
    setUserModified(true);
    setDragStart(hit.clone()); // mueve el punto de referencia
  };

  const handlePointerUp = () => {
    setIsDragging(false);
    setDragHandle(null);
    setDragStart(null);
    setDragAxis(null);
    onDragStateChange?.(false);
    gl.domElement.style.cursor = 'default';
  };

  /* ----------------------------------------------------------- */
  /*  Listeners globales                                         */
  /* ----------------------------------------------------------- */
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
  }, [isDragging, dragHandle, bounds, dragStart, dragAxis, speed]);

  /* ----------------------------------------------------------- */
  /*  Render                                                     */
  /* ----------------------------------------------------------- */
  if (!bounds || !isActive) return null;

  const center = bounds.min.clone().lerp(bounds.max, 0.5);
  const size = bounds.max.clone().sub(bounds.min);

  return (
    <group ref={boxRef}>
      {/* Wireframe */}
      <mesh position={center} userData={{ isSectionBox: true }}>
        <boxGeometry args={[size.x, size.y, size.z]} />
        <meshBasicMaterial wireframe color="#00FFFF" transparent opacity={0.8} depthTest={false} />
      </mesh>

      {/* Caja semitransparente */}
      <mesh position={center} userData={{ isSectionBox: true }}>
        <boxGeometry args={[size.x, size.y, size.z]} />
        <meshBasicMaterial color="#00FFFF" transparent opacity={0.1} side={THREE.DoubleSide} depthTest={false} />
      </mesh>

      {/* Handles */}
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
          <sphereGeometry args={[0.3, 16, 16]} />
          <meshBasicMaterial color={item.color} transparent opacity={0.9} depthTest={false} />
        </mesh>
      ))}
    </group>
  );
};
