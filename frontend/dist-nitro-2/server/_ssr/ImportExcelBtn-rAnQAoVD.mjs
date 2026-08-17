import { o as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { j as require_jsx_runtime } from "../_libs/@radix-ui/react-alert-dialog+[...].mjs";
import { l as Upload } from "../_libs/lucide-react.mjs";
import { n as toast } from "../_libs/sonner.mjs";
import { t as TBtn } from "./Button-BxVwVdnO.mjs";
import { n as utils, t as readSync } from "../_libs/xlsx.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/ImportExcelBtn-rAnQAoVD.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function ImportExcelBtn({ columnMapping, onImport, className, children }) {
	const fileInputRef = (0, import_react.useRef)(null);
	const handleClick = () => {
		if (fileInputRef.current) {
			fileInputRef.current.value = "";
			fileInputRef.current.click();
		}
	};
	const handleImportExcel = (e) => {
		const file = e.target.files?.[0];
		if (!file) return;
		const reader = new FileReader();
		reader.onload = (evt) => {
			try {
				const data = evt.target?.result;
				const workbook = readSync(data, { type: "binary" });
				if (!workbook.SheetNames.length) {
					toast.error("Excel file is empty");
					return;
				}
				const firstSheetName = workbook.SheetNames[0];
				const worksheet = workbook.Sheets[firstSheetName];
				const json = utils.sheet_to_json(worksheet);
				if (!json || json.length === 0) {
					toast.error("No data found in the Excel sheet");
					return;
				}
				const mappedRows = json.map((row) => {
					const newObj = {};
					for (const [excelKey, stateKey] of Object.entries(columnMapping)) {
						const val = row[excelKey];
						if (val !== void 0 && val !== null && val !== "") newObj[stateKey] = val;
					}
					return newObj;
				});
				onImport(mappedRows);
				toast.success(`Successfully imported ${mappedRows.length} rows`);
			} catch (err) {
				console.error("Error parsing Excel file", err);
				toast.error("Failed to parse Excel file");
			}
		};
		reader.readAsBinaryString(file);
	};
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
		type: "file",
		ref: fileInputRef,
		accept: ".xlsx,.xls,.csv",
		onChange: handleImportExcel,
		className: "hidden"
	}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TBtn, {
		onClick: handleClick,
		className,
		children: children || /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Upload, { className: "size-3.5 mr-1" }), "Import Excel"] })
	})] });
}
//#endregion
export { ImportExcelBtn as t };
