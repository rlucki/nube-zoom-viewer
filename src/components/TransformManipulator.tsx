
import React, { useEffect, useRef } from 'react';
import { TransformControls } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { TransformControls as TransformControlsImpl } from 'three-stdlib';

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
  const controlsRef = useRef<TransformControlsImpl>(null);
  const { camera, gl } = useThree();

  // Activar o desactivar controles según props
  useEffect(() => {
    const controls = controlsRef.current as any;
    if (!controls) return;

    controls.enabled = isActive && !!object;
    if (controls.enabled) {
      // Ensure we only attach objects that are part of the scene graph
      if (!object || !object.parent) {
        console.warn('TransformManipulator: object not in scene graph', object);
        controls.enabled = false;
        return;
      }

      // Ensure all child matrices update correctly during manipulation
      object.traverse((child: THREE.Object3D) => {
        child.matrixAutoUpdate = true;
      });

      controls.attach(object);
      controls.setMode(mode);
      controls.setSize(2.0);
      controls.setSpace('world');
      if (mode === 'translate') {
        controls.setTranslationSnap(0.05);
        controls.setRotationSnap(null);
      } else {
        controls.setTranslationSnap(null);
        controls.setRotationSnap(THREE.MathUtils.degToRad(5));
      }
    } else if (controls.object) {
      controls.detach();
      gl.domElement.style.cursor = 'default';
    }
  }, [object, isActive, mode, gl]);

  // Manejar eventos de arrastre - CORREGIDO
  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls || !isActive) return;

    const handleDragStart = () => {
      onDraggingChange?.(true);
      gl.domElement.style.cursor = 'grabbing';
    };

    const handleDragEnd = () => {
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
      const isDraggingNow = event.value;
      if (isDraggingNow) handleDragStart();
      else handleDragEnd();
    };

    // Eventos adicionales para mejor detección
    const handleMouseDown = () => {
      console.log('Transform controls mousedown detected');
      // Temporarily disable pointer events on the canvas to avoid
      // interfering with camera controls when the drag starts
      gl.domElement.style.pointerEvents = 'none';
      setTimeout(() => {
        gl.domElement.style.pointerEvents = 'auto';
      }, 0);
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
  }, [onDraggingChange, object, isActive, gl]);

  // Cleanup cuando se desactiva
  useEffect(() => {
    if (!isActive) {
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
