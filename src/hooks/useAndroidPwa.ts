/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { androidPwaService } from '../services/androidPwaService';

export function useAndroidPwa() {
  const [isAndroid, setIsAndroid] = useState<boolean>(() => androidPwaService.isAndroid());
  const [isStandalone, setIsStandalone] = useState<boolean>(() => androidPwaService.isStandalone());
  const [isPromptAvailable, setIsPromptAvailable] = useState<boolean>(() =>
    androidPwaService.isPromptAvailable()
  );
  const [showButton, setShowButton] = useState<boolean>(() =>
    androidPwaService.shouldShowAndroidInstallButton()
  );

  useEffect(() => {
    // Initial sync
    setIsAndroid(androidPwaService.isAndroid());
    setIsStandalone(androidPwaService.isStandalone());
    setIsPromptAvailable(androidPwaService.isPromptAvailable());
    setShowButton(androidPwaService.shouldShowAndroidInstallButton());

    // Subscribe to changes
    const unsubscribe = androidPwaService.subscribe(() => {
      setIsAndroid(androidPwaService.isAndroid());
      setIsStandalone(androidPwaService.isStandalone());
      setIsPromptAvailable(androidPwaService.isPromptAvailable());
      setShowButton(androidPwaService.shouldShowAndroidInstallButton());
    });

    return unsubscribe;
  }, []);

  return {
    isAndroid,
    isStandalone,
    isPromptAvailable,
    showButton,
    triggerInstallPrompt: () => androidPwaService.triggerInstallPrompt(),
  };
}
