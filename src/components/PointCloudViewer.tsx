
import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
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

export interface LoadedFile {
  id: string;
  name: string;
  data: Point[] | IFCGeometry;
  type: 'pointcloud' | 'ifc';
}

export type ViewerData = Point[] | IFCGeometry;

export const PointCloudViewer = () => {
  const [loadedFiles, setLoadedFiles] = useState<LoadedFile[]>([]);
  const [density, setDensity] = useState(1);
  const [pointSize, setPointSize] = useState(2);
  const [colorMode, setColorMode] = useState<'rgb' | 'intensity' | 'height'>('rgb');
  const [transparency, setTransparency] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const controlsRef = useRef<any>(null);
  const { toast } = useToast();

  // Get all point clouds
  const pointClouds = loadedFiles.filter(file => file.type === 'pointcloud');
  const ifcModels = loadedFiles.filter(file => file.type === 'ifc');
  
  // Combine all points from all point clouds
  const allPoints = useMemo(() => {
    return pointClouds.flatMap(file => file.data as Point[]);
  }, [pointClouds]);

  const sampledPoints = useMemo(() => {
    if (density >= 1) return allPoints;
    const step = Math.ceil(1 / density);
    return allPoints.filter((_, index) => index % step === 0);
  }, [allPoints, density]);

  // Auto-fit camera when new data is loaded
  useEffect(() => {
    if (controlsRef.current && loadedFiles.length > 0) {
      const controls = controlsRef.current;
      
      // Calculate bounds of all data
      const box = new THREE.Box3();
      
      // Add point cloud bounds
      if (allPoints.length > 0) {
        allPoints.forEach(point => {
          box.expandByPoint(new THREE.Vector3(point.x, point.y, point.z));
        });
      }
      
      // Add IFC model bounds
      ifcModels.forEach(file => {
        const geometry = file.data as IFCGeometry;
        if (geometry.bounds) {
          box.expandByPoint(geometry.bounds.min);
          box.expandByPoint(geometry.bounds.max);
        }
      });
      
      if (!box.isEmpty()) {
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        const distance = maxDim * 2;
        
        controls.target.copy(center);
        controls.object.position.set(
          center.x + distance,
          center.y + distance,
          center.z + distance
        );
        controls.update();
      }
    }
  }, [loadedFiles, allPoints, ifcModels]);

  const handleFileLoad = useCallback((loadedData: ViewerData, name: string) => {
    const isPointCloud = Array.isArray(loadedData);
    const newFile: LoadedFile = {
      id: Date.now().toString() + Math.random().toString(),
      name,
      data: loadedData,
      type: isPointCloud ? 'pointcloud' : 'ifc'
    };

    setLoadedFiles(prev => [...prev, newFile]);
    
    if (isPointCloud) {
      toast({
        title: "Nube de puntos cargada",
        description: `${(loadedData as Point[]).length.toLocaleString()} puntos cargados desde ${name}`,
      });
    } else {
      toast({
        title: "Modelo IFC cargado",
        description: `Geometría 3D cargada desde ${name}`,
      });
    }
  }, [toast]);

  const handleReset = useCallback(() => {
    setLoadedFiles([]);
    setDensity(1);
    setPointSize(2);
    setColorMode('rgb');
    setTransparency(1);
    
    // Reset camera position
    if (controlsRef.current) {
      controlsRef.current.reset();
    }
  }, []);

  const toggleControlsVisibility = useCallback(() => {
    setControlsVisible(prev => !prev);
  }, []);

  const totalCount = allPoints.length;
  const visibleCount = sampledPoints.length;
  const hasData = loadedFiles.length > 0;

  return (
    <div className="w-full h-screen bg-gray-900 relative">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-10 bg-black/80 backdrop-blur-sm border-b border-gray-700">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-bold text-white">Visor de Nubes de Puntos</h1>
            {loadedFiles.length > 0 && (
              <div className="text-sm text-gray-300">
                {loadedFiles.map(file => (
                  <span key={file.id} className="mr-4">
                    {file.name} {file.type === 'pointcloud' ? 
                      `(${(file.data as Point[]).length.toLocaleString()} puntos)` : 
                      '(Modelo 3D)'
                    }
                  </span>
                ))}
              </div>
            )}
          </div>
          <div className="flex items-center gap-4">
            <FileUploader 
              onFileLoad={handleFileLoad} 
              setIsLoading={setIsLoading}
              isLoading={isLoading}
            />
            {hasData && (
              <button
                onClick={handleReset}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
              >
                Limpiar Todo
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Controls Panel */}
      {hasData && (
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
          isPointCloud={pointClouds.length > 0}
          hasIFCModel={ifcModels.length > 0}
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
          far: 10000
        }}
        className="absolute inset-0"
        gl={{ antialias: true, alpha: true }}
      >
        <color attach="background" args={['#0f172a']} />
        
        {/* Lighting */}
        <ambientLight intensity={0.6} />
        <directionalLight position={[10, 10, 5]} intensity={0.8} />
        <pointLight position={[-10, -10, -5]} intensity={0.3} />

        {/* Render Point Clouds */}
        {sampledPoints.length > 0 && (
          <PointCloud 
            points={sampledPoints} 
            pointSize={pointSize}
            colorMode={colorMode}
          />
        )}

        {/* Render IFC Models */}
        {ifcModels.map(file => (
          <IFCModel 
            key={file.id}
            geometry={file.data as IFCGeometry}
            transparency={transparency}
          />
        ))}

        {/* Controls */}
        <OrbitControls
          ref={controlsRef}
          enableDamping
          dampingFactor={0.05}
          rotateSpeed={0.5}
          zoomSpeed={1}
          panSpeed={0.8}
          maxDistance={1000}
          minDistance={0.1}
        />

        {/* Performance Stats */}
        <Stats />

        {/* Grid helper when no data loaded */}
        {!hasData && (
          <>
            <gridHelper args={[20, 20, '#333333', '#222222']} />
            <axesHelper args={[5]} />
          </>
        )}
      </Canvas>

      {/* Welcome message */}
      {!hasData && !isLoading && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center text-white/80 max-w-md">
            <div className="text-6xl mb-4">☁️</div>
            <h2 className="text-2xl font-semibold mb-2">Bienvenido al Visor de Nubes de Puntos</h2>
            <p className="text-gray-300">
              Carga archivos LAS, LAZ, PLY o IFC para comenzar a visualizar en 3D. Puedes cargar múltiples archivos.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
