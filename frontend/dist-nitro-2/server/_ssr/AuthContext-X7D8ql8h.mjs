import { o as __toESM } from "../_runtime.mjs";
import { t as axios } from "../_libs/axios+[...].mjs";
import { i as getHardwareFingerprint, n as api } from "./api-TVzaU98L.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { P as require_jsx_runtime } from "../_libs/@radix-ui/react-alert-dialog+[...].mjs";
import { n as toast } from "../_libs/sonner.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/AuthContext-X7D8ql8h.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var getBackendUrl = () => {
	return "https://universal-mep-calculator.onrender.com";
};
var clearAllAuthStorage = () => {
	if (typeof window !== "undefined") {
		const clientId = localStorage.getItem("mep_device_client_id");
		localStorage.removeItem("auth_token");
		localStorage.removeItem("mep_user_data");
		localStorage.removeItem("mep_profile");
		localStorage.removeItem("mep_auth_token");
		localStorage.removeItem("mep_grid_spaces_grid");
		localStorage.removeItem("mep_grid_zones_grid");
		localStorage.removeItem("mep_grid_equipment_grid");
		if (clientId) localStorage.setItem("mep_device_client_id", clientId);
	}
};
var authService = {
	async register(name, email, password) {
		try {
			clearAllAuthStorage();
			const { data } = await axios.post(`${getBackendUrl()}/api/auth/register`, {
				name,
				email,
				password
			});
			return data;
		} catch (error) {
			return {
				success: false,
				message: error.response?.data?.message || error.message || "Registration failed"
			};
		}
	},
	async login(email, password, force = false) {
		try {
			clearAllAuthStorage();
			const hwid = getHardwareFingerprint();
			const { data } = await axios.post(`${getBackendUrl()}/api/auth/login`, {
				email,
				password,
				hwid,
				force
			});
			if (data.success && data.token) localStorage.setItem("auth_token", data.token);
			return data;
		} catch (error) {
			return {
				success: false,
				message: error.response?.data?.message || error.message || "Login failed. Could not reach server."
			};
		}
	},
	async logout() {
		try {
			const { data } = await axios.post(`${getBackendUrl()}/api/auth/logout`);
			clearAllAuthStorage();
			return data;
		} catch (error) {
			clearAllAuthStorage();
			return {
				success: false,
				message: error.message || "Logout failed"
			};
		}
	},
	async logoutOthers() {
		try {
			const token = localStorage.getItem("auth_token");
			const { data } = await axios.post(`${getBackendUrl()}/api/user/logout-others`, {}, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
			return data;
		} catch (error) {
			return {
				success: false,
				message: error.response?.data?.message || error.message || "Logout others failed"
			};
		}
	},
	async deleteAccount(password, confirmed = true) {
		try {
			const token = localStorage.getItem("auth_token");
			const { data } = await axios.post(`${getBackendUrl()}/api/user/delete-account`, {
				password,
				confirmed
			}, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
			if (data.success) localStorage.removeItem("auth_token");
			return data;
		} catch (error) {
			return {
				success: false,
				message: error.response?.data?.message || error.message || "Delete account failed"
			};
		}
	},
	async updateProfile(updates) {
		try {
			const token = localStorage.getItem("auth_token");
			const { data } = await axios.post(`${getBackendUrl()}/api/user/update-profile`, updates, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
			return data;
		} catch (error) {
			return {
				success: false,
				message: error.response?.data?.message || error.message || "Profile update failed"
			};
		}
	},
	async sendVerifyOtp(email) {
		try {
			const { data } = await axios.post(`${getBackendUrl()}/api/auth/send-verify-otp`, { email });
			return data;
		} catch (error) {
			return {
				success: false,
				message: error.response?.data?.message || error.message || "Failed to send OTP"
			};
		}
	},
	async verifyAccount(otp, email) {
		try {
			const { data } = await axios.post(`${getBackendUrl()}/api/auth/verify-account`, {
				otp,
				email
			});
			return data;
		} catch (error) {
			return {
				success: false,
				message: error.response?.data?.message || error.message || "Verification failed"
			};
		}
	},
	async getAuthState() {
		try {
			const { data } = await axios.get(`${getBackendUrl()}/api/auth/is-auth`);
			return data;
		} catch (error) {
			if (error.response?.data?.sessionRevoked || error.response?.data?.message?.includes("another device")) return {
				success: false,
				message: error.response.data.message || "Your account was logged in on another device."
			};
			return { success: false };
		}
	},
	async getUserData() {
		try {
			const { data } = await axios.get(`${getBackendUrl()}/api/user/data`);
			return data;
		} catch (error) {
			if (error.response?.data?.sessionRevoked || error.response?.data?.message?.includes("another device")) return {
				success: false,
				message: error.response.data.message || "Your account was logged in on another device."
			};
			return { success: false };
		}
	},
	async sendResetOtp(email) {
		try {
			const { data } = await axios.post(`${getBackendUrl()}/api/auth/send-reset-otp`, { email });
			return data;
		} catch (error) {
			return {
				success: false,
				message: error.response?.data?.message || error.message || "Failed to send reset code"
			};
		}
	},
	async resetPassword(email, otp, newPassword) {
		try {
			const { data } = await axios.post(`${getBackendUrl()}/api/auth/reset-password`, {
				email,
				otp,
				newPassword
			});
			return data;
		} catch (error) {
			return {
				success: false,
				message: error.response?.data?.message || error.message || "Password reset failed"
			};
		}
	},
	async initHardwareTrial(hwid, email) {
		try {
			const { data } = await axios.post(`${getBackendUrl()}/api/license/hardware-trial`, {
				hwid,
				email
			});
			return data;
		} catch (error) {
			return {
				success: false,
				message: error.response?.data?.message || "Trial initialization failed"
			};
		}
	},
	async getLicenseStatus(hwid, email) {
		try {
			const { data } = await axios.post(`${getBackendUrl()}/api/license/status`, {
				hwid,
				email
			});
			return data;
		} catch (error) {
			return {
				success: false,
				plan: "FREE",
				status: "UNLICENSED",
				remainingDays: 0,
				watermark: "UNLICENSED / DEMO VERSION"
			};
		}
	},
	async checkoutPlan(email, planTier, durationDays, hwid) {
		try {
			const { data } = await axios.post(`${getBackendUrl()}/api/license/checkout`, {
				email,
				planTier,
				durationDays,
				hwid
			});
			return data;
		} catch (error) {
			return {
				success: false,
				message: error.response?.data?.message || "Checkout failed"
			};
		}
	},
	async activateLicenseKey(key, email, hwid) {
		try {
			const { data } = await axios.post(`${getBackendUrl()}/api/license/activate`, {
				key,
				email,
				hwid
			});
			return data;
		} catch (error) {
			return {
				success: false,
				message: error.response?.data?.message || "License activation failed"
			};
		}
	},
	async adminListLicenses() {
		try {
			const { data } = await axios.get(`${getBackendUrl()}/api/admin/licenses/list`);
			return data;
		} catch (error) {
			return {
				success: false,
				licenses: [],
				trials: []
			};
		}
	},
	async adminGenerateLicenseKey(tier, durationDays, targetEmail) {
		try {
			const { data } = await axios.post(`${getBackendUrl()}/api/admin/licenses/generate`, {
				tier,
				durationDays,
				targetEmail
			});
			return data;
		} catch (error) {
			return {
				success: false,
				message: error.response?.data?.message || "Key generation failed"
			};
		}
	},
	async adminRevokeLicenseKey(key) {
		try {
			const { data } = await axios.post(`${getBackendUrl()}/api/admin/licenses/revoke`, { key });
			return data;
		} catch (error) {
			return {
				success: false,
				message: error.response?.data?.message || "Revocation failed"
			};
		}
	}
};
var AuthContext = (0, import_react.createContext)({
	isLoggedin: false,
	userData: null,
	profile: null,
	loading: true,
	session: null,
	user: null,
	setIsLoggedin: () => {},
	setUserData: () => {},
	getUserData: async () => {},
	logout: async () => {},
	logoutAllDevices: async () => {},
	deleteAccount: async () => ({ success: false }),
	updateProfileDetails: async () => ({ success: false }),
	acceptPrivacy: async () => {}
});
var LOCAL_STORAGE_USER_KEY = "mep_calculator_user_data";
var AuthProvider = ({ children }) => {
	const [isLoggedin, setIsLoggedin] = (0, import_react.useState)(() => {
		if (typeof window !== "undefined") return localStorage.getItem(LOCAL_STORAGE_USER_KEY) !== null;
		return false;
	});
	const [userData, setUserDataState] = (0, import_react.useState)(() => {
		if (typeof window !== "undefined") {
			const saved = localStorage.getItem(LOCAL_STORAGE_USER_KEY);
			return saved ? JSON.parse(saved) : null;
		}
		return null;
	});
	const [loading, setLoading] = (0, import_react.useState)(true);
	const setUserData = (data) => {
		if (data && typeof window !== "undefined") {
			if (localStorage.getItem("privacy_policy_accepted") === "true") data = {
				...data,
				privacyPolicyAccepted: true
			};
			if (data.id) {
				const savedPhoto = localStorage.getItem(`mep_profile_photo_${data.id}`);
				if (savedPhoto && !data.profile_photo) data = {
					...data,
					profile_photo: savedPhoto
				};
			}
			localStorage.removeItem("mep_profile_photo");
		}
		setUserDataState(data);
		if (typeof window !== "undefined") if (data) {
			localStorage.setItem(LOCAL_STORAGE_USER_KEY, JSON.stringify(data));
			setIsLoggedin(true);
		} else {
			localStorage.removeItem(LOCAL_STORAGE_USER_KEY);
			setIsLoggedin(false);
		}
	};
	const handleUnauthResponse = (res) => {
		if (!res) return;
		if (res.sessionRevoked || res.message?.includes("another device")) {
			toast.error(res.message || "Your account was logged in on another device.", { duration: 6e3 });
			clearAllAuthStorage();
			setUserDataState(null);
			setIsLoggedin(false);
		} else if (res.message?.includes("deactivated") || res.message?.includes("deleted")) {
			toast.error(res.message, { duration: 6e3 });
			clearAllAuthStorage();
			setUserDataState(null);
			setIsLoggedin(false);
		} else if (res.success === false) {
			clearAllAuthStorage();
			setUserDataState(null);
			setIsLoggedin(false);
		}
	};
	const getUserData = async () => {
		const res = await authService.getUserData();
		if (res.success && res.userData) {
			setUserData(res.userData);
			return res;
		} else if (res.success === false) handleUnauthResponse(res);
		return res;
	};
	const checkAuth = async () => {
		try {
			const authState = await authService.getAuthState();
			if (authState.success && authState.userData) setUserData(authState.userData);
			else if (authState.success === false) handleUnauthResponse(authState);
			else {
				const res = await authService.getUserData();
				if (res.success && res.userData) setUserData(res.userData);
				else if (res.success === false) handleUnauthResponse(res);
			}
			try {
				const currentEmail = authState.userData?.email || userData?.email;
				if (currentEmail) {
					const match = (await api.getUsers()).find((u) => u.email?.toLowerCase() === currentEmail.toLowerCase());
					if (match) setUserDataState((prev) => prev ? {
						...prev,
						...match
					} : match);
				}
			} catch (e) {}
		} catch (e) {
			console.warn("Auth check error:", e);
		} finally {
			setLoading(false);
		}
	};
	const logout = async () => {
		clearAllAuthStorage();
		await authService.logout();
		setUserData(null);
		try {
			const { workspaceStore } = await import("./workspace-store-RdZrUbAZ.mjs").then((n) => n.f).then((n) => n.r);
			workspaceStore.clearWorkspace();
		} catch (e) {
			console.error(e);
		}
	};
	const logoutAllDevices = async () => {
		await authService.logoutOthers();
		await logout();
	};
	const deleteAccount = async (password) => {
		const res = await authService.deleteAccount(password, true);
		if (res.success) {
			setUserData(null);
			try {
				const { workspaceStore } = await import("./workspace-store-RdZrUbAZ.mjs").then((n) => n.f).then((n) => n.r);
				workspaceStore.clearWorkspace();
			} catch (e) {
				console.error(e);
			}
		}
		return res;
	};
	const updateProfileDetails = async (updates) => {
		const res = await authService.updateProfile(updates);
		if (res.success && res.userData) setUserData(res.userData);
		return res;
	};
	const acceptPrivacy = async () => {
		if (typeof window !== "undefined") localStorage.setItem("privacy_policy_accepted", "true");
		if (userData) setUserData({
			...userData,
			privacyPolicyAccepted: true
		});
		try {
			const { api } = await import("./api-TVzaU98L.mjs").then((n) => n.r).then((n) => n.n);
			await api.acceptPrivacyPolicy();
		} catch (e) {
			console.error("Failed to sync privacy policy acceptance with cloud backend", e);
		}
	};
	(0, import_react.useEffect)(() => {
		checkAuth();
		const handleRevoked = (e) => {
			const msg = e.detail || "Your account was logged in on another device.";
			toast.error(msg, { duration: 6e3 });
			clearAllAuthStorage();
			setUserDataState(null);
			setIsLoggedin(false);
		};
		window.addEventListener("mep_session_revoked", handleRevoked);
		return () => {
			window.removeEventListener("mep_session_revoked", handleRevoked);
		};
	}, []);
	(0, import_react.useEffect)(() => {
		if (!isLoggedin) return;
		const performSessionCheck = async () => {
			const authState = await authService.getAuthState();
			if (authState.success === false && (authState.requireForceLogout || authState.message?.includes("another device"))) {
				toast.error(authState.message || "Your account was logged in on another device.", { duration: 6e3 });
				clearAllAuthStorage();
				setUserDataState(null);
				setIsLoggedin(false);
			}
		};
		const interval = setInterval(performSessionCheck, 15e3);
		const handleFocus = () => {
			performSessionCheck();
		};
		window.addEventListener("focus", handleFocus);
		return () => {
			clearInterval(interval);
			window.removeEventListener("focus", handleFocus);
		};
	}, [isLoggedin]);
	const session = userData ? { user: {
		id: userData.id,
		email: userData.email
	} } : null;
	const user = session?.user ?? null;
	const profile = userData ? {
		id: userData.id,
		email: userData.email,
		name: userData.name,
		role: userData.role || "USER",
		subscription_status: "ACTIVE",
		isAccountVerified: userData.isAccountVerified,
		features: userData.features || {},
		subscription_expires: userData.subscription_expires,
		company: userData.company || "",
		designation: userData.designation || "",
		profile_photo: userData.profile_photo || "",
		settings: userData.settings || {},
		status: userData.status
	} : null;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AuthContext.Provider, {
		value: {
			isLoggedin,
			userData,
			profile,
			loading,
			session,
			user,
			setIsLoggedin,
			setUserData,
			getUserData,
			logout,
			logoutAllDevices,
			deleteAccount,
			updateProfileDetails,
			acceptPrivacy
		},
		children
	});
};
var useAuth = () => (0, import_react.useContext)(AuthContext);
//#endregion
export { authService as n, useAuth as r, AuthProvider as t };
