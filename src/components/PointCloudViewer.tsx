// …imports sin cambios
import { analysePointCloud } from '@/lib/align'; // util sencillo (lo añado al final)

export const PointCloudViewer = () => {
  /* ──────────────── estado ──────────────── */
  const [loadedFiles, setLoadedFiles] = useState<LoadedFile[]>([]);
  const [worldOffset, setWorldOffset] = useState<THREE.Vector3>(new THREE.Vector3()); // ⇦ nuevo
  const [unitScale, setUnitScale]   = useState<number>(1);                             // ⇦ nuevo
  // resto de estados sin cambios …

  /* ─────────── recalcular offset + escala cada vez que cargues algo ─────────── */
  useEffect(() => {
    if (loadedFiles.length === 0) return;

    // 1. Bounding box global
    const bbox = new THREE.Box3();
    loadedFiles.forEach((file) => {
      if (file.type === 'pointcloud') {
        (file.data as Point[]).forEach((p) =>
          bbox.expandByPoint(new THREE.Vector3(p.x, p.y, p.z))
        );
      } else {
        const g = file.data as IFCGeometry;
        bbox.expandByPoint(g.bounds.min);
        bbox.expandByPoint(g.bounds.max);
      }
    });

    // 2. Nuevo offset (centro)
    const newOffset = bbox.getCenter(new THREE.Vector3());
    setWorldOffset(newOffset);

    // 3. Escala de unidades (simple heurística)
    //    - Si hay al menos un IFC y su bounding box es >5000 ⇒ asumimos mm.
    const ifc = loadedFiles.find((f) => f.type === 'ifc') as LoadedFile | undefined;
    if (ifc) {
      const size = (ifc.data as IFCGeometry).bounds.max
        .clone()
        .sub((ifc.data as IFCGeometry).bounds.min);
      const guessMm = Math.max(size.x, size.y, size.z) > 5000; // >5 m en mm
      setUnitScale(guessMm ? 0.001 : 1);
    }
  }, [loadedFiles]);

  /* ─────────── resto del código idéntico salvo los props nuevos ─────────── */

  return (
    <div className="w-full h-screen bg-gray-900 relative">
      {/* …cabecera, controles, overlay sin cambios … */}

      <Canvas
        camera={{ position: [10, 10, 10], fov: 60, near: 0.1, far: 10000 }}
        className="absolute inset-0"
        gl={{ antialias: true, alpha: true }}
      >
        {/* Fondo, luces y helpers igual … */}

        {/* Nube de puntos */}
        {sampledPoints.length > 0 && (
          <PointCloud
            points={sampledPoints}
            pointSize={pointSize}
            colorMode={colorMode}
            worldOffset={worldOffset}   // ⇦ nuevo
            unitScale={1}               // ⇦ la nube ya está en metros
          />
        )}

        {/* IFC */}
        {ifcModels.map((file) => (
          <IFCModel
            key={file.id}
            geometry={file.data as IFCGeometry}
            transparency={transparency}
            worldOffset={worldOffset}   // ⇦ el mismo offset
            unitScale={unitScale}       // ⇦ 0.001 o 1
          />
        ))}

        {/* OrbitControls, Stats, helpers sin cambios … */}
      </Canvas>
    </div>
  );
};

/* util muy pequeño – ponlo donde prefieras */
export function analysePointCloud(pts: Point[]) {
  const box = new THREE.Box3();
  pts.forEach((p) => box.expandByPoint(new THREE.Vector3(p.x, p.y, p.z)));
  return { min: box.min, max: box.max, center: box.getCenter(new THREE.Vector3()) };
}
