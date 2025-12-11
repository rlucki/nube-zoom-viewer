
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

  // Encontrar el mejor objeto transformable (grupo padre o el objeto mismo)
  const findTransformableTarget = (obj: THREE.Object3D): THREE.Object3D => {
    // Buscar hacia arriba hasta encontrar un grupo con nombre o el primer grupo
    let target = obj;
    let bestTarget = obj;
    
    while (target.parent) {
      // Si el padre es un Group con nombre específico (modelo IFC completo), usarlo
      if (target.parent.type === 'Group' && target.parent.name) {
        bestTarget = target.parent;
      }
      // Si llegamos a un grupo sin padre significativo, parar
      if (!target.parent.parent || target.parent.type === 'Scene') {
        break;
      }
      target = target.parent;
    }
    
    return bestTarget;
  };

  // Activar o desactivar controles según props
  useEffect(() => {
    const controls = controlsRef.current as any;
    if (!controls) return;

    // Si no hay herramienta activa o no hay objeto, desactivar y desanclar
    if (!isActive || !object) {
      controls.enabled = false;
      if (controls.object) {
        controls.detach();
      }
      gl.domElement.style.cursor = 'default';
      return;
    }

    // Encontrar el mejor objeto para transformar
    const target = findTransformableTarget(object);
    
    console.log('TransformManipulator: adjuntando a', target.name || target.type, target);

    // Asegurar que todas las matrices se actualicen automáticamente
    target.traverse((child: THREE.Object3D) => {
      child.matrixAutoUpdate = true;
    });

    controls.enabled = true;

    // Si el control ya tenía otro objeto adjunto, desanclar primero
    if (controls.object && controls.object !== target) {
      controls.detach();
    }

    // Adjuntar el objeto
    if (controls.object !== target) {
      controls.attach(target);
    }

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

    return () => {
      if (controls) {
        controls.detach();
        gl.domElement.style.cursor = 'default';
      }
    };
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

    // Listeners principales
    controls.addEventListener('dragging-changed', handleDraggingChanged);
    controls.addEventListener('objectChange', handleObjectChange);

    return () => {
      if (controls) {
        controls.removeEventListener('dragging-changed', handleDraggingChanged);
        controls.removeEventListener('objectChange', handleObjectChange);
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
