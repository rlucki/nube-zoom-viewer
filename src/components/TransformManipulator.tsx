import React, { useEffect, useRef } from 'react';
import { TransformControls } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';

interface TransformManipulatorProps {
  object: THREE.Object3D | null;
  isActive: boolean;
  mode: 'translate' | 'rotate';
  onDraggingChange?: (dragging: boolean) => void;
}

export const TransformManipulator: React.FC<TransformManipulatorProps> = ({
  object,
  isActive,
  mode,
  onDraggingChange,
}) => {
  const controlsRef = useRef<any>(null);
  const { camera, gl } = useThree();

  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls) return;
    const callback = (e: { value: boolean }) => {
      onDraggingChange?.(e.value);
    };
    controls.addEventListener('dragging-changed', callback);
    return () => {
      controls.removeEventListener('dragging-changed', callback);
    };
  }, [onDraggingChange]);

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
