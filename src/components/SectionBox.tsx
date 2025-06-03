
import React, { useState, useRef, useEffect } from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';

interface SectionBoxProps {
  targetObject: THREE.Object3D | null;
  isActive: boolean;
  onSectionChange?: (bounds: { min: THREE.Vector3; max: THREE.Vector3 }) => void;
  onDragStateChange?: (isDragging: boolean) => void;
}

export const SectionBox: React.FC<SectionBoxProps> = ({
  targetObject,
  isActive,
  onSectionChange,
  onDragStateChange,
}) => {
  const [bounds, setBounds] = useState<{ min: THREE.Vector3; max: THREE.Vector3 } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragFace, setDragFace] = useState<string | null>(null);
  const [hoveredHandle, setHoveredHandle] = useState<string | null>(null);

  const boxRef = useRef<THREE.Group>(null);
  const { camera, gl } = useThree();
  const raycaster = useRef(new THREE.Raycaster());
  const dragPlane = useRef(new THREE.Plane());
  const intersection = useRef(new THREE.Vector3());
  const startPosition = useRef(new THREE.Vector3());

  // Notify parent component about drag state changes
  useEffect(() => {
    onDragStateChange?.(isDragging);
  }, [isDragging, onDragStateChange]);

  // Calculate initial bounding box ONLY when we have a specific target object
  useEffect(() => {
    if (targetObject && isActive && targetObject.type !== 'Scene') {
      const box = new THREE.Box3().setFromObject(targetObject);
      
      if (!box.isEmpty()) {
        // Expand the box slightly for better visualization
        const size = box.getSize(new THREE.Vector3());
        const expansion = Math.max(size.x, size.y, size.z) * 0.1;
        box.expandByScalar(expansion);
        
        setBounds({
          min: box.min.clone(),
          max: box.max.clone(),
        });
      } else {
        // Fallback bounds if object has no geometry
        const center = new THREE.Vector3();
        targetObject.getWorldPosition(center);
        setBounds({
          min: new THREE.Vector3(center.x - 10, center.y - 10, center.z - 10),
          max: new THREE.Vector3(center.x + 10, center.y + 10, center.z + 10),
        });
      }
    } else {
      // Clear bounds when no specific object is selected or tool is inactive
      setBounds(null);
    }
  }, [targetObject, isActive]);

  // Apply clipping planes only when we have bounds and a valid target
  useEffect(() => {
    if (bounds && targetObject && isActive && targetObject.type !== 'Scene') {
      const clippingPlanes = [
        new THREE.Plane(new THREE.Vector3(-1, 0, 0), bounds.max.x),
        new THREE.Plane(new THREE.Vector3(1, 0, 0), -bounds.min.x),
        new THREE.Plane(new THREE.Vector3(0, -1, 0), bounds.max.y),
        new THREE.Plane(new THREE.Vector3(0, 1, 0), -bounds.min.y),
        new THREE.Plane(new THREE.Vector3(0, 0, -1), bounds.max.z),
        new THREE.Plane(new THREE.Vector3(0, 0, 1), -bounds.min.z),
      ];

      // Apply to target object
      targetObject.traverse((child) => {
        if (child instanceof THREE.Mesh && child.material) {
          const materials = Array.isArray(child.material) ? child.material : [child.material];
          materials.forEach(mat => {
            mat.clippingPlanes = clippingPlanes;
            mat.needsUpdate = true;
          });
        } else if (child instanceof THREE.Points && child.material) {
          child.material.clippingPlanes = clippingPlanes;
          child.material.needsUpdate = true;
        }
      });

      onSectionChange?.(bounds);
    } else if (targetObject && (!isActive || !bounds)) {
      // Clear clipping planes when tool is inactive or no bounds
      targetObject.traverse((child) => {
        if (child instanceof THREE.Mesh && child.material) {
          const materials = Array.isArray(child.material) ? child.material : [child.material];
          materials.forEach(mat => {
            mat.clippingPlanes = [];
            mat.needsUpdate = true;
          });
        } else if (child instanceof THREE.Points && child.material) {
          child.material.clippingPlanes = [];
          child.material.needsUpdate = true;
        }
      });
    }
  }, [bounds, targetObject, isActive, onSectionChange]);

  const handlePointerDown = (event: any, face: string) => {
    if (!bounds) return;

    event.stopPropagation();
    
    setIsDragging(true);
    setDragFace(face);

    // Set up drag plane based on face
    const normal = new THREE.Vector3();
    const point = new THREE.Vector3();

    switch (face) {
      case 'x-min':
        normal.set(1, 0, 0);
        point.set(bounds.min.x, 0, 0);
        break;
      case 'x-max':
        normal.set(1, 0, 0);
        point.set(bounds.max.x, 0, 0);
        break;
      case 'y-min':
        normal.set(0, 1, 0);
        point.set(0, bounds.min.y, 0);
        break;
      case 'y-max':
        normal.set(0, 1, 0);
        point.set(0, bounds.max.y, 0);
        break;
      case 'z-min':
        normal.set(0, 0, 1);
        point.set(0, 0, bounds.min.z);
        break;
      case 'z-max':
        normal.set(0, 0, 1);
        point.set(0, 0, bounds.max.z);
        break;
    }

    dragPlane.current.setFromNormalAndCoplanarPoint(normal, point);
    
    // Get initial intersection point
    const rect = gl.domElement.getBoundingClientRect();
    const mouse = new THREE.Vector2(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1
    );
    
    raycaster.current.setFromCamera(mouse, camera);
    raycaster.current.ray.intersectPlane(dragPlane.current, startPosition.current);
  };

  const handlePointerMove = (event: MouseEvent) => {
    if (!isDragging || !dragFace || !bounds) return;

    const rect = gl.domElement.getBoundingClientRect();
    const mouse = new THREE.Vector2(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1
    );

    raycaster.current.setFromCamera(mouse, camera);

    if (raycaster.current.ray.intersectPlane(dragPlane.current, intersection.current)) {
      const delta = intersection.current.clone().sub(startPosition.current);
      const newBounds = {
        min: bounds.min.clone(),
        max: bounds.max.clone(),
      };

      const minSize = 1.0; // Minimum size to prevent invalid bounds

      switch (dragFace) {
        case 'x-min':
          newBounds.min.x = Math.min(bounds.min.x + delta.x, newBounds.max.x - minSize);
          break;
        case 'x-max':
          newBounds.max.x = Math.max(bounds.max.x + delta.x, newBounds.min.x + minSize);
          break;
        case 'y-min':
          newBounds.min.y = Math.min(bounds.min.y + delta.y, newBounds.max.y - minSize);
          break;
        case 'y-max':
          newBounds.max.y = Math.max(bounds.max.y + delta.y, newBounds.min.y + minSize);
          break;
        case 'z-min':
          newBounds.min.z = Math.min(bounds.min.z + delta.z, newBounds.max.z - minSize);
          break;
        case 'z-max':
          newBounds.max.z = Math.max(bounds.max.z + delta.z, newBounds.min.z + minSize);
          break;
      }

      setBounds(newBounds);
    }
  };

  const handlePointerUp = () => {
    setIsDragging(false);
    setDragFace(null);
  };

  // Global event listeners for drag
  useEffect(() => {
    if (isDragging) {
      const canvas = gl.domElement;
      canvas.addEventListener('mousemove', handlePointerMove);
      canvas.addEventListener('mouseup', handlePointerUp);
      canvas.style.cursor = 'grabbing';

      return () => {
        canvas.removeEventListener('mousemove', handlePointerMove);
        canvas.removeEventListener('mouseup', handlePointerUp);
        canvas.style.cursor = 'default';
      };
    }
  }, [isDragging, dragFace, bounds, gl.domElement]);

  // Only render if we have bounds, the tool is active, and we have a specific target (not Scene)
  if (!bounds || !isActive || !targetObject || targetObject.type === 'Scene') return null;

  const center = bounds.min.clone().lerp(bounds.max, 0.5);
  const size = bounds.max.clone().sub(bounds.min);

  return (
    <group ref={boxRef}>
      {/* Wireframe box */}
      <mesh position={center}>
        <boxGeometry args={[size.x, size.y, size.z]} />
        <meshBasicMaterial wireframe color="#00FFFF" transparent opacity={0.8} />
      </mesh>

      {/* Semi-transparent faces */}
      <mesh position={center}>
        <boxGeometry args={[size.x, size.y, size.z]} />
        <meshBasicMaterial color="#00FFFF" transparent opacity={0.1} side={THREE.DoubleSide} />
      </mesh>

      {/* Control handles */}
      {[
        { face: 'x-min', position: [bounds.min.x, center.y, center.z], rotation: [0, 0, Math.PI / 2] },
        { face: 'x-max', position: [bounds.max.x, center.y, center.z], rotation: [0, 0, -Math.PI / 2] },
        { face: 'y-min', position: [center.x, bounds.min.y, center.z], rotation: [0, 0, Math.PI] },
        { face: 'y-max', position: [center.x, bounds.max.y, center.z], rotation: [0, 0, 0] },
        { face: 'z-min', position: [center.x, center.y, bounds.min.z], rotation: [Math.PI / 2, 0, 0] },
        { face: 'z-max', position: [center.x, center.y, bounds.max.z], rotation: [-Math.PI / 2, 0, 0] },
      ].map((handle) => {
        const isHovered = hoveredHandle === handle.face;
        const isDraggingThis = isDragging && dragFace === handle.face;
        
        return (
          <group
            key={handle.face}
            position={handle.position as [number, number, number]}
            rotation={handle.rotation as [number, number, number]}
          >
            <mesh
              onPointerDown={(e) => handlePointerDown(e, handle.face)}
              onPointerEnter={() => {
                setHoveredHandle(handle.face);
                gl.domElement.style.cursor = 'grab';
              }}
              onPointerLeave={() => {
                setHoveredHandle(null);
                if (!isDragging) gl.domElement.style.cursor = 'default';
              }}
            >
              <coneGeometry args={[2, 4, 8]} />
              <meshBasicMaterial 
                color={isDraggingThis ? "#FF0000" : (isHovered ? "#FFA500" : "#0066FF")} 
                transparent 
                opacity={0.9}
              />
            </mesh>
          </group>
        );
      })}
    </group>
  );
};
