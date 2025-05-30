
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
    startBounds: { min: THREE.Vector3; max: THREE.Vector3 } | null;
  }>({ isDragging: false, face: null, startPoint: null, startBounds: null });
  const [hoveredHandle, setHoveredHandle] = useState<string | null>(null);

  const boxRef = useRef<THREE.Group>(null);
  const { camera, gl, raycaster, scene } = useThree();

  // Calculate bounding box for target object
  useEffect(() => {
    if (targetObject && isActive) {
      const box = new THREE.Box3().setFromObject(targetObject);
      
      if (box.isEmpty()) {
        // If box is empty, set a default size
        const center = new THREE.Vector3(0, 0, 0);
        const size = 10;
        setBounds({
          min: new THREE.Vector3(center.x - size, center.y - size, center.z - size),
          max: new THREE.Vector3(center.x + size, center.y + size, center.z + size),
        });
      } else {
        // Expandir un poco el cubo para que sea visible
        const size = box.getSize(new THREE.Vector3());
        const expansion = Math.max(size.x, size.y, size.z) * 0.05;
        box.expandByScalar(expansion);
        
        setBounds({
          min: box.min.clone(),
          max: box.max.clone(),
        });
      }
    } else if (!isActive) {
      setBounds(null);
    }
  }, [targetObject, isActive]);

  // Update clipping planes when bounds change
  useEffect(() => {
    if (bounds && targetObject) {
      const clippingPlanes = [
        new THREE.Plane(new THREE.Vector3(1, 0, 0), -bounds.min.x),
        new THREE.Plane(new THREE.Vector3(-1, 0, 0), bounds.max.x),
        new THREE.Plane(new THREE.Vector3(0, 1, 0), -bounds.min.y),
        new THREE.Plane(new THREE.Vector3(0, -1, 0), bounds.max.y),
        new THREE.Plane(new THREE.Vector3(0, 0, 1), -bounds.min.z),
        new THREE.Plane(new THREE.Vector3(0, 0, -1), bounds.max.z),
      ];

      // Apply clipping planes to the target object
      targetObject.traverse((child) => {
        if (child instanceof THREE.Mesh && child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach(mat => {
              mat.clippingPlanes = clippingPlanes;
              mat.needsUpdate = true;
            });
          } else {
            child.material.clippingPlanes = clippingPlanes;
            child.material.needsUpdate = true;
          }
        } else if (child instanceof THREE.Points && child.material) {
          child.material.clippingPlanes = clippingPlanes;
          child.material.needsUpdate = true;
        }
      });

      onSectionChange?.(bounds);
    } else if (!bounds && targetObject) {
      // Remove clipping planes
      targetObject.traverse((child) => {
        if (child instanceof THREE.Mesh && child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach(mat => {
              mat.clippingPlanes = [];
              mat.needsUpdate = true;
            });
          } else {
            child.material.clippingPlanes = [];
            child.material.needsUpdate = true;
          }
        } else if (child instanceof THREE.Points && child.material) {
          child.material.clippingPlanes = [];
          child.material.needsUpdate = true;
        }
      });
    }
  }, [bounds, targetObject, onSectionChange]);

  const getMousePosition = (event: MouseEvent) => {
    const rect = gl.domElement.getBoundingClientRect();
    return new THREE.Vector2(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1
    );
  };

  const handleMouseDown = (event: MouseEvent) => {
    if (!isActive || !bounds) return;

    const mouse = getMousePosition(event);
    raycaster.setFromCamera(mouse, camera);
    
    // Check intersection with section box handles
    const boxGroup = boxRef.current;
    if (boxGroup) {
      const intersects = raycaster.intersectObjects(boxGroup.children, true);
      if (intersects.length > 0) {
        const intersectedObject = intersects[0].object;
        const face = intersectedObject.userData.face;
        
        if (face) {
          setDragState({
            isDragging: true,
            face,
            startPoint: intersects[0].point.clone(),
            startBounds: {
              min: bounds.min.clone(),
              max: bounds.max.clone()
            }
          });
          event.preventDefault();
          event.stopPropagation();
        }
      }
    }
  };

  const handleMouseMove = (event: MouseEvent) => {
    if (!isActive) return;

    const mouse = getMousePosition(event);

    // Handle hover effects
    if (!dragState.isDragging && bounds) {
      raycaster.setFromCamera(mouse, camera);
      const boxGroup = boxRef.current;
      if (boxGroup) {
        const intersects = raycaster.intersectObjects(boxGroup.children, true);
        if (intersects.length > 0) {
          const face = intersects[0].object.userData.face;
          setHoveredHandle(face);
          gl.domElement.style.cursor = 'grab';
        } else {
          setHoveredHandle(null);
          gl.domElement.style.cursor = 'default';
        }
      }
    }

    // Handle dragging
    if (!dragState.isDragging || !bounds || !dragState.face || !dragState.startPoint || !dragState.startBounds) return;

    raycaster.setFromCamera(mouse, camera);
    
    // Calculate movement based on face orientation
    const plane = new THREE.Plane();
    const worldPosition = new THREE.Vector3();
    
    // Set plane normal based on face being dragged
    let normal = new THREE.Vector3();
    switch (dragState.face) {
      case 'x-min':
      case 'x-max':
        normal.set(1, 0, 0);
        break;
      case 'y-min':
      case 'y-max':
        normal.set(0, 1, 0);
        break;
      case 'z-min':
      case 'z-max':
        normal.set(0, 0, 1);
        break;
    }

    plane.setFromNormalAndCoplanarPoint(normal, dragState.startPoint);
    const intersectionPoint = raycaster.ray.intersectPlane(plane, worldPosition);
    
    if (!intersectionPoint) return;

    // Calculate movement delta
    const movement = intersectionPoint.clone().sub(dragState.startPoint);
    
    // Update bounds based on drag
    const newBounds = {
      min: dragState.startBounds.min.clone(),
      max: dragState.startBounds.max.clone(),
    };

    const minSize = 1; // Tamaño mínimo del cubo

    switch (dragState.face) {
      case 'x-min':
        newBounds.min.x += movement.x;
        newBounds.min.x = Math.min(newBounds.min.x, newBounds.max.x - minSize);
        break;
      case 'x-max':
        newBounds.max.x += movement.x;
        newBounds.max.x = Math.max(newBounds.max.x, newBounds.min.x + minSize);
        break;
      case 'y-min':
        newBounds.min.y += movement.y;
        newBounds.min.y = Math.min(newBounds.min.y, newBounds.max.y - minSize);
        break;
      case 'y-max':
        newBounds.max.y += movement.y;
        newBounds.max.y = Math.max(newBounds.max.y, newBounds.min.y + minSize);
        break;
      case 'z-min':
        newBounds.min.z += movement.z;
        newBounds.min.z = Math.min(newBounds.min.z, newBounds.max.z - minSize);
        break;
      case 'z-max':
        newBounds.max.z += movement.z;
        newBounds.max.z = Math.max(newBounds.max.z, newBounds.min.z + minSize);
        break;
    }

    setBounds(newBounds);
  };

  const handleMouseUp = () => {
    if (dragState.isDragging) {
      setDragState({ isDragging: false, face: null, startPoint: null, startBounds: null });
      gl.domElement.style.cursor = 'default';
    }
  };

  useEffect(() => {
    if (isActive) {
      const canvas = gl.domElement;
      canvas.addEventListener('mousedown', handleMouseDown);
      canvas.addEventListener('mousemove', handleMouseMove);
      canvas.addEventListener('mouseup', handleMouseUp);

      return () => {
        canvas.removeEventListener('mousedown', handleMouseDown);
        canvas.removeEventListener('mousemove', handleMouseMove);
        canvas.removeEventListener('mouseup', handleMouseUp);
        canvas.style.cursor = 'default';
      };
    }
  }, [isActive, dragState, bounds]);

  if (!bounds || !isActive) return null;

  const center = bounds.min.clone().lerp(bounds.max, 0.5);
  const size = bounds.max.clone().sub(bounds.min);

  return (
    <group ref={boxRef}>
      {/* Section box wireframe */}
      <mesh position={center}>
        <boxGeometry args={[size.x, size.y, size.z]} />
        <meshBasicMaterial wireframe color="#00FFFF" transparent opacity={0.6} />
      </mesh>

      {/* Section box faces for better visibility */}
      <mesh position={center}>
        <boxGeometry args={[size.x, size.y, size.z]} />
        <meshBasicMaterial color="#00FFFF" transparent opacity={0.05} side={THREE.DoubleSide} />
      </mesh>

      {/* Drag handles (triangular controls) */}
      {[
        { face: 'x-min', position: [bounds.min.x, center.y, center.z], rotation: [0, 0, Math.PI / 2] },
        { face: 'x-max', position: [bounds.max.x, center.y, center.z], rotation: [0, 0, -Math.PI / 2] },
        { face: 'y-min', position: [center.x, bounds.min.y, center.z], rotation: [0, 0, Math.PI] },
        { face: 'y-max', position: [center.x, bounds.max.y, center.z], rotation: [0, 0, 0] },
        { face: 'z-min', position: [center.x, center.y, bounds.min.z], rotation: [Math.PI / 2, 0, 0] },
        { face: 'z-max', position: [center.x, center.y, bounds.max.z], rotation: [-Math.PI / 2, 0, 0] },
      ].map((handle) => {
        const isHovered = hoveredHandle === handle.face;
        const isDragging = dragState.face === handle.face;
        
        return (
          <group
            key={handle.face}
            position={handle.position as [number, number, number]}
            rotation={handle.rotation as [number, number, number]}
          >
            {/* Triangular handle */}
            <mesh userData={{ face: handle.face }}>
              <coneGeometry args={[0.8, 1.5, 4]} />
              <meshBasicMaterial 
                color={isDragging ? "#FF0000" : (isHovered ? "#FFA500" : "#0066FF")} 
                transparent 
                opacity={0.8}
              />
            </mesh>
            {/* Handle shaft for better visibility */}
            <mesh position={[0, 0.9, 0]} userData={{ face: handle.face }}>
              <cylinderGeometry args={[0.15, 0.15, 1.8]} />
              <meshBasicMaterial 
                color={isDragging ? "#FF0000" : (isHovered ? "#FFA500" : "#0066FF")} 
                transparent 
                opacity={0.6}
              />
            </mesh>
          </group>
        );
      })}
    </group>
  );
};
