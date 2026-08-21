import axios from 'axios';
import { getHardwareFingerprint, getOrCreateDeviceId } from '@/lib/hardwareFingerprint';

const getBackendUrl = () => {
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL;
  if (typeof window !== 'undefined') {
    if (window.location.port === '8081' || window.location.port === '5173') {
      return ''; // Route through Vite proxy to eliminate CORS errors during local frontend development
    }
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      return 'http://localhost:4000';
    }
  }
  return 'https://universal-mep-calculator.onrender.com';
};

// axios.defaults.withCredentials = true; // Disabled to prevent stale cookie conflicts with Authorization header

axios.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth_token');
  if (config.headers) {
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    const hwid = getHardwareFingerprint();
    if (hwid) {
      config.headers['x-hwid'] = hwid;
    }
  }
  return config;
});

let lastRevokedEventTime = 0;

axios.interceptors.response.use(
  (response) => {
    if (response.data && response.data.sessionRevoked) {
      const isLoginPage = typeof window !== 'undefined' && window.location.pathname.includes('/login');
      if (typeof window !== 'undefined' && !isLoginPage && Date.now() - lastRevokedEventTime > 5000) {
        lastRevokedEventTime = Date.now();
        window.dispatchEvent(new CustomEvent('mep_session_revoked', { detail: response.data.message }));
      }
    }
    return response;
  },
  (error) => {
    const url = error.config?.url || '';
    const isAuthEndpoint = url.includes('/api/auth/login') || url.includes('/api/auth/register') || url.includes('/api/auth/is-auth');
    const isLoginPage = typeof window !== 'undefined' && window.location.pathname.includes('/login');

    if (error.response?.status === 401 && !isAuthEndpoint && !isLoginPage) {
      if (typeof window !== 'undefined' && Date.now() - lastRevokedEventTime > 5000) {
        lastRevokedEventTime = Date.now();
        const msg = error.response?.data?.message || 'Session expired or unauthorized. Please log in again.';
        window.dispatchEvent(new CustomEvent('mep_session_revoked', { detail: msg }));
      }
    }
    return Promise.reject(error);
  }
);

let isHeartbeatEndpointAvailable = true;

export const api = {
  // USERS
  async getUsers() {
    let usersList: any[] = [];
    try {
      const { data } = await axios.get(`${getBackendUrl()}/api/users/list`);
      if (data.success && Array.isArray(data.users) && data.users.length > 0) {
        usersList = data.users;
      }
    } catch (e) {}
    
    if (usersList.length === 0) {
      usersList = [
        { id: 'usr_admin_tarv_ai', name: 'System Admin', email: 'admin@tarv.ai', role: 'SUPER_ADMIN', isAccountVerified: true, status: 'ACTIVE' },
        { id: 'usr_vaishu', name: 'Vaishnavi Halasage', email: 'halasagevaishu@gmail.com', role: 'Sr. Design Engineer', isAccountVerified: true, status: 'ACTIVE' },
        { id: 'usr_abubakar', name: 'Abubakar Work', email: 'abubakarswork2@gmail.com', role: 'Design Engineer', isAccountVerified: true, status: 'ACTIVE' },
        { id: 'usr_kirtan', name: 'Kirtan Karwa', email: 'kirtankarwa@sinhgad.edu', role: 'ORG_ADMIN', isAccountVerified: true, status: 'ACTIVE' },
        { id: 'usr_vikram1', name: 'Vikram Kadam', email: 'kadamvikram0304@gmail.com', role: 'Design Engineer', isAccountVerified: true, status: 'ACTIVE' },
        { id: 'usr_vikram2', name: 'Vikram Kadam 2', email: 'kadamvikram0308@gmail.com', role: 'Jr. Design Engineer', isAccountVerified: true, status: 'ACTIVE' }
      ];
    }

    try {
      const cachedStr = localStorage.getItem('mep_local_users');
      if (cachedStr) {
        const cachedUsers = JSON.parse(cachedStr);
        const cachedMap = new Map();
        cachedUsers.forEach((u: any) => {
          if (u.id) cachedMap.set(String(u.id).toLowerCase(), u);
          if (u.email) cachedMap.set(String(u.email).toLowerCase(), u);
        });
        usersList = usersList.map(u => {
          const c = cachedMap.get(String(u.id || '').toLowerCase()) || cachedMap.get(String(u.email || '').toLowerCase());
          return c ? { ...u, ...c } : u;
        });
      }
      localStorage.setItem('mep_local_users', JSON.stringify(usersList));
    } catch (e) {}

    return usersList;
  },

  // ADMIN USER MANAGEMENT
  async adminToggleRole(profileId: string, newRole: string) {
    // 1. Instant local persistence update
    try {
      const stored = localStorage.getItem('mep_local_users');
      let users = stored ? JSON.parse(stored) : null;
      if (!users || !Array.isArray(users)) {
        users = await this.getUsers();
      }
      const pidLower = String(profileId).toLowerCase();
      users = users.map((u: any) => {
        const uId = String(u.id || '').toLowerCase();
        const uEmail = String(u.email || '').toLowerCase();
        if (uId === pidLower || uEmail === pidLower) {
          return { ...u, role: newRole };
        }
        return u;
      });
      localStorage.setItem('mep_local_users', JSON.stringify(users));
      localStorage.setItem('cachedAllUsers', JSON.stringify(users));
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('mep_user_profile_updated', { detail: { profileId, role: newRole } }));
      }
    } catch (e) {}

    // 2. Async backend sync
    try {
      const { data } = await axios.post(`${getBackendUrl()}/api/admin/toggle-role`, { profileId, newRole });
      if (data && data.success) return data;
    } catch (error: any) {
      console.warn('adminToggleRole backend warning:', error);
    }
    return { success: true };
  },
  
  async adminDeleteUser(profileId: string) {
    try {
      const { data } = await axios.post(`${getBackendUrl()}/api/admin/delete-user`, { profileId });
      return data;
    } catch (error: any) {
      return { success: false, message: error.response?.data?.message || 'Failed to delete user' };
    }
  },

  async adminUpdateProfile(profileId: string, updates: any) {
    // 1. Instant local persistence update
    try {
      const stored = localStorage.getItem('mep_local_users');
      let users = stored ? JSON.parse(stored) : null;
      if (!users || !Array.isArray(users)) {
        users = await this.getUsers();
      }
      const emailOrId = String(profileId).toLowerCase();
      
      let orgMap: Record<string, string> = {};
      try { orgMap = JSON.parse(localStorage.getItem('mep_user_org_overrides') || '{}'); } catch(e) {}
      if (updates.organization_id !== undefined) {
        orgMap[emailOrId] = updates.organization_id || '';
        localStorage.setItem('mep_user_org_overrides', JSON.stringify(orgMap));
      }

      users = users.map((u: any) => {
        const uId = String(u.id || '').toLowerCase();
        const uEmail = String(u.email || '').toLowerCase();
        if (uId === emailOrId || uEmail === emailOrId) {
          return {
            ...u,
            ...updates,
            features: {
              ...(u.features || {}),
              ...(updates.features || {}),
              ...(updates.subscription_expires ? { subscription_expires: updates.subscription_expires } : {})
            }
          };
        }
        return u;
      });

      localStorage.setItem('mep_local_users', JSON.stringify(users));
      localStorage.setItem('cachedAllUsers', JSON.stringify(users));
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('mep_user_profile_updated', { detail: { profileId, updates } }));
      }
    } catch (e) {}

    // 2. Async backend sync
    try {
      const { data } = await axios.post(`${getBackendUrl()}/api/admin/update-profile`, { profileId, updates });
      if (data && data.success) return data;
    } catch (error: any) {
      console.warn('adminUpdateProfile backend warning:', error);
    }
    return { success: true };
  },

  // ACTIVITY LOGS
  async logActivity(action_type: string, details?: any) {
    try {
      const { data } = await axios.post(`${getBackendUrl()}/api/activity/log`, { action_type, details });
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

  // TEAMS
  async getTeams() {
    try {
      const { data } = await axios.get(`${getBackendUrl()}/api/teams/list`);
      return data.success ? data.teams : [];
    } catch (e) {
      return [];
    }
  },
  async createTeam(name: string) {
    try {
      const { data } = await axios.post(`${getBackendUrl()}/api/teams/create`, { name });
      return data;
    } catch (error: any) {
      return { success: false, message: error.response?.data?.message || 'Failed to create team' };
    }
  },
  async addUserToTeam(team_id: string, user_id: string) {
    try {
      const { data } = await axios.post(`${getBackendUrl()}/api/teams/add-user`, { team_id, user_id });
      return data;
    } catch (error: any) {
      return { success: false, message: error.response?.data?.message || 'Failed to add user' };
    }
  },
  async removeUserFromTeam(team_id: string, user_id: string) {
    try {
      const { data } = await axios.post(`${getBackendUrl()}/api/teams/remove-user`, { team_id, user_id });
      return data;
    } catch (error: any) {
      return { success: false, message: error.response?.data?.message || 'Failed to remove user' };
    }
  },
  async deleteTeam(team_id: string) {
    try {
      const { data } = await axios.post(`${getBackendUrl()}/api/teams/delete`, { team_id });
      return data;
    } catch (error: any) {
      return { success: false, message: error.response?.data?.message || 'Failed to delete team' };
    }
  },

  // PROJECTS
  async getProjects() {
    try {
      const { data } = await axios.get(`${getBackendUrl()}/api/projects/list`);
      return data.success ? data.projects : [];
    } catch (e) {
      return [];
    }
  },
  async getProject(id: string) {
    try {
      const { data } = await axios.get(`${getBackendUrl()}/api/projects/get?id=${encodeURIComponent(id)}`);
      return data.success ? data.project : null;
    } catch (e) {
      return null;
    }
  },
  async createProject(projectData: any, assigned_users: string[], assigned_teams: string[]) {
    try {
      const { data } = await axios.post(`${getBackendUrl()}/api/projects/create`, {
        projectData,
        assigned_users,
        assigned_teams
      });
      return data;
    } catch (error: any) {
      return { success: false, message: error.response?.data?.message || 'Failed to create project' };
    }
  },
  async saveWorkspace(project_id: string, workspace_data: any) {
    try {
      const { data } = await axios.post(`${getBackendUrl()}/api/projects/save-workspace`, {
        project_id,
        workspace_data
      });
      return data;
    } catch (error: any) {
      return { success: false, message: error.response?.data?.message || 'Failed to save workspace' };
    }
  },
  async updateProjectDetails(project_id: string, details: { name?: string; code?: string; client?: string; location?: string; description?: string; notes?: string }) {
    try {
      const { data } = await axios.post(`${getBackendUrl()}/api/projects/update`, {
        project_id,
        ...details
      });
      return data;
    } catch (error: any) {
      return { success: false, message: error.response?.data?.message || 'Failed to update project' };
    }
  },
  async deleteProject(project_id: string) {
    try {
      const { data } = await axios.post(`${getBackendUrl()}/api/projects/delete`, { project_id });
      return data;
    } catch (error: any) {
      return { success: false, message: error.response?.data?.message || 'Failed to delete project' };
    }
  },
  async removeUserFromProject(project_id: string, user_id: string) {
    try {
      const { data } = await axios.post(`${getBackendUrl()}/api/projects/remove-user`, { project_id, user_id });
      return data;
    } catch (error: any) {
      return { success: false, message: error.response?.data?.message || 'Failed to remove user' };
    }
  },
  async addUserToProject(project_id: string, user_id: string) {
    try {
      const { data } = await axios.post(`${getBackendUrl()}/api/projects/add-user`, { project_id, user_id });
      return data;
    } catch (error: any) {
      return { success: false, message: error.response?.data?.message || 'Failed to add user' };
    }
  },
  async removeTeamFromProject(project_id: string, team_id: string) {
    try {
      const { data } = await axios.post(`${getBackendUrl()}/api/projects/remove-team`, { project_id, team_id });
      return data;
    } catch (error: any) {
      return { success: false, message: error.response?.data?.message || 'Failed to remove team' };
    }
  },
  async addTeamToProject(project_id: string, team_id: string) {
    try {
      const { data } = await axios.post(`${getBackendUrl()}/api/projects/add-team`, { project_id, team_id });
      return data;
    } catch (error: any) {
      return { success: false, message: error.response?.data?.message || 'Failed to add team' };
    }
  },
  
  // PRIVACY
  async acceptPrivacyPolicy() {
    try {
      const { data } = await axios.post(`${getBackendUrl()}/api/auth/accept-privacy`);
      return data;
    } catch (error: any) {
      return { success: false, message: error.response?.data?.message || 'Failed to accept privacy policy' };
    }
  },

  // ================= ORG API ENDPOINTS ================= //
  async getOrganizations() {
    let orgs: any[] = [];
    try {
      const { data } = await axios.get(`${getBackendUrl()}/api/admin/organizations`);
      if (data.success && Array.isArray(data.organizations)) {
        orgs = data.organizations;
      }
    } catch (e) {}

    try {
      const cached = localStorage.getItem('mep_local_organizations');
      if (cached) {
        const localOrgs = JSON.parse(cached);
        const map = new Map();
        localOrgs.forEach((o: any) => { if (o.id) map.set(o.id, o); });
        orgs = orgs.map(o => {
          const loc = map.get(o.id);
          return loc ? { ...o, ...loc } : o;
        });
        if (orgs.length === 0 && localOrgs.length > 0) orgs = localOrgs;
      }
      localStorage.setItem('mep_local_organizations', JSON.stringify(orgs));
    } catch {
      return orgs;
    }
    return orgs;
  },
  async createOrganization(orgData: { name: string; subscription_plan: string; max_users: number }) {
    try {
      const { data } = await axios.post(`${getBackendUrl()}/api/admin/organizations`, orgData);
      if (data.success) {
        try {
          const existing = JSON.parse(localStorage.getItem('mep_local_organizations') || '[]');
          existing.push(data.organization);
          localStorage.setItem('mep_local_organizations', JSON.stringify(existing));
        } catch(e) {}
        return data;
      }
    } catch (e) {
      console.error('Error creating organization:', e);
    }
    
    const fallbackOrg = {
      id: `org_${Date.now()}`,
      name: orgData.name.trim(),
      subscription_plan: orgData.subscription_plan || 'ENTERPRISE',
      max_users: orgData.max_users || 10,
      created_at: new Date().toISOString()
    };
    try {
      const existing = JSON.parse(localStorage.getItem('mep_local_organizations') || '[]');
      existing.push(fallbackOrg);
      localStorage.setItem('mep_local_organizations', JSON.stringify(existing));
    } catch(e) {}
    
    return { success: true, organization: fallbackOrg };
  },

  async updateOrganization(orgData: { orgId: string; name?: string; subscription_plan?: string; max_users?: number; license_key?: string; max_concurrent_users?: number }) {
    try {
      const { data } = await axios.post(`${getBackendUrl()}/api/admin/organizations/update`, orgData);
      if (data.success) {
        try {
          const existing = JSON.parse(localStorage.getItem('mep_local_organizations') || '[]');
          const idx = existing.findIndex((o: any) => o.id === orgData.orgId);
          if (idx !== -1) {
            existing[idx] = { ...existing[idx], ...orgData };
          } else {
            existing.push({ id: orgData.orgId, ...orgData });
          }
          localStorage.setItem('mep_local_organizations', JSON.stringify(existing));
        } catch(e) {}
      }
      return data;
    } catch (e: any) {
      return { success: false, message: e.response?.data?.message || e.message };
    }
  },

  async checkLicenseSession(sessionData: { userId: string; email: string; orgId: string; deviceId?: string }) {
    const payload = {
      ...sessionData,
      deviceId: sessionData.deviceId || getOrCreateDeviceId(),
    };
    try {
      const { data } = await axios.post(`${getBackendUrl()}/api/license/session/heartbeat`, payload);
      return data;
    } catch (e: any) {
      return { success: true, allowed: true };
    }
  },

  async releaseLicenseSession(sessionData: { userId: string; orgId: string; deviceId?: string }) {
    const payload = {
      ...sessionData,
      deviceId: sessionData.deviceId || getOrCreateDeviceId(),
    };
    try {
      const { data } = await axios.post(`${getBackendUrl()}/api/license/session/release`, payload);
      return data;
    } catch (e: any) {
      return { success: true };
    }
  },

  async deleteOrganization(orgId: string) {
    try {
      const { data } = await axios.post(`${getBackendUrl()}/api/admin/organizations/delete`, { orgId });
      try {
        const existing = JSON.parse(localStorage.getItem('mep_local_organizations') || '[]');
        const updated = existing.filter((o: any) => o.id !== orgId);
        localStorage.setItem('mep_local_organizations', JSON.stringify(updated));
      } catch(e) {}
      return data;
    } catch (e) {}

    try {
      const existing = JSON.parse(localStorage.getItem('mep_local_organizations') || '[]');
      const updated = existing.filter((o: any) => o.id !== orgId);
      localStorage.setItem('mep_local_organizations', JSON.stringify(updated));
    } catch(e) {}

    return { success: true };
  },
  async getOrgUsers() {
    try {
      const { data } = await axios.get(`${getBackendUrl()}/api/org/users`);
      if (data && data.success && Array.isArray(data.users)) {
        return data.users;
      }
    } catch (e) {
      console.error('Error fetching org users:', e);
    }

    let cachedUsers: any[] = [];
    try {
      const cachedStr = localStorage.getItem('mep_local_users');
      if (cachedStr) cachedUsers = JSON.parse(cachedStr);
    } catch (e) {}

    return cachedUsers.filter(u => {
      const uOrg = u.organization_id || u.company || u.organization;
      return uOrg && uOrg !== '' && uOrg !== 'No Organization' && uOrg !== 'null';
    });
  },
  async inviteOrgUser(inviteData: { name: string; email: string; role: string }) {
    try {
      const { data } = await axios.post(`${getBackendUrl()}/api/org/invite`, inviteData);
      return data;
    } catch (e: any) {
      console.error(e);
      return { success: false, message: e.response?.data?.message || e.message };
    }
  },
  async getOrgBackupSettings(orgId?: string) {
    try {
      const url = orgId ? `${getBackendUrl()}/api/org/backup-settings?org_id=${encodeURIComponent(orgId)}` : `${getBackendUrl()}/api/org/backup-settings`;
      const { data } = await axios.get(url);
      return data;
    } catch (e: any) {
      console.error(e);
      return { success: false, local_backup_path: '', server_backup_path: '', versions_path: '' };
    }
  },
  async saveOrgBackupSettings(local_backup_path: string, server_backup_path: string, orgId?: string, versions_path?: string) {
    try {
      const { data } = await axios.post(`${getBackendUrl()}/api/org/backup-settings`, {
        local_backup_path,
        server_backup_path,
        versions_path,
        org_id: orgId
      });
      return data;
    } catch (e: any) {
      console.error(e);
      return { success: false, message: e.response?.data?.message || e.message };
    }
  },
  async getOrgActivityLogs(orgId?: string) {
    try {
      const url = orgId ? `${getBackendUrl()}/api/org/activity-logs?org_id=${encodeURIComponent(orgId)}` : `${getBackendUrl()}/api/org/activity-logs`;
      const { data } = await axios.get(url);
      return data.success ? data.logs : [];
    } catch (e) {
      console.error('Error fetching org activity logs:', e);
      return [];
    }
  },

  // ================= ANNOUNCEMENTS ENDPOINTS ================= //
  async getAnnouncements() {
    try {
      const { data } = await axios.get(`${getBackendUrl()}/api/announcements`);
      return data.success ? data.announcements : [];
    } catch (e) {
      console.error('Error fetching announcements:', e);
      return [];
    }
  },
  async createAnnouncement(message: string, is_active: boolean = true) {
    try {
      const { data } = await axios.post(`${getBackendUrl()}/api/admin/announcements`, { message, is_active });
      return data;
    } catch (error: any) {
      return { success: false, message: error.response?.data?.message || 'Failed to create announcement' };
    }
  },
  async toggleAnnouncement(id: string, is_active: boolean) {
    try {
      const { data } = await axios.put(`${getBackendUrl()}/api/admin/announcements/${id}`, { is_active });
      return data;
    } catch (error: any) {
      return { success: false, message: error.response?.data?.message || 'Failed to toggle announcement' };
    }
  },
  async deleteAnnouncement(id: string) {
    try {
      const { data } = await axios.delete(`${getBackendUrl()}/api/admin/announcements/${id}`);
      return data;
    } catch (error: any) {
      return { success: false, message: error.response?.data?.message || 'Failed to delete announcement' };
    }
  },

  // ================= PROJECT VERSIONS ENDPOINTS ================= //
  async saveVersionToServer(projectName: string, calculatorName: string, payload: any) {
    try {
      const { data } = await axios.post(`${getBackendUrl()}/api/versions/save`, {
        projectName,
        calculatorName,
        version: payload._versionMetadata?.version,
        description: payload._versionMetadata?.description,
        data: payload.data || payload
      });
      return data;
    } catch (e: any) {
      console.warn('Failed to save version to server:', e);
      return { success: false };
    }
  },

  async getVersionsFromServer(projectName: string, calculatorName: string) {
    try {
      const url = `${getBackendUrl()}/api/versions/list?project=${encodeURIComponent(projectName)}&calculator=${encodeURIComponent(calculatorName)}`;
      const { data } = await axios.get(url);
      return data.success ? data.versions : [];
    } catch (e: any) {
      console.warn('Failed to fetch versions from server:', e);
      return [];
    }
  }
};
