/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />
/// <reference types="vite-plugin-pwa/react" />

/*
 If your editor still complains about the virtual modules, keep these fallback
 declarations. They are harmless if the real types are resolved, and satisfy TS
 when the Vite plugin hasn't provided them to the language server yet.
*/
declare module 'virtual:pwa-register' {
	export interface RegisterSWOptions {
		immediate?: boolean;
		onNeedRefresh?: () => void;
		onOfflineReady?: () => void;
		onRegistered?: (registration: ServiceWorkerRegistration | undefined) => void;
		onRegisterError?: (error: any) => void;
	}
	export function registerSW(options?: RegisterSWOptions): (reloadPage?: boolean) => Promise<void>;
}

declare module 'virtual:pwa-register/react' {
	interface UseRegisterSWOptions {
		immediate?: boolean;
		onNeedRefresh?: () => void;
		onOfflineReady?: () => void;
		onRegistered?: (registration: ServiceWorkerRegistration | undefined) => void;
		onRegisterError?: (error: any) => void;
	}
	interface RegisterSWReturn {
		needRefresh: { subscribe: (cb: (value: boolean) => void) => () => void };
		offlineReady: { subscribe: (cb: (value: boolean) => void) => void };
		updateServiceWorker: (reloadPage?: boolean) => Promise<void>;
	}
	export function useRegisterSW(options?: UseRegisterSWOptions): RegisterSWReturn;
}
