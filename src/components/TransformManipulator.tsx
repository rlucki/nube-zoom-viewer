
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
        // Asegurar que el objeto actualice sus matrices
        object.traverse((child) => {
          child.matrixAutoUpdate = true;
        });

        controls.attach(object);
        controls.setMode(mode);
        
        // Configurar controles optimizados para arrastre
        controls.setSize(2.0); // Tamaño mayor para mejor interacción
        controls.setSpace('world');
        
        // Configurar snapping más suave
        if (mode === 'translate') {
          controls.setTranslationSnap(0.05); // Snap más fino
          controls.setRotationSnap(null);
        } else if (mode === 'rotate') {
          controls.setTranslationSnap(null);
          controls.setRotationSnap(THREE.MathUtils.degToRad(5)); // Snap más fino
        }
        
        // Configurar eventos directamente en el control
        controls.addEventListener('mouseDown', () => {
          console.log('Transform controls mouse down');
          gl.domElement.style.cursor = 'grabbing';
        });
        
        controls.addEventListener('mouseUp', () => {
          console.log('Transform controls mouse up');
          gl.domElement.style.cursor = 'grab';
        });
        
        console.log('Transform Controls attached successfully');
        
      } catch (error) {
        console.error('Error attaching object to transform controls:', error);
      }
    } else {
      console.log('Detaching from transform controls');
      if (controls.object) {
        controls.detach();
      }
      gl.domElement.style.cursor = 'default';
    }
  }, [object, isActive, mode, gl]);

  // Manejar eventos de arrastre - CORREGIDO
  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls || !isActive) return;

    const handleDragStart = () => {
      console.log('Transform drag started - REAL');
      setIsDragging(true);
      onDraggingChange?.(true);
      gl.domElement.style.cursor = 'grabbing';
    };

    const handleDragEnd = () => {
      console.log('Transform drag ended - REAL');
      setIsDragging(false);
      onDraggingChange?.(false);
      gl.domElement.style.cursor = 'grab';
      
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

    // Usar evento dragging-changed que es el más confiable
    const handleDraggingChanged = (event: any) => {
      console.log('Dragging changed event:', event.value);
      const isDraggingNow = event.value;
      
      if (isDraggingNow && !isDragging) {
        handleDragStart();
      } else if (!isDraggingNow && isDragging) {
        handleDragEnd();
      }
    };

    // Eventos adicionales para mejor detección
    const handleMouseDown = () => {
      console.log('Transform controls mousedown detected');
    };

    const handleMouseUp = () => {
      console.log('Transform controls mouseup detected');
    };

    // Agregar todos los listeners
    controls.addEventListener('dragging-changed', handleDraggingChanged);
    controls.addEventListener('objectChange', handleObjectChange);
    controls.addEventListener('mouseDown', handleMouseDown);
    controls.addEventListener('mouseUp', handleMouseUp);
    
    return () => {
      if (controls) {
        controls.removeEventListener('dragging-changed', handleDraggingChanged);
        controls.removeEventListener('objectChange', handleObjectChange);
        controls.removeEventListener('mouseDown', handleMouseDown);
        controls.removeEventListener('mouseUp', handleMouseUp);
      }
    };
  }, [onDraggingChange, object, isActive, isDragging, gl]);

  // Cleanup cuando se desactiva
  useEffect(() => {
    if (!isActive) {
      setIsDragging(false);
      onDraggingChange?.(false);
      gl.domElement.style.cursor = 'default';
    }
  }, [isActive, onDraggingChange, gl]);

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
      size={2.0} // Tamaño mayor
      showX={true}
      showY={true}
      showZ={true}
      space="world"
      enabled={true}
      userData={{ isTransformControl: true }}
    />
  );
};
