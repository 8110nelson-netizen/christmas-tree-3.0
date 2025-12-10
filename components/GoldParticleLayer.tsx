
import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { InteractionMode } from '../types';

interface GoldParticleLayerProps {
  mode: InteractionMode;
}

const GoldParticleLayer: React.FC<GoldParticleLayerProps> = ({ mode }) => {
  const pointsRef = useRef<THREE.Points>(null);
  const shaderRef = useRef<THREE.ShaderMaterial>(null);
  const progressRef = useRef(mode === 'TREE' ? 1 : 0);

  const { positions, treePositions, randoms } = useMemo(() => {
    const count = 300; // Reduced count to increase spacing
    const pos = new Float32Array(count * 3);
    const treePos = new Float32Array(count * 3);
    const rnd = new Float32Array(count);

    const height = 15;
    const baseRadius = 6.4; // Slightly outside the foliage (6.0)
    const spiralLoops = 6;  // Number of turns around the tree

    for (let i = 0; i < count; i++) {
      // SCATTER STATE
      const r = 14 + Math.random() * 8;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      pos[i * 3 + 2] = r * Math.cos(phi);

      // TREE STATE - Spiral Ribbon
      // Use linear distribution (i / count) to ensure even spacing along the spiral
      // instead of random height which causes clumping.
      // Cap at 0.94 to prevent overlapping with the Top Star at y=7.8
      const hBase = i / count;
      // Add tiny jitter to prevent robotic perfection, but keep them separated
      const h = Math.max(0, Math.min(0.94, (hBase * 0.94) + ((Math.random() - 0.5) * 0.02)));

      const y = (h * height) - (height / 2);
      const rAtH = baseRadius * (1 - h);
      
      // Spiral Logic: Angle depends on height
      const angleVariance = (Math.random() - 0.5) * 0.8; 
      const angle = (h * Math.PI * 2 * spiralLoops) + angleVariance;

      // Strict outer surface
      const rTree = rAtH + (Math.random() * 0.2);

      treePos[i * 3] = rTree * Math.cos(angle);
      treePos[i * 3 + 1] = y;
      treePos[i * 3 + 2] = rTree * Math.sin(angle);

      rnd[i] = Math.random();
    }

    return { positions: pos, treePositions: treePos, randoms: rnd };
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
    uTime: { value: 0 },
    uProgress: { value: 0 },
    uColor: { value: new THREE.Color('#FCEda6') }, // Gold Light
  }), []);

  const vertexShader = `
    uniform float uTime;
    uniform float uProgress;
    attribute vec3 aTreePos;
    attribute float aRandom;
    varying float vAlpha;
    varying float vRandom;

    void main() {
      vec3 scatterPos = position;
      vec3 treePos = aTreePos;

      vec3 finalPos = mix(scatterPos, treePos, uProgress);

      // Float effect
      float time = uTime * 0.5;
      if (uProgress < 0.99) {
          float floatAmount = (1.0 - uProgress) * 1.5;
          finalPos.y += sin(time + aRandom * 20.0) * floatAmount;
          finalPos.x += cos(time * 0.8 + aRandom * 10.0) * floatAmount * 0.5;
      } else {
         // Gentle shimmer movement on tree
         finalPos.x += sin(time * 2.0 + finalPos.y) * 0.02;
      }

      vec4 mvPosition = modelViewMatrix * vec4(finalPos, 1.0);
      gl_Position = projectionMatrix * mvPosition;

      // Size - Large Baubles
      // Range: approx 40 to 80 units
      gl_PointSize = (40.0 * aRandom + 40.0) * (20.0 / -mvPosition.z);
      vRandom = aRandom;
    }
  `;

  const fragmentShader = `
    uniform vec3 uColor;
    varying float vRandom;

    void main() {
      vec2 coord = gl_PointCoord - vec2(0.5);
      float r = length(coord);
      if (r > 0.5) discard;

      float glow = 1.0 - (r * 2.0);
      glow = pow(glow, 2.5); // Sharper edge for solid ball look

      // Reduced brightness multiplier from 1.2 to 0.6 (50% reduction)
      gl_FragColor = vec4(uColor * 0.6, glow);
    }
  `;

  return (
    <points ref={pointsRef}>
        <bufferGeometry>
            <bufferAttribute attach="attributes-position" count={positions.length / 3} array={positions} itemSize={3} />
            <bufferAttribute attach="attributes-aTreePos" count={treePositions.length / 3} array={treePositions} itemSize={3} />
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

export default GoldParticleLayer;
