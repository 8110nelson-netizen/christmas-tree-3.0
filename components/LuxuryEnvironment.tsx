import React from 'react';
import { Environment, MeshReflectorMaterial, Stars, Lightformer } from '@react-three/drei';
import * as THREE from 'three';

const LuxuryEnvironment: React.FC = () => {
  return (
    <>
      {/* Lighting Setup */}
      <ambientLight intensity={0.2} color="#042f2e" />
      
      {/* Key Light - Warm Gold */}
      <spotLight 
        position={[10, 15, 10]} 
        angle={0.3} 
        penumbra={1} 
        intensity={200} 
        castShadow 
        color="#FCEda6"
        shadow-bias={-0.0001}
      />

      {/* Fill Light - Cool Emerald */}
      <pointLight position={[-10, 5, -10]} intensity={50} color="#10b981" />

      {/* Rim Light - Sharp White */}
      <spotLight 
        position={[-5, 10, -5]} 
        angle={0.5} 
        penumbra={1} 
        intensity={100} 
        color="white" 
      />

      {/* Procedural Environment Map for Reflections (No external HDRs) */}
      <Environment resolution={512}>
        {/* Ceiling Light */}
        <Lightformer intensity={2} rotation-x={Math.PI / 2} position={[0, 5, -9]} scale={[10, 10, 1]} />
        
        {/* Side Stripes for metallic reflections - Gold Tints */}
        <Lightformer intensity={5} rotation-y={Math.PI / 2} position={[-5, 1, -1]} scale={[20, 0.1, 1]} color="#FCEda6" />
        <Lightformer intensity={2} rotation-y={Math.PI / 2} position={[-5, -1, -1]} scale={[20, 0.5, 1]} color="#d4af37" />
        
        {/* Cool white reflection for contrast */}
        <Lightformer intensity={4} rotation-y={-Math.PI / 2} position={[10, 1, 0]} scale={[20, 1, 1]} color="#ffffff" />
        
        {/* Background glow hint */}
        <Lightformer form="ring" color="#10b981" intensity={1} scale={10} position={[0, 5, -10]} onUpdate={(self) => self.lookAt(0, 0, 0)} />
      </Environment>

      {/* Reflective Floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -8, 0]} receiveShadow>
        <planeGeometry args={[50, 50]} />
        <MeshReflectorMaterial
          mirror={0.8}
          blur={[400, 100]}
          resolution={1024}
          mixBlur={1}
          mixStrength={40} // Strength of the reflections
          roughness={0.6}
          depthScale={1.2}
          minDepthThreshold={0.4}
          maxDepthThreshold={1.4}
          color="#050505"
          metalness={0.8}
        />
      </mesh>

      {/* Background Ambience */}
      <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />
      
      {/* Fog for depth */}
      <fog attach="fog" args={['#020403', 10, 45]} />
    </>
  );
};

export default LuxuryEnvironment;