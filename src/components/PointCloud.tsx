interface PointCloudProps {
  points: Point[];
  pointSize: number;
  colorMode: 'rgb' | 'intensity' | 'height';
  worldOffset: THREE.Vector3; // ⇦ nuevo
  unitScale?: number;         // ⇦ por si quisieras escalar
}

export const PointCloud: React.FC<PointCloudProps> = ({
  points,
  pointSize,
  colorMode,
  worldOffset,
  unitScale = 1,
}) => {
  /* … */
  const { geometry, material } = useMemo(() => {
    const positions = new Float32Array(points.length * 3);
    const colors    = new Float32Array(points.length * 3);

    /* 1ª pasada (bounds) igual … */

    points.forEach((p, i) => {
      const i3 = i * 3;

      // ⇩ resta offset y aplica escala (metros)
      positions[i3]     = (p.x - worldOffset.x) * unitScale;
      positions[i3 + 1] = (p.y - worldOffset.y) * unitScale;
      positions[i3 + 2] = (p.z - worldOffset.z) * unitScale;

      /* …cálculo de color igual… */
    });

    /* resto sin cambios */
  }, [points, pointSize, colorMode, worldOffset, unitScale]);

  return <points ref={meshRef} geometry={geometry} material={material} />;
};
