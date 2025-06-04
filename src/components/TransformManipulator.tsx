import React, { useEffect, useRef } from 'react';
import { TransformControls } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';

interface TransformManipulatorProps {
  object: THREE.Object3D | null;
  isActive: boolean;
  mode: 'translate' | 'rotate';
  onDraggingChange?: (dragging: boolean) => void;
  onDistanceChange?: (distance: number | null) => void;
}

export const TransformManipulator: React.FC<TransformManipulatorProps> = ({
  object,
  isActive,
  mode,
  onDraggingChange,
  onDistanceChange,
}) => {
  const controlsRef = useRef<any>(null);
  const { camera, gl } = useThree();
  const startPos = useRef<THREE.Vector3 | null>(null);

  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls) return;
    const onDragChange = (e: { value: boolean }) => {
      onDraggingChange?.(e.value);
      if (e.value) {
        startPos.current = object ? object.position.clone() : null;
        onDistanceChange?.(0);
      } else {
        startPos.current = null;
        onDistanceChange?.(null);
      }
    };

    const onObjectChange = () => {
      if (object && startPos.current) {
        const dist = object.position.distanceTo(startPos.current);
        onDistanceChange?.(dist);
      }
    };

    controls.addEventListener('dragging-changed', onDragChange);
    controls.addEventListener('objectChange', onObjectChange);
    return () => {
      controls.removeEventListener('dragging-changed', onDragChange);
      controls.removeEventListener('objectChange', onObjectChange);
    };
  }, [onDraggingChange, onDistanceChange, object]);

  if (!object || !isActive) return null;

  return (
    <TransformControls
      ref={controlsRef}
      object={object}
      mode={mode}
      camera={camera}
      domElement={gl.domElement}
    />
  );
};
