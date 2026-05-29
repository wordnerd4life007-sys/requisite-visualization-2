import { GitBranch, Maximize2, Minimize2, Minus, Network, Plus, RotateCcw, Scan } from 'lucide-react';
import type { GraphDirection, GraphLayoutMode } from '../types';

interface ExplorerControlsProps {
  depth: number;
  direction: GraphDirection;
  graphNodeCount: number;
  graphEdgeCount: number;
  layoutMode: GraphLayoutMode;
  isFullscreen: boolean;
  onLayoutModeChange: (layoutMode: GraphLayoutMode) => void;
  onDirectionChange: (direction: GraphDirection) => void;
  onDepthChange: (depth: number) => void;
  onFit: () => void;
  onReset: () => void;
  onToggleFullscreen: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
}

const directions: Array<{ value: GraphDirection; label: string }> = [
  { value: 'prerequisites', label: 'Prereqs' },
  { value: 'both', label: 'Both' },
  { value: 'dependents', label: 'Dependents' },
];

function ExplorerControls({
  depth,
  direction,
  graphNodeCount,
  graphEdgeCount,
  layoutMode,
  isFullscreen,
  onLayoutModeChange,
  onDirectionChange,
  onDepthChange,
  onFit,
  onReset,
  onToggleFullscreen,
  onZoomIn,
  onZoomOut,
}: ExplorerControlsProps) {
  return (
    <div className="graph-controls">
      <div className="control-cluster">
        <span className="control-label">Direction</span>
        <div className="segmented-control" role="group" aria-label="Graph direction">
          {directions.map((option) => (
            <button
              className={option.value === direction ? 'is-active' : ''}
              key={option.value}
              type="button"
              onClick={() => onDirectionChange(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="control-cluster">
        <span className="control-label">Depth</span>
        <div className="stepper" role="group" aria-label="Graph depth">
          <button
            aria-label="Decrease depth"
            disabled={depth <= 1}
            title="Decrease depth"
            type="button"
            onClick={() => onDepthChange(Math.max(1, depth - 1))}
          >
            <Minus aria-hidden="true" size={16} />
          </button>
          <span>{depth}</span>
          <button
            aria-label="Increase depth"
            disabled={depth >= 6}
            title="Increase depth"
            type="button"
            onClick={() => onDepthChange(Math.min(6, depth + 1))}
          >
            <Plus aria-hidden="true" size={16} />
          </button>
        </div>
      </div>

      <div className="control-cluster">
        <span className="control-label">Layout</span>
        <div className="segmented-control layout-mode-control" role="group" aria-label="Graph layout">
          <button
            aria-pressed={layoutMode === 'structured'}
            className={layoutMode === 'structured' ? 'is-active' : ''}
            title="Structured layout"
            type="button"
            onClick={() => onLayoutModeChange('structured')}
          >
            <GitBranch aria-hidden="true" size={15} />
            <span>Structured</span>
          </button>
          <button
            aria-pressed={layoutMode === 'organic'}
            className={layoutMode === 'organic' ? 'is-active' : ''}
            title="Organic layout"
            type="button"
            onClick={() => onLayoutModeChange('organic')}
          >
            <Network aria-hidden="true" size={15} />
            <span>Organic</span>
          </button>
        </div>
      </div>

      <div className="control-cluster">
        <span className="control-label">View</span>
        <div className="icon-toolbar" role="group" aria-label="Graph viewport controls">
          <button className="icon-command" type="button" onClick={onZoomOut} title="Zoom out" aria-label="Zoom out">
            <Minus aria-hidden="true" size={16} />
          </button>
          <button className="icon-command" type="button" onClick={onZoomIn} title="Zoom in" aria-label="Zoom in">
            <Plus aria-hidden="true" size={16} />
          </button>
          <button className="icon-command" type="button" onClick={onFit} title="Fit graph" aria-label="Fit graph">
            <Scan aria-hidden="true" size={16} />
          </button>
          <button className="icon-command" type="button" onClick={onReset} title="Reset graph" aria-label="Reset graph">
            <RotateCcw aria-hidden="true" size={16} />
          </button>
          <button
            aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
            className="icon-command"
            title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
            type="button"
            onClick={onToggleFullscreen}
          >
            {isFullscreen ? <Minimize2 aria-hidden="true" size={16} /> : <Maximize2 aria-hidden="true" size={16} />}
          </button>
        </div>
      </div>

      <div className="graph-metrics" aria-label="Visible graph size">
        <span>{graphNodeCount} nodes</span>
        <span>{graphEdgeCount} edges</span>
      </div>
    </div>
  );
}

export default ExplorerControls;
