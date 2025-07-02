import React from 'react';
import { Card } from '@/components/ui/card';
import type { CoverageMap } from '../registration/progressMetrics';

interface ProgressPanelProps {
  data: CoverageMap | null;
  onClose: () => void;
}

export const ProgressPanel: React.FC<ProgressPanelProps> = ({ data, onClose }) => {
  if (!data) return null;

  const entries = Object.entries(data);

  return (
    <Card className="absolute top-32 right-4 z-10 p-4 bg-black/80 backdrop-blur-sm border-gray-700 text-white min-w-60">
      <div className="flex justify-between items-center mb-2">
        <div className="font-semibold">Progreso IFC</div>
        <button onClick={onClose} className="text-gray-400">×</button>
      </div>
      <div className="max-h-60 overflow-auto text-sm">
        <table className="w-full">
          <thead>
            <tr className="text-gray-300 text-xs">
              <th className="text-left">ID</th>
              <th className="text-right">Puntos</th>
              <th className="text-right">% Cob.</th>
            </tr>
          </thead>
          <tbody>
            {entries.map(([id, v]) => (
              <tr key={id}>
                <td>{id}</td>
                <td className="text-right">{v.matchedPts}</td>
                <td className="text-right">{v.coverage.toFixed(1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
};
