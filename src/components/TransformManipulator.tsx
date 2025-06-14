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
  const dragStateRef = useRef({ isDragging: false });

  // Configurar eventos de arrastre - simplificado y mejorado
  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls) return;

    const handleDraggingChanged = (event: any) => {
      const isDragging = event.value;
      
      // Evitar múltiples eventos del mismo tipo
      if (dragStateRef.current.isDragging === isDragging) return;
      
      dragStateRef.current.isDragging = isDragging;
      
      console.log('Transform Controls dragging:', isDragging);
      onDraggingChange?.(isDragging);
      
      if (isDragging) {
        gl.domElement.style.cursor = 'grabbing';
        controls.enabled = true;
        controls.visible = true;
      } else {
        gl.domElement.style.cursor = 'default';
        if (object) {
          object.updateMatrixWorld(true);
          console.log('Transform completed for object:', object.name || object.type);
        }
      }
    };

    const handleObjectChange = () => {
      if (object && !dragStateRef.current.isDragging) {
        object.updateMatrixWorld(true);
      }
    };

    // Usar once: false para eventos repetitivos
    controls.addEventListener('dragging-changed', handleDraggingChanged);
    controls.addEventListener('objectChange', handleObjectChange);
    
    return () => {
      if (controls) {
        controls.removeEventListener('dragging-changed', handleDraggingChanged);
        controls.removeEventListener('objectChange', handleObjectChange);
      }
    };
  }, [onDraggingChange, gl, object]);

  // Vincular/desvincular objeto con mejor manejo de errores
  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls) return;

    // Limpiar estado previo
    if (controls.object && controls.object !== object) {
      console.log('Detaching previous object from transform controls');
      controls.detach();
    }

    if (isActive && object && object.parent) {
      console.log('Attaching object to transform controls:', object.name || object.type);
      try {
        // Configurar primero, luego adjuntar
        controls.mode = mode;
        controls.enabled = true;
        controls.visible = true;
        
        // Adjuntar el objeto
        controls.attach(object);
        
        // Configuración adicional después de adjuntar
        controls.size = 1.2;
        controls.space = 'world';
        
        if (mode === 'translate') {
          controls.translationSnap = 0.1;
          controls.rotationSnap = null;
        } else if (mode === 'rotate') {
          controls.translationSnap = null;
          controls.rotationSnap = THREE.MathUtils.degToRad(15);
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
      if (controls && controls.object && !dragStateRef.current.isDragging) {
        controls.detach();
      }
    };
  }, [object, isActive, mode]);

  // Configurar controles solo cuando sea necesario
  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls) return;

    // Solo configurar si hay cambios reales
    if (controls.mode !== mode) {
      controls.mode = mode;
    }
    
    if (controls.enabled !== (isActive && !!object)) {
      controls.enabled = isActive && !!object;
    }
    
    if (controls.visible !== (isActive && !!object)) {
      controls.visible = isActive && !!object;
    }
    
    console.log('Transform Controls configured:', {
      enabled: controls.enabled,
      visible: controls.visible,
      mode: controls.mode,
      hasObject: !!object,
      objectName: object?.name || object?.type
    });
  }, [isActive, object, mode]);

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
