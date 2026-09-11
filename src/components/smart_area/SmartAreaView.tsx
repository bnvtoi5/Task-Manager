import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  Plus,
  RotateCcw,
  Move,
  Grid,
  Layers,
  LayoutGrid,
  PencilRuler,
  Maximize2,
  Lock,
  Unlock,
  Check,
  SlidersHorizontal,
} from 'lucide-react';
import { Cluster, Task } from '../../types';
import { useApp } from '../../context/AppContext';
import { ClusterColumn } from '../cluster/ClusterColumn';

interface SmartAreaViewProps {
  clusters: Cluster[];
  onAddTask: (clusterId: string) => void;
  onEditTask: (task: Task) => void;
  onDoubleClickTask: (task: Task) => void;
  onMoveSingleTask: (task: Task) => void;
  onEditCluster: (cluster: Cluster) => void;
  onAddCluster: () => void;
}

interface ClusterGeometry {
  x: number;
  y: number;
  width: number;
  height: number;
}

const DEFAULT_WIDTH = 340;
const DEFAULT_HEIGHT = 580;
const MIN_WIDTH = 280;
const MAX_WIDTH = 800;
const MIN_HEIGHT = 380;
const MAX_HEIGHT = 1200;

export const SmartAreaView: React.FC<SmartAreaViewProps> = ({
  clusters,
  onAddTask,
  onEditTask,
  onDoubleClickTask,
  onMoveSingleTask,
  onEditCluster,
  onAddCluster,
}) => {
  const { activeDivision } = useApp();
  const canvasRef = useRef<HTMLDivElement>(null);

  const divisionKey = activeDivision?.id || 'default';
  const modeKey = `wtm_smart_area_mode_${divisionKey}`;
  const layoutKey = `wtm_smart_area_custom_layouts_${divisionKey}`;

  // View Mode: 'auto' (clean automatic multi-column grid) or 'custom' (free-form design canvas)
  const [viewMode, setViewMode] = useState<'auto' | 'custom'>(() => {
    try {
      const saved = localStorage.getItem(modeKey);
      if (saved === 'auto' || saved === 'custom') return saved;
    } catch {
      // fallback
    }
    return 'custom';
  });

  // Design Mode (only applicable in 'custom' view mode)
  // When isDesignMode === false: clusters STAND STILL (đứng yên), no moving, no resizing
  // When isDesignMode === true: drag headers and resize handles appear
  const [isDesignMode, setIsDesignMode] = useState<boolean>(false);

  // Cluster layouts in custom mode { [clusterId]: { x, y, width, height } }
  const [layouts, setLayouts] = useState<Record<string, ClusterGeometry>>(() => {
    try {
      const saved = localStorage.getItem(layoutKey);
      if (saved) return JSON.parse(saved);
    } catch {
      // fallback
    }
    return {};
  });

  // Refs for tracking active drag and resize operations
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [activeResizeId, setActiveResizeId] = useState<string | null>(null);

  const dragRef = useRef<{
    clusterId: string;
    startX: number;
    startY: number;
    initialX: number;
    initialY: number;
  } | null>(null);

  const resizeRef = useRef<{
    clusterId: string;
    type: 'width' | 'height' | 'both';
    startX: number;
    startY: number;
    startW: number;
    startH: number;
  } | null>(null);

  // Initialize or re-align default layout for any cluster missing geometry
  useEffect(() => {
    setLayouts((prev) => {
      const next = { ...prev };
      let changed = false;

      clusters.forEach((cluster, index) => {
        if (!next[cluster.id]) {
          const col = index % 3;
          const row = Math.floor(index / 3);
          next[cluster.id] = {
            x: 28 + col * (DEFAULT_WIDTH + 28),
            y: 28 + row * (DEFAULT_HEIGHT + 28),
            width: DEFAULT_WIDTH,
            height: DEFAULT_HEIGHT,
          };
          changed = true;
        }
      });

      if (changed) {
        localStorage.setItem(layoutKey, JSON.stringify(next));
      }
      return next;
    });
  }, [clusters, layoutKey]);

  // Persist view mode changes
  const handleModeChange = (mode: 'auto' | 'custom') => {
    setViewMode(mode);
    if (mode === 'auto') {
      setIsDesignMode(false);
    }
    localStorage.setItem(modeKey, mode);
  };

  // Helper to save layouts
  const saveLayouts = (newLayouts: Record<string, ClusterGeometry>) => {
    setLayouts(newLayouts);
    localStorage.setItem(layoutKey, JSON.stringify(newLayouts));
  };

  // Auto-tile / Arrange clusters neatly on the custom canvas
  const handleAutoArrange = () => {
    const next: Record<string, ClusterGeometry> = {};
    clusters.forEach((cluster, index) => {
      const col = index % 3;
      const row = Math.floor(index / 3);
      const current = layouts[cluster.id];
      const w = current?.width || DEFAULT_WIDTH;
      const h = current?.height || DEFAULT_HEIGHT;
      next[cluster.id] = {
        x: 28 + col * (w + 24),
        y: 28 + row * (h + 24),
        width: w,
        height: h,
      };
    });
    saveLayouts(next);
  };

  // Snap to 20px grid
  const handleSnapToGrid = () => {
    const next: Record<string, ClusterGeometry> = {};
    clusters.forEach((cluster) => {
      const cur = layouts[cluster.id] || {
        x: 28,
        y: 28,
        width: DEFAULT_WIDTH,
        height: DEFAULT_HEIGHT,
      };
      next[cluster.id] = {
        x: Math.round(cur.x / 20) * 20,
        y: Math.round(cur.y / 20) * 20,
        width: Math.round(cur.width / 20) * 20,
        height: Math.round(cur.height / 20) * 20,
      };
    });
    saveLayouts(next);
  };

  // Reset all clusters to standard sizes and staggered positions
  const handleResetDefaults = () => {
    const next: Record<string, ClusterGeometry> = {};
    clusters.forEach((cluster, index) => {
      const col = index % 3;
      const row = Math.floor(index / 3);
      next[cluster.id] = {
        x: 28 + col * (DEFAULT_WIDTH + 24),
        y: 28 + row * (DEFAULT_HEIGHT + 24),
        width: DEFAULT_WIDTH,
        height: DEFAULT_HEIGHT,
      };
    });
    saveLayouts(next);
  };

  // Drag start handler (moving cluster position)
  const handleStartDrag = (clusterId: string, e: React.MouseEvent) => {
    if (!isDesignMode) return;
    e.stopPropagation();

    const currentGeo = layouts[clusterId] || {
      x: 28,
      y: 28,
      width: DEFAULT_WIDTH,
      height: DEFAULT_HEIGHT,
    };

    dragRef.current = {
      clusterId,
      startX: e.clientX,
      startY: e.clientY,
      initialX: currentGeo.x,
      initialY: currentGeo.y,
    };
    setActiveDragId(clusterId);
  };

  // Resize start handler (resizing cluster dimensions)
  const handleStartResize = (
    clusterId: string,
    type: 'width' | 'height' | 'both',
    e: React.MouseEvent
  ) => {
    if (!isDesignMode) return;
    e.stopPropagation();
    e.preventDefault();

    const currentGeo = layouts[clusterId] || {
      x: 28,
      y: 28,
      width: DEFAULT_WIDTH,
      height: DEFAULT_HEIGHT,
    };

    resizeRef.current = {
      clusterId,
      type,
      startX: e.clientX,
      startY: e.clientY,
      startW: currentGeo.width,
      startH: currentGeo.height,
    };
    setActiveResizeId(clusterId);
  };

  // Global mousemove and mouseup listeners for dragging and resizing
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      // 1. Moving cluster
      if (dragRef.current) {
        const { clusterId, startX, startY, initialX, initialY } = dragRef.current;
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;

        const newX = Math.max(12, initialX + dx);
        const newY = Math.max(12, initialY + dy);

        setLayouts((prev) => {
          const cur = prev[clusterId] || {
            x: 28,
            y: 28,
            width: DEFAULT_WIDTH,
            height: DEFAULT_HEIGHT,
          };
          return {
            ...prev,
            [clusterId]: {
              ...cur,
              x: newX,
              y: newY,
            },
          };
        });
      }

      // 2. Resizing cluster
      if (resizeRef.current) {
        const { clusterId, type, startX, startY, startW, startH } = resizeRef.current;
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;

        setLayouts((prev) => {
          const cur = prev[clusterId] || {
            x: 28,
            y: 28,
            width: DEFAULT_WIDTH,
            height: DEFAULT_HEIGHT,
          };

          let newW = cur.width;
          let newH = cur.height;

          if (type === 'width' || type === 'both') {
            newW = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, startW + dx));
          }
          if (type === 'height' || type === 'both') {
            newH = Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, startH + dy));
          }

          return {
            ...prev,
            [clusterId]: {
              ...cur,
              width: newW,
              height: newH,
            },
          };
        });
      }
    };

    const handleMouseUp = () => {
      if (dragRef.current || resizeRef.current) {
        dragRef.current = null;
        resizeRef.current = null;
        setActiveDragId(null);
        setActiveResizeId(null);

        // Commit current layouts state to localStorage
        setLayouts((latest) => {
          localStorage.setItem(layoutKey, JSON.stringify(latest));
          return latest;
        });
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [layoutKey]);

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-50/50 dark:bg-[#070b14]/50">
      {/* Smart Area Top Toolbar */}
      <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-slate-200/90 dark:border-slate-800 bg-white/90 dark:bg-[#0b1220]/90 backdrop-blur-md z-20 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-indigo-500/10 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Smart Area</h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-300 border border-indigo-200/70 dark:border-indigo-800/70">
                  {clusters.length} cụm
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 hidden sm:block">
                Không gian làm việc linh hoạt với chế độ Tự động & Tùy biến kích thước
              </p>
            </div>
          </div>

          {/* Mode Switcher: Tự động (Auto) vs Tùy biến (Custom) */}
          <div className="flex items-center p-0.5 bg-slate-100 dark:bg-slate-800/80 rounded-xl border border-slate-200/70 dark:border-slate-700/70 ml-2">
            <button
              type="button"
              onClick={() => handleModeChange('auto')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition ${
                viewMode === 'auto'
                  ? 'bg-white dark:bg-[#131b2e] text-indigo-600 dark:text-indigo-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Tự động</span>
            </button>

            <button
              type="button"
              onClick={() => handleModeChange('custom')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition ${
                viewMode === 'custom'
                  ? 'bg-white dark:bg-[#131b2e] text-indigo-600 dark:text-indigo-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <PencilRuler className="w-3.5 h-3.5" />
              <span>Tùy biến</span>
            </button>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {/* If in Custom mode, show Design Mode button and alignment tools */}
          {viewMode === 'custom' && (
            <>
              {/* Design Mode Toggle Button */}
              <button
                type="button"
                onClick={() => setIsDesignMode((prev) => !prev)}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition shadow-xs ${
                  isDesignMode
                    ? 'bg-amber-500 hover:bg-amber-600 text-white ring-2 ring-amber-400/40 animate-pulse'
                    : 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 border border-indigo-200 dark:border-indigo-800'
                }`}
                title={
                  isDesignMode
                    ? 'Bấm để tắt chế độ thiết kế và cố định vị trí cụm'
                    : 'Bật chế độ thiết kế để kéo thả vị trí và thay đổi kích thước cụm'
                }
              >
                {isDesignMode ? (
                  <>
                    <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                    <span>Hoàn tất thiết kế</span>
                  </>
                ) : (
                  <>
                    <PencilRuler className="w-3.5 h-3.5" />
                    <span>Chế độ thiết kế</span>
                  </>
                )}
              </button>

              {/* Auxiliary tools in Custom mode */}
              {isDesignMode && (
                <>
                  <button
                    type="button"
                    onClick={handleSnapToGrid}
                    className="hidden md:inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl border border-slate-200/80 dark:border-slate-700 transition shadow-xs"
                    title="Căn chỉnh các cụm theo lưới 20px"
                  >
                    <Grid className="w-3.5 h-3.5 text-indigo-500" />
                    <span>Căn lưới</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleAutoArrange}
                    className="hidden md:inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl border border-slate-200/80 dark:border-slate-700 transition shadow-xs"
                    title="Tự động sắp xếp các cụm vào canvas"
                  >
                    <SlidersHorizontal className="w-3.5 h-3.5 text-indigo-500" />
                    <span>Sắp xếp</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleResetDefaults}
                    className="inline-flex items-center gap-1 p-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition"
                    title="Đặt lại kích thước chuẩn (340×580)"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                </>
              )}
            </>
          )}
        </div>
      </div>

      {/* Info Banner when Design Mode is active */}
      {viewMode === 'custom' && isDesignMode && (
        <div className="px-5 py-2 bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200/80 dark:border-amber-800/80 text-amber-900 dark:text-amber-200 text-xs flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping shrink-0" />
            <span className="font-medium">
              Đang bật <strong>Chế độ thiết kế</strong>: Kéo thanh màu trên đầu cụm để di chuyển vị trí, kéo cạnh hoặc góc dưới bên phải để co giãn kích thước (task tự co dãn theo cụm).
            </span>
          </div>
          <button
            type="button"
            onClick={() => setIsDesignMode(false)}
            className="font-bold text-amber-700 dark:text-amber-300 underline hover:no-underline shrink-0"
          >
            Khóa vị trí & Thoát
          </button>
        </div>
      )}

      {/* Empty State */}
      {clusters.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
          <div className="w-16 h-16 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center text-indigo-600 dark:text-indigo-400 mb-3">
            <Layers className="w-8 h-8" />
          </div>
          <h4 className="text-base font-bold text-slate-900 dark:text-slate-100">
            Chưa có Cụm nào trong Smart Area
          </h4>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm">
            Tạo cụm công việc đầu tiên để tận hưởng khả năng sắp xếp tự động hoặc tự do kéo thả, đổi kích thước.
          </p>
          <button
            type="button"
            onClick={onAddCluster}
            className="mt-4 px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition shadow-xs inline-flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Tạo Cụm mới</span>
          </button>
        </div>
      ) : viewMode === 'auto' ? (
        /* MODE 1: AUTO LAYOUT (Clean responsive multi-column grid, clusters & tasks stretch to fit) */
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50/70 dark:bg-[#070b14]/70">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6 max-w-[2400px] mx-auto">
            {clusters.map((cluster) => (
              <div
                key={cluster.id}
                className="h-[640px] flex flex-col rounded-2xl shadow-sm border border-slate-200/90 dark:border-slate-800 overflow-hidden bg-white/70 dark:bg-[#0e1626]/70 transition-all hover:shadow-md"
              >
                <ClusterColumn
                  cluster={cluster}
                  onAddTask={onAddTask}
                  onEditTask={onEditTask}
                  onDoubleClickTask={onDoubleClickTask}
                  onMoveSingleTask={onMoveSingleTask}
                  onEditCluster={onEditCluster}
                  className="w-full h-full"
                />
              </div>
            ))}
          </div>
        </div>
      ) : (
        /* MODE 2: CUSTOM LAYOUT (Free-form canvas with cluster dragging, resizing, and task flex) */
        <div
          ref={canvasRef}
          className={`flex-1 overflow-auto p-6 relative min-h-[700px] transition-colors ${
            isDesignMode
              ? 'bg-slate-100/80 dark:bg-[#090f1d]'
              : 'bg-slate-50/50 dark:bg-[#070b14]'
          }`}
          style={{
            backgroundImage:
              'radial-gradient(circle, rgba(148, 163, 184, 0.25) 1px, transparent 1px)',
            backgroundSize: '24px 24px',
          }}
        >
          {/* Canvas bounds wrapper */}
          <div className="relative min-w-[2800px] min-h-[2000px]">
            {clusters.map((cluster) => {
              const geo = layouts[cluster.id] || {
                x: 28,
                y: 28,
                width: DEFAULT_WIDTH,
                height: DEFAULT_HEIGHT,
              };
              const isDragging = activeDragId === cluster.id;
              const isResizing = activeResizeId === cluster.id;

              return (
                <div
                  key={cluster.id}
                  style={{
                    position: 'absolute',
                    left: `${geo.x}px`,
                    top: `${geo.y}px`,
                    width: `${geo.width}px`,
                    height: `${geo.height}px`,
                    zIndex: isDragging ? 50 : isResizing ? 45 : 10,
                  }}
                  className={`rounded-2xl flex flex-col transition-shadow duration-150 ${
                    isDesignMode
                      ? 'ring-2 ring-indigo-500/50 shadow-xl border border-indigo-400 dark:border-indigo-600'
                      : 'shadow-md border border-slate-200/90 dark:border-slate-800'
                  } ${isDragging ? 'opacity-95 scale-[1.01]' : ''}`}
                >
                  {/* Top Drag Handle Bar (ONLY VISIBLE & ACTIVE IN DESIGN MODE) */}
                  {isDesignMode ? (
                    <div
                      onMouseDown={(e) => handleStartDrag(cluster.id, e)}
                      className="flex items-center justify-between px-3 py-1.5 bg-indigo-600 text-white rounded-t-2xl text-[11px] font-bold cursor-grab active:cursor-grabbing select-none shrink-0 shadow-xs"
                      title="Giữ chuột và kéo để di chuyển cụm này"
                    >
                      <span className="flex items-center gap-1.5">
                        <Move className="w-3.5 h-3.5 text-indigo-200" />
                        <span>Kéo di chuyển cụm</span>
                      </span>
                      <span className="text-[10px] font-mono text-indigo-100/90">
                        {Math.round(geo.x)}, {Math.round(geo.y)} • {Math.round(geo.width)}×{Math.round(geo.height)}px
                      </span>
                    </div>
                  ) : null}

                  {/* Cluster Column Body (Takes full width and flex-1 so tasks stretch cleanly) */}
                  <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
                    <ClusterColumn
                      cluster={cluster}
                      onAddTask={onAddTask}
                      onEditTask={onEditTask}
                      onDoubleClickTask={onDoubleClickTask}
                      onMoveSingleTask={onMoveSingleTask}
                      onEditCluster={onEditCluster}
                      className="w-full h-full"
                    />
                  </div>

                  {/* Resize Handles (ONLY VISIBLE & ACTIVE IN DESIGN MODE) */}
                  {isDesignMode && (
                    <>
                      {/* Right edge width resize handle */}
                      <div
                        onMouseDown={(e) => handleStartResize(cluster.id, 'width', e)}
                        className="absolute top-8 right-0 bottom-6 w-2.5 cursor-ew-resize hover:bg-indigo-500/40 transition rounded-r-md z-30"
                        title="Kéo sang trái/phải để đổi chiều rộng"
                      />

                      {/* Bottom edge height resize handle */}
                      <div
                        onMouseDown={(e) => handleStartResize(cluster.id, 'height', e)}
                        className="absolute left-6 bottom-0 right-6 h-2.5 cursor-ns-resize hover:bg-indigo-500/40 transition rounded-b-md z-30"
                        title="Kéo lên/xuống để đổi chiều cao"
                      />

                      {/* Bottom-right corner width & height handle */}
                      <div
                        onMouseDown={(e) => handleStartResize(cluster.id, 'both', e)}
                        className="absolute bottom-0 right-0 w-6 h-6 cursor-nwse-resize bg-indigo-600 hover:bg-indigo-700 text-white rounded-br-2xl rounded-tl-xl flex items-center justify-center z-40 shadow-sm transition group"
                        title="Kéo góc này để thay đổi cả chiều Rộng và Cao"
                      >
                        <Maximize2 className="w-3.5 h-3.5 rotate-90 opacity-90 group-hover:scale-110 transition-transform" />
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
