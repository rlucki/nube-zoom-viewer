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

  // Guardar transformación original cuando se selecciona un objeto
  useEffect(() => {
    if (object && !originalTransform) {
      setOriginalTransform({
        position: object.position.clone(),
        rotation: object.rotation.clone(),
      });
    }
    
    if (!object) {
      setOriginalTransform(null);
      setCurrentValues({ x: 0, y: 0, z: 0 });
    }
  }, [object, originalTransform]);

  // Actualizar valores actuales basados en la diferencia con el original
  useEffect(() => {
    if (object && originalTransform) {
      if (mode === 'translate') {
        const delta = object.position.clone().sub(originalTransform.position);
        setCurrentValues({
          x: Math.round(delta.x * 1000) / 1000,
          y: Math.round(delta.y * 1000) / 1000,
          z: Math.round(delta.z * 1000) / 1000,
        });
      } else if (mode === 'rotate') {
        const deltaRotation = {
          x: object.rotation.x - originalTransform.rotation.x,
          y: object.rotation.y - originalTransform.rotation.y,
          z: object.rotation.z - originalTransform.rotation.z,
        };
        setCurrentValues({
          x: Math.round(THREE.MathUtils.radToDeg(deltaRotation.x) * 100) / 100,
          y: Math.round(THREE.MathUtils.radToDeg(deltaRotation.y) * 100) / 100,
          z: Math.round(THREE.MathUtils.radToDeg(deltaRotation.z) * 100) / 100,
        });
      }
    }
  }, [object?.position, object?.rotation, originalTransform, mode]);

  const handleValueChange = (axis: 'x' | 'y' | 'z', value: string) => {
    if (!object || !originalTransform) return;
    
    const numValue = parseFloat(value) || 0;
    
    if (mode === 'translate') {
      const newPosition = originalTransform.position.clone();
      newPosition[axis] += numValue;
      object.position[axis] = newPosition[axis];
    } else if (mode === 'rotate') {
      const newRotation = originalTransform.rotation.clone();
      newRotation[axis] += THREE.MathUtils.degToRad(numValue);
      object.rotation[axis] = newRotation[axis];
    }
    
    object.updateMatrixWorld(true);
  };

  const handleReset = () => {
    if (!object || !originalTransform) return;
    
    object.position.copy(originalTransform.position);
    object.rotation.copy(originalTransform.rotation);
    object.updateMatrixWorld(true);
    setCurrentValues({ x: 0, y: 0, z: 0 });
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