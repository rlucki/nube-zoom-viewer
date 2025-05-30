
import React, { useState, useRef, useEffect, useCallback } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { Html } from '@react-three/drei';

interface MeasurementPoint {
  position: THREE.Vector3;
  id: string;
  objectHit?: THREE.Object3D;
}

interface MeasurementToolProps {
  isActive: boolean;
  snapMode: 'none' | 'vertex' | 'edge' | 'face';
  orthoMode: 'none' | 'x' | 'y' | 'z';
  onMeasure?: (distance: number, points: [THREE.Vector3, THREE.Vector3]) => void;
  onSnapModeChange?: (mode: 'none' | 'vertex' | 'edge' | 'face') => void;
}

export const MeasurementTool: React.FC<MeasurementToolProps> = ({
  isActive,
  snapMode,
  orthoMode,
  onMeasure,
  onSnapModeChange,
}) => {
  const [points, setPoints] = useState<MeasurementPoint[]>([]);
  const [currentPoint, setCurrentPoint] = useState<THREE.Vector3 | null>(null);
  const [currentDistance, setCurrentDistance] = useState<number>(0);
  const [isDrawing, setIsDrawing] = useState(false);
  const [highlightedObject, setHighlightedObject] = useState<THREE.Object3D | null>(null);
  const [originalMaterial, setOriginalMaterial] = useState<THREE.Material | null>(null);
  const { camera, scene, gl } = useThree();
  const raycaster = useRef(new THREE.Raycaster());
  const mouse = useRef(new THREE.Vector2());

  // Filter only 3D model objects, excluding grid, axes, and UI elements
  const getModelObjects = useCallback(() => {
    const modelObjects: THREE.Object3D[] = [];
    scene.traverse((child) => {
      if (child.type === 'Mesh' && 
          child.name !== 'grid' && 
          child.name !== 'axes' &&
          child.parent?.name !== 'grid' &&
          child.parent?.name !== 'axes') {
        modelObjects.push(child);
      }
    });
    return modelObjects;
  }, [scene]);

  // Handle shift key for snap mode cycling
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isActive || event.key !== 'Shift') return;
      
      const snapModes: ('none' | 'vertex' | 'edge' | 'face')[] = ['none', 'vertex', 'edge', 'face'];
      const currentIndex = snapModes.indexOf(snapMode);
      const nextIndex = (currentIndex + 1) % snapModes.length;
      onSnapModeChange?.(snapModes[nextIndex]);
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isActive, snapMode, onSnapModeChange]);

  // Highlight object with visual feedback
  const highlightObject = useCallback((object: THREE.Object3D | null) => {
    // Restore previous object
    if (highlightedObject && originalMaterial) {
      const mesh = highlightedObject as THREE.Mesh;
      if (mesh.material) {
        mesh.material = originalMaterial;
      }
    }

    if (object) {
      const mesh = object as THREE.Mesh;
      if (mesh.material) {
        setOriginalMaterial(mesh.material as THREE.Material);
        
        // Create highlight material
        const highlightMaterial = (mesh.material as THREE.Material).clone();
        if ('color' in highlightMaterial) {
          (highlightMaterial as any).color.multiplyScalar(1.5);
        }
        if ('emissive' in highlightMaterial) {
          (highlightMaterial as any).emissive.setHex(0x444444);
        }
        
        mesh.material = highlightMaterial;
      }
    }

    setHighlightedObject(object);
  }, [highlightedObject, originalMaterial]);

  const handleClick = (event: MouseEvent) => {
    if (!isActive) return;

    // Don't block event propagation to allow camera controls
    mouse.current.x = (event.clientX / gl.domElement.clientWidth) * 2 - 1;
    mouse.current.y = -(event.clientY / gl.domElement.clientHeight) * 2 + 1;

    raycaster.current.setFromCamera(mouse.current, camera);
    const modelObjects = getModelObjects();
    const intersects = raycaster.current.intersectObjects(modelObjects, true);

    if (intersects.length > 0) {
      let point = intersects[0].point.clone();
      const hitObject = intersects[0].object;

      // Apply snap logic
      if (snapMode !== 'none') {
        point = applySnap(point, intersects[0], snapMode);
      }

      // Apply orthogonal constraint
      if (orthoMode !== 'none' && points.length === 1) {
        point = applyOrthoConstraint(point, points[0].position, orthoMode);
      }

      if (points.length === 0) {
        // First point
        const newPoint: MeasurementPoint = {
          position: point,
          id: Date.now().toString(),
          objectHit: hitObject,
        };
        setPoints([newPoint]);
        setIsDrawing(true);
        highlightObject(hitObject);
      } else if (points.length === 1) {
        // Second point - complete measurement
        const newPoint: MeasurementPoint = {
          position: point,
          id: Date.now().toString(),
          objectHit: hitObject,
        };
        setPoints([points[0], newPoint]);
        setIsDrawing(false);

        // Calculate distance
        const distance = points[0].position.distanceTo(point);
        onMeasure?.(distance, [points[0].position, point]);

        // Clear highlight
        highlightObject(null);

        // Reset for next measurement
        setTimeout(() => {
          setPoints([]);
          setCurrentPoint(null);
          setCurrentDistance(0);
        }, 100);
      }
    }
  };

  const handleMouseMove = (event: MouseEvent) => {
    if (!isActive) return;

    mouse.current.x = (event.clientX / gl.domElement.clientWidth) * 2 - 1;
    mouse.current.y = -(event.clientY / gl.domElement.clientHeight) * 2 + 1;

    raycaster.current.setFromCamera(mouse.current, camera);
    const modelObjects = getModelObjects();
    const intersects = raycaster.current.intersectObjects(modelObjects, true);

    if (intersects.length > 0) {
      let point = intersects[0].point.clone();
      const hitObject = intersects[0].object;

      if (snapMode !== 'none') {
        point = applySnap(point, intersects[0], snapMode);
      }

      if (orthoMode !== 'none' && points.length === 1) {
        point = applyOrthoConstraint(point, points[0].position, orthoMode);
      }

      setCurrentPoint(point);

      // Update real-time distance
      if (isDrawing && points.length === 1) {
        const distance = points[0].position.distanceTo(point);
        setCurrentDistance(distance);
      }

      // Highlight object on hover when not drawing
      if (!isDrawing) {
        highlightObject(hitObject);
      }
    } else {
      setCurrentPoint(null);
      if (!isDrawing) {
        highlightObject(null);
      }
    }
  };

  const applySnap = (point: THREE.Vector3, intersection: THREE.Intersection, mode: string): THREE.Vector3 => {
    const snapTolerance = 0.5;
    
    if (mode === 'vertex') {
      const object = intersection.object as THREE.Mesh;
      if (object.geometry && object.geometry instanceof THREE.BufferGeometry) {
        const geometry = object.geometry;
        if (geometry.attributes.position) {
          const positions = geometry.attributes.position.array;
          let closestVertex = point.clone();
          let minDistance = Infinity;

          for (let i = 0; i < positions.length; i += 3) {
            const vertex = new THREE.Vector3(positions[i], positions[i + 1], positions[i + 2]);
            vertex.applyMatrix4(intersection.object.matrixWorld);
            const distance = point.distanceTo(vertex);
            
            if (distance < minDistance && distance < snapTolerance) {
              minDistance = distance;
              closestVertex = vertex;
            }
          }
          return closestVertex;
        }
      }
    } else if (mode === 'face') {
      // Snap to face center
      if (intersection.face) {
        return intersection.point.clone();
      }
    }

    return point;
  };

  const applyOrthoConstraint = (point: THREE.Vector3, startPoint: THREE.Vector3, axis: string): THREE.Vector3 => {
    const constrainedPoint = point.clone();
    
    switch (axis) {
      case 'x':
        constrainedPoint.y = startPoint.y;
        constrainedPoint.z = startPoint.z;
        break;
      case 'y':
        constrainedPoint.x = startPoint.x;
        constrainedPoint.z = startPoint.z;
        break;
      case 'z':
        constrainedPoint.x = startPoint.x;
        constrainedPoint.y = startPoint.y;
        break;
    }
    
    return constrainedPoint;
  };

  useEffect(() => {
    if (isActive) {
      // Use capture phase to handle events before OrbitControls
      gl.domElement.addEventListener('click', handleClick, true);
      gl.domElement.addEventListener('mousemove', handleMouseMove, true);
    }

    return () => {
      gl.domElement.removeEventListener('click', handleClick, true);
      gl.domElement.removeEventListener('mousemove', handleMouseMove, true);
      // Clean up highlight when deactivating
      highlightObject(null);
    };
  }, [isActive, snapMode, orthoMode, points, isDrawing]);

  // Create line geometry for rendering
  const createLineGeometry = (point1: THREE.Vector3, point2: THREE.Vector3) => {
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array([
      point1.x, point1.y, point1.z,
      point2.x, point2.y, point2.z,
    ]);
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    return geometry;
  };

  return (
    <>
      {/* Render measurement points */}
      {points.map((point) => (
        <mesh key={point.id} position={point.position}>
          <sphereGeometry args={[0.15]} />
          <meshBasicMaterial color="red" />
        </mesh>
      ))}

      {/* Render current point while drawing */}
      {currentPoint && isDrawing && (
        <mesh position={currentPoint}>
          <sphereGeometry args={[0.12]} />
          <meshBasicMaterial color="orange" />
        </mesh>
      )}

      {/* Render measurement line with real-time distance */}
      {points.length === 1 && currentPoint && (
        <>
          <primitive object={new THREE.Line(
            createLineGeometry(points[0].position, currentPoint),
            new THREE.LineBasicMaterial({ color: 'yellow', linewidth: 2 })
          )} />
          
          {/* Real-time distance label */}
          <Html position={points[0].position.clone().lerp(currentPoint, 0.5)}>
            <div className="bg-yellow-600 text-white p-1 rounded text-xs font-mono">
              {currentDistance.toFixed(3)}m
            </div>
          </Html>
        </>
      )}

      {/* Render completed measurement line */}
      {points.length === 2 && (
        <>
          <primitive object={new THREE.Line(
            createLineGeometry(points[0].position, points[1].position),
            new THREE.LineBasicMaterial({ color: 'green', linewidth: 3 })
          )} />
          
          {/* Final distance label */}
          <Html position={points[0].position.clone().lerp(points[1].position, 0.5)}>
            <div className="bg-green-600 text-white p-2 rounded text-sm font-mono font-bold">
              {points[0].position.distanceTo(points[1].position).toFixed(3)}m
            </div>
          </Html>
        </>
      )}

      {/* Snap mode indicator */}
      {isActive && (
        <Html position={[0, 0, 0]} style={{ pointerEvents: 'none' }}>
          <div className="fixed top-20 left-4 bg-blue-600 text-white p-2 rounded text-xs">
            Snap: {snapMode.toUpperCase()} | Ortho: {orthoMode.toUpperCase()} | Press SHIFT to cycle snaps
          </div>
        </Html>
      )}
    </>
  );
};
