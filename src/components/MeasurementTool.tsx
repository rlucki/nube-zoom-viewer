
import React, { useState, useRef, useEffect } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { Html } from '@react-three/drei';

interface MeasurementPoint {
  position: THREE.Vector3;
  id: string;
}

interface MeasurementToolProps {
  isActive: boolean;
  snapMode: 'none' | 'vertex' | 'edge' | 'face';
  orthoMode: 'none' | 'x' | 'y' | 'z';
  onMeasure?: (distance: number, points: [THREE.Vector3, THREE.Vector3]) => void;
}

export const MeasurementTool: React.FC<MeasurementToolProps> = ({
  isActive,
  snapMode,
  orthoMode,
  onMeasure,
}) => {
  const [points, setPoints] = useState<MeasurementPoint[]>([]);
  const [currentPoint, setCurrentPoint] = useState<THREE.Vector3 | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const { camera, scene, gl } = useThree();
  const raycaster = useRef(new THREE.Raycaster());
  const mouse = useRef(new THREE.Vector2());

  const handleClick = (event: MouseEvent) => {
    if (!isActive) return;

    mouse.current.x = (event.clientX / gl.domElement.clientWidth) * 2 - 1;
    mouse.current.y = -(event.clientY / gl.domElement.clientHeight) * 2 + 1;

    raycaster.current.setFromCamera(mouse.current, camera);
    const intersects = raycaster.current.intersectObjects(scene.children, true);

    if (intersects.length > 0) {
      let point = intersects[0].point.clone();

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
        };
        setPoints([newPoint]);
        setIsDrawing(true);
      } else if (points.length === 1) {
        // Second point - complete measurement
        const newPoint: MeasurementPoint = {
          position: point,
          id: Date.now().toString(),
        };
        setPoints([points[0], newPoint]);
        setIsDrawing(false);

        // Calculate distance
        const distance = points[0].position.distanceTo(point);
        onMeasure?.(distance, [points[0].position, point]);

        // Reset for next measurement
        setTimeout(() => setPoints([]), 100);
      }
    }
  };

  const handleMouseMove = (event: MouseEvent) => {
    if (!isActive || !isDrawing) return;

    mouse.current.x = (event.clientX / gl.domElement.clientWidth) * 2 - 1;
    mouse.current.y = -(event.clientY / gl.domElement.clientHeight) * 2 + 1;

    raycaster.current.setFromCamera(mouse.current, camera);
    const intersects = raycaster.current.intersectObjects(scene.children, true);

    if (intersects.length > 0) {
      let point = intersects[0].point.clone();

      if (snapMode !== 'none') {
        point = applySnap(point, intersects[0], snapMode);
      }

      if (orthoMode !== 'none' && points.length === 1) {
        point = applyOrthoConstraint(point, points[0].position, orthoMode);
      }

      setCurrentPoint(point);
    }
  };

  const applySnap = (point: THREE.Vector3, intersection: THREE.Intersection, mode: string): THREE.Vector3 => {
    // Simplified snap logic - in real implementation, you'd check geometry vertices/edges
    const snapTolerance = 0.5;
    
    if (mode === 'vertex') {
      // Snap to nearest vertex (simplified)
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
      gl.domElement.addEventListener('click', handleClick);
      gl.domElement.addEventListener('mousemove', handleMouseMove);
    }

    return () => {
      gl.domElement.removeEventListener('click', handleClick);
      gl.domElement.removeEventListener('mousemove', handleMouseMove);
    };
  }, [isActive, snapMode, orthoMode, points, isDrawing]);

  return (
    <>
      {/* Render measurement points */}
      {points.map((point) => (
        <mesh key={point.id} position={point.position}>
          <sphereGeometry args={[0.1]} />
          <meshBasicMaterial color="red" />
        </mesh>
      ))}

      {/* Render current point while drawing */}
      {currentPoint && isDrawing && (
        <mesh position={currentPoint}>
          <sphereGeometry args={[0.1]} />
          <meshBasicMaterial color="orange" />
        </mesh>
      )}

      {/* Render measurement line */}
      {points.length === 1 && currentPoint && (
        <line>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              count={2}
              array={new Float32Array([
                points[0].position.x, points[0].position.y, points[0].position.z,
                currentPoint.x, currentPoint.y, currentPoint.z,
              ])}
              itemSize={3}
            />
          </bufferGeometry>
          <lineBasicMaterial color="yellow" />
        </line>
      )}

      {/* Render completed measurement line */}
      {points.length === 2 && (
        <>
          <line>
            <bufferGeometry>
              <bufferAttribute
                attach="attributes-position"
                count={2}
                array={new Float32Array([
                  points[0].position.x, points[0].position.y, points[0].position.z,
                  points[1].position.x, points[1].position.y, points[1].position.z,
                ])}
                itemSize={3}
              />
            </bufferGeometry>
            <lineBasicMaterial color="green" />
          </line>
          
          {/* Distance label */}
          <Html position={points[0].position.clone().lerp(points[1].position, 0.5)}>
            <div className="bg-black text-white p-1 rounded text-xs">
              {points[0].position.distanceTo(points[1].position).toFixed(2)}m
            </div>
          </Html>
        </>
      )}
    </>
  );
};
