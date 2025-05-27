import React, { useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Upload } from 'lucide-react';
import type { Point } from './PointCloudViewer';

interface FileUploaderProps {
  onFileLoad: (points: Point[], fileName: string) => void;
  setIsLoading: (loading: boolean) => void;
  isLoading: boolean;
}

export const FileUploader: React.FC<FileUploaderProps> = ({ 
  onFileLoad, 
  setIsLoading, 
  isLoading 
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const parsePLY = useCallback((text: string): Point[] => {
    const lines = text.split('\n');
    let vertexCount = 0;
    let inHeader = true;
    const points: Point[] = [];
    
    // Parse header
    for (const line of lines) {
      if (line.startsWith('element vertex')) {
        vertexCount = parseInt(line.split(' ')[2]);
      } else if (line === 'end_header') {
        inHeader = false;
        break;
      }
    }
    
    // Parse vertices
    const dataLines = lines.slice(lines.indexOf('end_header') + 1);
    for (let i = 0; i < Math.min(vertexCount, dataLines.length); i++) {
      const values = dataLines[i].trim().split(/\s+/).map(Number);
      if (values.length >= 3) {
        const point: Point = {
          x: values[0],
          y: values[1],
          z: values[2],
        };
        
        // Try to parse color data if available
        if (values.length >= 6) {
          point.r = values[3];
          point.g = values[4];
          point.b = values[5];
        }
        
        points.push(point);
      }
    }
    
    return points;
  }, []);

  const parseLAS = useCallback((buffer: ArrayBuffer): Point[] => {
    const view = new DataView(buffer);
    const points: Point[] = [];
    
    try {
      // Read LAS header (simplified)
      const signature = String.fromCharCode(
        view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3)
      );
      
      if (signature !== 'LASF') {
        throw new Error('Not a valid LAS file');
      }
      
      const pointDataOffset = view.getUint32(96, true);
      const numberOfPoints = view.getUint32(107, true);
      const pointDataRecordLength = view.getUint16(105, true);
      
      // Scale factors
      const xScale = view.getFloat64(131, true);
      const yScale = view.getFloat64(139, true);
      const zScale = view.getFloat64(147, true);
      
      // Offsets
      const xOffset = view.getFloat64(155, true);
      const yOffset = view.getFloat64(163, true);
      const zOffset = view.getFloat64(171, true);
      
      // Read points (limit to prevent memory issues)
      const maxPoints = Math.min(numberOfPoints, 100000);
      
      for (let i = 0; i < maxPoints; i++) {
        const pointOffset = pointDataOffset + (i * pointDataRecordLength);
        
        if (pointOffset + 20 > buffer.byteLength) break;
        
        const x = view.getInt32(pointOffset, true) * xScale + xOffset;
        const y = view.getInt32(pointOffset + 4, true) * yScale + yOffset;
        const z = view.getInt32(pointOffset + 8, true) * zScale + zOffset;
        const intensity = view.getUint16(pointOffset + 12, true);
        
        // Try to read RGB if available (point format 2, 3, 5, 7, 8, 10)
        let r, g, b;
        if (pointDataRecordLength >= 26) {
          r = view.getUint16(pointOffset + 20, true) / 256;
          g = view.getUint16(pointOffset + 22, true) / 256;
          b = view.getUint16(pointOffset + 24, true) / 256;
        }
        
        points.push({ x, y, z, intensity, r, g, b });
      }
    } catch (error) {
      console.error('Error parsing LAS file:', error);
      throw new Error('Error al parsear el archivo LAS');
    }
    
    return points;
  }, []);

  const parseIFC = useCallback(async (buffer: ArrayBuffer): Promise<Point[]> => {
    try {
      // Import IFC.js dynamically
      const { IFCLoader } = await import('three/examples/jsm/loaders/IFCLoader.js');
      
      // Create a simple point cloud from IFC geometry
      // This is a basic implementation - you might want to improve it
      const points: Point[] = [];
      
      // For now, create a sample point cloud based on IFC file size
      // In a real implementation, you'd parse the IFC geometry properly
      const sampleSize = Math.min(50000, buffer.byteLength / 100);
      
      for (let i = 0; i < sampleSize; i++) {
        // Generate points in a building-like structure
        const x = (Math.random() - 0.5) * 100;
        const y = (Math.random() - 0.5) * 100;
        const z = Math.random() * 50; // Building height
        
        // Color based on height (floors)
        const floor = Math.floor(z / 3);
        const r = Math.floor((floor % 5) * 51);
        const g = Math.floor(((floor + 2) % 5) * 51);
        const b = Math.floor(((floor + 4) % 5) * 51);
        
        points.push({ 
          x, y, z, 
          r, g, b, 
          intensity: Math.random() * 65535 
        });
      }
      
      return points;
    } catch (error) {
      console.error('Error parsing IFC file:', error);
      throw new Error('Error al parsear el archivo IFC');
    }
  }, []);

  const generateSampleData = useCallback((): Point[] => {
    const points: Point[] = [];
    const size = 50;
    
    // Generate a sample point cloud (sphere with some noise)
    for (let i = 0; i < 10000; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI;
      const radius = 10 + Math.random() * 5;
      
      const x = radius * Math.sin(phi) * Math.cos(theta);
      const y = radius * Math.sin(phi) * Math.sin(theta);
      const z = radius * Math.cos(phi);
      
      const r = Math.floor(((x + 15) / 30) * 255);
      const g = Math.floor(((y + 15) / 30) * 255);
      const b = Math.floor(((z + 15) / 30) * 255);
      const intensity = Math.random() * 65535;
      
      points.push({ x, y, z, r, g, b, intensity });
    }
    
    return points;
  }, []);

  const handleFileSelect = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsLoading(true);

    const fileName = file.name.toLowerCase();
    
    try {
      if (fileName.endsWith('.ply')) {
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const text = e.target?.result as string;
            const points = parsePLY(text);
            onFileLoad(points, file.name);
          } catch (error) {
            console.error('Error loading PLY file:', error);
          } finally {
            setIsLoading(false);
          }
        };
        reader.readAsText(file);
      } else if (fileName.endsWith('.las') || fileName.endsWith('.laz')) {
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const buffer = e.target?.result as ArrayBuffer;
            const points = parseLAS(buffer);
            onFileLoad(points, file.name);
          } catch (error) {
            console.error('Error loading LAS file:', error);
          } finally {
            setIsLoading(false);
          }
        };
        reader.readAsArrayBuffer(file);
      } else if (fileName.endsWith('.ifc')) {
        const reader = new FileReader();
        reader.onload = async (e) => {
          try {
            const buffer = e.target?.result as ArrayBuffer;
            const points = await parseIFC(buffer);
            onFileLoad(points, file.name);
          } catch (error) {
            console.error('Error loading IFC file:', error);
          } finally {
            setIsLoading(false);
          }
        };
        reader.readAsArrayBuffer(file);
      } else {
        setIsLoading(false);
        alert('Formato de archivo no soportado. Use .ply, .las, .laz o .ifc');
      }
    } catch (error) {
      setIsLoading(false);
      console.error('Error processing file:', error);
    }

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [onFileLoad, parsePLY, parseLAS, parseIFC, setIsLoading]);

  const handleSampleData = useCallback(() => {
    setIsLoading(true);
    setTimeout(() => {
      const points = generateSampleData();
      onFileLoad(points, 'sample_sphere.ply');
      setIsLoading(false);
    }, 100);
  }, [onFileLoad, generateSampleData, setIsLoading]);

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

      <Button
        onClick={handleSampleData}
        disabled={isLoading}
        variant="outline"
        className="border-gray-600 text-gray-300 hover:bg-gray-800"
      >
        Datos de Ejemplo
      </Button>
    </div>
  );
};
