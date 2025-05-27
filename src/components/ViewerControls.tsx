
import React from 'react';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface ViewerControlsProps {
  density: number;
  setDensity: (value: number) => void;
  pointSize: number;
  setPointSize: (value: number) => void;
  colorMode: 'rgb' | 'intensity' | 'height';
  setColorMode: (mode: 'rgb' | 'intensity' | 'height') => void;
  totalPoints: number;
  visiblePoints: number;
}

export const ViewerControls: React.FC<ViewerControlsProps> = ({
  density,
  setDensity,
  pointSize,
  setPointSize,
  colorMode,
  setColorMode,
  totalPoints,
  visiblePoints,
}) => {
  return (
    <Card className="absolute top-20 left-4 z-10 p-4 bg-black/80 backdrop-blur-sm border-gray-700 text-white min-w-72">
      <div className="space-y-4">
        <div className="text-lg font-semibold border-b border-gray-700 pb-2">
          Controles de Visualización
        </div>
        
        {/* Point Statistics */}
        <div className="text-sm text-gray-300 space-y-1">
          <div>Total de puntos: {totalPoints.toLocaleString()}</div>
          <div>Puntos visibles: {visiblePoints.toLocaleString()}</div>
          <div>Densidad: {Math.round(density * 100)}%</div>
        </div>

        {/* Density Control */}
        <div className="space-y-2">
          <Label className="text-white">Densidad de Puntos</Label>
          <Slider
            value={[density]}
            onValueChange={(values) => setDensity(values[0])}
            min={0.01}
            max={1}
            step={0.01}
            className="w-full"
          />
          <div className="text-xs text-gray-400">
            {Math.round(density * 100)}% ({visiblePoints.toLocaleString()} puntos)
          </div>
        </div>

        {/* Point Size Control */}
        <div className="space-y-2">
          <Label className="text-white">Tamaño de Punto</Label>
          <Slider
            value={[pointSize]}
            onValueChange={(values) => setPointSize(values[0])}
            min={0.5}
            max={10}
            step={0.1}
            className="w-full"
          />
          <div className="text-xs text-gray-400">
            {pointSize.toFixed(1)} píxeles
          </div>
        </div>

        {/* Color Mode */}
        <div className="space-y-2">
          <Label className="text-white">Modo de Color</Label>
          <Select value={colorMode} onValueChange={setColorMode}>
            <SelectTrigger className="bg-gray-800 border-gray-600 text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-gray-800 border-gray-600">
              <SelectItem value="rgb" className="text-white hover:bg-gray-700">
                RGB (Color original)
              </SelectItem>
              <SelectItem value="intensity" className="text-white hover:bg-gray-700">
                Intensidad
              </SelectItem>
              <SelectItem value="height" className="text-white hover:bg-gray-700">
                Altura (Z)
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Instructions */}
        <div className="text-xs text-gray-400 border-t border-gray-700 pt-2 space-y-1">
          <div>• Click y arrastra para rotar</div>
          <div>• Scroll para hacer zoom</div>
          <div>• Click derecho y arrastra para mover</div>
        </div>
      </div>
    </Card>
  );
};
