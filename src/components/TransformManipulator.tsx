
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

    const handleDraggingChanged = (event: any) => {
      console.log('Transform dragging changed:', event.value);
      onDraggingChange?.(event.value);
    };

    const handleObjectChange = () => {
      console.log('Transform object changed');
    };

    controls.addEventListener('dragging-changed', handleDraggingChanged);
    controls.addEventListener('objectChange', handleObjectChange);
    
    return () => {
      controls.removeEventListener('dragging-changed', handleDraggingChanged);
      controls.removeEventListener('objectChange', handleObjectChange);
    };
  }, [onDraggingChange]);

  // Vincular objeto correctamente
  useEffect(() => {
    const controls = controlsRef.current;
    if (controls && object && isActive) {
      console.log('Attaching object to transform controls:', object);
      try {
        controls.attach(object);
      } catch (error) {
        console.error('Error attaching object:', error);
      }
    } else if (controls) {
      controls.detach();
    }
  }, [object, isActive]);

  // Configurar controles cuando se active/desactive
  useEffect(() => {
    const controls = controlsRef.current;
    if (controls) {
      controls.enabled = isActive && !!object;
      controls.visible = isActive && !!object;
    }
  }, [isActive, object]);

  if (!isActive || !object) return null;

  return (
    <TransformControls
      ref={controlsRef}
      mode={mode}
      camera={camera}
      domElement={gl.domElement}
      size={1}
      showX={true}
      showY={true}
      showZ={true}
      space="world"
      translationSnap={0.1}
      rotationSnap={THREE.MathUtils.degToRad(15)}
      scaleSnap={0.1}
    />
  );
};
