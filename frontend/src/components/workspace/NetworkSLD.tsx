import React, { useEffect, useCallback, useState } from 'react';
import { createPortal } from 'react-dom';
import { 
  ReactFlow, 
  Controls, 
  Background, 
  MarkerType, 
  Handle, 
  Position, 
  Connection, 
  useNodesState, 
  useEdgesState, 
  Panel,
  ReactFlowProvider,
  useReactFlow
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Table as TableIcon, Network, Zap, Check, X, ShieldCheck, Move } from 'lucide-react';
import { createDefaultBoard, Board } from '@/store/electrical-network';

const getBoardLevel = (type: string) => {
  if (type === 'MDB' || type === 'EMDB' || type === 'LV-PANEL') return 1;
  if (type === 'SMDB' || type === 'ESMDB' || type === 'MCC') return 2;
  if (type === 'DB' || type === 'EDB' || type === 'UPS') return 3;
  return 4; 
};

const DewaNode = () => {
  return (
    <div className="font-bold text-sm px-5 py-2.5 border-2 border-emerald-500 rounded-xl bg-emerald-50 text-emerald-800 shadow-md flex items-center gap-2">
      <Zap className="size-4 text-emerald-600 fill-emerald-600" />
      <span>DEWA / GRID</span>
      <Handle id="source" type="source" position={Position.Bottom} className="w-4 h-4 !bg-emerald-500 !border-2 !border-white" />
    </div>
  );
};

const BoardNode = ({ data }: any) => {
  const { board, onEdit, onViewTable, onDelete } = data;
  const boardType = board?.type || "DB";
  
  // Calculate total load
  let totalW = 0;
  if (board?.circuits) {
    board.circuits.forEach((c: any) => {
      if (c.loadW !== undefined) {
        totalW += (Number(c.loadW) || 0) * (c.df !== undefined ? Number(c.df) : 1);
      } else {
        let circuitW = Number(c.customW) || 0;
        if (c.points) {
          Object.keys(c.points).forEach(pid => {
            circuitW += (c.points[pid] || 0) * 100;
          });
        }
        totalW += circuitW * (c.df !== undefined ? Number(c.df) : 1);
      }
    });
  }

  const getTypeBadgeClass = (t: string) => {
    if (t === "MDB" || t === "EMDB" || t === "LV-PANEL") return "bg-blue-100 text-blue-800 border-blue-300";
    if (t === "SMDB" || t === "ESMDB") return "bg-emerald-100 text-emerald-800 border-emerald-300";
    if (t === "BUSBAR") return "bg-purple-100 text-purple-800 border-purple-300";
    return "bg-amber-100 text-amber-800 border-amber-300";
  };

  return (
    <div className="bg-white border-2 border-slate-300 rounded-xl shadow-md hover:border-blue-500 hover:shadow-xl min-w-[170px] p-3 transition-all relative group nopan nodrag">
      <Handle 
        id="target" 
        type="target" 
        position={Position.Top} 
        className="w-4 h-4 !bg-blue-500 !border-2 !border-white hover:scale-125 transition-transform" 
        title="Target: Drop connection wire here to connect parent feeder"
      />
      
      <div className="flex items-center justify-between gap-2 mb-2 border-b border-slate-100 pb-1.5">
        <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded border uppercase ${getTypeBadgeClass(boardType)}`}>
          {boardType}
        </span>
        <div className="flex items-center gap-1">
          <button onClick={(e) => { e.stopPropagation(); onEdit?.(); }} title="Edit Board Specs" className="p-1 hover:bg-blue-50 rounded text-slate-400 hover:text-blue-600 transition-colors cursor-pointer">
            <Pencil className="size-3.5" />
          </button>
          <button onClick={(e) => { e.stopPropagation(); onViewTable?.(); }} title="Open Table View" className="p-1 hover:bg-emerald-50 rounded text-slate-400 hover:text-emerald-600 transition-colors cursor-pointer">
            <TableIcon className="size-3.5" />
          </button>
          <button onClick={(e) => { e.stopPropagation(); onDelete?.(); }} title="Delete Board" className="p-1 hover:bg-red-50 rounded text-slate-400 hover:text-red-600 transition-colors cursor-pointer">
            <Trash2 className="size-3.5" />
          </button>
        </div>
      </div>

      <div className="font-bold text-sm text-slate-800 mb-1 cursor-pointer hover:text-blue-600 flex items-center justify-between gap-1" onClick={(e) => { e.stopPropagation(); onViewTable?.(); }}>
        <span>{board?.name}</span>
        <Move className="size-3 text-slate-300 group-hover:text-slate-400" title="Drag node onto another board to connect" />
      </div>

      <div className="text-[11px] text-slate-500 flex items-center justify-between gap-2 mt-1">
        <span className="font-medium">{board?.incomer?.rating || "100A"} • {board?.phaseType || "3-Phase"}</span>
        {totalW > 0 && (
          <span className="font-bold text-blue-600">{(totalW / 1000).toFixed(1)} kW</span>
        )}
      </div>

      <Handle 
        id="source" 
        type="source" 
        position={Position.Bottom} 
        className="w-4 h-4 !bg-blue-500 !border-2 !border-white hover:scale-125 transition-transform" 
        title="Source: Drag wire from here to connect to child board"
      />
    </div>
  );
};

const nodeTypes = {
  dewaNode: DewaNode,
  boardNode: BoardNode,
};

function NetworkSLDContent({ 
  boards, 
  onNodeClick, 
  onConnectBoard,
  onAddBoard,
  onUpdateBoard,
  onDeleteBoard
}: { 
  boards: any[], 
  onNodeClick?: (id: string) => void, 
  onConnectBoard?: (source: string, target: string) => void,
  onAddBoard?: (board: Board) => void,
  onUpdateBoard?: (id: string, updates: Partial<Board>) => void,
  onDeleteBoard?: (id: string) => void
}) {
  const { screenToFlowPosition } = useReactFlow();

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  // Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingBoard, setEditingBoard] = useState<any | null>(null);

  // Add Form State
  const [newBoardName, setNewBoardName] = useState('');
  const [newBoardType, setNewBoardType] = useState<'MDB' | 'SMDB' | 'DB' | 'LV-PANEL' | 'BUSBAR' | 'EDB'>('DB');
  const [newPhaseType, setNewPhaseType] = useState('3-Phase');
  const [newFedFrom, setNewFedFrom] = useState('DEWA/GRID');
  const [newRating, setNewRating] = useState('100A');

  // Edit Form State
  const [editName, setEditName] = useState('');
  const [editType, setEditType] = useState('');
  const [editPhaseType, setEditPhaseType] = useState('');
  const [editFedFrom, setEditFedFrom] = useState('');
  const [editRating, setEditRating] = useState('');

  useEffect(() => {
    if (editingBoard) {
      setEditName(editingBoard.name || '');
      setEditType(editingBoard.type || 'DB');
      setEditPhaseType(editingBoard.phaseType || '3-Phase');
      setEditFedFrom(editingBoard.fedFrom || 'DEWA/GRID');
      setEditRating(editingBoard.incomer?.rating || '100A');
    }
  }, [editingBoard]);

  useEffect(() => {
    const newNodes: any[] = [];
    const newEdges: any[] = [];

    const nodeSpacingX = 220;
    const nodeSpacingY = 140;
    
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
    
    assignPosition('DEWA/GRID', 450, 60);

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
        position: positions[board.id] || { x: 450, y: 60 },
        data: {
          board,
          onEdit: () => setEditingBoard(board),
          onViewTable: () => onNodeClick && onNodeClick(board.id),
          onDelete: () => onDeleteBoard && onDeleteBoard(board.id),
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
        style: { stroke: '#3b82f6', strokeWidth: 2.5 },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: '#3b82f6',
        },
      });
    });

    setNodes(newNodes);
    setEdges(newEdges);
  }, [boards, setNodes, setEdges, onNodeClick, onDeleteBoard]);

  const handleNodeClick = useCallback((_, node) => {
    if (node.id !== 'DEWA/GRID' && onNodeClick) {
      onNodeClick(node.id);
    }
  }, [onNodeClick]);

  const onConnect = useCallback((connection: Connection) => {
    if (!onConnectBoard) return;
    
    if (connection.target === 'DEWA/GRID') {
      toast.error("DEWA / IEC Rule: DEWA/GRID is the primary utility power source and cannot be fed by another board.");
      return;
    }
    
    if (connection.source === connection.target) {
      toast.error("Standard Rule: A board cannot be fed from itself.");
      return;
    }
    
    const sourceBoard = boards.find(b => b.id === connection.source);
    const targetBoard = boards.find(b => b.id === connection.target);
    
    if (sourceBoard && targetBoard) {
      const sType = sourceBoard.type;
      const tType = targetBoard.type;

      // Final DB / EDB cannot feed upstream MDB, SMDB, or LV Panel
      if ((sType === 'DB' || sType === 'EDB') && (tType === 'MDB' || tType === 'LV-PANEL' || tType === 'EMDB' || tType === 'SMDB' || tType === 'ESMDB')) {
        toast.error(`DEWA / IEC 60364 Rule: Final Distribution Board (${sType}) cannot feed upstream Main/Sub-Main Board (${tType}). MDBs & SMDBs must be fed from DEWA/GRID, LV Panel, or MDB.`);
        return;
      }
      
      // SMDB cannot feed MDB or LV Panel
      if ((sType === 'SMDB' || sType === 'ESMDB') && (tType === 'MDB' || tType === 'LV-PANEL' || tType === 'EMDB')) {
        toast.error(`DEWA / IEC 60364 Rule: Sub-Main DB (${sType}) cannot feed upstream Main Board (${tType}). Main boards must be fed from DEWA/GRID or LV Panel.`);
        return;
      }
    }

    let currentSourceParent = connection.source;
    while (currentSourceParent && currentSourceParent !== 'DEWA/GRID') {
      if (currentSourceParent === connection.target) {
        toast.error(`Electrical Loop Error: ${targetBoard ? targetBoard.name : connection.target} is already upstream. Connecting it creates a circular electrical loop!`);
        return;
      }
      const pBoard = boards.find(b => b.id === currentSourceParent);
      currentSourceParent = pBoard?.fedFrom || 'DEWA/GRID';
    }

    onConnectBoard(connection.source, connection.target);
    toast.success(`Connected ${sourceBoard ? sourceBoard.name : 'DEWA/GRID'} → ${targetBoard ? targetBoard.name : ''} per DEWA / IEC Standards!`);
  }, [boards, onConnectBoard]);

  const onEdgeUpdate = useCallback((oldEdge: any, newConnection: Connection) => {
    onConnect(newConnection);
  }, [onConnect]);

  const onEdgesDelete = useCallback((deletedEdges: any[]) => {
    if (!onConnectBoard) return;
    deletedEdges.forEach(edge => {
      onConnectBoard('DEWA/GRID', edge.target);
    });
    toast.success("Board connection removed and reset to DEWA/GRID.");
  }, [onConnectBoard]);

  // Drag & Drop Board Palette Handler
  const onDragStartPalette = (event: React.DragEvent, boardType: string) => {
    event.dataTransfer.setData('application/reactflow', boardType);
    event.dataTransfer.effectAllowed = 'move';
  };

  const onDragOverCanvas = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDropCanvas = useCallback((event: React.DragEvent) => {
    event.preventDefault();

    const type = event.dataTransfer.getData('application/reactflow');
    if (!type || !onAddBoard) return;

    const countOfType = boards.filter(b => b.type === type).length + 1;
    const name = `${type}-${countOfType < 10 ? '0' + countOfType : countOfType}`;

    let defaultParent = 'DEWA/GRID';
    if (type === 'DB' || type === 'EDB') {
      const smdb = boards.find(b => b.type === 'SMDB' || b.type === 'ESMDB');
      const mdb = boards.find(b => b.type === 'MDB' || b.type === 'LV-PANEL');
      if (smdb) defaultParent = smdb.id;
      else if (mdb) defaultParent = mdb.id;
    } else if (type === 'SMDB' || type === 'ESMDB') {
      const mdb = boards.find(b => b.type === 'MDB' || b.type === 'LV-PANEL');
      if (mdb) defaultParent = mdb.id;
    }

    const newBoard = createDefaultBoard(`board-${Date.now()}`, name);
    newBoard.type = type as any;
    newBoard.fedFrom = defaultParent;

    onAddBoard(newBoard);
    toast.success(`Dropped & created ${type} board "${name}"!`);
  }, [boards, onAddBoard]);

  // Node Drag Stop (Detect Drop Node onto another Node to Connect)
  const onNodeDragStop = useCallback((_, draggedNode, allNodes) => {
    if (draggedNode.id === 'DEWA/GRID' || !onConnectBoard) return;

    const targetNode = allNodes.find(n => {
      if (n.id === draggedNode.id) return false;
      const dx = Math.abs(n.position.x - draggedNode.position.x);
      const dy = Math.abs(n.position.y - draggedNode.position.y);
      return dx < 120 && dy < 90;
    });

    if (targetNode) {
      onConnect({ source: targetNode.id, target: draggedNode.id, sourceHandle: 'source', targetHandle: 'target' });
    }
  }, [onConnectBoard, onConnect]);

  const handleAddBoardSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    const boardName = newBoardName.trim() || `Board ${boards.length + 1}`;
    const newBoard = createDefaultBoard(`board-${Date.now()}`, boardName);
    newBoard.type = newBoardType as any;
    newBoard.phaseType = newPhaseType;
    newBoard.fedFrom = newFedFrom;
    newBoard.incomer.rating = newRating || "100A";

    if (onAddBoard) {
      onAddBoard(newBoard);
    }
    
    setShowAddModal(false);
    setNewBoardName('');
    toast.success(`Board "${boardName}" added and synced with Table View!`);
  };

  const handleEditBoardSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!editingBoard) return;

    if (onUpdateBoard) {
      onUpdateBoard(editingBoard.id, {
        name: editName.trim() || editingBoard.name,
        type: editType as any,
        phaseType: editPhaseType,
        fedFrom: editFedFrom,
        incomer: {
          ...editingBoard.incomer,
          rating: editRating
        }
      });
    }

    setEditingBoard(null);
    toast.success(`Board updated and synced with Table View!`);
  };

  return (
    <div className="relative w-full h-full" onDragOver={onDragOverCanvas} onDrop={onDropCanvas}>
      
      <ReactFlow 
        nodes={nodes} 
        edges={edges} 
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={handleNodeClick}
        onNodeDragStop={onNodeDragStop}
        onConnect={onConnect}
        onEdgeUpdate={onEdgeUpdate}
        onEdgesDelete={onEdgesDelete}
        nodeTypes={nodeTypes}
        fitView
      >
        <Panel position="top-left" className="!m-3 flex flex-col gap-2.5 pointer-events-auto max-w-[calc(100%-24px)]">
          {/* Top Actions Bar */}
          <div className="flex items-center justify-between bg-white/95 backdrop-blur-md px-4 py-2.5 rounded-xl border border-slate-300 shadow-lg nopan nodrag flex-wrap gap-2">
            <div className="flex items-center gap-3">
              <button 
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setNewBoardName(`Board ${boards.length + 1}`);
                  setShowAddModal(true);
                }} 
                className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-extrabold bg-[#3178c6] text-white rounded-lg hover:bg-[#2762a4] transition shadow-md active:scale-95 cursor-pointer"
              >
                <Plus className="size-4" /> Add Board
              </button>

              <div className="h-4 w-px bg-slate-200" />

              <div className="flex items-center gap-1.5 text-xs text-slate-600 font-medium">
                <Network className="size-3.5 text-blue-600" />
                <span>Drag palette cards onto canvas or draw connection dots parent → child</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full border border-emerald-200 text-xs font-bold shadow-2xs">
                <ShieldCheck className="size-3.5 text-emerald-600" />
                <span>Simultaneous Sync Active</span>
              </div>
            </div>
          </div>

          {/* Draggable Board Type Palette */}
          <div className="bg-white/95 backdrop-blur-md p-3 rounded-xl border border-slate-300 shadow-lg nopan nodrag w-56 space-y-2">
            <div className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider flex items-center justify-between">
              <span>Drag & Drop Board Palette</span>
              <span className="text-[9px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-bold">Drag Me</span>
            </div>
            
            <div className="grid grid-cols-2 gap-1.5">
              <div 
                onDragStart={(e) => onDragStartPalette(e, 'MDB')} 
                draggable 
                className="flex items-center gap-1.5 p-2 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg cursor-grab active:cursor-grabbing transition-all text-xs font-bold text-blue-800 shadow-2xs hover:scale-102"
                title="Drag & drop onto canvas to add MDB"
              >
                <div className="size-2 rounded-full bg-blue-600" /> MDB
              </div>

              <div 
                onDragStart={(e) => onDragStartPalette(e, 'SMDB')} 
                draggable 
                className="flex items-center gap-1.5 p-2 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg cursor-grab active:cursor-grabbing transition-all text-xs font-bold text-emerald-800 shadow-2xs hover:scale-102"
                title="Drag & drop onto canvas to add SMDB"
              >
                <div className="size-2 rounded-full bg-emerald-600" /> SMDB
              </div>

              <div 
                onDragStart={(e) => onDragStartPalette(e, 'DB')} 
                draggable 
                className="flex items-center gap-1.5 p-2 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg cursor-grab active:cursor-grabbing transition-all text-xs font-bold text-amber-800 shadow-2xs hover:scale-102"
                title="Drag & drop onto canvas to add DB"
              >
                <div className="size-2 rounded-full bg-amber-600" /> DB
              </div>

              <div 
                onDragStart={(e) => onDragStartPalette(e, 'LV-PANEL')} 
                draggable 
                className="flex items-center gap-1.5 p-2 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg cursor-grab active:cursor-grabbing transition-all text-xs font-bold text-indigo-800 shadow-2xs hover:scale-102"
                title="Drag & drop onto canvas to add LV Panel"
              >
                <div className="size-2 rounded-full bg-indigo-600" /> LV PANEL
              </div>

              <div 
                onDragStart={(e) => onDragStartPalette(e, 'BUSBAR')} 
                draggable 
                className="flex items-center gap-1.5 p-2 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-lg cursor-grab active:cursor-grabbing transition-all text-xs font-bold text-purple-800 shadow-2xs hover:scale-102"
                title="Drag & drop onto canvas to add BUSBAR"
              >
                <div className="size-2 rounded-full bg-purple-600" /> BUSBAR
              </div>

              <div 
                onDragStart={(e) => onDragStartPalette(e, 'EDB')} 
                draggable 
                className="flex items-center gap-1.5 p-2 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg cursor-grab active:cursor-grabbing transition-all text-xs font-bold text-red-800 shadow-2xs hover:scale-102"
                title="Drag & drop onto canvas to add Emergency DB"
              >
                <div className="size-2 rounded-full bg-red-600" /> EDB
              </div>
            </div>
          </div>
        </Panel>

        <Background />
        <Controls />
      </ReactFlow>

      {/* Add Board Modal rendered via Portal */}
      {showAddModal && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4" onClick={() => setShowAddModal(false)}>
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-md p-6 animate-in fade-in zoom-in-95" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
              <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
                <Plus className="size-4 text-blue-600" /> Add New Board in SLD
              </h3>
              <button type="button" onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer">
                <X className="size-4" />
              </button>
            </div>

            <form onSubmit={handleAddBoardSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-600 uppercase mb-1 block">Board Name</label>
                <input 
                  type="text" 
                  className="w-full h-9 px-3 border border-slate-300 rounded-lg text-sm bg-white font-medium focus:ring-2 focus:ring-blue-500 outline-hidden" 
                  value={newBoardName} 
                  onChange={e => setNewBoardName(e.target.value)}
                  placeholder="e.g. DB-GROUND, SMDB-01"
                  required
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-600 uppercase mb-1 block">Board Type</label>
                  <select 
                    className="w-full h-9 px-3 border border-slate-300 rounded-lg text-sm bg-white font-medium"
                    value={newBoardType}
                    onChange={e => setNewBoardType(e.target.value as any)}
                  >
                    <option value="DB">DB (Distribution Board)</option>
                    <option value="SMDB">SMDB (Sub Main DB)</option>
                    <option value="MDB">MDB (Main Distribution Board)</option>
                    <option value="LV-PANEL">LV PANEL</option>
                    <option value="BUSBAR">BUSBAR</option>
                    <option value="EDB">EDB (Emergency DB)</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-600 uppercase mb-1 block">Phase Type</label>
                  <select 
                    className="w-full h-9 px-3 border border-slate-300 rounded-lg text-sm bg-white font-medium"
                    value={newPhaseType}
                    onChange={e => setNewPhaseType(e.target.value)}
                  >
                    <option value="3-Phase">3-Phase</option>
                    <option value="1-Phase">1-Phase</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-600 uppercase mb-1 block">Fed From (Parent)</label>
                  <select 
                    className="w-full h-9 px-3 border border-slate-300 rounded-lg text-sm bg-white font-medium"
                    value={newFedFrom}
                    onChange={e => setNewFedFrom(e.target.value)}
                  >
                    <option value="DEWA/GRID">DEWA / GRID</option>
                    {boards.map(b => (
                      <option key={b.id} value={b.id}>{b.name} ({b.type})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-600 uppercase mb-1 block">Incomer Rating</label>
                  <input 
                    type="text" 
                    className="w-full h-9 px-3 border border-slate-300 rounded-lg text-sm bg-white font-medium" 
                    value={newRating} 
                    onChange={e => setNewRating(e.target.value)}
                    placeholder="e.g. 100A, 250A"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button type="button" onClick={() => setShowAddModal(false)} className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer">
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 text-xs font-bold bg-[#3178c6] text-white rounded-lg hover:bg-[#2762a4] shadow-sm flex items-center gap-1 cursor-pointer">
                  <Check className="size-3.5" /> Add Board & Sync
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Edit Board Modal rendered via Portal */}
      {editingBoard && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4" onClick={() => setEditingBoard(null)}>
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-md p-6 animate-in fade-in zoom-in-95" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
              <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
                <Pencil className="size-4 text-blue-600" /> Edit Board: {editingBoard.name}
              </h3>
              <button type="button" onClick={() => setEditingBoard(null)} className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer">
                <X className="size-4" />
              </button>
            </div>

            <form onSubmit={handleEditBoardSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-600 uppercase mb-1 block">Board Name</label>
                <input 
                  type="text" 
                  className="w-full h-9 px-3 border border-slate-300 rounded-lg text-sm bg-white font-medium" 
                  value={editName} 
                  onChange={e => setEditName(e.target.value)}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-600 uppercase mb-1 block">Board Type</label>
                  <select 
                    className="w-full h-9 px-3 border border-slate-300 rounded-lg text-sm bg-white font-medium"
                    value={editType}
                    onChange={e => setEditType(e.target.value)}
                  >
                    <option value="DB">DB (Distribution Board)</option>
                    <option value="SMDB">SMDB (Sub Main DB)</option>
                    <option value="MDB">MDB (Main Distribution Board)</option>
                    <option value="LV-PANEL">LV PANEL</option>
                    <option value="BUSBAR">BUSBAR</option>
                    <option value="EDB">EDB (Emergency DB)</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-600 uppercase mb-1 block">Phase Type</label>
                  <select 
                    className="w-full h-9 px-3 border border-slate-300 rounded-lg text-sm bg-white font-medium"
                    value={editPhaseType}
                    onChange={e => setEditPhaseType(e.target.value)}
                  >
                    <option value="3-Phase">3-Phase</option>
                    <option value="1-Phase">1-Phase</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-600 uppercase mb-1 block">Fed From (Parent)</label>
                  <select 
                    className="w-full h-9 px-3 border border-slate-300 rounded-lg text-sm bg-white font-medium"
                    value={editFedFrom}
                    onChange={e => setEditFedFrom(e.target.value)}
                  >
                    <option value="DEWA/GRID">DEWA / GRID</option>
                    {boards.filter(b => b.id !== editingBoard.id).map(b => (
                      <option key={b.id} value={b.id}>{b.name} ({b.type})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-600 uppercase mb-1 block">Incomer Rating</label>
                  <input 
                    type="text" 
                    className="w-full h-9 px-3 border border-slate-300 rounded-lg text-sm bg-white font-medium" 
                    value={editRating} 
                    onChange={e => setEditRating(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                <button 
                  type="button" 
                  onClick={() => {
                    if (onDeleteBoard) onDeleteBoard(editingBoard.id);
                    setEditingBoard(null);
                  }} 
                  className="px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-50 rounded-lg flex items-center gap-1 cursor-pointer"
                >
                  <Trash2 className="size-3.5" /> Delete Board
                </button>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => setEditingBoard(null)} className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer">
                    Cancel
                  </button>
                  <button type="submit" className="px-4 py-2 text-xs font-bold bg-[#3178c6] text-white rounded-lg hover:bg-[#2762a4] shadow-sm flex items-center gap-1 cursor-pointer">
                    <Check className="size-3.5" /> Save Changes
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

    </div>
  );
}

export function NetworkSLD(props: any) {
  return (
    <ReactFlowProvider>
      <NetworkSLDContent {...props} />
    </ReactFlowProvider>
  );
}
