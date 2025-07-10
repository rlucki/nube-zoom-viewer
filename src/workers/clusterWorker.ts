export interface ClusterResult {
  clusters: Record<string, number[]>;
  colors: Record<string, string>;
}

export interface ElementInfo {
  id: number;
  properties: Record<string, any>;
}

export function groupElements(
  elements: ElementInfo[],
  keySelector: (props: Record<string, any>) => string,
): ClusterResult {
  const clusters: Record<string, number[]> = {};
  for (const el of elements) {
    const key = keySelector(el.properties) ?? 'unknown';
    if (!clusters[key]) clusters[key] = [];
    clusters[key].push(el.id);
  }

  const keys = Object.keys(clusters);
  const colors: Record<string, string> = {};
  keys.forEach((k, i) => {
    const hue = (i * 137.508) % 360;
    colors[k] = `hsl(${hue},70%,50%)`;
  });

  return { clusters, colors };
}

if (typeof self !== 'undefined') {
  self.onmessage = (ev) => {
    const { elements, key } = ev.data as { elements: ElementInfo[]; key: string };
    const result = groupElements(elements, (props) => props[key]);
    postMessage(result);
  };
}
