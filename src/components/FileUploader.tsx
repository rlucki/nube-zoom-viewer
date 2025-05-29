// src/components/FileUploader.tsx
import React, { useCallback, useRef, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Upload } from 'lucide-react';
import * as THREE from 'three';
import { IFCLoader } from 'web-ifc-three';     // ← import corregido a IFCLoader

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

  // ——————————————————————
  // 1) Configuramos IFCLoader
  // ——————————————————————
  const ifcLoader = useMemo(() => {
    const loader = new IFCLoader();
    console.log('🟢 web-ifc.wasm → /wasm/web-ifc.wasm');
    loader.ifcManager.setWasmPath('/wasm/');
    return loader;
  }, []);

  // ——————————————————————
  // 2) parsePLY (ASCII)
  // ——————————————————————
  const parsePLY = useCallback((text: string): Point[] => {
    const lines = text.split('\n');
    let count = 0;
    const pts: Point[] = [];

    for (const line of lines) {
      if (line.startsWith('element vertex')) {
        count = parseInt(line.split(' ')[2], 10);
      } else if (line.trim() === 'end_header') {
        break;
      }
    }

    const data = lines.slice(lines.indexOf('end_header') + 1);
    for (let i = 0; i < Math.min(count, data.length); i++) {
      const vals = data[i].trim().split(/\s+/).map(Number);
      const p: Point = { x: vals[0], y: vals[1], z: vals[2] };
      if (vals.length >= 6) {
        p.r = vals[3];
        p.g = vals[4];
        p.b = vals[5];
      }
      pts.push(p);
    }
    return pts;
  }, []);

  // ——————————————————————
  // 3) parseLAS (binario LAS/LAZ)
  // ——————————————————————
  const parseLAS = useCallback((buffer: ArrayBuffer): Point[] => {
    const view = new DataView(buffer);
    const sig = String.fromCharCode(
      view.getUint8(0),
      view.getUint8(1),
      view.getUint8(2),
      view.getUint8(3)
    );
    if (sig !== 'LASF') throw new Error('No es un LAS válido');

    const offsetHeader = view.getUint32(96, true);
    const numPts       = view.getUint32(107, true);
    const recLen       = view.getUint16(105, true);
    const xScale       = view.getFloat64(131, true);
    const yScale       = view.getFloat64(139, true);
    const zScale       = view.getFloat64(147, true);
    const xOff         = view.getFloat64(155, true);
    const yOff         = view.getFloat64(163, true);
    const zOff         = view.getFloat64(171, true);

    const maxPts = Math.min(numPts, 200_000);
    const pts: Point[] = [];

    for (let i = 0; i < maxPts; i++) {
      const off = offsetHeader + i * recLen;
      if (off + 20 > buffer.byteLength) break;

      const x = view.getInt32(off,     true) * xScale + xOff;
      const y = view.getInt32(off + 4, true) * yScale + yOff;
      const z = view.getInt32(off + 8, true) * zScale + zOff;
      const intensity = view.getUint16(off + 12, true);

      let r, g, b;
      if (recLen >= 26) {
        r = view.getUint16(off + 20, true) / 256;
        g = view.getUint16(off + 22, true) / 256;
        b = view.getUint16(off + 24, true) / 256;
      }

      pts.push({ x, y, z, intensity, r, g, b });
    }
    return pts;
  }, []);

  // ——————————————————————
  // 4) parseIFC con loadAsync
  // ——————————————————————
  const parseIFC = useCallback(
    async (buffer: ArrayBuffer): Promise<IFCGeometry> => {
      const blob = new Blob([buffer], { type: 'application/octet-stream' });
      const url  = URL.createObjectURL(blob);

      try {
        // USAMOS LA INSTANCIA: ifcLoader.loadAsync()
        const modelGroup = (await ifcLoader.loadAsync(url)) as THREE.Group;

        const meshes: THREE.Mesh[] = [];
        modelGroup.traverse(child => {
          if ((child as THREE.Mesh).isMesh) {
            const m = (child as THREE.Mesh).clone();
            m.geometry.computeBoundingBox();
            m.frustumCulled = false;
            meshes.push(m);
          }
        });

        const box = new THREE.Box3().setFromObject(modelGroup);
        return {
          type: 'ifc',
          meshes,
          bounds: { min: box.min.clone(), max: box.max.clone() },
        };
      } finally {
        URL.revokeObjectURL(url);
      }
    },
    [ifcLoader]
  );

  // ——————————————————————
  // 5) handleFileSelect
  // ——————————————————————
  const handleFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setIsLoading(true);
      const name = file.name.toLowerCase();

      try {
        if (name.endsWith('.ply')) {
          const txt = await file.text();
          onFileLoad(parsePLY(txt), file.name);

        } else if (name.endsWith('.las') || name.endsWith('.laz')) {
          const buf = await file.arrayBuffer();
          onFileLoad(parseLAS(buf), file.name);

        } else if (name.endsWith('.ifc')) {
          const buf  = await file.arrayBuffer();
          const geom = await parseIFC(buf);
          onFileLoad(geom, file.name);

        } else {
          alert('Formato no soportado. Usa .PLY, .LAS, .LAZ o .IFC');
        }
      } catch (err) {
        console.error('🚨 Error cargando archivo:', err);
        alert('Hubo un error al procesar el archivo. Mira la consola.');
      } finally {
        setIsLoading(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    },
    [parsePLY, parseLAS, parseIFC, onFileLoad, setIsLoading]
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
