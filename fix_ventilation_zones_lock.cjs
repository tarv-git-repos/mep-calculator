const fs = require('fs');
const path = require('path');

// 1. Update frontend/src/routes/ventilation.tsx
const pVent = path.join(__dirname, 'frontend/src/routes/ventilation.tsx');
let v = fs.readFileSync(pVent, 'utf8');

// Update SpacesView state
const oldSpacesState = `  const { getLockOwner, mySessionId } = useCollaboration();
  const activeUsers = useCollaboration((s) => s.activeUsers);
  const lockOwnerObj = getLockOwner("/ventilation");
  const isLockedByOther = Boolean(lockOwnerObj && lockOwnerObj.sessionId !== mySessionId);
  const lockOwnerName = lockOwnerObj ? (lockOwnerObj.name || lockOwnerObj.email) : "Unknown";

  const isEffectiveReadOnly = isReadOnly || isLockedByOther || (typeof window !== 'undefined' && (Boolean((window as any).__mep_is_readonly) || Boolean((window as any).__mep_approved_readonly)));`;

const newSpacesState = `  const { getLockOwner, mySessionId } = useCollaboration();
  const activeUsers = useCollaboration((s) => s.activeUsers);
  const lockOwnerObj = getLockOwner("/ventilation");
  const isLockedByOther = Boolean(lockOwnerObj && lockOwnerObj.sessionId !== mySessionId);
  const lockOwnerName = lockOwnerObj ? (lockOwnerObj.name || lockOwnerObj.email) : "Unknown";
  const calcReviewState = useCalculationReviewState("/ventilation", activeProjectId);
  const isApprovedLocked = Boolean(activeProjectId) && calcReviewState?.status === "APPROVED";
  const calcEffectiveReadOnly = useCalculationEffectiveReadOnly("/ventilation", activeProjectId);
  const isEffectiveReadOnly = isReadOnly || isLockedByOther || isApprovedLocked || calcEffectiveReadOnly || (typeof window !== 'undefined' && (Boolean((window as any).__mep_is_readonly) || Boolean((window as any).__mep_approved_readonly)));`;

v = v.replace(oldSpacesState.replace(/\r?\n/g, '\r\n'), newSpacesState.replace(/\r?\n/g, '\r\n'));
v = v.replace(oldSpacesState.replace(/\r?\n/g, '\n'), newSpacesState.replace(/\r?\n/g, '\n'));

// Update ZonesView state
const oldZonesState = `function ZonesView() {
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const { spaces, zones, deleteZone, addZone, equipment, assignZoneToEquipment, removeZoneFromEquipment, updateZoneInstances, addEquipment, updateEquipment, updateSpaces, updateZones, bulkUpdateSpaces, setWorkspaceState, undo, redo, isReadOnly } = useWorkspace();
  const { getLockOwner, mySessionId } = useCollaboration();
  const activeUsers = useCollaboration((s) => s.activeUsers);
  const lockOwnerObj = getLockOwner("/ventilation");
  const isLockedByOther = Boolean(lockOwnerObj && lockOwnerObj.sessionId !== mySessionId);
  const lockOwnerName = lockOwnerObj ? (lockOwnerObj.name || lockOwnerObj.email) : "Unknown";
  const isEffectiveReadOnly = isReadOnly || isLockedByOther || (typeof window !== 'undefined' && (Boolean((window as any).__mep_is_readonly) || Boolean((window as any).__mep_approved_readonly)));`;

const newZonesState = `function ZonesView() {
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const { spaces, zones, deleteZone, addZone, equipment, assignZoneToEquipment, removeZoneFromEquipment, updateZoneInstances, addEquipment, updateEquipment, updateSpaces, updateZones, bulkUpdateSpaces, setWorkspaceState, undo, redo, isReadOnly, activeProjectId } = useWorkspace();
  const { getLockOwner, mySessionId } = useCollaboration();
  const activeUsers = useCollaboration((s) => s.activeUsers);
  const lockOwnerObj = getLockOwner("/ventilation");
  const isLockedByOther = Boolean(lockOwnerObj && lockOwnerObj.sessionId !== mySessionId);
  const lockOwnerName = lockOwnerObj ? (lockOwnerObj.name || lockOwnerObj.email) : "Unknown";
  const calcReviewState = useCalculationReviewState("/ventilation", activeProjectId);
  const isApprovedLocked = Boolean(activeProjectId) && calcReviewState?.status === "APPROVED";
  const calcEffectiveReadOnly = useCalculationEffectiveReadOnly("/ventilation", activeProjectId);
  const isEffectiveReadOnly = isReadOnly || isLockedByOther || isApprovedLocked || calcEffectiveReadOnly || (typeof window !== 'undefined' && (Boolean((window as any).__mep_is_readonly) || Boolean((window as any).__mep_approved_readonly)));`;

v = v.replace(oldZonesState.replace(/\r?\n/g, '\r\n'), newZonesState.replace(/\r?\n/g, '\r\n'));
v = v.replace(oldZonesState.replace(/\r?\n/g, '\n'), newZonesState.replace(/\r?\n/g, '\n'));

// Update ZonesView "+ New Zone" button
const oldZoneBtn = `        <div className="ml-auto flex items-center gap-1">
          <TBtn primary onClick={() => {
            const name = \`Z-\${String(zones.length + 1).padStart(3, "0")}\`;
            const newZone: Zone = {
              id: \`zone-\${Date.now()}-\${Math.floor(Math.random() * 1000000)}\`,
              name,
              building: "Tower A",
              floor: "L01",
              spaceCount: 0,
              area: 0,
              freshAir: 0,
              extractAir: 0,
              pressure: 0,
              equipment: [],
              pressureType: "neutral",
              multiplier: 1,
              faAssignedQty: 1,
              eaAssignedQty: 1,
            };
            addZone(newZone);
          }}><Plus className="size-3.5" /> New Zone</TBtn>
        </div>`;

const newZoneBtn = `        <div className="ml-auto flex items-center gap-1">
          <TBtn
            primary
            disabled={isEffectiveReadOnly || isApprovedLocked}
            title={isApprovedLocked ? "Calculation is Approved & Locked. Unlock to add zones." : isEffectiveReadOnly ? "Workspace is Read-Only." : undefined}
            onClick={() => {
              if (isEffectiveReadOnly || isApprovedLocked) {
                toast.info("Calculation is Approved and Locked. Discipline Coordinator must unlock to make changes.", { id: "readonly-notice" });
                return;
              }
              const name = \`Z-\${String(zones.length + 1).padStart(3, "0")}\`;
              const newZone: Zone = {
                id: \`zone-\${Date.now()}-\${Math.floor(Math.random() * 1000000)}\`,
                name,
                building: "Tower A",
                floor: "L01",
                spaceCount: 0,
                area: 0,
                freshAir: 0,
                extractAir: 0,
                pressure: 0,
                equipment: [],
                pressureType: "neutral",
                multiplier: 1,
                faAssignedQty: 1,
                eaAssignedQty: 1,
              };
              addZone(newZone);
              toast.success(\`Zone "\${name}" created!\`);
            }}
          >
            <Plus className="size-3.5" /> New Zone
          </TBtn>
        </div>`;

v = v.replace(oldZoneBtn.replace(/\r?\n/g, '\r\n'), newZoneBtn.replace(/\r?\n/g, '\r\n'));
v = v.replace(oldZoneBtn.replace(/\r?\n/g, '\n'), newZoneBtn.replace(/\r?\n/g, '\n'));

// Update EquipmentView state
const oldEquipState = `function EquipmentView() {
  const [query, setQuery] = useState("");
  const { spaces, zones, equipment, updateEquipment, deleteEquipment, setWorkspaceState, undo, redo, isReadOnly } = useWorkspace();
  const { getLockOwner, mySessionId } = useCollaboration();
  const activeUsers = useCollaboration((s) => s.activeUsers);
  const lockOwnerObj = getLockOwner("/ventilation");
  const isLockedByOther = Boolean(lockOwnerObj && lockOwnerObj.sessionId !== mySessionId);
  const lockOwnerName = lockOwnerObj ? (lockOwnerObj.name || lockOwnerObj.email) : "Unknown";
  const isEffectiveReadOnly = isReadOnly || isLockedByOther || (typeof window !== 'undefined' && (Boolean((window as any).__mep_is_readonly) || Boolean((window as any).__mep_approved_readonly)));`;

const newEquipState = `function EquipmentView() {
  const [query, setQuery] = useState("");
  const { spaces, zones, equipment, updateEquipment, deleteEquipment, setWorkspaceState, undo, redo, isReadOnly, activeProjectId } = useWorkspace();
  const { getLockOwner, mySessionId } = useCollaboration();
  const activeUsers = useCollaboration((s) => s.activeUsers);
  const lockOwnerObj = getLockOwner("/ventilation");
  const isLockedByOther = Boolean(lockOwnerObj && lockOwnerObj.sessionId !== mySessionId);
  const lockOwnerName = lockOwnerObj ? (lockOwnerObj.name || lockOwnerObj.email) : "Unknown";
  const calcReviewState = useCalculationReviewState("/ventilation", activeProjectId);
  const isApprovedLocked = Boolean(activeProjectId) && calcReviewState?.status === "APPROVED";
  const calcEffectiveReadOnly = useCalculationEffectiveReadOnly("/ventilation", activeProjectId);
  const isEffectiveReadOnly = isReadOnly || isLockedByOther || isApprovedLocked || calcEffectiveReadOnly || (typeof window !== 'undefined' && (Boolean((window as any).__mep_is_readonly) || Boolean((window as any).__mep_approved_readonly)));`;

v = v.replace(oldEquipState.replace(/\r?\n/g, '\r\n'), newEquipState.replace(/\r?\n/g, '\r\n'));
v = v.replace(oldEquipState.replace(/\r?\n/g, '\n'), newEquipState.replace(/\r?\n/g, '\n'));

// Update EquipmentView "+ New Equipment" button
const oldEquipBtn = `          <TBtn primary onClick={() => {
            setSizerEquipId(null);
            setSizerShowAdd(true);
            setSizerOpen(true);
          }}><Plus className="size-3.5" /> New Equipment</TBtn>`;

const newEquipBtn = `          <TBtn
            primary
            disabled={isEffectiveReadOnly || isApprovedLocked}
            title={isApprovedLocked ? "Calculation is Approved & Locked. Unlock to add equipment." : isEffectiveReadOnly ? "Workspace is Read-Only." : undefined}
            onClick={() => {
              if (isEffectiveReadOnly || isApprovedLocked) {
                toast.info("Calculation is Approved and Locked. Discipline Coordinator must unlock to make changes.", { id: "readonly-notice" });
                return;
              }
              setSizerEquipId(null);
              setSizerShowAdd(true);
              setSizerOpen(true);
            }}
          >
            <Plus className="size-3.5" /> New Equipment
          </TBtn>`;

v = v.replace(oldEquipBtn.replace(/\r?\n/g, '\r\n'), newEquipBtn.replace(/\r?\n/g, '\r\n'));
v = v.replace(oldEquipBtn.replace(/\r?\n/g, '\n'), newEquipBtn.replace(/\r?\n/g, '\n'));

fs.writeFileSync(pVent, v, 'utf8');
console.log('frontend/src/routes/ventilation.tsx updated successfully');

// 2. Update frontend/src/routes/zones.tsx
const pZones = path.join(__dirname, 'frontend/src/routes/zones.tsx');
if (fs.existsSync(pZones)) {
  let z = fs.readFileSync(pZones, 'utf8');

  // Add imports if needed
  if (!z.includes('useCalculationReviewState')) {
    z = z.replace(
      `import { useWorkspace, type Zone, type Space } from "@/lib/workspace-store";`,
      `import { useWorkspace, type Zone, type Space } from "@/lib/workspace-store";\nimport { useCalculationReviewState, useCalculationLock, useCalculationEffectiveReadOnly } from "@/components/workspace/CalculationReviewBar";`
    );
  }

  // Update ZonesPage state
  const oldZonesPageState = `function ZonesPage() {
  const [query, setQuery] = useState("");
  const { spaces, zones, addZone, deleteZone, equipment, assignZoneToEquipment, removeZoneFromEquipment, setWorkspaceState } = useWorkspace();`;

  const newZonesPageState = `function ZonesPage() {
  const [query, setQuery] = useState("");
  const { spaces, zones, addZone, deleteZone, equipment, assignZoneToEquipment, removeZoneFromEquipment, setWorkspaceState, activeProjectId, isReadOnly } = useWorkspace();
  const calcReviewState = useCalculationReviewState("/ventilation", activeProjectId);
  const isApprovedLocked = Boolean(activeProjectId) && calcReviewState?.status === "APPROVED";
  const calcEffectiveReadOnly = useCalculationEffectiveReadOnly("/ventilation", activeProjectId);
  const isEffectiveReadOnly = isReadOnly || isApprovedLocked || calcEffectiveReadOnly || (typeof window !== 'undefined' && (Boolean((window as any).__mep_is_readonly) || Boolean((window as any).__mep_approved_readonly)));`;

  z = z.replace(oldZonesPageState.replace(/\r?\n/g, '\r\n'), newZonesPageState.replace(/\r?\n/g, '\r\n'));
  z = z.replace(oldZonesPageState.replace(/\r?\n/g, '\n'), newZonesPageState.replace(/\r?\n/g, '\n'));

  // Update handleNewZone in zones.tsx
  const oldHandleNewZone = `  const handleNewZone = () => {
    const name = \`Z-\${String(zones.length + 1).padStart(3, "0")}\`;`;

  const newHandleNewZone = `  const handleNewZone = () => {
    if (isEffectiveReadOnly || isApprovedLocked) {
      toast.info("Calculation is Approved and Locked. Discipline Coordinator must unlock to make changes.", { id: "readonly-notice" });
      return;
    }
    const name = \`Z-\${String(zones.length + 1).padStart(3, "0")}\`;`;

  z = z.replace(oldHandleNewZone.replace(/\r?\n/g, '\r\n'), newHandleNewZone.replace(/\r?\n/g, '\r\n'));
  z = z.replace(oldHandleNewZone.replace(/\r?\n/g, '\n'), newHandleNewZone.replace(/\r?\n/g, '\n'));

  // Update actions prop in zones.tsx
  const oldActions = `actions={<TBtn primary onClick={handleNewZone}><Plus className="size-3.5" /> New Zone</TBtn>}`;
  const newActions = `actions={<TBtn primary disabled={isEffectiveReadOnly || isApprovedLocked} title={isApprovedLocked ? "Calculation is Approved & Locked. Unlock to add zones." : undefined} onClick={handleNewZone}><Plus className="size-3.5" /> New Zone</TBtn>}`;

  z = z.replace(oldActions, newActions);

  fs.writeFileSync(pZones, z, 'utf8');
  console.log('frontend/src/routes/zones.tsx updated successfully');
}
