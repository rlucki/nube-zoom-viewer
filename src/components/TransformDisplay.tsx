import React, { useState, useEffect } from 'react';
import { Card } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Button } from './ui/button';
import { RotateCcw } from 'lucide-react';
import * as THREE from 'three';

interface TransformDisplayProps {
  object: THREE.Object3D | null;
  mode: 'translate' | 'rotate';
  isVisible: boolean;
  onReset?: () => void;
}

export const TransformDisplay: React.FC<TransformDisplayProps> = ({
  object,
  mode,
  isVisible,
  onReset,
}) => {
  const getTransformHandle = (obj: THREE.Object3D | null): THREE.Object3D | null => {
    if (!obj) return null;
    if ((obj.userData as any)?.isTransformPivot) return obj;
    const pivot = (obj.userData as any)?.__transformPivot as THREE.Object3D | undefined;
    return pivot ?? obj;
  };

  const [originalTransform, setOriginalTransform] = useState<{
    position: THREE.Vector3;
    rotation: THREE.Euler;
    uuid: string;
  } | null>(null);

  const [currentValues, setCurrentValues] = useState({
    x: 0,
    y: 0,
    z: 0,
  });

  const syncFromObject = (obj: THREE.Object3D) => {
    if (mode === 'translate') {
      const worldPos = new THREE.Vector3();
      obj.getWorldPosition(worldPos);
      setCurrentValues({
        x: Math.round(worldPos.x * 1000) / 1000,
        y: Math.round(worldPos.y * 1000) / 1000,
        z: Math.round(worldPos.z * 1000) / 1000,
      });
    } else {
      setCurrentValues({
        x: Math.round(THREE.MathUtils.radToDeg(obj.rotation.x) * 100) / 100,
        y: Math.round(THREE.MathUtils.radToDeg(obj.rotation.y) * 100) / 100,
        z: Math.round(THREE.MathUtils.radToDeg(obj.rotation.z) * 100) / 100,
      });
    }
  };

  // Inicializar transformaciones cuando se selecciona un objeto o cambia el modo
  useEffect(() => {
    const handle = getTransformHandle(object);
    if (!handle) {
      setOriginalTransform(null);
      setCurrentValues({ x: 0, y: 0, z: 0 });
      return;
    }

    setOriginalTransform({
      position: handle.position.clone(),
      rotation: handle.rotation.clone(),
      uuid: handle.uuid,
    });

    syncFromObject(handle);
  }, [object, mode]);

  // Mantener UI sincronizada mientras se arrastra el gizmo (y también si el pivote se crea después)
  useEffect(() => {
    if (!isVisible) return;
    const handle = getTransformHandle(object);
    if (!handle) return;

    const id = window.setInterval(() => {
      syncFromObject(handle);
    }, 200);

    return () => window.clearInterval(id);
  }, [isVisible, object, mode]);

  const handleValueChange = (axis: 'x' | 'y' | 'z', value: string) => {
    const handle = getTransformHandle(object);
    if (!handle) return;

    const numValue = parseFloat(value);
    if (Number.isNaN(numValue)) return;

    if (mode === 'translate') {
      // Mover a coordenadas absolutas en espacio de mundo
      const worldPos = new THREE.Vector3();
      handle.getWorldPosition(worldPos);
      (worldPos as any)[axis] = numValue;

      let localPos = worldPos.clone();
      if (handle.parent) {
        localPos = handle.parent.worldToLocal(localPos);
      }
      handle.position.copy(localPos);
    } else {
      const rotationRad = THREE.MathUtils.degToRad(numValue);
      handle.rotation[axis] = rotationRad;
    }

    handle.updateMatrixWorld(true);

    // Actualizar UI con el nuevo valor
    setCurrentValues((prev) => ({
      ...prev,
      [axis]: numValue,
    }));
  };

  const handleReset = () => {
    const handle = getTransformHandle(object);
    if (!handle || !originalTransform) return;
    if (handle.uuid !== originalTransform.uuid) return;

    handle.position.copy(originalTransform.position);
    handle.rotation.copy(originalTransform.rotation);
    handle.updateMatrixWorld(true);

    syncFromObject(handle);
    onReset?.();
  };

  if (!isVisible || !object) return null;

  const unit = mode === 'translate' ? 'm' : '°';
  const title = mode === 'translate' ? 'Desplazamiento' : 'Rotación';

  return (
    <Card className="absolute top-20 right-4 p-4 w-72 bg-background/95 backdrop-blur-sm border border-border/50">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-foreground">{title}</h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleReset}
            className="h-6 w-6 p-0"
          >
            <RotateCcw className="h-3 w-3" />
          </Button>
        </div>
        
        <div className="space-y-2">
          {(['x', 'y', 'z'] as const).map((axis) => (
            <div key={axis} className="flex items-center gap-2">
              <Label 
                htmlFor={`transform-${axis}`} 
                className="w-6 text-xs font-mono uppercase"
                style={{ color: axis === 'x' ? '#ff6b6b' : axis === 'y' ? '#4ecdc4' : '#45b7d1' }}
              >
                {axis}:
              </Label>
              <Input
                id={`transform-${axis}`}
                type="number"
                step={mode === 'translate' ? 0.001 : 0.1}
                value={currentValues[axis]}
                onChange={(e) => handleValueChange(axis, e.target.value)}
                className="h-7 text-xs"
              />
              <span className="text-xs text-muted-foreground w-4">{unit}</span>
            </div>
          ))}
        </div>
        
        <div className="text-xs text-muted-foreground pt-1 border-t border-border/50">
          Objeto: {object.name || object.type}
        </div>
      </div>
    </Card>
  );
};