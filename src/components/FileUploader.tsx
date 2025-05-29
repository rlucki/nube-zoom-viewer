// src/components/FileUploader.tsx
import React, { useCallback, useRef, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Upload } from 'lucide-react';
import * as THREE from 'three';

// 1) Importamos el .wasm como URL para que Vite lo trate como asset
import wasmUrl from 'web-ifc-three/lin/web-ifc.wasm?url';
import { IfcLoader } from 'web-ifc-three';

import type { Point, ViewerData, IFCGeometry } from './PointCloudViewer';

interface FileUploaderProps {
  onFileLoad: (data: ViewerData, fileName: string) => void;
  setIsLoading: (loading: boolean) => void;
  isLoading: boolean;
}

export const FileUploader: React.FC<FileUploaderProps> = ({
  onFileLoad,
  setIsLoading,
  isLoading,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  // —————————————————————————————————————————————————————————
  // 2) Inicializamos el IfcLoader con la ruta correcta al .wasm
  //    Gracias al ?url, `wasmUrl` será algo tipo '/assets/web-ifc.ABCD.wasm'
  // —————————————————————————————————————————————————————————
  const ifcLoader = useMemo(() => {
    const loader = new IfcLoader();
    console.log('🟢 Configurando web-ifc.wasm en:', wasmUrl);
    loader.ifcManager.setWasmPath(wasmUrl);
    // loader.ifcManager.useWebWorkers(true, '/ifcWorker.js'); // opcional
    return loader;
  }, []);

  // —————————————————————————————————————————————————————————
  // 3) Parseadores de nubes de puntos (PLY & LAS), sin cambios
  // —————————————————————————————————————————————————————————
  const parsePLY = useCallback((text: string): Point[] => {
    /* ... tu código de PLY ... */
    const lines = text.split('\n');
    let vertexCount = 0;
    const points: Point[] = [];
    for (const line of lines) {
      if (line.startsWith('element vertex')) {
        vertexCount = parseInt(line.split(' ')[2]);
      } else if (line.trim() === 'end_header') {
        break;
      }
    }
    const dataLines = lines.slice(lines.indexOf('end_header') + 1);
    for (let i = 0; i < Math.min(vertexCount, dataLines.length); i++) {
      const vals = dataLines[i].trim().split(/\s+/).map(Number);
      const p: Point = { x: vals[0], y: vals[1], z: vals[2] };
      if (vals.length >= 6) {
        p.r = vals[3]; p.g = vals[4]; p.b = vals[5];
      }
      points.push(p);
    }
    return points;
  }, []);

  const parseLAS = useCallback((buffer: ArrayBuffer): Point[] => {
    /* ... tu código de LAS ... */
    const view = new DataView(buffer);
    const sig = String.fromCharCode(
      view.getUint8(0),
      view.getUint8(1),
      view.getUint8(2),
      view.getUint8(3)
    );
    if (sig !== 'LASF') throw new Error('No es un LAS válido');
    const pointDataOffset = view.getUint32(96, true);
    const numPoints       = view.getUint32(107, true);
    const recordLength    = view.getUint16(105, true);
    const xScale = view.getFloat64(131, true);
    const yScale = view.getFloat64(139, true);
    const zScale = view.getFloat64(147, true);
    const xOff   = view.getFloat64(155, true);
    const yOff   = view.getFloat64(163, true);
    const zOff   = view.getFloat64(171, true);

    const maxPts = Math.min(numPoints, 200_000);
    const points: Point[] = [];

    for (let i = 0; i < maxPts; i++) {
      const offset = pointDataOffset + i * recordLength;
      if (offset + 20 > buffer.byteLength) break;
      const x = view.getInt32(offset,     true) * xScale + xOff;
      const y = view.getInt32(offset + 4, true) * yScale + yOff;
      const z = view.getInt32(offset + 8, true) * zScale + zOff;
      const intensity = view.getUint16(offset + 12, true);
      let r, g, b;
      if (recordLength >= 26) {
        r = view.getUint16(offset + 20, true) / 256;
        g = view.getUint16(offset + 22, true) / 256;
        b = view.getUint16(offset + 24, true) / 256;
      }
      points.push({ x, y, z, intensity, r, g, b });
    }
    return points;
  }, []);

  // —————————————————————————————————————————————————————————
  // 4) Nuevo parseIFC: usamos loadAsync para asegurar compatibilidad
  // —————————————————————————————————————————————————————————
  const parseIFC = useCallback(
    async (buffer: ArrayBuffer): Promise<IFCGeometry> => {
      // 4.1 Creamos un Blob URL para simular una URL remota
      const blob = new Blob([buffer], { type: 'application/octet-stream' });
      const url  = URL.createObjectURL(blob);

      // 4.2 Cargamos con loadAsync en lugar de parse (más robusto)
      const modelGroup: THREE.Group = await ifcLoader.loadAsync(url);

      // 4.3 Extraemos todas las meshes reales del IFC
      const meshes: THREE.Mesh[] = [];
      modelGroup.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          const mesh = (child as THREE.Mesh).clone();
          mesh.geometry.computeBoundingBox();
          mesh.frustumCulled = false;
          meshes.push(mesh);
        }
      });

      // 4.4 Calculamos la caja envolvente global para retornarla
      const boundsBox = new THREE.Box3().setFromObject(modelGroup);

      return {
        type: 'ifc',
        meshes,
        bounds: {
          min: boundsBox.min.clone(),
          max: boundsBox.max.clone(),
        },
      };
    },
    [ifcLoader]
  );

  // —————————————————————————————————————————————————————————
  // 5) Manejador de selección de archivo
  // —————————————————————————————————————————————————————————
  const handleFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setIsLoading(true);

      const name = file.name.toLowerCase();
      try {
        if (name.endsWith('.ply')) {
          const txt = await file.text();
          const pts = parsePLY(txt);
          onFileLoad(pts, file.name);

        } else if (name.endsWith('.las') || name.endsWith('.laz')) {
          const buf = await file.arrayBuffer();
          const pts = parseLAS(buf);
          onFileLoad(pts, file.name);

        } else if (name.endsWith('.ifc')) {
          const buf  = await file.arrayBuffer();
          const geom = await parseIFC(buf);
          onFileLoad(geom, file.name);

        } else {
          alert('Formato no soportado. Usa .ply, .las, .laz o .ifc');
        }
      } catch (err) {
        console.error('🚨 Error cargando archivo:', err);
        alert('Hubo un error al procesar el archivo. Mira la consola.');
      } finally {
        setIsLoading(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    },
    [onFileLoad, parsePLY, parseLAS, parseIFC, setIsLoading]
  );

  return (
    <div className="flex items-center gap-2">
      <input
        ref={fileInputRef}
        type="file"
        accept=".ply,.las,.laz,.ifc"
        onChange={handleFileSelect}
        className="hidden"
      />

      <Button
        onClick={() => fileInputRef.current?.click()}
        disabled={isLoading}
        className="bg-blue-600 hover:bg-blue-700"
      >
        <Upload className="w-4 h-4 mr-2" />
        Cargar Archivo
      </Button>
    </div>
  );
};
