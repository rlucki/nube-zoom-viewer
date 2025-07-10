import { groupElements } from '../src/workers/clusterWorker';

describe('groupElements', () => {
  it('clusters by material', () => {
    const elements = [
      { id: 1, properties: { IfcMaterial: 'Steel' } },
      { id: 2, properties: { IfcMaterial: 'Concrete' } },
      { id: 3, properties: { IfcMaterial: 'Steel' } },
    ];
    const result = groupElements(elements, p => p.IfcMaterial);
    expect(result.clusters['Steel']).toEqual([1,3]);
    expect(result.clusters['Concrete']).toEqual([2]);
  });
});
