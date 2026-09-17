/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export type InstallTriggerResult = {
  outcome: 'accepted' | 'dismissed' | 'unavailable' | 'not_android' | 'already_installed';
  message: string;
};

class AndroidPwaService {
  private deferredPrompt: BeforeInstallPromptEvent | null = null;
  private isInstalled: boolean = false;
  private listeners: Array<() => void> = [];
  private isInitialized: boolean = false;

  constructor() {
    if (typeof window !== 'undefined') {
      this.init();
    }
  }

  public init() {
    if (this.isInitialized || typeof window === 'undefined') return;
    this.isInitialized = true;

    // Check if early prompt was already captured by index.html head script
    if ((window as any).__columbinaDeferredInstallPrompt) {
      this.deferredPrompt = (window as any).__columbinaDeferredInstallPrompt;
      console.log('[AndroidPWA] Synced early captured beforeinstallprompt from window.');
    }

    // Detect if already installed / running in standalone mode
    this.checkInstalledState();

    // Listen for display-mode changes
    try {
      const matchMediaStandalone = window.matchMedia('(display-mode: standalone)');
      const handleDisplayModeChange = (e: MediaQueryListEvent) => {
        if (e.matches) {
          this.isInstalled = true;
          this.deferredPrompt = null;
          (window as any).__columbinaDeferredInstallPrompt = null;
          this.notifyListeners();
        }
      };
      if (matchMediaStandalone.addEventListener) {
        matchMediaStandalone.addEventListener('change', handleDisplayModeChange);
      } else {
        matchMediaStandalone.addListener(handleDisplayModeChange);
      }
    } catch {
      // safe fallback for older browsers
    }

    // Listen for early event dispatch from index.html
    window.addEventListener('columbina:pwa-prompt-ready', () => {
      if ((window as any).__columbinaDeferredInstallPrompt) {
        this.deferredPrompt = (window as any).__columbinaDeferredInstallPrompt;
        this.notifyListeners();
        console.log('[AndroidPWA] Received columbina:pwa-prompt-ready notification.');
      }
    });

    // Capture beforeinstallprompt if triggered after bundle load
    window.addEventListener('beforeinstallprompt', (e: Event) => {
      // Prevent browser default mini-infobar from disappearing
      e.preventDefault();
      this.deferredPrompt = e as BeforeInstallPromptEvent;
      (window as any).__columbinaDeferredInstallPrompt = e;
      this.notifyListeners();
      console.log('[AndroidPWA] Captured beforeinstallprompt event.');
    });

    // Listen for appinstalled
    window.addEventListener('appinstalled', () => {
      this.isInstalled = true;
      this.deferredPrompt = null;
      (window as any).__columbinaDeferredInstallPrompt = null;
      this.notifyListeners();
      console.log('[AndroidPWA] Columbina installed successfully on device.');
    });

    // Ensure service worker is registered for PWA compliance
    this.ensureServiceWorker();
  }

  public checkInstalledState(): boolean {
    if (typeof window === 'undefined') return false;

    // 1. W3C standard standalone display mode check
    const isStandaloneDisplay =
      window.matchMedia('(display-mode: standalone)').matches ||
      window.matchMedia('(display-mode: fullscreen)').matches ||
      window.matchMedia('(display-mode: minimal-ui)').matches;

    // 2. iOS/WebKit standalone flag
    const isNavigatorStandalone =
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;

    // 3. Query parameter from manifest start_url (?mode=standalone)
    const isStandaloneQuery =
      typeof window.location !== 'undefined' &&
      window.location.search.includes('mode=standalone');

    this.isInstalled = Boolean(isStandaloneDisplay || isNavigatorStandalone || isStandaloneQuery);
    return this.isInstalled;
  }

  private async ensureServiceWorker() {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
    try {
      const registerSW = async () => {
        try {
          const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
          console.log('[AndroidPWA] Registered service worker successfully with scope:', reg.scope);
          // Check for service worker updates immediately
          reg.update().catch(() => {});
        } catch (err) {
          console.warn('[AndroidPWA] Service worker registration notice:', err);
        }
      };

      if (document.readyState === 'complete') {
        await registerSW();
      } else {
        window.addEventListener('load', () => {
          registerSW();
        });
      }
    } catch (err) {
      console.warn('[AndroidPWA] ensureServiceWorker caught:', err);
    }
  }

  public isAndroid(): boolean {
    if (typeof window === 'undefined') return false;
    const ua = (navigator.userAgent || '').toLowerCase();
    const uaDataPlatform = ((navigator as any).userAgentData?.platform || '').toLowerCase();
    const platform = (navigator.platform || '').toLowerCase();
    return (
      ua.includes('android') ||
      uaDataPlatform.includes('android') ||
      platform.includes('android') ||
      /android/i.test(ua)
    );
  }

  public isStandalone(): boolean {
    return this.checkInstalledState();
  }

  public isPromptAvailable(): boolean {
    if (this.isStandalone()) return false;
    if (!this.deferredPrompt && typeof window !== 'undefined' && (window as any).__columbinaDeferredInstallPrompt) {
      this.deferredPrompt = (window as any).__columbinaDeferredInstallPrompt;
    }
    return Boolean(this.deferredPrompt);
  }

  public shouldShowAndroidInstallButton(): boolean {
    // Strictly Android mobile only, and hidden when already installed in standalone mode
    return this.isAndroid() && !this.isStandalone();
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private notifyListeners() {
    this.listeners.forEach((listener) => {
      try {
        listener();
      } catch (err) {
        console.error('[AndroidPWA] Listener error:', err);
      }
    });
  }

  /**
   * Triggers the real Android PWA installation prompt
   */
  public async triggerInstallPrompt(): Promise<InstallTriggerResult> {
    if (this.isStandalone()) {
      return {
        outcome: 'already_installed',
        message: 'Columbina is already installed and running as a standalone app on your Android device.',
      };
    }

    if (!this.isAndroid()) {
      return {
        outcome: 'not_android',
        message: 'The standalone phone installation is tailored specifically for Android devices.',
      };
    }

    if (!this.deferredPrompt && typeof window !== 'undefined' && (window as any).__columbinaDeferredInstallPrompt) {
      this.deferredPrompt = (window as any).__columbinaDeferredInstallPrompt;
    }

    if (!this.deferredPrompt) {
      return {
        outcome: 'unavailable',
        message:
          "To install Columbina on your Android phone, tap your browser's menu (the three dots ⋮ at the top right) and select 'Install app' or 'Add to Home screen'.",
      };
    }

    try {
      const promptEvent = this.deferredPrompt;
      // Prompt the user with the real browser install dialog
      await promptEvent.prompt();
      const choice = await promptEvent.userChoice;

      if (choice.outcome === 'accepted') {
        this.isInstalled = true;
        this.deferredPrompt = null;
        if (typeof window !== 'undefined') {
          (window as any).__columbinaDeferredInstallPrompt = null;
        }
        this.notifyListeners();
        return {
          outcome: 'accepted',
          message:
            "Thank you... Columbina has been added to your Android home screen. You can tap the Columbina icon anytime to launch our full-screen experience.",
        };
      } else {
        return {
          outcome: 'dismissed',
          message: "The installation prompt was dismissed. You can install anytime from the Install button.",
        };
      }
    } catch (err: any) {
      console.error('[AndroidPWA] Installation prompt error:', err);
      return {
        outcome: 'unavailable',
        message:
          "To install Columbina on your Android phone, tap your browser's menu (the three dots ⋮ at the top right) and select 'Install app' or 'Add to Home screen'.",
      };
    }
  }

  /**
   * Matches install commands in user speech or text input
   */
  public isInstallCommand(text: string): boolean {
    const clean = (text || '').toLowerCase().trim().replace(/[.!?]+$/, '');
    if (!clean) return false;

    // Specific explicit phrases from user request
    if (
      clean.includes('install this website in my phone') ||
      clean.includes('install this website on my phone') ||
      clean.includes('install this website to my phone') ||
      clean.includes('install the website in my phone') ||
      clean.includes('install the website on my phone') ||
      clean.includes('install the website to my phone') ||
      clean.includes('install website in my phone') ||
      clean.includes('install website on my phone') ||
      clean.includes('install website to my phone') ||
      clean.includes('install this site in my phone') ||
      clean.includes('install this site on my phone') ||
      clean.includes('install this in my phone') ||
      clean.includes('install this on my phone') ||
      clean.includes('install this to my phone') ||
      clean.includes('install website as app') ||
      clean.includes('install this website as app') ||
      clean.includes('install as app') ||
      clean.includes('install columbina in my phone') ||
      clean.includes('install columbina on my phone') ||
      clean.includes('install columbina to my phone') ||
      clean.includes('install this website on my android') ||
      clean.includes('install this website in my android') ||
      clean.includes('install this website on android') ||
      clean.includes('download this to my phone') ||
      clean.includes('download this in my phone') ||
      clean.includes('download this on my phone') ||
      clean.includes('download website to my phone') ||
      clean.includes('download columbina to my phone') ||
      clean.includes('add this website to my phone') ||
      clean.includes('add website to my phone') ||
      clean.includes('add this app to my phone') ||
      clean.includes('add this to my phone') ||
      clean.includes('add app to my phone') ||
      clean.includes('add to my phone') ||
      clean.includes('install this app') ||
      clean.includes('install columbina app') ||
      clean.includes('install columbina') ||
      clean.includes('install app on my phone') ||
      clean.includes('install app on android') ||
      clean.includes('install the app') ||
      clean.includes('download columbina') ||
      clean.includes('add to home screen') ||
      clean.includes('add columbina to home screen') ||
      /(install|download|add)\s+(this\s+|the\s+)?(website|site|app|columbina)?.*(phone|android|mobile|home\s*screen)/i.test(clean)
    ) {
      return true;
    }

    // Multilingual command patterns:
    // Hindi: "phone mein install karo", "app install karo", "download karo"
    if (
      /फोन\s*में\s*(इंस्टॉल|डाउनलोड)/i.test(clean) ||
      /(install|download)\s*(karo|kijiye|kar do)/i.test(clean)
    ) {
      return true;
    }

    // Bengali: "phone e install koro", "app ta install koro"
    if (
      /ফোনে\s*(ইন্সটল|ডাউনলোড)/i.test(clean) ||
      /(install|download)\s*(koro|korun)/i.test(clean)
    ) {
      return true;
    }

    // Japanese: "スマホにインストールして", "アプリをインストール"
    if (/インストール/i.test(clean)) {
      return true;
    }

    // Composite keywords: action (install/download/add) + target (phone/android/mobile/home screen/app)
    const hasAction = /\b(install|download|add)\b/i.test(clean);
    const hasTarget = /\b(phone|android|mobile|homescreen|home\s*screen|app)\b/i.test(clean);

    if (hasAction && hasTarget) {
      // Exclude coding/technical queries (e.g., "npm install", "install package")
      if (
        !clean.includes('package') &&
        !clean.includes('library') &&
        !clean.includes('module') &&
        !clean.includes('npm') &&
        !clean.includes('dependency')
      ) {
        return true;
      }
    }

    return false;
  }
}

export const androidPwaService = new AndroidPwaService();
