
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
    <Card className="absolute top-2 left-1/2 -translate-x-1/2 z-10 p-2 bg-black/80 backdrop-blur-sm border-gray-700 text-white flex flex-wrap gap-2 items-center">
      <Button
        onClick={() => setMeasurementActive(!measurementActive)}
        variant={measurementActive ? 'default' : 'outline'}
        size="sm"
        className={measurementActive ? 'bg-blue-600 hover:bg-blue-700' : ''}
      >
        {measurementActive ? 'Medir On' : 'Medir Off'}
      </Button>
      <Button
        onClick={() => setSectionBoxActive(!sectionBoxActive)}
        variant={sectionBoxActive ? 'default' : 'outline'}
        size="sm"
        className={sectionBoxActive ? 'bg-green-600 hover:bg-green-700' : ''}
      >
        {sectionBoxActive ? 'Sección On' : 'Sección Off'}
      </Button>
      <Button
        onClick={() => setTransformActive(!transformActive)}
        variant={transformActive ? 'default' : 'outline'}
        size="sm"
        className={transformActive ? 'bg-purple-600 hover:bg-purple-700' : ''}
      >
        {transformActive ? 'Mover/Rotar On' : 'Mover/Rotar Off'}
      </Button>
      <Select value={transformMode} onValueChange={setTransformMode}>
        <SelectTrigger className="bg-gray-800 border-gray-600 text-white w-24">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="bg-gray-800 border-gray-600">
          <SelectItem value="translate" className="text-white hover:bg-gray-700">Mover</SelectItem>
          <SelectItem value="rotate" className="text-white hover:bg-gray-700">Rotar</SelectItem>
        </SelectContent>
      </Select>
      <Select value={snapMode} onValueChange={setSnapMode}>
        <SelectTrigger className="bg-gray-800 border-gray-600 text-white w-24">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="bg-gray-800 border-gray-600">
          <SelectItem value="none" className="text-white hover:bg-gray-700">Sin Snap</SelectItem>
          <SelectItem value="vertex" className="text-white hover:bg-gray-700">Vértice</SelectItem>
          <SelectItem value="edge" className="text-white hover:bg-gray-700">Arista</SelectItem>
          <SelectItem value="face" className="text-white hover:bg-gray-700">Cara</SelectItem>
        </SelectContent>
      </Select>
      <Select value={orthoMode} onValueChange={setOrthoMode}>
        <SelectTrigger className="bg-gray-800 border-gray-600 text-white w-24">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="bg-gray-800 border-gray-600">
          <SelectItem value="none" className="text-white hover:bg-gray-700">Libre</SelectItem>
          <SelectItem value="x" className="text-white hover:bg-gray-700">Bloq X</SelectItem>
          <SelectItem value="y" className="text-white hover:bg-gray-700">Bloq Y</SelectItem>
          <SelectItem value="z" className="text-white hover:bg-gray-700">Bloq Z</SelectItem>
        </SelectContent>
      </Select>
      {measurements.length > 0 && (
        <Button onClick={onClearMeasurements} size="sm" variant="outline">
          Limpiar
        </Button>
      )}
    </Card>
  );
};
