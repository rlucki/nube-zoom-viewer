import { useState, useEffect, useCallback } from 'react';
import type { IFCManager } from 'web-ifc-three/IFC/components/IFCManager';
import type { ClusterResult, ElementInfo } from '@/workers/clusterWorker';

const worker = new Worker(new URL('../workers/clusterWorker.ts', import.meta.url), {
  type: 'module',
});

export interface UseIFCClustering {
  clusters: ClusterResult | null;
  recompute: (key: string) => void;
  presets: string[];
  currentKey: string;
}

export function useIFCClustering(ifcManager: IFCManager, modelID: number): UseIFCClustering {
  const [clusters, setClusters] = useState<ClusterResult | null>(null);
  const [currentKey, setCurrentKey] = useState<string>(() => localStorage.getItem('ifc-cluster-key') || 'Class');
  const presets = ['Class', 'Storey', 'Zone', 'FireRating'];

  const recompute = useCallback(
    async (key: string) => {
      const ids = await ifcManager.getAllItemsOfType(modelID, 0, false);
      const elements: ElementInfo[] = [];
      for (const id of ids) {
        const props = await ifcManager.getItemProperties(modelID, id, false);
        elements.push({ id, properties: props as any });
      }
      worker.onmessage = (ev) => setClusters(ev.data as ClusterResult);
      worker.postMessage({ elements, key });
      setCurrentKey(key);
      localStorage.setItem('ifc-cluster-key', key);
    },
    [ifcManager, modelID],
  );

  useEffect(() => {
    recompute(currentKey);
  }, [recompute, currentKey]);

  return { clusters, recompute, presets, currentKey };
}
