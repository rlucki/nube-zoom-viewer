
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

  /**
   * En muchos IFC, el <group> contenedor está en (0,0,0) y los meshes tienen offsets grandes,
   * por lo que el gizmo quedaba en el origen (fuera de cámara). Para evitarlo, creamos un
   * pivote invisible en el centro del bounding box y transformamos ese pivote.
   */
  const getOrCreatePivot = (target: THREE.Object3D): THREE.Object3D => {
    // Si el propio target ya es un pivote, usarlo directamente
    if ((target.userData as any)?.isTransformPivot) return target;

    const existingPivot = (target.userData as any)?.__transformPivot as THREE.Object3D | undefined;
    if (existingPivot) return existingPivot;

    if (!target.parent) return target;

    const parent = target.parent;
    const box = new THREE.Box3().setFromObject(target);
    if (box.isEmpty()) return target;

    const centerWorld = box.getCenter(new THREE.Vector3());
    const centerLocal = parent.worldToLocal(centerWorld.clone());

    const pivot = new THREE.Group();
    pivot.name = '__transform_pivot__';
    pivot.userData.isUI = true;
    pivot.userData.isTransformPivot = true;
    pivot.position.copy(centerLocal);

    // Insertar pivote al mismo nivel que el target
    parent.add(pivot);

    // Re-parent manteniendo world transform
    pivot.attach(target);

    // Guardar referencia para reutilizar
    (target.userData as any).__transformPivot = pivot;
    (pivot.userData as any).__transformTarget = target;

    return pivot;
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
    const pivot = getOrCreatePivot(target);

    console.log('TransformManipulator: adjuntando a', {
      selected: object.name || object.type,
      target: target.name || target.type,
      pivot: pivot.name || pivot.type,
    });

    // Asegurar que todas las matrices se actualicen automáticamente
    target.traverse((child: THREE.Object3D) => {
      child.matrixAutoUpdate = true;
    });

    controls.enabled = true;

    // Si el control ya tenía otro objeto adjunto, desanclar primero
    if (controls.object && controls.object !== pivot) {
      controls.detach();
    }

    // Adjuntar el pivote (gizmo en el centro del modelo)
    if (controls.object !== pivot) {
      controls.attach(pivot);
    }

    controls.setMode(mode);

    // Tamaño del gizmo proporcional al modelo (con límites razonables)
    const box = new THREE.Box3().setFromObject(target);
    const diag = box.isEmpty() ? 10 : box.getSize(new THREE.Vector3()).length();
    const gizmoSize = THREE.MathUtils.clamp(diag * 0.15, 2.0, 30.0);
    controls.setSize(gizmoSize);

    controls.setSpace('world');

    if (mode === 'translate') {
      controls.setTranslationSnap(0.05);
      controls.setRotationSnap(null);
    } else {
      controls.setTranslationSnap(null);
      controls.setRotationSnap(THREE.MathUtils.degToRad(5));
    }

    gl.domElement.style.cursor = 'grab';

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

      // Actualizar el objeto realmente adjunto (normalmente el pivote)
      const attached = (controls as any).object as THREE.Object3D | null;
      if (attached) {
        attached.updateMatrixWorld(true);
        console.log('Transform completed for object:', attached.name || attached.type);
      }
    };

    const handleObjectChange = () => {
      const attached = (controls as any).object as THREE.Object3D | null;
      attached?.updateMatrixWorld(true);
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
