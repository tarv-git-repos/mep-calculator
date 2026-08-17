import { o as __toESM } from "../_runtime.mjs";
import { n as api } from "./api-BcQvT-mW.mjs";
import { t as createClient } from "../_libs/supabase__supabase-js.mjs";
import { t as supabase } from "./supabase-CCCDNKe9.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { j as require_jsx_runtime } from "../_libs/@radix-ui/react-alert-dialog+[...].mjs";
import { B as Megaphone, Bt as ArrowLeft, Ct as Clock, E as Save, Gt as PenLine, Ht as Activity, Jt as LoaderCircle, N as Plus, Nt as Building, Q as HardDrive, T as Search, U as LogOut, Z as History, Zt as Funnel, a as Users, at as FolderOpen, b as ShieldCheck, c as UserCheck, ft as Eye, in as CircleCheck, kt as Check, lt as FileText, m as Trash2, q as Key, s as UserPlus, vt as Crown, x as ShieldAlert, xt as Copy } from "../_libs/lucide-react.mjs";
import { i as useConfirm } from "./use-confirm-BT3fngjN.mjs";
import { n as toast } from "../_libs/sonner.mjs";
import { i as useAuth, n as authService } from "./AuthContext-j7AuApR_.mjs";
import { t as NAV } from "./navigation-W62yd3w7.mjs";
import { P as useNavigate, g as Link } from "../_libs/@tanstack/react-router+[...].mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/admin-Bk1JJb8q.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
createClient("https://ttqgrcmesxrnujmhesnk.supabase.co", "sb_publishable_wT2VLfy-bH-r5ZWi3IcWKQ_QEO0yAfI", { auth: {
	persistSession: false,
	autoRefreshToken: false,
	storageKey: "admin-auth-temp-key"
} });
function SuperAdminDashboard() {
	const { session, profile, userData, user } = useAuth();
	const confirm = useConfirm();
	const navigate = useNavigate();
	const [isAdmin, setIsAdmin] = (0, import_react.useState)(false);
	const [checking, setChecking] = (0, import_react.useState)(true);
	const [activeTab, setActiveTab] = (0, import_react.useState)("users");
	const [licensesList, setLicensesList] = (0, import_react.useState)([]);
	const [trialsList, setTrialsList] = (0, import_react.useState)([]);
	const [loadingLicenses, setLoadingLicenses] = (0, import_react.useState)(false);
	const [genTier, setGenTier] = (0, import_react.useState)("PRO");
	const [genDays, setGenDays] = (0, import_react.useState)(365);
	const [genTargetEmail, setGenTargetEmail] = (0, import_react.useState)("");
	const [generatedAdminKey, setGeneratedAdminKey] = (0, import_react.useState)("");
	const [profiles, setProfiles] = (0, import_react.useState)([]);
	const [loadingProfiles, setLoadingProfiles] = (0, import_react.useState)(false);
	const [selectedOrgFilter, setSelectedOrgFilter] = (0, import_react.useState)("ALL");
	const [activityLogs, setActivityLogs] = (0, import_react.useState)([]);
	const [loadingLogs, setLoadingLogs] = (0, import_react.useState)(false);
	const [logCategoryFilter, setLogCategoryFilter] = (0, import_react.useState)("ALL");
	const [logSearchQuery, setLogSearchQuery] = (0, import_react.useState)("");
	const [logOrgFilter, setLogOrgFilter] = (0, import_react.useState)("ALL");
	const [announcements, setAnnouncements] = (0, import_react.useState)([]);
	const [loadingAnnouncements, setLoadingAnnouncements] = (0, import_react.useState)(false);
	const [newAnnouncementMsg, setNewAnnouncementMsg] = (0, import_react.useState)("");
	const [newAnnouncementType, setNewAnnouncementType] = (0, import_react.useState)("info");
	const [showAddUser, setShowAddUser] = (0, import_react.useState)(false);
	const [newEmail, setNewEmail] = (0, import_react.useState)("");
	const [newPassword, setNewPassword] = (0, import_react.useState)("");
	const [isAddingUser, setIsAddingUser] = (0, import_react.useState)(false);
	const [editingPermissionsFor, setEditingPermissionsFor] = (0, import_react.useState)(null);
	const [editingExpiryFor, setEditingExpiryFor] = (0, import_react.useState)(null);
	const [newExpiryDate, setNewExpiryDate] = (0, import_react.useState)("");
	const [localBackupPath, setLocalBackupPath] = (0, import_react.useState)(localStorage.getItem("localBackupPath") || "");
	const [serverBackupPath, setServerBackupPath] = (0, import_react.useState)(localStorage.getItem("serverBackupPath") || "");
	const [versionsPath, setVersionsPath] = (0, import_react.useState)(localStorage.getItem("versionsPath") || "");
	const [organizations, setOrganizations] = (0, import_react.useState)([]);
	const [loadingOrganizations, setLoadingOrganizations] = (0, import_react.useState)(false);
	const [showAddOrg, setShowAddOrg] = (0, import_react.useState)(false);
	const [newOrgName, setNewOrgName] = (0, import_react.useState)("");
	const [newOrgPlan, setNewOrgPlan] = (0, import_react.useState)("PRO");
	const [newOrgUsers, setNewOrgUsers] = (0, import_react.useState)(5);
	const [selectedOrgForManagement, setSelectedOrgForManagement] = (0, import_react.useState)(null);
	const [selectedExistingUserToAdd, setSelectedExistingUserToAdd] = (0, import_react.useState)("");
	const [selectedUserIds, setSelectedUserIds] = (0, import_react.useState)([]);
	const [bulkTargetOrgId, setBulkTargetOrgId] = (0, import_react.useState)("");
	const [userSearchQuery, setUserSearchQuery] = (0, import_react.useState)("");
	const handleBulkAssignToOrg = async (targetOrgId, targetOrgName) => {
		if (selectedUserIds.length === 0) {
			toast.error("Please select at least one user first.");
			return;
		}
		if (!targetOrgId) {
			toast.error("Please select an organization.");
			return;
		}
		const count = selectedUserIds.length;
		const userIdsToAssign = [...selectedUserIds];
		setProfiles((prev) => prev.map((p) => userIdsToAssign.includes(p.id) ? {
			...p,
			organization_id: targetOrgId,
			company: targetOrgName
		} : p));
		if (typeof window !== "undefined") userIdsToAssign.forEach((id) => localStorage.setItem(`mep_user_company_${id}`, targetOrgName));
		setSelectedUserIds([]);
		toast.success(`Successfully assigned ${count} user(s) to ${targetOrgName}!`);
		await Promise.all(userIdsToAssign.map((id) => api.adminUpdateProfile(id, {
			organization_id: targetOrgId,
			company: targetOrgName,
			organization: targetOrgName
		})));
		fetchOrganizations();
	};
	const deleteOrganization = async (orgId, name) => {
		if (!await confirm(`Are you sure you want to delete organization "${name}"?\n\nThis will unassign all members from this organization.`, {
			title: "Delete Organization",
			confirmText: "Delete",
			cancelText: "Cancel"
		})) return;
		const res = await api.deleteOrganization(orgId);
		if (!res.success) toast.error(res.message || "Failed to delete organization");
		else {
			toast.success("Organization deleted successfully");
			if (selectedOrgForManagement?.id === orgId) setSelectedOrgForManagement(null);
			fetchOrganizations();
			fetchProfiles();
		}
	};
	const fetchOrganizations = async () => {
		setLoadingOrganizations(true);
		try {
			const res = await api.getOrganizations();
			setOrganizations(Array.isArray(res) ? res : []);
		} catch (e) {
			setOrganizations([]);
		} finally {
			setLoadingOrganizations(false);
		}
	};
	const handleAddOrg = async (e) => {
		e.preventDefault();
		if (!newOrgName || !newOrgName.trim()) return toast.error("Organization name is required");
		setIsAddingOrg(true);
		try {
			const res = await api.createOrganization({
				name: newOrgName.trim(),
				subscription_plan: newOrgPlan,
				max_users: newOrgUsers
			});
			if (res && res.success) {
				toast.success("Organization created successfully!");
				setShowAddOrg(false);
				setNewOrgName("");
				await fetchOrganizations();
			} else toast.error(res && res.message || "Failed to create organization");
		} catch (err) {
			toast.error("Error creating organization: " + (err?.message || String(err)));
		} finally {
			setIsAddingOrg(false);
		}
	};
	(0, import_react.useEffect)(() => {
		if (!session) {
			navigate({ to: "/login" });
			return;
		}
		const checkAdminStatus = async () => {
			if (profile?.role === "SUPER_ADMIN" || session?.user?.email === "admin@tarv.ai") {
				setIsAdmin(true);
				fetchProfiles();
				fetchOrganizations();
			} else setIsAdmin(false);
			setChecking(false);
		};
		checkAdminStatus();
	}, [
		session,
		profile,
		navigate
	]);
	const [debugInfo, setDebugInfo] = (0, import_react.useState)(null);
	(0, import_react.useEffect)(() => {
		if (!isAdmin && session) api.getUsers().then((users) => {
			setDebugInfo({
				data: (Array.isArray(users) ? users : []).find((u) => u.id === session.user.id),
				error: null,
				userId: session.user.id
			});
		});
	}, [isAdmin, session]);
	const fetchProfiles = async () => {
		setLoadingProfiles(true);
		const users = await api.getUsers();
		setProfiles((Array.isArray(users) ? users : []).map((u) => ({
			id: u.id,
			email: u.email,
			role: u.role || "USER",
			name: u.name,
			subscription_expires: u.subscription_expires || null,
			status: u.isAccountVerified ? "ACTIVE" : "TRIAL",
			features: u.features || {},
			organization_id: u.organization_id
		})));
		setLoadingProfiles(false);
	};
	const fetchActivityLogs = async () => {
		setActivityLogs((await api.getAdminActivityLogs() || []).map((log) => ({
			...log,
			profiles: { email: log.email }
		})).sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()));
		setLoadingLogs(false);
	};
	const fetchAnnouncements = async () => {
		setLoadingAnnouncements(true);
		const data = await api.getAnnouncements();
		if (data) setAnnouncements(data);
		setLoadingAnnouncements(false);
	};
	const fetchAdminLicenses = async () => {
		setLoadingLicenses(true);
		const res = await authService.adminListLicenses();
		if (res && res.success) {
			setLicensesList(res.licenses || []);
			setTrialsList(res.trials || []);
		}
		setLoadingLicenses(false);
	};
	const fetchOrgBackupSettings = async (orgId) => {
		const targetId = orgId || (selectedOrgFilter !== "ALL" && selectedOrgFilter !== "UNASSIGNED" ? selectedOrgFilter : "");
		const res = await api.getOrgBackupSettings(targetId);
		if (res && res.success) {
			setLocalBackupPath(res.local_backup_path || "");
			setServerBackupPath(res.server_backup_path || "");
			setVersionsPath(res.versions_path || "");
		}
	};
	(0, import_react.useEffect)(() => {
		if (activeTab === "activity") {
			fetchActivityLogs();
			const interval = setInterval(fetchActivityLogs, 3e3);
			return () => clearInterval(interval);
		}
		if (activeTab === "broadcasts") fetchAnnouncements();
		if (activeTab === "licenses") fetchAdminLicenses();
		if (activeTab === "organizations") fetchOrganizations();
		if (activeTab === "storage") fetchOrgBackupSettings();
	}, [activeTab]);
	const handleAdminGenerateKey = async (e) => {
		e.preventDefault();
		const res = await authService.adminGenerateLicenseKey(genTier, genDays, genTargetEmail);
		if (res && res.success) {
			setGeneratedAdminKey(res.key);
			toast.success(res.message || "License Key Generated!");
			fetchAdminLicenses();
		} else toast.error(res.message || "Failed to generate key");
	};
	const handleAdminRevokeKey = async (key) => {
		if (!await confirm(`Revoke license key ${key}? User will lose Pro access immediately.`, {
			title: "Revoke License Key",
			confirmText: "Revoke",
			cancelText: "Cancel"
		})) return;
		const res = await authService.adminRevokeLicenseKey(key);
		if (res && res.success) {
			toast.success(res.message || "License Key Revoked");
			fetchAdminLicenses();
		} else toast.error(res.message || "Revocation failed");
	};
	const handleLogout = async () => {
		await supabase.auth.signOut();
		navigate({ to: "/login" });
	};
	const handleCreateAnnouncement = async (e) => {
		e.preventDefault();
		if (!newAnnouncementMsg.trim()) return;
		const res = await api.createAnnouncement(newAnnouncementMsg, true);
		if (!res.success) toast.error(res.message);
		else {
			toast.success("Broadcast created successfully!");
			setNewAnnouncementMsg("");
			fetchAnnouncements();
		}
	};
	const toggleAnnouncement = async (id, currentStatus) => {
		const res = await api.toggleAnnouncement(id, !currentStatus);
		if (!res.success) toast.error(res.message);
		else fetchAnnouncements();
	};
	const deleteAnnouncement = async (id) => {
		if (!await confirm("Delete this broadcast permanently?", {
			title: "Delete Broadcast",
			confirmText: "Delete",
			cancelText: "Cancel"
		})) return;
		const res = await api.deleteAnnouncement(id);
		if (!res.success) toast.error(res.message);
		else fetchAnnouncements();
	};
	const handleRoleChange = async (profileId, newRole) => {
		if (profileId === (userData?.id || profile?.id || session?.user?.id)) {
			toast.error("You cannot change your own role.");
			return;
		}
		setProfiles((prev) => prev.map((p) => p.id === profileId ? {
			...p,
			role: newRole
		} : p));
		toast.success(`Role updated to ${newRole}`);
		await api.adminToggleRole(profileId, newRole);
	};
	const deleteUser = async (profileId, email) => {
		const currentId = userData?.id || profile?.id;
		const currentEmail = userData?.email || profile?.email;
		if (profileId === currentId || email === currentEmail) {
			toast.error("You cannot delete your own account.");
			return;
		}
		if (!await confirm(`Are you sure you want to delete ${email}?\n\nThey will permanently lose access to the application.`, {
			title: "Delete User",
			confirmText: "Delete",
			cancelText: "Cancel"
		})) return;
		const res = await api.adminDeleteUser(profileId);
		if (!res.success) toast.error(res.message);
		else {
			toast.success("User deleted successfully");
			fetchProfiles();
		}
	};
	const [signUpErrorDetails, setSignUpErrorDetails] = (0, import_react.useState)(null);
	const handleAddUser = async (e) => {
		e.preventDefault();
		if (!newEmail || !newPassword) return;
		setSignUpErrorDetails(null);
		setIsAddingUser(true);
		toast.error("User creation via Admin panel temporarily disabled during backend migration");
		setIsAddingUser(false);
	};
	const saveExpiry = async (profileId) => {
		if (!newExpiryDate) return;
		const dateStr = new Date(newExpiryDate).toISOString();
		const res = await api.adminUpdateProfile(profileId, { subscription_expires: dateStr });
		if (!res.success) toast.error("Failed to update expiry: " + res.message);
		else {
			toast.success("Expiry date updated successfully!");
			setEditingExpiryFor(null);
			fetchProfiles();
		}
	};
	const toggleFeature = async (featureKey) => {
		if (!editingPermissionsFor) return;
		const isCurrentlyUnlocked = featureKey === "ventilation" ? editingPermissionsFor.features?.[featureKey] !== false : editingPermissionsFor.features?.[featureKey] === true;
		const updatedFeatures = {
			...editingPermissionsFor.features,
			[featureKey]: !isCurrentlyUnlocked
		};
		setEditingPermissionsFor({
			...editingPermissionsFor,
			features: updatedFeatures
		});
		setProfiles((prevProfiles) => prevProfiles.map((p) => p.id === editingPermissionsFor.id ? {
			...p,
			features: updatedFeatures
		} : p));
		const res = await api.adminUpdateProfile(editingPermissionsFor.id, { features: updatedFeatures });
		if (!res.success) toast.error("Failed to update permission: " + res.message);
	};
	const toggleSection = async (items) => {
		if (!editingPermissionsFor) return;
		const newValue = !items.every((item) => {
			const routeKey = item.to.replace("/", "");
			return routeKey === "ventilation" ? editingPermissionsFor.features?.[routeKey] !== false : editingPermissionsFor.features?.[routeKey] === true;
		});
		const updatedFeatures = { ...editingPermissionsFor.features };
		items.forEach((item) => {
			const routeKey = item.to.replace("/", "");
			updatedFeatures[routeKey] = newValue;
		});
		setEditingPermissionsFor({
			...editingPermissionsFor,
			features: updatedFeatures
		});
		setProfiles((prevProfiles) => prevProfiles.map((p) => p.id === editingPermissionsFor.id ? {
			...p,
			features: updatedFeatures
		} : p));
		const res = await api.adminUpdateProfile(editingPermissionsFor.id, { features: updatedFeatures });
		if (!res.success) toast.error("Failed to update section permissions: " + res.message);
	};
	const handlePickFolder = async (type) => {
		try {
			if (typeof window !== "undefined") {
				const { open: openFileDialog } = await import("../_libs/tauri-apps__plugin-dialog.mjs").then((n) => n.t);
				const selected = await openFileDialog({
					directory: true,
					multiple: false,
					title: type === "local" ? "Select Local Backup Folder" : type === "server" ? "Select Server Backup Folder" : "Select Versions Folder"
				});
				if (selected && typeof selected === "string") {
					if (type === "local") {
						setLocalBackupPath(selected);
						localStorage.setItem("localBackupPath", selected);
						toast.success("Local backup path updated!");
					} else if (type === "server") {
						setServerBackupPath(selected);
						localStorage.setItem("serverBackupPath", selected);
						toast.success("Server backup path updated!");
					} else if (type === "versions") {
						setVersionsPath(selected);
						localStorage.setItem("versionsPath", selected);
						toast.success("Versions path updated!");
					}
				}
			}
		} catch (e) {
			toast.error("Failed to open directory picker. Ensure you are running the desktop app.");
		}
	};
	const assignOrganization = async (profileId, orgId) => {
		const orgObj = organizations.find((o) => o.id === orgId);
		const orgName = orgObj ? orgObj.name : "";
		setProfiles((prev) => prev.map((p) => p.id === profileId ? {
			...p,
			organization_id: orgId || void 0,
			company: orgName
		} : p));
		if (profileId && typeof window !== "undefined") localStorage.setItem(`mep_user_company_${profileId}`, orgName);
		if ((await api.adminUpdateProfile(profileId, {
			organization_id: orgId || null,
			company: orgName,
			organization: orgName
		})).success) {
			toast.success(orgName ? `Organization "${orgName}" assigned successfully!` : "Organization unassigned!");
			fetchProfiles();
		} else toast.error("Failed to assign organization");
	};
	if (checking) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "flex items-center justify-center h-screen bg-slate-50 dark:bg-slate-950",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, { className: "w-8 h-8 animate-spin text-blue-500" })
	});
	if (!isAdmin) return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex flex-col items-center justify-center h-screen bg-slate-50 dark:bg-slate-950 p-4",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ShieldAlert, { className: "w-16 h-16 text-red-500 mb-4" }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
				className: "text-2xl font-bold",
				children: "Access Denied"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-muted-foreground mt-2",
				children: "You do not have administrator privileges to view this page."
			}),
			debugInfo && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-8 p-4 bg-slate-200 dark:bg-slate-800 rounded-lg text-left max-w-md w-full overflow-auto",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
					className: "font-bold mb-2",
					children: "Debug Info (Take a screenshot):"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("pre", {
					className: "text-xs text-slate-700 dark:text-slate-300",
					children: JSON.stringify(debugInfo, null, 2)
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				onClick: handleLogout,
				className: "mt-6 px-4 py-2 bg-slate-200 dark:bg-slate-800 rounded-lg font-medium hover:bg-slate-300 dark:hover:bg-slate-700",
				children: "Sign out"
			})
		]
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "min-h-screen bg-slate-50 dark:bg-slate-950 p-8",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "w-full px-4 md:px-8 mx-auto max-w-[1800px]",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-center justify-between mb-8 bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center gap-4",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
							to: "/",
							className: "p-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors cursor-pointer mr-2",
							title: "Back to Dashboard",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ArrowLeft, { className: "w-5 h-5 text-slate-600 dark:text-slate-400" })
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "p-3 bg-blue-100 dark:bg-blue-900/30 rounded-xl",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ShieldAlert, { className: "w-8 h-8 text-blue-600 dark:text-blue-400" })
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
							className: "text-2xl font-bold text-slate-900 dark:text-white",
							children: "Admin Control Panel"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-sm text-slate-500 dark:text-slate-400",
							children: user?.email
						})] })
					]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
					onClick: handleLogout,
					className: "flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-600 bg-red-50 dark:bg-red-500/10 rounded-lg hover:bg-red-100 dark:hover:bg-red-500/20 transition-colors",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(LogOut, { className: "w-4 h-4" }), "Sign Out"]
				})]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex gap-6",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "w-64 shrink-0 flex flex-col gap-2",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							onClick: () => setActiveTab("users"),
							className: `w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${activeTab === "users" ? "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50"}`,
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Users, { size: 18 }), "User Access"]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							onClick: () => setActiveTab("activity"),
							className: `w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${activeTab === "activity" ? "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50"}`,
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Activity, { size: 18 }), "Activity Logs"]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							onClick: () => setActiveTab("organizations"),
							className: `w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${activeTab === "organizations" ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400" : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50"}`,
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Users, { size: 18 }), "Organizations"]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							onClick: () => setActiveTab("broadcasts"),
							className: `w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${activeTab === "broadcasts" ? "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50"}`,
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Megaphone, { size: 18 }), "Broadcasts"]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							onClick: () => setActiveTab("licenses"),
							className: `w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${activeTab === "licenses" ? "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 font-bold" : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50"}`,
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Key, { size: 18 }), "Key Manager & Licensing"]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							onClick: () => setActiveTab("storage"),
							className: `w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${activeTab === "storage" ? "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50"}`,
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(HardDrive, { size: 18 }), "Server & Sync"]
						})
					]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden min-h-[600px]",
					children: [
						activeTab === "users" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "p-6",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
										className: "text-xl font-bold text-slate-900 dark:text-white",
										children: "Manage Users by Organization"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "text-xs text-slate-500 dark:text-slate-400 mt-0.5",
										children: "Select an organization from the dropdown to view its members, organization admin representative, and seat usage."
									})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex items-center gap-3",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
											onClick: fetchProfiles,
											className: "text-sm text-blue-600 hover:underline font-medium",
											children: "Refresh"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
											onClick: () => setShowAddUser(true),
											className: "px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg shadow-sm transition-colors",
											children: "+ Add User"
										})]
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "mb-6 p-4 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xs",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex items-center gap-3 flex-1",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
											className: "text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 shrink-0 flex items-center gap-1.5",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Building, {
												size: 16,
												className: "text-blue-600"
											}), "Select Organization:"]
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
											value: selectedOrgFilter,
											onChange: (e) => setSelectedOrgFilter(e.target.value),
											className: "text-sm p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-semibold text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-blue-500 max-w-md w-full shadow-xs cursor-pointer",
											children: [
												/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("option", {
													value: "ALL",
													children: [
														"🏢 All Organizations & Members (",
														profiles.length,
														" total users)"
													]
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("option", {
													value: "UNASSIGNED",
													children: [
														"👤 Unassigned Users (No Organization) (",
														profiles.filter((p) => !p.organization_id && p.role !== "SUPER_ADMIN").length,
														")"
													]
												}),
												organizations.map((org) => {
													const count = profiles.filter((p) => p.organization_id === org.id).length;
													const orgAdmin = profiles.find((p) => p.organization_id === org.id && p.role === "ORG_ADMIN");
													const adminStr = orgAdmin ? ` — Admin: ${orgAdmin.email}` : "";
													return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("option", {
														value: org.id,
														children: [
															"🏢 ",
															org.name,
															" (",
															count,
															" users",
															adminStr,
															")"
														]
													}, org.id);
												})
											]
										})]
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "text-xs font-semibold text-slate-500",
										children: [
											"Showing ",
											profiles.filter((p) => {
												if (selectedOrgFilter === "ALL") return true;
												if (selectedOrgFilter === "UNASSIGNED") return !p.organization_id && p.role !== "SUPER_ADMIN";
												return p.organization_id === selectedOrgFilter;
											}).length,
											" Users"
										]
									})]
								}),
								selectedOrgFilter !== "ALL" && selectedOrgFilter !== "UNASSIGNED" && (() => {
									const currentOrg = (organizations || []).find((o) => o && o.id === selectedOrgFilter);
									if (!currentOrg) return null;
									const currentOrgAdmin = (profiles || []).find((p) => p && p.organization_id === currentOrg.id && p.role === "ORG_ADMIN");
									const currentOrgUsers = (profiles || []).filter((p) => p && p.organization_id === currentOrg.id);
									const orgName = currentOrg.name || "Organization";
									return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "mb-6 p-4 rounded-xl border border-purple-200 dark:border-purple-900/40 bg-purple-50/60 dark:bg-purple-900/10 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xs",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex items-center gap-3",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
												className: "size-11 rounded-xl bg-purple-600 text-white flex items-center justify-center font-bold text-lg shadow-sm",
												children: orgName.substring(0, 2).toUpperCase()
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "flex items-center gap-2",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
													className: "text-base font-bold text-slate-900 dark:text-white",
													children: orgName
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													className: "px-2 py-0.5 rounded-full text-xs font-semibold bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800",
													children: currentOrg.subscription_plan || "PRO PLAN"
												})]
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
												className: "text-xs text-slate-600 dark:text-slate-400 mt-1 flex items-center gap-2",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													className: "font-semibold text-purple-700 dark:text-purple-400",
													children: "Organization Representative / Admin:"
												}), currentOrgAdmin ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
													className: "font-bold text-slate-900 dark:text-white flex items-center gap-1",
													children: [
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Crown, {
															size: 14,
															className: "text-amber-500"
														}),
														" ",
														currentOrgAdmin.email
													]
												}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													className: "italic text-slate-400",
													children: "No Org Admin assigned yet"
												})]
											})] })]
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
											className: "flex items-center gap-3 text-xs",
											children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "bg-white dark:bg-slate-800 px-3 py-1.5 rounded-lg border border-purple-100 dark:border-purple-900/40 font-medium",
												children: [
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
														className: "text-slate-500",
														children: "Seats Used: "
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
														className: "font-bold text-purple-700 dark:text-purple-300",
														children: currentOrgUsers.length
													}),
													" / ",
													currentOrg.max_users || 5,
													" Max Seats"
												]
											})
										})]
									});
								})(),
								showAddUser && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "mb-6 p-5 border border-blue-100 dark:border-blue-900/30 bg-blue-50/50 dark:bg-blue-900/10 rounded-xl",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
											className: "text-sm font-semibold mb-3",
											children: "Create New Engineer"
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
											onSubmit: handleAddUser,
											className: "flex items-end gap-3",
											children: [
												/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
													className: "flex-1",
													children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
														className: "block text-xs font-medium text-slate-500 mb-1",
														children: "Email"
													}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
														type: "email",
														required: true,
														value: newEmail,
														onChange: (e) => setNewEmail(e.target.value),
														className: "w-full text-sm p-2 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
													})]
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
													className: "flex-1",
													children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
														className: "block text-xs font-medium text-slate-500 mb-1",
														children: "Password"
													}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
														type: "password",
														required: true,
														value: newPassword,
														onChange: (e) => setNewPassword(e.target.value),
														className: "w-full text-sm p-2 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
													})]
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
													type: "submit",
													disabled: isAddingUser,
													className: "px-4 py-2 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50",
													children: isAddingUser ? "Creating..." : "Create"
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
													type: "button",
													onClick: () => setShowAddUser(false),
													className: "px-4 py-2 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded text-sm font-medium hover:bg-slate-300 dark:hover:bg-slate-700",
													children: "Cancel"
												})
											]
										}),
										signUpErrorDetails && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "mt-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
												className: "text-sm font-bold text-red-600 dark:text-red-400 mb-1",
												children: "Failed to create user:"
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("pre", {
												className: "text-xs text-red-500 whitespace-pre-wrap font-mono overflow-auto max-h-40",
												children: signUpErrorDetails
											})]
										})
									]
								}),
								selectedUserIds.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "mb-6 bg-slate-900 text-white border-2 border-indigo-500/60 p-4 rounded-2xl shadow-2xl flex flex-wrap items-center justify-between gap-4 animate-in fade-in slide-in-from-top-2",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex items-center gap-3",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
											className: "px-3 py-1.5 rounded-xl bg-indigo-600 text-xs font-bold shadow-xs",
											children: [selectedUserIds.length, " User(s) Selected"]
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
											className: "text-xs text-indigo-200 font-medium",
											children: [
												"Select target organization and click ",
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", {
													className: "text-emerald-400",
													children: "\"DONE (Confirm)\""
												}),
												" to complete."
											]
										})]
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex items-center gap-3",
										children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
												value: bulkTargetOrgId,
												onChange: (e) => setBulkTargetOrgId(e.target.value),
												className: "text-xs p-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white font-semibold cursor-pointer min-w-[220px] focus:ring-2 focus:ring-indigo-500",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
													value: "",
													children: "-- Select Target Organization --"
												}), organizations.map((org) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
													value: org.id,
													children: org.name
												}, org.id))]
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
												disabled: !bulkTargetOrgId,
												onClick: () => {
													const orgObj = organizations.find((o) => o.id === bulkTargetOrgId);
													if (orgObj) handleBulkAssignToOrg(bulkTargetOrgId, orgObj.name);
												},
												className: "px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white rounded-xl text-xs font-bold shadow-lg transition-all flex items-center gap-2 cursor-pointer border border-emerald-400/30 active:scale-95",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CircleCheck, { size: 16 }), " DONE (Confirm & Add to Org)"]
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
												onClick: () => setSelectedUserIds([]),
												className: "text-slate-400 hover:text-white text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-slate-800 transition-colors",
												children: "Cancel ✕"
											})
										]
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "overflow-x-auto",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", {
										className: "w-full text-left border-collapse",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
											className: "border-b border-slate-200 dark:border-slate-800 text-sm text-slate-500 dark:text-slate-400",
											children: [
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
													className: "pb-3 px-2 w-10 text-center",
													children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
														type: "checkbox",
														checked: profiles.length > 0 && profiles.every((p) => selectedUserIds.includes(p.id)),
														onChange: (e) => {
															if (e.target.checked) setSelectedUserIds(profiles.map((p) => p.id));
															else setSelectedUserIds([]);
														},
														className: "rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer",
														title: "Select All Users"
													})
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
													className: "pb-3 font-medium",
													children: "Email"
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
													className: "pb-3 font-medium",
													children: "Role"
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
													className: "pb-3 font-medium",
													children: "Organization"
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
													className: "pb-3 font-medium",
													children: "Status"
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
													className: "pb-3 font-medium",
													children: "Expires"
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
													className: "pb-3 font-medium text-right",
													children: "Actions"
												})
											]
										}) }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tbody", {
											className: "text-sm",
											children: loadingProfiles ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tr", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
												colSpan: 7,
												className: "py-8 text-center text-slate-500",
												children: "Loading..."
											}) }) : profiles.filter((p) => {
												if (selectedOrgFilter === "ALL") return true;
												if (selectedOrgFilter === "UNASSIGNED") return !p.organization_id && p.role !== "SUPER_ADMIN";
												return p.organization_id === selectedOrgFilter;
											}).length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tr", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
												colSpan: 7,
												className: "py-8 text-center text-slate-500",
												children: "No users found for this organization selection."
											}) }) : profiles.filter((p) => {
												if (selectedOrgFilter === "ALL") return true;
												if (selectedOrgFilter === "UNASSIGNED") return !p.organization_id && p.role !== "SUPER_ADMIN";
												return p.organization_id === selectedOrgFilter;
											}).map((p) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
												className: `border-b border-slate-100 dark:border-slate-800/50 last:border-0 hover:bg-slate-50 dark:hover:bg-slate-800/50 ${selectedUserIds.includes(p.id) ? "bg-indigo-50/40 dark:bg-indigo-900/10" : ""}`,
												children: [
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
														className: "py-4 px-2 text-center",
														children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
															type: "checkbox",
															checked: selectedUserIds.includes(p.id),
															onChange: () => {
																setSelectedUserIds((prev) => prev.includes(p.id) ? prev.filter((id) => id !== p.id) : [...prev, p.id]);
															},
															className: "rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
														})
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("td", {
														className: "py-4 font-medium flex items-center gap-2",
														children: [p.role === "ORG_ADMIN" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Crown, {
															size: 15,
															className: "text-amber-500 shrink-0",
															title: "Organization Admin Representative"
														}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: p.email })]
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
														className: "py-4",
														children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
															value: p.role || "Design Engineer",
															onChange: (e) => handleRoleChange(p.id, e.target.value),
															className: "text-xs p-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-semibold text-slate-800 dark:text-slate-200 cursor-pointer shadow-xs focus:ring-2 focus:ring-blue-500 max-w-[170px]",
															children: [
																/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
																	value: "SUPER_ADMIN",
																	children: "⚡ SUPER_ADMIN"
																}),
																/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
																	value: "ORG_ADMIN",
																	children: "👑 ORG_ADMIN"
																}),
																/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
																	value: "Jr. Design Engineer",
																	children: "Jr. Design Engineer"
																}),
																/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
																	value: "Design Engineer",
																	children: "Design Engineer"
																}),
																/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
																	value: "Sr. Design Engineer",
																	children: "Sr. Design Engineer"
																}),
																/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
																	value: "Discipline Coordinator",
																	children: "Discipline Coordinator"
																}),
																/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
																	value: "BIM Modeler",
																	children: "BIM Modeler"
																}),
																/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
																	value: "BIM Coordinator",
																	children: "BIM Coordinator"
																}),
																/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
																	value: "Team Leader",
																	children: "Team Leader"
																}),
																/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
																	value: "2D Draftsman",
																	children: "2D Draftsman"
																}),
																/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
																	value: "Viewer",
																	children: "Viewer"
																}),
																/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
																	value: "Client",
																	children: "Client"
																})
															]
														})
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
														className: "py-4",
														children: p.role === "SUPER_ADMIN" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
															className: "text-slate-400 text-xs italic",
															children: "N/A"
														}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
															value: p.organization_id || "",
															onChange: (e) => assignOrganization(p.id, e.target.value),
															className: "text-xs p-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 max-w-[150px] truncate cursor-pointer font-medium",
															children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
																value: "",
																children: "No Organization"
															}), organizations.map((org) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
																value: org.id,
																children: org.name
															}, org.id))]
														})
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
														className: "py-4",
														children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
															className: `px-2 py-1 rounded-full text-xs font-semibold ${p.subscription_status === "ACTIVE" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"}`,
															children: p.subscription_status
														})
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
														className: "py-4 text-slate-500",
														children: editingExpiryFor === p.id ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
															className: "flex items-center gap-2",
															children: [
																/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
																	type: "date",
																	value: newExpiryDate.split("T")[0],
																	onChange: (e) => setNewExpiryDate(e.target.value),
																	className: "p-1 border rounded text-xs"
																}),
																/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
																	onClick: () => saveExpiry(p.id),
																	className: "text-blue-600 font-medium text-xs hover:underline",
																	children: "Save"
																}),
																/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
																	onClick: () => setEditingExpiryFor(null),
																	className: "text-slate-500 font-medium text-xs hover:underline",
																	children: "Cancel"
																})
															]
														}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
															className: "flex items-center gap-2",
															children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: p.subscription_expires ? new Date(p.subscription_expires).toLocaleDateString() : "Never" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
																onClick: () => {
																	setEditingExpiryFor(p.id);
																	setNewExpiryDate(p.subscription_expires ? new Date(p.subscription_expires).toISOString().split("T")[0] : "");
																},
																className: "text-blue-600 text-[10px] uppercase font-bold tracking-wider hover:underline opacity-60 hover:opacity-100",
																children: "Edit"
															})]
														})
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("td", {
														className: "py-4 text-right space-x-2 whitespace-nowrap",
														children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
															onClick: () => setEditingPermissionsFor(p),
															className: "px-3 py-1 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 dark:bg-indigo-900/20 dark:hover:bg-indigo-900/40 rounded text-xs font-medium transition-colors",
															children: "Permissions"
														}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
															onClick: () => deleteUser(p.id, p.email),
															className: "px-3 py-1 bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/40 rounded text-xs font-medium transition-colors",
															children: "Delete"
														})]
													})
												]
											}, p.id))
										})]
									})
								})
							]
						}),
						activeTab === "organizations" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "p-6",
							children: selectedOrgForManagement ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "bg-slate-900/40 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex items-center justify-between border-b border-slate-800 pb-4",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex items-center gap-3",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
												onClick: () => setSelectedOrgForManagement(null),
												className: "p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer",
												title: "Back to Organizations List",
												children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ArrowLeft, { size: 18 })
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "flex items-center gap-2",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
													className: "text-xl font-bold text-slate-900 dark:text-white",
													children: selectedOrgForManagement.name
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													className: "px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 border border-indigo-500/30",
													children: selectedOrgForManagement.subscription_plan
												})]
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
												className: "text-xs text-slate-500 dark:text-slate-400 mt-0.5",
												children: "Manage members, assign existing users, change member roles, or delete users for this organization."
											})] })]
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex items-center gap-3",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
												className: "px-3 py-1 bg-slate-100 dark:bg-slate-800 rounded-lg text-xs font-bold text-slate-700 dark:text-slate-300",
												children: [
													"👥 ",
													profiles.filter((p) => p.organization_id === selectedOrgForManagement.id).length,
													" / ",
													selectedOrgForManagement.max_users,
													" Seats Used"
												]
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
												onClick: () => setSelectedOrgForManagement(null),
												className: "text-xs font-semibold text-slate-700 dark:text-slate-300 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer",
												children: "Close Manager ✕"
											})]
										})]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "p-5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/60 space-y-4",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-700/60 pb-3",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h3", {
												className: "text-sm font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-2",
												children: [
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)(UserPlus, {
														size: 16,
														className: "text-indigo-600 dark:text-indigo-400"
													}),
													"Select Users to Add to ",
													selectedOrgForManagement.name
												]
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
												className: "text-xs text-slate-500 dark:text-slate-400 mt-0.5",
												children: "Check all the users you want to assign below, then click \"Add Selected to Organization\"."
											})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "flex items-center gap-3",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
													className: "relative",
													children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Search, {
														size: 14,
														className: "absolute left-2.5 top-2.5 text-slate-400"
													}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
														type: "text",
														placeholder: "Search available users...",
														value: userSearchQuery,
														onChange: (e) => setUserSearchQuery(e.target.value),
														className: "pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 w-52 focus:outline-none focus:ring-1 focus:ring-indigo-500"
													})]
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
													disabled: selectedUserIds.length === 0,
													onClick: () => handleBulkAssignToOrg(selectedOrgForManagement.id, selectedOrgForManagement.name),
													className: "px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white text-xs font-bold rounded-lg shadow-xs transition-all flex items-center gap-2 cursor-pointer",
													children: [
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)(UserCheck, { size: 16 }),
														"Add (",
														selectedUserIds.length,
														") Selected to ",
														selectedOrgForManagement.name
													]
												})]
											})]
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
											className: "max-h-60 overflow-y-auto pr-1",
											children: (() => {
												const availableUsers = profiles.filter((p) => p.organization_id !== selectedOrgForManagement.id && p.role !== "SUPER_ADMIN" && (userSearchQuery ? p.email.toLowerCase().includes(userSearchQuery.toLowerCase()) || p.role?.toLowerCase().includes(userSearchQuery.toLowerCase()) : true));
												const allAvailableSelected = availableUsers.length > 0 && availableUsers.every((u) => selectedUserIds.includes(u.id));
												if (availableUsers.length === 0) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
													className: "text-xs text-slate-500 italic py-4 text-center",
													children: userSearchQuery ? "No matching available users found." : "All application users are already members of this organization!"
												});
												return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
													className: "space-y-2",
													children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
														className: "flex items-center justify-between px-3 py-1.5 bg-slate-200/60 dark:bg-slate-900/60 rounded-lg text-xs font-bold text-slate-600 dark:text-slate-300",
														children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
															className: "flex items-center gap-2 cursor-pointer select-none",
															children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
																type: "checkbox",
																checked: allAvailableSelected,
																onChange: (e) => {
																	if (e.target.checked) setSelectedUserIds((prev) => Array.from(/* @__PURE__ */ new Set([...prev, ...availableUsers.map((u) => u.id)])));
																	else {
																		const availIds = new Set(availableUsers.map((u) => u.id));
																		setSelectedUserIds((prev) => prev.filter((id) => !availIds.has(id)));
																	}
																},
																className: "rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
															}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
																"Select All Available Users (",
																availableUsers.length,
																")"
															] })]
														}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
															className: "text-[11px] text-slate-400 font-normal",
															children: [selectedUserIds.length, " users selected"]
														})]
													}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
														className: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 pt-1",
														children: availableUsers.map((u) => {
															const isSelected = selectedUserIds.includes(u.id);
															return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
																onClick: () => {
																	setSelectedUserIds((prev) => isSelected ? prev.filter((id) => id !== u.id) : [...prev, u.id]);
																},
																className: `p-2.5 rounded-lg border text-xs flex items-center justify-between cursor-pointer transition-all ${isSelected ? "bg-indigo-500/10 border-indigo-500/60 text-indigo-900 dark:text-indigo-200 shadow-xs font-semibold" : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700/80 text-slate-700 dark:text-slate-300 hover:border-slate-400"}`,
																children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
																	className: "flex items-center gap-2.5 truncate",
																	children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
																		type: "checkbox",
																		checked: isSelected,
																		onChange: () => {},
																		className: "rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
																	}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
																		className: "truncate",
																		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
																			className: "font-semibold truncate",
																			children: u.email
																		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
																			className: "text-[10px] text-slate-500 dark:text-slate-400 truncate",
																			children: [
																				u.role,
																				" • ",
																				u.organization_id ? "In another org" : "Unassigned"
																			]
																		})]
																	})]
																}), isSelected && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Check, {
																	size: 14,
																	className: "text-indigo-600 dark:text-indigo-400 shrink-0 ml-1"
																})]
															}, u.id);
														})
													})]
												});
											})()
										})]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h3", {
										className: "text-sm font-bold text-slate-800 dark:text-slate-200 mb-3 flex items-center gap-2",
										children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Users, {
												size: 16,
												className: "text-indigo-600 dark:text-indigo-400"
											}),
											"Current Organization Members (",
											profiles.filter((p) => p.organization_id === selectedOrgForManagement.id).length,
											")"
										]
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800",
										children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", {
											className: "w-full text-left border-collapse",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
												className: "bg-slate-100 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-800 text-xs font-bold tracking-wider text-slate-500 dark:text-slate-400 uppercase",
												children: [
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
														className: "py-3 px-4",
														children: "User Email"
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
														className: "py-3 px-4",
														children: "Role"
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
														className: "py-3 px-4",
														children: "Status"
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
														className: "py-3 px-4 text-right",
														children: "Actions"
													})
												]
											}) }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tbody", {
												className: "text-sm divide-y divide-slate-100 dark:divide-slate-800",
												children: profiles.filter((p) => p.organization_id === selectedOrgForManagement.id).length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tr", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
													colSpan: 4,
													className: "py-8 text-center text-slate-500 dark:text-slate-400 italic",
													children: "No members in this organization yet. Select an existing user above to add them!"
												}) }) : profiles.filter((p) => p.organization_id === selectedOrgForManagement.id).map((user) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
													className: "hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors",
													children: [
														/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("td", {
															className: "py-3 px-4 font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2",
															children: [user.role === "ORG_ADMIN" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Crown, {
																size: 15,
																className: "text-amber-500 shrink-0",
																title: "Organization Admin Representative"
															}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: user.email })]
														}),
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
															className: "py-3 px-4",
															children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
																value: user.role || "Design Engineer",
																onChange: (e) => handleRoleChange(user.id, e.target.value),
																className: "text-xs p-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-semibold text-slate-800 dark:text-slate-200 cursor-pointer shadow-xs focus:ring-2 focus:ring-indigo-500 max-w-[170px]",
																children: [
																	/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
																		value: "SUPER_ADMIN",
																		children: "⚡ SUPER_ADMIN"
																	}),
																	/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
																		value: "ORG_ADMIN",
																		children: "👑 ORG_ADMIN"
																	}),
																	/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
																		value: "Jr. Design Engineer",
																		children: "Jr. Design Engineer"
																	}),
																	/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
																		value: "Design Engineer",
																		children: "Design Engineer"
																	}),
																	/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
																		value: "Sr. Design Engineer",
																		children: "Sr. Design Engineer"
																	}),
																	/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
																		value: "Discipline Coordinator",
																		children: "Discipline Coordinator"
																	}),
																	/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
																		value: "BIM Modeler",
																		children: "BIM Modeler"
																	}),
																	/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
																		value: "BIM Coordinator",
																		children: "BIM Coordinator"
																	}),
																	/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
																		value: "Team Leader",
																		children: "Team Leader"
																	}),
																	/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
																		value: "2D Draftsman",
																		children: "2D Draftsman"
																	}),
																	/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
																		value: "Viewer",
																		children: "Viewer"
																	}),
																	/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
																		value: "Client",
																		children: "Client"
																	})
																]
															})
														}),
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
															className: "py-3 px-4",
															children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
																className: "px-2 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
																children: user.status || "ACTIVE"
															})
														}),
														/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("td", {
															className: "py-3 px-4 text-right space-x-2 whitespace-nowrap",
															children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
																onClick: async () => {
																	await assignOrganization(user.id, "");
																	toast.info(`Removed ${user.email} from ${selectedOrgForManagement.name}`);
																},
																className: "px-3 py-1 bg-amber-50 dark:bg-amber-900/20 hover:bg-amber-100 text-amber-700 dark:text-amber-400 border border-amber-300 dark:border-amber-700/50 rounded-lg text-xs font-semibold transition-all cursor-pointer",
																title: "Remove user from this organization",
																children: "Remove from Org"
															}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
																onClick: () => deleteUser(user.id, user.email),
																className: "px-3 py-1 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 text-red-700 dark:text-red-400 border border-red-300 dark:border-red-700/50 rounded-lg text-xs font-semibold transition-all cursor-pointer",
																title: "Permanently delete user",
																children: "Delete User"
															})]
														})
													]
												}, user.id))
											})]
										})
									})] })
								]
							}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex items-center justify-between mb-6",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
										className: "text-xl font-bold",
										children: "Manage Organizations"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex items-center gap-3",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
											onClick: fetchOrganizations,
											className: "text-sm text-blue-600 hover:underline",
											children: "Refresh"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
											onClick: () => setShowAddOrg(true),
											className: "px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg shadow-xs transition-colors",
											children: "+ Create Organization"
										})]
									})]
								}),
								showAddOrg && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "mb-6 p-5 border border-indigo-100 dark:border-indigo-900/30 bg-indigo-50/50 dark:bg-indigo-900/10 rounded-xl",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
										className: "text-sm font-semibold mb-3",
										children: "Create New Organization"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
										onSubmit: handleAddOrg,
										className: "flex flex-wrap items-end gap-3",
										children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "flex-1 min-w-[200px]",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
													className: "block text-xs font-medium text-slate-500 mb-1",
													children: "Org Name"
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
													type: "text",
													required: true,
													value: newOrgName,
													onChange: (e) => setNewOrgName(e.target.value),
													className: "w-full text-sm p-2 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
												})]
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "w-32",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
													className: "block text-xs font-medium text-slate-500 mb-1",
													children: "Plan"
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
													value: newOrgPlan,
													onChange: (e) => setNewOrgPlan(e.target.value),
													className: "w-full text-sm p-2 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800",
													children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
														value: "PRO",
														children: "PRO"
													}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
														value: "ENTERPRISE",
														children: "ENTERPRISE"
													})]
												})]
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "w-24",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
													className: "block text-xs font-medium text-slate-500 mb-1",
													children: "Max Users"
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
													type: "number",
													min: "1",
													required: true,
													value: newOrgUsers,
													onChange: (e) => setNewOrgUsers(parseInt(e.target.value)),
													className: "w-full text-sm p-2 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
												})]
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
												type: "submit",
												disabled: isAddingOrg,
												className: "px-4 py-2 bg-indigo-600 text-white rounded text-sm font-medium hover:bg-indigo-700 disabled:opacity-50",
												children: isAddingOrg ? "Creating..." : "Create"
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
												type: "button",
												onClick: () => setShowAddOrg(false),
												className: "px-4 py-2 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded text-sm font-medium hover:bg-slate-300 dark:hover:bg-slate-700",
												children: "Cancel"
											})
										]
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "overflow-x-auto",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", {
										className: "w-full text-left border-collapse",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
											className: "border-b border-slate-200 dark:border-slate-800 text-sm text-slate-500 dark:text-slate-400",
											children: [
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
													className: "pb-3 font-medium",
													children: "Name"
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
													className: "pb-3 font-medium",
													children: "Plan"
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
													className: "pb-3 font-medium",
													children: "Licenses / Seats"
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
													className: "pb-3 font-medium text-right",
													children: "Actions"
												})
											]
										}) }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tbody", {
											className: "text-sm",
											children: loadingOrganizations ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tr", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
												colSpan: 4,
												className: "py-8 text-center text-slate-500",
												children: "Loading..."
											}) }) : organizations.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tr", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
												colSpan: 4,
												className: "py-8 text-center text-slate-500",
												children: "No organizations found."
											}) }) : organizations.map((org) => {
												const memberCount = profiles.filter((p) => p.organization_id === org.id).length;
												return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
													className: "border-b border-slate-100 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors",
													children: [
														/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("td", {
															className: "py-4 font-bold text-slate-800 dark:text-slate-200 hover:text-indigo-600 dark:hover:text-indigo-400 cursor-pointer",
															onClick: () => setSelectedOrgForManagement(org),
															children: ["🏢 ", org.name]
														}),
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
															className: "py-4",
															children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
																className: "px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400",
																children: org.subscription_plan
															})
														}),
														/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("td", {
															className: "py-4 font-semibold text-slate-700 dark:text-slate-300",
															children: [
																memberCount,
																" / ",
																org.max_users || 10,
																" Members"
															]
														}),
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
															className: "py-4 text-right",
															children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
																className: "flex items-center justify-end gap-2",
																children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
																	onClick: () => setSelectedOrgForManagement(org),
																	className: "px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-all cursor-pointer",
																	children: [
																		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Users, { size: 14 }),
																		" Manage Members (",
																		memberCount,
																		")"
																	]
																}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
																	onClick: () => deleteOrganization(org.id, org.name),
																	className: "px-3 py-1.5 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-lg text-xs font-semibold transition-all cursor-pointer",
																	children: "Delete Org"
																})]
															})
														})
													]
												}, org.id);
											})
										})]
									})
								})
							] })
						}),
						activeTab === "activity" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "p-6",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
										className: "text-xl font-bold text-slate-900 dark:text-white",
										children: "Organization & System Activity Audit Logs"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "text-xs text-slate-500 dark:text-slate-400 mt-0.5",
										children: "Monitor team actions across organizations (calculations run, reports generated, login history, and admin actions)."
									})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
										onClick: fetchActivityLogs,
										className: "text-sm text-blue-600 hover:underline font-medium self-start md:self-auto",
										children: "Refresh Logs"
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "mb-6 p-4 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xs",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex items-center gap-3",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
											className: "text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 shrink-0 flex items-center gap-1.5",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Building, {
												size: 16,
												className: "text-blue-600"
											}), "Filter Organization:"]
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
											value: logOrgFilter,
											onChange: (e) => setLogOrgFilter(e.target.value),
											className: "text-xs p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-semibold cursor-pointer max-w-xs text-slate-800 dark:text-slate-200 shadow-xs",
											children: [
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
													value: "ALL",
													children: "🏢 All Organizations & System Logs"
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
													value: "UNASSIGNED",
													children: "👤 Unassigned Users"
												}),
												organizations.map((org) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("option", {
													value: org.id,
													children: ["🏢 ", org.name]
												}, org.id))
											]
										})]
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "relative flex-1 max-w-xs",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Search, {
											size: 15,
											className: "absolute left-3 top-2.5 text-slate-400"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
											type: "text",
											value: logSearchQuery,
											onChange: (e) => setLogSearchQuery(e.target.value),
											placeholder: "Search by user or action...",
											className: "w-full pl-9 pr-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-medium"
										})]
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex items-center gap-2 flex-wrap mb-6",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
										className: "text-xs font-bold uppercase tracking-wider text-slate-500 mr-1 flex items-center gap-1",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Activity, {
											size: 14,
											className: "text-blue-600"
										}), " Category:"]
									}), [
										{
											id: "ALL",
											label: "All Actions"
										},
										{
											id: "LOGIN",
											label: "🔑 Logins"
										},
										{
											id: "VIEWED",
											label: "👀 Viewed"
										},
										{
											id: "UPDATED",
											label: "📝 Updated"
										},
										{
											id: "REPORT_GENERATED",
											label: "📄 Reports"
										}
									].map((cat) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
										onClick: () => setLogCategoryFilter(cat.id),
										className: `text-xs px-3 py-1.5 rounded-lg font-semibold transition ${logCategoryFilter === cat.id ? "bg-blue-600 text-white shadow-xs" : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-200"}`,
										children: cat.label
									}, cat.id))]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "overflow-x-auto",
										children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", {
											className: "w-full text-left text-sm",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", {
												className: "bg-slate-50 dark:bg-slate-800/50 text-xs text-slate-500 uppercase",
												children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { children: [
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
														className: "px-6 py-4 font-medium",
														children: "Date/Time"
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
														className: "px-6 py-4 font-medium",
														children: "User Name"
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
														className: "px-6 py-4 font-medium",
														children: "Project Name"
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
														className: "px-6 py-4 font-medium",
														children: "Calculator"
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
														className: "px-6 py-4 font-medium",
														children: "Action"
													})
												] })
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tbody", {
												className: "divide-y divide-slate-100 dark:divide-slate-800 text-sm",
												children: loadingLogs ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tr", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("td", {
													colSpan: 5,
													className: "px-6 py-8 text-center text-slate-500",
													children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, { className: "w-6 h-6 animate-spin mx-auto mb-2 text-blue-600" }), "Loading audit logs..."]
												}) }) : activityLogs.filter((log) => {
													const userEmail = (log.profiles?.email || log.email || "").toLowerCase();
													const userOrgId = profiles.find((p) => p.email.toLowerCase() === userEmail)?.organization_id;
													if (logOrgFilter !== "ALL") {
														if (logOrgFilter === "UNASSIGNED") {
															if (userOrgId) return false;
														} else if (userOrgId !== logOrgFilter) return false;
													}
													if (logCategoryFilter === "LOGIN" && log.action_type !== "LOGIN" && log.action_type !== "LOGGED_IN") return false;
													if (logCategoryFilter === "VIEWED" && log.action_type !== "VIEWED" && log.action_type !== "VIEW_CALCULATOR") return false;
													if (logCategoryFilter === "UPDATED" && log.action_type !== "UPDATED") return false;
													if (logCategoryFilter === "REPORT_GENERATED" && !log.action_type?.includes("REPORT")) return false;
													if (logSearchQuery.trim()) {
														const q = logSearchQuery.toLowerCase();
														const action = (log.action_type || "").toLowerCase();
														const detailsStr = typeof log.details === "string" ? log.details.toLowerCase() : JSON.stringify(log.details || {}).toLowerCase();
														return userEmail.includes(q) || action.includes(q) || detailsStr.includes(q);
													}
													return true;
												}).length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tr", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
													colSpan: 5,
													className: "px-6 py-8 text-center text-slate-500 font-medium",
													children: "No activity logs found for this filter."
												}) }) : activityLogs.filter((log) => {
													const userEmail = (log.profiles?.email || log.email || "").toLowerCase();
													const userOrgId = profiles.find((p) => p.email.toLowerCase() === userEmail)?.organization_id;
													if (logOrgFilter !== "ALL") {
														if (logOrgFilter === "UNASSIGNED") {
															if (userOrgId) return false;
														} else if (userOrgId !== logOrgFilter) return false;
													}
													if (logCategoryFilter === "LOGIN" && log.action_type !== "LOGIN" && log.action_type !== "LOGGED_IN") return false;
													if (logCategoryFilter === "VIEWED" && log.action_type !== "VIEWED" && log.action_type !== "VIEW_CALCULATOR") return false;
													if (logCategoryFilter === "UPDATED" && log.action_type !== "UPDATED") return false;
													if (logCategoryFilter === "REPORT_GENERATED" && !log.action_type?.includes("REPORT")) return false;
													if (logSearchQuery.trim()) {
														const q = logSearchQuery.toLowerCase();
														const action = (log.action_type || "").toLowerCase();
														const detailsStr = typeof log.details === "string" ? log.details.toLowerCase() : JSON.stringify(log.details || {}).toLowerCase();
														return userEmail.includes(q) || action.includes(q) || detailsStr.includes(q);
													}
													return true;
												}).map((log) => {
													const userEmail = log.profiles?.email || log.email || "System User";
													const userProfile = profiles.find((p) => p.email.toLowerCase() === userEmail.toLowerCase());
													const userName = log.name || userProfile?.name || log.profiles?.name || userEmail;
													const isLogin = log.action_type === "LOGIN" || log.action_type === "LOGGED_IN";
													log.action_type === "UPDATED" || log.action_type?.includes("UPDATE");
													log.action_type === "VIEWED" || log.action_type;
													log.action_type?.includes("REPORT");
													let detailsObj = {};
													if (typeof log.details === "string") try {
														detailsObj = JSON.parse(log.details);
													} catch (e) {
														detailsObj = {};
													}
													else detailsObj = log.details || {};
													return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
														className: "hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition",
														children: [
															/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
																className: "px-6 py-4 text-xs font-mono text-slate-500 whitespace-nowrap",
																children: new Date(log.created_at).toLocaleString()
															}),
															/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("td", {
																className: "px-6 py-4 font-semibold text-slate-900 dark:text-slate-100",
																children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { children: userName }), userEmail && userName !== userEmail && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
																	className: "text-[11px] text-slate-400 font-normal",
																	children: userEmail
																})]
															}),
															/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
																className: "px-6 py-4 font-medium text-slate-700 dark:text-slate-300",
																children: detailsObj.project_name || "-"
															}),
															/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
																className: "px-6 py-4",
																children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
																	className: "px-2.5 py-1 rounded-md text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700",
																	children: detailsObj.calculator || "-"
																})
															}),
															/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
																className: "px-6 py-4",
																children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
																	className: `inline-flex items-center px-2.5 py-1 rounded-md text-xs font-extrabold tracking-wider uppercase ${isLogin ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20" : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"}`,
																	children: isLogin ? "LOGIN" : "UPDATED"
																})
															})
														]
													}, log.id);
												})
											})]
										})
									})
								})
							]
						}),
						activeTab === "broadcasts" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "p-6",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex items-center justify-between mb-6",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
										className: "text-xl font-bold",
										children: "Global Broadcasts"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
										onClick: fetchAnnouncements,
										className: "text-sm text-blue-600 hover:underline",
										children: "Refresh"
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "mb-8 p-5 border border-blue-100 dark:border-blue-900/30 bg-blue-50/50 dark:bg-blue-900/10 rounded-xl",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
										className: "text-sm font-semibold mb-3",
										children: "Create New Broadcast"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
										onSubmit: handleCreateAnnouncement,
										className: "flex gap-3",
										children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
												className: "flex-1",
												children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
													type: "text",
													placeholder: "Type your message here (e.g., Update 2.0 is coming tomorrow)",
													required: true,
													value: newAnnouncementMsg,
													onChange: (e) => setNewAnnouncementMsg(e.target.value),
													className: "w-full text-sm p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
												})
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
												value: newAnnouncementType,
												onChange: (e) => setNewAnnouncementType(e.target.value),
												className: "text-sm p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 w-32",
												children: [
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
														value: "info",
														children: "Info"
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
														value: "warning",
														children: "Warning"
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
														value: "success",
														children: "Success"
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
														value: "error",
														children: "Error"
													})
												]
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
												type: "submit",
												className: "px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg shadow-sm transition-colors",
												children: "Broadcast"
											})
										]
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "space-y-4",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
										className: "text-sm font-semibold",
										children: "Past Broadcasts"
									}), loadingAnnouncements ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "py-8 text-center",
										children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, { className: "w-6 h-6 animate-spin mx-auto text-slate-400" })
									}) : announcements.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "py-8 text-center text-slate-500 text-sm",
										children: "No broadcasts found."
									}) : announcements.map((ann) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: `p-4 rounded-xl border flex items-center justify-between ${ann.is_active ? "border-blue-200 bg-blue-50 dark:border-blue-800/30 dark:bg-blue-900/20" : "border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-800/30 opacity-75"}`,
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex items-center gap-2 mb-1",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
												className: `text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full ${ann.type === "warning" ? "bg-amber-100 text-amber-800" : ann.type === "error" ? "bg-red-100 text-red-800" : ann.type === "success" ? "bg-emerald-100 text-emerald-800" : "bg-blue-100 text-blue-800"}`,
												children: ann.type
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
												className: "text-xs text-slate-500",
												children: new Date(ann.created_at).toLocaleString()
											})]
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
											className: "text-sm font-medium",
											children: ann.message
										})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex items-center gap-3",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
												onClick: () => toggleAnnouncement(ann.id, ann.is_active),
												className: `relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${ann.is_active ? "bg-blue-600" : "bg-slate-300 dark:bg-slate-700"}`,
												children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: `inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${ann.is_active ? "translate-x-5" : "translate-x-1"}` })
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
												onClick: () => deleteAnnouncement(ann.id),
												className: "p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors",
												children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Trash2, { className: "w-4 h-4" })
											})]
										})]
									}, ann.id))]
								})
							]
						}),
						activeTab === "storage" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "p-6",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
									className: "text-xl font-bold text-slate-900 dark:text-white",
									children: "Server & Sync Settings"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "text-xs text-slate-500 dark:text-slate-400 mt-0.5",
									children: "Configure organization-specific backup directories saved on the backend server."
								})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex items-center gap-2",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
										className: "text-xs font-bold uppercase tracking-wider text-slate-500 shrink-0",
										children: "Organization:"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
										value: selectedOrgFilter,
										onChange: (e) => {
											setSelectedOrgFilter(e.target.value);
											fetchOrgBackupSettings(e.target.value);
										},
										className: "text-xs p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-semibold cursor-pointer max-w-xs",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
											value: "ALL",
											children: "🏢 Global Default Settings"
										}), organizations.map((org) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("option", {
											value: org.id,
											children: ["🏢 ", org.name]
										}, org.id))]
									})]
								})]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "space-y-8 max-w-2xl",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "bg-slate-50 dark:bg-slate-800/50 p-6 rounded-xl border border-slate-200 dark:border-slate-700",
										children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex items-start gap-4",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
												className: "p-3 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg",
												children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(HardDrive, { className: "w-6 h-6" })
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "flex-1",
												children: [
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
														className: "font-semibold text-lg",
														children: "10-Minute Local Backup (AppData)"
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
														className: "text-sm text-slate-500 mb-4",
														children: "Automatically save project versions locally every 10 minutes to prevent data loss."
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
														className: "flex gap-2",
														children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
															type: "text",
															value: localBackupPath,
															onChange: (e) => setLocalBackupPath(e.target.value),
															placeholder: "C:\\Users\\Admin\\AppData\\Local\\MEPCalc\\Backups",
															className: "flex-1 px-4 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-sm"
														}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
															onClick: () => handlePickFolder("local"),
															className: "flex items-center gap-2 px-4 py-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-lg text-sm font-medium hover:bg-slate-800 dark:hover:bg-slate-100 transition-colors",
															children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FolderOpen, { className: "w-4 h-4" }), "Browse"]
														})]
													})
												]
											})]
										})
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "bg-slate-50 dark:bg-slate-800/50 p-6 rounded-xl border border-slate-200 dark:border-slate-700",
										children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex items-start gap-4",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
												className: "p-3 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-lg",
												children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Save, { className: "w-6 h-6" })
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "flex-1",
												children: [
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
														className: "font-semibold text-lg",
														children: "1-Hour Server Backup"
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
														className: "text-sm text-slate-500 mb-4",
														children: "Automatically sync a major version of the project to your local server drive or cloud sync folder every hour."
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
														className: "flex gap-2",
														children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
															type: "text",
															value: serverBackupPath,
															onChange: (e) => setServerBackupPath(e.target.value),
															placeholder: "Z:/00 R&D Server/Backups",
															className: "flex-1 px-4 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-sm"
														}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
															onClick: () => handlePickFolder("server"),
															className: "flex items-center gap-2 px-4 py-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-lg text-sm font-medium hover:bg-slate-800 dark:hover:bg-slate-100 transition-colors",
															children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FolderOpen, { className: "w-4 h-4" }), "Browse"]
														})]
													})
												]
											})]
										})
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "bg-slate-50 dark:bg-slate-800/50 p-6 rounded-xl border border-slate-200 dark:border-slate-700",
										children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex items-start gap-4",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
												className: "p-3 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-lg",
												children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(History, { className: "w-6 h-6" })
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "flex-1",
												children: [
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
														className: "font-semibold text-lg",
														children: "Versions Path"
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
														className: "text-sm text-slate-500 mb-4",
														children: "Designated path where calculator versions (V0, V1, etc.) will be stored for the organization."
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
														className: "flex gap-2",
														children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
															type: "text",
															value: versionsPath,
															onChange: (e) => setVersionsPath(e.target.value),
															placeholder: "Z:/00 R&D Server/Versions",
															className: "flex-1 px-4 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-sm"
														}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
															onClick: () => handlePickFolder("versions"),
															className: "flex items-center gap-2 px-4 py-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-lg text-sm font-medium hover:bg-slate-800 dark:hover:bg-slate-100 transition-colors",
															children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FolderOpen, { className: "w-4 h-4" }), "Browse"]
														})]
													})
												]
											})]
										})
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "pt-6 border-t border-slate-200 dark:border-slate-800",
										children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
											onClick: async () => {
												localStorage.setItem("localBackupPath", localBackupPath);
												localStorage.setItem("serverBackupPath", serverBackupPath);
												localStorage.setItem("versionsPath", versionsPath);
												toast.info("Saving backup settings to backend server...");
												const targetId = selectedOrgFilter !== "ALL" && selectedOrgFilter !== "UNASSIGNED" ? selectedOrgFilter : void 0;
												const res = await api.saveOrgBackupSettings(localBackupPath, serverBackupPath, targetId, versionsPath);
												if (res && res.success) toast.success("Organization backup settings saved to backend successfully!");
												else toast.error(res.message || "Failed to save backup settings to backend");
											},
											className: "px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors",
											children: "Save Backup Settings"
										})
									})
								]
							})]
						}),
						activeTab === "licenses" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "p-6 space-y-6",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex items-center justify-between",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
										className: "text-xl font-bold text-slate-900 dark:text-white",
										children: "Key Manager & Licensing"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "text-xs text-slate-500",
										children: "Generate unique non-repeatable license keys and manage hardware trials."
									})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
										onClick: fetchAdminLicenses,
										className: "text-sm text-blue-600 hover:underline",
										children: "Refresh List"
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "p-5 border border-amber-200 dark:border-amber-900/30 bg-amber-50/40 dark:bg-amber-900/10 rounded-2xl space-y-4",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h3", {
											className: "text-sm font-bold text-amber-900 dark:text-amber-300 flex items-center gap-2",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Key, { className: "size-4" }), "Generate Unique Non-Repeatable License Key"]
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
											onSubmit: handleAdminGenerateKey,
											className: "grid grid-cols-1 md:grid-cols-4 gap-3 items-end",
											children: [
												/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
													className: "block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1",
													children: "License Tier"
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
													value: genTier,
													onChange: (e) => setGenTier(e.target.value),
													className: "w-full h-9 px-3 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-semibold",
													children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
														value: "PRO",
														children: "PRO Plan"
													}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
														value: "ENTERPRISE",
														children: "ENTERPRISE Plan"
													})]
												})] }),
												/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
													className: "block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1",
													children: "Duration (Days)"
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
													type: "number",
													value: genDays,
													onChange: (e) => setGenDays(parseInt(e.target.value) || 365),
													className: "w-full h-9 px-3 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-mono"
												})] }),
												/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
													className: "block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1",
													children: "Target User Email (Optional)"
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
													type: "email",
													value: genTargetEmail,
													onChange: (e) => setGenTargetEmail(e.target.value),
													placeholder: "user@domain.com",
													className: "w-full h-9 px-3 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-mono"
												})] }),
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
													type: "submit",
													className: "h-9 px-4 bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs rounded-xl transition cursor-pointer",
													children: "Generate Key"
												})
											]
										}),
										generatedAdminKey && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "p-3 bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-800 rounded-xl flex items-center justify-between",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "flex items-center gap-2",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													className: "text-xs text-slate-500 font-semibold",
													children: "Generated Key:"
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("code", {
													className: "text-sm font-mono font-bold text-amber-500 tracking-wider",
													children: generatedAdminKey
												})]
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
												onClick: () => {
													navigator.clipboard.writeText(generatedAdminKey);
													toast.success("License key copied to clipboard!");
												},
												className: "flex items-center gap-1.5 px-3 py-1 bg-amber-500/20 text-amber-600 dark:text-amber-400 hover:bg-amber-500/30 rounded-lg text-xs font-bold transition cursor-pointer",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Copy, { className: "size-3.5" }), "Copy Key"]
											})]
										})
									]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "space-y-3",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h3", {
										className: "text-sm font-bold text-slate-900 dark:text-white",
										children: [
											"Active & Generated License Keys (",
											licensesList.length,
											")"
										]
									}), loadingLicenses ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "py-8 text-center text-slate-400",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, { className: "animate-spin size-6 mx-auto mb-2" }), "Loading keys..."]
									}) : licensesList.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "py-8 text-center text-slate-400 text-xs italic",
										children: "No custom license keys generated yet."
									}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden",
										children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", {
											className: "w-full text-left text-xs",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", {
												className: "bg-slate-50 dark:bg-slate-800/60 font-bold uppercase text-slate-500 text-[10px]",
												children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { children: [
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
														className: "p-3",
														children: "License Key"
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
														className: "p-3",
														children: "Tier"
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
														className: "p-3",
														children: "Bound Email"
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
														className: "p-3",
														children: "Status"
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
														className: "p-3",
														children: "Expires"
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
														className: "p-3 text-right",
														children: "Actions"
													})
												] })
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tbody", {
												className: "divide-y divide-slate-100 dark:divide-slate-800 font-mono",
												children: licensesList.map((lic) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
													className: "hover:bg-slate-50/50 dark:hover:bg-slate-800/40",
													children: [
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
															className: "p-3 font-bold text-amber-600 dark:text-amber-400",
															children: lic.key
														}),
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
															className: "p-3 font-semibold",
															children: lic.tier
														}),
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
															className: "p-3 text-slate-600 dark:text-slate-300",
															children: lic.boundEmail || "Unbound"
														}),
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
															className: "p-3",
															children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
																className: `px-2 py-0.5 rounded-full text-[10px] font-bold ${lic.status === "ACTIVE" ? "bg-emerald-500/10 text-emerald-500" : "bg-red-500/10 text-red-500"}`,
																children: lic.status
															})
														}),
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
															className: "p-3 text-slate-500",
															children: new Date(lic.expiresAt).toLocaleDateString()
														}),
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
															className: "p-3 text-right",
															children: lic.status === "ACTIVE" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
																onClick: () => handleAdminRevokeKey(lic.key),
																className: "px-2.5 py-1 text-[11px] font-bold text-red-600 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/40 rounded-lg transition",
																children: "Revoke"
															})
														})
													]
												}, lic.key))
											})]
										})
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "space-y-3 pt-4 border-t border-slate-200 dark:border-slate-800",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h3", {
										className: "text-sm font-bold text-slate-900 dark:text-white",
										children: [
											"Hardware Fingerprinted Trials (",
											trialsList.length,
											")"
										]
									}), trialsList.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "py-4 text-center text-slate-400 text-xs italic",
										children: "No hardware device trials logged yet."
									}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden",
										children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", {
											className: "w-full text-left text-xs",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", {
												className: "bg-slate-50 dark:bg-slate-800/60 font-bold uppercase text-slate-500 text-[10px]",
												children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { children: [
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
														className: "p-3",
														children: "Hardware ID (HWID)"
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
														className: "p-3",
														children: "Bound Email"
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
														className: "p-3",
														children: "First Claimed"
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
														className: "p-3",
														children: "Status"
													})
												] })
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tbody", {
												className: "divide-y divide-slate-100 dark:divide-slate-800 font-mono",
												children: trialsList.map((tr) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
													className: "hover:bg-slate-50/50 dark:hover:bg-slate-800/40",
													children: [
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
															className: "p-3 text-slate-700 dark:text-slate-300 font-bold",
															children: tr.hwid
														}),
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
															className: "p-3 text-slate-500",
															children: tr.email
														}),
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
															className: "p-3 text-slate-500",
															children: new Date(tr.firstSeenAt).toLocaleDateString()
														}),
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
															className: "p-3",
															children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
																className: `px-2 py-0.5 rounded-full text-[10px] font-bold ${Date.now() > tr.expiresAt ? "bg-red-500/10 text-red-500" : "bg-blue-500/10 text-blue-500"}`,
																children: Date.now() > tr.expiresAt ? "EXPIRED" : "FREE_TRIAL"
															})
														})
													]
												}, tr.hwid))
											})]
										})
									})]
								})
							]
						})
					]
				})]
			})]
		}), editingPermissionsFor && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "bg-white dark:bg-slate-900 rounded-2xl shadow-xl max-w-md w-full border border-slate-200 dark:border-slate-800 overflow-hidden",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
							className: "font-bold text-lg",
							children: "App Permissions"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-sm text-slate-500",
							children: editingPermissionsFor.email
						})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							onClick: () => setEditingPermissionsFor(null),
							className: "text-slate-400 hover:text-slate-600",
							children: "×"
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "p-0 max-h-[65vh] overflow-y-auto",
						children: NAV.map((navItem, i) => {
							if (navItem.kind !== "group") return null;
							const items = navItem.children.filter((c) => !c.isHeader && c.to);
							if (items.length === 0) return null;
							const isSectionUnlocked = items.every((item) => {
								const routeKey = item.to.replace("/", "");
								return routeKey === "ventilation" ? editingPermissionsFor.features?.[routeKey] !== false : editingPermissionsFor.features?.[routeKey] === true;
							});
							return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "border-b border-slate-100 dark:border-slate-800 last:border-0 p-6 space-y-4",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex items-center justify-between mb-2",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h4", {
										className: "font-bold text-sm uppercase tracking-wider text-slate-500",
										children: navItem.label
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex items-center gap-2",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "text-[10px] font-bold uppercase tracking-wider text-slate-400",
											children: "Toggle All"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
											onClick: () => toggleSection(items),
											className: `relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${isSectionUnlocked ? "bg-blue-600" : "bg-slate-300 dark:bg-slate-700"}`,
											children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: `inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${isSectionUnlocked ? "translate-x-5" : "translate-x-1"}` })
										})]
									})]
								}), items.map((item, j) => {
									const routeKey = item.to.replace("/", "");
									const isUnlocked = routeKey === "ventilation" ? editingPermissionsFor.features?.[routeKey] !== false : editingPermissionsFor.features?.[routeKey] === true;
									return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h4", {
											className: "font-medium text-sm",
											children: item.label
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
											className: "text-xs text-slate-500",
											children: ["Path: ", item.to]
										})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
											onClick: () => toggleFeature(routeKey),
											className: `relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${isUnlocked ? "bg-blue-600" : "bg-slate-300 dark:bg-slate-700"}`,
											children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: `inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${isUnlocked ? "translate-x-5" : "translate-x-1"}` })
										})]
									}, j);
								})]
							}, i);
						})
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/20 text-right",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							onClick: () => setEditingPermissionsFor(null),
							className: "px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700",
							children: "Done"
						})
					})
				]
			})
		})]
	});
}
var PLATFORM_ROLES = [
	"Jr. Design Engineer",
	"Design Engineer",
	"Sr. Design Engineer",
	"Discipline Coordinator",
	"BIM Modeler",
	"BIM Coordinator",
	"Team Leader",
	"2D Draftsman",
	"Viewer",
	"Client"
];
function OrgAdminDashboard() {
	const { session, profile: currentUserProfile, userData, logout } = useAuth();
	const confirm = useConfirm();
	const navigate = useNavigate();
	const [activeTab, setActiveTab] = (0, import_react.useState)("users");
	const [users, setUsers] = (0, import_react.useState)([]);
	const [loading, setLoading] = (0, import_react.useState)(false);
	const [selectedRoleFilter, setSelectedRoleFilter] = (0, import_react.useState)("ALL");
	const [sortByRole, setSortByRole] = (0, import_react.useState)(true);
	const [showInviteModal, setShowInviteModal] = (0, import_react.useState)(false);
	const [inviteEmail, setInviteEmail] = (0, import_react.useState)("");
	const [inviteName, setInviteName] = (0, import_react.useState)("");
	const [inviteRole, setInviteRole] = (0, import_react.useState)("Design Engineer");
	const [isInviting, setIsInviting] = (0, import_react.useState)(false);
	const [activityLogs, setActivityLogs] = (0, import_react.useState)([]);
	const [loadingLogs, setLoadingLogs] = (0, import_react.useState)(false);
	const [logCategoryFilter, setLogCategoryFilter] = (0, import_react.useState)("ALL");
	const [logSearchQuery, setLogSearchQuery] = (0, import_react.useState)("");
	const [localBackupPath, setLocalBackupPath] = (0, import_react.useState)(localStorage.getItem("localBackupPath") || "");
	const [serverBackupPath, setServerBackupPath] = (0, import_react.useState)(localStorage.getItem("serverBackupPath") || "");
	const [announcements, setAnnouncements] = (0, import_react.useState)([]);
	const [loadingAnnouncements, setLoadingAnnouncements] = (0, import_react.useState)(false);
	const [newAnnouncementMsg, setNewAnnouncementMsg] = (0, import_react.useState)("");
	const [newAnnouncementType, setNewAnnouncementType] = (0, import_react.useState)("info");
	const fetchUsers = async () => {
		setLoading(true);
		setUsers(await api.getOrgUsers() || []);
		setLoading(false);
	};
	const fetchOrgActivityLogs = async () => {
		setLoadingLogs(true);
		setActivityLogs(await api.getOrgActivityLogs() || []);
		setLoadingLogs(false);
	};
	const fetchAnnouncements = async () => {
		setLoadingAnnouncements(true);
		const data = await api.getAnnouncements();
		if (data) setAnnouncements(data);
		setLoadingAnnouncements(false);
	};
	const fetchBackupSettings = async () => {
		const res = await api.getOrgBackupSettings();
		if (res && res.success) {
			if (res.local_backup_path) setLocalBackupPath(res.local_backup_path);
			if (res.server_backup_path) setServerBackupPath(res.server_backup_path);
		}
	};
	(0, import_react.useEffect)(() => {
		fetchUsers();
		fetchOrgActivityLogs();
		if (activeTab === "storage") fetchBackupSettings();
		if (activeTab === "broadcasts") fetchAnnouncements();
	}, [activeTab]);
	const stats = (0, import_react.useMemo)(() => {
		const totalMembers = users.length;
		const activeMembers = users.filter((u) => u.status === "active" || u.status === "ACTIVE").length;
		const loginsCount = activityLogs.filter((l) => l.action_type === "LOGIN").length;
		const viewsCount = activityLogs.filter((l) => l.action_type === "VIEWED" || l.action_type === "VIEW_CALCULATOR").length;
		const updatesCount = activityLogs.filter((l) => l.action_type === "UPDATED" || l.action_type?.includes("UPDATE")).length;
		const todayStr = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
		return {
			totalMembers,
			activeMembers,
			loginsCount,
			viewsCount,
			updatesCount,
			activeToday: new Set(activityLogs.filter((l) => l.created_at && l.created_at.startsWith(todayStr)).map((l) => l.name || l.email || l.user_id)).size || Math.min(activeMembers, totalMembers)
		};
	}, [users, activityLogs]);
	const handleInviteUser = async (e) => {
		e.preventDefault();
		if (!inviteEmail || !inviteName) return toast.error("Please fill all fields");
		setIsInviting(true);
		const res = await api.inviteOrgUser({
			email: inviteEmail,
			name: inviteName,
			role: inviteRole
		});
		if (res.success) {
			toast.success("User invited successfully!");
			setShowInviteModal(false);
			setInviteEmail("");
			setInviteName("");
			setInviteRole("Design Engineer");
			fetchUsers();
		} else toast.error(res.message || "Failed to invite user");
		setIsInviting(false);
	};
	const handleRemoveUser = async (user) => {
		if (!await confirm(`Are you sure you want to remove ${user.email} from the organization?`, {
			title: "Confirm Removal",
			kind: "warning"
		})) return;
		toast.info("Removing user...");
		const res = await api.adminDeleteUser(user.id);
		if (res && res.success) {
			toast.success("User removed successfully");
			fetchUsers();
		} else toast.error("Failed to remove user");
	};
	const handleChangeRole = async (user, newRole) => {
		if (user.id === currentUserProfile?.id) {
			toast.error("You cannot change your own role.");
			return;
		}
		toast.info(`Updating role for ${user.email} to ${newRole}...`);
		const res = await api.adminToggleRole(user.id, newRole);
		if (res && res.success) {
			toast.success(`Role for ${user.name || user.email} updated to ${newRole}`);
			fetchUsers();
		} else toast.error(res.message || "Failed to update role");
	};
	const ROLE_ORDER = {
		"ORG_ADMIN": 1,
		"jr. Design Engineer": 2,
		"Design Engineer": 3,
		"Sr. Design Engineer": 4,
		"Discipline Coordinator": 5,
		"BIM Modeler": 6,
		"BIM Coordinator": 7,
		"Team Leader": 8,
		"2D Draftsman": 9,
		"Viewer": 10,
		"Client": 11
	};
	const handlePickFolder = async (type) => {
		try {
			if (typeof window !== "undefined") {
				const { open: openFileDialog } = await import("../_libs/tauri-apps__plugin-dialog.mjs").then((n) => n.t);
				const selected = await openFileDialog({
					directory: true,
					multiple: false,
					title: type === "local" ? "Select Local Backup Folder" : "Select Server Backup Folder"
				});
				if (selected && typeof selected === "string") if (type === "local") {
					setLocalBackupPath(selected);
					localStorage.setItem("localBackupPath", selected);
					toast.success("Local backup path updated!");
				} else {
					setServerBackupPath(selected);
					localStorage.setItem("serverBackupPath", selected);
					toast.success("Server backup path updated!");
				}
			}
		} catch (e) {
			toast.error("Failed to pick folder");
		}
	};
	const handleCreateAnnouncement = async (e) => {
		e.preventDefault();
		if (!newAnnouncementMsg.trim()) return;
		const res = await api.createAnnouncement(newAnnouncementMsg, true);
		if (!res.success) toast.error(res.message);
		else {
			toast.success("Broadcast created successfully!");
			setNewAnnouncementMsg("");
			fetchAnnouncements();
		}
	};
	const toggleAnnouncement = async (id, currentStatus) => {
		const res = await api.toggleAnnouncement(id, !currentStatus);
		if (!res.success) toast.error(res.message);
		else fetchAnnouncements();
	};
	const deleteAnnouncement = async (id) => {
		if (!await confirm("Delete this broadcast permanently?", {
			title: "Delete Broadcast",
			confirmText: "Delete",
			cancelText: "Cancel"
		})) return;
		const res = await api.deleteAnnouncement(id);
		if (!res.success) toast.error(res.message);
		else fetchAnnouncements();
	};
	const formatLogDetail = (log) => {
		const d = log.details || {};
		const isObj = typeof d === "object" && d !== null;
		if (log.action_type === "LOGIN") return "User logged into platform";
		if (log.action_type === "VIEWED" || log.action_type === "VIEW_CALCULATOR") return `Viewed ${isObj ? d.calculator_name || d.calculator || d.path || "Calculator" : d}`;
		if (log.action_type === "UPDATED") {
			const calcName = isObj ? d.calculator_name || d.calculator || "calculator" : "calculator";
			const summary = isObj ? d.summary || d.message || "" : String(d);
			return `Changes occurred / updated values in ${calcName}${summary ? ` (${summary})` : ""}`;
		}
		if (isObj) {
			if (d.message) return d.message;
			if (d.summary) return d.summary;
			return Object.entries(d).map(([k, v]) => `${k}: ${v}`).join(" | ");
		}
		return String(d || "No details provided");
	};
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 overflow-hidden font-sans",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "w-64 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col shrink-0",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "p-6 border-b border-slate-100 dark:border-slate-800/80",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
								onClick: () => navigate({ to: "/" }),
								className: "flex items-center gap-2 text-xs font-semibold text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors mb-4",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ArrowLeft, { className: "w-4 h-4" }), "Back to App"]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h1", {
								className: "text-xl font-extrabold tracking-tight text-slate-900 dark:text-white flex items-center gap-2",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ShieldCheck, { className: "w-5 h-5 text-slate-700 dark:text-slate-300 shrink-0" }), "Org Admin"]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-xs text-slate-500 mt-1 font-medium",
								children: "Control Panel & Team Analytics"
							})
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("nav", {
						className: "p-4 space-y-1.5 flex-1 overflow-y-auto",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
								onClick: () => setActiveTab("users"),
								className: `w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-semibold transition-all ${activeTab === "users" ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-sm" : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60"}`,
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex items-center gap-3",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Users, { className: "w-4 h-4" }), "Team Members"]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: `text-xs px-2 py-0.5 rounded-full font-bold ${activeTab === "users" ? "bg-white/20 dark:bg-slate-900/20" : "bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400"}`,
									children: users.length
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
								onClick: () => setActiveTab("activity"),
								className: `w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-semibold transition-all ${activeTab === "activity" ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-sm" : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60"}`,
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex items-center gap-3",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Activity, { className: "w-4 h-4" }), "Activity Audit Logs"]
								}), activityLogs.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: `text-xs px-2 py-0.5 rounded-full font-bold ${activeTab === "activity" ? "bg-white/20 dark:bg-slate-900/20" : "bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400"}`,
									children: activityLogs.length
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
								onClick: () => setActiveTab("storage"),
								className: `w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${activeTab === "storage" ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-sm" : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60"}`,
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(HardDrive, { className: "w-4 h-4" }), "Server & Sync Settings"]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
								onClick: () => setActiveTab("broadcasts"),
								className: `w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${activeTab === "broadcasts" ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-sm" : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60"}`,
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Megaphone, { className: "w-4 h-4" }), "Global Broadcasts"]
							})
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "p-4 m-3 bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-xl",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center gap-2.5",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "w-8 h-8 rounded-full bg-slate-800 text-white font-bold flex items-center justify-center text-xs shrink-0 border border-slate-700",
								children: (currentUserProfile?.name || currentUserProfile?.email || "A")[0].toUpperCase()
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "min-w-0 flex-1",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "text-xs font-bold truncate text-slate-900 dark:text-slate-100",
									children: currentUserProfile?.name || "Org Admin"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "text-[11px] text-slate-500 truncate",
									children: currentUserProfile?.email
								})]
							})]
						})
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-950",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "w-full px-6 py-6 lg:px-8 space-y-6",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex items-center justify-between",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
												className: "text-[11px] font-bold uppercase tracking-wider text-slate-500",
												children: "Total Members"
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Users, { className: "w-4 h-4 text-slate-600 dark:text-slate-400" })]
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
											className: "text-2xl font-extrabold text-slate-900 dark:text-white mt-1",
											children: stats.totalMembers
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "text-[11px] text-slate-500 font-semibold mt-0.5",
											children: [stats.activeMembers, " Active Users"]
										})
									]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex items-center justify-between",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
												className: "text-[11px] font-bold uppercase tracking-wider text-slate-500",
												children: "Active Today"
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(UserCheck, { className: "w-4 h-4 text-slate-600 dark:text-slate-400" })]
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
											className: "text-2xl font-extrabold text-slate-900 dark:text-white mt-1",
											children: stats.activeToday
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
											className: "text-[11px] text-slate-500 font-medium mt-0.5",
											children: "Logged in today"
										})
									]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex items-center justify-between",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
												className: "text-[11px] font-bold uppercase tracking-wider text-slate-500",
												children: "Total Logins"
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Key, { className: "w-4 h-4 text-slate-600 dark:text-slate-400" })]
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
											className: "text-2xl font-extrabold text-slate-900 dark:text-white mt-1",
											children: stats.loginsCount
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
											className: "text-[11px] text-slate-500 font-medium mt-0.5",
											children: "Login events logged"
										})
									]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex items-center justify-between",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
												className: "text-[11px] font-bold uppercase tracking-wider text-slate-500",
												children: "Calculator Views"
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Eye, { className: "w-4 h-4 text-slate-600 dark:text-slate-400" })]
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
											className: "text-2xl font-extrabold text-slate-900 dark:text-white mt-1",
											children: stats.viewsCount
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
											className: "text-[11px] text-slate-500 font-medium mt-0.5",
											children: "Page views recorded"
										})
									]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex items-center justify-between",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
												className: "text-[11px] font-bold uppercase tracking-wider text-slate-500",
												children: "Updates / Changes"
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PenLine, { className: "w-4 h-4 text-slate-600 dark:text-slate-400" })]
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
											className: "text-2xl font-extrabold text-slate-900 dark:text-white mt-1",
											children: stats.updatesCount
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
											className: "text-[11px] text-slate-500 font-medium mt-0.5",
											children: "Changes occurred"
										})
									]
								})
							]
						}),
						activeTab === "users" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-2xs space-y-6",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex flex-col md:flex-row md:items-center justify-between gap-4",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
										className: "text-xl font-bold text-slate-900 dark:text-white",
										children: "Organization Team Members"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "text-xs text-slate-500 mt-0.5",
										children: "Manage user access and assign platform roles to organization members."
									})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
										onClick: () => setShowInviteModal(true),
										className: "flex items-center gap-2 bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-slate-200 dark:text-slate-900 text-white px-4 py-2.5 rounded-xl text-xs font-bold transition shrink-0 shadow-2xs",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, { className: "w-4 h-4" }), "Invite Team Member"]
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3",
									children: [
										{
											key: "Design Engineer",
											label: "Design Engineers"
										},
										{
											key: "BIM Modeler",
											label: "BIM Modelers"
										},
										{
											key: "Team Leader",
											label: "Team Leaders"
										},
										{
											key: "Viewer",
											label: "Viewers"
										},
										{
											key: "Client",
											label: "Clients"
										}
									].map((item) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										onClick: () => setSelectedRoleFilter(item.key),
										className: `p-3.5 rounded-xl border transition-all cursor-pointer ${selectedRoleFilter === item.key ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 border-transparent shadow-xs" : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 text-slate-700 dark:text-slate-300"}`,
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
											className: "text-[11px] font-bold uppercase tracking-wider opacity-75",
											children: item.label
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
											className: "text-xl font-extrabold mt-0.5",
											children: users.filter((u) => u.role === item.key || item.key === "Design Engineer" && (u.role === "ENGINEER" || u.role === "USER")).length
										})]
									}, item.key))
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "p-4 bg-slate-50 dark:bg-slate-950/60 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex items-center gap-3",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
											className: "text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5 shrink-0",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Funnel, {
												size: 14,
												className: "text-slate-700 dark:text-slate-300"
											}), "Filter by Role:"]
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
											value: selectedRoleFilter,
											onChange: (e) => setSelectedRoleFilter(e.target.value),
											className: "text-xs p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-slate-400 cursor-pointer min-w-[220px]",
											children: [
												/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("option", {
													value: "ALL",
													children: [
														"All Roles (",
														users.length,
														")"
													]
												}),
												PLATFORM_ROLES.map((r) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
													value: r,
													children: r
												}, r)),
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
													value: "ORG_ADMIN",
													children: "Org Admin"
												})
											]
										})]
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "flex items-center gap-2",
										children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
											onClick: () => setSortByRole(!sortByRole),
											className: `text-xs px-3 py-1.5 rounded-lg border font-semibold transition ${sortByRole ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 border-transparent" : "bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400"}`,
											children: sortByRole ? "Sorted by Role Hierarchy" : "Sorted Alphabetically"
										})
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-2xs",
									children: loading ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "flex items-center justify-center p-12",
										children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, { className: "w-8 h-8 animate-spin text-slate-600 dark:text-slate-400" })
									}) : users.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "p-12 text-center text-slate-500",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Users, { className: "w-12 h-12 mx-auto mb-4 opacity-20" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "No team members found." })]
									}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "overflow-x-auto",
										children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", {
											className: "w-full text-sm text-left",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", {
												className: "text-xs text-slate-500 uppercase bg-slate-50 dark:bg-slate-950/60 border-b border-slate-200 dark:border-slate-800",
												children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { children: [
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
														className: "px-6 py-4 font-bold",
														children: "Team Member"
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
														className: "px-6 py-4 font-bold",
														children: "Assigned Platform Role"
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
														className: "px-6 py-4 font-bold",
														children: "Account Status"
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
														className: "px-6 py-4 font-bold text-right",
														children: "Actions"
													})
												] })
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tbody", {
												className: "divide-y divide-slate-200 dark:divide-slate-800",
												children: users.filter((u) => {
													if (selectedRoleFilter === "ALL") return true;
													if (selectedRoleFilter === "Design Engineer") return u.role === "Design Engineer" || u.role === "ENGINEER" || u.role === "USER";
													return u.role === selectedRoleFilter;
												}).sort((a, b) => {
													if (sortByRole) {
														const orderA = ROLE_ORDER[a.role] || 99;
														const orderB = ROLE_ORDER[b.role] || 99;
														if (orderA !== orderB) return orderA - orderB;
													}
													return (a.name || a.email).localeCompare(b.name || b.email);
												}).map((u) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
													className: "hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition",
													children: [
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
															className: "px-6 py-4",
															children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
																className: "flex items-center gap-3",
																children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
																	className: "w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-extrabold flex items-center justify-center text-xs shrink-0 border border-slate-200 dark:border-slate-700",
																	children: (u.name || u.email || "U")[0].toUpperCase()
																}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
																	className: "font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5",
																	children: [u.role === "ORG_ADMIN" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Crown, {
																		size: 14,
																		className: "text-amber-500 shrink-0",
																		title: "Org Admin"
																	}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: u.name || u.email })]
																}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
																	className: "text-slate-500 text-xs mt-0.5",
																	children: u.email
																})] })]
															})
														}),
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
															className: "px-6 py-4",
															children: u.id === currentUserProfile?.id ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
																className: "px-2.5 py-1 bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-md text-xs font-bold border border-slate-300 dark:border-slate-700",
																children: "Org Admin (You)"
															}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
																value: u.role || "Design Engineer",
																onChange: (e) => handleChangeRole(u, e.target.value),
																className: "text-xs px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-slate-400 cursor-pointer shadow-2xs",
																children: [PLATFORM_ROLES.map((r) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
																	value: r,
																	children: r
																}, r)), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
																	value: "ORG_ADMIN",
																	children: "Org Admin"
																})]
															})
														}),
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
															className: "px-6 py-4",
															children: u.status === "invited" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
																className: "px-2.5 py-1 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-900/50 rounded-full text-[11px] font-bold",
																children: "Pending Invite"
															}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
																className: "px-2.5 py-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-full text-[11px] font-bold",
																children: "Active"
															})
														}),
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
															className: "px-6 py-4 text-right",
															children: u.id !== currentUserProfile?.id && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
																onClick: () => handleRemoveUser(u),
																className: "p-2 text-slate-400 hover:text-red-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition",
																title: "Remove User",
																children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Trash2, { className: "w-4 h-4" })
															})
														})
													]
												}, u.id))
											})]
										})
									})
								})
							]
						}),
						activeTab === "activity" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-2xs space-y-6",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex flex-col md:flex-row md:items-center justify-between gap-4",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h2", {
										className: "text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Activity, { className: "w-5 h-5 text-slate-700 dark:text-slate-300" }), "Team Activity Audit Logs"]
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "text-xs text-slate-500 mt-0.5",
										children: "Real-time audit log tracking Logins, Calculator Views, and Parameter Updates (\"Changes Occurred\") across your team."
									})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
										onClick: fetchOrgActivityLogs,
										className: "flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition self-start md:self-auto",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Clock, { className: "w-3.5 h-3.5" }), "Refresh Activity Logs"]
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "p-4 bg-slate-50 dark:bg-slate-950/60 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-4",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex items-center gap-2 flex-wrap",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
											className: "text-xs font-bold uppercase tracking-wider text-slate-500 mr-1 flex items-center gap-1",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Funnel, {
												size: 14,
												className: "text-slate-700 dark:text-slate-300"
											}), " Filter:"]
										}), [
											{
												id: "ALL",
												label: "All Actions"
											},
											{
												id: "LOGIN",
												label: "🔑 Logins"
											},
											{
												id: "VIEWED",
												label: "👁️ Views"
											},
											{
												id: "UPDATED",
												label: "✏️ Changes / Updates"
											},
											{
												id: "CALCULATION_RUN",
												label: "🧮 Calculations"
											},
											{
												id: "REPORT_GENERATED",
												label: "📄 Reports"
											},
											{
												id: "USER_MGMT",
												label: "👥 Team Mgmt"
											}
										].map((cat) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
											onClick: () => setLogCategoryFilter(cat.id),
											className: `text-xs px-3 py-1.5 rounded-lg font-bold transition ${logCategoryFilter === cat.id ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-2xs" : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100"}`,
											children: cat.label
										}, cat.id))]
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "relative min-w-[240px]",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Search, {
											size: 15,
											className: "absolute left-3 top-2.5 text-slate-400"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
											type: "text",
											value: logSearchQuery,
											onChange: (e) => setLogSearchQuery(e.target.value),
											placeholder: "Search by user name, email, or action...",
											className: "w-full pl-9 pr-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold"
										})]
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-2xs",
									children: loadingLogs ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "flex items-center justify-center p-12",
										children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, { className: "w-8 h-8 animate-spin text-slate-600 dark:text-slate-400" })
									}) : activityLogs.filter((log) => {
										if (logCategoryFilter === "LOGIN" && log.action_type !== "LOGIN") return false;
										if (logCategoryFilter === "VIEWED" && log.action_type !== "VIEWED" && log.action_type !== "VIEW_CALCULATOR") return false;
										if (logCategoryFilter === "UPDATED" && log.action_type !== "UPDATED" && !log.action_type?.includes("UPDATE")) return false;
										if (logCategoryFilter === "CALCULATION_RUN" && !log.action_type?.includes("CALCULATION")) return false;
										if (logCategoryFilter === "REPORT_GENERATED" && !log.action_type?.includes("REPORT") && log.action_type !== "EXPORT") return false;
										if (logCategoryFilter === "USER_MGMT" && (log.action_type === "LOGIN" || log.action_type === "VIEWED" || log.action_type === "UPDATED" || log.action_type?.includes("CALCULATION") || log.action_type?.includes("REPORT"))) return false;
										if (logSearchQuery.trim()) {
											const q = logSearchQuery.toLowerCase();
											const name = (log.name || log.profiles?.name || "").toLowerCase();
											const email = (log.profiles?.email || log.email || "").toLowerCase();
											const action = (log.action_type || "").toLowerCase();
											const detailsStr = typeof log.details === "string" ? log.details.toLowerCase() : JSON.stringify(log.details || {}).toLowerCase();
											return name.includes(q) || email.includes(q) || action.includes(q) || detailsStr.includes(q);
										}
										return true;
									}).length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "p-12 text-center text-slate-500",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Activity, { className: "w-12 h-12 mx-auto mb-4 opacity-20" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
											className: "font-semibold text-sm",
											children: "No activity logs found for this filter."
										})]
									}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "overflow-x-auto",
										children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", {
											className: "w-full text-sm text-left",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", {
												className: "text-xs text-slate-500 uppercase bg-slate-50 dark:bg-slate-950/60 border-b border-slate-200 dark:border-slate-800",
												children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { children: [
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
														className: "px-6 py-4 font-bold",
														children: "Timestamp"
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
														className: "px-6 py-4 font-bold",
														children: "Team Member (Name & Email)"
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
														className: "px-6 py-4 font-bold",
														children: "Action Type"
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
														className: "px-6 py-4 font-bold",
														children: "Activity Summary & Details"
													})
												] })
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tbody", {
												className: "divide-y divide-slate-200 dark:divide-slate-800",
												children: activityLogs.filter((log) => {
													if (logCategoryFilter === "LOGIN" && log.action_type !== "LOGIN") return false;
													if (logCategoryFilter === "VIEWED" && log.action_type !== "VIEWED" && log.action_type !== "VIEW_CALCULATOR") return false;
													if (logCategoryFilter === "UPDATED" && log.action_type !== "UPDATED" && !log.action_type?.includes("UPDATE")) return false;
													if (logCategoryFilter === "CALCULATION_RUN" && !log.action_type?.includes("CALCULATION")) return false;
													if (logCategoryFilter === "REPORT_GENERATED" && !log.action_type?.includes("REPORT") && log.action_type !== "EXPORT") return false;
													if (logCategoryFilter === "USER_MGMT" && (log.action_type === "LOGIN" || log.action_type === "VIEWED" || log.action_type === "UPDATED" || log.action_type?.includes("CALCULATION") || log.action_type?.includes("REPORT"))) return false;
													if (logSearchQuery.trim()) {
														const q = logSearchQuery.toLowerCase();
														const name = (log.name || log.profiles?.name || "").toLowerCase();
														const email = (log.profiles?.email || log.email || "").toLowerCase();
														const action = (log.action_type || "").toLowerCase();
														const detailsStr = typeof log.details === "string" ? log.details.toLowerCase() : JSON.stringify(log.details || {}).toLowerCase();
														return name.includes(q) || email.includes(q) || action.includes(q) || detailsStr.includes(q);
													}
													return true;
												}).map((log) => {
													const userName = log.name || log.profiles?.name || log.user_name || log.email || "Team User";
													const userEmail = log.profiles?.email || log.email || "";
													const isLogin = log.action_type === "LOGIN";
													const isView = log.action_type === "VIEWED" || log.action_type === "VIEW_CALCULATOR";
													const isUpdate = log.action_type === "UPDATED" || log.action_type?.includes("UPDATE");
													const isReport = log.action_type?.includes("REPORT") || log.action_type === "EXPORT";
													return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
														className: "hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition",
														children: [
															/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
																className: "px-6 py-4 text-xs font-mono text-slate-500 whitespace-nowrap",
																children: new Date(log.created_at).toLocaleString()
															}),
															/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
																className: "px-6 py-4",
																children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
																	className: "flex items-center gap-3",
																	children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
																		className: "w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-extrabold flex items-center justify-center text-xs shrink-0 border border-slate-200 dark:border-slate-700",
																		children: (userName || "U")[0].toUpperCase()
																	}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
																		className: "font-extrabold text-slate-900 dark:text-slate-100 text-xs",
																		children: userName
																	}), userEmail && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
																		className: "text-[11px] text-slate-500",
																		children: userEmail
																	})] })]
																})
															}),
															/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
																className: "px-6 py-4",
																children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
																	className: "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700",
																	children: [
																		isLogin && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Key, { size: 12 }),
																		isView && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Eye, { size: 12 }),
																		isUpdate && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PenLine, { size: 12 }),
																		isReport && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(FileText, { size: 12 }),
																		isUpdate ? "UPDATED / CHANGES" : log.action_type
																	]
																})
															}),
															/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
																className: "px-6 py-4 text-xs font-medium text-slate-700 dark:text-slate-300",
																children: formatLogDetail(log)
															})
														]
													}, log.id);
												})
											})]
										})
									})
								})
							]
						}),
						activeTab === "storage" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-2xs space-y-6",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
								className: "text-xl font-bold",
								children: "Server & Sync Settings"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "space-y-8 max-w-3xl",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "bg-slate-50 dark:bg-slate-950/60 p-6 rounded-xl border border-slate-200 dark:border-slate-800",
										children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex items-start gap-4",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
												className: "p-3 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg",
												children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(HardDrive, { className: "w-6 h-6" })
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "flex-1",
												children: [
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
														className: "font-semibold text-lg",
														children: "10-Minute Local Backup (AppData)"
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
														className: "text-sm text-slate-500 mb-4",
														children: "Automatically save project versions locally every 10 minutes to prevent data loss."
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
														className: "flex gap-2",
														children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
															type: "text",
															value: localBackupPath,
															onChange: (e) => setLocalBackupPath(e.target.value),
															placeholder: "C:\\Users\\Admin\\AppData\\Local\\MEPCalc\\Backups",
															className: "flex-1 px-4 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm"
														}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
															onClick: () => handlePickFolder("local"),
															className: "flex items-center gap-2 px-4 py-2 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-lg text-sm font-semibold hover:bg-slate-800 transition-colors",
															children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FolderOpen, { className: "w-4 h-4" }), "Browse"]
														})]
													})
												]
											})]
										})
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "bg-slate-50 dark:bg-slate-950/60 p-6 rounded-xl border border-slate-200 dark:border-slate-800",
										children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex items-start gap-4",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
												className: "p-3 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg",
												children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Save, { className: "w-6 h-6" })
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "flex-1",
												children: [
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
														className: "font-semibold text-lg",
														children: "1-Hour Server Backup"
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
														className: "text-sm text-slate-500 mb-4",
														children: "Automatically sync a major version of the project to your local server drive or cloud sync folder every hour."
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
														className: "flex gap-2",
														children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
															type: "text",
															value: serverBackupPath,
															onChange: (e) => setServerBackupPath(e.target.value),
															placeholder: "Z:/00 R&D Server/Backups",
															className: "flex-1 px-4 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm"
														}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
															onClick: () => handlePickFolder("server"),
															className: "flex items-center gap-2 px-4 py-2 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-lg text-sm font-semibold hover:bg-slate-800 transition-colors",
															children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FolderOpen, { className: "w-4 h-4" }), "Browse"]
														})]
													})
												]
											})]
										})
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "pt-6 border-t border-slate-200 dark:border-slate-800",
										children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
											onClick: async () => {
												localStorage.setItem("localBackupPath", localBackupPath);
												localStorage.setItem("serverBackupPath", serverBackupPath);
												toast.info("Saving backup settings to backend...");
												const res = await api.saveOrgBackupSettings(localBackupPath, serverBackupPath);
												if (res && res.success) toast.success("Organization backup settings saved to backend successfully!");
												else toast.error(res.message || "Failed to save backup settings");
											},
											className: "px-6 py-2.5 bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-slate-200 dark:text-slate-900 text-white font-bold text-xs rounded-xl transition-colors shadow-2xs",
											children: "Save Backup Settings"
										})
									})
								]
							})]
						}),
						activeTab === "broadcasts" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-2xs space-y-6",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex items-center justify-between",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
										className: "text-xl font-bold",
										children: "Global Broadcasts"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
										onClick: fetchAnnouncements,
										className: "text-xs font-bold text-slate-700 hover:underline dark:text-slate-300",
										children: "Refresh"
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "p-5 border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 rounded-xl",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
										className: "text-sm font-semibold mb-3",
										children: "Create New Broadcast"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
										onSubmit: handleCreateAnnouncement,
										className: "flex gap-3",
										children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
												className: "flex-1",
												children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
													type: "text",
													placeholder: "Type your message here (e.g., Update 2.0 is coming tomorrow)",
													required: true,
													value: newAnnouncementMsg,
													onChange: (e) => setNewAnnouncementMsg(e.target.value),
													className: "w-full text-sm p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
												})
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
												value: newAnnouncementType,
												onChange: (e) => setNewAnnouncementType(e.target.value),
												className: "text-sm p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 w-32 font-bold",
												children: [
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
														value: "info",
														children: "Info"
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
														value: "warning",
														children: "Warning"
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
														value: "success",
														children: "Success"
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
														value: "error",
														children: "Error"
													})
												]
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
												type: "submit",
												className: "px-4 py-2 bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 text-white font-bold rounded-lg text-xs transition-colors shadow-2xs",
												children: "Broadcast"
											})
										]
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "space-y-4",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
										className: "text-sm font-semibold",
										children: "Past Broadcasts"
									}), loadingAnnouncements ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "py-8 text-center",
										children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, { className: "w-6 h-6 animate-spin mx-auto text-slate-400" })
									}) : announcements.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "py-8 text-center text-slate-500 text-sm",
										children: "No broadcasts found."
									}) : announcements.map((ann) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: `p-4 rounded-xl border flex items-center justify-between ${ann.is_active ? "border-slate-300 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/40" : "border-slate-200 bg-slate-50 opacity-60 dark:border-slate-800 dark:bg-slate-900/30"}`,
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex items-center gap-2 mb-1",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
												className: "text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-md bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-600",
												children: ann.type
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
												className: "text-xs text-slate-500",
												children: new Date(ann.created_at).toLocaleString()
											})]
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
											className: `text-sm ${ann.is_active ? "text-slate-900 dark:text-slate-100 font-medium" : "line-through text-slate-500"}`,
											children: ann.message
										})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex items-center gap-3",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
												onClick: () => toggleAnnouncement(ann.id, ann.is_active),
												className: "text-xs px-3 py-1.5 rounded-md font-bold transition-colors bg-slate-200 text-slate-800 hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-200",
												children: ann.is_active ? "Deactivate" : "Reactivate"
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
												onClick: () => deleteAnnouncement(ann.id),
												className: "p-1.5 text-slate-400 hover:text-red-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-colors",
												children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Trash2, { className: "w-4 h-4" })
											})]
										})]
									}, ann.id))]
								})
							]
						})
					]
				})
			}),
			showInviteModal && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-md rounded-2xl overflow-hidden shadow-2xl",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
							className: "font-bold text-slate-900 dark:text-white",
							children: "Invite Team Member"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							onClick: () => setShowInviteModal(false),
							className: "text-slate-400 hover:text-slate-700 dark:hover:text-white font-bold",
							children: "✕"
						})]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
						onSubmit: handleInviteUser,
						className: "p-6 space-y-4",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
								className: "block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1",
								children: "Full Name"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
								type: "text",
								value: inviteName,
								onChange: (e) => setInviteName(e.target.value),
								className: "w-full h-10 px-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-semibold",
								placeholder: "e.g. John Doe",
								required: true
							})] }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
								className: "block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1",
								children: "Email Address"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
								type: "email",
								value: inviteEmail,
								onChange: (e) => setInviteEmail(e.target.value),
								className: "w-full h-10 px-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-semibold",
								placeholder: "john@example.com",
								required: true
							})] }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
								className: "block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1",
								children: "Platform Role"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("select", {
								value: inviteRole,
								onChange: (e) => setInviteRole(e.target.value),
								className: "w-full h-10 px-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-bold text-slate-800 dark:text-slate-200",
								children: PLATFORM_ROLES.map((r) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
									value: r,
									children: r
								}, r))
							})] }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "pt-4 flex gap-3",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									type: "button",
									onClick: () => setShowInviteModal(false),
									className: "flex-1 px-4 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition",
									children: "Cancel"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									type: "submit",
									disabled: isInviting,
									className: "flex-1 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 text-white rounded-xl text-xs font-bold transition disabled:opacity-50 shadow-2xs",
									children: isInviting ? "Inviting..." : "Send Invite"
								})]
							})
						]
					})]
				})
			})
		]
	});
}
var AdminErrorBoundary = class extends import_react.Component {
	constructor(props) {
		super(props);
		this.state = {
			hasError: false,
			error: null
		};
	}
	static getDerivedStateFromError(error) {
		return {
			hasError: true,
			error
		};
	}
	componentDidCatch(error, errorInfo) {
		console.error("Admin Dashboard Error Caught:", error, errorInfo);
	}
	render() {
		if (this.state.hasError) return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "p-8 bg-slate-950 text-white min-h-screen flex flex-col items-center justify-center text-center",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
					className: "text-xl font-bold text-red-400 mb-2",
					children: "Admin Control Panel Error"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-sm text-slate-400 max-w-md mb-4",
					children: this.state.error?.message || "An unexpected rendering error occurred."
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					onClick: () => {
						this.setState({
							hasError: false,
							error: null
						});
						window.location.reload();
					},
					className: "px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium text-sm cursor-pointer",
					children: "Reload Admin Panel"
				})
			]
		});
		return this.props.children;
	}
};
function AdminRoutingComponent() {
	const { session, profile, loading } = useAuth();
	const navigate = useNavigate();
	(0, import_react.useEffect)(() => {
		if (!loading && (!session || !profile)) navigate({ to: "/login" });
	}, [
		session,
		profile,
		loading,
		navigate
	]);
	if (loading || !profile) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "flex items-center justify-center h-screen bg-slate-950 text-white",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, { className: "w-8 h-8 animate-spin text-blue-500" })
	});
	if (profile.role === "SUPER_ADMIN") return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AdminErrorBoundary, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SuperAdminDashboard, {}) });
	if (profile.role === "ORG_ADMIN") return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AdminErrorBoundary, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(OrgAdminDashboard, {}) });
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex flex-col items-center justify-center h-screen bg-slate-950 text-white p-4 text-center",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
				className: "text-2xl font-bold text-red-500 mb-2",
				children: "Access Denied"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-slate-400",
				children: "You do not have permission to view the admin panel."
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				onClick: () => navigate({ to: "/" }),
				className: "mt-6 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium",
				children: "Return to Home"
			})
		]
	});
}
//#endregion
export { AdminRoutingComponent as component };
