
import React, { useState, useRef, useEffect } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';

interface SectionBoxProps {
  targetObject: THREE.Object3D | null;
  isActive: boolean;
  onSectionChange?: (bounds: { min: THREE.Vector3; max: THREE.Vector3 }) => void;
}

export const SectionBox: React.FC<SectionBoxProps> = ({
  targetObject,
  isActive,
  onSectionChange,
}) => {
  const [bounds, setBounds] = useState<{ min: THREE.Vector3; max: THREE.Vector3 } | null>(null);
  const [dragState, setDragState] = useState<{ 
    isDragging: boolean; 
    face: string | null; 
    startPoint: THREE.Vector3 | null;
  }>({ isDragging: false, face: null, startPoint: null });

  const boxRef = useRef<THREE.Group>(null);
  const { camera, scene, gl } = useThree();
  const raycaster = useRef(new THREE.Raycaster());
  const mouse = useRef(new THREE.Vector2());

  // Calculate bounding box for target object
  useEffect(() => {
    if (targetObject && isActive) {
      const box = new THREE.Box3().setFromObject(targetObject);
      setBounds({
        min: box.min.clone(),
        max: box.max.clone(),
      });
    } else {
      setBounds(null);
    }
  }, [targetObject, isActive]);

  const handleMouseDown = (event: MouseEvent) => {
    if (!isActive || !bounds) return;

    mouse.current.x = (event.clientX / gl.domElement.clientWidth) * 2 - 1;
    mouse.current.y = -(event.clientY / gl.domElement.clientHeight) * 2 + 1;

    raycaster.current.setFromCamera(mouse.current, camera);
    
    // Check intersection with section box handles
    const boxGroup = boxRef.current;
    if (boxGroup) {
      const intersects = raycaster.current.intersectObjects(boxGroup.children, true);
      if (intersects.length > 0) {
        const intersectedObject = intersects[0].object;
        const face = intersectedObject.userData.face;
        
        if (face) {
          setDragState({
            isDragging: true,
            face,
            startPoint: intersects[0].point.clone(),
          });
        }
      }
    }
  };

  const handleMouseMove = (event: MouseEvent) => {
    if (!dragState.isDragging || !bounds || !dragState.face) return;

    mouse.current.x = (event.clientX / gl.domElement.clientWidth) * 2 - 1;
    mouse.current.y = -(event.clientY / gl.domElement.clientHeight) * 2 + 1;

    raycaster.current.setFromCamera(mouse.current, camera);
    
    // Project mouse to world space
    const plane = new THREE.Plane();
    const worldPosition = new THREE.Vector3();
    
    // Set plane based on face being dragged
    switch (dragState.face) {
      case 'x-min':
      case 'x-max':
        plane.setFromNormalAndCoplanarPoint(new THREE.Vector3(1, 0, 0), dragState.startPoint!);
        break;
      case 'y-min':
      case 'y-max':
        plane.setFromNormalAndCoplanarPoint(new THREE.Vector3(0, 1, 0), dragState.startPoint!);
        break;
      case 'z-min':
      case 'z-max':
        plane.setFromNormalAndCoplanarPoint(new THREE.Vector3(0, 0, 1), dragState.startPoint!);
        break;
    }

    raycaster.current.ray.intersectPlane(plane, worldPosition);

    // Update bounds based on drag
    const newBounds = {
      min: bounds.min.clone(),
      max: bounds.max.clone(),
    };

    switch (dragState.face) {
      case 'x-min':
        newBounds.min.x = Math.min(worldPosition.x, bounds.max.x - 0.1);
        break;
      case 'x-max':
        newBounds.max.x = Math.max(worldPosition.x, bounds.min.x + 0.1);
        break;
      case 'y-min':
        newBounds.min.y = Math.min(worldPosition.y, bounds.max.y - 0.1);
        break;
      case 'y-max':
        newBounds.max.y = Math.max(worldPosition.y, bounds.min.y + 0.1);
        break;
      case 'z-min':
        newBounds.min.z = Math.min(worldPosition.z, bounds.max.z - 0.1);
        break;
      case 'z-max':
        newBounds.max.z = Math.max(worldPosition.z, bounds.min.z + 0.1);
        break;
    }

    setBounds(newBounds);
    onSectionChange?.(newBounds);
  };

  const handleMouseUp = () => {
    setDragState({ isDragging: false, face: null, startPoint: null });
  };

  useEffect(() => {
    if (isActive) {
      gl.domElement.addEventListener('mousedown', handleMouseDown);
      gl.domElement.addEventListener('mousemove', handleMouseMove);
      gl.domElement.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      gl.domElement.removeEventListener('mousedown', handleMouseDown);
      gl.domElement.removeEventListener('mousemove', handleMouseMove);
      gl.domElement.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isActive, dragState, bounds]);

  if (!bounds || !isActive) return null;

  const center = bounds.min.clone().lerp(bounds.max, 0.5);
  const size = bounds.max.clone().sub(bounds.min);

  return (
    <group ref={boxRef}>
      {/* Section box wireframe */}
      <boxHelper args={[{ geometry: { parameters: { width: size.x, height: size.y, depth: size.z } } }]}>
        <mesh position={center}>
          <boxGeometry args={[size.x, size.y, size.z]} />
          <meshBasicMaterial wireframe color="yellow" transparent opacity={0.3} />
        </mesh>
      </boxHelper>

      {/* Drag handles (arrows) */}
      {[
        { face: 'x-min', position: [bounds.min.x, center.y, center.z], rotation: [0, 0, Math.PI] },
        { face: 'x-max', position: [bounds.max.x, center.y, center.z], rotation: [0, 0, 0] },
        { face: 'y-min', position: [center.x, bounds.min.y, center.z], rotation: [0, 0, -Math.PI / 2] },
        { face: 'y-max', position: [center.x, bounds.max.y, center.z], rotation: [0, 0, Math.PI / 2] },
        { face: 'z-min', position: [center.x, center.y, bounds.min.z], rotation: [-Math.PI / 2, 0, 0] },
        { face: 'z-max', position: [center.x, center.y, bounds.max.z], rotation: [Math.PI / 2, 0, 0] },
      ].map((handle) => (
        <group
          key={handle.face}
          position={handle.position as [number, number, number]}
          rotation={handle.rotation as [number, number, number]}
        >
          <mesh userData={{ face: handle.face }}>
            <coneGeometry args={[0.2, 0.8, 8]} />
            <meshBasicMaterial color="blue" />
          </mesh>
          <mesh position={[0, 0.6, 0]} userData={{ face: handle.face }}>
            <cylinderGeometry args={[0.05, 0.05, 1.2]} />
            <meshBasicMaterial color="blue" />
          </mesh>
        </group>
      ))}
    </group>
  );
};
