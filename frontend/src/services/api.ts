import axios from 'axios';

const getBackendUrl = () => {
  return import.meta.env.VITE_API_URL || 'https://universal-mep-calculator.onrender.com';
};

// axios.defaults.withCredentials = true; // Disabled to prevent stale cookie conflicts with Authorization header

axios.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth_token');
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
export const api = {
  // USERS
  async getUsers() {
    try {
      const { data } = await axios.get(`${getBackendUrl()}/api/users/list`);
      return data.success ? data.users : [];
    } catch (e) {
      return [];
    }
  },

  // ADMIN USER MANAGEMENT
  async adminToggleRole(profileId: string, newRole: string) {
    try {
      const { data } = await axios.post(`${getBackendUrl()}/api/admin/toggle-role`, { profileId, newRole });
      return data;
    } catch (error: any) {
      return { success: false, message: error.response?.data?.message || 'Failed to toggle role' };
    }
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
    try {
      const { data } = await axios.post(`${getBackendUrl()}/api/admin/update-profile`, { profileId, updates });
      return data;
    } catch (error: any) {
      return { success: false, message: error.response?.data?.message || 'Failed to update profile' };
    }
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

  // PROJECTS
  async getProjects() {
    try {
      const { data } = await axios.get(`${getBackendUrl()}/api/projects/list`);
      return data.success ? data.projects : [];
    } catch (e) {
      return [];
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
    try {
      const { data } = await axios.get(`${getBackendUrl()}/api/admin/organizations`);
      return data.organizations || [];
    } catch (e) {
      console.error(e);
      return [];
    }
  },
  async createOrganization(orgData: { name: string; subscription_plan: string; max_users: number }) {
    try {
      const { data } = await axios.post(`${getBackendUrl()}/api/admin/organizations`, orgData);
      return data;
    } catch (e) {
      console.error(e);
      return { success: false };
    }
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
  async inviteOrgUser(inviteData: { name: string; email: string; role: string }) {
    try {
      const { data } = await axios.post(`${getBackendUrl()}/api/org/invite`, inviteData);
      return data;
    } catch (e: any) {
      console.error(e);
      return { success: false, message: e.response?.data?.message || e.message };
    }
  },

};
