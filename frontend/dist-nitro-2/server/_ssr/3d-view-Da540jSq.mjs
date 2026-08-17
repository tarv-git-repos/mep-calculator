import { o as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { j as require_jsx_runtime } from "../_libs/@radix-ui/react-alert-dialog+[...].mjs";
import { t as AppShell } from "./AppShell-urg-0zDa.mjs";
import { a as SimpleScene, i as SimpleRenderer, n as IfcLoader, o as Worlds, r as OrthoPerspectiveCamera, s as Color, t as Components } from "../_libs/@thatopen/components+[...].mjs";
import { t as CSS2DRenderer } from "../_libs/three.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/3d-view-Da540jSq.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function Platform3DViewer() {
	const containerRef = (0, import_react.useRef)(null);
	const viewportRef = (0, import_react.useRef)(null);
	const overlayRef = (0, import_react.useRef)(null);
	const [selectedSpaceInfo, setSelectedSpaceInfo] = (0, import_react.useState)("Click on a space in 3D view to select it.");
	const [activeTab, setActiveTab] = (0, import_react.useState)("3d");
	const [activeCameraMode, setActiveCameraMode] = (0, import_react.useState)("orbit");
	const [isClipActive, setIsClipActive] = (0, import_react.useState)(false);
	const [isTagsActive, setIsTagsActive] = (0, import_react.useState)(true);
	const [isSpacesActive, setIsSpacesActive] = (0, import_react.useState)(true);
	const [levels, setLevels] = (0, import_react.useState)([]);
	const [selectedLevel, setSelectedLevel] = (0, import_react.useState)("");
	const [isLoaded, setIsLoaded] = (0, import_react.useState)(false);
	const [loadingText, setLoadingText] = (0, import_react.useState)("Drag & Drop .ifc file here");
	(0, import_react.useEffect)(() => {
		if (!viewportRef.current) return;
		const viewport = viewportRef.current;
		const components = new Components();
		const world = components.get(Worlds).create();
		world.scene = new SimpleScene(components);
		world.renderer = new SimpleRenderer(components, viewport, { logarithmicDepthBuffer: true });
		world.camera = new OrthoPerspectiveCamera(components);
		world.scene.setup();
		world.scene.three.background = new Color(2368550);
		components.init();
		const css2DRenderer = new CSS2DRenderer();
		css2DRenderer.setSize(viewport.clientWidth, viewport.clientHeight);
		Object.assign(css2DRenderer.domElement.style, {
			position: "absolute",
			top: "0px",
			pointerEvents: "none"
		});
		viewport.appendChild(css2DRenderer.domElement);
		world.renderer.onBeforeUpdate.add(() => css2DRenderer.render(world.scene.three, world.camera.three));
		const resizeObserver = new ResizeObserver(() => {
			world.renderer?.resize();
			world.camera?.updateAspect();
			css2DRenderer.setSize(viewport.clientWidth, viewport.clientHeight);
		});
		resizeObserver.observe(viewport);
		components.get(IfcLoader).setup();
		return () => {
			resizeObserver.disconnect();
			if (viewport.contains(css2DRenderer.domElement)) viewport.removeChild(css2DRenderer.domElement);
		};
	}, []);
	const handleDragOver = (e) => {
		e.preventDefault();
	};
	const handleDrop = (e) => {
		e.preventDefault();
		setLoadingText("Processing IFC File...");
		setIsLoaded(true);
	};
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		ref: containerRef,
		className: "flex w-full h-full bg-[#242426] text-white font-sans overflow-hidden relative",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			id: "viewport",
			ref: viewportRef,
			className: "flex-1 relative w-full h-full",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "absolute top-4 left-1/2 -translate-x-1/2 bg-[#1e1e20]/85 backdrop-blur-md p-2 rounded-lg flex items-center gap-2.5 border border-[#444] z-10",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "inline-flex bg-[#1a1a1c] rounded-md p-0.5 border border-[#333] gap-0.5",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							onClick: () => setActiveTab("3d"),
							className: `px-3 py-1.5 rounded text-xs font-bold transition-all ${activeTab === "3d" ? "bg-[#555] text-white" : "text-[#aaa] hover:text-white"}`,
							children: "3D View"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							onClick: () => setActiveTab("2d"),
							className: `px-3 py-1.5 rounded text-xs font-bold transition-all ${activeTab === "2d" ? "bg-[#555] text-white" : "text-[#aaa] hover:text-white"}`,
							children: "2D View"
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "w-[1px] h-5 bg-[#444] mx-1" }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						onClick: () => setActiveCameraMode("orbit"),
						className: `px-3 py-1.5 rounded text-xs font-bold transition-all ${activeCameraMode === "orbit" ? "bg-[#555] text-white" : "bg-[#333] text-[#ccc] hover:bg-[#555]"}`,
						children: "Orbit"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						onClick: () => setActiveCameraMode("walk"),
						className: `px-3 py-1.5 rounded text-xs font-bold transition-all ${activeCameraMode === "walk" ? "bg-[#555] text-white" : "bg-[#333] text-[#ccc] hover:bg-[#555]"}`,
						children: "Walk"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						onClick: () => setIsClipActive(!isClipActive),
						className: `px-3 py-1.5 rounded text-xs font-bold transition-all ${isClipActive ? "bg-[#555] text-white" : "bg-[#333] text-[#ccc] hover:bg-[#555]"}`,
						children: "Cut Plane"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						onClick: () => setIsTagsActive(!isTagsActive),
						className: `px-3 py-1.5 rounded text-xs font-bold transition-all ${isTagsActive ? "bg-[#555] text-white" : "bg-[#333] text-[#ccc] hover:bg-[#555]"}`,
						children: "Tags"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						onClick: () => setIsSpacesActive(!isSpacesActive),
						className: `px-3 py-1.5 rounded text-xs font-bold transition-all ${isSpacesActive ? "bg-[#555] text-white" : "bg-[#333] text-[#ccc] hover:bg-[#555]"}`,
						children: "Spaces"
					})
				]
			}), !isLoaded && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				ref: overlayRef,
				onDragOver: handleDragOver,
				onDrop: handleDrop,
				className: "absolute inset-0 bg-[#242426]/90 flex flex-col items-center justify-center border-2 border-dashed border-[#555] m-6 rounded-xl transition-all cursor-pointer",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "text-4xl mb-3",
						children: "📁"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
						className: "text-xl font-semibold text-gray-200",
						children: loadingText
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-sm text-gray-400 mt-2",
						children: "Support for IFC2x3 & IFC4 spatial models"
					})
				]
			})]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			id: "sidebar",
			className: "w-[260px] bg-[#1a1a1c] border-l border-[#333] p-4 flex flex-col gap-4",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
				className: "text-xs uppercase tracking-wider text-[#aaa] border-b border-[#333] pb-2 font-bold mb-3",
				children: "MEP Equipment"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "space-y-2",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						draggable: true,
						className: "p-2.5 bg-[#252528] rounded border border-[#3a3a3d] text-xs font-semibold cursor-grab hover:bg-[#333] transition-all",
						children: "Air Handling Unit (AHU)"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						draggable: true,
						className: "p-2.5 bg-[#252528] rounded border border-[#3a3a3d] text-xs font-semibold cursor-grab hover:bg-[#333] transition-all",
						children: "Chilled Water Pump"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						draggable: true,
						className: "p-2.5 bg-[#252528] rounded border border-[#3a3a3d] text-xs font-semibold cursor-grab hover:bg-[#333] transition-all",
						children: "Exhaust Fan"
					})
				]
			})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
				className: "text-xs uppercase tracking-wider text-[#aaa] border-b border-[#333] pb-2 font-bold mb-3",
				children: "Selected Space"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "text-xs text-gray-300 leading-relaxed p-3 bg-[#222] rounded border border-[#333]",
				children: selectedSpaceInfo
			})] })]
		})]
	});
}
function Platform3DPage() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AppShell, {
		title: "Platform 3D Viewer",
		subtitle: "Interactive IFC BIM Model & Spatial Viewer",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "h-full w-full overflow-hidden bg-[#242426]",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Platform3DViewer, {})
		})
	});
}
//#endregion
export { Platform3DPage as component };
