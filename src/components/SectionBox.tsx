
import React, { useState, useRef, useEffect } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';

interface SectionBoxProps {
  targetObject: THREE.Object3D | null;
  isActive: boolean;
  onSectionChange?: (bounds: { min: THREE.Vector3; max: THREE.Vector3 }) => void;
  onObjectSelection?: (object: THREE.Object3D | null) => void;
}

export const SectionBox: React.FC<SectionBoxProps> = ({
  targetObject,
  isActive,
  onSectionChange,
  onObjectSelection,
}) => {
  const [bounds, setBounds] = useState<{ min: THREE.Vector3; max: THREE.Vector3 } | null>(null);
  const [dragState, setDragState] = useState<{ 
    isDragging: boolean; 
    face: string | null; 
    startPoint: THREE.Vector3 | null;
  }>({ isDragging: false, face: null, startPoint: null });
  const [hoveredHandle, setHoveredHandle] = useState<string | null>(null);

  const boxRef = useRef<THREE.Group>(null);
  const { camera, scene, gl, raycaster, mouse } = useThree();
  const localRaycaster = useRef(new THREE.Raycaster());
  const localMouse = useRef(new THREE.Vector2());

  // Calculate bounding box for target object
  useEffect(() => {
    if (targetObject && isActive) {
      const box = new THREE.Box3().setFromObject(targetObject);
      // Expandir un poco el cubo para que sea visible
      const size = box.getSize(new THREE.Vector3());
      const expansion = Math.max(size.x, size.y, size.z) * 0.1;
      box.expandByScalar(expansion);
      
      setBounds({
        min: box.min.clone(),
        max: box.max.clone(),
      });
    } else if (!isActive) {
      setBounds(null);
    }
  }, [targetObject, isActive]);

  // Handle object selection when section tool is active
  const handleCanvasClick = (event: MouseEvent) => {
    if (!isActive) return;

    // Calcular posición del mouse
    const rect = gl.domElement.getBoundingClientRect();
    localMouse.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    localMouse.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    localRaycaster.current.setFromCamera(localMouse.current, camera);

    // Buscar intersecciones con objetos de la escena (excluyendo la UI)
    const intersectable: THREE.Object3D[] = [];
    scene.traverse((child) => {
      if (child.type === 'Mesh' || child.type === 'Group') {
        // Excluir helpers y UI elements
        if (!child.name.includes('helper') && 
            !child.name.includes('grid') && 
            !child.name.includes('axes') &&
            !child.userData.isUI) {
          intersectable.push(child);
        }
      }
    });

    const intersects = localRaycaster.current.intersectObjects(intersectable, true);
    
    if (intersects.length > 0) {
      // Encontrar el objeto padre más relevante
      let selectedObject = intersects[0].object;
      while (selectedObject.parent && selectedObject.parent.type !== 'Scene') {
        selectedObject = selectedObject.parent;
      }
      
      console.log('Objeto seleccionado para sección:', selectedObject);
      onObjectSelection?.(selectedObject);
    }
  };

  const handleMouseDown = (event: MouseEvent) => {
    if (!isActive || !bounds) return;

    const rect = gl.domElement.getBoundingClientRect();
    localMouse.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    localMouse.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    localRaycaster.current.setFromCamera(localMouse.current, camera);
    
    // Check intersection with section box handles
    const boxGroup = boxRef.current;
    if (boxGroup) {
      const intersects = localRaycaster.current.intersectObjects(boxGroup.children, true);
      if (intersects.length > 0) {
        const intersectedObject = intersects[0].object;
        const face = intersectedObject.userData.face;
        
        if (face) {
          setDragState({
            isDragging: true,
            face,
            startPoint: intersects[0].point.clone(),
          });
          event.stopPropagation();
        }
      } else {
        // Si no se hizo clic en un handle, intentar seleccionar objeto
        handleCanvasClick(event);
      }
    } else {
      // Si no hay cubo, intentar seleccionar objeto
      handleCanvasClick(event);
    }
  };

  const handleMouseMove = (event: MouseEvent) => {
    if (!isActive) return;

    const rect = gl.domElement.getBoundingClientRect();
    localMouse.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    localMouse.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    // Handle hover effects
    if (!dragState.isDragging && bounds) {
      localRaycaster.current.setFromCamera(localMouse.current, camera);
      const boxGroup = boxRef.current;
      if (boxGroup) {
        const intersects = localRaycaster.current.intersectObjects(boxGroup.children, true);
        if (intersects.length > 0) {
          const face = intersects[0].object.userData.face;
          setHoveredHandle(face);
          gl.domElement.style.cursor = 'pointer';
        } else {
          setHoveredHandle(null);
          gl.domElement.style.cursor = 'default';
        }
      }
    }

    // Handle dragging
    if (!dragState.isDragging || !bounds || !dragState.face) return;

    localRaycaster.current.setFromCamera(localMouse.current, camera);
    
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

    const intersectionPoint = localRaycaster.current.ray.intersectPlane(plane, worldPosition);
    if (!intersectionPoint) return;

    // Update bounds based on drag
    const newBounds = {
      min: bounds.min.clone(),
      max: bounds.max.clone(),
    };

    const minDistance = 0.5; // Distancia mínima entre caras

    switch (dragState.face) {
      case 'x-min':
        newBounds.min.x = Math.min(worldPosition.x, bounds.max.x - minDistance);
        break;
      case 'x-max':
        newBounds.max.x = Math.max(worldPosition.x, bounds.min.x + minDistance);
        break;
      case 'y-min':
        newBounds.min.y = Math.min(worldPosition.y, bounds.max.y - minDistance);
        break;
      case 'y-max':
        newBounds.max.y = Math.max(worldPosition.y, bounds.min.y + minDistance);
        break;
      case 'z-min':
        newBounds.min.z = Math.min(worldPosition.z, bounds.max.z - minDistance);
        break;
      case 'z-max':
        newBounds.max.z = Math.max(worldPosition.z, bounds.min.z + minDistance);
        break;
    }

    setBounds(newBounds);
    onSectionChange?.(newBounds);
  };

  const handleMouseUp = () => {
    setDragState({ isDragging: false, face: null, startPoint: null });
    gl.domElement.style.cursor = 'default';
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
      gl.domElement.style.cursor = 'default';
    };
  }, [isActive, dragState, bounds]);

  if (!bounds || !isActive) return null;

  const center = bounds.min.clone().lerp(bounds.max, 0.5);
  const size = bounds.max.clone().sub(bounds.min);

  return (
    <group ref={boxRef}>
      {/* Section box wireframe */}
      <mesh position={center}>
        <boxGeometry args={[size.x, size.y, size.z]} />
        <meshBasicMaterial wireframe color="yellow" transparent opacity={0.4} />
      </mesh>

      {/* Section box faces for better visibility */}
      <mesh position={center}>
        <boxGeometry args={[size.x, size.y, size.z]} />
        <meshBasicMaterial color="yellow" transparent opacity={0.1} side={THREE.DoubleSide} />
      </mesh>

      {/* Drag handles (triangular cones) */}
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
              <coneGeometry args={[0.3, 0.6, 3]} />
              <meshBasicMaterial 
                color={isDragging ? "red" : (isHovered ? "orange" : "blue")} 
                transparent 
                opacity={0.8}
              />
            </mesh>
            {/* Handle shaft */}
            <mesh position={[0, 0.4, 0]} userData={{ face: handle.face }}>
              <cylinderGeometry args={[0.08, 0.08, 0.8]} />
              <meshBasicMaterial 
                color={isDragging ? "red" : (isHovered ? "orange" : "blue")} 
                transparent 
                opacity={0.6}
              />
            </mesh>
          </group>
        );
      })}

      {/* Face labels for better UX */}
      {[
        { face: 'x-min', position: [bounds.min.x - 0.5, center.y, center.z], text: 'X-' },
        { face: 'x-max', position: [bounds.max.x + 0.5, center.y, center.z], text: 'X+' },
        { face: 'y-min', position: [center.x, bounds.min.y - 0.5, center.z], text: 'Y-' },
        { face: 'y-max', position: [center.x, bounds.max.y + 0.5, center.z], text: 'Y+' },
        { face: 'z-min', position: [center.x, center.y, bounds.min.z - 0.5], text: 'Z-' },
        { face: 'z-max', position: [center.x, center.y, bounds.max.z + 0.5], text: 'Z+' },
      ].map((label) => (
        <mesh key={label.face} position={label.position as [number, number, number]}>
          <planeGeometry args={[0.5, 0.2]} />
          <meshBasicMaterial color="white" transparent opacity={0.8} />
        </mesh>
      ))}
    </group>
  );
};
