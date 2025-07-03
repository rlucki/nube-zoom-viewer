
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

    const handleDragStart = (event: any) => {
      console.log('Transform drag started');
      setIsDragging(true);
      onDraggingChange?.(true);
      
      // Cambiar cursor y deshabilitar controles de cámara
      gl.domElement.style.cursor = 'grabbing';
      
      // Detener propagación del evento para evitar interferencias
      event.stopPropagation?.();
    };

    const handleDragEnd = (event: any) => {
      console.log('Transform drag ended');
      setIsDragging(false);
      onDraggingChange?.(false);
      gl.domElement.style.cursor = 'default';
      
      if (object) {
        object.updateMatrixWorld(true);
        console.log('Transform completed for object:', object.name || object.type);
      }
      
      // Detener propagación del evento
      event.stopPropagation?.();
    };

    const handleObjectChange = (event: any) => {
      if (object && isDragging) {
        object.updateMatrixWorld(true);
        console.log('Object position changed:', object.position);
      }
      
      // Detener propagación del evento
      event.stopPropagation?.();
    };

    // Usar el evento correcto de TransformControls
    controls.addEventListener('dragging-changed', (event: any) => {
      if (event.value) {
        handleDragStart(event);
      } else {
        handleDragEnd(event);
      }
    });
    
    controls.addEventListener('objectChange', handleObjectChange);
    
    return () => {
      if (controls) {
        controls.removeEventListener('dragging-changed', (event: any) => {
          if (event.value) {
            handleDragStart(event);
          } else {
            handleDragEnd(event);
          }
        });
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
        // Asegurar que las matrices se actualicen automáticamente
        object.traverse((child) => {
          child.matrixAutoUpdate = true;
        });

        // Adjuntar el objeto a los controles
        controls.attach(object);
        controls.setMode(mode);
        
        // Configurar el tamaño y visibilidad de los controles
        controls.setSize(1.2);
        controls.showX = true;
        controls.showY = true;
        controls.showZ = true;
        
        // Configurar snapping según el modo
        if (mode === 'translate') {
          controls.setTranslationSnap(0.1);
          controls.setRotationSnap(null);
        } else if (mode === 'rotate') {
          controls.setTranslationSnap(null);
          controls.setRotationSnap(THREE.MathUtils.degToRad(15));
        }
        
        console.log('Transform Controls attached successfully, mode:', mode);
        
      } catch (error) {
        console.error('Error attaching object to transform controls:', error);
      }
    } else {
      console.log('Detaching from transform controls');
      if (controls.object) {
        controls.detach();
      }
    }

    // Limpiar al desmontar o cambiar de objeto
    return () => {
      if (controls && controls.object && !isDragging) {
        try {
          controls.detach();
        } catch (error) {
          console.warn('Error detaching controls:', error);
        }
      }
    };
  }, [object, isActive, mode, isDragging]);

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
      size={1.2}
      showX={true}
      showY={true}
      showZ={true}
      space="world"
      enabled={true}
      userData={{ isTransformControl: true }}
    />
  );
};
