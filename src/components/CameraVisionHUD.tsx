/**
 * Camera & Vision HUD Component
 *
 * Responsive, ethereal picture-in-picture video preview with real-time camera state indicators,
 * mobile front/rear camera flip controls, permission guidance, and snapshot flash feedback.
 */

import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Camera,
  CameraOff,
  SwitchCamera,
  Eye,
  EyeOff,
  Minimize2,
  Maximize2,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { cameraVisionService } from '../services/cameraVisionService';
import { CameraFacingMode, CameraState } from '../types';

interface CameraVisionHUDProps {
  onNotify?: (message: string) => void;
  isAiAnalyzing?: boolean;
}

export const CameraVisionHUD: React.FC<CameraVisionHUDProps> = ({
  onNotify,
  isAiAnalyzing = false,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [cameraState, setCameraState] = useState<CameraState>(cameraVisionService.getState());
  const [facingMode, setFacingMode] = useState<CameraFacingMode>(cameraVisionService.getFacingMode());
  const [errorMessage, setErrorMessage] = useState<string>(cameraVisionService.getErrorMessage());
  const [isMinimized, setIsMinimized] = useState<boolean>(false);
  const [showSnapshotFlash, setShowSnapshotFlash] = useState<boolean>(false);
  const [availableCount, setAvailableCount] = useState<number>(1);

  useEffect(() => {
    const unsubState = cameraVisionService.onStateChange((state, err) => {
      setCameraState(state);
      setErrorMessage(err || '');
      setAvailableCount(cameraVisionService.getAvailableCamerasCount());
    });

    const unsubFacing = cameraVisionService.onFacingChange((facing) => {
      setFacingMode(facing);
    });

    return () => {
      unsubState();
      unsubFacing();
    };
  }, []);

  useEffect(() => {
    if (videoRef.current) {
      cameraVisionService.attachVideoElement(videoRef.current);
    }
  }, [cameraState]);

  // Flash animation when AI captures/analyzes visual frame
  useEffect(() => {
    if (isAiAnalyzing && cameraState === 'CAMERA_ON') {
      setShowSnapshotFlash(true);
      const timer = setTimeout(() => setShowSnapshotFlash(false), 600);
      return () => clearTimeout(timer);
    }
  }, [isAiAnalyzing, cameraState]);

  const handleTogglePower = async () => {
    if (cameraState === 'CAMERA_ON' || cameraState === 'CAMERA_SWITCHING') {
      const msg = cameraVisionService.stopCamera();
      onNotify?.(msg);
    } else {
      const result = await cameraVisionService.startCamera();
      onNotify?.(result.message);
    }
  };

  const handleSwitchCamera = async () => {
    const result = await cameraVisionService.switchCamera();
    onNotify?.(result.message);
  };

  const isCameraActive = cameraState === 'CAMERA_ON' || cameraState === 'CAMERA_SWITCHING';

  return (
    <div
      id="camera-vision-hud-container"
      className="fixed top-20 right-4 z-40 flex flex-col items-end pointer-events-auto select-none"
    >
      <AnimatePresence>
        {isCameraActive && (
          <motion.div
            id="camera-pip-panel"
            className="hidden pointer-events-none"
          >
            {/* Live Video Feed (Hidden from user, active for Columbina) */}
            <video
              id="camera-vision-live-video"
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="hidden"
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Permission Requesting State Banner */}
      <AnimatePresence>
        {cameraState === 'CAMERA_REQUESTING_PERMISSION' && (
          <motion.div
            id="camera-permission-banner"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mt-2 p-3 rounded-xl bg-slate-900/90 border border-amber-500/40 shadow-xl backdrop-blur-md text-amber-200 text-xs flex items-center gap-2 max-w-xs"
          >
            <RefreshCw className="w-4 h-4 animate-spin text-amber-400 shrink-0" />
            <span>Requesting camera permission from your browser...</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Camera Error State Banner */}
      <AnimatePresence>
        {cameraState === 'CAMERA_ERROR' && (
          <motion.div
            id="camera-error-banner"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mt-2 p-3.5 rounded-xl bg-rose-950/90 border border-rose-500/50 shadow-xl backdrop-blur-md text-rose-200 text-xs max-w-xs flex flex-col gap-2"
          >
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{errorMessage || 'Camera access error.'}</span>
            </div>
            <div className="flex items-center justify-end gap-2 mt-1">
              <button
                id="camera-error-dismiss-btn"
                onClick={() => cameraVisionService.stopCamera()}
                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] transition-colors"
              >
                Dismiss
              </button>
              <button
                id="camera-error-retry-btn"
                onClick={() => cameraVisionService.startCamera()}
                className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-medium text-[11px] transition-colors flex items-center gap-1"
              >
                <RefreshCw className="w-3 h-3" /> Retry
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
