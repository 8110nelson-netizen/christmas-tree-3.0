import React, { useMemo, useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { InteractionMode } from '../types';
import { PARTICLE_COUNT } from '../constants';

interface FoliageLayerProps {
  mode: InteractionMode;
  imagePoints?: Float32Array | null;
}

const FoliageLayer: React.FC<FoliageLayerProps> = ({ mode, imagePoints }) => {
  const pointsRef = useRef<THREE.Points>(null);
  const geometryRef = useRef<THREE.BufferGeometry>(null);
  const shaderRef = useRef<THREE.ShaderMaterial>(null);
  
  // Progress states
  const progressRef = useRef(mode === 'TREE' ? 1 : 0);
  const imageMixRef = useRef(mode === 'IMAGE' ? 1 : 0);

  const count = PARTICLE_COUNT;

  const { positions, treePositions, randoms } = useMemo(() => {
    const pos = new Float32Array(count * 3); 
    const treePos = new Float32Array(count * 3);
    const rnd = new Float32Array(count);

    const height = 15;
    const baseRadius = 6;

    for (let i = 0; i < count; i++) {
      // SCATTER STATE
      const r = 12 + Math.random() * 10;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      pos[i * 3 + 2] = r * Math.cos(phi);

      // TREE STATE
      const h = Math.random(); 
      const y = (h * height) - (height / 2);
      const radiusAtH = baseRadius * (1 - h);
      const angle = Math.random() * Math.PI * 2;
      const rDisk = Math.sqrt(Math.random()) * radiusAtH;

      treePos[i * 3] = rDisk * Math.cos(angle);
      treePos[i * 3 + 1] = y;
      treePos[i * 3 + 2] = rDisk * Math.sin(angle);

      rnd[i] = Math.random();
    }
    
    return { positions: pos, treePositions: treePos, randoms: rnd };
  }, []);

  // Use useEffect to IMPERATIVELY update the geometry attribute.
  // This bypasses React's reconciliation issues with large BufferAttributes 
  // ensuring the GPU gets the new image data immediately.
  useEffect(() => {
    if (geometryRef.current) {
        let dataToUse = treePositions;
        
        // Strict length check to avoid stride errors
        if (imagePoints && imagePoints.length === count * 3) {
            dataToUse = imagePoints;
        } 

        // Update the attribute directly
        geometryRef.current.setAttribute(
            'aImagePos', 
            new THREE.BufferAttribute(dataToUse, 3)
        );
        geometryRef.current.attributes.aImagePos.needsUpdate = true;
    }
  }, [imagePoints, treePositions, count]);

  useFrame((state, delta) => {
    // Transition Logic
    const targetProgress = mode === 'SCATTERED' ? 0 : 1;
    progressRef.current = THREE.MathUtils.damp(progressRef.current, targetProgress, 2.0, delta);
    
    // Image vs Others
    const targetImageMix = mode === 'IMAGE' ? 1 : 0;
    imageMixRef.current = THREE.MathUtils.damp(imageMixRef.current, targetImageMix, 1.5, delta);
    
    if (shaderRef.current) {
        shaderRef.current.uniforms.uProgress.value = progressRef.current;
        shaderRef.current.uniforms.uImageMix.value = imageMixRef.current;
        shaderRef.current.uniforms.uTime.value = state.clock.elapsedTime;
    }
  });

  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uProgress: { value: 0 },
    uImageMix: { value: 0 },
    uColorBase: { value: new THREE.Color('#107a57') }, 
    uColorTip: { value: new THREE.Color('#4ade80') }, 
    uColorGold: { value: new THREE.Color('#FCEda6') }, 
  }), []);

  const vertexShader = `
    uniform float uTime;
    uniform float uProgress;
    uniform float uImageMix;
    
    attribute vec3 aTreePos;
    attribute vec3 aImagePos;
    attribute float aRandom;
    
    varying vec3 vColor;
    varying float vRandom;
    uniform vec3 uColorBase;
    uniform vec3 uColorTip;
    uniform vec3 uColorGold;

    void main() {
      vec3 scatterPos = position;
      vec3 treePos = aTreePos;
      vec3 imgPos = aImagePos;
      
      // Mix 1: Scatter -> Tree
      vec3 standardPos = mix(scatterPos, treePos, uProgress);
      
      // Mix 2: Result -> Image
      vec3 finalPos = mix(standardPos, imgPos, uImageMix);
      
      // Animation / Floating
      float time = uTime * 0.5;
      
      // Reduce noise when in image mode for sharpness
      if (uImageMix < 0.95) {
          if (uProgress < 0.99) {
              float floatAmount = (1.0 - uProgress) * 0.8 * (1.0 - uImageMix);
              finalPos.y += sin(time + aRandom * 20.0) * floatAmount;
              finalPos.x += cos(time * 0.8 + aRandom * 10.0) * floatAmount * 0.5;
          } else {
              finalPos.x += sin(time + finalPos.y) * 0.05 * (1.0 - uImageMix);
          }
      }

      vec4 mvPosition = modelViewMatrix * vec4(finalPos, 1.0);
      gl_Position = projectionMatrix * mvPosition;
      
      // Size attenuation
      // Make particles much smaller (0.4x) and more uniform in image mode to look like lines
      float sizeMult = mix(1.0, 0.4, uImageMix);
      float randomFactor = mix(aRandom, 0.5, uImageMix * 0.8); // Less size randomness in image mode
      
      gl_PointSize = (5.0 * randomFactor + 2.0) * sizeMult * (20.0 / -mvPosition.z);
      
      vRandom = aRandom;
      
      // Color Logic
      vec3 base = mix(uColorBase, uColorTip, aRandom * 0.7);
      if (aRandom > 0.96) base = mix(base, uColorGold, 0.9);
      
      // Turn Gold/White in Image Mode
      vColor = mix(base, uColorGold, uImageMix * 0.9);
    }
  `;

  const fragmentShader = `
    varying vec3 vColor;
    varying float vRandom;
    
    void main() {
      vec2 coord = gl_PointCoord - vec2(0.5);
      float r = length(coord);
      if (r > 0.5) discard;
      
      float glow = 1.0 - (r * 2.0);
      glow = pow(glow, 2.0);
      
      vec3 brightColor = vColor * 1.5; 
      gl_FragColor = vec4(brightColor + glow * 0.3, 0.8 * glow);
    }
  `;

  return (
    <points ref={pointsRef}>
        <bufferGeometry ref={geometryRef}>
            <bufferAttribute attach="attributes-position" count={positions.length / 3} array={positions} itemSize={3} />
            <bufferAttribute attach="attributes-aTreePos" count={treePositions.length / 3} array={treePositions} itemSize={3} />
            {/* aImagePos is now managed by useEffect */}
            <bufferAttribute attach="attributes-aImagePos" count={treePositions.length / 3} array={treePositions} itemSize={3} />
            <bufferAttribute attach="attributes-aRandom" count={randoms.length} array={randoms} itemSize={1} />
        </bufferGeometry>
        <shaderMaterial
            ref={shaderRef}
            vertexShader={vertexShader}
            fragmentShader={fragmentShader}
            uniforms={uniforms}
            transparent
            depthWrite={false}
            blending={THREE.AdditiveBlending}
        />
    </points>
  );
};

export default FoliageLayer;