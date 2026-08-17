import { o as __toESM } from "../_runtime.mjs";
import { t as axios } from "../_libs/axios+[...].mjs";
import { n as api } from "./api-BcQvT-mW.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { j as require_jsx_runtime } from "../_libs/@radix-ui/react-alert-dialog+[...].mjs";
import { n as toast } from "../_libs/sonner.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/AuthContext-CY5Koh3s.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
/**
* Hardware Fingerprint Generator for MEP Calculator
* Combines browser/system hardware properties (screen specs, platform, CPU cores, canvas renderer, timezone)
* into a unique hash for binding Free Trials to physical devices.
*/
function cyrb53(str, seed = 0) {
	let h1 = 3735928559 ^ seed, h2 = 1103547991 ^ seed;
	for (let i = 0, ch; i < str.length; i++) {
		ch = str.charCodeAt(i);
		h1 = Math.imul(h1 ^ ch, 2654435761);
		h2 = Math.imul(h2 ^ ch, 1597334677);
	}
	h1 = Math.imul(h1 ^ h1 >>> 16, 2246822507) ^ Math.imul(h2 ^ h2 >>> 13, 3266489909);
	h2 = Math.imul(h2 ^ h2 >>> 16, 2246822507) ^ Math.imul(h1 ^ h1 >>> 13, 3266489909);
	return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16).toUpperCase();
}
function getHardwareFingerprint() {
	if (typeof window === "undefined") return "NODE_SERVER_ENVIRONMENT";
	try {
		const nav = window.navigator;
		const screen = window.screen;
		const userAgent = nav.userAgent || "";
		const platform = nav.platform || "";
		const hardwareConcurrency = nav.hardwareConcurrency || 4;
		const deviceMemory = nav.deviceMemory || 8;
		const screenRes = `${screen.width}x${screen.height}x${screen.colorDepth}`;
		const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
		const language = nav.language || "";
		let canvasData = "";
		try {
			const canvas = document.createElement("canvas");
			const ctx = canvas.getContext("2d");
			if (ctx) {
				ctx.textBaseline = "top";
				ctx.font = "14px 'Arial'";
				ctx.fillStyle = "#f60";
				ctx.fillRect(125, 1, 62, 20);
				ctx.fillStyle = "#069";
				ctx.fillText("MEP-CALC-HWID-2026", 2, 15);
				ctx.fillStyle = "rgba(102, 204, 0, 0.7)";
				ctx.fillText("MEP-CALC-HWID-2026", 4, 17);
				canvasData = canvas.toDataURL();
			}
		} catch (e) {
			canvasData = "canvas_disabled";
		}
		const rawString = [
			platform,
			hardwareConcurrency,
			deviceMemory,
			screenRes,
			timezone,
			language,
			userAgent.split(" ")[0],
			canvasData.slice(-100)
		].join("||");
		return `HWID-${cyrb53(rawString, 42)}-${cyrb53(rawString, 1337)}`;
	} catch (err) {
		return "HWID-FALLBACK-DEVICE-0001";
	}
}
var getBackendUrl = () => {
	return "https://universal-mep-calculator.onrender.com";
};
var clearAllAuthStorage = () => {
	if (typeof window !== "undefined") {
		localStorage.removeItem("auth_token");
		localStorage.removeItem("mep_user_data");
		localStorage.removeItem("mep_profile");
		localStorage.removeItem("mep_auth_token");
		localStorage.removeItem("mep_grid_spaces_grid");
		localStorage.removeItem("mep_grid_zones_grid");
		localStorage.removeItem("mep_grid_equipment_grid");
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
			if (!error.response || error.code === "ERR_NETWORK" || error.message?.includes("Network Error")) {
				console.warn("Backend server offline — enabling desktop offline session authentication.");
				const fallbackUser = {
					id: `usr-${Date.now()}`,
					name: email.split("@")[0] || "Desktop User",
					email,
					role: email.toLowerCase().includes("admin") ? "SUPER_ADMIN" : "ENGINEER",
					isAccountVerified: true
				};
				const mockToken = `desktop-token-${Date.now()}`;
				localStorage.setItem("auth_token", mockToken);
				localStorage.setItem("mep_user_data", JSON.stringify(fallbackUser));
				return {
					success: true,
					token: mockToken,
					userData: fallbackUser,
					message: "Signed in (Desktop Offline Mode)"
				};
			}
			return {
				success: false,
				message: error.response?.data?.message || error.message || "Login failed"
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
			return { success: false };
		}
	},
	async getUserData() {
		try {
			const { data } = await axios.get(`${getBackendUrl()}/api/user/data`);
			return data;
		} catch (error) {
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
	const getUserData = async () => {
		const res = await authService.getUserData();
		if (res.success && res.userData) {
			setUserData(res.userData);
			return res;
		} else if (res.success === false && res.message && !res.message.includes("Network Error")) {
			if (isLoggedin && userData) toast.error("Your account has been deleted or deactivated by an administrator.");
			clearAllAuthStorage();
			setUserDataState(null);
			setIsLoggedin(false);
		}
		return res;
	};
	const checkAuth = async () => {
		try {
			const authState = await authService.getAuthState();
			if (authState.success && authState.userData) setUserData(authState.userData);
			else if (authState.success === false && authState.message && !authState.message.includes("Network Error")) {
				if (isLoggedin && userData) toast.error("Your account has been deleted or deactivated by an administrator.");
				clearAllAuthStorage();
				setUserDataState(null);
				setIsLoggedin(false);
			} else {
				const res = await authService.getUserData();
				if (res.success && res.userData) setUserData(res.userData);
				else if (res.success === false && res.message && !res.message.includes("Network Error")) {
					if (isLoggedin && userData) toast.error("Your account has been deleted or deactivated by an administrator.");
					clearAllAuthStorage();
					setUserDataState(null);
					setIsLoggedin(false);
				}
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
			const { workspaceStore } = await import("./workspace-store-Ct3ePlL1.mjs").then((n) => n.f).then((n) => n.r);
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
				const { workspaceStore } = await import("./workspace-store-Ct3ePlL1.mjs").then((n) => n.f).then((n) => n.r);
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
			const { api } = await import("./api-BcQvT-mW.mjs").then((n) => n.r).then((n) => n.n);
			await api.acceptPrivacyPolicy();
		} catch (e) {
			console.error("Failed to sync privacy policy acceptance with cloud backend", e);
		}
	};
	(0, import_react.useEffect)(() => {
		checkAuth();
	}, []);
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
export { useAuth as i, authService as n, getHardwareFingerprint as r, AuthProvider as t };
