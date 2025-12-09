import React from 'react';
import { EffectComposer, Bloom, Vignette, Noise } from '@react-three/postprocessing';
import { BlendFunction } from 'postprocessing';

interface PostEffectsProps {
  bloomIntensity: number;
}

const PostEffects: React.FC<PostEffectsProps> = ({ bloomIntensity }) => {
  return (
    <EffectComposer enableNormalPass={false}>
      <Bloom 
        luminanceThreshold={0.8} // Only very bright things glow
        luminanceSmoothing={0.025} 
        height={300} 
        intensity={bloomIntensity} 
        mipmapBlur // Makes the bloom softer and more "cinematic"
      />
      <Vignette eskil={false} offset={0.1} darkness={0.6} />
      <Noise opacity={0.02} blendFunction={BlendFunction.OVERLAY} /> 
    </EffectComposer>
  );
};

export default PostEffects;