
import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { InteractionMode } from '../types';

interface FallingSnowProps {
    mode: InteractionMode;
}

const FallingSnow: React.FC<FallingSnowProps> = ({ mode }) => {
    const pointsRef = useRef<THREE.Points>(null);
    const shaderRef = useRef<THREE.ShaderMaterial>(null);
    const progressRef = useRef(mode === 'TREE' ? 1 : 0);

    const count = 400; // Trace amount

    const { scatterPositions, fallParams } = useMemo(() => {
        const scatter = new Float32Array(count * 3);
        const params = new Float32Array(count * 4); // x, y, z start positions + speed

        for (let i = 0; i < count; i++) {
            // Scatter Position (Exploded Sphere)
            const sr = 15 + Math.random() * 15;
            const stheta = Math.random() * Math.PI * 2;
            const sphi = Math.acos(2 * Math.random() - 1);
            scatter[i * 3] = sr * Math.sin(sphi) * Math.cos(stheta);
            scatter[i * 3 + 1] = sr * Math.sin(sphi) * Math.sin(stheta);
            scatter[i * 3 + 2] = sr * Math.cos(sphi);

            // Fall Parameters (Cylinder area above tree)
            // Match SnowFloor radius (18.0)
            const r = Math.random() * 18.0;
            const angle = Math.random() * Math.PI * 2;
            
            params[i * 4] = r * Math.cos(angle);     // x
            params[i * 4 + 1] = Math.random() * 30.0; // y (spread vertically for seamless loop)
            params[i * 4 + 2] = r * Math.sin(angle);  // z
            params[i * 4 + 3] = 1.0 + Math.random() * 1.5; // speed
        }
        return { scatterPositions: scatter, fallParams: params };
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
        uProgress: { value: 1 },
        uColor: { value: new THREE.Color('#ffffff') },
        uHeight: { value: 30.0 } // Loop height
    }), []);

    const vertexShader = `
        uniform float uTime;
        uniform float uProgress;
        uniform float uHeight;
        
        attribute vec3 aScatterPos;
        attribute vec4 aFallParams; // x, y, z, speed
        
        varying float vAlpha;

        void main() {
            // Unpack Params
            vec3 startPos = aFallParams.xyz;
            float speed = aFallParams.w;

            // --- 1. Falling Logic ---
            // Calculate current Y based on time and wrap around uHeight
            // We shift by uHeight/2 to center the loop range around the tree
            float currentY = mod(startPos.y - (uTime * speed), uHeight);
            currentY -= 8.0; // Adjust floor level

            // Add slight sway
            float swayX = sin(uTime + startPos.y) * 0.5;
            float swayZ = cos(uTime + startPos.z) * 0.5;

            vec3 fallPos = vec3(startPos.x + swayX, currentY, startPos.z + swayZ);

            // --- 2. Scatter Logic ---
            vec3 scatterPos = aScatterPos;

            // --- Mix ---
            vec3 finalPos = mix(scatterPos, fallPos, uProgress);

            vec4 mvPosition = modelViewMatrix * vec4(finalPos, 1.0);
            gl_Position = projectionMatrix * mvPosition;

            // Size attenuation
            gl_PointSize = (3.0 * speed + 2.0) * (20.0 / -mvPosition.z);
            
            // Fade out at top and bottom of fall range to avoid popping
            // Simple proximity fade based on fall bounds
            float normalizedY = (currentY + 8.0) / uHeight; // 0 to 1
            float edgeFade = smoothstep(0.0, 0.1, normalizedY) * (1.0 - smoothstep(0.9, 1.0, normalizedY));
            
            // In scatter mode, we don't fade edges
            vAlpha = mix(0.7, 0.7 * edgeFade, uProgress);
        }
    `;

    const fragmentShader = `
        uniform vec3 uColor;
        varying float vAlpha;
        
        void main() {
            vec2 coord = gl_PointCoord - vec2(0.5);
            float dist = length(coord);
            if (dist > 0.5) discard;
            
            float alpha = (1.0 - dist * 2.0) * vAlpha;
            gl_FragColor = vec4(uColor, alpha);
        }
    `;

    return (
        <points ref={pointsRef}>
            <bufferGeometry>
                {/* Position attribute is reused for rendering, but data comes from mix in shader */}
                <bufferAttribute attach="attributes-position" count={scatterPositions.length / 3} array={scatterPositions} itemSize={3} />
                <bufferAttribute attach="attributes-aScatterPos" count={scatterPositions.length / 3} array={scatterPositions} itemSize={3} />
                <bufferAttribute attach="attributes-aFallParams" count={fallParams.length / 4} array={fallParams} itemSize={4} />
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

export default FallingSnow;
