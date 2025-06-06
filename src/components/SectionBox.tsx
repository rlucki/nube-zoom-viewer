import React, { useState, useRef, useEffect } from 'react';
import * as THREE from 'three';
import { useThree, ThreeEvent } from '@react-three/fiber';

interface SectionBoxProps {
  isActive: boolean;
  onDragStateChange?: (isDragging: boolean) => void;
}

/**
 * SectionBox — Versión “opción 2”
 *
 * Los handles se mueven en función de los píxeles desplazados
 * multiplicados por los “metros por píxel” en el plano de la caja.
 * Mantén ⇧-Shift para modo fino (×0.1).
 */
export const SectionBox: React.FC<SectionBoxProps> = ({ isActive, onDragStateChange }) => {
  /* ------------------------------------------------------------------ */
  /*  State                                                             */
  /* ------------------------------------------------------------------ */
  const [bounds, setBounds] = useState<{ min: THREE.Vector3; max: THREE.Vector3 } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragHandle, setDragHandle] = useState<string | null>(null);
  const [dragAxis, setDragAxis] = useState<'x' | 'y' | 'z' | null>(null);
  const [userModified, setUserModified] = useState(false);

  /* ------------------------------------------------------------------ */
  /*  Refs                                                               */
  /* ------------------------------------------------------------------ */
  const boxRef = useRef<THREE.Group>(null);
  const { camera, gl, scene } = useThree();

  /* ------------------------------------------------------------------ */
  /*  Bounds iniciales                                                   */
  /* ------------------------------------------------------------------ */
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
        setBounds({
          min: new THREE.Vector3(-10, -10, -10),
          max: new THREE.Vector3(10, 10, 10),
        });
      }
    }
  }, [isActive, scene, userModified, bounds]);

  /* ------------------------------------------------------------------ */
  /*  Clipping                                                          */
  /* ------------------------------------------------------------------ */
  const applyClipping = (b: { min: THREE.Vector3; max: THREE.Vector3 }) => {
    const planes = [
      new THREE.Plane(new THREE.Vector3(1, 0, 0), -b.min.x),
      new THREE.Plane(new THREE.Vector3(-1, 0, 0), b.max.x),
      new THREE.Plane(new THREE.Vector3(0, 1, 0), -b.min.y),
      new THREE.Plane(new THREE.Vector3(0, -1, 0), b.max.y),
      new THREE.Plane(new THREE.Vector3(0, 0, 1), -b.min.z),
      new THREE.Plane(new THREE.Vector3(0, 0, -1), b.max.z),
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
          const mats = Array.isArray(child.material) ? child.material : [child.material];
          mats.forEach((m) => {
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
        if (child.material) {
          const mats = Array.isArray(child.material) ? child.material : [child.material];
          mats.forEach((m) => {
            m.clippingPlanes = [];
            m.needsUpdate = true;
          });
        }
      }
    });
  };
  useEffect(() => {
    if (isActive && bounds) applyClipping(bounds);
    else removeClipping();
  }, [isActive, bounds]);

  /* ------------------------------------------------------------------ */
  /*  Limpieza al desactivar                                            */
  /* ------------------------------------------------------------------ */
  useEffect(() => {
    if (!isActive) {
      removeClipping();
      setBounds(null);
      setUserModified(false);
    }
  }, [isActive]);

  /* ------------------------------------------------------------------ */
  /*  Marcar hijos como section-box                                     */
  /* ------------------------------------------------------------------ */
  useEffect(() => {
    if (boxRef.current) boxRef.current.traverse((c) => (c.userData.isSectionBox = true));
  }, [bounds]);

  /* ------------------------------------------------------------------ */
  /*  Pointer handlers                                                  */
  /* ------------------------------------------------------------------ */
  const handlePointerDown = (e: ThreeEvent<PointerEvent>, handle: string) => {
    if (!bounds) return;
    e.stopPropagation();
    setIsDragging(true);
    setDragHandle(handle);
    setDragAxis(handle.charAt(0) as 'x' | 'y' | 'z');
    onDragStateChange?.(true);
    gl.domElement.style.cursor = 'grabbing';
  };

  const handlePointerMove = (e: PointerEvent) => {
    if (!isDragging || !bounds || !dragHandle || !dragAxis) return;

    /* ---- calcular metros por píxel (vertical) ---- */
    const rect = gl.domElement.getBoundingClientRect();
    const center = bounds.min.clone().lerp(bounds.max, 0.5);
    const distance = camera.position.distanceTo(center);
    const fovRad = THREE.MathUtils.degToRad((camera as THREE.PerspectiveCamera).fov);
    const worldPerPixel = (2 * Math.tan(fovRad / 2) * distance) / rect.height; // metros / pixel

    /* ---- delta en píxeles según eje ---- */
    let deltaPx = 0;
    if (dragAxis === 'x') deltaPx = e.movementX;
    else if (dragAxis === 'y') deltaPx = -e.movementY; // invertido: pantalla ↓, mundo -Y
    else if (dragAxis === 'z') deltaPx = e.movementY;  // aproximación

    if (deltaPx === 0) return;

    const speed = e.shiftKey ? 0.1 : 1; // modo fino
    let delta = deltaPx * worldPerPixel * speed;

    /* ---- snapping opcional ---- */
    const step = 0.05;
    delta = Math.round(delta / step) * step;
    if (delta === 0) return;

    /* ---- aplicar delta ---- */
    const newBounds = { min: bounds.min.clone(), max: bounds.max.clone() };
    const minSize = 0.1;
    if (dragHandle.endsWith('min')) {
      newBounds.min[dragAxis] = Math.min(newBounds.min[dragAxis] + delta, newBounds.max[dragAxis] - minSize);
    } else {
      newBounds.max[dragAxis] = Math.max(newBounds.max[dragAxis] + delta, newBounds.min[dragAxis] + minSize);
    }
    setBounds(newBounds);
    setUserModified(true);
  };

  const handlePointerUp = () => {
    setIsDragging(false);
    setDragHandle(null);
    setDragAxis(null);
    onDragStateChange?.(false);
    gl.domElement.style.cursor = 'default';
  };

  /* ------------------------------------------------------------------ */
  /*  Listeners globales                                                */
  /* ------------------------------------------------------------------ */
  useEffect(() => {
    if (isDragging) {
      const c = gl.domElement;
      c.addEventListener('pointermove', handlePointerMove);
      c.addEventListener('pointerup', handlePointerUp);
      return () => {
        c.removeEventListener('pointermove', handlePointerMove);
        c.removeEventListener('pointerup', handlePointerUp);
      };
    }
  }, [isDragging, bounds, dragHandle, dragAxis]);

  /* ------------------------------------------------------------------ */
  /*  Render                                                            */
  /* ------------------------------------------------------------------ */
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
      {/* Caja transparente */}
      <mesh position={center} userData={{ isSectionBox: true }}>
        <boxGeometry args={[size.x, size.y, size.z]} />
        <meshBasicMaterial color="#00FFFF" transparent opacity={0.1} side={THREE.DoubleSide} depthTest={false} />
      </mesh>
      {/* Handles */}
      {[
        { handle: 'x-min', pos: [bounds.min.x, center.y, center.z], color: '#ff0000' },
        { handle: 'x-max', pos: [bounds.max.x, center.y, center.z], color: '#ff0000' },
        { handle: 'y-min', pos: [center.x, bounds.min.y, center.z], color: '#00ff00' },
        { handle: 'y-max', pos: [center.x, bounds.max.y, center.z], color: '#00ff00' },
        { handle: 'z-min', pos: [center.x, center.y, bounds.min.z], color: '#0000ff' },
        { handle: 'z-max', pos: [center.x, center.y, bounds.max.z], color: '#0000ff' },
      ].map((h) => (
        <mesh
          key={h.handle}
          position={h.pos as [number, number, number]}
          userData={{ isSectionBox: true }}
          onPointerDown={(e) => handlePointerDown(e, h.handle)}
          onPointerEnter={() => (gl.domElement.style.cursor = 'grab')}          
          onPointerLeave={() => {
            if (!isDragging) gl.domElement.style.cursor = 'default';
          }}
        >
          <sphereGeometry args={[0.3, 16, 16]} />
          <meshBasicMaterial color={h.color} transparent opacity={0.9} depthTest={false} />
        </mesh>
      ))}
    </group>
  );
};