
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

  // Configurar eventos de arrastre
  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls) return;

    const handleDraggingChanged = (event: any) => {
      const isDragging = event.value;
      console.log('Transform Controls dragging:', isDragging);
      onDraggingChange?.(isDragging);
      
      // Cambiar cursor
      if (isDragging) {
        gl.domElement.style.cursor = 'grabbing';
      } else {
        gl.domElement.style.cursor = 'default';
      }
    };

    const handleObjectChange = (event: any) => {
      console.log('Transform Controls object changed');
      // El objeto se ha transformado, forzar actualización
      if (object) {
        object.updateMatrixWorld(true);
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
  }, [onDraggingChange, gl, object]);

  // Vincular/desvincular objeto
  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls) return;

    if (isActive && object) {
      console.log('Attaching object to transform controls:', object.name || object.type);
      try {
        // Asegurar que el objeto esté en la escena y sea transformable
        if (object.parent) {
          controls.attach(object);
          controls.visible = true;
          controls.enabled = true;
        } else {
          console.warn('Object has no parent, cannot attach to transform controls');
        }
      } catch (error) {
        console.error('Error attaching object to transform controls:', error);
      }
    } else {
      console.log('Detaching from transform controls');
      controls.detach();
      controls.visible = false;
      controls.enabled = false;
    }

    return () => {
      if (controls && controls.object) {
        controls.detach();
      }
    };
  }, [object, isActive]);

  // Configurar controles
  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls) return;

    controls.enabled = isActive && !!object;
    controls.visible = isActive && !!object;
    
    // Configuraciones específicas del modo
    if (mode === 'translate') {
      controls.showX = true;
      controls.showY = true;
      controls.showZ = true;
    } else if (mode === 'rotate') {
      controls.showX = true;
      controls.showY = true;
      controls.showZ = true;
    }
    
    console.log('Transform Controls configured:', {
      enabled: controls.enabled,
      visible: controls.visible,
      mode: mode,
      hasObject: !!object
    });
  }, [isActive, object, mode]);

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
      translationSnap={mode === 'translate' ? 0.1 : undefined}
      rotationSnap={mode === 'rotate' ? THREE.MathUtils.degToRad(15) : undefined}
      scaleSnap={undefined}
      // Configuraciones adicionales para mejorar la funcionalidad
      axis={null}
      enabled={true}
      userData={{ isTransformControl: true }}
    />
  );
};
