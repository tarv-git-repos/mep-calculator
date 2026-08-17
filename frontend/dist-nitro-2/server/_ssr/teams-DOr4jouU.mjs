import { o as __toESM } from "../_runtime.mjs";
import { n as api } from "./api-BcQvT-mW.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { j as require_jsx_runtime } from "../_libs/@radix-ui/react-alert-dialog+[...].mjs";
import { N as Plus, a as Users, m as Trash2, x as ShieldAlert } from "../_libs/lucide-react.mjs";
import { i as useAuth } from "./AuthContext-CY5Koh3s.mjs";
import { t as AppShell } from "./AppShell-urg-0zDa.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/teams-DOr4jouU.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function TeamsPage() {
	const { profile } = useAuth();
	const isAdmin = ["SUPER_ADMIN", "ORG_ADMIN"].includes(profile?.role || "");
	const [teams, setTeams] = (0, import_react.useState)([]);
	const [users, setUsers] = (0, import_react.useState)([]);
	const [newTeamName, setNewTeamName] = (0, import_react.useState)("");
	const [selectedUser, setSelectedUser] = (0, import_react.useState)("");
	const [selectedTeam, setSelectedTeam] = (0, import_react.useState)("");
	const [isLoading, setIsLoading] = (0, import_react.useState)(true);
	const loadData = async () => {
		if (profile?.role === "SUPER_ADMIN" || profile?.role === "ORG_ADMIN") {
			setIsLoading(true);
			try {
				const [u, t] = await Promise.all([api.getUsers(), api.getTeams()]);
				setUsers(u);
				setTeams(t);
			} finally {
				setIsLoading(false);
			}
		} else setIsLoading(false);
	};
	(0, import_react.useEffect)(() => {
		loadData();
	}, [profile]);
	if (profile?.role !== "SUPER_ADMIN" && profile?.role !== "ORG_ADMIN") return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AppShell, {
		title: "Teams",
		subtitle: "Manage Organization Teams",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "flex h-[calc(100vh-80px)] items-center justify-center bg-background",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex flex-col items-center gap-3",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ShieldAlert, { className: "size-16 text-rose-500/80" }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
						className: "text-xl font-bold",
						children: "Access Denied"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-sm text-muted-foreground",
						children: "Only Administrators can manage teams."
					})
				]
			})
		})
	});
	const handleCreateTeam = async (e) => {
		e.preventDefault();
		if (!newTeamName.trim()) return;
		const res = await api.createTeam(newTeamName);
		if (res.success) {
			setNewTeamName("");
			loadData();
		} else alert(res.message);
	};
	const handleAddUser = async (e) => {
		e.preventDefault();
		if (!selectedTeam || !selectedUser) return;
		const res = await api.addUserToTeam(selectedTeam, selectedUser);
		if (res.success) {
			setSelectedTeam("");
			setSelectedUser("");
			loadData();
		} else alert(res.message);
	};
	const handleRemoveUser = async (teamId, userId) => {
		if (!confirm("Are you sure you want to remove this user from the team?")) return;
		const res = await api.removeUserFromTeam(teamId, userId);
		if (res.success) loadData();
		else alert(res.message);
	};
	const handleDeleteTeam = async (teamId) => {
		if (!confirm("Are you sure you want to completely delete this team? This action cannot be undone.")) return;
		const res = await api.deleteTeam(teamId);
		if (res.success) loadData();
		else alert(res.message);
	};
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AppShell, {
		title: "Teams",
		subtitle: "Manage Organization Teams",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "flex flex-col h-[calc(100vh-80px)] overflow-hidden bg-slate-50/50 dark:bg-zinc-950/20 p-6 md:p-8 custom-scrollbar",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "grid grid-cols-1 lg:grid-cols-3 gap-6 max-w-6xl mx-auto w-full",
				children: [isAdmin && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "lg:col-span-1 flex flex-col gap-6",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "bg-card border border-border p-5 rounded-2xl shadow-sm",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h3", {
							className: "font-bold text-foreground flex items-center gap-2 mb-4",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Users, { className: "size-4 text-primary" }), " Create New Team"]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
							onSubmit: handleCreateTeam,
							className: "flex flex-col gap-3",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
								type: "text",
								placeholder: "e.g. HVAC Alpha",
								value: newTeamName,
								onChange: (e) => setNewTeamName(e.target.value),
								className: "w-full bg-slate-50/50 dark:bg-zinc-950/20 border border-border/70 rounded-xl px-3.5 py-2.5 text-xs outline-none focus:border-primary"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "submit",
								className: "w-full bg-primary text-primary-foreground font-bold text-xs py-2.5 rounded-xl hover:bg-primary/95 transition-all",
								children: "Create Team"
							})]
						})]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "bg-card border border-border p-5 rounded-2xl shadow-sm",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h3", {
							className: "font-bold text-foreground flex items-center gap-2 mb-4",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, { className: "size-4 text-emerald-500" }), " Assign User to Team"]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
							onSubmit: handleAddUser,
							className: "flex flex-col gap-3",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
									value: selectedTeam,
									onChange: (e) => setSelectedTeam(e.target.value),
									className: "w-full bg-slate-50/50 dark:bg-zinc-950/20 border border-border/70 rounded-xl px-3.5 py-2.5 text-xs outline-none focus:border-primary",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
										value: "",
										children: "Select Team..."
									}), teams.map((t) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
										value: t.id,
										children: t.name
									}, t.id))]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
									value: selectedUser,
									onChange: (e) => setSelectedUser(e.target.value),
									className: "w-full bg-slate-50/50 dark:bg-zinc-950/20 border border-border/70 rounded-xl px-3.5 py-2.5 text-xs outline-none focus:border-primary",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
										value: "",
										children: "Select User..."
									}), users.map((u) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
										value: u.id,
										children: u.name
									}, u.id))]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									type: "submit",
									className: "w-full bg-emerald-500 text-white font-bold text-xs py-2.5 rounded-xl hover:bg-emerald-600 transition-all",
									children: "Assign User"
								})
							]
						})]
					})]
				}), "            "] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "lg:col-span-2 flex flex-col gap-4",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
						className: "font-bold text-foreground text-lg mb-2",
						children: "Organization Teams"
					}), isLoading ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "p-8 flex flex-col items-center justify-center text-muted-foreground text-sm gap-3",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "size-6 border-2 border-primary border-t-transparent rounded-full animate-spin" }), "Loading teams..."]
					}) : teams.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "p-8 text-center bg-card border border-border border-dashed rounded-2xl text-muted-foreground text-sm",
						children: "No teams created yet."
					}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "grid grid-cols-1 md:grid-cols-2 gap-4",
						children: teams.map((team) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "bg-card border border-border p-5 rounded-2xl shadow-sm flex flex-col gap-4 group/team",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex justify-between items-center",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h4", {
									className: "font-bold text-foreground",
									children: team.name
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex items-center gap-2",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
										className: "text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-bold",
										children: [team.team_members?.length || 0, " Members"]
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
										onClick: () => handleDeleteTeam(team.id),
										className: "opacity-0 group-hover/team:opacity-100 p-1.5 hover:bg-rose-500/10 text-rose-500 rounded-lg transition-all",
										title: "Delete Team",
										children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Trash2, { className: "size-4" })
									})]
								})]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex flex-col gap-2 border-t border-border/50 pt-3 mt-1",
								children: [team.team_members?.map((tm) => {
									const user = users.find((u) => u.id === tm.user_id);
									if (!user) return null;
									return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex items-center gap-2 text-xs group",
										children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
												className: "size-6 bg-slate-200 dark:bg-zinc-800 rounded-full flex items-center justify-center shrink-0",
												children: user.name.charAt(0).toUpperCase()
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "flex flex-col flex-1",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													className: "font-bold text-foreground leading-none",
													children: user.name
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													className: "text-[9px] text-muted-foreground",
													children: user.email
												})]
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
												onClick: () => handleRemoveUser(team.id, user.id),
												className: "text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-rose-500 transition-all p-1",
												title: "Remove User",
												children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Trash2, { className: "size-3" })
											})
										]
									}, user.id);
								}), (!team.team_members || team.team_members.length === 0) && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "text-xs text-muted-foreground italic",
									children: "No members assigned."
								})]
							})]
						}, team.id))
					})]
				})]
			})
		})
	});
}
//#endregion
export { TeamsPage as component };
