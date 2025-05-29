import React, {
  useState,
  useRef,
  useMemo,
  useCallback,
  useEffect,
} from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Stats } from '@react-three/drei';
import * as THREE from 'three';
import { FileUploader } from './FileUploader';
import { ViewerControls } from './ViewerControls';
import { PointCloud } from './PointCloud';
import { IFCModel } from './IFCModel';
import { useToast } from '@/hooks/use-toast';

/* -------------------------------------------------------------------------- */
/*  Tipos                                                                    */
/* -------------------------------------------------------------------------- */
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

interface LoadedFile {
  id: string;
  name: string;
  type: 'pointcloud' | 'ifc';
  data: ViewerData;
}

export const PointCloudViewer: React.FC = () => {
  /* -------------------------------------------------------------------------- */
  /*  Estados                                                                    */
  /* -------------------------------------------------------------------------- */
  const [loadedFiles, setLoadedFiles] = useState<LoadedFile[]>([]);
  const [density, setDensity] = useState(0.1);
  const [pointSize, setPointSize] = useState(2);
  const [colorMode, setColorMode] = useState<'rgb' | 'intensity' | 'height'>('rgb');
  const [transparency, setTransparency] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const { toast } = useToast();
  const controlsRef = useRef<any>(null);

  /* -------------------------------------------------------------------------- */
  /*  Memorización de datos                                                      */
  /* -------------------------------------------------------------------------- */
  // Muestra un mensaje de bienvenida al cargar la página
  useEffect(() => {
    toast({
      title: "¡Bienvenido!",
      description: "Carga un archivo .PLY, .LAS o .IFC para comenzar",
    });
  }, [toast]);

  // Recalcula los puntos filtrados según la densidad
  const sampledPoints = useMemo(() => {
    const pointCloudFiles = loadedFiles.filter(file => file.type === 'pointcloud');
    if (pointCloudFiles.length === 0) return [];
    
    const allPoints = pointCloudFiles.flatMap(file => file.data as Point[]);
    const sampleSize = Math.ceil(allPoints.length * density);
    const step = Math.max(1, Math.floor(allPoints.length / sampleSize));
    
    return allPoints.filter((_, index) => index % step === 0);
  }, [loadedFiles, density]);

  const ifcModels = useMemo(() => {
    return loadedFiles.filter(file => file.type === 'ifc');
  }, [loadedFiles]);

  /* -------------------------------------------------------------------------- */
  /*  Funciones de carga y limpieza de datos                                    */
  /* -------------------------------------------------------------------------- */
  const handleFileLoad = useCallback((data: ViewerData, fileName: string) => {
    const newFile: LoadedFile = {
      id: Date.now().toString(),
      name: fileName,
      type: Array.isArray(data) ? 'pointcloud' : 'ifc',
      data
    };

    setLoadedFiles(prev => [...prev, newFile]);
    
    toast({
      title: "Archivo cargado",
      description: `${fileName} se ha cargado correctamente`,
    });
  }, [toast]);

  const handleClear = useCallback(() => {
    setLoadedFiles([]);
    toast({
      title: "Datos limpiados",
      description: "Todos los archivos han sido eliminados",
    });
  }, [toast]);

  const resetCamera = useCallback(() => {
    if (controlsRef.current) {
      controlsRef.current.reset();
    }
  }, []);

  /* -------------------------------------------------------------------------- */
  /*  Renderizado                                                                */
  /* -------------------------------------------------------------------------- */
  return (
    <div className="w-full h-screen bg-gray-900 relative">
      <div className="absolute top-4 left-4 z-20 flex items-center gap-4">
        <h1 className="text-2xl font-bold text-white">Visor de Nubes de Puntos</h1>
        <FileUploader 
          onFileLoad={handleFileLoad}
          setIsLoading={setIsLoading}
          isLoading={isLoading}
        />
        {loadedFiles.length > 0 && (
          <button
            onClick={handleClear}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded transition-colors"
          >
            Limpiar
          </button>
        )}
        <button
          onClick={resetCamera}
          className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded transition-colors"
        >
          Reset Cámara
        </button>
      </div>

      <ViewerControls
        density={density}
        setDensity={setDensity}
        pointSize={pointSize}
        setPointSize={setPointSize}
        colorMode={colorMode}
        setColorMode={setColorMode}
        transparency={transparency}
        setTransparency={setTransparency}
        totalCount={loadedFiles.filter(f => f.type === 'pointcloud').reduce((acc, file) => acc + (file.data as Point[]).length, 0)}
        visibleCount={sampledPoints.length}
        isVisible={controlsVisible}
        onToggleVisibility={() => setControlsVisible(!controlsVisible)}
        isPointCloud={sampledPoints.length > 0}
        hasIFCModel={ifcModels.length > 0}
      />

      {isLoading && (
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-30">
          <div className="bg-white p-6 rounded-lg shadow-lg">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-center">Cargando archivo...</p>
          </div>
        </div>
      )}

      <Canvas
        camera={{ position: [50, 50, 50], fov: 60, near: 0.01, far: 100000 }}
        className="absolute inset-0"
        gl={{ antialias: true, alpha: true }}
      >
        <color attach="background" args={['#1a1a1a']} />
        
        <ambientLight intensity={0.4} />
        <directionalLight position={[10, 10, 5]} intensity={0.8} />
        <directionalLight position={[-10, -10, -5]} intensity={0.3} />

        {sampledPoints.length > 0 && (
          <PointCloud
            points={sampledPoints}
            pointSize={pointSize}
            colorMode={colorMode}
          />
        )}

        {ifcModels.map((file) => (
          <IFCModel
            key={file.id}
            geometry={file.data as IFCGeometry}
            transparency={transparency}
          />
        ))}

        <OrbitControls 
          ref={controlsRef}
          enablePan={true}
          enableZoom={true}
          enableRotate={true}
          zoomSpeed={0.6}
          panSpeed={0.8}
          rotateSpeed={0.4}
        />
        <Stats />
        <axesHelper args={[10]} />
        <gridHelper args={[100, 100]} />
      </Canvas>
    </div>
  );
};
