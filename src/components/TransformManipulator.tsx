
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

  // Configurar eventos de arrastre
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
        console.log('Transform completed - new position:', object.position);
      }
    };

    const handleObjectChange = () => {
      if (object && isDragging) {
        object.updateMatrixWorld(true);
        console.log('Object transforming - position:', object.position);
      }
    };

    // Eventos de TransformControls - MEJORADOS
    const onDraggingChanged = (event: any) => {
      console.log('Dragging changed event:', event.value);
      if (event.value) {
        handleDragStart();
      } else {
        handleDragEnd();
      }
    };

    // Eventos adicionales para capturar interacciones
    const onMouseDown = (event: any) => {
      console.log('Transform controls mouse down');
      event.stopPropagation();
    };

    const onMouseUp = (event: any) => {
      console.log('Transform controls mouse up');
      event.stopPropagation();
    };

    controls.addEventListener('dragging-changed', onDraggingChanged);
    controls.addEventListener('objectChange', handleObjectChange);
    controls.addEventListener('mouseDown', onMouseDown);
    controls.addEventListener('mouseUp', onMouseUp);
    
    return () => {
      if (controls) {
        try {
          controls.removeEventListener('dragging-changed', onDraggingChanged);
          controls.removeEventListener('objectChange', handleObjectChange);
          controls.removeEventListener('mouseDown', onMouseDown);
          controls.removeEventListener('mouseUp', onMouseUp);
        } catch (error) {
          console.warn('Error removing event listeners:', error);
        }
      }
    };
  }, [onDraggingChange, gl, object, isDragging]);

  // Adjuntar/desadjuntar objeto
  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls) return;

    if (isActive && object) {
      console.log('Attaching object to transform controls:', object.name || object.type);
      
      try {
        // Desadjuntar cualquier objeto previo
        if (controls.object) {
          controls.detach();
        }

        // Asegurar que el objeto permite transformaciones
        object.matrixAutoUpdate = true;
        
        // Adjuntar el nuevo objeto
        controls.attach(object);
        
        // Configurar modo y propiedades
        controls.setMode(mode);
        controls.setSize(1.5); // Hacer los controles más grandes para mejor interacción
        
        // Habilitar todos los ejes
        controls.showX = true;
        controls.showY = true;
        controls.showZ = true;
        
        // Configurar espacio de transformación
        controls.space = 'world';
        
        // Configurar snapping
        if (mode === 'translate') {
          controls.setTranslationSnap(0.1);
          controls.setRotationSnap(null);
        } else if (mode === 'rotate') {
          controls.setTranslationSnap(null);
          controls.setRotationSnap(THREE.MathUtils.degToRad(15));
        }
        
        // CRÍTICO: Configurar eventos de manera más agresiva
        controls.enabled = true;
        controls.domElement = gl.domElement;
        
        // Marcar objetos de controles para identificación
        controls.traverse((child: THREE.Object3D) => {
          child.userData.isTransformControl = true;
          // Hacer los controles más sensibles al click
          if (child instanceof THREE.Mesh) {
            child.raycast = function(raycaster: THREE.Raycaster, intersects: THREE.Intersection[]) {
              // Llamar al raycast original pero con mayor tolerancia
              const originalThreshold = raycaster.params.Points?.threshold || 0;
              raycaster.params.Points = { threshold: 0.1 };
              THREE.Mesh.prototype.raycast.call(this, raycaster, intersects);
              raycaster.params.Points = { threshold: originalThreshold };
            };
          }
        });
        controls.userData.isTransformControl = true;
        
        console.log('Transform Controls configured successfully');
        console.log('- Mode:', mode);
        console.log('- Object attached:', !!controls.object);
        console.log('- Controls enabled:', controls.enabled);
        
      } catch (error) {
        console.error('Error configuring transform controls:', error);
      }
    } else {
      // Desadjuntar cuando no está activo
      if (controls.object) {
        console.log('Detaching from transform controls');
        try {
          controls.detach();
        } catch (error) {
          console.warn('Error detaching controls:', error);
        }
      }
    }
  }, [object, isActive, mode, gl]);

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
      // Mejorar captura de eventos
      onPointerDown={(e) => {
        console.log('Transform controls pointer down - stopping propagation');
        e.stopPropagation();
        e.nativeEvent?.stopImmediatePropagation();
      }}
      onPointerMove={(e) => {
        if (isDragging) {
          console.log('Transform controls pointer move during drag');
          e.stopPropagation();
          e.nativeEvent?.stopImmediatePropagation();
        }
      }}
      onPointerUp={(e) => {
        console.log('Transform controls pointer up');
        e.stopPropagation();
        e.nativeEvent?.stopImmediatePropagation();
      }}
      // Configuraciones adicionales para mejorar la respuesta
      translationSnap={mode === 'translate' ? 0.1 : null}
      rotationSnap={mode === 'rotate' ? THREE.MathUtils.degToRad(15) : null}
    />
  );
};
