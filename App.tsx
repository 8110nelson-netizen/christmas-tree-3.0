import React, { useState, Suspense, useRef, useCallback, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Loader } from '@react-three/drei';
import * as THREE from 'three';
import GoldSpiralTree from './components/GoldSpiralTree';
import LuxuryEnvironment from './components/LuxuryEnvironment';
import PostEffects from './components/PostEffects';
import Overlay from './components/Overlay';
import HandController from './components/HandController';
import { TreeConfig, UIState, InteractionMode } from './types';
import { DEFAULT_CONFIG, PARTICLE_COUNT, DEFAULT_IMAGE_SRC } from './constants';
import { imageToPoints } from './utils/ImageToParticles';

const App: React.FC = () => {
  const [config] = useState<TreeConfig>(DEFAULT_CONFIG);
  const [uiState, setUiState] = useState<UIState>({
    interactionMode: 'TREE',
    isPlayingMusic: false,
    isCameraEnabled: false,
  });

  const [imagePoints, setImagePoints] = useState<Float32Array | null>(null);
  const controlsRef = useRef<any>(null);
  
  // Store the mode before entering L-Gesture to restore it later
  const lastNonImageModeRef = useRef<InteractionMode>('TREE');

  // Track manual changes to update the restoration target
  useEffect(() => {
      if (uiState.interactionMode !== 'IMAGE') {
          lastNonImageModeRef.current = uiState.interactionMode;
      }
  }, [uiState.interactionMode]);

  // Load default image on mount
  useEffect(() => {
    if (DEFAULT_IMAGE_SRC && DEFAULT_IMAGE_SRC.length > 100) {
        imageToPoints(DEFAULT_IMAGE_SRC, PARTICLE_COUNT).then(points => {
            // Check if we actually got valid points (not all zero)
            let hasValidPoints = false;
            for(let i=0; i<points.length; i+=3) {
                 if (points[i] !== 0 || points[i+1] !== 0 || points[i+2] !== 0) {
                     hasValidPoints = true;
                     break;
                 }
            }

            if (hasValidPoints) {
                setImagePoints(points);
                // Do not auto-switch to IMAGE mode; allow user to discover it via UI or gesture
            } else {
                console.warn("Image processed but no points found. Check image contrast.");
            }
        });
    }
  }, []);

  const handleImageUpload = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      if (result) {
        imageToPoints(result, PARTICLE_COUNT).then(points => {
            // Check if we actually got valid points (not all zero)
            let hasValidPoints = false;
            for(let i=0; i<points.length; i+=3) {
                 if (points[i] !== 0 || points[i+1] !== 0 || points[i+2] !== 0) {
                     hasValidPoints = true;
                     break;
                 }
            }

            if (hasValidPoints) {
                setImagePoints(points);
                // Switch to IMAGE mode so the user sees it immediately
                setUiState(prev => ({ ...prev, interactionMode: 'IMAGE' }));
            }
        });
      }
    };
    reader.readAsDataURL(file);
  }, []);

  // Hand Gestures Callbacks
  const onHandOpen = useCallback(() => {
    setUiState(prev => {
        if(prev.interactionMode !== 'SCATTERED' && prev.interactionMode !== 'IMAGE') {
            return { ...prev, interactionMode: 'SCATTERED' };
        }
        return prev;
    });
  }, []);

  const onHandClose = useCallback(() => {
    setUiState(prev => {
        if(prev.interactionMode !== 'TREE' && prev.interactionMode !== 'IMAGE') {
            return { ...prev, interactionMode: 'TREE' };
        }
        return prev;
    });
  }, []);

  const onHandLGesture = useCallback((active: boolean) => {
      setUiState(prev => {
          // If gesture started and we aren't in image mode, go to image mode
          if (active && prev.interactionMode !== 'IMAGE') {
              return { ...prev, interactionMode: 'IMAGE' };
          }
          // If gesture ended and we are currently in image mode, restore previous
          if (!active && prev.interactionMode === 'IMAGE') {
              return { ...prev, interactionMode: lastNonImageModeRef.current };
          }
          return prev;
      });
  }, []);

  const onHandMoveLeft = useCallback((delta: number) => {
    if (controlsRef.current) {
        const speed = 12.0;
        const currentAngle = controlsRef.current.getAzimuthalAngle();
        controlsRef.current.setAzimuthalAngle(currentAngle + (delta * speed));
    }
  }, []);

  const onHandMoveRight = useCallback((delta: number) => {
      if (controlsRef.current) {
        const speed = 12.0;
        const currentAngle = controlsRef.current.getAzimuthalAngle();
        controlsRef.current.setAzimuthalAngle(currentAngle - (delta * speed));
      }
  }, []);

  return (
    <div className="relative w-full h-screen bg-arix-dark overflow-hidden">
      {/* UI Overlay */}
      <Overlay 
        uiState={uiState} 
        setUiState={setUiState}
        hasImageLoaded={!!imagePoints}
        onImageUpload={handleImageUpload}
      />

      {/* Logic Controller for Hands */}
      <HandController 
        enabled={uiState.isCameraEnabled}
        onHandOpen={onHandOpen}
        onHandClose={onHandClose}
        onHandLGesture={onHandLGesture}
        onHandMoveLeft={onHandMoveLeft}
        onHandMoveRight={onHandMoveRight}
      />

      {/* 3D Scene */}
      <Canvas
        shadows
        dpr={[1, 2]} 
        camera={{ position: [0, 2, 22], fov: 45 }}
        gl={{ 
          antialias: false, 
          toneMapping: 3, 
          toneMappingExposure: 1.2
        }}
      >
        <color attach="background" args={['#020403']} />
        
        <Suspense fallback={null}>
          <GoldSpiralTree config={config} mode={uiState.interactionMode} imagePoints={imagePoints} />
          <LuxuryEnvironment />
          <PostEffects bloomIntensity={config.bloomIntensity} />
          
          <OrbitControls 
            ref={controlsRef}
            enablePan={false}
            minPolarAngle={Math.PI / 4}
            maxPolarAngle={Math.PI / 2 - 0.05} 
            minDistance={8}
            maxDistance={30}
            autoRotate={uiState.interactionMode === 'TREE' && !uiState.isCameraEnabled} 
            autoRotateSpeed={0.5}
            makeDefault
          />
        </Suspense>
      </Canvas>
      <Loader 
        containerStyles={{ backgroundColor: '#020403' }}
        innerStyles={{ width: '200px', backgroundColor: '#333' }}
        barStyles={{ backgroundColor: '#D4AF37', height: '2px' }}
        dataStyles={{ fontFamily: 'Playfair Display', color: '#D4AF37' }}
      />
    </div>
  );
};

export default App;