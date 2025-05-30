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
import { MeasurementTool } from './MeasurementTool';
import { SectionBox } from './SectionBox';
import { ToolsPanel } from './ToolsPanel';
import { useToast } from '@/hooks/use-toast';
import { ObjectSelector } from './ObjectSelector';

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
  const dragState = useRef({ isDragging: false });

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
  /*  New states for measurement and section tools                              */
  /* -------------------------------------------------------------------------- */
  const [measurementActive, setMeasurementActive] = useState(false);
  const [sectionBoxActive, setSectionBoxActive] = useState(false);
  const [selectedObject, setSelectedObject] = useState<THREE.Object3D | null>(null);
  const [snapMode, setSnapMode] = useState<'none' | 'vertex' | 'edge' | 'face'>('vertex');
  const [orthoMode, setOrthoMode] = useState<'none' | 'x' | 'y' | 'z'>('none');
  const [measurements, setMeasurements] = useState<Array<{ distance: number; points: [THREE.Vector3, THREE.Vector3] }>>([]);
  const [sectionBounds, setSectionBounds] = useState<{ min: THREE.Vector3; max: THREE.Vector3 } | null>(null);

  /* -------------------------------------------------------------------------- */
  /*  Enhanced functions for measurement and section tools                       */
  /* -------------------------------------------------------------------------- */
  const handleMeasurement = useCallback((distance: number, points: [THREE.Vector3, THREE.Vector3]) => {
    setMeasurements(prev => [...prev, { distance, points }]);
    toast({
      title: "Medición completada",
      description: `Distancia: ${distance.toFixed(3)}m`,
    });
  }, [toast]);

  const handleClearMeasurements = useCallback(() => {
    setMeasurements([]);
    toast({
      title: "Mediciones limpiadas",
      description: "Todas las mediciones han sido eliminadas",
    });
  }, [toast]);

  const handleSnapModeChange = useCallback((mode: 'none' | 'vertex' | 'edge' | 'face') => {
    setSnapMode(mode);
    toast({
      title: "Modo de snap cambiado",
      description: `Snap: ${mode.toUpperCase()}`,
    });
  }, [toast]);

  const handleObjectSelection = useCallback((object: THREE.Object3D | null) => {
    setSelectedObject(object);
    if (object && sectionBoxActive) {
      toast({
        title: "Objeto seleccionado para sección",
        description: "Arrastra los controles triangulares para seccionar",
      });
    }
  }, [sectionBoxActive, toast]);

  const handleObjectHover = useCallback((object: THREE.Object3D | null) => {
    // Solo para feedback visual, no necesita toast
  }, []);

  const handleSectionChange = useCallback((bounds: { min: THREE.Vector3; max: THREE.Vector3 }) => {
    setSectionBounds(bounds);
    
    // Apply clipping planes to selected object
    if (bounds && selectedObject) {
      const clippingPlanes = [
        new THREE.Plane(new THREE.Vector3(1, 0, 0), -bounds.min.x),
        new THREE.Plane(new THREE.Vector3(-1, 0, 0), bounds.max.x),
        new THREE.Plane(new THREE.Vector3(0, 1, 0), -bounds.min.y),
        new THREE.Plane(new THREE.Vector3(0, -1, 0), bounds.max.y),
        new THREE.Plane(new THREE.Vector3(0, 0, 1), -bounds.min.z),
        new THREE.Plane(new THREE.Vector3(0, 0, -1), bounds.max.z),
      ];

      selectedObject.traverse((child) => {
        if (child instanceof THREE.Mesh && child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach(mat => {
              mat.clippingPlanes = clippingPlanes;
              mat.needsUpdate = true;
            });
          } else {
            child.material.clippingPlanes = clippingPlanes;
            child.material.needsUpdate = true;
          }
        }
      });
    }
  }, [selectedObject]);

  const handleSectionBoxToggle = useCallback((active: boolean) => {
    setSectionBoxActive(active);
    if (!active) {
      setSelectedObject(null);
      setSectionBounds(null);
      
      // Remove clipping planes from all objects when deactivating
      loadedFiles.forEach(file => {
        if (file.type === 'pointcloud') {
          // Remove clipping from point clouds
          const pointCloudObjects = [];
          // Point clouds are handled in PointCloud component
        } else if (file.type === 'ifc') {
          const ifcGeometry = file.data as IFCGeometry;
          ifcGeometry.meshes.forEach(mesh => {
            if (mesh.material) {
              if (Array.isArray(mesh.material)) {
                mesh.material.forEach(mat => {
                  mat.clippingPlanes = [];
                  mat.needsUpdate = true;
                });
              } else {
                mesh.material.clippingPlanes = [];
                mesh.material.needsUpdate = true;
              }
            }
          });
        }
      });
    }
    
    toast({
      title: active ? "Herramienta de sección activada" : "Herramienta de sección desactivada",
      description: active ? "Haz clic en un modelo para seleccionarlo" : "Planos de corte eliminados",
    });
  }, [loadedFiles, toast]);

  /* -------------------------------------------------------------------------- */
  /*  Scene component to ensure proper initialization order                      */
  /* -------------------------------------------------------------------------- */
  const Scene = () => {
    return (
      <>
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

        {/* Object Selector for hover/selection effects - ALWAYS active when section tool is active */}
        <ObjectSelector
          isActive={sectionBoxActive || measurementActive}
          onObjectHover={handleObjectHover}
          onObjectSelect={handleObjectSelection}
        />

        {/* Measurement Tool */}
        <MeasurementTool
          isActive={measurementActive}
          snapMode={snapMode}
          orthoMode={orthoMode}
          onMeasure={handleMeasurement}
          onSnapModeChange={handleSnapModeChange}
        />

        {/* Section Box */}
        <SectionBox
          targetObject={selectedObject}
          isActive={sectionBoxActive}
          onSectionChange={handleSectionChange}
        />

        <OrbitControls 
          ref={controlsRef}
          enablePan={!dragState.current.isDragging}
          enableZoom={!dragState.current.isDragging}
          enableRotate={!dragState.current.isDragging}
          zoomSpeed={0.6}
          panSpeed={0.8}
          rotateSpeed={0.4}
        />
        <Stats />
        <axesHelper args={[10]} />
        <gridHelper args={[100, 100]} />
      </>
    );
  };

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

      <ToolsPanel
        measurementActive={measurementActive}
        setMeasurementActive={setMeasurementActive}
        sectionBoxActive={sectionBoxActive}
        setSectionBoxActive={handleSectionBoxToggle}
        snapMode={snapMode}
        setSnapMode={setSnapMode}
        orthoMode={orthoMode}
        setOrthoMode={setOrthoMode}
        measurements={measurements}
        onClearMeasurements={handleClearMeasurements}
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
        gl={{ antialias: true, alpha: true, localClippingEnabled: true }}
      >
        <Scene />
      </Canvas>
    </div>
  );
};
