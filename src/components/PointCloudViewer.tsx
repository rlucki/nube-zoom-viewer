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

export interface LoadedFile {
  id: string;
  name: string;
  data: Point[] | IFCGeometry;
  type: 'pointcloud' | 'ifc';
}

/* -------------------------------------------------------------------------- */
/*  Visor                                                                    */
/* -------------------------------------------------------------------------- */
export const PointCloudViewer = () => {
  /* ---------------------------- estado general ---------------------------- */
  const [loadedFiles, setLoadedFiles] = useState<LoadedFile[]>([]);
  const [density, setDensity] = useState(1);
  const [pointSize, setPointSize] = useState(2);
  const [colorMode, setColorMode] = useState<'rgb' | 'intensity' | 'height'>(
    'rgb',
  );
  const [transparency, setTransparency] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);

  /* ------------------------------- refs ui -------------------------------- */
  const controlsRef = useRef<any>(null);
  const { toast } = useToast();

  /* ----------------------------- filtros ---------------------------------- */
  const pointClouds = loadedFiles.filter((f) => f.type === 'pointcloud');
  const ifcModels = loadedFiles.filter((f) => f.type === 'ifc');

  /* ---------------------- vector OK para toda la escena ------------------- */
  const [worldOffset, setWorldOffset] = useState(() => new THREE.Vector3(0, 0, 0));

  useEffect(() => {
    if (loadedFiles.length === 0) return;

    /* 1. Calculamos un bounding-box global */
    const box = new THREE.Box3();
    pointClouds.forEach((file) => {
      (file.data as Point[]).forEach((p) => {
        box.expandByPoint(new THREE.Vector3(p.x, p.y, p.z));
      });
    });
    ifcModels.forEach((file) => {
      const g = file.data as IFCGeometry;
      if (g.bounds) {
        box.expandByPoint(g.bounds.min);
        box.expandByPoint(g.bounds.max);
      }
    });

    if (!box.isEmpty()) {
      /* 2. Centramos todo restando el centro al cargar/mostrar */
      const center = box.getCenter(new THREE.Vector3());
      setWorldOffset(center);
    }
  }, [loadedFiles]); // recalcula sólo cuando entra o sale un archivo

  /* --------------------------- nubes de puntos ---------------------------- */
  const allPoints = useMemo(
    () => pointClouds.flatMap((f) => f.data as Point[]),
    [pointClouds],
  );

  const sampledPoints = useMemo(() => {
    if (density >= 1) return allPoints;
    const step = Math.ceil(1 / density);
    return allPoints.filter((_, i) => i % step === 0);
  }, [allPoints, density]);

  /* ---------------------------- auto-fit cámara --------------------------- */
  useEffect(() => {
    if (!controlsRef.current || loadedFiles.length === 0) return;
    const controls = controlsRef.current;
    const box = new THREE.Box3();

    sampledPoints.forEach((p) => {
      box.expandByPoint(
        new THREE.Vector3(p.x, p.y, p.z).sub(worldOffset), // ojo al offset
      );
    });
    ifcModels.forEach((file) => {
      const g = file.data as IFCGeometry;
      box.expandByPoint(g.bounds.min.clone().sub(worldOffset));
      box.expandByPoint(g.bounds.max.clone().sub(worldOffset));
    });

    if (!box.isEmpty()) {
      const center = box.getCenter(new THREE.Vector3());
      const radius = box.getSize(new THREE.Vector3()).length() * 0.5;
      const distance = radius * 2.5;

      controls.target.copy(center);
      controls.object.position.set(
        center.x + distance,
        center.y + distance,
        center.z + distance,
      );
      controls.update();
    }
  }, [worldOffset, sampledPoints, ifcModels]);

  /* ----------------------- carga de nuevos archivos ----------------------- */
  const handleFileLoad = useCallback(
    (loadedData: Point[] | IFCGeometry, name: string) => {
      const newFile: LoadedFile = {
        id: `${Date.now()}-${Math.random()}`,
        name,
        data: loadedData,
        type: Array.isArray(loadedData) ? 'pointcloud' : 'ifc',
      };
      setLoadedFiles((prev) => [...prev, newFile]);

      toast({
        title: Array.isArray(loadedData)
          ? 'Nube de puntos cargada'
          : 'Modelo IFC cargado',
        description: Array.isArray(loadedData)
          ? `${loadedData.length.toLocaleString()} puntos`
          : name,
      });
    },
    [toast],
  );

  /* ---------------------------- reset visor ------------------------------ */
  const handleReset = useCallback(() => {
    setLoadedFiles([]);
    setDensity(1);
    setPointSize(2);
    setColorMode('rgb');
    setTransparency(1);
    setWorldOffset(new THREE.Vector3());
    controlsRef.current?.reset();
  }, []);

  /* -------------------- utilidades ui - contadores ----------------------- */
  const totalCount = allPoints.length;
  const visibleCount = sampledPoints.length;
  const hasData = loadedFiles.length > 0;

  /* ----------------------------------------------------------------------- */
  /*                             RENDER                                      */
  /* ----------------------------------------------------------------------- */
  return (
    <div className="w-full h-screen bg-gray-900 relative">
      {/* … ➊ HEADER, controles y overlays exactamente igual que antes … */}

      {/* 3D CANVAS */}
      <Canvas
