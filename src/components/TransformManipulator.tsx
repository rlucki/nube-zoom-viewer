
import React, { useEffect, useRef, useMemo } from 'react';
import { TransformControls } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { TransformControls as TransformControlsImpl } from 'three-stdlib';

interface TransformManipulatorProps {
  object: THREE.Object3D | null;
  isActive: boolean;
  mode: 'translate' | 'rotate';
  onDraggingChange?: (dragging: boolean) => void;
}

/**
 * Sube por el scene graph hasta encontrar el grupo raíz del modelo,
 * es decir el hijo directo de la Scene de R3F.
 */
const findModelRoot = (obj: THREE.Object3D, scene: THREE.Scene): THREE.Object3D => {
  let current = obj;
  while (current.parent && current.parent !== scene) {
    current = current.parent;
  }
  // Si current.parent es la scene, current es hijo directo → raíz del modelo
  // Si current.parent es null, devolvemos el objeto original
  return current.parent === scene ? current : obj;
};

export const TransformManipulator: React.FC<TransformManipulatorProps> = ({
  object,
  isActive,
  mode,
  onDraggingChange,
}) => {
  const controlsRef = useRef<TransformControlsImpl>(null);
  const { gl, scene } = useThree();

  const target = useMemo(() => {
    if (!object) return null;
    return findModelRoot(object, scene);
  }, [object, scene]);

  // Adjuntar / desadjuntar TransformControls
  useEffect(() => {
    const controls = controlsRef.current as any;
    if (!controls) return;

    if (!isActive || !target) {
      controls.detach();
      gl.domElement.style.cursor = 'default';
      return;
    }

    console.log('TransformManipulator: attach', target.name || target.type, 'parent:', target.parent?.type);

    target.matrixAutoUpdate = true;
    controls.attach(target);
    controls.setMode(mode);
    controls.setSpace('world');

    // Tamaño del gizmo proporcional al modelo
    const box = new THREE.Box3().setFromObject(target);
    const diag = box.isEmpty() ? 10 : box.getSize(new THREE.Vector3()).length();
    controls.setSize(THREE.MathUtils.clamp(diag * 0.15, 1.5, 25.0));

    if (mode === 'translate') {
      controls.setTranslationSnap(null);
      controls.setRotationSnap(null);
    } else {
      controls.setTranslationSnap(null);
      controls.setRotationSnap(THREE.MathUtils.degToRad(5));
    }

    gl.domElement.style.cursor = 'grab';

    return () => {
      controls.detach();
      gl.domElement.style.cursor = 'default';
    };
  }, [target, isActive, mode, gl]);

  // Eventos de arrastre
  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls || !isActive) return;

    const onDraggingChanged = (event: any) => {
      const dragging = event.value as boolean;
      onDraggingChange?.(dragging);
      gl.domElement.style.cursor = dragging ? 'grabbing' : 'grab';
      if (!dragging) {
        const obj = (controls as any).object as THREE.Object3D | null;
        obj?.updateMatrixWorld(true);
      }
    };

    controls.addEventListener('dragging-changed', onDraggingChanged);
    return () => {
      controls.removeEventListener('dragging-changed', onDraggingChanged);
    };
  }, [onDraggingChange, isActive, gl]);

  // Cleanup al desactivar
  useEffect(() => {
    if (!isActive) {
      onDraggingChange?.(false);
      gl.domElement.style.cursor = 'default';
    }
  }, [isActive, onDraggingChange, gl]);

  if (!isActive || !target) return null;

  return (
    <TransformControls
      ref={controlsRef}
      mode={mode}
      size={2.0}
      showX
      showY
      showZ
      space="world"
    />
  );
};
