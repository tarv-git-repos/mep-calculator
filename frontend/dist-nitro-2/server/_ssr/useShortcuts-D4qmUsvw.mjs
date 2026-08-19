import { o as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { n as toast } from "../_libs/sonner.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/useShortcuts-D4qmUsvw.js
var import_react = /* @__PURE__ */ __toESM(require_react());
function useHistory(initialState) {
	const [history, setHistory] = (0, import_react.useState)([initialState]);
	const [historyIndex, setHistoryIndex] = (0, import_react.useState)(0);
	const pushState = (0, import_react.useCallback)((newState) => {
		setHistory((prev) => {
			const newHistory = prev.slice(0, historyIndex + 1);
			newHistory.push(newState);
			return newHistory;
		});
		setHistoryIndex(historyIndex + 1);
	}, [historyIndex]);
	const undo = (0, import_react.useCallback)(() => {
		setHistoryIndex((prev) => Math.max(0, prev - 1));
	}, []);
	const redo = (0, import_react.useCallback)(() => {
		setHistoryIndex((prev) => Math.min(history.length - 1, prev + 1));
	}, [history]);
	return {
		currentState: history[historyIndex],
		pushState,
		undo,
		redo,
		canUndo: historyIndex > 0,
		canRedo: historyIndex < history.length - 1
	};
}
function useSelection(rows) {
	const [selectedIds, setSelectedIds] = (0, import_react.useState)(/* @__PURE__ */ new Set());
	const [lastSelectedId, setLastSelectedId] = (0, import_react.useState)(null);
	return {
		selectedIds,
		toggleSelection: (0, import_react.useCallback)((id, multi, range) => {
			setSelectedIds((prev) => {
				const newSet = new Set(prev);
				if (range && lastSelectedId) {
					const lastIdx = rows.findIndex((r) => r.id === lastSelectedId);
					const currIdx = rows.findIndex((r) => r.id === id);
					if (lastIdx !== -1 && currIdx !== -1) {
						const start = Math.min(lastIdx, currIdx);
						const end = Math.max(lastIdx, currIdx);
						for (let i = start; i <= end; i++) if (rows[i]?.id) newSet.add(rows[i].id);
					} else newSet.add(id);
				} else if (multi) if (newSet.has(id)) newSet.delete(id);
				else newSet.add(id);
				else {
					newSet.clear();
					newSet.add(id);
				}
				return newSet;
			});
			setLastSelectedId(id);
		}, [rows, lastSelectedId]),
		selectAll: (0, import_react.useCallback)(() => {
			setSelectedIds(new Set(rows.map((r) => r.id)));
		}, [rows]),
		clearSelection: (0, import_react.useCallback)(() => {
			setSelectedIds(/* @__PURE__ */ new Set());
			setLastSelectedId(null);
		}, [])
	};
}
var toast$1 = {
	success: (message, description) => {
		toast.success(message, { description });
	},
	error: (message, description) => {
		toast.error(message, { description });
	},
	info: (message, description) => {
		toast.info(message, { description });
	},
	warning: (message, description) => {
		toast.warning(message, { description });
	},
	promise: toast.promise
};
function useClipboard(rows, selectedIds, pushState) {
	const copy = (0, import_react.useCallback)(() => {
		if (selectedIds.size === 0) return;
		const selectedRows = rows.filter((r) => selectedIds.has(r.id));
		localStorage.setItem("grid_clipboard", JSON.stringify(selectedRows));
		toast$1.success(`${selectedRows.length} rows copied`);
	}, [rows, selectedIds]);
	return {
		copy,
		cut: (0, import_react.useCallback)(() => {
			if (selectedIds.size === 0) return;
			copy();
			pushState(rows.filter((r) => !selectedIds.has(r.id)));
		}, [
			rows,
			selectedIds,
			copy,
			pushState
		]),
		paste: (0, import_react.useCallback)(() => {
			try {
				const data = localStorage.getItem("grid_clipboard");
				if (!data) return;
				const newRows = JSON.parse(data).map((r) => ({
					...r,
					id: crypto.randomUUID()
				}));
				pushState([...rows, ...newRows]);
				toast$1.success(`${newRows.length} rows pasted`);
			} catch (e) {
				toast$1.error("Failed to paste data");
			}
		}, [rows, pushState])
	};
}
function useShortcuts(handlers) {
	(0, import_react.useEffect)(() => {
		const handleKeyDown = (e) => {
			if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
				if (e.key === "Escape") handlers.onClearSelection?.();
				return;
			}
			const ctrlCmd = e.ctrlKey || e.metaKey;
			if (ctrlCmd && e.key === "a") {
				e.preventDefault();
				handlers.onSelectAll?.();
			} else if (ctrlCmd && e.key === "c") {
				e.preventDefault();
				handlers.onCopy?.();
			} else if (ctrlCmd && e.key === "x") {
				e.preventDefault();
				handlers.onCut?.();
			} else if (ctrlCmd && e.key === "v") {
				e.preventDefault();
				handlers.onPaste?.();
			} else if (ctrlCmd && e.key === "z") {
				e.preventDefault();
				handlers.onUndo?.();
			} else if (ctrlCmd && e.key === "y") {
				e.preventDefault();
				handlers.onRedo?.();
			} else if (ctrlCmd && e.key === "d") {
				e.preventDefault();
				handlers.onDuplicate?.();
			} else if (ctrlCmd && e.key === "n") {
				e.preventDefault();
				handlers.onNewRow?.();
			} else if (ctrlCmd && e.key === "s") {
				e.preventDefault();
				handlers.onSave?.();
			} else if (ctrlCmd && e.key === "p") {
				e.preventDefault();
				if (e.shiftKey) handlers.onExportPdf?.();
				else handlers.onPrint?.();
			} else if (ctrlCmd && e.key === "e") {
				e.preventDefault();
				handlers.onExportExcel?.();
			} else if (e.key === "Delete" || e.key === "Backspace") handlers.onDelete?.();
			else if (e.key === "Escape") handlers.onClearSelection?.();
		};
		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [handlers]);
}
//#endregion
export { useShortcuts as a, useSelection as i, useClipboard as n, useHistory as r, toast$1 as t };
