//#region node_modules/@tauri-apps/api/external/tslib/tslib.es6.js
/******************************************************************************
Copyright (c) Microsoft Corporation.

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
PERFORMANCE OF THIS SOFTWARE.
***************************************************************************** */
function __classPrivateFieldGet(receiver, state, kind, f) {
	if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a getter");
	if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
	return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
}
function __classPrivateFieldSet(receiver, state, value, kind, f) {
	if (kind === "m") throw new TypeError("Private method is not writable");
	if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a setter");
	if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot write private member to an object whose class did not declare it");
	return kind === "a" ? f.call(receiver, value) : f ? f.value = value : state.set(receiver, value), value;
}
//#endregion
//#region node_modules/@tauri-apps/api/core.js
var _Channel_onmessage, _Channel_nextMessageIndex, _Channel_pendingMessages, _Channel_messageEndIndex, _Resource_rid;
/**
* Invoke your custom commands.
*
* This package is also accessible with `window.__TAURI__.core` when [`app.withGlobalTauri`](https://v2.tauri.app/reference/config/#withglobaltauri) in `tauri.conf.json` is set to `true`.
* @module
*/
/**
* A key to be used to implement a special function
* on your types that define how your type should be serialized
* when passing across the IPC.
* @example
* Given a type in Rust that looks like this
* ```rs
* #[derive(serde::Serialize, serde::Deserialize)
* enum UserId {
*   String(String),
*   Number(u32),
* }
* ```
* `UserId::String("id")` would be serialized into `{ String: "id" }`
* and so we need to pass the same structure back to Rust
* ```ts
* import { SERIALIZE_TO_IPC_FN } from "@tauri-apps/api/core"
*
* class UserIdString {
*   id
*   constructor(id) {
*     this.id = id
*   }
*
*   [SERIALIZE_TO_IPC_FN]() {
*     return { String: this.id }
*   }
* }
*
* class UserIdNumber {
*   id
*   constructor(id) {
*     this.id = id
*   }
*
*   [SERIALIZE_TO_IPC_FN]() {
*     return { Number: this.id }
*   }
* }
*
* type UserId = UserIdString | UserIdNumber
* ```
*
*/
var SERIALIZE_TO_IPC_FN = "__TAURI_TO_IPC_KEY__";
/**
* Stores the callback in a known location, and returns an identifier that can be passed to the backend.
* The backend uses the identifier to `eval()` the callback.
*
* @return An unique identifier associated with the callback function.
*
* @since 1.0.0
*/
function transformCallback(callback, once = false) {
	return window.__TAURI_INTERNALS__.transformCallback(callback, once);
}
var Channel = class {
	constructor(onmessage) {
		_Channel_onmessage.set(this, void 0);
		_Channel_nextMessageIndex.set(this, 0);
		_Channel_pendingMessages.set(this, []);
		_Channel_messageEndIndex.set(this, void 0);
		__classPrivateFieldSet(this, _Channel_onmessage, onmessage || (() => {}), "f");
		this.id = transformCallback((rawMessage) => {
			const index = rawMessage.index;
			if ("end" in rawMessage) {
				if (index == __classPrivateFieldGet(this, _Channel_nextMessageIndex, "f")) this.cleanupCallback();
				else __classPrivateFieldSet(this, _Channel_messageEndIndex, index, "f");
				return;
			}
			const message = rawMessage.message;
			if (index == __classPrivateFieldGet(this, _Channel_nextMessageIndex, "f")) {
				__classPrivateFieldGet(this, _Channel_onmessage, "f").call(this, message);
				__classPrivateFieldSet(this, _Channel_nextMessageIndex, __classPrivateFieldGet(this, _Channel_nextMessageIndex, "f") + 1, "f");
				while (__classPrivateFieldGet(this, _Channel_nextMessageIndex, "f") in __classPrivateFieldGet(this, _Channel_pendingMessages, "f")) {
					const message = __classPrivateFieldGet(this, _Channel_pendingMessages, "f")[__classPrivateFieldGet(this, _Channel_nextMessageIndex, "f")];
					__classPrivateFieldGet(this, _Channel_onmessage, "f").call(this, message);
					delete __classPrivateFieldGet(this, _Channel_pendingMessages, "f")[__classPrivateFieldGet(this, _Channel_nextMessageIndex, "f")];
					__classPrivateFieldSet(this, _Channel_nextMessageIndex, __classPrivateFieldGet(this, _Channel_nextMessageIndex, "f") + 1, "f");
				}
				if (__classPrivateFieldGet(this, _Channel_nextMessageIndex, "f") === __classPrivateFieldGet(this, _Channel_messageEndIndex, "f")) this.cleanupCallback();
			} else __classPrivateFieldGet(this, _Channel_pendingMessages, "f")[index] = message;
		});
	}
	cleanupCallback() {
		window.__TAURI_INTERNALS__.unregisterCallback(this.id);
	}
	set onmessage(handler) {
		__classPrivateFieldSet(this, _Channel_onmessage, handler, "f");
	}
	get onmessage() {
		return __classPrivateFieldGet(this, _Channel_onmessage, "f");
	}
	[(_Channel_onmessage = /* @__PURE__ */ new WeakMap(), _Channel_nextMessageIndex = /* @__PURE__ */ new WeakMap(), _Channel_pendingMessages = /* @__PURE__ */ new WeakMap(), _Channel_messageEndIndex = /* @__PURE__ */ new WeakMap(), SERIALIZE_TO_IPC_FN)]() {
		return `__CHANNEL__:${this.id}`;
	}
	toJSON() {
		return this[SERIALIZE_TO_IPC_FN]();
	}
};
/**
* Sends a message to the backend.
* @example
* ```typescript
* import { invoke } from '@tauri-apps/api/core';
* await invoke('login', { user: 'tauri', password: 'poiwe3h4r5ip3yrhtew9ty' });
* ```
*
* @param cmd The command name.
* @param args The optional arguments to pass to the command.
* @param options The request options.
* @return A promise resolving or rejecting to the backend response.
*
* @since 1.0.0
*/
async function invoke(cmd, args = {}, options) {
	return window.__TAURI_INTERNALS__.invoke(cmd, args, options);
}
/**
* A rust-backed resource stored through `tauri::Manager::resources_table` API.
*
* The resource lives in the main process and does not exist
* in the Javascript world, and thus will not be cleaned up automatically
* except on application exit. If you want to clean it up early, call {@linkcode Resource.close}
*
* @example
* ```typescript
* import { Resource, invoke } from '@tauri-apps/api/core';
* export class DatabaseHandle extends Resource {
*   static async open(path: string): Promise<DatabaseHandle> {
*     const rid: number = await invoke('open_db', { path });
*     return new DatabaseHandle(rid);
*   }
*
*   async execute(sql: string): Promise<void> {
*     await invoke('execute_sql', { rid: this.rid, sql });
*   }
* }
* ```
*/
var Resource = class {
	get rid() {
		return __classPrivateFieldGet(this, _Resource_rid, "f");
	}
	constructor(rid) {
		_Resource_rid.set(this, void 0);
		__classPrivateFieldSet(this, _Resource_rid, rid, "f");
	}
	/**
	* Destroys and cleans up this resource from memory.
	* **You should not call any method on this object anymore and should drop any reference to it.**
	*/
	async close() {
		return invoke("plugin:resources|close", { rid: this.rid });
	}
};
_Resource_rid = /* @__PURE__ */ new WeakMap();
//#endregion
//#region node_modules/@tauri-apps/api/path.js
/**
* The path module provides utilities for working with file and directory paths.
*
* This package is also accessible with `window.__TAURI__.path` when [`app.withGlobalTauri`](https://v2.tauri.app/reference/config/#withglobaltauri) in `tauri.conf.json` is set to `true`.
*
* It is recommended to allowlist only the APIs you use for optimal bundle size and security.
* @module
*/
/**
* @since 2.0.0
*/
var BaseDirectory;
(function(BaseDirectory) {
	/**
	* @see {@link audioDir} for more information.
	*/
	BaseDirectory[BaseDirectory["Audio"] = 1] = "Audio";
	/**
	* @see {@link cacheDir} for more information.
	*/
	BaseDirectory[BaseDirectory["Cache"] = 2] = "Cache";
	/**
	* @see {@link configDir} for more information.
	*/
	BaseDirectory[BaseDirectory["Config"] = 3] = "Config";
	/**
	* @see {@link dataDir} for more information.
	*/
	BaseDirectory[BaseDirectory["Data"] = 4] = "Data";
	/**
	* @see {@link localDataDir} for more information.
	*/
	BaseDirectory[BaseDirectory["LocalData"] = 5] = "LocalData";
	/**
	* @see {@link documentDir} for more information.
	*/
	BaseDirectory[BaseDirectory["Document"] = 6] = "Document";
	/**
	* @see {@link downloadDir} for more information.
	*/
	BaseDirectory[BaseDirectory["Download"] = 7] = "Download";
	/**
	* @see {@link pictureDir} for more information.
	*/
	BaseDirectory[BaseDirectory["Picture"] = 8] = "Picture";
	/**
	* @see {@link publicDir} for more information.
	*/
	BaseDirectory[BaseDirectory["Public"] = 9] = "Public";
	/**
	* @see {@link videoDir} for more information.
	*/
	BaseDirectory[BaseDirectory["Video"] = 10] = "Video";
	/**
	* @see {@link resourceDir} for more information.
	*/
	BaseDirectory[BaseDirectory["Resource"] = 11] = "Resource";
	/**
	* @see {@link tempDir} for more information.
	*/
	BaseDirectory[BaseDirectory["Temp"] = 12] = "Temp";
	/**
	* @see {@link appConfigDir} for more information.
	*/
	BaseDirectory[BaseDirectory["AppConfig"] = 13] = "AppConfig";
	/**
	* @see {@link appDataDir} for more information.
	*/
	BaseDirectory[BaseDirectory["AppData"] = 14] = "AppData";
	/**
	* @see {@link appLocalDataDir} for more information.
	*/
	BaseDirectory[BaseDirectory["AppLocalData"] = 15] = "AppLocalData";
	/**
	* @see {@link appCacheDir} for more information.
	*/
	BaseDirectory[BaseDirectory["AppCache"] = 16] = "AppCache";
	/**
	* @see {@link appLogDir} for more information.
	*/
	BaseDirectory[BaseDirectory["AppLog"] = 17] = "AppLog";
	/**
	* @see {@link desktopDir} for more information.
	*/
	BaseDirectory[BaseDirectory["Desktop"] = 18] = "Desktop";
	/**
	* @see {@link executableDir} for more information.
	*/
	BaseDirectory[BaseDirectory["Executable"] = 19] = "Executable";
	/**
	* @see {@link fontDir} for more information.
	*/
	BaseDirectory[BaseDirectory["Font"] = 20] = "Font";
	/**
	* @see {@link homeDir} for more information.
	*/
	BaseDirectory[BaseDirectory["Home"] = 21] = "Home";
	/**
	* @see {@link runtimeDir} for more information.
	*/
	BaseDirectory[BaseDirectory["Runtime"] = 22] = "Runtime";
	/**
	* @see {@link templateDir} for more information.
	*/
	BaseDirectory[BaseDirectory["Template"] = 23] = "Template";
})(BaseDirectory || (BaseDirectory = {}));
//#endregion
export { Resource as n, invoke as r, Channel as t };
