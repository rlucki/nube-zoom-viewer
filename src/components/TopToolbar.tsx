
import React from 'react';
import { Upload, RotateCcw, Move, Ruler, RotateCw, Box } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
}) => {
  return (
    <div className="absolute top-4 left-4 right-4 z-20 flex items-center justify-between">
      <div className="flex items-center gap-2 bg-black/80 backdrop-blur-sm border border-gray-700 rounded-lg px-4 py-2">
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
          className="text-white border-gray-600 hover:bg-gray-700"
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
              : "hover:bg-gray-700"
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
            className="text-white border-gray-600 hover:bg-gray-700"
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
              : "hover:bg-gray-700"
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
              : "hover:bg-gray-700"
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
            className="text-red-400 border-red-600 hover:bg-red-700 hover:text-white"
            title="Limpiar Archivos"
          >
            Limpiar
          </Button>
        )}
      </div>
    </div>
  );
};
