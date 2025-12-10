export interface TreeConfig {
  rotationSpeed: number;
  bloomIntensity: number;
  particleCount: number;
  primaryColor: string; // Hex
  secondaryColor: string; // Hex
  metalness: number;
  roughness: number;
  snowDensity: number;
}

export type InteractionMode = 'SCATTERED' | 'TREE' | 'IMAGE';

export interface UIState {
  interactionMode: InteractionMode;
  isPlayingMusic: boolean;
  isCameraEnabled: boolean;
}