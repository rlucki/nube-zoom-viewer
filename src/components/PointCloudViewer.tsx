
import React, { useState, useRef, useMemo, useCallback } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Stats } from '@react-three/drei';
import * as THREE from 'three';
import { FileUploader } from './FileUploader';
import { ViewerControls } from './ViewerControls';
import { PointCloud } from './PointCloud';
import { IFCModel } from './IFCModel';
import { useToast } from '@/hooks/use-toast';

export interface Point {
  x: number;
  y: number;
  z: number;
  r?: number;
  g?: number;
  b?: number;
  intensity?: number;
}

export interface IFCGeometry {
  type: 'ifc';
  meshes: THREE.Mesh[];
  bounds: {
    min: THREE.Vector3;
    max: THREE.Vector3;
  };
}

export type ViewerData = Point[] | IFCGeometry;

export const PointCloudViewer = () => {
  const [data, setData] = useState<ViewerData>([]);
  const [density, setDensity] = useState(1);
  const [pointSize, setPointSize] = useState(2);
  const [colorMode, setColorMode] = useState<'rgb' | 'intensity' | 'height'>('rgb');
  const [transparency, setTransparency] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [fileName, setFileName] = useState<string>('');
  const [controlsVisible, setControlsVisible] = useState(true);
  const { toast } = useToast();

  const isPointCloud = Array.isArray(data);
  const points = isPointCloud ? data as Point[] : [];

  const sampledPoints = useMemo(() => {
    if (!isPointCloud || density >= 1) return points;
    const step = Math.ceil(1 / density);
    return points.filter((_, index) => index % step === 0);
  }, [points, density, isPointCloud]);

  const handleFileLoad = useCallback((loadedData: ViewerData, name: string) => {
    setData(loadedData);
    setFileName(name);
    setDensity(1);
    setTransparency(1);
    
    if (Array.isArray(loadedData)) {
      toast({
        title: "Nube de puntos cargada",
        description: `${loadedData.length.toLocaleString()} puntos cargados desde ${name}`,
      });
    } else {
      toast({
        title: "Modelo IFC cargado",
        description: `Geometría 3D cargada desde ${name}`,
      });
    }
  }, [toast]);

  const handleReset = useCallback(() => {
    setData([]);
    setFileName('');
    setDensity(1);
    setPointSize(2);
    setColorMode('rgb');
    setTransparency(1);
  }, []);

  const toggleControlsVisibility = useCallback(() => {
    setControlsVisible(prev => !prev);
  }, []);

  const totalCount = isPointCloud ? points.length : 1;
  const visibleCount = isPointCloud ? sampledPoints.length : 1;

  return (
    <div className="w-full h-screen bg-gray-900 relative">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-10 bg-black/80 backdrop-blur-sm border-b border-gray-700">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-bold text-white">Visor de Nubes de Puntos</h1>
            {fileName && (
              <span className="text-sm text-gray-300">
                {fileName} {isPointCloud ? `(${points.length.toLocaleString()} puntos)` : '(Modelo 3D)'}
              </span>
            )}
          </div>
          <div className="flex items-center gap-4">
            <FileUploader 
              onFileLoad={handleFileLoad} 
              setIsLoading={setIsLoading}
              isLoading={isLoading}
            />
            {(points.length > 0 || !isPointCloud) && (
              <button
                onClick={handleReset}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
              >
                Limpiar
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Controls Panel */}
      {(points.length > 0 || !isPointCloud) && (
        <ViewerControls
          density={density}
          setDensity={setDensity}
          pointSize={pointSize}
          setPointSize={setPointSize}
          colorMode={colorMode}
          setColorMode={setColorMode}
          transparency={transparency}
          setTransparency={setTransparency}
          totalCount={totalCount}
          visibleCount={visibleCount}
          isVisible={controlsVisible}
          onToggleVisibility={toggleControlsVisibility}
          isPointCloud={isPointCloud}
        />
      )}

      {/* Loading overlay */}
      {isLoading && (
        <div className="absolute inset-0 z-20 bg-black/50 flex items-center justify-center">
          <div className="bg-white rounded-lg p-6 flex items-center gap-3">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
            <span>Cargando archivo...</span>
          </div>
        </div>
      )}

      {/* 3D Canvas */}
      <Canvas
        camera={{ 
          position: [10, 10, 10], 
          fov: 60,
          near: 0.1,
          far: 1000 
        }}
        className="absolute inset-0"
        gl={{ antialias: true, alpha: true }}
      >
        <color attach="background" args={['#0f172a']} />
        
        {/* Lighting */}
        <ambientLight intensity={0.6} />
        <directionalLight position={[10, 10, 5]} intensity={0.8} />
        <pointLight position={[-10, -10, -5]} intensity={0.3} />

        {/* Render Point Cloud or IFC Model */}
        {isPointCloud && sampledPoints.length > 0 && (
          <PointCloud 
            points={sampledPoints} 
            pointSize={pointSize}
            colorMode={colorMode}
          />
        )}

        {!isPointCloud && (
          <IFCModel 
            geometry={data as IFCGeometry}
            transparency={transparency}
          />
        )}

        {/* Controls */}
        <OrbitControls
          enableDamping
          dampingFactor={0.05}
          rotateSpeed={0.5}
          zoomSpeed={1}
          panSpeed={0.8}
          maxDistance={100}
          minDistance={1}
        />

        {/* Performance Stats */}
        <Stats />

        {/* Grid helper when no data loaded */}
        {points.length === 0 && isPointCloud && (
          <>
            <gridHelper args={[20, 20, '#333333', '#222222']} />
            <axesHelper args={[5]} />
          </>
        )}
      </Canvas>

      {/* Welcome message */}
      {points.length === 0 && isPointCloud && !isLoading && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center text-white/80 max-w-md">
            <div className="text-6xl mb-4">☁️</div>
            <h2 className="text-2xl font-semibold mb-2">Bienvenido al Visor de Nubes de Puntos</h2>
            <p className="text-gray-300">
              Carga un archivo LAS, LAZ, PLY o IFC para comenzar a visualizar tu nube de puntos en 3D
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
