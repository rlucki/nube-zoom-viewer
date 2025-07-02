
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

  // Manejar eventos de arrastre de forma más robusta
  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls) return;

    const handleDragStart = (event: any) => {
      console.log('Transform drag started');
      setIsDragging(true);
      onDraggingChange?.(true);
      gl.domElement.style.cursor = 'grabbing';
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
    };

    const handleObjectChange = () => {
      if (object && isDragging) {
        object.updateMatrixWorld(true);
      }
    };

    // Eventos mejorados
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
        controls.removeEventListener('dragging-changed', handleDragStart);
        controls.removeEventListener('dragging-changed', handleDragEnd);
        controls.removeEventListener('objectChange', handleObjectChange);
      }
    };
  }, [onDraggingChange, gl, object, isDragging]);

  // Configurar y vincular objeto
  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls) return;

    if (isActive && object && object.parent) {
      console.log('Attaching object to transform controls:', object.name || object.type);
      try {
        // Configurar controles
        controls.mode = mode;
        controls.enabled = true;
        controls.visible = true;
        controls.size = 1.2;
        controls.space = 'world';
        
        // Adjuntar objeto
        controls.attach(object);
        
        // Configurar snapping
        if (mode === 'translate') {
          controls.translationSnap = 0.1;
          controls.rotationSnap = null;
        } else if (mode === 'rotate') {
          controls.translationSnap = null;
          controls.rotationSnap = THREE.MathUtils.degToRad(15);
        }
        
        console.log('Transform Controls configured:', {
          enabled: controls.enabled,
          visible: controls.visible,
          mode: controls.mode,
          hasObject: !!object,
          objectName: object?.name || object?.type
        });
        
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
      if (controls && controls.object && !isDragging) {
        controls.detach();
      }
    };
  }, [object, isActive, mode, isDragging]);

  // No renderizar si no está activo
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
      translationSnap={mode === 'translate' ? 0.05 : undefined}
      rotationSnap={mode === 'rotate' ? THREE.MathUtils.degToRad(5) : undefined}
    />
  );
};
