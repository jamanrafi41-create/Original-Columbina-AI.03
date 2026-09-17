/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { X, MoreVertical, PlusSquare, Smartphone, CheckCircle2, Sparkles } from 'lucide-react';
import { useAndroidPwa } from '../hooks/useAndroidPwa';

interface AndroidInstallGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTriggerInstall?: () => void;
}

export const AndroidInstallGuideModal: React.FC<AndroidInstallGuideModalProps> = ({
  isOpen,
  onClose,
  onTriggerInstall,
}) => {
  const { isPromptAvailable, triggerInstallPrompt } = useAndroidPwa();

  if (!isOpen) return null;

  const handlePromptClick = async () => {
    const result = await triggerInstallPrompt();
    if (result.outcome === 'accepted') {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fade-in pointer-events-auto">
      <div
        className="relative w-full max-w-sm rounded-2xl bg-neutral-900 border border-purple-500/30 p-5 shadow-2xl text-neutral-200"
        role="dialog"
        aria-modal="true"
        aria-labelledby="install-modal-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-purple-950/80 border border-purple-500/50 flex items-center justify-center overflow-hidden">
              <img
                src="/pwa-192x192.png"
                alt="Columbina Logo"
                className="w-full h-full object-cover"
              />
            </div>
            <div>
              <h2 id="install-modal-title" className="text-sm font-semibold text-white">
                Install Columbina on Android
              </h2>
              <p className="text-[11px] text-purple-300">Standalone Fullscreen Experience</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-full text-neutral-400 hover:text-white hover:bg-white/10 transition"
            aria-label="Close dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Instructions */}
        <div className="space-y-3 text-xs">
          <p className="text-neutral-300 leading-relaxed">
            Install Columbina on your Android home screen to launch the live website directly without
            address bars or browser tabs.
          </p>

          <div className="rounded-xl bg-neutral-950/70 border border-white/5 p-3 space-y-2.5">
            <div className="flex items-start gap-2.5">
              <div className="w-5 h-5 rounded-full bg-purple-900/60 text-purple-300 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                1
              </div>
              <div className="flex-1">
                <span className="font-medium text-white">Open Chrome Menu</span>
                <p className="text-neutral-400 text-[11px] flex items-center gap-1 mt-0.5">
                  Tap the three dots (<MoreVertical className="w-3 h-3 text-purple-400 inline" />) in
                  the top-right corner.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-2.5">
              <div className="w-5 h-5 rounded-full bg-purple-900/60 text-purple-300 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                2
              </div>
              <div className="flex-1">
                <span className="font-medium text-white">Tap "Install app"</span>
                <p className="text-neutral-400 text-[11px] flex items-center gap-1 mt-0.5">
                  Or select <PlusSquare className="w-3 h-3 text-purple-400 inline" />{' '}
                  <strong>Add to Home screen</strong>.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-2.5">
              <div className="w-5 h-5 rounded-full bg-purple-900/60 text-purple-300 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                3
              </div>
              <div className="flex-1">
                <span className="font-medium text-white">Confirm Installation</span>
                <p className="text-neutral-400 text-[11px] flex items-center gap-1 mt-0.5">
                  Tap <strong>Install</strong>. Columbina will appear on your home screen.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 p-2 rounded-lg bg-purple-950/30 border border-purple-500/20 text-[11px] text-purple-200">
            <Smartphone className="w-4 h-4 text-purple-400 shrink-0" />
            <span>Opens directly in full-screen with no browser address bar.</span>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-4 flex gap-2">
          {isPromptAvailable ? (
            <button
              type="button"
              onClick={handlePromptClick}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-medium text-xs shadow-lg transition"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Prompt Android Install</span>
            </button>
          ) : null}
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2 px-3 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-medium transition"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
};
