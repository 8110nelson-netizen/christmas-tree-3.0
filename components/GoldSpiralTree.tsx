import React, { useMemo, useRef, useLayoutEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { Sparkles, Float } from '@react-three/drei';
import * as THREE from 'three';
import { TreeConfig, InteractionMode } from '../types';
import FoliageLayer from './FoliageLayer';
import GoldParticleLayer from './GoldParticleLayer';
import SnowFloor from './SnowFloor';
import FallingSnow from './FallingSnow';
import { mergeBufferGeometries } from 'three-stdlib';

interface GoldSpiralTreeProps {
  config: TreeConfig;
  mode: InteractionMode;
  imagePoints?: Float32Array | null;
}

// Data shape for instances
interface InstanceData {
    treePos: THREE.Vector3;
    scatterPos: THREE.Vector3;
    scale: THREE.Vector3;
    color?: THREE.Color;
    rotation?: THREE.Euler;
}

// Data shape for unique gifts
interface GiftData {
    id: number;
    treePos: THREE.Vector3;
    scatterPos: THREE.Vector3;
    treeRot: THREE.Euler;
    scatterRot: THREE.Euler;
    size: THREE.Vector3;
    color: string;
    ribbonColor: string;
}

const MorphingInstancedMesh: React.FC<{
  count: number;
  mode: InteractionMode;
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
  generateData: (count: number) => InstanceData[];
  floatIntensity?: number; 
  overrideColor?: THREE.Color | string;
}> = ({ count, mode, geometry, material, generateData, floatIntensity = 1.0, overrideColor }) => {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const particles = useMemo(() => generateData(count), [count, generateData]);

  const progress = useRef(mode === 'TREE' ? 1 : 0);
  // Visibility scale for hiding in Image Mode
  const visibilityScale = useRef(1);

  const finalColor = useMemo(() => overrideColor ? new THREE.Color(overrideColor) : null, [overrideColor]);

  useLayoutEffect(() => {
    if (meshRef.current) {
      particles.forEach((p, i) => {
        const target = mode === 'TREE' ? p.treePos : p.scatterPos;
        dummy.position.copy(target);
        dummy.scale.copy(p.scale);
        if (p.rotation) dummy.rotation.copy(p.rotation);
        dummy.updateMatrix();
        meshRef.current!.setMatrixAt(i, dummy.matrix);
        
        if (finalColor) {
             meshRef.current!.setColorAt(i, finalColor);
        } else if (p.color) {
            meshRef.current!.setColorAt(i, p.color);
        }
      });
      meshRef.current.instanceMatrix.needsUpdate = true;
      if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true;
    }
  }, [particles, mode, dummy, finalColor]);

  useFrame((state, delta) => {
    if (!meshRef.current) return;

    const target = mode === 'TREE' ? 1 : 0;
    progress.current = THREE.MathUtils.damp(progress.current, target, 2.5, delta);
    
    // Hide logic: If mode is IMAGE, scale to 0
    const targetVis = mode === 'IMAGE' ? 0 : 1;
    visibilityScale.current = THREE.MathUtils.damp(visibilityScale.current, targetVis, 3.0, delta);

    const time = state.clock.elapsedTime;

    particles.forEach((p, i) => {
      dummy.position.lerpVectors(p.scatterPos, p.treePos, progress.current);

      // Apply visibility scaling
      const currentScale = p.scale.clone().multiplyScalar(visibilityScale.current);

      if (progress.current < 1) {
        const intensity = (1 - progress.current) * floatIntensity;
        dummy.position.y += Math.sin(time * 0.5 + i) * intensity * 0.05;
        dummy.position.x += Math.cos(time * 0.3 + i) * intensity * 0.02;
        
        dummy.rotation.x = Math.sin(time * 0.2 + i) * 0.5 * intensity;
        dummy.rotation.y = Math.cos(time * 0.3 + i) * 0.5 * intensity;
      } else {
        if (p.rotation) {
             dummy.rotation.copy(p.rotation);
        } else {
            dummy.rotation.set(0,0,0);
        }
      }

      dummy.scale.copy(currentScale);
      dummy.updateMatrix();
      meshRef.current!.setMatrixAt(i, dummy.matrix);
    });
    
    meshRef.current.instanceMatrix.needsUpdate = true;
    
    if (mode === 'TREE') {
        meshRef.current.rotation.y += delta * 0.05;
    } else {
        meshRef.current.rotation.y += delta * 0.01;
    }
  });

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, undefined, count]}
      castShadow
      receiveShadow
    >
      <primitive object={material} attach="material" />
    </instancedMesh>
  );
};

const GiftBox: React.FC<{ data: GiftData; mode: InteractionMode }> = ({ data, mode }) => {
    const groupRef = useRef<THREE.Group>(null);
    const progress = useRef(mode === 'TREE' ? 1 : 0);
    const visScale = useRef(1);

    useFrame((state, delta) => {
        if (!groupRef.current) return;
        
        const target = mode === 'TREE' ? 1 : 0;
        progress.current = THREE.MathUtils.damp(progress.current, target, 2, delta);

        const targetVis = mode === 'IMAGE' ? 0 : 1;
        visScale.current = THREE.MathUtils.damp(visScale.current, targetVis, 3, delta);

        groupRef.current.position.lerpVectors(data.scatterPos, data.treePos, progress.current);
        groupRef.current.scale.setScalar(visScale.current);
        
        const tRot = data.treeRot;
        const sRot = data.scatterRot;
        
        groupRef.current.rotation.x = THREE.MathUtils.lerp(sRot.x + Math.sin(state.clock.elapsedTime)*0.5, tRot.x, progress.current);
        groupRef.current.rotation.y = THREE.MathUtils.lerp(sRot.y + state.clock.elapsedTime * 0.2, tRot.y, progress.current);
        groupRef.current.rotation.z = THREE.MathUtils.lerp(sRot.z, tRot.z, progress.current);
    });

    const boxSize = [data.size.x, data.size.y, data.size.z] as const;
    const ribbonWidth = 0.08;
    const ribbonThickness = 0.01;

    return (
        <group ref={groupRef}>
            <mesh castShadow receiveShadow>
                <boxGeometry args={boxSize} />
                <meshStandardMaterial color={data.color} roughness={0.8} metalness={0.1} emissive={data.color} emissiveIntensity={0.25} />
            </mesh>
            <mesh position={[0, 0, 0]} castShadow>
                <boxGeometry args={[ribbonWidth, data.size.y + ribbonThickness, data.size.z + ribbonThickness]} />
                <meshStandardMaterial color={data.ribbonColor} roughness={0.2} metalness={0.6} emissive={data.ribbonColor} emissiveIntensity={0.5} />
            </mesh>
            <mesh position={[0, 0, 0]} castShadow>
                <boxGeometry args={[data.size.x + ribbonThickness, data.size.y + ribbonThickness, ribbonWidth]} />
                <meshStandardMaterial color={data.ribbonColor} roughness={0.2} metalness={0.6} emissive={data.ribbonColor} emissiveIntensity={0.5} />
            </mesh>
            <mesh position={[0, data.size.y/2, 0]} rotation={[Math.PI/2, 0, Math.random()]} castShadow>
                <mesh position={[0.08, 0, 0]} rotation={[0, 0.4, 0]}><torusGeometry args={[0.08, 0.02, 16, 32, Math.PI * 1.5]} /><meshStandardMaterial color={data.ribbonColor} roughness={0.2} metalness={0.6} emissive={data.ribbonColor} emissiveIntensity={0.5} /></mesh>
                <mesh position={[-0.08, 0, 0]} rotation={[0, -0.4, 0]}><torusGeometry args={[0.08, 0.02, 16, 32, Math.PI * 1.5]} /><meshStandardMaterial color={data.ribbonColor} roughness={0.2} metalness={0.6} emissive={data.ribbonColor} emissiveIntensity={0.5} /></mesh>
                <mesh position={[0,0,0]}><boxGeometry args={[0.06, 0.06, 0.06]} /><meshStandardMaterial color={data.ribbonColor} roughness={0.2} metalness={0.6} emissive={data.ribbonColor} emissiveIntensity={0.5} /></mesh>
            </mesh>
        </group>
    );
}

const GemStar: React.FC<{ mode: InteractionMode }> = ({ mode }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const groupRef = useRef<THREE.Group>(null);
  const geometry = useMemo(() => {
    const pts = [];
    const indices = [];
    const outerRadius = 1.0;
    const innerRadius = 0.4;
    const depth = 0.12; 
    pts.push(0, 0, depth);
    pts.push(0, 0, -depth);
    const numPoints = 5;
    for (let i = 0; i < numPoints * 2; i++) {
        const radius = i % 2 === 0 ? outerRadius : innerRadius;
        const angle = (i / (numPoints * 2)) * Math.PI * 2 - Math.PI / 2; 
        pts.push(Math.cos(angle) * radius, Math.sin(angle) * radius, 0);
    }
    for(let i=0; i<10; i++) {
        const current = 2 + i;
        const next = 2 + ((i + 1) % 10);
        indices.push(0, current, next);
    }
    for(let i=0; i<10; i++) {
        const current = 2 + i;
        const next = 2 + ((i + 1) % 10);
        indices.push(1, next, current);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    return geo;
  }, []);

  useFrame((state, delta) => {
    if (groupRef.current) {
        const targetPos = mode === 'TREE' ? new THREE.Vector3(0, 7.8, 0) : new THREE.Vector3(0, 15, 0); 
        groupRef.current.position.lerp(targetPos, delta * 2);
        
        // Hide in Image Mode
        if (mode === 'IMAGE') {
            groupRef.current.scale.lerp(new THREE.Vector3(0,0,0), delta * 2);
        } else {
            groupRef.current.scale.lerp(new THREE.Vector3(1,1,1), delta * 2);
        }
        
        if (mode === 'SCATTERED') {
             groupRef.current.rotation.y += delta * 0.5;
             groupRef.current.rotation.z += delta * 0.2;
        } else {
             groupRef.current.rotation.z = THREE.MathUtils.lerp(groupRef.current.rotation.z, 0, delta * 2);
             groupRef.current.rotation.x = THREE.MathUtils.lerp(groupRef.current.rotation.x, 0, delta * 2);
             groupRef.current.rotation.y += delta * 0.2; 
        }
    }
    if (meshRef.current) {
        const mat = meshRef.current.material as THREE.MeshStandardMaterial;
        const t = state.clock.elapsedTime;
        const breath = 1.0 + Math.sin(t * 1.5) * 0.2; 
        mat.emissiveIntensity = 0.8 + (breath * 0.5); 
    }
  });

  return (
    <group ref={groupRef}>
        <Float speed={2} rotationIntensity={0.2} floatIntensity={0.2}>
            <mesh ref={meshRef} geometry={geometry}>
                <meshStandardMaterial color="#FCEda6" emissive="#ffebb0" emissiveIntensity={1.0} roughness={0.1} metalness={0.6} />
            </mesh>
            <pointLight distance={5} intensity={1} color="#ffeebb" decay={2} />
        </Float>
    </group>
  );
}


const GoldSpiralTree: React.FC<GoldSpiralTreeProps> = ({ config, mode, imagePoints }) => {
  const groupRef = useRef<THREE.Group>(null);
  
  // Reuse existing generators logic (abbreviated for brevity as they are unchanged logic but needed in context)
  const generateLights = useMemo(() => (cnt: number) => {
    const temp: InstanceData[] = [];
    const height = 15; const baseRadius = 6.0; 
    for (let i = 0; i < cnt; i++) {
      const h = Math.random(); const y = (h * height) - (height / 2); const rAtH = baseRadius * (1 - h);
      const angle = Math.random() * Math.PI * 2; const r = rAtH * (0.3 + Math.random() * 0.5); 
      const x = Math.cos(angle) * r; const z = Math.sin(angle) * r;
      const sr = 15 + Math.random() * 10; const stheta = Math.random() * Math.PI * 2; const sphi = Math.acos(2 * Math.random() - 1);
      const s = 0.03 + Math.random() * 0.04;
      temp.push({
          treePos: new THREE.Vector3(x, y, z),
          scatterPos: new THREE.Vector3(sr * Math.sin(sphi) * Math.cos(stheta), sr * Math.sin(sphi) * Math.sin(stheta), sr * Math.cos(sphi)),
          scale: new THREE.Vector3(s, s, s)
      });
    }
    return temp;
  }, []);

  const generateSurfaceDecor = useMemo(() => (count: number, minH: number, maxH: number, sizeBase: number, sizeVariance: number) => {
      const temp: InstanceData[] = [];
      const height = 15; const baseRadius = 6.0;
      for(let i = 0; i < count; i++) {
          const hNorm = minH + Math.random() * (maxH - minH); const y = (hNorm * height) - (height / 2);
          const rAtH = baseRadius * (1 - hNorm); const r = rAtH + 0.1 + (Math.random() * 0.3); const angle = Math.random() * Math.PI * 2;
          const x = Math.cos(angle) * r; const z = Math.sin(angle) * r;
          const sr = 16 + Math.random() * 12; const stheta = Math.random() * Math.PI * 2; const sphi = Math.acos(2 * Math.random() - 1);
          const s = sizeBase + (Math.random() * sizeVariance);
          temp.push({
              treePos: new THREE.Vector3(x, y, z),
              scatterPos: new THREE.Vector3(sr * Math.sin(sphi) * Math.cos(stheta), sr * Math.sin(sphi) * Math.sin(stheta), sr * Math.cos(sphi)),
              scale: new THREE.Vector3(s, s, s),
              rotation: new THREE.Euler(Math.random() * Math.PI, Math.random() * Math.PI, 0)
          });
      }
      return temp;
  }, []);

  const gifts = useMemo(() => {
    const data: GiftData[] = [];
    const colors = ['#8f1e1e', '#1a472a', '#f5f5f0', '#D4AF37']; const ribbonColors = ['#D4AF37', '#8f1e1e', '#1a472a']; 
    const count = 18;
    for(let i=0; i<count; i++) {
        const angle = (i / count) * Math.PI * 2 + (Math.random() * 0.3); const radius = 6.5 + Math.random() * 4.0;
        const w = 0.4 + Math.random() * 0.4; const h = 0.3 + Math.random() * 0.3; const d = 0.4 + Math.random() * 0.4;
        const tx = Math.cos(angle) * radius; const ty = -8 + (h/2); const tz = Math.sin(angle) * radius;
        const sr = 12 + Math.random() * 8; const sTheta = Math.random() * Math.PI * 2; const sPhi = Math.random() * Math.PI;
        const sx = sr * Math.sin(sPhi) * Math.cos(sTheta); const sy = sr * Math.sin(sPhi) * Math.sin(sTheta); const sz = sr * Math.cos(sPhi);
        data.push({
            id: i, treePos: new THREE.Vector3(tx, ty, tz), scatterPos: new THREE.Vector3(sx, sy, sz),
            treeRot: new THREE.Euler(0, Math.random() * Math.PI, 0), scatterRot: new THREE.Euler(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI),
            size: new THREE.Vector3(w, h, d), color: colors[i % colors.length], ribbonColor: ribbonColors[(i+1) % ribbonColors.length]
        });
    }
    const largeCount = 5;
    for(let i=0; i<largeCount; i++) {
        const angle = Math.random() * Math.PI * 2; const radius = 7.0 + Math.random() * 3.5;
        const w = 0.6 + Math.random() * 0.3; const h = 0.5 + Math.random() * 0.3; const d = 1.2 + Math.random() * 0.6;
        const tx = Math.cos(angle) * radius; const ty = -8 + (h/2); const tz = Math.sin(angle) * radius;
        const sr = 15 + Math.random() * 5; const sTheta = Math.random() * Math.PI * 2; const sPhi = Math.random() * Math.PI;
        const sx = sr * Math.sin(sPhi) * Math.cos(sTheta); const sy = sr * Math.sin(sPhi) * Math.sin(sTheta); const sz = sr * Math.cos(sPhi);
        data.push({
            id: count + i, treePos: new THREE.Vector3(tx, ty, tz), scatterPos: new THREE.Vector3(sx, sy, sz),
            treeRot: new THREE.Euler(0, Math.random() * Math.PI, 0), scatterRot: new THREE.Euler(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI),
            size: new THREE.Vector3(w, h, d), color: colors[(i+2) % colors.length], ribbonColor: ribbonColors[i % ribbonColors.length]
        });
    }
    return data;
  }, []);

  const lightGeo = useMemo(() => new THREE.SphereGeometry(1, 8, 8), []);
  const lightMat = useMemo(() => new THREE.MeshStandardMaterial({ color: "#fffaee", emissive: "#fffaee", emissiveIntensity: 0.5, toneMapped: false }), []);
  const ornamentGeo = useMemo(() => new THREE.SphereGeometry(1, 16, 16), []);
  const redOrnamentMat = useMemo(() => new THREE.MeshStandardMaterial({ color: "#D00000", roughness: 0.15, metalness: 0.6 }), []);
  const goldOrnamentMat = useMemo(() => new THREE.MeshStandardMaterial({ color: "#FFD700", roughness: 0.2, metalness: 1.0 }), []);
  const greenLightMat = useMemo(() => new THREE.MeshStandardMaterial({ color: "#9AFF7A", emissive: "#9AFF7A", emissiveIntensity: 3.0, toneMapped: false }), []);

  const redOrnamentsData = useMemo(() => generateSurfaceDecor(48, 0.1, 0.9, 0.25, 0.1), [generateSurfaceDecor]);
  const goldOrnamentsData = useMemo(() => generateSurfaceDecor(48, 0.1, 0.9, 0.25, 0.1), [generateSurfaceDecor]);
  const greenLightsData = useMemo(() => generateSurfaceDecor(96, 0.05, 0.95, 0.06, 0.04), [generateSurfaceDecor]);

  const trunkRef = useRef<THREE.Mesh>(null);
  useFrame((state, delta) => {
     if (trunkRef.current) {
        const targetScale = mode === 'TREE' ? 1 : 0;
        const currentScale = trunkRef.current.scale.y;
        const nextScale = THREE.MathUtils.damp(currentScale, targetScale, 3, delta);
        trunkRef.current.scale.set(1, nextScale, 1);
        trunkRef.current.visible = nextScale > 0.01;
     }
  });

  return (
    <group ref={groupRef}>
      <SnowFloor mode={mode} />
      <FallingSnow mode={mode} />
      
      {/* Updated Foliage Layer receives image points */}
      <FoliageLayer mode={mode} imagePoints={imagePoints} />

      {/* Decorations will now auto-hide when mode is IMAGE via the MorphingInstancedMesh updates */}
      <GoldParticleLayer mode={mode} />
      <MorphingInstancedMesh count={1200} mode={mode} geometry={lightGeo} material={lightMat} generateData={generateLights} floatIntensity={1.5} />
      <MorphingInstancedMesh count={48} mode={mode} geometry={ornamentGeo} material={redOrnamentMat} generateData={() => redOrnamentsData} floatIntensity={1.2} />
      <MorphingInstancedMesh count={48} mode={mode} geometry={ornamentGeo} material={goldOrnamentMat} generateData={() => goldOrnamentsData} floatIntensity={1.2} />
      <MorphingInstancedMesh count={96} mode={mode} geometry={lightGeo} material={greenLightMat} generateData={() => greenLightsData} floatIntensity={2.0} />
      
      {gifts.map(gift => (
          <GiftBox key={gift.id} data={gift} mode={mode} />
      ))}

      <mesh ref={trunkRef} position={[0, 0, 0]}>
        <cylinderGeometry args={[0.2, 0.8, 12, 16]} />
        <meshStandardMaterial color="#3e2723" roughness={0.9} />
      </mesh>
      
      <GemStar mode={mode} />
      
      <Sparkles count={150} scale={mode === 'TREE' ? 14 : 25} size={6} speed={0.4} opacity={0.5} color={config.primaryColor} />
    </group>
  );
};

export default GoldSpiralTree;