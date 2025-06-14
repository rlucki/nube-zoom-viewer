
import { useState, useCallback, useRef } from 'react';

interface DragState {
  isDragging: boolean;
  dragType: 'none' | 'transform' | 'section' | 'measurement';
  dragTarget: string | null;
}

export const useDragState = () => {
  const [dragState, setDragState] = useState<DragState>({
    isDragging: false,
    dragType: 'none',
    dragTarget: null
  });

  const dragTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const startDrag = useCallback((type: DragState['dragType'], target?: string) => {
    // Limpiar timeout previo
    if (dragTimeoutRef.current) {
      clearTimeout(dragTimeoutRef.current);
      dragTimeoutRef.current = null;
    }

    console.log(`Starting drag: ${type}${target ? ` - ${target}` : ''}`);
    
    setDragState({
      isDragging: true,
      dragType: type,
      dragTarget: target || null
    });
  }, []);

  const endDrag = useCallback((delay = 50) => {
    // Usar un pequeño delay para evitar conflictos entre múltiples handlers
    if (dragTimeoutRef.current) {
      clearTimeout(dragTimeoutRef.current);
    }

    dragTimeoutRef.current = setTimeout(() => {
      console.log('Ending drag with delay');
      setDragState({
        isDragging: false,
        dragType: 'none',
        dragTarget: null
      });
      dragTimeoutRef.current = null;
    }, delay);
  }, []);

  const cancelDrag = useCallback(() => {
    if (dragTimeoutRef.current) {
      clearTimeout(dragTimeoutRef.current);
      dragTimeoutRef.current = null;
    }

    console.log('Canceling drag immediately');
    setDragState({
      isDragging: false,
      dragType: 'none',
      dragTarget: null
    });
  }, []);

  return {
    dragState,
    startDrag,
    endDrag,
    cancelDrag
  };
};
