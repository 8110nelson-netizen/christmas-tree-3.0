import React, { useEffect, useRef, useState } from 'react';

interface HandControllerProps {
  enabled: boolean;
  onHandOpen: () => void;
  onHandClose: () => void;
  onHandLGesture: (active: boolean) => void;
  onHandMoveLeft: (delta: number) => void;
  onHandMoveRight: (delta: number) => void;
}

// Declare globals provided by script tags in index.html
declare global {
  interface Window {
    Hands: any;
    Camera: any;
  }
}

const HandController: React.FC<HandControllerProps> = ({ 
  enabled, 
  onHandOpen, 
  onHandClose,
  onHandLGesture,
  onHandMoveLeft, 
  onHandMoveRight 
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const handsRef = useRef<any>(null);
  const cameraRef = useRef<any>(null);
  const previousXRef = useRef<number | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  // Gesture State smoothing
  const gestureHistoryRef = useRef<string[]>([]);
  // To avoid spamming the callback, track local state of L gesture
  const isLActiveRef = useRef(false);

  useEffect(() => {
    if (!enabled) {
      if (cameraRef.current) {
        cameraRef.current.stop();
      }
      return;
    }

    const onResults = (results: any) => {
      setIsLoaded(true);

      // Draw minimal debug view
      if (canvasRef.current && results.image) {
        const ctx = canvasRef.current.getContext('2d');
        if (ctx) {
          ctx.save();
          ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
          ctx.drawImage(results.image, 0, 0, canvasRef.current.width, canvasRef.current.height);
          
          if (results.multiHandLandmarks) {
            for (const landmarks of results.multiHandLandmarks) {
               // Simple drawing
               for(const lm of landmarks) {
                   ctx.beginPath();
                   ctx.arc(lm.x * canvasRef.current.width, lm.y * canvasRef.current.height, 2, 0, 2 * Math.PI);
                   ctx.fillStyle = '#10b981';
                   ctx.fill();
               }
            }
          }
          ctx.restore();
        }
      }

      if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        const landmarks = results.multiHandLandmarks[0]; // Take first hand

        // --- 1. Movement Detection (Wrist - landmark 0) ---
        const currentX = landmarks[0].x;

        if (previousXRef.current !== null) {
          const delta = currentX - previousXRef.current;
          const sensitivity = 0.005; 
          
          if (delta > sensitivity) {
             onHandMoveRight(Math.abs(delta));
          } else if (delta < -sensitivity) {
             onHandMoveLeft(Math.abs(delta));
          }
        }
        previousXRef.current = currentX;


        // --- 2. Gesture Detection ---
        
        // Helper: Check if finger tip is higher (lower Y) than PIP joint
        const isFingerUp = (tipIdx: number, pipIdx: number) => {
            return landmarks[tipIdx].y < landmarks[pipIdx].y; 
        };

        // Helper: Check if finger is curled (Tip below PIP)
        const isFingerCurled = (tipIdx: number, pipIdx: number) => {
            return landmarks[tipIdx].y > landmarks[pipIdx].y;
        };

        // Thumb open check: Distance between Thumb Tip (4) and Index MCP (5)
        // If distance is large, thumb is extended
        const thumbTip = landmarks[4];
        const indexMCP = landmarks[5];
        const thumbDist = Math.hypot(thumbTip.x - indexMCP.x, thumbTip.y - indexMCP.y);
        const isThumbOpen = thumbDist > 0.05; // Threshold for thumb extension

        // Finger States
        const indexUp = isFingerUp(8, 6);
        const middleCurled = isFingerCurled(12, 10);
        const ringCurled = isFingerCurled(16, 14);
        const pinkyCurled = isFingerCurled(20, 18);

        // Standard Open Hand Check (for existing functionality)
        let extendedCount = 0;
        if (isFingerUp(8, 6)) extendedCount++;
        if (isFingerUp(12, 10)) extendedCount++;
        if (isFingerUp(16, 14)) extendedCount++;
        if (isFingerUp(20, 18)) extendedCount++;
        
        let currentGesture = 'NEUTRAL';

        // Priority 1: L-Shape (View Image)
        // Thumb Open + Index Up + Others Curled
        if (isThumbOpen && indexUp && middleCurled && ringCurled && pinkyCurled) {
            currentGesture = 'L_SHAPE';
        } 
        // Priority 2: Full Open (Scatter)
        else if (extendedCount >= 4) {
            currentGesture = 'OPEN';
        }
        // Priority 3: Closed Fist (Tree)
        else if (extendedCount === 0) {
            currentGesture = 'CLOSED';
        }

        // Debounce / Smoothing
        const history = gestureHistoryRef.current;
        history.push(currentGesture);
        if (history.length > 10) history.shift();

        // Count occurrences in history
        const lCount = history.filter(g => g === 'L_SHAPE').length;
        const openCount = history.filter(g => g === 'OPEN').length;
        const closedCount = history.filter(g => g === 'CLOSED').length;

        // Logic for L-Gesture Toggle
        // High threshold for L-Shape to avoid flickering
        if (lCount > 6) {
            if (!isLActiveRef.current) {
                isLActiveRef.current = true;
                onHandLGesture(true);
            }
        } else if (lCount < 3) {
            // Hysteresis to leave L-Shape
            if (isLActiveRef.current) {
                isLActiveRef.current = false;
                onHandLGesture(false);
            }
        }

        // Only trigger Open/Close if we aren't in L-Shape mode to prevent conflict
        if (!isLActiveRef.current) {
            if (openCount > 7) onHandOpen();
            if (closedCount > 7) onHandClose();
        }
      }
    };

    if (!handsRef.current && window.Hands) {
      const hands = new window.Hands({locateFile: (file: string) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
      }});
      
      hands.setOptions({
        maxNumHands: 1,
        modelComplexity: 1,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5
      });
      
      hands.onResults(onResults);
      handsRef.current = hands;
    }

    if (videoRef.current && !cameraRef.current && window.Camera) {
      const camera = new window.Camera(videoRef.current, {
        onFrame: async () => {
          if (handsRef.current && videoRef.current) {
            await handsRef.current.send({image: videoRef.current});
          }
        },
        width: 640,
        height: 480
      });
      camera.start();
      cameraRef.current = camera;
    }
    
  }, [enabled, onHandOpen, onHandClose, onHandLGesture, onHandMoveLeft, onHandMoveRight]);

  if (!enabled) return null;

  return (
    <div className="absolute bottom-4 right-4 z-50 pointer-events-none">
        {/* Hidden video source */}
        <video ref={videoRef} className="hidden" playsInline muted></video>
        
        {/* Debug Preview */}
        <div className={`transition-opacity duration-500 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}>
             <div className="bg-arix-emerald/80 backdrop-blur border border-arix-gold/30 rounded-lg p-2 shadow-lg">
                <p className="text-[10px] text-arix-gold mb-1 font-sans uppercase tracking-widest text-center">Camera Active</p>
                <canvas ref={canvasRef} width={160} height={120} className="rounded border border-white/10 w-32 h-24" />
             </div>
        </div>
    </div>
  );
};

export default HandController;