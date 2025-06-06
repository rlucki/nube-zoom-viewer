import React, { useState, useRef, useEffect } from 'react';
import * as THREE from 'three';
import { useThree, ThreeEvent } from '@react-three/fiber';

interface SectionBoxProps {
  isActive: boolean;
  onDragStateChange?: (isDragging: boolean) => void;
}

/**
 * SectionBox — Opción 2 (metros‑por‑píxel) ✅
 * Ahora los cambios se conservan al soltar el ratón gracias a
 * la actualización funcional de `setBounds`.
 */
export const SectionBox: React.FC<SectionBoxProps> = ({ isActive, onDragStateChange }) => {
  /* ------------------------------ state ----------------------------- */
  const [bounds, setBounds] = useState<{ min: THREE.Vector3; max: THREE.Vector3 } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragHandle, setDragHandle] = useState<string | null>(null);
  const [dragAxis, setDragAxis] = useState<'x' | 'y' | 'z' | null>(null);
  const [userModified, setUserModified] = useState(false);

  /* ------------------------------ refs ------------------------------ */
  const boxRef = useRef<THREE.Group>(null);
  const { camera, gl, scene } = useThree();

  /* --------------------------- bounds init -------------------------- */
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
        globalBox.expandByScalar(Math.max(size.x, size.y, size.z) * 0.05);
        setBounds({ min: globalBox.min.clone(), max: globalBox.max.clone() });
      } else {
        setBounds({ min: new THREE.Vector3(-10, -10, -10), max: new THREE.Vector3(10, 10, 10) });
      }
    }
  }, [isActive, scene, userModified, bounds]);

  /* ---------------------------- clipping ---------------------------- */
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
          (Array.isArray(child.material) ? child.material : [child.material]).forEach((m) => {
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
        (Array.isArray(child.material) ? child.material : [child.material]).forEach((m) => {
          m.clippingPlanes = [];
          m.needsUpdate = true;
        });
      }
    });
  };
  useEffect(() => {
    (isActive && bounds) ? applyClipping(bounds) : removeClipping();
  }, [isActive, bounds]);

  /* --------------------------- deactivate --------------------------- */
  useEffect(() => {
    if (!isActive) {
      removeClipping();
      setBounds(null);
      setUserModified(false);
    }
  }, [isActive]);

  /* ----------------------- mark section‑box ------------------------- */
  useEffect(() => {
    boxRef.current?.traverse((c) => (c.userData.isSectionBox = true));
  }, [bounds]);

  /* -------------------- pointer down / move / up ------------------- */
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
    if (!isDragging || !dragHandle || !dragAxis) return;

    setBounds((prev) => {
      if (!prev) return prev;

      /* cuánto mundo por píxel */
      const rect = gl.domElement.getBoundingClientRect();
      const center = prev.min.clone().lerp(prev.max, 0.5);
      const dist = camera.position.distanceTo(center);
      const wpp = (2 * Math.tan(THREE.MathUtils.degToRad((camera as THREE.PerspectiveCamera).fov) / 2) * dist) / rect.height;

      /* delta píxel → mundo */
      let deltaPx = 0;
      if (dragAxis === 'x') deltaPx = e.movementX;
      else if (dragAxis === 'y') deltaPx = -e.movementY;
      else deltaPx = e.movementY;
      if (deltaPx === 0) return prev;

      const scale = e.shiftKey ? 0.1 : 1;
      let delta = deltaPx * wpp * scale;

      const step = 0.05;
      delta = Math.round(delta / step) * step;
      if (delta === 0) return prev;

      const nb = { min: prev.min.clone(), max: prev.max.clone() };
      const minSize = 0.1;
      if (dragHandle.endsWith('min')) nb.min[dragAxis] = Math.min(nb.min[dragAxis] + delta, nb.max[dragAxis] - minSize);
      else nb.max[dragAxis] = Math.max(nb.max[dragAxis] + delta, nb.min[dragAxis] + minSize);
      return nb;
    });
    setUserModified(true);
  };

  const handlePointerUp = () => {
    setIsDragging(false);
    setDragHandle(null);
    setDragAxis(null);
    onDragStateChange?.(false);
    gl.domElement.style.cursor = 'default';
  };

  /* ----------------------- global listeners ------------------------ */
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
  }, [isDragging, dragHandle, dragAxis]);

  /* --------------------------- render ------------------------------ */
  if (!bounds || !isActive) return null;
  const center = bounds.min.clone().lerp(bounds.max, 0.5);
  const size = bounds.max.clone().sub(bounds.min);

  return (
    <group ref={boxRef}>
      {/* Wireframe */}
      <mesh position={center} userData={{ isSectionBox: true }}>
        <boxGeometry args
