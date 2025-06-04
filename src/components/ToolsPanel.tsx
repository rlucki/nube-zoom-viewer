
import React from 'react';
import * as THREE from 'three';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface ToolsPanelProps {
  measurementActive: boolean;
  setMeasurementActive: (active: boolean) => void;
  sectionBoxActive: boolean;
  setSectionBoxActive: (active: boolean) => void;
  transformActive: boolean;
  setTransformActive: (active: boolean) => void;
  transformMode: 'translate' | 'rotate';
  setTransformMode: (mode: 'translate' | 'rotate') => void;
  snapMode: 'none' | 'vertex' | 'edge' | 'face';
  setSnapMode: (mode: 'none' | 'vertex' | 'edge' | 'face') => void;
  orthoMode: 'none' | 'x' | 'y' | 'z';
  setOrthoMode: (mode: 'none' | 'x' | 'y' | 'z') => void;
  measurements: Array<{ distance: number; points: [THREE.Vector3, THREE.Vector3] }>;
  onClearMeasurements: () => void;
}

export const ToolsPanel: React.FC<ToolsPanelProps> = ({
  measurementActive,
  setMeasurementActive,
  sectionBoxActive,
  setSectionBoxActive,
  transformActive,
  setTransformActive,
  transformMode,
  setTransformMode,
  snapMode,
  setSnapMode,
  orthoMode,
  setOrthoMode,
  measurements,
  onClearMeasurements,
}) => {
  return (
    <Card className="absolute top-4 right-4 z-10 p-4 bg-black/80 backdrop-blur-sm border-gray-700 text-white min-w-80">
      <div className="space-y-4">
        <div className="text-lg font-semibold border-b border-gray-700 pb-2">
          Herramientas BIM
        </div>

        {/* Measurement Tools */}
        <div className="space-y-3">
          <Label className="text-white font-medium">Herramientas de Medición</Label>
          
          <div className="flex gap-2">
            <Button
              onClick={() => setMeasurementActive(!measurementActive)}
              variant={measurementActive ? "default" : "outline"}
              size="sm"
              className={measurementActive ? "bg-blue-600 hover:bg-blue-700" : ""}
            >
              {measurementActive ? "Desactivar Medición" : "Activar Medición"}
            </Button>
            
            <Button
              onClick={() => setSectionBoxActive(!sectionBoxActive)}
              variant={sectionBoxActive ? "default" : "outline"}
              size="sm"
              className={sectionBoxActive ? "bg-green-600 hover:bg-green-700" : ""}
            >
              {sectionBoxActive ? "Desactivar Sección" : "Activar Sección"}
            </Button>
          </div>

          {/* Snap Mode */}
          <div className="space-y-2">
            <Label className="text-white">Modo de Snap</Label>
            <Select value={snapMode} onValueChange={setSnapMode}>
              <SelectTrigger className="bg-gray-800 border-gray-600 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-gray-800 border-gray-600">
                <SelectItem value="none" className="text-white hover:bg-gray-700">Sin Snap</SelectItem>
                <SelectItem value="vertex" className="text-white hover:bg-gray-700">Snap a Vértices</SelectItem>
                <SelectItem value="edge" className="text-white hover:bg-gray-700">Snap a Aristas</SelectItem>
                <SelectItem value="face" className="text-white hover:bg-gray-700">Snap a Caras</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Ortho Mode */}
          <div className="space-y-2">
            <Label className="text-white">Modo Ortogonal</Label>
            <Select value={orthoMode} onValueChange={setOrthoMode}>
              <SelectTrigger className="bg-gray-800 border-gray-600 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-gray-800 border-gray-600">
                <SelectItem value="none" className="text-white hover:bg-gray-700">Libre</SelectItem>
                <SelectItem value="x" className="text-white hover:bg-gray-700">Bloquear X</SelectItem>
                <SelectItem value="y" className="text-white hover:bg-gray-700">Bloquear Y</SelectItem>
                <SelectItem value="z" className="text-white hover:bg-gray-700">Bloquear Z</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Transform Tools */}
        <div className="space-y-3">
          <Label className="text-white font-medium">Transformar</Label>
          <div className="flex gap-2 items-center">
            <Button
              onClick={() => setTransformActive(!transformActive)}
              variant={transformActive ? 'default' : 'outline'}
              size="sm"
              className={transformActive ? 'bg-purple-600 hover:bg-purple-700' : ''}
            >
              {transformActive ? 'Desactivar' : 'Activar'}
            </Button>
            <Select value={transformMode} onValueChange={setTransformMode}>
              <SelectTrigger className="bg-gray-800 border-gray-600 text-white w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-gray-800 border-gray-600">
                <SelectItem value="translate" className="text-white hover:bg-gray-700">Mover</SelectItem>
                <SelectItem value="rotate" className="text-white hover:bg-gray-700">Rotar</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Measurements List */}
        {measurements.length > 0 && (
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <Label className="text-white font-medium">Mediciones</Label>
              <Button onClick={onClearMeasurements} size="sm" variant="outline">
                Limpiar
              </Button>
            </div>
            <div className="max-h-32 overflow-y-auto space-y-1">
              {measurements.map((measurement, index) => (
                <div key={index} className="text-sm text-gray-300 bg-gray-700/50 p-2 rounded">
                  Medida {index + 1}: {measurement.distance.toFixed(3)}m
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Instructions */}
        <div className="text-xs text-gray-400 border-t border-gray-700 pt-2 space-y-1">
          <div>• Medición: Click en dos puntos para medir</div>
          <div>• Sección: Selecciona modelo y arrastra flechas azules</div>
          <div>• Snap: Ajusta automáticamente a elementos</div>
          <div>• Ortogonal: Bloquea movimiento en un eje</div>
          <div>• Transformar: Selecciona un objeto y usa los ejes de colores</div>
        </div>
      </div>
    </Card>
  );
};
