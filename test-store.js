const state = {
    boards: [
        {
            id: 'b1',
            name: 'MDB-1',
            type: 'MDB',
            fedFrom: 'DEWA/GRID',
            circuits: []
        },
        {
            id: 'b2',
            name: 'SMDB-1',
            type: 'SMDB',
            fedFrom: 'b1',
            circuits: []
        },
        {
            id: 'b3',
            name: 'DB-1',
            type: 'DB',
            fedFrom: 'b2',
            circuits: []
        }
    ]
};

function generateDefaultMDBCircuit(id, index) {
  return { id, cirNo: index + 1, desc: "New Area", qty: 1, loadW: 0, phase: "R Phase" };
}

function recalculateNetwork() {
      let boards = JSON.parse(JSON.stringify(state.boards));
      
      const levels = {};
      const getLevel = (id, visited = new Set()) => {
        if (visited.has(id)) return 0;
        visited.add(id);
        const b = boards.find((br) => br.id === id);
        if (!b || b.fedFrom === "DEWA/GRID" || b.fedFrom === "GEN" || b.fedFrom === "") return 0;
        if (levels[id] !== undefined) return levels[id];
        levels[id] = 1 + getLevel(b.fedFrom, visited);
        return levels[id];
      };
      
      boards.forEach((b) => getLevel(b.id));
      const sortedBoards = [...boards].sort((a, b) => (levels[b.id] || 0) - (levels[a.id] || 0));
      
      sortedBoards.forEach(parent => {
        if (parent.type === "DB" || parent.type === "EDB") return;
        
        const children = boards.filter((b) => b.fedFrom === parent.id);
        
        parent.circuits = parent.circuits.filter((c) => {
            const isBoardFeeder = c.desc && (c.desc.startsWith("New Board") || c.desc.startsWith("DB-") || c.desc.startsWith("SMDB-") || c.desc.startsWith("MDB-") || boards.some((ab) => ab.name === c.desc));
            if (!isBoardFeeder) return true;
            const stillExists = children.some((ch) => c.desc === ch.name || c.desc === 'DB-' + ch.id);
            return stillExists;
        });

        if (children.length === 0) return;
        
        children.forEach((child) => {
          let childLoad = 0;
          // simplify load calc to 0
          
          let pCirc = parent.circuits.find((c) => c.desc === child.name || c.desc === 'DB-' + child.id);
          if (pCirc) {
            pCirc.loadW = childLoad;
          } else {
            pCirc = generateDefaultMDBCircuit('c-' + Date.now() + '-' + child.id, parent.circuits.length);
            pCirc.desc = child.name;
            pCirc.loadW = childLoad;
            parent.circuits.push(pCirc);
          }
        });
      });
      console.log(JSON.stringify(boards, null, 2));
}

recalculateNetwork();
