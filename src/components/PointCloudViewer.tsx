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
import { TransformDisplay } from './TransformDisplay';
import { TopToolbar } from './TopToolbar';
import { Scene } from './Scene';
import { useDragState } from '../hooks/useDragState';
import { usePrimitiveDetection } from '../hooks/usePrimitiveDetection';
import { PrimitiveVisualizer } from './PrimitiveVisualizer';
import { ProgressPanel } from './ProgressPanel';
import { IFCGraphPanel } from './IFCGraphPanel';
import { buildBVH } from '../registration/bvhIntersect';
import { computeCoverage, CoverageMap } from '../registration/progressMetrics';

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
  modelID: number;
  ifcManager: any;
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
  const [dragSensitivity, setDragSensitivity] = useState(0.001); // Reducir sensibilidad por defecto

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
  const [sectionBoxBounds, setSectionBoxBounds] = useState<{
    min: THREE.Vector3;
    max: THREE.Vector3;
  } | null>(null);

  /* -------------------- Nuevo: Estados de detección de primitivas ---------- */
  const {
    primitives,
    isDetecting,
    params: detectionParams,
    detectPrimitives,
    clearPrimitives,
    updateParams: updateDetectionParams,
    getSnapPoint,
  } = usePrimitiveDetection();
  
  const [primitiveDetectionActive, setPrimitiveDetectionActive] = useState(false);
  const [showPrimitives, setShowPrimitives] = useState(true);

  /* -------------------- Estados de progreso ------------------------------- */
  const [progressData, setProgressData] = useState<CoverageMap | null>(null);
  const [showProgress, setShowProgress] = useState(false);

  /* -------------------- IFC Graph Panel ---------------------------------- */
  const [showIfcGraph, setShowIfcGraph] = useState(false);

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

  const ifcGraphInfo = useMemo(() => {
    if (ifcModels.length === 0) return null;
    const geom = ifcModels[0].data as IFCGeometry;
    return { modelID: geom.modelID, ifcManager: geom.ifcManager };
  }, [ifcModels]);

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
    setProgressData(null);
    setShowProgress(false);
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

  const handleComputeProgress = useCallback(() => {
    if (ifcModels.length === 0 || sampledPoints.length === 0) return;
    const mesh = (ifcModels[0].data as IFCGeometry).meshes[0];
    const ctx = buildBVH(mesh);
    const coverage = computeCoverage(sampledPoints, ctx);
    setProgressData(coverage);
    setShowProgress(true);
    toast({ title: 'Progreso calculado', description: 'Cobertura analizada' });
  }, [ifcModels, sampledPoints, toast]);

  /* -------------------- Mejorar medición con primitivas ------------------- */
  const enhancedHandleMeasurement = useCallback(
    (distance: number, points: [THREE.Vector3, THREE.Vector3]) => {
      let enhancedDescription = `Distancia: ${distance.toFixed(3)} m`;
      
      if (primitives.length > 0) {
        // Verificar si los puntos están cerca de primitivas detectadas
        const [p1, p2] = points;
        const snapThreshold = 0.2;
        
        const p1Primitive = primitives.find(prim => {
          const snapPoint = getSnapPoint(p1, prim);
          return p1.distanceTo(snapPoint) < snapThreshold;
        });
        
        const p2Primitive = primitives.find(prim => {
          const snapPoint = getSnapPoint(p2, prim);
          return p2.distanceTo(snapPoint) < snapThreshold;
        });
        
        if (p1Primitive || p2Primitive) {
          enhancedDescription += ' (con snap a primitiva)';
        }
      }
      
      setMeasurements((p) => [...p, { distance, points }]);
      toast({
        title: 'Medición completada',
        description: enhancedDescription,
      });
    },
    [primitives, getSnapPoint, toast],
  );

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

  const handleTransformReset = useCallback(() => {
    toast({
      title: 'Transformación reiniciada',
      description: 'El objeto ha vuelto a su posición original',
    });
  }, [toast]);

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
    
    toast({
      title: active
        ? 'Herramienta de sección activada'
        : 'Herramienta de sección desactivada',
      description: active
        ? 'Arrastra los controles de colores para seccionar el modelo'
        : 'Sección desactivada',
    });
  }, [toast, cancelDrag]);

  const [cameraControlsEnabled, setCameraControlsEnabled] = useState(true);

  const updateCameraControls = useCallback((enabled: boolean) => {
    console.log('Updating camera controls enabled:', enabled);
    setCameraControlsEnabled(enabled);
    if (controlsRef.current) {
      controlsRef.current.enabled = enabled;
      // Aumentar sensibilidad para mejor control
      if (enabled) {
        controlsRef.current.rotateSpeed = 2.0; // Mayor sensibilidad
        controlsRef.current.zoomSpeed = 1.5;
        controlsRef.current.panSpeed = 1.5;
      }
    }
  }, []);

  // Manejar arrastre de transformación - SIMPLIFICADO
  const handleTransformDragChange = useCallback((dragging: boolean) => {
    console.log('Transform dragging changed:', dragging);
    setIsTransformDragging(dragging);
    
    // Solo desactivar controles durante arrastre real
    updateCameraControls(!dragging);
  }, [updateCameraControls]);

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
      // CRÍTICO: Restaurar controles de cámara cuando se desactiva transform
      updateCameraControls(true);
      setIsTransformDragging(false);
    }
    
    setTransformActive(active);
    
    toast({
      title: active ? 'Herramienta de transformación activada' : 'Herramienta de transformación desactivada',
      description: active ? 'Selecciona un objeto haciendo clic sobre él' : 'Transformaciones deshabilitadas',
    });
  }, [toast, cancelDrag, updateCameraControls]);

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
  }, [cancelDrag]);

  const handleDetectPrimitives = useCallback(() => {
    if (sampledPoints.length === 0) {
      toast({
        title: 'No hay puntos',
        description: 'Carga una nube de puntos primero',
        variant: 'destructive',
      });
      return;
    }

    detectPrimitives(sampledPoints);
    setPrimitiveDetectionActive(true);
    setShowPrimitives(true);
    
    toast({
      title: 'Detectando primitivas',
      description: 'Analizando la nube de puntos...',
    });
  }, [sampledPoints, detectPrimitives, toast]);

  const handleClearPrimitives = useCallback(() => {
    clearPrimitives();
    setPrimitiveDetectionActive(false);
    setShowPrimitives(false);
    toast({
      title: 'Primitivas limpiadas',
      description: 'Todas las primitivas detectadas han sido eliminadas',
    });
  }, [clearPrimitives, toast]);

  /* -------------------- Estados de arrastre mejorados ---------------------- */

  /* -------------------- Mejorar control de cámara -------------------------- */

  /* -------------------------------------------------------------------------- */
  /*  Escena interna (luces, modelos, etc.)                                     */
  /* -------------------------------------------------------------------------- */
  const centeredGroupRef = useRef<{ centered: boolean }>({ centered: false });

  const InternalScene = () => {
    const { scene } = useThree();
    const contentGroupRef = useRef<THREE.Group>(null);

    useLayoutEffect(() => {
      // SOLO centrar el grupo si NO ha sido recentrado 
      // y el número de archivos cargados ha cambiado (es decir, se ha cargado uno nuevo)
      if (contentGroupRef.current && loadedFiles.length > 0 && !centeredGroupRef.current.centered) {
        setTimeout(() => {
          const group = contentGroupRef.current;
          if (!group) return;
          const box = new THREE.Box3().setFromObject(group);

          if (!box.isEmpty()) {
            const center = box.getCenter(new THREE.Vector3());
            group.position.sub(center);
            if (controlsRef.current) {
              controlsRef.current.target.set(0, 0, 0);
              controlsRef.current.update();
            }
            centeredGroupRef.current.centered = true;
          }
        }, 0);
      }
      // Si *no* hay archivos, volvemos a permitir el centrado la próxima vez que se suban archivos
      if (loadedFiles.length === 0) {
        centeredGroupRef.current.centered = false;
      }
    }, [loadedFiles.length]); // SOLO depende del número de archivos cargados

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

            {/* Visualización de primitivas detectadas */}
            <PrimitiveVisualizer
              primitives={primitives}
              visible={showPrimitives && primitiveDetectionActive}
            />
          </group>

          {/* Selector de objetos - con menor sensibilidad */}
          <ObjectSelector
            isActive={transformActive && !selectedObject && !isTransformDragging}
            isDragging={isTransformDragging}
            onObjectHover={() => {}}
            onObjectSelect={handleObjectSelection}
            hoverSensitivity={0.3} // Reducir sensibilidad de hover
          />

          {/* Manipulador de transformación */}
          <TransformManipulator
            object={selectedObject}
            isActive={transformActive && selectedObject !== null}
            mode={transformMode}
            onDraggingChange={handleTransformDragChange}
          />

          {/* Herramienta de medición mejorada */}
          <MeasurementTool
            isActive={measurementActive}
            snapMode={snapMode}
            orthoMode={orthoMode}
            onMeasure={enhancedHandleMeasurement}
            onSnapModeChange={setSnapMode}
          />

          {/* Controles de cámara - con mayor sensibilidad */}
          <OrbitControls
            ref={controlsRef}
            enablePan={orbitEnabled}
            enableZoom={orbitEnabled}
            enableRotate={orbitEnabled}
            enabled={orbitEnabled}
            zoomSpeed={1.5} // Aumentar sensibilidad
            panSpeed={1.5}
            rotateSpeed={2.0} // Mayor sensibilidad de rotación
            dampingFactor={0.03} // Menor damping para más responsividad
            enableDamping={true}
            maxDistance={1000}
            minDistance={0.1}
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
  const orbitEnabled = cameraControlsEnabled && !(transformActive && selectedObject !== null);

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
        dragSensitivity={dragSensitivity}
        setDragSensitivity={setDragSensitivity}
        showSectionSensitivity={sectionBoxActive}
        // Nuevos props para primitivas
        primitiveDetectionActive={primitiveDetectionActive}
        onDetectPrimitives={handleDetectPrimitives}
        onClearPrimitives={handleClearPrimitives}
        primitiveCount={primitives.length}
        isDetecting={isDetecting}
        showPrimitives={showPrimitives}
        onToggleShowPrimitives={setShowPrimitives}
        onComputeProgress={handleComputeProgress}
        hasIFC={ifcModels.length > 0}
        onToggleIfcGraph={() => setShowIfcGraph(!showIfcGraph)}
        showIfcGraph={showIfcGraph}
      />

      {/* ---------- Display de transformación -------------------------------- */}
      <TransformDisplay
        object={selectedObject}
        mode={transformMode}
        isVisible={transformActive && selectedObject !== null}
        onReset={handleTransformReset}
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

      {showProgress && (
        <ProgressPanel data={progressData} onClose={() => setShowProgress(false)} />
      )}
      {showIfcGraph && ifcGraphInfo && (
        <IFCGraphPanel
          ifcManager={ifcGraphInfo.ifcManager}
          modelID={ifcGraphInfo.modelID}
          onClose={() => setShowIfcGraph(false)}
        />
      )}
      {/* --- QUITADO: Section Box Sensitivity Slider --- */}

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
        gl={{ 
          antialias: true, 
          alpha: true,
          localClippingEnabled: true,
          preserveDrawingBuffer: true
        }}
        onCreated={({ gl, scene }) => {
          gl.localClippingEnabled = true;
          gl.setClearColor('#1a1a1a', 1);
          gl.clippingPlanes = [];
          gl.localClippingEnabled = true;
        }}
      >
        <InternalScene />
        {/* Pass dragSensitivity to SectionBox! */}
        <SectionBox
          isActive={sectionBoxActive}
          bounds={sectionBoxBounds}
          setBounds={setSectionBoxBounds}
          dragSensitivity={dragSensitivity}
          onDragSensitivityChange={setDragSensitivity}
        />
      </Canvas>
    </div>
  );
};

export default PointCloudViewer;
