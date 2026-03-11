
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
 * Sube por el scene graph hasta encontrar el grupo raíz del modelo
 * (el primer Group hijo directo de la Scene o del root de R3F).
 */
const findModelRoot = (obj: THREE.Object3D): THREE.Object3D => {
  let current = obj;
  while (current.parent && current.parent.type !== 'Scene') {
    // Si el padre directo es la Scene, current ya es la raíz del modelo
    current = current.parent;
  }
  return current;
};

export const TransformManipulator: React.FC<TransformManipulatorProps> = ({
  object,
  isActive,
  mode,
  onDraggingChange,
}) => {
  const controlsRef = useRef<TransformControlsImpl>(null);
  const { gl } = useThree();

  // Calcular el target una sola vez cuando cambia el objeto
  const target = useMemo(() => {
    if (!object) return null;
    return findModelRoot(object);
  }, [object]);

  // Adjuntar / desadjuntar TransformControls
  useEffect(() => {
    const controls = controlsRef.current as any;
    if (!controls) return;

    if (!isActive || !target) {
      controls.detach();
      gl.domElement.style.cursor = 'default';
      return;
    }

    // Verificar que el target pertenece al scene graph
    let inScene = false;
    let node: THREE.Object3D | null = target;
    while (node) {
      if (node.type === 'Scene') { inScene = true; break; }
      node = node.parent;
    }
    if (!inScene) {
      console.warn('TransformManipulator: target no está en el scene graph, omitiendo attach');
      return;
    }

    console.log('TransformManipulator: attach', target.name || target.type, target.uuid.slice(0, 8));

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
