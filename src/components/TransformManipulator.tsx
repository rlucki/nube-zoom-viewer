import React, { useEffect, useRef, useCallback } from 'react';
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

/**
 * Walk up the scene graph to find the top-level model group.
 * We stop at the first Group whose parent is also a Group that is
 * a direct child of the Scene (the wrapper <group> in PointCloudViewer).
 * This way we grab the per-model group, not the shared wrapper.
 */
const findModelGroup = (obj: THREE.Object3D): THREE.Object3D => {
  let current = obj;
  while (current.parent) {
    // If grandparent is the Scene, current.parent is the wrapper group
    // and current is the per-model group — that's our target.
    if (current.parent.parent && current.parent.parent.type === 'Scene') {
      return current;
    }
    // If parent IS the Scene, current itself is a direct child (unlikely for models
    // since they're in a wrapper, but handle it).
    if (current.parent.type === 'Scene') {
      return current;
    }
    current = current.parent;
  }
  // Fallback: return the original object
  return obj;
};

export const TransformManipulator: React.FC<TransformManipulatorProps> = ({
  object,
  isActive,
  mode,
  onDraggingChange,
}) => {
  const controlsRef = useRef<TransformControlsImpl>(null);
  const { gl } = useThree();

  // Find the correct target to move
  const target = React.useMemo(() => {
    if (!object) return null;
    const group = findModelGroup(object);
    // Verify the object is actually in a scene graph
    let root: THREE.Object3D = group;
    while (root.parent) root = root.parent;
    if (root.type !== 'Scene') {
      console.warn('TransformManipulator: target not in scene graph', group.type, group.name);
      return null;
    }
    console.log('TransformManipulator: target =', group.name || group.type, 'uuid:', group.uuid);
    return group;
  }, [object]);

  // Handle dragging events
  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls || !isActive || !target) return;

    const onDraggingChanged = (event: any) => {
      const dragging = event.value as boolean;
      onDraggingChange?.(dragging);
      gl.domElement.style.cursor = dragging ? 'grabbing' : 'grab';
    };

    controls.addEventListener('dragging-changed', onDraggingChanged);
    return () => {
      controls.removeEventListener('dragging-changed', onDraggingChanged);
    };
  }, [isActive, target, onDraggingChange, gl]);

  // Set cursor
  useEffect(() => {
    if (isActive && target) {
      gl.domElement.style.cursor = 'grab';
    }
    return () => {
      gl.domElement.style.cursor = 'default';
    };
  }, [isActive, target, gl]);

  // Cleanup on deactivate
  useEffect(() => {
    if (!isActive) {
      onDraggingChange?.(false);
    }
  }, [isActive, onDraggingChange]);

  if (!isActive || !target) return null;

  // Calculate gizmo size from model bounds
  const box = new THREE.Box3().setFromObject(target);
  const size = box.isEmpty() ? 2 : THREE.MathUtils.clamp(box.getSize(new THREE.Vector3()).length() * 0.15, 1.5, 25);

  return (
    <TransformControls
      ref={controlsRef}
      object={target}
      mode={mode}
      size={size}
      space="world"
      showX
      showY
      showZ
    />
  );
};
