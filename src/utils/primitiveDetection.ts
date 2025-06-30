
import * as THREE from 'three';

export interface DetectedPlane {
  type: 'plane';
  id: string;
  normal: THREE.Vector3;
  point: THREE.Vector3;
  inliers: number[];
  confidence: number;
}

export interface DetectedCylinder {
  type: 'cylinder';
  id: string;
  axis: THREE.Vector3;
  direction: THREE.Vector3;
  radius: number;
  inliers: number[];
  confidence: number;
}

export type DetectedPrimitive = DetectedPlane | DetectedCylinder;

export interface DetectionParams {
  maxIterations: number;
  distanceThreshold: number;
  minInliers: number;
  planeEnabled: boolean;
  cylinderEnabled: boolean;
  cylinderMinRadius: number;
  cylinderMaxRadius: number;
}

export const defaultDetectionParams: DetectionParams = {
  maxIterations: 1000,
  distanceThreshold: 0.1,
  minInliers: 100,
  planeEnabled: true,
  cylinderEnabled: true,
  cylinderMinRadius: 0.1,
  cylinderMaxRadius: 5.0,
};

export class PrimitiveDetector {
  private points: THREE.Vector3[] = [];
  private params: DetectionParams;

  constructor(params: DetectionParams = defaultDetectionParams) {
    this.params = params;
  }

  setPoints(points: THREE.Vector3[]) {
    this.points = points;
  }

  detectAll(): DetectedPrimitive[] {
    const primitives: DetectedPrimitive[] = [];
    let remainingIndices = Array.from({ length: this.points.length }, (_, i) => i);

    // Detectar planos primero
    if (this.params.planeEnabled) {
      const planes = this.detectPlanes(remainingIndices);
      primitives.push(...planes);
      
      // Remover puntos que ya pertenecen a planos
      planes.forEach(plane => {
        remainingIndices = remainingIndices.filter(i => !plane.inliers.includes(i));
      });
    }

    // Detectar cilindros en puntos restantes
    if (this.params.cylinderEnabled && remainingIndices.length > this.params.minInliers) {
      const cylinders = this.detectCylinders(remainingIndices);
      primitives.push(...cylinders);
    }

    return primitives;
  }

  private detectPlanes(availableIndices: number[]): DetectedPlane[] {
    const planes: DetectedPlane[] = [];
    let remainingIndices = [...availableIndices];

    // Detectar hasta 3 planos principales
    for (let planeCount = 0; planeCount < 3 && remainingIndices.length > this.params.minInliers; planeCount++) {
      const plane = this.detectSinglePlane(remainingIndices);
      if (plane && plane.inliers.length >= this.params.minInliers) {
        planes.push(plane);
        remainingIndices = remainingIndices.filter(i => !plane.inliers.includes(i));
      } else {
        break;
      }
    }

    return planes;
  }

  private detectSinglePlane(availableIndices: number[]): DetectedPlane | null {
    let bestPlane: DetectedPlane | null = null;
    let maxInliers = 0;

    for (let iter = 0; iter < this.params.maxIterations; iter++) {
      // Seleccionar 3 puntos aleatorios
      const sampleIndices = this.randomSample(availableIndices, 3);
      if (sampleIndices.length < 3) continue;

      const p1 = this.points[sampleIndices[0]];
      const p2 = this.points[sampleIndices[1]];
      const p3 = this.points[sampleIndices[2]];

      // Calcular normal del plano
      const v1 = new THREE.Vector3().subVectors(p2, p1);
      const v2 = new THREE.Vector3().subVectors(p3, p1);
      const normal = new THREE.Vector3().crossVectors(v1, v2).normalize();

      if (normal.length() < 0.9) continue; // Skip degenerate planes

      // Encontrar inliers
      const inliers: number[] = [];
      availableIndices.forEach(idx => {
        const point = this.points[idx];
        const distance = Math.abs(normal.dot(new THREE.Vector3().subVectors(point, p1)));
        if (distance < this.params.distanceThreshold) {
          inliers.push(idx);
        }
      });

      if (inliers.length > maxInliers) {
        maxInliers = inliers.length;
        bestPlane = {
          type: 'plane',
          id: `plane_${Date.now()}_${iter}`,
          normal: normal.clone(),
          point: p1.clone(),
          inliers,
          confidence: inliers.length / availableIndices.length,
        };
      }
    }

    return bestPlane;
  }

  private detectCylinders(availableIndices: number[]): DetectedCylinder[] {
    const cylinders: DetectedCylinder[] = [];
    let remainingIndices = [...availableIndices];

    // Detectar hasta 2 cilindros
    for (let cylCount = 0; cylCount < 2 && remainingIndices.length > this.params.minInliers; cylCount++) {
      const cylinder = this.detectSingleCylinder(remainingIndices);
      if (cylinder && cylinder.inliers.length >= this.params.minInliers) {
        cylinders.push(cylinder);
        remainingIndices = remainingIndices.filter(i => !cylinder.inliers.includes(i));
      } else {
        break;
      }
    }

    return cylinders;
  }

  private detectSingleCylinder(availableIndices: number[]): DetectedCylinder | null {
    let bestCylinder: DetectedCylinder | null = null;
    let maxInliers = 0;

    for (let iter = 0; iter < this.params.maxIterations / 2; iter++) {
      // Seleccionar 5 puntos aleatorios para estimar cilindro
      const sampleIndices = this.randomSample(availableIndices, 5);
      if (sampleIndices.length < 5) continue;

      const samplePoints = sampleIndices.map(i => this.points[i]);
      const cylinder = this.fitCylinder(samplePoints);
      
      if (!cylinder) continue;

      // Verificar límites de radio
      if (cylinder.radius < this.params.cylinderMinRadius || 
          cylinder.radius > this.params.cylinderMaxRadius) {
        continue;
      }

      // Encontrar inliers
      const inliers: number[] = [];
      availableIndices.forEach(idx => {
        const point = this.points[idx];
        const distance = this.pointToCylinderDistance(point, cylinder.axis, cylinder.direction, cylinder.radius);
        if (distance < this.params.distanceThreshold) {
          inliers.push(idx);
        }
      });

      if (inliers.length > maxInliers) {
        maxInliers = inliers.length;
        bestCylinder = {
          type: 'cylinder',
          id: `cylinder_${Date.now()}_${iter}`,
          axis: cylinder.axis.clone(),
          direction: cylinder.direction.clone(),
          radius: cylinder.radius,
          inliers,
          confidence: inliers.length / availableIndices.length,
        };
      }
    }

    return bestCylinder;
  }

  private fitCylinder(points: THREE.Vector3[]): { axis: THREE.Vector3; direction: THREE.Vector3; radius: number } | null {
    if (points.length < 3) return null;

    // Simplificación: usar los primeros 3 puntos para estimar un cilindro básico
    const p1 = points[0];
    const p2 = points[1];
    const p3 = points[2];

    // Estimar eje como línea entre p1 y p2
    const direction = new THREE.Vector3().subVectors(p2, p1).normalize();
    
    // Calcular distancia de p3 al eje
    const toP3 = new THREE.Vector3().subVectors(p3, p1);
    const projection = direction.clone().multiplyScalar(direction.dot(toP3));
    const perpendicular = new THREE.Vector3().subVectors(toP3, projection);
    const radius = perpendicular.length();

    if (radius < 0.01) return null; // Evitar cilindros degenerados

    return {
      axis: p1.clone(),
      direction: direction,
      radius: radius,
    };
  }

  private pointToCylinderDistance(point: THREE.Vector3, axis: THREE.Vector3, direction: THREE.Vector3, radius: number): number {
    const toPoint = new THREE.Vector3().subVectors(point, axis);
    const projection = direction.clone().multiplyScalar(direction.dot(toPoint));
    const perpendicular = new THREE.Vector3().subVectors(toPoint, projection);
    const distanceToAxis = perpendicular.length();
    return Math.abs(distanceToAxis - radius);
  }

  private randomSample(array: number[], count: number): number[] {
    const shuffled = [...array].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
  }
}
