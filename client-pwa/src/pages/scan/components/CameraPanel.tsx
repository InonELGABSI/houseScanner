import { useEffect, useRef, useState } from 'react';
import type { CameraPanelProps } from '../../../types';

export function CameraPanel({ onCapture, onCameraError }: CameraPanelProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    let active = true;

    const initCamera = async () => {
      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
        });

        if (!active) {
          mediaStream.getTracks().forEach(track => track.stop());
          return;
        }

        setStream(mediaStream);
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }
        setError('');
      } catch (err) {
        console.error('Unable to access camera', err);
        setError('Unable to access camera');
        onCameraError?.();
      }
    };

    initCamera();

    return () => {
      active = false;
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCapture = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    if (!context) return;

    setIsCapturing(true);

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(blob => {
      if (!blob) {
        setIsCapturing(false);
        return;
      }

      const timestamp = Date.now();
      const file = new File([blob], `capture-${timestamp}.jpg`, { type: 'image/jpeg' });
      const url = URL.createObjectURL(blob);
      onCapture(file, url);
      setIsCapturing(false);
    }, 'image/jpeg', 0.85);
  };

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full rounded-xl border border-red-500/40 bg-red-900/20 p-6 text-center">
        <span className="text-4xl mb-3">🚫</span>
        <p className="text-red-300 font-medium mb-2">Camera unavailable</p>
        <p className="text-sm text-red-200/80">{error}. Try uploading images instead.</p>
      </div>
    );
  }

  return (
    <div className="relative h-full overflow-hidden rounded-xl border border-slate-700/70 bg-black">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="h-full w-full object-cover"
      />

      <div className="absolute bottom-6 left-1/2 flex -translate-x-1/2 flex-col items-center space-y-3">
        <button
          onClick={handleCapture}
          disabled={isCapturing}
          className={`h-20 w-20 rounded-full border-4 border-white/80 bg-white/10 backdrop-blur transition-all ${
            isCapturing ? 'scale-95 opacity-60' : 'hover:scale-110 active:scale-95'
          }`}
        >
          <div
            className={`h-full w-full rounded-full bg-white transition-transform ${
              isCapturing ? 'scale-75' : ''
            }`}
          />
        </button>
        <span className="rounded-full bg-black/60 px-3 py-1 text-xs font-medium text-white/80">
          Take photo
        </span>
      </div>

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
