import React, { useEffect, useCallback } from 'react';
import { ReactFlow, Controls, Background, MarkerType, Handle, Position, Connection, useNodesState, useEdgesState } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { toast } from 'sonner';

const getBoardLevel = (type: string) => {
  if (type === 'MDB' || type === 'EMDB') return 1;
  if (type === 'SMDB' || type === 'ESMDB' || type === 'MCC') return 2;
  if (type === 'DB' || type === 'EDB' || type === 'UPS') return 3;
  return 4; 
};

const DewaNode = ({ data }: any) => {
  return (
    <div className="font-bold text-sm px-4 py-2 border-2 border-emerald-500 rounded bg-emerald-50 text-emerald-800">
      DEWA / GRID
      <Handle id="source" type="source" position={Position.Bottom} className="w-4 h-4 bg-emerald-500" />
    </div>
  );
};

const BoardNode = ({ data }: any) => {
  return (
    <div className="bg-white border-2 border-slate-300 rounded-lg shadow-sm hover:border-blue-500 cursor-pointer min-w-[120px] transition-colors relative">
      <Handle id="target" type="target" position={Position.Top} className="w-4 h-4 bg-blue-500" />
      <div className="font-bold text-xs p-2">
        <div className="text-[10px] text-slate-500 mb-1">{data.type}</div>
        {data.name}
      </div>
      <Handle id="source" type="source" position={Position.Bottom} className="w-4 h-4 bg-blue-500" />
    </div>
  );
};

const nodeTypes = {
  dewaNode: DewaNode,
  boardNode: BoardNode,
};

export function NetworkSLD({ boards, onNodeClick, onConnectBoard }: { boards: any[], onNodeClick?: (id: string) => void, onConnectBoard?: (source: string, target: string) => void }) {
  
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  useEffect(() => {
    const newNodes: any[] = [];
    const newEdges: any[] = [];

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

    newNodes.push({
      id: 'DEWA/GRID',
      type: 'dewaNode',
      position: positions['DEWA/GRID'],
      data: {},
      style: { border: 'none', background: 'transparent', cursor: 'default', transition: 'transform 0.5s ease' }
    });

    boards.forEach((board) => {
      newNodes.push({
        id: board.id,
        type: 'boardNode',
        position: positions[board.id] || { x: 400, y: 50 },
        data: {
          name: board.name,
          type: board.type,
        },
        style: { border: 'none', background: 'transparent', transition: 'transform 0.5s ease' } 
      });

      newEdges.push({
        id: `e-${board.fedFrom}-${board.id}`,
        source: board.fedFrom || 'DEWA/GRID',
        sourceHandle: 'source',
        target: board.id,
        targetHandle: 'target',
        type: 'default',
        animated: true,
        style: { stroke: '#3b82f6', strokeWidth: 2 },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: '#3b82f6',
        },
      });
    });

    setNodes(newNodes);
    setEdges(newEdges);
  }, [boards, setNodes, setEdges]);

  const handleNodeClick = useCallback((_, node) => {
    if (node.id !== 'DEWA/GRID' && onNodeClick) {
      onNodeClick(node.id);
    }
  }, [onNodeClick]);

  const onConnect = useCallback((connection: Connection) => {
    if (!onConnectBoard) return;
    
    if (connection.target === 'DEWA/GRID') {
      toast.error("Cannot modify the DEWA/GRID root connection.");
      return;
    }
    
    if (connection.source === connection.target) {
      toast.error("A board cannot be fed from itself.");
      return;
    }
    
    const sourceBoard = boards.find(b => b.id === connection.source);
    const targetBoard = boards.find(b => b.id === connection.target);
    
    if (sourceBoard && targetBoard) {
      if (sourceBoard.type === "DB" || sourceBoard.type === "EDB") {
        toast.error(`Invalid hierarchy: ${sourceBoard.type} is a final distribution board and cannot feed other boards. Change its type to SMDB or MDB first.`);
        return;
      }
      
      const sourceLevel = getBoardLevel(sourceBoard.type);
      const targetLevel = getBoardLevel(targetBoard.type);
      if (sourceLevel > targetLevel) {
        toast.error(`Invalid hierarchy: ${sourceBoard.type} cannot feed ${targetBoard.type}.`);
        return;
      }
    }

    let currentSourceParent = connection.source;
    while (currentSourceParent && currentSourceParent !== 'DEWA/GRID') {
      if (currentSourceParent === connection.target) {
        toast.error("Circular connection detected! A board cannot be fed from its own child.");
        return;
      }
      const pBoard = boards.find(b => b.id === currentSourceParent);
      currentSourceParent = pBoard?.fedFrom || 'DEWA/GRID';
    }

    onConnectBoard(connection.source, connection.target);
    toast.success("Board connection updated successfully!");
  }, [boards, onConnectBoard]);

  const onEdgeUpdate = useCallback((oldEdge: any, newConnection: Connection) => {
    onConnect(newConnection);
  }, [onConnect]);

  const onEdgesDelete = useCallback((deletedEdges: any[]) => {
    if (!onConnectBoard) return;
    deletedEdges.forEach(edge => {
      onConnectBoard('DEWA/GRID', edge.target);
    });
    toast.success("Board connection removed.");
  }, [onConnectBoard]);

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <ReactFlow 
        nodes={nodes} 
        edges={edges} 
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={handleNodeClick}
        onConnect={onConnect}
        onEdgeUpdate={onEdgeUpdate}
        onEdgesDelete={onEdgesDelete}
        nodeTypes={nodeTypes}
        fitView
      >
        <Background />
        <Controls />
      </ReactFlow>
    </div>
  );
}

