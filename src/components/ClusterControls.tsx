import React from 'react';
import { Select, SelectItem, SelectContent, SelectTrigger, SelectValue } from '@/components/ui/select';

interface ClusterControlsProps {
  presets: string[];
  current: string;
  onChange: (key: string) => void;
  legend?: Record<string, string>;
}

export const ClusterControls: React.FC<ClusterControlsProps> = ({ presets, current, onChange, legend }) => {
  return (
    <div className="p-2 text-white space-y-2">
      <Select value={current} onValueChange={onChange}>
        <SelectTrigger className="w-40 bg-gray-800 border-gray-600">
          <SelectValue placeholder="Preset" />
        </SelectTrigger>
        <SelectContent className="bg-gray-800 text-white">
          {presets.map((p) => (
            <SelectItem key={p} value={p}>{p}</SelectItem>
          ))}
          <SelectItem value="advanced">Advanced...</SelectItem>
        </SelectContent>
      </Select>
      {legend && (
        <div className="flex flex-wrap gap-2">
          {Object.entries(legend).map(([k, color]) => (
            <div key={k} className="flex items-center gap-1 text-xs">
              <span className="w-3 h-3 inline-block" style={{ background: color }} />
              {k}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
