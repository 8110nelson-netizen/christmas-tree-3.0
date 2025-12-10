import * as THREE from 'three';

export const imageToPoints = (imageSource: string, targetCount: number): Promise<Float32Array> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.onload = () => {
      const canvas = document.createElement('canvas');
      // Use higher resolution for better line detection
      const width = 400; 
      const height = Math.floor(width * (img.height / img.width));
      canvas.width = width;
      canvas.height = height;
      
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(new Float32Array(targetCount * 3));
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);
      const imgData = ctx.getImageData(0, 0, width, height);
      const data = imgData.data;
      
      const candidates: number[] = [];

      // Helper to get luminance
      const getLum = (x: number, y: number) => {
          if (x < 0 || x >= width || y < 0 || y >= height) return 255;
          const idx = (y * width + x) * 4;
          return (0.299 * data[idx] + 0.587 * data[idx+1] + 0.114 * data[idx+2]);
      };

      // Helper to get Alpha
      const getAlpha = (x: number, y: number) => {
          if (x < 0 || x >= width || y < 0 || y >= height) return 0;
          return data[(y * width + x) * 4 + 3];
      };

      // Analyze pixels for edges and dark lines
      for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
          const lum = getLum(x, y);
          const alpha = getAlpha(x, y);

          if (alpha < 50) continue; // Skip transparent

          // 1. Darkness Check (for ink on paper)
          // If pixel is significantly darker than "white" paper
          const isDark = lum < 180;

          // 2. Simple Edge Detection (Sobel-like or neighbor difference)
          // Check right and bottom neighbors
          const rightLum = getLum(x + 1, y);
          const bottomLum = getLum(x, y + 1);
          
          const isEdge = Math.abs(lum - rightLum) > 15 || Math.abs(lum - bottomLum) > 15;

          // If it's a dark line or an edge, it's a candidate for a particle
          if (isDark || isEdge) {
             candidates.push(x, y);
          }
        }
      }

      const output = new Float32Array(targetCount * 3);
      
      if (candidates.length === 0) {
          console.warn("No valid points found in image.");
          resolve(output);
          return;
      }

      // Scale configuration to fit the tree area
      const scale = 16; 
      const aspectRatio = height / width;

      for (let i = 0; i < targetCount; i++) {
        // Randomly sample from valid candidates to form the shape
        // Using random sampling prevents "scanning line" artifacts if points < pixels
        const index = Math.floor(Math.random() * (candidates.length / 2)) * 2;
        const px = candidates[index];
        const py = candidates[index + 1];

        // Normalize 0..1 then Center -0.5..0.5
        const nx = (px / width) - 0.5;
        const ny = (py / height) - 0.5;
        
        // Map to 3D
        // X: Horizontal
        // Y: Vertical (Inverted because Image Y goes down, 3D Y goes up)
        // Z: Flattened
        output[i * 3] = nx * scale; 
        output[i * 3 + 1] = -ny * scale * aspectRatio + 2.0; // Shift up to be in camera view center
        output[i * 3 + 2] = (Math.random() - 0.5) * 0.1; // Very thin layer for 2D look
      }

      resolve(output);
    };
    
    img.onerror = () => {
        resolve(new Float32Array(targetCount * 3));
    };

    img.src = imageSource;
  });
};