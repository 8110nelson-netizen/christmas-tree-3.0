import React, { useRef } from 'react';
import { Sparkles, Zap, Camera, CameraOff, Image as ImageIcon, RotateCcw, Upload } from 'lucide-react';
import { UIState } from '../types';

interface OverlayProps {
  uiState: UIState;
  setUiState: React.Dispatch<React.SetStateAction<UIState>>;
  onImageUpload: (file: File) => void;
  hasImageLoaded: boolean;
}

const Overlay: React.FC<OverlayProps> = ({ uiState, setUiState, onImageUpload, hasImageLoaded }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const toggleScatter = () => {
    setUiState(prev => ({
        ...prev,
        interactionMode: prev.interactionMode === 'SCATTERED' ? 'TREE' : 'SCATTERED'
    }));
  };

  const toggleImageMode = () => {
    setUiState(prev => ({
         ...prev,
         interactionMode: prev.interactionMode === 'IMAGE' ? 'TREE' : 'IMAGE'
    }));
  };

  const handleUploadClick = () => {
      fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          onImageUpload(file);
      }
  };

  const toggleCamera = () => {
    setUiState(prev => ({
      ...prev,
      isCameraEnabled: !prev.isCameraEnabled
    }));
  };

  return (
    <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-8 z-10 text-arix-goldLight">
      
      {/* Hidden File Input */}
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileChange} 
        accept="image/webp, image/png, image/jpeg" 
        className="hidden" 
      />

      {/* Header */}
      <header className="flex justify-between items-start pointer-events-auto">
        <div className="flex flex-col">
          <h1 className="text-3xl md:text-5xl font-serif italic text-transparent bg-clip-text bg-gradient-to-r from-arix-gold via-yellow-200 to-arix-gold drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)]">
            Merry
          </h1>
          <h1 className="text-4xl md:text-7xl font-serif font-bold tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-arix-gold to-yellow-700 drop-shadow-[0_4px_4px_rgba(0,0,0,0.8)] -mt-1 md:-mt-3 ml-4 md:ml-8">
            Christmas
          </h1>
        </div>
        
        <div className="flex gap-4">
            {/* Camera Toggle */}
            <button
              onClick={toggleCamera}
              className={`group flex items-center justify-center w-12 h-12 rounded-full backdrop-blur-md border transition-all duration-300 ${
                uiState.isCameraEnabled
                  ? 'bg-arix-gold/20 border-arix-gold text-arix-gold shadow-[0_0_15px_rgba(212,175,55,0.3)]'
                  : 'bg-arix-emerald/20 border-arix-gold/30 text-arix-gold/60 hover:bg-arix-gold/10 hover:border-arix-gold/60 hover:text-arix-gold'
              }`}
              title={uiState.isCameraEnabled ? "Disable Camera Control" : "Enable Camera Control"}
            >
              {uiState.isCameraEnabled ? (
                <Camera className="w-5 h-5 animate-pulse" />
              ) : (
                <CameraOff className="w-5 h-5" />
              )}
            </button>
            
            {/* Main Action Group */}
            {hasImageLoaded ? (
                <div className="flex gap-2">
                    {/* Primary Toggle: View Image / Return */}
                    <button
                        onClick={toggleImageMode}
                        className={`group flex items-center gap-2 px-5 py-3 rounded-full backdrop-blur-md border transition-all duration-300 ${
                            uiState.interactionMode === 'IMAGE'
                            ? 'bg-arix-gold/20 border-arix-gold text-arix-gold shadow-[0_0_15px_rgba(212,175,55,0.2)]'
                            : 'bg-arix-emerald/20 border-arix-gold/30 hover:bg-arix-gold/20 hover:border-arix-gold'
                        }`}
                    >
                        {uiState.interactionMode === 'IMAGE' ? (
                             <>
                                <RotateCcw className="w-5 h-5" />
                                <span className="font-serif text-sm tracking-widest hidden md:inline">RETURN</span>
                             </>
                        ) : (
                            <>
                                <ImageIcon className="w-5 h-5" />
                                <span className="font-serif text-sm tracking-widest hidden md:inline">VIEW IMAGE</span>
                            </>
                        )}
                    </button>

                    {/* Secondary: Change Image */}
                    <button
                        onClick={handleUploadClick}
                        className="group flex items-center justify-center w-12 h-12 rounded-full backdrop-blur-md border border-arix-gold/30 bg-arix-emerald/20 hover:bg-arix-gold/20 hover:border-arix-gold transition-all duration-300"
                        title="Change Image"
                    >
                        <Upload className="w-4 h-4 text-arix-gold/70 group-hover:text-arix-gold" />
                    </button>
                </div>
            ) : (
                <button
                    onClick={handleUploadClick}
                    className="group flex items-center gap-2 px-5 py-3 rounded-full bg-arix-emerald/20 backdrop-blur-md border border-arix-gold/30 hover:bg-arix-gold/20 hover:border-arix-gold transition-all duration-300"
                >
                    <ImageIcon className="w-5 h-5 text-arix-gold" />
                    <span className="font-serif text-sm tracking-widest text-arix-gold hidden md:inline">UPLOAD IMAGE</span>
                </button>
            )}

             {/* Scatter Toggle (Only show if not in Image mode) */}
             {uiState.interactionMode !== 'IMAGE' && (
                <button 
                    onClick={toggleScatter}
                    className="group flex items-center gap-2 px-5 py-3 rounded-full bg-arix-emerald/20 backdrop-blur-md border border-arix-gold/30 hover:bg-arix-gold/20 hover:border-arix-gold transition-all duration-300"
                >
                    {uiState.interactionMode === 'TREE' ? (
                        <>
                            <Sparkles className="w-5 h-5 text-arix-gold animate-pulse" />
                            <span className="font-serif text-sm tracking-widest text-arix-gold hidden md:inline">SCATTER</span>
                        </>
                    ) : (
                        <>
                            <Zap className="w-5 h-5 text-arix-gold" />
                            <span className="font-serif text-sm tracking-widest text-arix-gold hidden md:inline">CONVERGE</span>
                        </>
                    )}
                </button>
             )}
        </div>
      </header>

      {/* Footer */}
      <footer className="pointer-events-auto w-full flex justify-between items-end">
        <div className="flex items-center gap-4">
           <div className="h-px w-12 bg-arix-gold/50"></div>
           <span className="font-serif italic text-arix-gold text-lg">Wish upon a star</span>
        </div>
      </footer>
    </div>
  );
};

export default Overlay;