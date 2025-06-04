import React, {
  useState,
  useRef,
  useMemo,
  useCallback,
  useEffect,
} from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, Stats } from '@react-three/drei';
import * as THREE from 'three';

import { ViewerControls } from './ViewerControls';
import { PointCloud } from './PointCloud';
import { IFCModel } from './IFCModel';
import { MeasurementTool } from './MeasurementTool';
import { SectionBox } from './SectionBox';
import { ToolsPanel } from './ToolsPanel';
import { ObjectSelector } from './ObjectSelector';
import { TransformManipulator } from './TransformManipulator';
import { TopToolbar } from './TopToolbar';
import { Scene } from './Scene';

import { useToast } from '@/hooks/use-toast';

/* -------------------------------------------------------------------------- */
/*  Tipos                                                                     */
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

/* -------------------------------------------------------------------------- */
/*  Componente                                                                */
/* -------------------------------------------------------------------------- */
export const PointCloudViewer: React.FC = () => {
  /* -------------------- Estados generales ---------------------------------- */
  const [loadedFiles, setLoadedFiles] = useState<LoadedFile[]>([]);
  const [density, setDensity] = useState(0.1);
  const [pointSize, setPointSize] = useState(2);
  const [colorMode, setColorMode] = useState<'rgb' | 'intensity' | 'height'>('rgb');
  const [transparency, setTransparency] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);

  const controlsRef = useRef<any>(null); // Changed from THREE.Object3D to any for OrbitControls
  const { toast } = useToast();

  /* -------------------- States de herramientas ----------------------------- */
  const [measurementActive, setMeasurementActive] = useState(false);
  const [sectionBoxActive, setSectionBoxActive]   = useState(false);
  const [selectedObject,   setSelectedObject]     = useState<THREE.Object3D | null>(null);
  const [transformActive, setTransformActive]     = useState(false);
  const [transformMode, setTransformMode]         = useState<'translate' | 'rotate'>('translate');
  const [isTransformDragging, setIsTransformDragging] = useState(false);
  const [snapMode,  setSnapMode]  = useState<'none' | 'vertex' | 'edge' | 'face'>('vertex');
  const [orthoMode, setOrthoMode] = useState<'none' | 'x' | 'y' | 'z'>('none');
  const [measurements, setMeasurements] = useState<
    Array<{ distance: number; points: [THREE.Vector3, THREE.Vector3] }>
  >([]);
  const [isDragging, setIsDragging] = useState(false); // arrastre de SectionBox

  /* -------------------- Mensaje de bienvenida ------------------------------ */
  useEffect(() => {
    toast({
      title: '¡Bienvenido!',
      description: 'Carga un archivo .PLY, .LAS o .IFC para comenzar',
    });
  }, [toast]);

  /* -------------------- Memos: muestras y modelos IFC ---------------------- */
  const sampledPoints = useMemo(() => {
    const pcs = loadedFiles.filter((f) => f.type === 'pointcloud');
    if (pcs.length === 0) return [];

    const all = pcs.flatMap((f) => f.data as Point[]);
    const sampleSize = Math.ceil(all.length * density);
    const step = Math.max(1, Math.floor(all.length / sampleSize));

    return all.filter((_, i) => i % step === 0);
  }, [loadedFiles, density]);

  const ifcModels = useMemo(
    () => loadedFiles.filter((f) => f.type === 'ifc'),
    [loadedFiles],
  );

  /* -------------------- Carga y limpieza ----------------------------------- */
  const handleFileLoad = useCallback(
    (data: ViewerData, fileName: string) => {
      const newFile: LoadedFile = {
        id: Date.now().toString(),
        name: fileName,
        type: Array.isArray(data) ? 'pointcloud' : 'ifc',
        data,
      };
      setLoadedFiles((prev) => [...prev, newFile]);
      toast({
        title: 'Archivo cargado',
        description: `${fileName} se ha cargado correctamente`,
      });
    },
    [toast],
  );

  const handleClear = useCallback(() => {
    setLoadedFiles([]);
    setMeasurements([]);
    setSelectedObject(null);
    setMeasurementActive(false);
    setSectionBoxActive(false);
    setTransformActive(false);
    toast({
      title: 'Datos limpiados',
      description: 'Todos los archivos han sido eliminados',
    });
  }, [toast]);

  const resetCamera = useCallback(() => {
    if (controlsRef.current && 'reset' in controlsRef.current) {
      (controlsRef.current as any).reset();
    }
  }, []);

  /* -------------------- Medición ------------------------------------------- */
  const handleMeasurement = useCallback(
    (distance: number, points: [THREE.Vector3, THREE.Vector3]) => {
      setMeasurements((p) => [...p, { distance, points }]);
      toast({
        title: 'Medición completada',
        description: `Distancia: ${distance.toFixed(3)} m`,
      });
    },
    [toast],
  );

  const handleClearMeasurements = useCallback(() => {
    setMeasurements([]);
    toast({
      title: 'Mediciones limpiadas',
      description: 'Todas las mediciones han sido eliminadas',
    });
  }, [toast]);

  /* -------------------- Selección de objetos (para SectionBox) ------------- */
  const handleObjectSelection = useCallback(
    (object: THREE.Object3D | null) => {
      setSelectedObject(object);
      if (object && (sectionBoxActive || transformActive)) {
        toast({
          title: sectionBoxActive
            ? 'Objeto seleccionado para sección'
            : 'Objeto seleccionado para transformar',
          description: sectionBoxActive
            ? 'Arrastra los controles triangulares para seccionar'
            : 'Usa los ejes de colores para mover o rotar',
        });
      }
    },
    [sectionBoxActive, transformActive, toast],
  );

  /* -------------------- Activación herramientas ---------------------------- */
  const handleSectionBoxToggle = useCallback(
    (active: boolean) => {
      setSectionBoxActive(active);
      if (!active) {
        setSelectedObject(null);
      }
      toast({
        title: active
          ? 'Herramienta de sección activada'
          : 'Herramienta de sección desactivada',
        description: active
          ? 'Haz clic en un modelo para seleccionarlo y crear la caja'
          : 'Planos de corte eliminados',
      });
    },
    [toast],
  );

  const handleTransformToggle = useCallback((active: boolean) => {
    setTransformActive(active);
    if (active) {
      setMeasurementActive(false);
      setSectionBoxActive(false);
      setSelectedObject(null);
    }
    toast({
      title: active ? 'Herramienta de transformación activada' : 'Herramienta de transformación desactivada',
      description: active ? 'Selecciona un objeto para moverlo o rotarlo' : 'Transformaciones deshabilitadas',
    });
  }, [toast]);

  const handleMeasurementToggle = useCallback((active: boolean) => {
    setMeasurementActive(active);
    if (active) {
      setSectionBoxActive(false);
      setTransformActive(false);
      setSelectedObject(null);
    }
  }, []);

  /* -------------------------------------------------------------------------- */
  /*  Escena interna (luces, modelos, etc.)                                     */
  /* -------------------------------------------------------------------------- */
  const InternalScene = () => {
    const { scene } = useThree();

    /* -- Limpiamos clipping cuando se desactiva la herramienta -------------- */
    useEffect(() => {
      if (!sectionBoxActive) {
        loadedFiles.forEach((file) => {
          if (file.type === 'ifc') {
            (file.data as IFCGeometry).meshes.forEach((mesh) => {
              const mats = Array.isArray(mesh.material)
                ? mesh.material
                : [mesh.material];
              mats.forEach((mat) => {
                mat.clippingPlanes = [];
                mat.needsUpdate = true;
              });
            });
          }
        });

        scene.traverse((child) => {
          if (child instanceof THREE.Points && child.material) {
            child.material.clippingPlanes = [];
            child.material.needsUpdate = true;
          }
        });
      }
    }, [sectionBoxActive, loadedFiles, scene]);

    return (
      <>
        <Scene>
          {/* Point-cloud */}
          {sampledPoints.length > 0 && (
            <PointCloud
              points={sampledPoints}
              pointSize={pointSize}
              colorMode={colorMode}
            />
          )}

          {/* Modelos IFC */}
          {ifcModels.map((file) => (
            <IFCModel
              key={file.id}
              geometry={file.data as IFCGeometry}
              transparency={transparency}
            />
          ))}

          {/* Selector de objetos (para Sección/Transformación) */}
          <ObjectSelector
            isActive={sectionBoxActive || transformActive}
            onObjectHover={() => {}}
            onObjectSelect={handleObjectSelection}
          />

          {/* Herramienta de medición */}
          <MeasurementTool
            isActive={measurementActive}
            snapMode={snapMode}
            orthoMode={orthoMode}
            onMeasure={handleMeasurement}
            onSnapModeChange={setSnapMode}
          />

          {/* Caja de sección */}
          <SectionBox
            targetObject={selectedObject}
            isActive={sectionBoxActive}
            onDragStateChange={setIsDragging}
          />

          {/* Manipulador de transformación */}
          <TransformManipulator
            object={selectedObject}
            isActive={transformActive}
            mode={transformMode}
            onDraggingChange={setIsTransformDragging}
          />

          {/* Controles de cámara */}
          <OrbitControls
            ref={controlsRef}
            enablePan
            enableZoom
            enableRotate
            zoomSpeed={0.6}
            panSpeed={0.8}
            rotateSpeed={0.4}
            enabled={!isDragging && !isTransformDragging}
          />

          {/* Stats */}
          <Stats />
        </Scene>
      </>
    );
  };

  /* -------------------------------------------------------------------------- */
  /*  Render                                                                    */
  /* -------------------------------------------------------------------------- */
  return (
    <div className="w-full h-screen bg-gray-900 relative">
      {/* ---------- Barra superior de herramientas --------------------------- */}
      <TopToolbar
        onClear={handleClear}
        onResetCamera={resetCamera}
        measurementActive={measurementActive}
        onMeasurementToggle={handleMeasurementToggle}
        sectionBoxActive={sectionBoxActive}
        onSectionBoxToggle={handleSectionBoxToggle}
        transformActive={transformActive}
        onTransformToggle={handleTransformToggle}
        transformMode={transformMode}
        onTransformModeChange={setTransformMode}
        onFileLoad={handleFileLoad}
        setIsLoading={setIsLoading}
        isLoading={isLoading}
        hasFiles={loadedFiles.length > 0}
      />

      {/* ---------- Panel de ajustes ---------------------------------------- */}
      <ViewerControls
        density={density}
        setDensity={setDensity}
        pointSize={pointSize}
        setPointSize={setPointSize}
        colorMode={colorMode}
        setColorMode={setColorMode}
        transparency={transparency}
        setTransparency={setTransparency}
        totalCount={loadedFiles
          .filter((f) => f.type === 'pointcloud')
          .reduce((acc, f) => acc + (f.data as Point[]).length, 0)}
        visibleCount={sampledPoints.length}
        isVisible={controlsVisible}
        onToggleVisibility={() => setControlsVisible(!controlsVisible)}
        isPointCloud={sampledPoints.length > 0}
        hasIFCModel={ifcModels.length > 0}
      />

      {/* ---------- Panel de herramientas avanzadas ----------------------- */}
      <ToolsPanel
        measurementActive={measurementActive}
        setMeasurementActive={handleMeasurementToggle}
        sectionBoxActive={sectionBoxActive}
        setSectionBoxActive={handleSectionBoxToggle}
        transformActive={transformActive}
        setTransformActive={handleTransformToggle}
        transformMode={transformMode}
        setTransformMode={setTransformMode}
        snapMode={snapMode}
        setSnapMode={setSnapMode}
        orthoMode={orthoMode}
        setOrthoMode={setOrthoMode}
        measurements={measurements}
        onClearMeasurements={handleClearMeasurements}
      />

      {/* ---------- Overlay de carga --------------------------------------- */}
      {isLoading && (
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-30">
          <div className="bg-white p-6 rounded-lg shadow-lg">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4" />
            <p className="text-center">Cargando archivo…</p>
          </div>
        </div>
      )}

      {/* ---------- Canvas (Three.js) -------------------------------------- */}
      <Canvas
        camera={{ position: [50, 50, 50], fov: 60, near: 0.01, far: 100000 }}
        className="absolute inset-0"
        gl={{ antialias: true, alpha: true }}
        onCreated={({ gl }) => {
          gl.localClippingEnabled = true;
          gl.setClearColor('#1a1a1a', 1);
        }}
      >
        <InternalScene />
      </Canvas>
    </div>
  );
};
