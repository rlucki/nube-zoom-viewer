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
  const [originalTransform, setOriginalTransform] = useState<{
    position: THREE.Vector3;
    rotation: THREE.Euler;
  } | null>(null);
  
  const [currentValues, setCurrentValues] = useState({
    x: 0,
    y: 0,
    z: 0,
  });

  // Inicializar transformaciones cuando se selecciona un objeto o cambia el modo
  useEffect(() => {
    if (!object) {
      setOriginalTransform(null);
      setCurrentValues({ x: 0, y: 0, z: 0 });
      return;
    }

    // Guardar transformación original para poder resetear
    setOriginalTransform({
      position: object.position.clone(),
      rotation: object.rotation.clone(),
    });

    if (mode === 'translate') {
      // Usar coordenadas absolutas en espacio de mundo
      const worldPos = new THREE.Vector3();
      object.getWorldPosition(worldPos);
      setCurrentValues({
        x: Math.round(worldPos.x * 1000) / 1000,
        y: Math.round(worldPos.y * 1000) / 1000,
        z: Math.round(worldPos.z * 1000) / 1000,
      });
    } else if (mode === 'rotate') {
      // Mostrar rotación absoluta en grados
      setCurrentValues({
        x: Math.round(THREE.MathUtils.radToDeg(object.rotation.x) * 100) / 100,
        y: Math.round(THREE.MathUtils.radToDeg(object.rotation.y) * 100) / 100,
        z: Math.round(THREE.MathUtils.radToDeg(object.rotation.z) * 100) / 100,
      });
    }
  }, [object, mode]);

  const handleValueChange = (axis: 'x' | 'y' | 'z', value: string) => {
    if (!object) return;

    const numValue = parseFloat(value);
    if (Number.isNaN(numValue)) return;

    if (mode === 'translate') {
      // Mover a coordenadas absolutas en espacio de mundo
      const worldPos = new THREE.Vector3();
      object.getWorldPosition(worldPos);
      (worldPos as any)[axis] = numValue;

      let localPos = worldPos.clone();
      if (object.parent) {
        localPos = object.parent.worldToLocal(localPos);
      }
      object.position.copy(localPos);
    } else if (mode === 'rotate') {
      const rotationRad = THREE.MathUtils.degToRad(numValue);
      object.rotation[axis] = rotationRad;
    }

    object.updateMatrixWorld(true);

    // Actualizar UI con el nuevo valor
    setCurrentValues((prev) => ({
      ...prev,
      [axis]: numValue,
    }));
  };

  const handleReset = () => {
    if (!object || !originalTransform) return;
    
    object.position.copy(originalTransform.position);
    object.rotation.copy(originalTransform.rotation);
    object.updateMatrixWorld(true);

    if (mode === 'translate') {
      const worldPos = new THREE.Vector3();
      object.getWorldPosition(worldPos);
      setCurrentValues({
        x: Math.round(worldPos.x * 1000) / 1000,
        y: Math.round(worldPos.y * 1000) / 1000,
        z: Math.round(worldPos.z * 1000) / 1000,
      });
    } else if (mode === 'rotate') {
      setCurrentValues({
        x: Math.round(THREE.MathUtils.radToDeg(object.rotation.x) * 100) / 100,
        y: Math.round(THREE.MathUtils.radToDeg(object.rotation.y) * 100) / 100,
        z: Math.round(THREE.MathUtils.radToDeg(object.rotation.z) * 100) / 100,
      });
    }

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