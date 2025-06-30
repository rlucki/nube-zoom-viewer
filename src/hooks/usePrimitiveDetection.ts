
import { useState, useCallback, useMemo } from 'react';
import * as THREE from 'three';
import { PrimitiveDetector, DetectedPrimitive, DetectionParams, defaultDetectionParams } from '../utils/primitiveDetection';
import type { Point } from '../components/PointCloudViewer';

export const usePrimitiveDetection = () => {
  const [primitives, setPrimitives] = useState<DetectedPrimitive[]>([]);
  const [isDetecting, setIsDetecting] = useState(false);
  const [params, setParams] = useState<DetectionParams>(defaultDetectionParams);

  const detector = useMemo(() => new PrimitiveDetector(params), [params]);

  const detectPrimitives = useCallback(async (points: Point[]) => {
    if (!points || points.length === 0) return;

    setIsDetecting(true);
    
    try {
      // Convertir a THREE.Vector3
      const vector3Points = points.map(p => new THREE.Vector3(p.x, p.y, p.z));
      
      // Ejecutar detección en un timeout para no bloquear UI
      const detected = await new Promise<DetectedPrimitive[]>((resolve) => {
        setTimeout(() => {
          detector.setPoints(vector3Points);
          const result = detector.detectAll();
          resolve(result);
        }, 10);
      });

      setPrimitives(detected);
      console.log(`Detected ${detected.length} primitives:`, detected);
    } catch (error) {
      console.error('Error detecting primitives:', error);
      setPrimitives([]);
    } finally {
      setIsDetecting(false);
    }
  }, [detector]);

  const clearPrimitives = useCallback(() => {
    setPrimitives([]);
  }, []);

  const updateParams = useCallback((newParams: Partial<DetectionParams>) => {
    setParams(prev => ({ ...prev, ...newParams }));
  }, []);

  // Función para obtener el punto más cercano en una primitiva
  const getSnapPoint = useCallback((worldPosition: THREE.Vector3, primitive: DetectedPrimitive): THREE.Vector3 => {
    if (primitive.type === 'plane') {
      // Proyectar punto al plano
      const toPoint = new THREE.Vector3().subVectors(worldPosition, primitive.point);
      const distance = primitive.normal.dot(toPoint);
      const projected = new THREE.Vector3().subVectors(worldPosition, primitive.normal.clone().multiplyScalar(distance));
      return projected;
    } else if (primitive.type === 'cylinder') {
      // Proyectar punto a la superficie del cilindro
      const toPoint = new THREE.Vector3().subVectors(worldPosition, primitive.axis);
      const alongAxis = primitive.direction.clone().multiplyScalar(primitive.direction.dot(toPoint));
      const radialComponent = new THREE.Vector3().subVectors(toPoint, alongAxis);
      
      if (radialComponent.length() > 0) {
        radialComponent.normalize().multiplyScalar(primitive.radius);
      }
      
      return new THREE.Vector3().addVectors(primitive.axis, alongAxis).add(radialComponent);
    }
    
    return worldPosition.clone();
  }, []);

  return {
    primitives,
    isDetecting,
    params,
    detectPrimitives,
    clearPrimitives,
    updateParams,
    getSnapPoint,
  };
};
