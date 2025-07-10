
import React, { useEffect, useRef, useState } from 'react';
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
  const [isDragging, setIsDragging] = useState(false);

  // Manejar eventos de arrastre
  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls) return;

    const handleDragStart = () => {
      console.log('Transform drag started');
      setIsDragging(true);
      onDraggingChange?.(true);
      gl.domElement.style.cursor = 'grabbing';
    };

    const handleDragEnd = () => {
      console.log('Transform drag ended');
      setIsDragging(false);
      onDraggingChange?.(false);
      gl.domElement.style.cursor = 'default';
      
      if (object) {
        object.updateMatrixWorld(true);
        console.log('Transform completed for object:', object.name || object.type);
      }
    };

    const handleObjectChange = () => {
      if (object && isDragging) {
        object.updateMatrixWorld(true);
      }
    };

    // Evento principal de cambio de arrastre
    const handleDraggingChanged = (event: any) => {
      if (event.value) {
        handleDragStart();
      } else {
        handleDragEnd();
      }
    };

    controls.addEventListener('dragging-changed', handleDraggingChanged);
    controls.addEventListener('objectChange', handleObjectChange);
    
    return () => {
      if (controls) {
        controls.removeEventListener('dragging-changed', handleDraggingChanged);
        controls.removeEventListener('objectChange', handleObjectChange);
      }
    };
  }, [onDraggingChange, gl, object, isDragging]);

  // Configurar y vincular objeto
  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls) return;

    if (isActive && object) {
      console.log('Attaching object to transform controls:', object.name || object.type);
      
      // Asegurar que el objeto esté en la escena
      if (!object.parent) {
        console.warn('Object has no parent, skipping attach');
        return;
      }

      try {
        // Ensure the object updates its matrices when modified
        object.traverse((child) => {
          child.matrixAutoUpdate = true;
        });

        controls.attach(object);
        controls.setMode(mode);
        
        // Configurar snapping
        if (mode === 'translate') {
          controls.setTranslationSnap(0.1);
          controls.setRotationSnap(null);
        } else if (mode === 'rotate') {
          controls.setTranslationSnap(null);
          controls.setRotationSnap(THREE.MathUtils.degToRad(15));
        }
        
        console.log('Transform Controls attached successfully');
        
      } catch (error) {
        console.error('Error attaching object to transform controls:', error);
      }
    } else {
      console.log('Detaching from transform controls');
      if (controls.object) {
        controls.detach();
      }
    }

    return () => {
      if (controls && controls.object && !isDragging) {
        controls.detach();
      }
    };
  }, [object, isActive, mode, isDragging]);

  // Manejar eventos de mouse para mejorar la detección de controles
  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls || !isActive || !object) return;

    const handleMouseDown = (event: MouseEvent) => {
      // Detener la propagación del evento para evitar interferencia con ObjectSelector
      event.stopImmediatePropagation();
    };

    const handleMouseUp = (event: MouseEvent) => {
      event.stopImmediatePropagation();
    };

    const canvas = gl.domElement;
    canvas.addEventListener('mousedown', handleMouseDown, true); // true para captura
    canvas.addEventListener('mouseup', handleMouseUp, true);

    return () => {
      canvas.removeEventListener('mousedown', handleMouseDown, true);
      canvas.removeEventListener('mouseup', handleMouseUp, true);
    };
  }, [isActive, object, gl]);

  // No renderizar si no está activo o no hay objeto
  if (!isActive || !object) {
    return null;
  }

  return (
    <TransformControls
      ref={controlsRef}
      mode={mode}
      camera={camera}
      domElement={gl.domElement}
      size={1.5}
      showX={true}
      showY={true}
      showZ={true}
      space="world"
      enabled={true}
      userData={{ isTransformControl: true }}
    />
  );
};
