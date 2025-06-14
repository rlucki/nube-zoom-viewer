import React, {
  useState,
  useRef,
  useMemo,
  useCallback,
  useEffect,
  useLayoutEffect,
} from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, Stats } from '@react-three/drei';
import * as THREE from 'three';

import { ViewerControls } from './ViewerControls';
import { PointCloud } from './PointCloud';
import { IFCModel } from './IFCModel';
import { MeasurementTool } from './MeasurementTool';
import { SectionBox } from './SectionBox';
import { ObjectSelector } from './ObjectSelector';
import { TransformManipulator } from './TransformManipulator';
import { TopToolbar } from './TopToolbar';
import { Scene } from './Scene';
import { useDragState } from '../hooks/useDragState';

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

  const controlsRef = useRef<any>(null);
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
  const [isDragging, setIsDragging] = useState(false);
  const [toolStateReset, setToolStateReset] = useState(0); // Para forzar reset
  const [sectionBoxBounds, setSectionBoxBounds] = useState<{
    min: THREE.Vector3;
    max: THREE.Vector3;
  } | null>(null);

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
    if (all.length === 0) return [];

    // Mejorar el algoritmo de sampling para distribuir mejor los puntos
    if (density >= 1) {
      return all; // Mostrar todos los puntos si la densidad es 100%
    }

    const sampleSize = Math.ceil(all.length * density);
    if (sampleSize >= all.length) {
      return all;
    }

    // Usar sampling regular en lugar de por pasos para mejor distribución
    const step = all.length / sampleSize;
    const sampled = [];
    for (let i = 0; i < sampleSize; i++) {
      const index = Math.floor(i * step);
      if (index < all.length) {
        sampled.push(all[index]);
      }
    }

    return sampled;
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
    setSectionBoxBounds(null); // Solo aquí se limpia la caja de sección
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

  /* -------------------- Selección de objetos mejorada --------------------- */
  const handleObjectSelection = useCallback(
    (object: THREE.Object3D | null) => {
      console.log('Object selected for transform:', object?.name || object?.type || 'null');
      setSelectedObject(object);
      if (object && transformActive) {
        toast({
          title: 'Objeto seleccionado',
          description: `${object.name || object.type} listo para transformar`,
        });
      }
    },
    [transformActive, toast],
  );

  /* -------------------- Activación herramientas mejorada ------------------ */
  const { dragState, startDrag, endDrag, cancelDrag } = useDragState();

  const handleSectionBoxToggle = useCallback((active: boolean) => {
    console.log('Section Box toggle:', active);
    
    // Limpiar otras herramientas
    if (active) {
      setTransformActive(false);
      setMeasurementActive(false);
      setSelectedObject(null);
    }
    
    setSectionBoxActive(active);
    setToolStateReset(prev => prev + 1); // Forzar reset de estado
    
    toast({
      title: active
        ? 'Herramienta de sección activada'
        : 'Herramienta de sección desactivada',
      description: active
        ? 'Arrastra los controles de colores para seccionar el modelo'
        : 'Sección desactivada',
    });
  }, [toast, cancelDrag]);

  const handleTransformToggle = useCallback((active: boolean) => {
    console.log('Transform toggle:', active);
    
    // Cancelar cualquier drag activo
    cancelDrag();
    
    // Limpiar otras herramientas
    if (active) {
      setMeasurementActive(false);
      setSectionBoxActive(false);
      setSelectedObject(null);
    } else {
      setSelectedObject(null);
    }
    
    setTransformActive(active);
    setToolStateReset(prev => prev + 1); // Forzar reset de estado
    
    toast({
      title: active ? 'Herramienta de transformación activada' : 'Herramienta de transformación desactivada',
      description: active ? 'Selecciona un objeto haciendo clic sobre él' : 'Transformaciones deshabilitadas',
    });
  }, [toast, cancelDrag]);

  const handleMeasurementToggle = useCallback((active: boolean) => {
    console.log('Measurement toggle:', active);
    
    // Cancelar cualquier drag activo
    cancelDrag();
    
    // Limpiar otras herramientas
    if (active) {
      setSectionBoxActive(false);
      setTransformActive(false);
      setSelectedObject(null);
    }
    
    setMeasurementActive(active);
    setToolStateReset(prev => prev + 1); // Forzar reset de estado
  }, [cancelDrag]);

  /* -------------------------------------------------------------------------- */
  /*  Escena interna (luces, modelos, etc.)                                     */
  /* -------------------------------------------------------------------------- */
  const InternalScene = () => {
    const { scene } = useThree();
    const contentGroupRef = useRef<THREE.Group>(null);

    useLayoutEffect(() => {
      const group = contentGroupRef.current;
      if (group && loadedFiles.length > 0) {
        // Retrasamos un instante para asegurar que todos los hijos se hayan montado
        const timer = setTimeout(() => {
          if (!contentGroupRef.current) return;

          const box = new THREE.Box3().setFromObject(contentGroupRef.current);

          if (!box.isEmpty()) {
            const center = box.getCenter(new THREE.Vector3());
            contentGroupRef.current.position.sub(center); // Centramos el grupo en el origen

            // Actualizamos el target de OrbitControls para que apunte al nuevo centro
            if (controlsRef.current) {
              controlsRef.current.target.set(0, 0, 0);
              controlsRef.current.update();
            }
          }
        }, 0);
        return () => clearTimeout(timer);
      } else if (group) {
        group.position.set(0, 0, 0);
      }
    }, [loadedFiles]);

    /* -- Limpiamos clipping cuando se desactiva la herramienta -------------- */
    useEffect(() => {
      if (!sectionBoxActive) {
        scene.traverse((child) => {
          if (child instanceof THREE.Mesh && child.material && !child.userData.isSectionBox) {
            const materials = Array.isArray(child.material) ? child.material : [child.material];
            materials.forEach((material) => {
              material.clippingPlanes = [];
              material.needsUpdate = true;
            });
          }
          if (child instanceof THREE.Points && child.material && !child.userData.isSectionBox) {
            child.material.clippingPlanes = [];
            child.material.needsUpdate = true;
          }
        });
      }
    }, [sectionBoxActive, scene]);

    return (
      <>
        <Scene>
          <group ref={contentGroupRef}>
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
          </group>

          {/* Selector de objetos (solo para Transformación) */}
          <ObjectSelector
            isActive={transformActive}
            isDragging={dragState.isDragging}
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
            isActive={sectionBoxActive}
            bounds={sectionBoxBounds}
            setBounds={setSectionBoxBounds}
          />

          {/* Manipulador de transformación */}
          <TransformManipulator
            object={selectedObject}
            isActive={transformActive}
            mode={transformMode}
          />

          {/* Controles de cámara - mejorados para evitar conflictos */}
          <OrbitControls
            ref={controlsRef}
            enablePan={!dragState.isDragging}
            enableZoom={!dragState.isDragging}
            enableRotate={!dragState.isDragging}
            enabled={!dragState.isDragging}
            zoomSpeed={0.6}
            panSpeed={0.8}
            rotateSpeed={0.4}
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
        snapMode={snapMode}
        setSnapMode={setSnapMode}
        orthoMode={orthoMode}
        setOrthoMode={setOrthoMode}
        measurements={measurements}
        onClearMeasurements={handleClearMeasurements}
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
        key={toolStateReset} // Forzar re-render cuando cambian herramientas
        camera={{ position: [50, 50, 50], fov: 60, near: 0.01, far: 100000 }}
        className="absolute inset-0"
        gl={{ 
          antialias: true, 
          alpha: true,
          localClippingEnabled: true,
          preserveDrawingBuffer: true
        }}
        onCreated={({ gl, scene }) => {
          gl.localClippingEnabled = true;
          gl.setClearColor('#1a1a1a', 1);
          
          // Configurar el renderer para clipping
          gl.clippingPlanes = [];
          gl.localClippingEnabled = true;
        }}
      >
        <InternalScene />
      </Canvas>
    </div>
  );
};

export default PointCloudViewer;
