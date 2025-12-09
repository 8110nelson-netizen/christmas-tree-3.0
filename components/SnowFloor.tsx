
import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { InteractionMode } from '../types';

interface SnowFloorProps {
    mode: InteractionMode;
}

const SnowFloor: React.FC<SnowFloorProps> = ({ mode }) => {
  const pointsRef = useRef<THREE.Points>(null);
  const shaderRef = useRef<THREE.ShaderMaterial>(null);
  const progressRef = useRef(mode === 'TREE' ? 1 : 0);
  
  const count = 5000;
  
  const { positions, scatterPositions, randoms } = useMemo(() => {
    const pos = new Float32Array(count * 3);      // Floor positions
    const scatter = new Float32Array(count * 3); // Air positions
    const rnd = new Float32Array(count);
    const maxRadius = 18; // Wide enough to cover the gifts

    for(let i=0; i<count; i++) {
        // 1. Floor State (Disk)
        const r = Math.sqrt(Math.random()) * maxRadius;
        const theta = Math.random() * Math.PI * 2;
        
        pos[i*3] = r * Math.cos(theta);
        pos[i*3+1] = -8.0 + Math.random() * 0.25; 
        pos[i*3+2] = r * Math.sin(theta);
        
        // 2. Scatter State (Snowstorm Sphere)
        const sr = 15 + Math.random() * 15; // Wide scatter
        const stheta = Math.random() * Math.PI * 2;
        const sphi = Math.acos(2 * Math.random() - 1);
        
        scatter[i*3] = sr * Math.sin(sphi) * Math.cos(stheta);
        scatter[i*3+1] = sr * Math.sin(sphi) * Math.sin(stheta);
        scatter[i*3+2] = sr * Math.cos(sphi);

        rnd[i] = Math.random();
    }
    return { positions: pos, scatterPositions: scatter, randoms: rnd };
  }, []);

  useFrame((state, delta) => {
    const target = mode === 'TREE' ? 1 : 0;
    progressRef.current = THREE.MathUtils.damp(progressRef.current, target, 2.0, delta);

    if (shaderRef.current) {
        shaderRef.current.uniforms.uProgress.value = progressRef.current;
        shaderRef.current.uniforms.uTime.value = state.clock.elapsedTime;
    }
  });

  const uniforms = useMemo(() => ({
      uColor: { value: new THREE.Color('#ffffff') },
      uProgress: { value: 1 }, // 1 = Floor, 0 = Scatter
      uTime: { value: 0 }
  }), []);

  const vertexShader = `
      uniform float uTime;
      uniform float uProgress;
      attribute vec3 aScatterPos;
      attribute float aRandom;
      varying float vAlpha;
      
      void main() {
          vec3 floorPos = position;
          vec3 airPos = aScatterPos;
          
          vec3 finalPos = mix(airPos, floorPos, uProgress);

          // Add float/swirl animation when scattered
          if (uProgress < 0.99) {
              float time = uTime * 0.5;
              float floatAmount = (1.0 - uProgress);
              
              // Gentle falling/swirling snow effect
              finalPos.y -= mod(time * (2.0 + aRandom), 20.0) * floatAmount * 0.1;
              finalPos.x += sin(time + aRandom * 10.0) * floatAmount;
              finalPos.z += cos(time + aRandom * 10.0) * floatAmount;
          }

          vec4 mvPosition = modelViewMatrix * vec4(finalPos, 1.0);
          gl_Position = projectionMatrix * mvPosition;
          
          // Size attenuation
          gl_PointSize = (6.0 * aRandom + 4.0) * (20.0 / -mvPosition.z);
          vAlpha = 0.4 + 0.6 * aRandom;
      }
  `;

  const fragmentShader = `
      uniform vec3 uColor;
      varying float vAlpha;
      void main() {
          vec2 coord = gl_PointCoord - vec2(0.5);
          float dist = length(coord);
          if (dist > 0.5) discard;
          
          // Soft circular gradient
          float strength = 1.0 - (dist * 2.0);
          strength = pow(strength, 1.5);
          
          gl_FragColor = vec4(uColor, strength * vAlpha * 0.6);
      }
  `;

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={positions.length / 3} array={positions} itemSize={3} />
        <bufferAttribute attach="attributes-aScatterPos" count={scatterPositions.length / 3} array={scatterPositions} itemSize={3} />
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

export default SnowFloor;
