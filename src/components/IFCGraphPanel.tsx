/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { Card } from '@/components/ui/card';

interface IFCGraphPanelProps {
  ifcManager: any;
  modelID: number;
  clusters?: { colors: Record<string, string> } | null;
  onClose: () => void;
  layout?: 'radial' | 'force3d';
}

export const IFCGraphPanel: React.FC<IFCGraphPanelProps> = ({ ifcManager, modelID, clusters, onClose, layout = 'radial' }) => {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    let cancelled = false;
    const render = async () => {
      const spatial = await ifcManager.getSpatialStructure(modelID);
      if (cancelled || !svgRef.current) return;

      const root = d3.hierarchy(spatial as any);
      const treeLayout = d3.tree<any>().size([360, 360]);
      const treeData = treeLayout(root);
      const nodes = treeData.descendants();
      const links = treeData.links();

      const svg = d3.select(svgRef.current);
      svg.selectAll('*').remove();
      svg.attr('width', 380).attr('height', 380);

      const g = svg.append('g').attr('transform', 'translate(10,10)');

      g.selectAll('line')
        .data(links)
        .enter()
        .append('line')
        .attr('x1', d => (d.source as any).x)
        .attr('y1', d => (d.source as any).y)
        .attr('x2', d => (d.target as any).x)
        .attr('y2', d => (d.target as any).y)
        .attr('stroke', '#888');

      g.selectAll('circle')
        .data(nodes)
        .enter()
        .append('circle')
        .attr('cx', d => (d as any).x)
        .attr('cy', d => (d as any).y)
        .attr('r', 3)
        .attr('fill', d => {
          if (!clusters) return '#4ade80';
          const color = clusters.colors[d.data.expressID];
          return color ?? '#4ade80';
        });
    };
    render();
    return () => { cancelled = true; };
  }, [ifcManager, modelID, clusters]);

  return (
    <Card className="absolute top-32 right-4 z-10 p-4 bg-black/80 backdrop-blur-sm border-gray-700 text-white">
      <div className="flex justify-between items-center mb-2">
        <div className="font-semibold">Grafo IFC</div>
        <button onClick={onClose} className="text-gray-400">×</button>
      </div>
      <svg ref={svgRef} />
    </Card>
  );
};

export default IFCGraphPanel;
