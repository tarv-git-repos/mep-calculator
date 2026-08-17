import { o as __toESM } from "../_runtime.mjs";
import { n as api } from "./api-BcQvT-mW.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { u as useWorkspace } from "./workspace-store-blzx_bW5.mjs";
import { j as require_jsx_runtime } from "../_libs/@radix-ui/react-alert-dialog+[...].mjs";
import { Dt as ChevronRight, F as Pin, Gt as PenLine, It as Boxes, K as LayoutDashboard, N as Plus, P as Play, Pt as Building2, T as Search, Ut as TriangleAlert, V as MapPin, a as Users, in as CircleCheck, jt as Calendar, lt as FileText, m as Trash2, n as X, nn as CircleQuestionMark, o as User, ot as FolderKanban, ut as FileCode, xt as Copy } from "../_libs/lucide-react.mjs";
import { i as useConfirm } from "./use-confirm-BT3fngjN.mjs";
import { n as toast } from "../_libs/sonner.mjs";
import { i as useAuth } from "./AuthContext-j7AuApR_.mjs";
import { t as AppShell } from "./AppShell-DWNCn_-Z.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/projects-BtSE8A54.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var formatRelativeTime = (dateStr) => {
	if (!dateStr) return "Just now";
	const date = new Date(dateStr);
	if (isNaN(date.getTime())) return "Just now";
	const diffSec = Math.max(0, Math.floor(((/* @__PURE__ */ new Date()).getTime() - date.getTime()) / 1e3));
	if (diffSec < 60) return "Just now";
	if (diffSec < 3600) return `${Math.floor(diffSec / 60)} minutes ago`;
	if (diffSec < 86400) {
		const hrs = Math.floor(diffSec / 3600);
		return `${hrs} ${hrs === 1 ? "hour" : "hours"} ago`;
	}
	const days = Math.floor(diffSec / 86400);
	return `${days} ${days === 1 ? "day" : "days"} ago`;
};
function ProjectsPage() {
	const confirm = useConfirm();
	const { project: activeProject, projects, activeProjectId, selectProject, createNewProject, duplicateProject, deleteProject, updateProject, refreshProjects } = useWorkspace();
	const [search, setSearch] = (0, import_react.useState)("");
	const [newProject, setNewProject] = (0, import_react.useState)({
		name: "",
		code: "",
		client: "",
		location: "",
		description: "",
		notes: "",
		assigned_users: [],
		assigned_teams: []
	});
	const { profile } = useAuth();
	["SUPER_ADMIN", "ORG_ADMIN"].includes(profile?.role || "");
	const [allUsers, setAllUsers] = (0, import_react.useState)(() => {
		const cached = localStorage.getItem("cachedAllUsers");
		return cached ? JSON.parse(cached) : [];
	});
	const [allTeams, setAllTeams] = (0, import_react.useState)(() => {
		const cached = localStorage.getItem("cachedAllTeams");
		return cached ? JSON.parse(cached) : [];
	});
	const [pinnedProjects, setPinnedProjects] = (0, import_react.useState)(() => {
		try {
			return JSON.parse(localStorage.getItem(`pinned_projects_${profile?.id}`) || "[]");
		} catch {
			return [];
		}
	});
	const [workspaceHistory, setWorkspaceHistory] = (0, import_react.useState)(() => {
		try {
			return JSON.parse(localStorage.getItem(`workspace_history_${profile?.id}`) || "{}");
		} catch {
			return {};
		}
	});
	const [globalActivity, setGlobalActivity] = (0, import_react.useState)([]);
	const loadGlobalActivity = () => {
		try {
			setGlobalActivity(JSON.parse(localStorage.getItem(`global_activity_${profile?.id}`) || "[]"));
		} catch {}
	};
	const handleSelectProject = (id) => {
		setWorkspaceHistory((prev) => {
			const next = {
				...prev,
				[id]: Date.now()
			};
			localStorage.setItem(`workspace_history_${profile?.id}`, JSON.stringify(next));
			return next;
		});
		const globalKey = `global_activity_${profile?.id}`;
		try {
			const globalLog = JSON.parse(localStorage.getItem(globalKey) || "[]");
			const p = projects.find((proj) => proj.id === id);
			const newActivity = {
				id: Date.now().toString(),
				action: "Opened Workspace",
				detail: p ? p.name : "A workspace",
				time: Date.now(),
				color: "bg-purple-500"
			};
			if (globalLog[0]?.detail !== newActivity.detail || Date.now() - globalLog[0]?.time > 6e4) {
				globalLog.unshift(newActivity);
				localStorage.setItem(globalKey, JSON.stringify(globalLog.slice(0, 5)));
				loadGlobalActivity();
			}
		} catch {}
		selectProject(id);
	};
	const togglePin = (id) => {
		setPinnedProjects((prev) => {
			const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
			localStorage.setItem(`pinned_projects_${profile?.id}`, JSON.stringify(next));
			return next;
		});
	};
	const loadUsersAndTeams = async () => {
		const u = await api.getUsers();
		setAllUsers(u);
		try {
			localStorage.setItem("cachedAllUsers", JSON.stringify(u));
		} catch {}
		const t = await api.getTeams();
		setAllTeams(t);
		try {
			localStorage.setItem("cachedAllTeams", JSON.stringify(t));
		} catch {}
	};
	(0, import_react.useEffect)(() => {
		loadUsersAndTeams();
		refreshProjects();
	}, []);
	(0, import_react.useEffect)(() => {
		if (!profile?.id) return;
		const refreshActivity = () => {
			try {
				setGlobalActivity(JSON.parse(localStorage.getItem(`global_activity_${profile.id}`) || "[]"));
			} catch {}
		};
		refreshActivity();
		const interval = setInterval(refreshActivity, 2e3);
		return () => clearInterval(interval);
	}, [profile?.id]);
	const [editingProj, setEditingProj] = (0, import_react.useState)(null);
	const [deleteConfirmId, setDeleteConfirmId] = (0, import_react.useState)(null);
	const [isCreateOpen, setIsCreateOpen] = (0, import_react.useState)(false);
	const openCreateModal = () => {
		loadUsersAndTeams();
		setIsCreateOpen(true);
	};
	const filteredProjects = (0, import_react.useMemo)(() => {
		let result = projects;
		const q = search.toLowerCase().trim();
		if (q) result = projects.filter((p) => p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q) || p.client.toLowerCase().includes(q));
		return [...result].sort((a, b) => {
			const aPinned = pinnedProjects.includes(a.id);
			const bPinned = pinnedProjects.includes(b.id);
			if (aPinned && !bPinned) return -1;
			if (!aPinned && bPinned) return 1;
			const aTime = workspaceHistory[a.id] || new Date(a.updated_at || a.created_at || 0).getTime();
			return (workspaceHistory[b.id] || new Date(b.updated_at || b.created_at || 0).getTime()) - aTime;
		});
	}, [
		projects,
		search,
		pinnedProjects,
		workspaceHistory
	]);
	const handleCreate = async (e) => {
		e.preventDefault();
		if (!newProject.name.trim()) {
			toast.error("Project Name is required!");
			return;
		}
		if (!newProject.code.trim()) {
			toast.error("Project Code is required!");
			return;
		}
		try {
			const res = await createNewProject({
				name: newProject.name.trim(),
				code: newProject.code.trim().toUpperCase(),
				client: newProject.client.trim() || "N/A",
				location: newProject.location.trim(),
				description: newProject.description.trim(),
				notes: newProject.notes.trim()
			}, newProject.assigned_users, newProject.assigned_teams);
			if (res && res.success) {
				toast.success("Project created successfully!");
				setNewProject({
					name: "",
					code: "",
					client: "",
					location: "",
					description: "",
					notes: "",
					assigned_users: [],
					assigned_teams: []
				});
			} else toast.error(res?.message || "Failed to create project");
		} catch (err) {
			toast.error("Error creating project: " + err.message);
		}
	};
	const handleSaveEdit = () => {
		if (editingProj) {
			if (!editingProj.name.trim()) {
				toast.error("Project Name is required!");
				return;
			}
			updateProject(editingProj);
			setEditingProj(null);
			toast.success("Project updated successfully!");
		}
	};
	const handleRemoveUserFromProject = async (projectId, userId) => {
		if (!await confirm("Are you sure you want to remove this user from the project?", {
			title: "Remove User",
			confirmText: "Remove",
			cancelText: "Cancel"
		})) return;
		const res = await api.removeUserFromProject(projectId, userId);
		if (res.success) {
			const proj = projects.find((p) => p.id === projectId);
			if (proj && proj.project_users) {
				proj.project_users = proj.project_users.filter((u) => u.user_id !== userId);
				updateProject({ ...proj });
				if (editingProj?.id === projectId) setEditingProj({ ...proj });
			}
			toast.success("User removed from project successfully.");
		} else toast.error(res.message || "Failed to remove user");
	};
	const handleAddUserToProject = async (projectId, userId) => {
		if (!userId) return;
		const res = await api.addUserToProject(projectId, userId);
		if (res.success) {
			const proj = projects.find((p) => p.id === projectId);
			if (proj) {
				if (!proj.project_users) proj.project_users = [];
				if (!proj.project_users.find((u) => u.user_id === userId)) {
					proj.project_users.push({
						project_id: projectId,
						user_id: userId
					});
					updateProject({ ...proj });
					if (editingProj?.id === projectId) setEditingProj({ ...proj });
				}
			}
			toast.success("User added to project successfully!");
		} else toast.error(res.message || "Failed to add user");
	};
	const handleRemoveTeamFromProject = async (projectId, teamId) => {
		if (!await confirm("Are you sure you want to remove this team from the project?", {
			title: "Remove Team",
			confirmText: "Remove",
			cancelText: "Cancel"
		})) return;
		const res = await api.removeTeamFromProject(projectId, teamId);
		if (res.success) {
			const proj = projects.find((p) => p.id === projectId);
			if (proj && proj.project_teams) {
				proj.project_teams = proj.project_teams.filter((t) => t.team_id !== teamId);
				updateProject({ ...proj });
				if (editingProj?.id === projectId) setEditingProj({ ...proj });
			}
			toast.success("Team removed from project successfully.");
		} else toast.error(res.message || "Failed to remove team");
	};
	const handleAddTeamToProject = async (projectId, teamId) => {
		if (!teamId) return;
		const res = await api.addTeamToProject(projectId, teamId);
		if (res.success) {
			const proj = projects.find((p) => p.id === projectId);
			if (proj) {
				if (!proj.project_teams) proj.project_teams = [];
				if (!proj.project_teams.find((t) => t.team_id === teamId)) {
					proj.project_teams.push({
						project_id: projectId,
						team_id: teamId
					});
					updateProject({ ...proj });
					if (editingProj?.id === projectId) setEditingProj({ ...proj });
				}
			}
			toast.success("Team added to project successfully!");
		} else toast.error(res.message || "Failed to add team");
	};
	const statsMap = (0, import_react.useMemo)(() => {
		const map = {};
		projects.forEach((p) => {
			const wdata = p.workspace_data;
			if (wdata) map[p.id] = {
				spaces: Array.isArray(wdata.spaces) ? wdata.spaces.length : 0,
				zones: Array.isArray(wdata.zones) ? wdata.zones.length : 0,
				equipment: Array.isArray(wdata.equipment) ? wdata.equipment.length : 0
			};
			else map[p.id] = {
				spaces: 0,
				zones: 0,
				equipment: 0
			};
		});
		return map;
	}, [projects]);
	const totalStats = (0, import_react.useMemo)(() => {
		let spaces = 0;
		let zones = 0;
		let equipment = 0;
		Object.values(statsMap).forEach((stat) => {
			spaces += stat.spaces;
			zones += stat.zones;
			equipment += stat.equipment;
		});
		return {
			spaces,
			zones,
			equipment
		};
	}, [statsMap]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(AppShell, {
		title: "Projects",
		subtitle: `${projects.length} workspaces`,
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex flex-col lg:flex-row h-[calc(100vh-80px)] overflow-hidden bg-background",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex-1 flex flex-col min-h-0 p-6 md:p-8 overflow-y-auto custom-scrollbar bg-slate-50/50 dark:bg-zinc-950/20",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex flex-col gap-1 mb-6 select-none",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
								className: "text-[20px] font-black text-foreground tracking-tight",
								children: "Project Control Center"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-[12.5px] text-muted-foreground font-semibold",
								children: "Manage your MEP calculation scopes, workspace metrics, and project environments"
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8 select-none",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "bg-card border border-border p-4.5 rounded-2xl flex items-center gap-3.5 shadow-sm",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "p-2.5 bg-primary/10 text-primary rounded-xl shrink-0",
										children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(FolderKanban, { className: "size-5" })
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex flex-col",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "text-[10px] text-muted-foreground font-bold uppercase tracking-wider",
											children: "Total Workspaces"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "text-[18px] font-black text-foreground font-mono",
											children: projects.length
										})]
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "bg-card border border-border p-4.5 rounded-2xl flex items-center gap-3.5 shadow-sm",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "p-2.5 bg-blue-500/10 text-blue-500 rounded-xl shrink-0",
										children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Boxes, { className: "size-5" })
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex flex-col",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "text-[10px] text-muted-foreground font-bold uppercase tracking-wider",
											children: "Total Spaces"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "text-[18px] font-black text-foreground font-mono",
											children: totalStats.spaces
										})]
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "bg-card border border-border p-4.5 rounded-2xl flex items-center gap-3.5 shadow-sm",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "p-2.5 bg-purple-500/10 text-purple-500 rounded-xl shrink-0",
										children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LayoutDashboard, { className: "size-5" })
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex flex-col",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "text-[10px] text-muted-foreground font-bold uppercase tracking-wider",
											children: "Total Zones"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "text-[18px] font-black text-foreground font-mono",
											children: totalStats.zones
										})]
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "bg-card border border-border p-4.5 rounded-2xl flex items-center gap-3.5 shadow-sm",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "p-2.5 bg-pink-500/10 text-pink-500 rounded-xl shrink-0",
										children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(User, { className: "size-5" })
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex flex-col",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "text-[10px] text-muted-foreground font-bold uppercase tracking-wider",
											children: "Engineers"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "text-[18px] font-black text-foreground font-mono",
											children: allUsers.length
										})]
									})]
								})
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center justify-between gap-4 mb-5 select-none",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex flex-col gap-0.5",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
									className: "font-extrabold text-foreground/90 uppercase tracking-widest text-[11px]",
									children: "Workspaces List"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "text-[11.5px] text-muted-foreground font-medium",
									children: "Select a project to load it into the active calculator"
								})]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "relative shrink-0",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Search, { className: "absolute left-3.5 top-3 size-4 text-muted-foreground" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
									value: search,
									onChange: (e) => setSearch(e.target.value),
									placeholder: "Search workspaces...",
									className: "h-10 w-60 pl-10 pr-4 bg-card border border-border/80 focus:border-primary/80 focus:ring-1 focus:ring-primary/20 rounded-2xl text-[12.5px] outline-none transition-all duration-150 font-sans shadow-xs text-foreground"
								})]
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "grid grid-cols-1 md:grid-cols-2 gap-6 max-w-7xl",
							children: filteredProjects.map((p) => {
								const isActive = p.id === activeProjectId;
								const stats = statsMap[p.id] || {
									spaces: 0,
									zones: 0,
									equipment: 0
								};
								return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: `border rounded-2xl p-5 flex flex-col justify-between transition-all duration-200 bg-card relative overflow-hidden group shadow-sm hover:shadow-md hover:-translate-y-0.5 ${isActive ? "border-primary ring-1 ring-primary/20 bg-primary/[0.01]" : "border-border hover:border-border-strong"}`,
									children: [
										isActive && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "absolute top-0 left-0 right-0 h-1 bg-primary" }),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex flex-col gap-3.5",
											children: [
												/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
													className: "flex items-center justify-between gap-4 select-none",
													children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
														className: "flex items-center gap-2",
														children: [pinnedProjects.includes(p.id) && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Pin, { className: "size-3.5 fill-primary text-primary" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
															className: "font-mono text-[9px] text-primary bg-primary/5 dark:bg-primary/10 border border-primary/25 px-2 py-0.5 rounded font-bold uppercase tracking-widest",
															children: p.code
														})]
													}), isActive ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
														className: "inline-flex items-center gap-1.5 text-[10px] font-bold text-primary",
														children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CircleCheck, { className: "size-3.5" }), " Active"]
													}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
														className: "text-[10px] text-muted-foreground font-medium",
														children: "Inactive"
													})]
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
													className: "text-[14.5px] font-bold tracking-tight leading-snug group-hover:text-primary transition-colors text-foreground",
													children: p.name
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
													className: "mt-2 flex flex-col gap-1.5 text-[11.5px] text-muted-foreground font-semibold",
													children: [
														(() => {
															const creatorName = allUsers.find((u) => u.id === p.created_by)?.name || p.creator_name || (p.created_by === profile?.id ? profile?.name || "You" : "Admin");
															return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
																className: "flex items-center gap-2",
																children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(User, { className: "size-3.5 text-amber-500 dark:text-amber-400 shrink-0" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: ["Created by: ", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", {
																	className: "text-foreground font-bold",
																	children: creatorName
																})] })]
															});
														})(),
														/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
															className: "flex items-center gap-2",
															children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(User, { className: "size-3.5 text-slate-400 dark:text-zinc-500 shrink-0" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: ["Client: ", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", {
																className: "text-foreground/80 font-bold",
																children: p.client
															})] })]
														}),
														p.location && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
															className: "flex items-center gap-2",
															children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MapPin, { className: "size-3.5 text-slate-400 dark:text-zinc-500 shrink-0" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: p.location })]
														}),
														/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
															className: "flex items-center gap-2",
															children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Calendar, { className: "size-3.5 text-slate-400 dark:text-zinc-500 shrink-0" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: ["Modified: ", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
																className: "text-foreground/75 font-mono",
																children: formatRelativeTime(p.updated_at || p.last_modified || p.lastModified || p.created_at || p.createdDate)
															})] })]
														})
													]
												})] }),
												p.description && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
													className: "text-[11.5px] text-muted-foreground leading-relaxed font-normal bg-slate-50/50 dark:bg-zinc-800/10 p-3.5 rounded-[18px] border border-border/40 line-clamp-2",
													children: p.description
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
													className: "grid grid-cols-3 gap-2.5 pt-1 select-none",
													children: [
														/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
															className: "flex flex-col items-center justify-center py-2.5 px-2 rounded-xl bg-surface-2 border border-border/40 text-center gap-0.5",
															children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
																className: "text-[12px] font-bold text-foreground font-mono",
																children: stats.spaces
															}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
																className: "text-[8.5px] text-muted-foreground font-bold uppercase tracking-wider",
																children: "Spaces"
															})]
														}),
														/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
															className: "flex flex-col items-center justify-center py-2.5 px-2 rounded-xl bg-surface-2 border border-border/40 text-center gap-0.5",
															children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
																className: "text-[12px] font-bold text-foreground font-mono",
																children: stats.zones
															}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
																className: "text-[8.5px] text-muted-foreground font-bold uppercase tracking-wider",
																children: "Zones"
															})]
														}),
														/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
															className: "flex flex-col items-center justify-center py-2.5 px-2 rounded-xl bg-surface-2 border border-border/40 text-center gap-0.5",
															children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
																className: "text-[12px] font-bold text-foreground font-mono",
																children: stats.equipment
															}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
																className: "text-[8.5px] text-muted-foreground font-bold uppercase tracking-wider",
																children: "Equip"
															})]
														})
													]
												}),
												(p.project_users?.length > 0 || p.project_teams?.length > 0) && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
													className: "flex flex-wrap gap-1.5 pt-2 border-t border-border/50",
													children: [p.project_teams?.map((pt) => {
														const teamName = allTeams.find((t) => String(t.id) === String(pt.team_id) || String(t.id) === String(pt.id))?.name || pt.teams?.name || pt.team_name || pt.name || "Team";
														return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
															className: "inline-flex items-center gap-1 bg-primary/10 text-primary px-2 py-0.5 rounded-md text-[10px] font-semibold border border-primary/20",
															children: [
																/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Users, { className: "size-3" }),
																" ",
																teamName,
																(profile?.role === "SUPER_ADMIN" || profile?.role === "ORG_ADMIN" || p.created_by === profile?.id) && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
																	onClick: () => handleRemoveTeamFromProject(p.id, pt.team_id),
																	className: "hover:bg-primary/20 rounded-full p-0.5 cursor-pointer ml-1",
																	children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: "size-2.5" })
																})
															]
														}, `t-${pt.team_id || pt.id}`);
													}), p.project_users?.map((pu) => {
														const user = allUsers.find((u) => u.id === pu.user_id);
														return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
															className: "inline-flex items-center gap-1 bg-slate-100 dark:bg-zinc-800 text-foreground px-2 py-0.5 rounded-md text-[10px] font-semibold border border-border",
															children: [
																/* @__PURE__ */ (0, import_jsx_runtime.jsx)(User, { className: "size-3 text-muted-foreground" }),
																" ",
																user?.name || "User",
																(profile?.role === "SUPER_ADMIN" || profile?.role === "ORG_ADMIN" || p.created_by === profile?.id) && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
																	onClick: () => handleRemoveUserFromProject(p.id, pu.user_id),
																	className: "hover:bg-slate-200 dark:hover:bg-zinc-700 rounded-full p-0.5 cursor-pointer ml-1",
																	children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: "size-2.5" })
																})
															]
														}, `u-${pu.user_id}`);
													})]
												})
											]
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "mt-5 pt-3.5 border-t border-border/50 flex items-center justify-end gap-1.5",
											children: [
												!isActive ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
													onClick: () => handleSelectProject(p.id),
													className: "flex-1 h-8.5 rounded-lg bg-primary text-primary-foreground font-bold hover:bg-primary/95 flex items-center justify-center gap-1.5 transition-all cursor-pointer text-[11.5px] shadow-sm shadow-primary/5",
													title: "Open Project",
													children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Play, { className: "size-3 fill-current" }), " Open Workspace"]
												}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													className: "flex-1 text-[11px] text-muted-foreground font-bold italic select-none pl-1",
													children: "Currently editing"
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
													onClick: () => togglePin(p.id),
													className: `size-8.5 rounded-lg border flex items-center justify-center transition-all cursor-pointer ${pinnedProjects.includes(p.id) ? "bg-primary/10 border-primary/30 text-primary hover:bg-primary/20" : "border-border bg-background text-muted-foreground hover:text-foreground hover:bg-surface-2"}`,
													title: pinnedProjects.includes(p.id) ? "Unpin Workspace" : "Pin Workspace",
													children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Pin, { className: "size-3.5" })
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
													onClick: () => duplicateProject(p.id),
													className: "size-8.5 rounded-lg border border-border bg-background text-muted-foreground hover:text-foreground hover:bg-surface-2 flex items-center justify-center transition-all cursor-pointer",
													title: "Duplicate",
													children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Copy, { className: "size-3.5" })
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
													onClick: () => setEditingProj(p),
													className: "size-8.5 rounded-lg border border-border bg-background text-muted-foreground hover:text-foreground hover:bg-surface-2 flex items-center justify-center transition-all cursor-pointer",
													title: "Edit Details",
													children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PenLine, { className: "size-3.5" })
												}),
												(p.created_by === profile?.id || profile?.role === "SUPER_ADMIN") && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
													onClick: () => setDeleteConfirmId(p.id),
													className: "size-8.5 rounded-lg border border-border bg-background text-muted-foreground hover:text-destructive hover:bg-destructive/5 flex items-center justify-center transition-all cursor-pointer",
													title: "Delete Workspace",
													children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Trash2, { className: "size-3.5" })
												})
											]
										})
									]
								}, p.id);
							})
						}),
						filteredProjects.length === 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "text-center py-16 bg-card border border-dashed border-border rounded-[28px] p-8 max-w-md mx-auto mt-8 flex flex-col items-center gap-4",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FolderKanban, { className: "size-12 text-muted-foreground" }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "text-[14px] font-bold text-foreground",
									children: "No workspaces found"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "text-[12px] text-muted-foreground mt-1",
									children: "Try refining your search term or create a new workspace."
								})] }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									onClick: openCreateModal,
									className: "px-5 py-2.5 bg-primary text-primary-foreground font-bold rounded-2xl hover:bg-primary/95 text-[12.5px] transition-all cursor-pointer shadow-sm shadow-primary/10",
									children: "Create a workspace"
								})
							]
						})
					]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "w-full lg:w-[360px] border-t lg:border-t-0 lg:border-l border-border flex flex-col min-h-0 bg-surface-1 p-6 overflow-y-auto custom-scrollbar select-none",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex flex-col gap-6",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex flex-col gap-3",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
									className: "text-[11px] font-extrabold text-muted-foreground uppercase tracking-wider",
									children: "Quick Actions"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex flex-col gap-2",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
										onClick: openCreateModal,
										className: "w-full bg-gradient-to-r from-primary to-accent hover:brightness-105 text-white font-bold h-10 rounded-xl transition-all shadow-md shadow-primary/10 flex items-center justify-center gap-1.5 cursor-pointer text-[12px]",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, { className: "size-4" }), " Create New Workspace"]
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
										onClick: () => handleSelectProject(activeProject.id),
										className: "w-full bg-card border border-border text-foreground hover:bg-surface-2 font-bold h-10 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer text-[12px]",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Play, { className: "size-3.5 fill-current text-primary" }), " Continue Active Work"]
									})]
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex flex-col gap-3",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
									className: "text-[11px] font-extrabold text-muted-foreground uppercase tracking-wider",
									children: "Recently Opened"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "flex flex-col gap-2.5",
									children: [...projects].sort((a, b) => (workspaceHistory[b.id] || new Date(b.updated_at || b.created_at || 0).getTime()) - (workspaceHistory[a.id] || new Date(a.updated_at || a.created_at || 0).getTime())).slice(0, 3).map((p) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										onClick: () => handleSelectProject(p.id),
										className: "flex items-center justify-between p-3 bg-card border border-border rounded-xl hover:bg-surface-2 transition-all cursor-pointer group",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex items-center gap-2.5 min-w-0",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
												className: "p-2 bg-primary/5 text-primary rounded-lg shrink-0",
												children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Building2, { className: "size-4" })
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "flex flex-col min-w-0",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													className: "text-[12.5px] font-bold text-foreground truncate group-hover:text-primary transition-colors",
													children: p.name
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													className: "text-[10px] text-muted-foreground font-mono",
													children: p.code
												})]
											})]
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronRight, { className: "size-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0" })]
									}, p.id))
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex flex-col gap-3",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
									className: "text-[11px] font-extrabold text-muted-foreground uppercase tracking-wider",
									children: "Recent Workspace Activity"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "flex flex-col gap-3",
									children: globalActivity.length > 0 ? globalActivity.map((act) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex gap-2.5 text-[12px] leading-relaxed",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: `size-2 rounded-full ${act.color || "bg-blue-500"} mt-1.5 shrink-0` }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex flex-col",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
												className: "font-semibold text-foreground",
												children: act.action
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
												className: "text-[10px] text-slate-400 dark:text-zinc-500",
												children: [
													act.detail,
													" · ",
													Math.max(1, Math.floor((Date.now() - act.time) / 6e4)),
													"m ago"
												]
											})]
										})]
									}, act.id)) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex gap-2.5 text-[12px] leading-relaxed",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "size-2 rounded-full bg-slate-300 dark:bg-zinc-700 mt-1.5 shrink-0" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex flex-col",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
												className: "font-semibold text-muted-foreground",
												children: "No recent activity"
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
												className: "text-[10px] text-slate-400 dark:text-zinc-600",
												children: "Open a workspace or calculator to track"
											})]
										})]
									})
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex flex-col gap-2.5 p-4 bg-primary/[0.03] border border-primary/10 rounded-2xl select-none",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex items-center gap-2 text-primary",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CircleQuestionMark, { className: "size-4" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "font-bold text-[11px] uppercase tracking-wider font-sans",
										children: "Quick Tip"
									})]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "text-[11.5px] text-muted-foreground leading-relaxed font-sans",
									children: "Right-click on any project card or the header project dropdown to Rename, Duplicate, or Delete immediately without navigating away."
								})]
							})
						]
					})
				})]
			}),
			isCreateOpen && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "bg-background border border-border/80 rounded-[28px] shadow-2xl w-full max-w-lg flex flex-col overflow-hidden animate-scale-in text-xs",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
						className: "px-6 py-5 border-b border-border/50 flex items-center justify-between shrink-0 select-none bg-card/60 backdrop-blur-xs",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center gap-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "p-2 bg-primary/10 text-primary rounded-xl",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, { className: "size-4.5" })
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
								className: "font-bold text-[16.5px] text-foreground tracking-tight font-sans",
								children: "Create Workspace"
							})]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							onClick: () => setIsCreateOpen(false),
							className: "size-8.5 rounded-full hover:bg-surface-3 flex items-center justify-center text-muted-foreground hover:text-foreground cursor-pointer transition-all duration-150",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: "size-4.5" })
						})]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
						onSubmit: (e) => {
							handleCreate(e);
							setIsCreateOpen(false);
						},
						className: "flex-1 flex flex-col justify-between",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "p-6 flex flex-col gap-4 font-sans max-h-[60vh] overflow-y-auto custom-scrollbar",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex flex-col gap-1.5",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
										className: "text-muted-foreground font-extrabold text-[9px] uppercase tracking-widest select-none font-sans",
										children: "Project Name *"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "relative focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary rounded-2xl transition-all",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Building2, { className: "absolute left-3.5 top-3.5 size-4.5 text-muted-foreground/80 pointer-events-none" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
											type: "text",
											required: true,
											value: newProject.name,
											onChange: (e) => setNewProject({
												...newProject,
												name: e.target.value.replace(/[0-9]/g, "")
											}),
											placeholder: "e.g. Dubai Mall Expansion",
											className: "w-full bg-slate-50/50 dark:bg-zinc-950/20 border border-border/70 rounded-2xl pl-11 pr-4 py-3 text-[12.5px] text-foreground font-sans outline-none focus:outline-none transition-all"
										})]
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "grid grid-cols-2 gap-4",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex flex-col gap-1.5",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
											className: "text-muted-foreground font-extrabold text-[9px] uppercase tracking-widest select-none",
											children: "Project Code *"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "relative focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary rounded-2xl transition-all",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FileCode, { className: "absolute left-3.5 top-3.5 size-4.5 text-muted-foreground/80 pointer-events-none" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
												type: "text",
												required: true,
												value: newProject.code,
												onChange: (e) => setNewProject({
													...newProject,
													code: e.target.value
												}),
												placeholder: "e.g. DMX-2026",
												className: "w-full bg-slate-50/50 dark:bg-zinc-950/20 border border-border/70 rounded-2xl pl-11 pr-4 py-3 text-[12.5px] text-foreground font-mono uppercase tracking-wider outline-none focus:outline-none transition-all"
											})]
										})]
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex flex-col gap-1.5",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
											className: "text-muted-foreground font-extrabold text-[9px] uppercase tracking-widest select-none font-sans",
											children: "Client Name"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "relative focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary rounded-2xl transition-all",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(User, { className: "absolute left-3.5 top-3.5 size-4.5 text-muted-foreground/80 pointer-events-none" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
												type: "text",
												value: newProject.client,
												onChange: (e) => setNewProject({
													...newProject,
													client: e.target.value
												}),
												placeholder: "e.g. Emaar",
												className: "w-full bg-slate-50/50 dark:bg-zinc-950/20 border border-border/70 rounded-2xl pl-11 pr-4 py-3 text-[12.5px] text-foreground font-sans outline-none focus:outline-none transition-all"
											})]
										})]
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex flex-col gap-1.5",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
										className: "text-muted-foreground font-extrabold text-[9px] uppercase tracking-widest select-none font-sans",
										children: "Location"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "relative focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary rounded-2xl transition-all",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MapPin, { className: "absolute left-3.5 top-3.5 size-4.5 text-muted-foreground/80 pointer-events-none" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
											type: "text",
											value: newProject.location,
											onChange: (e) => setNewProject({
												...newProject,
												location: e.target.value
											}),
											placeholder: "e.g. Dubai, UAE",
											className: "w-full bg-slate-50/50 dark:bg-zinc-950/20 border border-border/70 rounded-2xl pl-11 pr-4 py-3 text-[12.5px] text-foreground font-sans outline-none focus:outline-none transition-all"
										})]
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex flex-col gap-1.5",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
										className: "text-muted-foreground font-extrabold text-[9px] uppercase tracking-widest select-none font-sans",
										children: "Description"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "relative focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary rounded-2xl transition-all",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FileText, { className: "absolute left-3.5 top-3.5 size-4.5 text-muted-foreground/80 pointer-events-none" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
											type: "text",
											value: newProject.description,
											onChange: (e) => setNewProject({
												...newProject,
												description: e.target.value
											}),
											placeholder: "Brief scope summary...",
											className: "w-full bg-slate-50/50 dark:bg-zinc-950/20 border border-border/70 rounded-2xl pl-11 pr-4 py-3 text-[12.5px] text-foreground font-sans outline-none focus:outline-none transition-all"
										})]
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex flex-col gap-1.5",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
										className: "text-muted-foreground font-extrabold text-[9px] uppercase tracking-widest select-none font-sans",
										children: "Design Code & Notes"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "relative focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary rounded-2xl transition-all",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CircleQuestionMark, { className: "absolute left-3.5 top-3.5 size-4.5 text-muted-foreground/80 pointer-events-none" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("textarea", {
											rows: 4,
											value: newProject.notes,
											onChange: (e) => setNewProject({
												...newProject,
												notes: e.target.value
											}),
											placeholder: "e.g. ASHRAE 62.1 Standard, Title 24...",
											className: "w-full bg-slate-50/50 dark:bg-zinc-950/20 border border-border/70 rounded-2xl pl-11 pr-4 py-3 text-[12.5px] text-foreground font-sans resize-none outline-none focus:outline-none transition-all"
										})]
									})]
								}),
								(profile?.role === "SUPER_ADMIN" || profile?.role === "ORG_ADMIN") && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex flex-col gap-4 mt-2 p-4 bg-primary/5 rounded-2xl border border-primary/10",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex flex-col gap-1.5",
										children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
												className: "text-primary font-extrabold text-[9px] uppercase tracking-widest select-none font-sans",
												children: "Assign Users to Project"
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("select", {
												multiple: true,
												value: newProject.assigned_users,
												onChange: (e) => {
													const vals = Array.from(e.target.selectedOptions, (option) => option.value);
													setNewProject({
														...newProject,
														assigned_users: vals
													});
												},
												className: "w-full bg-background border border-border/70 rounded-xl px-3 py-2 text-[12px] h-24 custom-scrollbar outline-none focus:border-primary",
												children: allUsers.map((u) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
													value: u.id,
													children: u.name
												}, u.id))
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
												className: "text-[9px] text-muted-foreground",
												children: "Hold Ctrl/Cmd to select multiple"
											})
										]
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex flex-col gap-1.5",
										children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
												className: "text-primary font-extrabold text-[9px] uppercase tracking-widest select-none font-sans",
												children: "Assign Teams to Project"
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("select", {
												multiple: true,
												value: newProject.assigned_teams,
												onChange: (e) => {
													const vals = Array.from(e.target.selectedOptions, (option) => option.value);
													setNewProject({
														...newProject,
														assigned_teams: vals
													});
												},
												className: "w-full bg-background border border-border/70 rounded-xl px-3 py-2 text-[12px] h-24 custom-scrollbar outline-none focus:border-primary",
												children: allTeams.map((t) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
													value: t.id,
													children: t.name
												}, t.id))
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
												className: "text-[9px] text-muted-foreground",
												children: "Hold Ctrl/Cmd to select multiple"
											})
										]
									})]
								})
							]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("footer", {
							className: "px-6 py-5 border-t border-border/50 flex items-center justify-end gap-3 bg-card/60 backdrop-blur-xs shrink-0",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								onClick: () => setIsCreateOpen(false),
								className: "border border-border/80 text-xs px-5 py-2.5 rounded-2xl hover:bg-surface-2 text-muted-foreground hover:text-foreground font-semibold cursor-pointer transition-all duration-150 font-sans",
								children: "Cancel"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "submit",
								className: "bg-primary text-primary-foreground text-xs font-bold px-6 py-2.5 rounded-2xl hover:bg-primary/95 transition-all cursor-pointer shadow-md shadow-primary/10",
								children: "Create Workspace"
							})]
						})]
					})]
				})
			}),
			editingProj && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "bg-background border border-border/80 rounded-[28px] shadow-2xl w-full max-w-md flex flex-col overflow-hidden animate-scale-in text-xs",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
							className: "px-6 py-5 border-b border-border/50 flex items-center justify-between shrink-0 select-none bg-card/60 backdrop-blur-xs",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
								className: "font-bold text-[16px] text-foreground tracking-tight",
								children: "Edit Project Details"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								onClick: () => setEditingProj(null),
								className: "size-8.5 rounded-full hover:bg-surface-3 flex items-center justify-center text-muted-foreground hover:text-foreground cursor-pointer transition-all duration-150",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: "size-4.5" })
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "p-6 flex flex-col gap-4 font-sans",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
									className: "block text-slate-500 dark:text-zinc-400 font-extrabold text-[9px] uppercase tracking-widest mb-1.5 select-none font-sans",
									children: "Project Name"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
									type: "text",
									value: editingProj.name,
									onChange: (e) => setEditingProj({
										...editingProj,
										name: e.target.value.replace(/[0-9]/g, "")
									}),
									className: "w-full bg-background border border-border/70 rounded-2xl px-3.5 py-2.5 outline-none focus:ring-1 focus:ring-primary focus:border-primary text-[12px] text-foreground font-sans transition-all duration-150"
								})] }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
									className: "block text-slate-500 dark:text-zinc-400 font-extrabold text-[9px] uppercase tracking-widest mb-1.5 select-none",
									children: "Project Code"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
									type: "text",
									value: editingProj.code,
									onChange: (e) => setEditingProj({
										...editingProj,
										code: e.target.value.toUpperCase()
									}),
									className: "w-full bg-background border border-border/70 rounded-2xl px-3.5 py-2.5 outline-none focus:ring-1 focus:ring-primary focus:border-primary text-[12px] text-foreground font-mono uppercase tracking-wider transition-all duration-150"
								})] }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
									className: "block text-slate-500 dark:text-zinc-400 font-extrabold text-[9px] uppercase tracking-widest mb-1.5 select-none font-sans",
									children: "Client Name"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
									type: "text",
									value: editingProj.client,
									onChange: (e) => setEditingProj({
										...editingProj,
										client: e.target.value
									}),
									className: "w-full bg-background border border-border/70 rounded-2xl px-3.5 py-2.5 outline-none focus:ring-1 focus:ring-primary focus:border-primary text-[12px] text-foreground font-sans transition-all duration-150"
								})] }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
									className: "block text-slate-500 dark:text-zinc-400 font-extrabold text-[9px] uppercase tracking-widest mb-1.5 select-none font-sans",
									children: "Location"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
									type: "text",
									value: editingProj.location || "",
									onChange: (e) => setEditingProj({
										...editingProj,
										location: e.target.value
									}),
									className: "w-full bg-background border border-border/70 rounded-2xl px-3.5 py-2.5 outline-none focus:ring-1 focus:ring-primary focus:border-primary text-[12px] text-foreground font-sans transition-all duration-150"
								})] }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
									className: "block text-slate-500 dark:text-zinc-400 font-extrabold text-[9px] uppercase tracking-widest mb-1.5 select-none font-sans",
									children: "Add Team"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
									onChange: (e) => {
										handleAddTeamToProject(editingProj.id, e.target.value);
										e.target.value = "";
									},
									className: "w-full bg-background border border-border/70 rounded-2xl px-3.5 py-2.5 outline-none focus:ring-1 focus:ring-primary focus:border-primary text-[12px] text-foreground font-sans transition-all duration-150",
									defaultValue: "",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
										value: "",
										disabled: true,
										children: "Select Team to add..."
									}), allTeams.filter((t) => !editingProj.project_teams?.some((pt) => pt.team_id === t.id)).map((t) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
										value: t.id,
										children: t.name
									}, t.id))]
								})] }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
										className: "block text-slate-500 dark:text-zinc-400 font-extrabold text-[9px] uppercase tracking-widest mb-1.5 select-none font-sans",
										children: "Add Engineer/User"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
										onChange: (e) => {
											handleAddUserToProject(editingProj.id, e.target.value);
											e.target.value = "";
										},
										className: "w-full bg-background border border-border/70 rounded-2xl px-3.5 py-2.5 outline-none focus:ring-1 focus:ring-primary focus:border-primary text-[12px] text-foreground font-sans transition-all duration-150 mb-2",
										defaultValue: "",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
											value: "",
											disabled: true,
											children: "Select User to add..."
										}), allUsers.filter((u) => !editingProj.project_users?.some((pu) => pu.user_id === u.id)).map((u) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
											value: u.id,
											children: u.name
										}, u.id))]
									}),
									(editingProj.project_users?.length > 0 || editingProj.project_teams?.length > 0) && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex flex-wrap gap-1.5 pt-2 border-t border-border/50 mt-2",
										children: [editingProj.project_teams?.map((pt) => {
											const teamName = allTeams.find((t) => String(t.id) === String(pt.team_id) || String(t.id) === String(pt.id))?.name || pt.teams?.name || pt.team_name || pt.name || "Team";
											return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
												className: "inline-flex items-center gap-1 bg-primary/10 text-primary px-2 py-0.5 rounded-md text-[10px] font-semibold border border-primary/20",
												children: [
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Users, { className: "size-3" }),
													" ",
													teamName,
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
														onClick: () => handleRemoveTeamFromProject(editingProj.id, pt.team_id),
														className: "hover:bg-primary/20 rounded-full p-0.5 cursor-pointer ml-1",
														children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: "size-2.5" })
													})
												]
											}, `t-${pt.team_id || pt.id}`);
										}), editingProj.project_users?.map((pu) => {
											const user = allUsers.find((u) => u.id === pu.user_id);
											return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
												className: "inline-flex items-center gap-1 bg-slate-100 dark:bg-zinc-800 text-foreground px-2 py-0.5 rounded-md text-[10px] font-semibold border border-border",
												children: [
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)(User, { className: "size-3 text-muted-foreground" }),
													" ",
													user?.name || "User",
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
														onClick: () => handleRemoveUserFromProject(editingProj.id, pu.user_id),
														className: "hover:bg-slate-200 dark:hover:bg-zinc-700 rounded-full p-0.5 cursor-pointer ml-1",
														children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: "size-2.5" })
													})
												]
											}, `u-${pu.user_id}`);
										})]
									})
								] })
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("footer", {
							className: "px-6 py-5 border-t border-border/50 flex items-center justify-end gap-3 bg-card/60 backdrop-blur-xs",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								onClick: () => setEditingProj(null),
								className: "border border-border/80 text-xs px-5 py-2.5 rounded-2xl hover:bg-surface-2 text-muted-foreground hover:text-foreground font-semibold cursor-pointer transition-all duration-150",
								children: "Cancel"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								onClick: handleSaveEdit,
								className: "bg-primary text-primary-foreground text-xs font-bold px-6 py-2.5 rounded-2xl hover:bg-primary/95 transition-all cursor-pointer shadow-md shadow-primary/10",
								children: "Save Details"
							})]
						})
					]
				})
			}),
			deleteConfirmId && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "bg-background border border-border/80 rounded-[28px] shadow-2xl w-full max-w-md flex flex-col overflow-hidden animate-scale-in text-xs",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
							className: "px-6 py-5 border-b border-border/50 flex items-center justify-between bg-destructive/[0.03] backdrop-blur-xs",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
								className: "font-bold text-[16px] text-destructive tracking-tight font-sans",
								children: "Delete Workspace?"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								onClick: () => setDeleteConfirmId(null),
								className: "size-8.5 rounded-full hover:bg-destructive/10 flex items-center justify-center text-muted-foreground hover:text-destructive cursor-pointer transition-all duration-150",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: "size-4.5" })
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "p-6 flex gap-4 text-[12px] leading-relaxed font-sans",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "size-11 rounded-2xl bg-destructive/10 text-destructive flex items-center justify-center shrink-0",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TriangleAlert, { className: "size-5.5" })
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex flex-col gap-2",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "font-bold text-foreground text-[13px]",
									children: "Are you sure you want to delete this workspace?"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "text-slate-500 dark:text-zinc-400 text-[11.5px] font-semibold leading-relaxed",
									children: "This will permanently clear all project metadata, spaces list, zones mapping, and equipment scheduling from local storage. This action cannot be undone."
								})]
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("footer", {
							className: "px-6 py-5 border-t border-border/50 flex items-center justify-end gap-3 bg-card/60 backdrop-blur-xs",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								onClick: () => setDeleteConfirmId(null),
								className: "border border-border/80 text-xs px-5 py-2.5 rounded-2xl hover:bg-surface-2 text-muted-foreground hover:text-foreground font-semibold cursor-pointer transition-all duration-150",
								children: "Cancel"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								onClick: async () => {
									const targetId = deleteConfirmId;
									setDeleteConfirmId(null);
									if (targetId) {
										const res = await deleteProject(targetId);
										if (res && res.success === false) toast.error(res.message || "Failed to delete project");
										else toast.success("Workspace deleted successfully!");
									}
								},
								className: "bg-destructive text-destructive-foreground text-xs font-bold px-6 py-2.5 rounded-2xl hover:bg-destructive/95 transition-all cursor-pointer shadow-md shadow-destructive/15",
								children: "Confirm Delete"
							})]
						})
					]
				})
			})
		]
	});
}
//#endregion
export { ProjectsPage as component };
