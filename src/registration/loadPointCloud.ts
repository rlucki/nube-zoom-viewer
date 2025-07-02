
import { load } from '@loaders.gl/core';
import { LASLoader } from '@loaders.gl/las';
import { PLYLoader } from 'three/examples/jsm/loaders/PLYLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import * as THREE from 'three';
import type { Point } from '../components/PointCloudViewer';

/** Options for the point cloud loader. */
export interface LoadOptions {
  /** Force file format. If 'auto', it will be inferred from URL. */
  format?: 'auto' | 'las' | 'ply' | 'obj';
  /** Downsample ratio in range [0,1]. */
  downsample?: number;
}

/**
 * Carga una nube de puntos desde la URL indicada. Se soportan
 * archivos LAS, PLY y OBJ. Devuelve un array de puntos ya centrados
 * en el origen y, opcionalmente, reducidos mediante muestreo.
 */
export async function loadPointCloud(
  url: string,
  { format = 'auto', downsample = 0 }: LoadOptions = {},
): Promise<Point[]> {
  const lower = url.toLowerCase();
  const fmt = format !== 'auto'
    ? format
    : lower.endsWith('.las')
      ? 'las'
      : lower.endsWith('.ply')
        ? 'ply'
        : 'obj';

  let points: Point[] = [];

  if (fmt === 'las') {
    interface LASPoint { position: [number, number, number]; intensity?: number; color?: [number, number, number]; }
    interface LASData { points: LASPoint[] }
    const data = await load(url, LASLoader, { worker: false }) as unknown as LASData;
    points = data.points.map((p) => ({
      x: p.position[0],
      y: p.position[1],
      z: p.position[2],
      intensity: p.intensity,
      r: p.color?.[0],
      g: p.color?.[1],
      b: p.color?.[2],
    }));
  } else if (fmt === 'ply') {
    const loader = new PLYLoader();
    const geometry = await loader.loadAsync(url);
    const pos = geometry.getAttribute('position');
    const col = geometry.getAttribute('color');
    for (let i = 0; i < pos.count; i++) {
      const p: Point = {
        x: pos.getX(i),
        y: pos.getY(i),
        z: pos.getZ(i),
      };
      if (col) {
        p.r = col.getX(i);
        p.g = col.getY(i);
        p.b = col.getZ(i);
      }
      points.push(p);
    }
  } else if (fmt === 'obj') {
    const loader = new OBJLoader();
    const group = await loader.loadAsync(url);
    group.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (mesh.isMesh) {
        const geom = mesh.geometry as THREE.BufferGeometry;
        const pos = geom.getAttribute('position');
        const col = geom.getAttribute('color');
        for (let i = 0; i < pos.count; i++) {
          const p: Point = {
            x: pos.getX(i),
            y: pos.getY(i),
            z: pos.getZ(i),
          };
          if (col) {
            p.r = col.getX(i);
            p.g = col.getY(i);
            p.b = col.getZ(i);
          }
          points.push(p);
        }
      }
    });
  } else {
    throw new Error('Formato no soportado');
  }

  if (points.length === 0) return points;

  // Centrar al origen para facilitar el registro
  const geom = new THREE.BufferGeometry();
  geom.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(points.flatMap((p) => [p.x, p.y, p.z]), 3),
  );
  geom.computeBoundingBox();
  const center = geom.boundingBox!.getCenter(new THREE.Vector3());
  points = points.map((p) => ({ x: p.x - center.x, y: p.y - center.y, z: p.z - center.z, r: p.r, g: p.g, b: p.b, intensity: p.intensity }));

  // Downsample simple por paso
  if (downsample > 0 && downsample < 1) {
    const step = Math.round(1 / downsample);
    points = points.filter((_, i) => i % step === 0);
  }

  return points;
}
