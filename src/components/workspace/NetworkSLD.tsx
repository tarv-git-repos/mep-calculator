import React, { useMemo } from 'react';
import { ReactFlow, Controls, Background, MarkerType } from '@xyflow/react';
import '@xyflow/react/dist/style.css';

export function NetworkSLD({ boards, onNodeClick }: { boards: any[], onNodeClick?: (id: string) => void }) {
  const { nodes, edges } = useMemo(() => {
    const newNodes = [];
    const newEdges = [];

    // Root node
    newNodes.push({
      id: 'DEWA/GRID',
      position: { x: 400, y: 50 },
      data: { 
        label: (
          <div className="font-bold text-sm px-4 py-2 border-2 border-emerald-500 rounded bg-emerald-50 text-emerald-800">
            DEWA / GRID
          </div>
        )
      },
      style: { border: 'none', background: 'transparent', cursor: 'default' }
    });

    // We'll calculate a very basic hierarchical layout
    const levels: Record<string, number> = {};
    const getLevel = (id: string): number => {
      if (id === 'DEWA/GRID' || !id) return 0;
      if (levels[id] !== undefined) return levels[id];
      const board = boards.find(b => b.id === id);
      if (!board) return 1;
      const level = getLevel(board.fedFrom) + 1;
      levels[id] = level;
      return level;
    };

    boards.forEach(b => getLevel(b.id));

    // Group by levels to assign X, Y coordinates
    const nodesByLevel: Record<number, any[]> = {};
    boards.forEach(b => {
      const lvl = levels[b.id] || 1;
      if (!nodesByLevel[lvl]) nodesByLevel[lvl] = [];
      nodesByLevel[lvl].push(b);
    });

    Object.keys(nodesByLevel).forEach((lvlStr) => {
      const lvl = parseInt(lvlStr);
      const levelBoards = nodesByLevel[lvl];
      const spacingX = 250;
      const startX = 400 - ((levelBoards.length - 1) * spacingX) / 2;
      const startY = 50 + (lvl * 150);

      levelBoards.forEach((board, index) => {
        newNodes.push({
          id: board.id,
          position: { x: startX + (index * spacingX), y: startY },
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
          type: 'smoothstep',
          animated: true,
          style: { stroke: '#3b82f6', strokeWidth: 2 },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: '#3b82f6',
          },
        });
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
