import { r as __exportAll$1 } from "../_runtime.mjs";
import { t as axios } from "../_libs/axios+[...].mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/api-BcQvT-mW.js
var api_BcQvT_mW_exports = /* @__PURE__ */ __exportAll$1({
	n: () => api_exports,
	r: () => __exportAll,
	t: () => api
});
var __defProp = Object.defineProperty;
var __exportAll = (all, no_symbols) => {
	let target = {};
	for (var name in all) __defProp(target, name, {
		get: all[name],
		enumerable: true
	});
	if (!no_symbols) __defProp(target, Symbol.toStringTag, { value: "Module" });
	return target;
};
var api_exports = /* @__PURE__ */ __exportAll({ api: () => api });
var getBackendUrl = () => {
	return "https://universal-mep-calculator.onrender.com";
};
axios.interceptors.request.use((config) => {
	const token = localStorage.getItem("auth_token");
	if (token && config.headers) config.headers.Authorization = `Bearer ${token}`;
	return config;
});
var api = {
	async getUsers() {
		let usersList = [];
		try {
			const { data } = await axios.get(`${getBackendUrl()}/api/users/list`);
			if (data.success && Array.isArray(data.users) && data.users.length > 0) usersList = data.users;
		} catch (e) {}
		if (usersList.length === 0) usersList = [
			{
				id: "usr_admin_tarv_ai",
				name: "System Admin",
				email: "admin@tarv.ai",
				role: "SUPER_ADMIN",
				isAccountVerified: true,
				status: "ACTIVE"
			},
			{
				id: "usr_vaishu",
				name: "Vaishnavi Halasage",
				email: "halasagevaishu@gmail.com",
				role: "Sr. Design Engineer",
				isAccountVerified: true,
				status: "ACTIVE"
			},
			{
				id: "usr_abubakar",
				name: "Abubakar Work",
				email: "abubakarswork2@gmail.com",
				role: "Design Engineer",
				isAccountVerified: true,
				status: "ACTIVE"
			},
			{
				id: "usr_kirtan",
				name: "Kirtan Karwa",
				email: "kirtankarwa@sinhgad.edu",
				role: "ORG_ADMIN",
				isAccountVerified: true,
				status: "ACTIVE"
			},
			{
				id: "usr_vikram1",
				name: "Vikram Kadam",
				email: "kadamvikram0304@gmail.com",
				role: "Design Engineer",
				isAccountVerified: true,
				status: "ACTIVE"
			},
			{
				id: "usr_vikram2",
				name: "Vikram Kadam 2",
				email: "kadamvikram0308@gmail.com",
				role: "Jr. Design Engineer",
				isAccountVerified: true,
				status: "ACTIVE"
			}
		];
		try {
			const cachedStr = localStorage.getItem("mep_local_users");
			if (cachedStr) {
				const cachedUsers = JSON.parse(cachedStr);
				const cachedMap = new Map(cachedUsers.map((u) => [u.id, u]));
				usersList = usersList.map((u) => {
					const c = cachedMap.get(u.id);
					return c ? {
						...u,
						...c
					} : u;
				});
			}
		} catch (e) {}
		return usersList;
	},
	async adminToggleRole(profileId, newRole) {
		try {
			const stored = localStorage.getItem("mep_local_users");
			let users = stored ? JSON.parse(stored) : null;
			if (!users || !Array.isArray(users)) users = await this.getUsers();
			users = users.map((u) => u.id === profileId ? {
				...u,
				role: newRole
			} : u);
			localStorage.setItem("mep_local_users", JSON.stringify(users));
		} catch (e) {}
		try {
			const { data } = await axios.post(`${getBackendUrl()}/api/admin/toggle-role`, {
				profileId,
				newRole
			});
			if (data && data.success) return data;
		} catch (error) {
			console.warn("adminToggleRole backend warning:", error);
		}
		return { success: true };
	},
	async adminDeleteUser(profileId) {
		try {
			const { data } = await axios.post(`${getBackendUrl()}/api/admin/delete-user`, { profileId });
			return data;
		} catch (error) {
			return {
				success: false,
				message: error.response?.data?.message || "Failed to delete user"
			};
		}
	},
	async adminUpdateProfile(profileId, updates) {
		try {
			const stored = localStorage.getItem("mep_local_users");
			let users = stored ? JSON.parse(stored) : null;
			if (!users || !Array.isArray(users)) users = await this.getUsers();
			users = users.map((u) => u.id === profileId ? {
				...u,
				...updates
			} : u);
			localStorage.setItem("mep_local_users", JSON.stringify(users));
		} catch (e) {}
		try {
			const { data } = await axios.post(`${getBackendUrl()}/api/admin/update-profile`, {
				profileId,
				updates
			});
			if (data && data.success) return data;
		} catch (error) {
			console.warn("adminUpdateProfile backend warning:", error);
		}
		return { success: true };
	},
	async logActivity(action_type, details) {
		try {
			const { data } = await axios.post(`${getBackendUrl()}/api/activity/log`, {
				action_type,
				details
			});
			return data;
		} catch (e) {
			return { success: false };
		}
	},
	async getAdminActivityLogs() {
		try {
			const { data } = await axios.get(`${getBackendUrl()}/api/admin/activity-logs`);
			return data.success ? data.logs : [];
		} catch (e) {
			return [];
		}
	},
	async getTeams() {
		try {
			const { data } = await axios.get(`${getBackendUrl()}/api/teams/list`);
			return data.success ? data.teams : [];
		} catch (e) {
			return [];
		}
	},
	async createTeam(name) {
		try {
			const { data } = await axios.post(`${getBackendUrl()}/api/teams/create`, { name });
			return data;
		} catch (error) {
			return {
				success: false,
				message: error.response?.data?.message || "Failed to create team"
			};
		}
	},
	async addUserToTeam(team_id, user_id) {
		try {
			const { data } = await axios.post(`${getBackendUrl()}/api/teams/add-user`, {
				team_id,
				user_id
			});
			return data;
		} catch (error) {
			return {
				success: false,
				message: error.response?.data?.message || "Failed to add user"
			};
		}
	},
	async removeUserFromTeam(team_id, user_id) {
		try {
			const { data } = await axios.post(`${getBackendUrl()}/api/teams/remove-user`, {
				team_id,
				user_id
			});
			return data;
		} catch (error) {
			return {
				success: false,
				message: error.response?.data?.message || "Failed to remove user"
			};
		}
	},
	async deleteTeam(team_id) {
		try {
			const { data } = await axios.post(`${getBackendUrl()}/api/teams/delete`, { team_id });
			return data;
		} catch (error) {
			return {
				success: false,
				message: error.response?.data?.message || "Failed to delete team"
			};
		}
	},
	async getProjects() {
		try {
			const { data } = await axios.get(`${getBackendUrl()}/api/projects/list`);
			return data.success ? data.projects : [];
		} catch (e) {
			return [];
		}
	},
	async createProject(projectData, assigned_users, assigned_teams) {
		try {
			const { data } = await axios.post(`${getBackendUrl()}/api/projects/create`, {
				projectData,
				assigned_users,
				assigned_teams
			});
			return data;
		} catch (error) {
			return {
				success: false,
				message: error.response?.data?.message || "Failed to create project"
			};
		}
	},
	async saveWorkspace(project_id, workspace_data) {
		try {
			const { data } = await axios.post(`${getBackendUrl()}/api/projects/save-workspace`, {
				project_id,
				workspace_data
			});
			return data;
		} catch (error) {
			return {
				success: false,
				message: error.response?.data?.message || "Failed to save workspace"
			};
		}
	},
	async deleteProject(project_id) {
		try {
			const { data } = await axios.post(`${getBackendUrl()}/api/projects/delete`, { project_id });
			return data;
		} catch (error) {
			return {
				success: false,
				message: error.response?.data?.message || "Failed to delete project"
			};
		}
	},
	async removeUserFromProject(project_id, user_id) {
		try {
			const { data } = await axios.post(`${getBackendUrl()}/api/projects/remove-user`, {
				project_id,
				user_id
			});
			return data;
		} catch (error) {
			return {
				success: false,
				message: error.response?.data?.message || "Failed to remove user"
			};
		}
	},
	async addUserToProject(project_id, user_id) {
		try {
			const { data } = await axios.post(`${getBackendUrl()}/api/projects/add-user`, {
				project_id,
				user_id
			});
			return data;
		} catch (error) {
			return {
				success: false,
				message: error.response?.data?.message || "Failed to add user"
			};
		}
	},
	async removeTeamFromProject(project_id, team_id) {
		try {
			const { data } = await axios.post(`${getBackendUrl()}/api/projects/remove-team`, {
				project_id,
				team_id
			});
			return data;
		} catch (error) {
			return {
				success: false,
				message: error.response?.data?.message || "Failed to remove team"
			};
		}
	},
	async addTeamToProject(project_id, team_id) {
		try {
			const { data } = await axios.post(`${getBackendUrl()}/api/projects/add-team`, {
				project_id,
				team_id
			});
			return data;
		} catch (error) {
			return {
				success: false,
				message: error.response?.data?.message || "Failed to add team"
			};
		}
	},
	async acceptPrivacyPolicy() {
		try {
			const { data } = await axios.post(`${getBackendUrl()}/api/auth/accept-privacy`);
			return data;
		} catch (error) {
			return {
				success: false,
				message: error.response?.data?.message || "Failed to accept privacy policy"
			};
		}
	},
	async getOrganizations() {
		try {
			const { data } = await axios.get(`${getBackendUrl()}/api/admin/organizations`);
			if (data.success && Array.isArray(data.organizations)) {
				try {
					localStorage.setItem("mep_local_organizations", JSON.stringify(data.organizations));
				} catch (e) {}
				return data.organizations;
			}
		} catch (e) {}
		try {
			const cached = localStorage.getItem("mep_local_organizations");
			return cached ? JSON.parse(cached) : [];
		} catch {
			return [];
		}
	},
	async createOrganization(orgData) {
		try {
			const { data } = await axios.post(`${getBackendUrl()}/api/admin/organizations`, orgData);
			if (data.success) {
				try {
					const existing = JSON.parse(localStorage.getItem("mep_local_organizations") || "[]");
					existing.push(data.organization);
					localStorage.setItem("mep_local_organizations", JSON.stringify(existing));
				} catch (e) {}
				return data;
			}
		} catch (e) {}
		const fallbackOrg = {
			id: `org_${Date.now()}`,
			name: orgData.name.trim(),
			subscription_plan: orgData.subscription_plan || "ENTERPRISE",
			max_users: orgData.max_users || 10,
			created_at: (/* @__PURE__ */ new Date()).toISOString()
		};
		try {
			const existing = JSON.parse(localStorage.getItem("mep_local_organizations") || "[]");
			existing.push(fallbackOrg);
			localStorage.setItem("mep_local_organizations", JSON.stringify(existing));
		} catch (e) {}
		return {
			success: true,
			organization: fallbackOrg
		};
	},
	async deleteOrganization(orgId) {
		try {
			const { data } = await axios.post(`${getBackendUrl()}/api/admin/organizations/delete`, { orgId });
			try {
				const updated = JSON.parse(localStorage.getItem("mep_local_organizations") || "[]").filter((o) => o.id !== orgId);
				localStorage.setItem("mep_local_organizations", JSON.stringify(updated));
			} catch (e) {}
			return data;
		} catch (e) {}
		try {
			const updated = JSON.parse(localStorage.getItem("mep_local_organizations") || "[]").filter((o) => o.id !== orgId);
			localStorage.setItem("mep_local_organizations", JSON.stringify(updated));
		} catch (e) {}
		return { success: true };
	},
	async getOrgUsers() {
		try {
			const { data } = await axios.get(`${getBackendUrl()}/api/org/users`);
			return data.users || [];
		} catch (e) {
			console.error(e);
			return [];
		}
	},
	async inviteOrgUser(inviteData) {
		try {
			const { data } = await axios.post(`${getBackendUrl()}/api/org/invite`, inviteData);
			return data;
		} catch (e) {
			console.error(e);
			return {
				success: false,
				message: e.response?.data?.message || e.message
			};
		}
	},
	async getOrgBackupSettings(orgId) {
		try {
			const url = orgId ? `${getBackendUrl()}/api/org/backup-settings?org_id=${encodeURIComponent(orgId)}` : `${getBackendUrl()}/api/org/backup-settings`;
			const { data } = await axios.get(url);
			return data;
		} catch (e) {
			console.error(e);
			return {
				success: false,
				local_backup_path: "",
				server_backup_path: "",
				versions_path: ""
			};
		}
	},
	async saveOrgBackupSettings(local_backup_path, server_backup_path, orgId, versions_path) {
		try {
			const { data } = await axios.post(`${getBackendUrl()}/api/org/backup-settings`, {
				local_backup_path,
				server_backup_path,
				versions_path,
				org_id: orgId
			});
			return data;
		} catch (e) {
			console.error(e);
			return {
				success: false,
				message: e.response?.data?.message || e.message
			};
		}
	},
	async getOrgActivityLogs(orgId) {
		try {
			const url = orgId ? `${getBackendUrl()}/api/org/activity-logs?org_id=${encodeURIComponent(orgId)}` : `${getBackendUrl()}/api/org/activity-logs`;
			const { data } = await axios.get(url);
			return data.success ? data.logs : [];
		} catch (e) {
			console.error("Error fetching org activity logs:", e);
			return [];
		}
	},
	async getAnnouncements() {
		try {
			const { data } = await axios.get(`${getBackendUrl()}/api/announcements`);
			return data.success ? data.announcements : [];
		} catch (e) {
			console.error("Error fetching announcements:", e);
			return [];
		}
	},
	async createAnnouncement(message, is_active = true) {
		try {
			const { data } = await axios.post(`${getBackendUrl()}/api/admin/announcements`, {
				message,
				is_active
			});
			return data;
		} catch (error) {
			return {
				success: false,
				message: error.response?.data?.message || "Failed to create announcement"
			};
		}
	},
	async toggleAnnouncement(id, is_active) {
		try {
			const { data } = await axios.put(`${getBackendUrl()}/api/admin/announcements/${id}`, { is_active });
			return data;
		} catch (error) {
			return {
				success: false,
				message: error.response?.data?.message || "Failed to toggle announcement"
			};
		}
	},
	async deleteAnnouncement(id) {
		try {
			const { data } = await axios.delete(`${getBackendUrl()}/api/admin/announcements/${id}`);
			return data;
		} catch (error) {
			return {
				success: false,
				message: error.response?.data?.message || "Failed to delete announcement"
			};
		}
	}
};
//#endregion
export { api as n, api_BcQvT_mW_exports as r, __exportAll as t };
