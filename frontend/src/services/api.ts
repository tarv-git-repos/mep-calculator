import axios from 'axios';

const getBackendUrl = () => {
  if (typeof window !== 'undefined' && window.location && window.location.hostname) {
    const hostname = window.location.hostname;
    const protocol = window.location.protocol;
    return `${protocol}//${hostname}:4000`;
  }
  return 'http://localhost:4000';
};

axios.defaults.withCredentials = true;

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
  }
};
