// src/components/FileUploader.tsx
import React, { useCallback, useRef, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Upload } from 'lucide-react';
import * as THREE from 'three';
import { IFCLoader } from 'web-ifc-three';

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

  // 1) IFCLoader con WASM
  const ifcLoader = useMemo(() => {
    const loader = new IFCLoader();
    loader.ifcManager.setWasmPath('/wasm/');
    return loader;
  }, []);

  // 2) parsePLY
  const parsePLY = useCallback((text: string): Point[] => {
    const lines = text.split('\n');
    let count = 0;
    for (const line of lines) {
      if (line.startsWith('element vertex')) {
        count = parseInt(line.split(' ')[2], 10);
      } else if (line.trim() === 'end_header') {
        break;
      }
    }
    const data = lines.slice(lines.indexOf('end_header') + 1);
    const pts: Point[] = [];
    for (let i = 0; i < Math.min(count, data.length); i++) {
      const vals = data[i].trim().split(/\s+/).map(Number);
      const p: Point = { x: vals[0], y: vals[1], z: vals[2] };
      if (vals.length >= 6) {
        p.r = vals[3]; p.g = vals[4]; p.b = vals[5];
      }
      pts.push(p);
    }
    return pts;
  }, []);

  // 3) parseLAS con Scale+Offset y sin límite
  const parseLAS = useCallback((buffer: ArrayBuffer): Point[] => {
    const view = new DataView(buffer);
    // Firma LAS
    const signature = String.fromCharCode(
      view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3)
    );
    if (signature !== 'LASF') throw new Error('No es un LAS válido');

    // Offset, recLen, count
    const pointDataOffset       = view.getUint32(96,  true);
    const numberOfPoints        = view.getUint32(107, true);
    const pointDataRecordLength = view.getUint16(105, true);

    // Scale + Offset del header
    const xScale  = view.getFloat64(131, true);
    const yScale  = view.getFloat64(139, true);
    const zScale  = view.getFloat64(147, true);
    const xOffset = view.getFloat64(155, true);
    const yOffset = view.getFloat64(163, true);
    const zOffset = view.getFloat64(171, true);

    // Aviso si no hay geolocalización
    if (Math.abs(xOffset) < 1e-6 && Math.abs(yOffset) < 1e-6 && Math.abs(zOffset) < 1e-6) {
      console.warn('LAS sin offset: se mostrará centrado local en (0,0,0).');
    }

    const pts: Point[] = [];
    for (let i = 0; i < numberOfPoints; i++) {
      const off = pointDataOffset + i * pointDataRecordLength;
      if (off + 20 > buffer.byteLength) break;

      // Coordenadas reales
      const rawX = view.getInt32(off,     true);
      const rawY = view.getInt32(off + 4, true);
      const rawZ = view.getInt32(off + 8, true);
      const x = rawX * xScale + xOffset;
      const y = rawY * yScale + yOffset;
      const z = rawZ * zScale + zOffset;

      // Intensidad + RGB
      const intensity = view.getUint16(off + 12, true);
      let r: number|undefined, g: number|undefined, b: number|undefined;
      if (pointDataRecordLength >= 26) {
        r = view.getUint16(off + 20, true) / 256;
        g = view.getUint16(off + 22, true) / 256;
        b = view.getUint16(off + 24, true) / 256;
      }
      pts.push({ x, y, z, intensity, r, g, b });
    }
    return pts;
  }, []);

  // 4) parseIFC
  const parseIFC = useCallback(async (buffer: ArrayBuffer): Promise<IFCGeometry> => {
    const blob = new Blob([buffer], { type: 'application/octet-stream' });
    const url  = URL.createObjectURL(blob);
    try {
      const group = await ifcLoader.loadAsync(url) as THREE.Group;
      const meshes: THREE.Mesh[] = [];
      group.traverse(child => {
        if ((child as THREE.Mesh).isMesh) {
          const m = (child as THREE.Mesh).clone();
          m.geometry.computeBoundingBox();
          m.frustumCulled = false;
          meshes.push(m);
        }
      });
      const box = new THREE.Box3().setFromObject(group);
      return { type: 'ifc', meshes, bounds: { min: box.min.clone(), max: box.max.clone() }};
    } finally {
      URL.revokeObjectURL(url);
    }
  }, [ifcLoader]);

  // 5) handleFileSelect
  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsLoading(true);

    try {
      const name = file.name.toLowerCase();
      if (name.endsWith('.ply')) {
        const txt = await file.text();
        onFileLoad(parsePLY(txt), file.name);
      } else if (name.endsWith('.las') || name.endsWith('.laz')) {
        const buf = await file.arrayBuffer();
        onFileLoad(parseLAS(buf), file.name);
      } else if (name.endsWith('.ifc')) {
        const buf = await file.arrayBuffer();
        onFileLoad(await parseIFC(buf), file.name);
      } else {
        alert('Formato no soportado.');
      }
    } catch (err) {
      console.error(err);
      alert('Error al procesar archivo.');
    } finally {
      setIsLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, [parsePLY, parseLAS, parseIFC, onFileLoad]);

  return (
    <div className="flex items-center gap-2">
      <input
        ref={fileInputRef}
        type="file"
        accept=".ply,.las,.laz,.ifc"
        onChange={handleFileSelect}
        className="hidden"
      />
      <Button onClick={() => fileInputRef.current?.click()} disabled={isLoading}>
        <Upload className="w-4 h-4 mr-2" /> Cargar Archivo
      </Button>
    </div>
  );
};
