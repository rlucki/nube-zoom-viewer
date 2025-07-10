
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

  // Configurar y vincular objeto
  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls) return;

    if (isActive && object) {
      console.log('Attaching object to transform controls:', object.name || object.type);
      
      try {
        // Ensure the object updates its matrices when modified
        object.traverse((child) => {
          child.matrixAutoUpdate = true;
        });

        controls.attach(object);
        controls.setMode(mode);
        
        // Configurar controles para mejor interacción
        controls.setSize(1.5); // Aumentar tamaño para mejor interacción
        controls.setSpace('world');
        
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
  }, [object, isActive, mode]);

  // Manejar eventos de arrastre - simplificado y más directo
  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls || !isActive) return;

    const handleDragStart = () => {
      console.log('Transform drag started');
      setIsDragging(true);
      onDraggingChange?.(true);
    };

    const handleDragEnd = () => {
      console.log('Transform drag ended');
      setIsDragging(false);
      onDraggingChange?.(false);
      
      if (object) {
        object.updateMatrixWorld(true);
        console.log('Transform completed for object:', object.name || object.type);
      }
    };

    const handleObjectChange = () => {
      if (object) {
        object.updateMatrixWorld(true);
      }
    };

    // Usar solo el evento dragging-changed que es más confiable
    const handleDraggingChanged = (event: any) => {
      console.log('Dragging changed event:', event.value);
      if (event.value) {
        handleDragStart();
      } else {
        handleDragEnd();
      }
    };

    // Agregar listeners
    controls.addEventListener('dragging-changed', handleDraggingChanged);
    controls.addEventListener('objectChange', handleObjectChange);
    
    return () => {
      if (controls) {
        controls.removeEventListener('dragging-changed', handleDraggingChanged);
        controls.removeEventListener('objectChange', handleObjectChange);
      }
    };
  }, [onDraggingChange, object, isActive]);

  // Cleanup cuando se desactiva
  useEffect(() => {
    if (!isActive) {
      setIsDragging(false);
      onDraggingChange?.(false);
    }
  }, [isActive, onDraggingChange]);

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
