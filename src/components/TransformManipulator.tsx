
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
        controls.setSize(1.2);
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

  // Manejar eventos de arrastre
  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls) return;

    const handleDragStart = () => {
      console.log('Transform drag started');
      setIsDragging(true);
      onDraggingChange?.(true);
      
      // Cambiar cursor y deshabilitar controles de cámara
      gl.domElement.style.cursor = 'grabbing';
      gl.domElement.style.pointerEvents = 'auto';
    };

    const handleDragEnd = () => {
      console.log('Transform drag ended');
      setIsDragging(false);
      onDraggingChange?.(false);
      
      // Restaurar cursor y habilitar controles de cámara
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
    
    // Listener adicional para mouseDown en los controles
    const handleMouseDown = (event: any) => {
      console.log('MouseDown on transform control');
      event.stopPropagation();
    };

    controls.addEventListener('mouseDown', handleMouseDown);
    
    return () => {
      if (controls) {
        controls.removeEventListener('dragging-changed', handleDraggingChanged);
        controls.removeEventListener('objectChange', handleObjectChange);
        controls.removeEventListener('mouseDown', handleMouseDown);
      }
    };
  }, [onDraggingChange, gl, object, isDragging]);

  // Prevenir interferencia con ObjectSelector
  useEffect(() => {
    if (!isActive || !object) return;

    const canvas = gl.domElement;
    
    const handleMouseDown = (event: MouseEvent) => {
      // Solo interceptar si el mouse está sobre los controles
      const rect = canvas.getBoundingClientRect();
      const mouse = new THREE.Vector2(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1
      );

      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(mouse, camera);

      // Buscar controles en la escena
      const transformElements: THREE.Object3D[] = [];
      const controls = controlsRef.current;
      if (controls && controls.children) {
        controls.traverse((child: THREE.Object3D) => {
          if (child.visible && (child instanceof THREE.Mesh || child instanceof THREE.Line)) {
            transformElements.push(child);
          }
        });
      }

      if (transformElements.length > 0) {
        const intersects = raycaster.intersectObjects(transformElements, true);
        if (intersects.length > 0) {
          console.log('Click on transform control detected, preventing object selection');
          event.stopImmediatePropagation();
          event.preventDefault();
        }
      }
    };

    // Usar capture: true para interceptar antes que ObjectSelector
    canvas.addEventListener('mousedown', handleMouseDown, { capture: true });

    return () => {
      canvas.removeEventListener('mousedown', handleMouseDown, { capture: true });
    };
  }, [isActive, object, gl, camera]);

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
