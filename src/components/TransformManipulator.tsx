
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

    const handleDraggingChange = (event: any) => {
      onDraggingChange?.(event.value);
    };

    controls.addEventListener('dragging-changed', handleDraggingChange);
    
    return () => {
      controls.removeEventListener('dragging-changed', handleDraggingChange);
    };
  }, [onDraggingChange]);

  // Asegurar que el objeto esté correctamente vinculado
  useEffect(() => {
    const controls = controlsRef.current;
    if (controls && object) {
      controls.attach(object);
    }
  }, [object]);

  if (!object || !isActive) return null;

  return (
    <TransformControls
      ref={controlsRef}
      object={object}
      mode={mode}
      camera={camera}
      domElement={gl.domElement}
      size={1}
      showX={true}
      showY={true}
      showZ={true}
      space="world"
    />
  );
};
