/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Download, Sparkles } from 'lucide-react';
import { useAndroidPwa } from '../hooks/useAndroidPwa';

interface AndroidInstallButtonProps {
  onInstalled?: (message: string) => void;
  onShowGuide?: () => void;
}

export const AndroidInstallButton: React.FC<AndroidInstallButtonProps> = ({
  onInstalled,
  onShowGuide,
}) => {
  const { showButton, triggerInstallPrompt } = useAndroidPwa();
  const [isInstalling, setIsInstalling] = useState(false);

  // Strictly Android only, when prompt is available, and not already installed
  if (!showButton) {
    return null;
  }

  const handleClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsInstalling(true);
    try {
      const result = await triggerInstallPrompt();
      if (result.outcome === 'accepted') {
        onInstalled?.(result.message);
      } else if (result.outcome === 'unavailable' && onShowGuide) {
        onShowGuide();
      }
    } finally {
      setIsInstalling(false);
    }
  };

  return (
    <div className="fixed top-4 right-4 z-40 animate-fade-in pointer-events-auto">
      <button
        type="button"
        id="android-pwa-install-button"
        onClick={handleClick}
        disabled={isInstalling}
        className="group relative flex items-center gap-2.5 px-3.5 py-2 rounded-full bg-neutral-900/90 hover:bg-neutral-850 active:scale-95 text-white text-xs font-medium backdrop-blur-xl border border-purple-500/40 shadow-xl shadow-black/70 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-purple-400"
        title="Install Columbina as a standalone app on your Android phone"
        aria-label="Install Columbina on Android"
      >
        {/* Glow halo */}
        <span className="absolute -inset-0.5 rounded-full bg-gradient-to-r from-purple-600/30 to-rose-600/30 blur-sm opacity-70 group-hover:opacity-100 transition duration-300 pointer-events-none" />

        {/* Columbina Mini Icon */}
        <div className="relative w-5 h-5 rounded-full overflow-hidden bg-neutral-950 border border-purple-400/40 flex items-center justify-center shrink-0">
          <img
            src="/pwa-192x192.png"
            alt="Columbina"
            className="w-full h-full object-cover"
            onError={(e) => {
              // fallback icon
              (e.currentTarget as HTMLElement).style.display = 'none';
            }}
          />
          <Download className="w-3 h-3 text-purple-300 absolute" />
        </div>

        <div className="relative flex flex-col items-start leading-tight">
          <div className="flex items-center gap-1 text-[11px] font-semibold text-purple-200">
            <span>{isInstalling ? 'Installing...' : 'Install Columbina'}</span>
            <Sparkles className="w-3 h-3 text-purple-400" />
          </div>
          <span className="text-[9px] text-neutral-400 font-normal">Android Standalone</span>
        </div>
      </button>
    </div>
  );
};
