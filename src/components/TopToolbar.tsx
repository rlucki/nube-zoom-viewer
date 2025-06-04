
import React from 'react';
import { Upload, RotateCcw, Move, Ruler, RotateCw, Box, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileUploader } from './FileUploader';

interface TopToolbarProps {
  onClear: () => void;
  onResetCamera: () => void;
  measurementActive: boolean;
  onMeasurementToggle: (active: boolean) => void;
  sectionBoxActive: boolean;
  onSectionBoxToggle: (active: boolean) => void;
  transformActive: boolean;
  onTransformToggle: (active: boolean) => void;
  transformMode: 'translate' | 'rotate';
  onTransformModeChange: (mode: 'translate' | 'rotate') => void;
  onFileLoad: (data: any, fileName: string) => void;
  setIsLoading: (loading: boolean) => void;
  isLoading: boolean;
  hasFiles: boolean;
  snapMode: 'none' | 'vertex' | 'edge' | 'face';
  setSnapMode: (mode: 'none' | 'vertex' | 'edge' | 'face') => void;
  orthoMode: 'none' | 'x' | 'y' | 'z';
  setOrthoMode: (mode: 'none' | 'x' | 'y' | 'z') => void;
  measurements: Array<{ distance: number; points: [any, any] }>;
  onClearMeasurements: () => void;
}

export const TopToolbar: React.FC<TopToolbarProps> = ({
  onClear,
  onResetCamera,
  measurementActive,
  onMeasurementToggle,
  sectionBoxActive,
  onSectionBoxToggle,
  transformActive,
  onTransformToggle,
  transformMode,
  onTransformModeChange,
  onFileLoad,
  setIsLoading,
  isLoading,
  hasFiles,
  snapMode,
  setSnapMode,
  orthoMode,
  setOrthoMode,
  measurements,
  onClearMeasurements,
}) => {
  return (
    <div className="absolute top-0 left-0 right-0 z-20">
      {/* Barra principal de herramientas */}
      <div className="flex items-center justify-between bg-black/90 backdrop-blur-sm border-b border-gray-700 px-4 py-2">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold text-white mr-4">
            Visor de Nubes de Puntos
          </h1>
          
          {/* Cargar Archivo */}
          <FileUploader
            onFileLoad={onFileLoad}
            setIsLoading={setIsLoading}
            isLoading={isLoading}
          />

          {/* Reset Cámara */}
          <Button
            onClick={onResetCamera}
            variant="outline"
            size="sm"
            className="text-white border-gray-600 hover:bg-gray-700 bg-gray-800"
            title="Reset Cámara"
          >
            <RotateCcw className="h-4 w-4" />
          </Button>

          {/* Mover/Transformar */}
          <Button
            onClick={() => onTransformToggle(!transformActive)}
            variant={transformActive ? "default" : "outline"}
            size="sm"
            className={`text-white border-gray-600 ${
              transformActive 
                ? "bg-purple-600 hover:bg-purple-700" 
                : "bg-gray-800 hover:bg-gray-700"
            }`}
            title="Transformar Objetos"
          >
            <Move className="h-4 w-4" />
          </Button>

          {/* Modo de Transformación */}
          {transformActive && (
            <Button
              onClick={() => onTransformModeChange(transformMode === 'translate' ? 'rotate' : 'translate')}
              variant="outline"
              size="sm"
              className="text-white border-gray-600 hover:bg-gray-700 bg-gray-800"
              title={transformMode === 'translate' ? 'Cambiar a Rotación' : 'Cambiar a Movimiento'}
            >
              {transformMode === 'translate' ? <RotateCw className="h-4 w-4" /> : <Move className="h-4 w-4" />}
            </Button>
          )}

          {/* Medir */}
          <Button
            onClick={() => onMeasurementToggle(!measurementActive)}
            variant={measurementActive ? "default" : "outline"}
            size="sm"
            className={`text-white border-gray-600 ${
              measurementActive 
                ? "bg-blue-600 hover:bg-blue-700" 
                : "bg-gray-800 hover:bg-gray-700"
            }`}
            title="Herramienta de Medición"
          >
            <Ruler className="h-4 w-4" />
          </Button>

          {/* Section Box */}
          <Button
            onClick={() => onSectionBoxToggle(!sectionBoxActive)}
            variant={sectionBoxActive ? "default" : "outline"}
            size="sm"
            className={`text-white border-gray-600 ${
              sectionBoxActive 
                ? "bg-green-600 hover:bg-green-700" 
                : "bg-gray-800 hover:bg-gray-700"
            }`}
            title="Caja de Sección"
          >
            <Box className="h-4 w-4" />
          </Button>

          {/* Limpiar */}
          {hasFiles && (
            <Button
              onClick={onClear}
              variant="outline"
              size="sm"
              className="text-red-400 border-red-600 hover:bg-red-700 hover:text-white bg-gray-800"
              title="Limpiar Archivos"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}

          {/* Limpiar Mediciones */}
          {measurements.length > 0 && (
            <Button
              onClick={onClearMeasurements}
              variant="outline"
              size="sm"
              className="text-orange-400 border-orange-600 hover:bg-orange-700 hover:text-white bg-gray-800"
              title="Limpiar Mediciones"
            >
              Limpiar Mediciones
            </Button>
          )}
        </div>
      </div>

      {/* Barra secundaria sutil para controles ortogonales y snap */}
      {(measurementActive || transformActive) && (
        <div className="bg-black/60 backdrop-blur-sm border-b border-gray-800 px-4 py-1">
          <div className="flex items-center gap-4 text-sm">
            {/* Modo Ortogonal */}
            <div className="flex items-center gap-2">
              <span className="text-gray-300 text-xs">Ortogonal:</span>
              <Select value={orthoMode} onValueChange={setOrthoMode}>
                <SelectTrigger className="h-6 w-20 bg-gray-800 border-gray-600 text-white text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-600">
                  <SelectItem value="none" className="text-white hover:bg-gray-700 text-xs">Libre</SelectItem>
                  <SelectItem value="x" className="text-white hover:bg-gray-700 text-xs">Eje X</SelectItem>
                  <SelectItem value="y" className="text-white hover:bg-gray-700 text-xs">Eje Y</SelectItem>
                  <SelectItem value="z" className="text-white hover:bg-gray-700 text-xs">Eje Z</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Modo de Snap */}
            {measurementActive && (
              <div className="flex items-center gap-2">
                <span className="text-gray-300 text-xs">Snap:</span>
                <Select value={snapMode} onValueChange={setSnapMode}>
                  <SelectTrigger className="h-6 w-24 bg-gray-800 border-gray-600 text-white text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 border-gray-600">
                    <SelectItem value="none" className="text-white hover:bg-gray-700 text-xs">Ninguno</SelectItem>
                    <SelectItem value="vertex" className="text-white hover:bg-gray-700 text-xs">Vértices</SelectItem>
                    <SelectItem value="edge" className="text-white hover:bg-gray-700 text-xs">Aristas</SelectItem>
                    <SelectItem value="face" className="text-white hover:bg-gray-700 text-xs">Caras</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Contador de mediciones */}
            {measurements.length > 0 && (
              <div className="text-gray-400 text-xs">
                Mediciones: {measurements.length}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
