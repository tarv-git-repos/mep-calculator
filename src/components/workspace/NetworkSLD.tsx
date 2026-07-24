import React, { useMemo } from 'react';
import { ReactFlow, Controls, Background, MarkerType } from '@xyflow/react';
import '@xyflow/react/dist/style.css';

export function NetworkSLD({ boards, onNodeClick }: { boards: any[], onNodeClick?: (id: string) => void }) {
  const { nodes, edges } = useMemo(() => {
    const newNodes = [];
    const newEdges = [];

    // Improved recursive tree layout
    const nodeSpacingX = 180;
    const nodeSpacingY = 120;
    
    const childrenMap: Record<string, string[]> = {};
    boards.forEach(b => {
      const parentId = b.fedFrom || 'DEWA/GRID';
      if (!childrenMap[parentId]) childrenMap[parentId] = [];
      childrenMap[parentId].push(b.id);
    });
    
    const positions: Record<string, { x: number, y: number }> = {};
    const subtreeWidths: Record<string, number> = {};
    
    const calculateWidth = (id: string): number => {
      const children = childrenMap[id] || [];
      if (children.length === 0) {
        subtreeWidths[id] = nodeSpacingX;
        return nodeSpacingX;
      }
      const width = children.reduce((sum, childId) => sum + calculateWidth(childId), 0);
      subtreeWidths[id] = Math.max(width, nodeSpacingX);
      return subtreeWidths[id];
    };
    
    calculateWidth('DEWA/GRID');
    
    const assignPosition = (id: string, x: number, y: number) => {
      positions[id] = { x, y };
      const children = childrenMap[id] || [];
      if (children.length === 0) return;
      
      const totalWidth = children.reduce((sum, childId) => sum + subtreeWidths[childId], 0);
      let startX = x - totalWidth / 2;
      
      children.forEach(childId => {
        const childWidth = subtreeWidths[childId];
        const childX = startX + childWidth / 2;
        assignPosition(childId, childX, y + nodeSpacingY);
        startX += childWidth;
      });
    };
    
    assignPosition('DEWA/GRID', 400, 50);

    // Normalize X coordinates to prevent negative/cut-off layout
    let minX = Infinity;
    Object.values(positions).forEach(p => {
      if (p.x < minX) minX = p.x;
    });
    if (minX < 50) {
      const shiftX = 50 - minX;
      Object.values(positions).forEach(p => {
        p.x += shiftX;
      });
    }

    // Root node
    newNodes.push({
      id: 'DEWA/GRID',
      position: positions['DEWA/GRID'],
      data: { 
        label: (
          <div className="font-bold text-sm px-4 py-2 border-2 border-emerald-500 rounded bg-emerald-50 text-emerald-800">
            DEWA / GRID
          </div>
        )
      },
      style: { border: 'none', background: 'transparent', cursor: 'default' }
    });

    boards.forEach((board) => {
      newNodes.push({
        id: board.id,
        position: positions[board.id] || { x: 400, y: 50 },
        data: {
          label: (
            <div className="font-bold text-xs p-2 min-w-[120px]">
              <div className="text-[10px] text-slate-500 mb-1">{board.type}</div>
              {board.name}
            </div>
          )
        },
        style: { 
          borderRadius: '8px',
          border: '2px solid #cbd5e1',
          background: 'white',
          boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
          cursor: 'pointer'
        }
      });

      newEdges.push({
        id: `e-${board.fedFrom}-${board.id}`,
        source: board.fedFrom || 'DEWA/GRID',
        target: board.id,
        type: 'default',
        animated: true,
        style: { stroke: '#3b82f6', strokeWidth: 2 },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: '#3b82f6',
        },
      });
    });

    return { nodes: newNodes, edges: newEdges };
  }, [boards]);

  const handleNodeClick = (_, node) => {
    if (node.id !== 'DEWA/GRID' && onNodeClick) {
      onNodeClick(node.id);
    }
  };

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <ReactFlow nodes={nodes} edges={edges} onNodeClick={handleNodeClick} fitView>
        <Background />
        <Controls />
      </ReactFlow>
    </div>
  );
}
