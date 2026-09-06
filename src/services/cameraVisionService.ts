/**
 * Camera & Vision Control Service
 *
 * Provides real-time camera device control across Desktop, Android, iOS, and Tablets.
 * Supports natural voice and typed commands, front/back facing mode switching,
 * snapshot frame extraction for AI visual understanding, and privacy-first lifecycle management.
 */

import { CameraState, CameraFacingMode, CameraCommandParseResult, CameraCommandType } from '../types';

export type CameraStateListener = (state: CameraState, error?: string) => void;
export type CameraFacingListener = (facingMode: CameraFacingMode) => void;

class CameraVisionService {
  private state: CameraState = 'CAMERA_OFF';
  private facingMode: CameraFacingMode = 'user';
  private stream: MediaStream | null = null;
  private videoElement: HTMLVideoElement | null = null;
  private errorMessage: string = '';
  private stateListeners: Set<CameraStateListener> = new Set();
  private facingListeners: Set<CameraFacingListener> = new Set();
  private availableCamerasCount: number = 1;

  constructor() {
    this.updateAvailableCameras();
    if (typeof navigator !== 'undefined' && navigator.mediaDevices) {
      navigator.mediaDevices.addEventListener?.('devicechange', () => {
        this.updateAvailableCameras();
      });
    }
  }

  private async updateAvailableCameras() {
    try {
      if (typeof navigator !== 'undefined' && navigator.mediaDevices?.enumerateDevices) {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter((d) => d.kind === 'videoinput');
        this.availableCamerasCount = videoDevices.length;
      }
    } catch {
      this.availableCamerasCount = 1;
    }
  }

  public getAvailableCamerasCount(): number {
    return this.availableCamerasCount;
  }

  public getState(): CameraState {
    return this.state;
  }

  public getFacingMode(): CameraFacingMode {
    return this.facingMode;
  }

  public getErrorMessage(): string {
    return this.errorMessage;
  }

  public isCameraActive(): boolean {
    return this.state === 'CAMERA_ON' && Boolean(this.stream && this.stream.active);
  }

  public onStateChange(listener: CameraStateListener): () => void {
    this.stateListeners.add(listener);
    listener(this.state, this.errorMessage);
    return () => this.stateListeners.delete(listener);
  }

  public onFacingChange(listener: CameraFacingListener): () => void {
    this.facingListeners.add(listener);
    listener(this.facingMode);
    return () => this.facingListeners.delete(listener);
  }

  private setState(newState: CameraState, error: string = '') {
    this.state = newState;
    this.errorMessage = error;
    this.stateListeners.forEach((l) => l(newState, error));
  }

  private setFacing(newFacing: CameraFacingMode) {
    this.facingMode = newFacing;
    this.facingListeners.forEach((l) => l(newFacing));
  }

  /**
   * Attaches a video element for preview rendering.
   */
  public attachVideoElement(video: HTMLVideoElement | null) {
    this.videoElement = video;
    if (this.videoElement && this.stream) {
      this.videoElement.srcObject = this.stream;
      this.videoElement.play().catch(() => {});
    }
  }

  /**
   * Activates the camera with the specified or current facing mode.
   */
  public async startCamera(facing: CameraFacingMode = this.facingMode): Promise<{ success: boolean; message: string }> {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      this.setState('CAMERA_ERROR', 'Camera is not supported on this browser or environment.');
      return { success: false, message: 'Camera is not supported in this browser.' };
    }

    // If switching, set state accordingly
    if (this.state === 'CAMERA_ON' && facing !== this.facingMode) {
      this.setState('CAMERA_SWITCHING');
    } else {
      this.setState('CAMERA_REQUESTING_PERMISSION');
    }

    // Stop existing stream first to cleanly release hardware
    this.stopStreamOnly();

    try {
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: { ideal: facing },
          width: { ideal: 1280, max: 1920 },
          height: { ideal: 720, max: 1080 },
        },
        audio: false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      this.stream = stream;
      this.setFacing(facing);

      if (this.videoElement) {
        this.videoElement.srcObject = stream;
        await this.videoElement.play().catch(() => {});
      }

      this.setState('CAMERA_ON');
      await this.updateAvailableCameras();

      const msg = facing === 'environment' ? 'Back camera on.' : 'Alright, I\'m looking.';
      return { success: true, message: msg };
    } catch (err: any) {
      let friendlyError = 'Failed to access camera.';
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        friendlyError = 'Camera permission was denied. Please allow camera access in your browser settings.';
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        friendlyError = 'No camera device found on this system.';
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        friendlyError = 'Camera is already in use by another application or tab.';
      } else if (err.name === 'OverconstrainedError') {
        // Fallback without specific facingMode constraints
        try {
          const fallbackStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
          this.stream = fallbackStream;
          if (this.videoElement) {
            this.videoElement.srcObject = fallbackStream;
            await this.videoElement.play().catch(() => {});
          }
          this.setState('CAMERA_ON');
          return { success: true, message: 'Alright, I\'m looking.' };
        } catch (fbErr: any) {
          friendlyError = fbErr?.message || 'Unable to satisfy camera constraints.';
        }
      }

      this.setState('CAMERA_ERROR', friendlyError);
      return { success: false, message: friendlyError };
    }
  }

  /**
   * Completely stops and releases the camera hardware.
   */
  public stopCamera(): string {
    this.stopStreamOnly();
    this.setState('CAMERA_OFF');
    return 'Camera off.';
  }

  private stopStreamOnly() {
    if (this.stream) {
      this.stream.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {}
      });
      this.stream = null;
    }
    if (this.videoElement) {
      this.videoElement.srcObject = null;
    }
  }

  /**
   * Switches between front ('user') and rear ('environment') cameras.
   */
  public async switchCamera(): Promise<{ success: boolean; message: string }> {
    if (this.availableCamerasCount <= 1 && this.facingMode === 'user') {
      // If on desktop or only 1 camera reported, try switching to environment or notify
      const nextFacing: CameraFacingMode = this.facingMode === 'user' ? 'environment' : 'user';
      const result = await this.startCamera(nextFacing);
      if (!result.success && this.availableCamerasCount <= 1) {
        return { success: false, message: 'Only one camera is available on this device.' };
      }
      return { success: true, message: 'Switched.' };
    }

    const nextFacing: CameraFacingMode = this.facingMode === 'user' ? 'environment' : 'user';
    const result = await this.startCamera(nextFacing);
    return {
      success: result.success,
      message: result.success ? 'Switched.' : result.message,
    };
  }

  /**
   * Captures the current camera video frame as a compressed JPEG base64 string.
   * Scaled to optimal resolution for high-speed, accurate AI visual reasoning.
   */
  public captureFrameBase64(maxWidth: number = 640, maxHeight: number = 480, quality: number = 0.8): string | null {
    if (!this.isCameraActive()) {
      return null;
    }

    try {
      let video = this.videoElement;
      let tempVideoCreated = false;

      if (!video && this.stream) {
        video = document.createElement('video');
        video.srcObject = this.stream;
        video.muted = true;
        video.playsInline = true;
        tempVideoCreated = true;
      }

      if (!video || video.readyState < 2) {
        return null;
      }

      const canvas = document.createElement('canvas');
      const vWidth = video.videoWidth || 640;
      const vHeight = video.videoHeight || 480;

      // Maintain aspect ratio within bounding box
      let targetWidth = vWidth;
      let targetHeight = vHeight;

      if (targetWidth > maxWidth || targetHeight > maxHeight) {
        const ratio = Math.min(maxWidth / targetWidth, maxHeight / targetHeight);
        targetWidth = Math.round(targetWidth * ratio);
        targetHeight = Math.round(targetHeight * ratio);
      }

      canvas.width = targetWidth;
      canvas.height = targetHeight;

      const ctx = canvas.getContext('2d');
      if (!ctx) return null;

      ctx.drawImage(video, 0, 0, targetWidth, targetHeight);
      const dataUrl = canvas.toDataURL('image/jpeg', quality);

      if (tempVideoCreated && video) {
        video.srcObject = null;
      }

      // Return raw base64 data without data:image/jpeg;base64, prefix if needed, or full dataUrl
      return dataUrl;
    } catch (e) {
      console.warn('[CameraVisionService] Frame capture failed:', e);
      return null;
    }
  }

  /**
   * Parses user input text (from speech or typing) for natural camera commands.
   */
  public parseCameraCommand(input: string): CameraCommandParseResult {
    if (!input || typeof input !== 'string') return { isCommand: false };

    const lower = input.trim().toLowerCase();

    // 1. Turn OFF commands
    if (
      /\b(turn\s*off(\s*the)?\s*camera|camera\s*off|close(\s*the)?\s*camera|stop(\s*the)?\s*camera|stop\s*looking|disable(\s*the)?\s*camera|turn\s*your\s*vision\s*off|stop\s*vision|close\s*vision)\b/i.test(
        lower
      ) ||
      lower === 'turn off camera' ||
      lower === 'camera off' ||
      lower === 'stop camera' ||
      lower === 'stop looking'
    ) {
      return {
        isCommand: true,
        type: 'turn_off',
        responsePrompt: 'Camera off.',
      };
    }

    // 2. Front camera commands
    if (
      /\b(use\s*(the\s*)?front\s*camera|switch\s*to\s*(the\s*)?front\s*camera|front\s*camera(\s*on)?|front\s*facing\s*camera)\b/i.test(
        lower
      )
    ) {
      return {
        isCommand: true,
        type: 'front_camera',
        facingMode: 'user',
        responsePrompt: 'Front camera on.',
      };
    }

    // 3. Back / Rear camera commands
    if (
      /\b(use\s*(the\s*)?back\s*camera|switch\s*to\s*(the\s*)?back\s*camera|back\s*camera(\s*on)?|rear\s*camera(\s*on)?|use\s*(the\s*)?rear\s*camera|switch\s*to\s*(the\s*)?rear\s*camera)\b/i.test(
        lower
      )
    ) {
      return {
        isCommand: true,
        type: 'back_camera',
        facingMode: 'environment',
        responsePrompt: 'Back camera on.',
      };
    }

    // 4. Switch / Flip camera commands
    if (
      /\b(switch(\s*the)?\s*camera|change(\s*the)?\s*camera|flip(\s*the)?\s*camera|switch\s*to\s*the\s*other\s*camera|flip\s*camera)\b/i.test(
        lower
      )
    ) {
      return {
        isCommand: true,
        type: 'switch_camera',
        responsePrompt: 'Switched.',
      };
    }

    // 5. Turn ON commands & Visual Requests
    if (
      /\b(turn\s*on(\s*the)?\s*camera|open(\s*the)?\s*camera|start(\s*the)?\s*camera|camera\s*on|can\s*you\s*see\s*me|look\s*through(\s*the)?\s*camera|use\s*my\s*camera|look\s*at\s*this|can\s*you\s*see\s*what'?s\s*in\s*front\s*of\s*me|watch\s*this|turn\s*your\s*vision\s*on|start\s*vision|enable\s*camera|look\s*at\s*me|see\s*me)\b/i.test(
        lower
      ) ||
      lower === 'camera on' ||
      lower === 'turn on camera' ||
      lower === 'start camera' ||
      lower === 'open camera'
    ) {
      return {
        isCommand: true,
        type: 'turn_on',
        facingMode: 'user',
        responsePrompt: 'Alright, I\'m looking.',
      };
    }

    return { isCommand: false };
  }
}

export const cameraVisionService = new CameraVisionService();
