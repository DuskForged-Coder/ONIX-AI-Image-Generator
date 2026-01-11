
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from './components/Button';
import { generateOrEditImage } from './services/geminiService';
import { GeneratedImage, AppState } from './types';

const FILTERS = [
  { name: 'Original', filter: 'none', icon: 'fa-image' },
  { name: 'B&W', filter: 'grayscale(100%)', icon: 'fa-moon' },
  { name: 'Sepia', filter: 'sepia(100%)', icon: 'fa-leaf' },
  { name: 'Invert', filter: 'invert(100%)', icon: 'fa-adjust' },
  { name: 'Blur', filter: 'blur(4px)', icon: 'fa-tint' },
  { name: 'Bright', filter: 'brightness(150%)', icon: 'fa-sun' },
  { name: 'Deep', filter: 'contrast(150%)', icon: 'fa-circle-half-stroke' },
];

const LOADING_MESSAGES = [
  "Analyzing your prompt...",
  "Synthesizing visual concepts...",
  "Sketching the foundation...",
  "Applying digital pigments...",
  "Refining textures and lighting...",
  "Baking ONIX masterpiece...",
  "Polishing final pixels..."
];

// Recreating the logo look with CSS for crispness
const Logo = () => (
  <div className="flex items-center gap-3">
    <div className="relative w-10 h-10 flex items-center justify-center">
      <div className="absolute inset-0 bg-cyan-500/20 blur-lg rounded-full animate-pulse"></div>
      <i className="fas fa-brain text-2xl text-cyan-400 drop-shadow-[0_0_8px_rgba(34,211,238,0.8)]"></i>
      <div className="absolute -right-1 -bottom-1">
        <i className="fas fa-network-wired text-xs text-purple-400 drop-shadow-[0_0_5px_rgba(192,132,252,0.8)]"></i>
      </div>
    </div>
    <span className="text-2xl font-black italic tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-cyan-400 drop-shadow-[0_0_10px_rgba(192,132,252,0.5)]">
      ONIX
    </span>
  </div>
);

const App: React.FC = () => {
  const [prompt, setPrompt] = useState('');
  const [history, setHistory] = useState<GeneratedImage[]>([]);
  
  const [canvasHistory, setCanvasHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);
  
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  
  // Cropping State
  const [isCropping, setIsCropping] = useState(false);
  const [cropRect, setCropRect] = useState({ x: 10, y: 10, w: 80, h: 80 }); // in percentage

  const [status, setStatus] = useState<AppState>('idle');
  const [loadingMsgIndex, setLoadingMsgIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasContainerRef = useRef<HTMLDivElement>(null);

  const currentImage = historyIndex >= 0 ? canvasHistory[historyIndex] : null;

  // Cycle loading messages
  useEffect(() => {
    let interval: number;
    if (status === 'generating' || status === 'editing') {
      interval = window.setInterval(() => {
        setLoadingMsgIndex(prev => (prev + 1) % LOADING_MESSAGES.length);
      }, 2000);
    } else {
      setLoadingMsgIndex(0);
    }
    return () => clearInterval(interval);
  }, [status]);

  const pushToCanvasHistory = (newImageUrl: string) => {
    const newHistory = canvasHistory.slice(0, historyIndex + 1);
    newHistory.push(newImageUrl);
    setCanvasHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  };

  const handleUndo = () => {
    if (historyIndex > 0) {
      setHistoryIndex(historyIndex - 1);
      resetView();
    }
  };

  const handleRedo = () => {
    if (historyIndex < canvasHistory.length - 1) {
      setHistoryIndex(historyIndex + 1);
      resetView();
    }
  };

  const resetView = () => {
    setZoom(1);
    setOffset({ x: 0, y: 0 });
    setIsCropping(false);
  };

  const handleZoomIn = () => setZoom(prev => Math.min(prev + 0.25, 5));
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 0.25, 0.5));

  const onMouseDown = (e: React.MouseEvent) => {
    if (isCropping) return;
    if (zoom <= 1 && e.button !== 1) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
  };

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging) return;
    setOffset({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    });
  }, [isDragging, dragStart]);

  const onMouseUp = () => setIsDragging(false);

  const applyFilter = (filterStyle: string) => {
    if (!currentImage || filterStyle === 'none') return;
    performCanvasOperation((ctx, img, canvas) => {
      ctx.filter = filterStyle;
      ctx.drawImage(img, 0, 0);
    });
  };

  const performCanvasOperation = (drawFn: (ctx: CanvasRenderingContext2D, img: HTMLImageElement, canvas: HTMLCanvasElement) => void) => {
    if (!currentImage) return;
    setStatus('editing');
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = currentImage;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        drawFn(ctx, img, canvas);
        pushToCanvasHistory(canvas.toDataURL('image/png'));
      }
      setStatus('idle');
    };
    img.onerror = () => {
      setError("Operation failed.");
      setStatus('idle');
    };
  };

  const executeCrop = () => {
    performCanvasOperation((ctx, img, canvas) => {
      const scaleX = img.width / 100;
      const scaleY = img.height / 100;
      const actualX = cropRect.x * scaleX;
      const actualY = cropRect.y * scaleY;
      const actualW = cropRect.w * scaleX;
      const actualH = cropRect.h * scaleY;
      
      canvas.width = actualW;
      canvas.height = actualH;
      ctx.drawImage(img, actualX, actualY, actualW, actualH, 0, 0, actualW, actualH);
    });
    setIsCropping(false);
  };

  const autoSuggestCrop = () => {
    // Simple heuristic: focus on center 80% with slight upward bias (rule of thirds / portrait focus)
    setCropRect({ x: 10, y: 5, w: 80, h: 80 });
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        if (e.shiftKey) handleRedo(); else handleUndo();
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        handleRedo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [historyIndex, canvasHistory]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (readerEvent) => {
        pushToCanvasHistory(readerEvent.target?.result as string);
        resetView();
      };
      reader.readAsDataURL(file);
    }
    if (e.target) e.target.value = '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() && !currentImage) return;
    try {
      setStatus(currentImage ? 'editing' : 'generating');
      setError(null);
      const mimeType = currentImage?.split(';')[0]?.split(':')[1] || 'image/png';
      const result = await generateOrEditImage(prompt, currentImage || undefined, mimeType);
      const newImage: GeneratedImage = {
        id: Date.now().toString(),
        url: result,
        prompt: prompt || 'Generated image',
        timestamp: Date.now(),
      };
      setHistory(prev => [newImage, ...prev]);
      pushToCanvasHistory(result);
      setPrompt('');
      setStatus('idle');
    } catch (err: any) {
      setError(err.message || 'Failed to process image');
      setStatus('error');
    }
  };

  const clearCanvas = () => {
    setCanvasHistory([]);
    setHistoryIndex(-1);
    setPrompt('');
    setError(null);
    setStatus('idle');
    resetView();
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-[#020617] text-slate-100">
      {/* Sidebar: History */}
      <aside className="w-full md:w-80 border-r border-slate-800 bg-[#0f172a] overflow-y-auto p-4 flex flex-col order-2 md:order-1">
        <div className="mb-6">
          <Logo />
          <p className="text-[10px] text-slate-500 uppercase font-bold tracking-[0.2em] mt-2 pl-1 opacity-70">
            by ADITYA NARAYAN RAUTARAY
          </p>
        </div>

        <div className="space-y-4">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest px-1">Recent Creations</h3>
          {history.length === 0 ? (
            <div className="text-center py-12 text-slate-600 border border-dashed border-slate-800 rounded-xl">
              <i className="fas fa-history text-2xl mb-3 block opacity-20"></i>
              <p className="text-sm">Empty Gallery</p>
            </div>
          ) : (
            history.map((item) => (
              <div 
                key={item.id} 
                onClick={() => { pushToCanvasHistory(item.url); resetView(); }}
                className="group relative rounded-xl overflow-hidden cursor-pointer border border-slate-800 hover:border-cyan-500/50 transition-all bg-slate-900 shadow-lg"
              >
                <img src={item.url} alt={item.prompt} className="w-full h-32 object-cover opacity-60 group-hover:opacity-100 transition-opacity" />
                <div className="absolute inset-x-0 bottom-0 p-2 bg-gradient-to-t from-black to-transparent">
                  <p className="text-[10px] truncate text-slate-300 font-medium">{item.prompt}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col relative order-1 md:order-2 overflow-hidden">
        <header className="p-4 flex justify-between items-center border-b border-slate-800 sticky top-0 bg-[#020617]/80 backdrop-blur-xl z-30">
          <div className="flex items-center gap-4">
             <div className="hidden sm:flex gap-1 border-r border-slate-800 pr-4">
              <button 
                onClick={handleUndo}
                disabled={historyIndex <= 0 || status !== 'idle'}
                className="w-9 h-9 rounded-lg flex items-center justify-center bg-slate-900 hover:bg-slate-800 disabled:opacity-30 transition-colors"
                title="Undo (Ctrl+Z)"
              >
                <i className="fas fa-undo-alt text-sm"></i>
              </button>
              <button 
                onClick={handleRedo}
                disabled={historyIndex >= canvasHistory.length - 1 || status !== 'idle'}
                className="w-9 h-9 rounded-lg flex items-center justify-center bg-slate-900 hover:bg-slate-800 disabled:opacity-30 transition-colors"
                title="Redo (Ctrl+Y)"
              >
                <i className="fas fa-redo-alt text-sm"></i>
              </button>
            </div>
            
            {currentImage && (
              <div className="flex gap-1">
                <button 
                  onClick={() => { setIsCropping(!isCropping); if(!isCropping) autoSuggestCrop(); }}
                  className={`px-3 h-9 rounded-lg flex items-center gap-2 text-xs font-bold uppercase tracking-wider transition-all ${isCropping ? 'bg-cyan-500 text-black shadow-[0_0_15px_rgba(6,182,212,0.5)]' : 'bg-slate-900 hover:bg-slate-800 text-slate-400'}`}
                >
                  <i className="fas fa-crop-simple"></i>
                  {isCropping ? 'Cropping...' : 'Crop'}
                </button>
              </div>
            )}
          </div>
          
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => fileInputRef.current?.click()} className="!py-1.5 !px-3 !text-xs !rounded-lg border border-slate-700">
              <i className="fas fa-upload mr-2"></i> Upload
            </Button>
            {currentImage && (
              <Button variant="danger" onClick={clearCanvas} className="!w-9 !h-9 !p-0 !rounded-lg">
                <i className="fas fa-trash-can text-sm"></i>
              </Button>
            )}
          </div>
        </header>

        <div className="flex-1 p-4 sm:p-8 flex flex-col items-center justify-center overflow-hidden">
          {/* Canvas Area */}
          <div 
            ref={canvasContainerRef}
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
            onMouseLeave={onMouseUp}
            className={`relative w-full max-w-2xl aspect-square bg-[#0a0a0a] rounded-3xl shadow-[0_0_50px_rgba(0,0,0,0.5)] border border-slate-800 flex items-center justify-center overflow-hidden group ${isDragging ? 'cursor-grabbing' : (zoom > 1 && !isCropping) ? 'cursor-grab' : 'cursor-default'}`}
          >
            {currentImage ? (
              <>
                <div 
                  className="w-full h-full flex items-center justify-center transition-transform duration-75 ease-out origin-center"
                  style={{ transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})` }}
                >
                  <img 
                    key={historyIndex}
                    src={currentImage} 
                    alt="Preview" 
                    className="max-w-full max-h-full object-contain pointer-events-none select-none drop-shadow-2xl" 
                  />
                </div>

                {/* Crop Overlay */}
                {isCropping && (
                  <div className="absolute inset-0 z-20 pointer-events-none">
                    <div className="absolute inset-0 bg-black/60 pointer-events-none"></div>
                    <div 
                      className="absolute border-2 border-cyan-400 shadow-[0_0_20px_rgba(34,211,238,0.4)] transition-all pointer-events-auto cursor-move"
                      style={{
                        left: `${cropRect.x}%`,
                        top: `${cropRect.y}%`,
                        width: `${cropRect.w}%`,
                        height: `${cropRect.h}%`,
                      }}
                    >
                      {/* Grid lines */}
                      <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 opacity-30">
                        <div className="border-r border-b border-cyan-400/50"></div>
                        <div className="border-r border-b border-cyan-400/50"></div>
                        <div className="border-b border-cyan-400/50"></div>
                        <div className="border-r border-b border-cyan-400/50"></div>
                        <div className="border-r border-b border-cyan-400/50"></div>
                        <div className="border-b border-cyan-400/50"></div>
                        <div className="border-r border-cyan-400/50"></div>
                        <div className="border-r border-cyan-400/50"></div>
                        <div></div>
                      </div>
                      {/* Crop Controls */}
                      <div className="absolute -bottom-12 left-1/2 -translate-x-1/2 flex gap-2">
                        <button onClick={executeCrop} className="bg-cyan-500 text-black px-4 py-1.5 rounded-full text-xs font-black uppercase shadow-lg hover:scale-105 transition-transform">Apply</button>
                        <button onClick={() => setIsCropping(false)} className="bg-slate-800 text-white px-4 py-1.5 rounded-full text-xs font-black uppercase shadow-lg hover:scale-105 transition-transform">Cancel</button>
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Floating Navigation Controls */}
                {!isCropping && (
                  <div className="absolute left-6 top-1/2 -translate-y-1/2 flex flex-col gap-3 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                    <button onClick={handleZoomIn} className="w-11 h-11 bg-slate-900/90 hover:bg-cyan-500 hover:text-black rounded-xl backdrop-blur-sm transition-all shadow-xl flex items-center justify-center border border-slate-700">
                      <i className="fas fa-search-plus"></i>
                    </button>
                    <button onClick={resetView} className="w-11 h-11 bg-slate-900/90 hover:bg-cyan-500 hover:text-black rounded-xl backdrop-blur-sm transition-all shadow-xl flex items-center justify-center text-[10px] font-black tracking-tighter border border-slate-700">
                      FIT
                    </button>
                    <button onClick={handleZoomOut} className="w-11 h-11 bg-slate-900/90 hover:bg-cyan-500 hover:text-black rounded-xl backdrop-blur-sm transition-all shadow-xl flex items-center justify-center border border-slate-700">
                      <i className="fas fa-search-minus"></i>
                    </button>
                  </div>
                )}

                <div className="absolute top-6 right-6 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                  <button 
                    onClick={() => {
                      const link = document.createElement('a');
                      link.href = currentImage;
                      link.download = `onix-${Date.now()}.png`;
                      link.click();
                    }}
                    className="p-4 bg-slate-900/90 hover:bg-cyan-500 hover:text-black rounded-2xl backdrop-blur-sm transition-all shadow-xl border border-slate-700"
                  >
                    <i className="fas fa-download"></i>
                  </button>
                </div>

                <div className="absolute bottom-6 inset-x-0 flex justify-center pointer-events-none">
                   <div className="bg-black/40 backdrop-blur-md px-4 py-1.5 rounded-full border border-white/10 text-[10px] text-slate-400 uppercase tracking-[0.2em] font-black">
                    {historyIndex + 1} / {canvasHistory.length} • ONIX CORE
                  </div>
                </div>
              </>
            ) : (
              <div className="text-center p-12 space-y-6">
                <div className="w-24 h-24 bg-slate-900/50 rounded-full flex items-center justify-center mx-auto text-slate-700 border border-slate-800 shadow-inner relative overflow-hidden group">
                  <div className="absolute inset-0 bg-gradient-to-tr from-cyan-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                  <i className="fas fa-cloud-arrow-up text-3xl"></i>
                </div>
                <div className="space-y-2">
                  <h2 className="text-2xl font-black text-slate-200 tracking-tight">Initiate Generation</h2>
                  <p className="text-slate-500 text-sm max-w-xs mx-auto font-medium">Input your neural directives below to manifest high-fidelity visuals via ONIX core.</p>
                </div>
              </div>
            )}

            {/* Enhanced Loading Overlay */}
            {(status === 'generating' || status === 'editing') && (
              <div className="absolute inset-0 bg-black/80 backdrop-blur-2xl flex flex-col items-center justify-center p-12 text-center z-50 animate-in fade-in duration-500">
                <div className="relative mb-8">
                  <div className="w-24 h-24 border-2 border-cyan-500/10 border-t-cyan-400 rounded-full animate-spin shadow-[0_0_30px_rgba(34,211,238,0.2)]"></div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <i className="fas fa-atom text-2xl text-cyan-400 animate-pulse"></i>
                  </div>
                </div>
                <div className="space-y-3">
                  <h4 className="text-lg font-black uppercase tracking-[0.3em] text-white">Manifesting</h4>
                  <p className="text-cyan-400/80 text-xs font-black uppercase tracking-widest animate-pulse h-4">
                    {LOADING_MESSAGES[loadingMsgIndex]}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Filters Bar */}
          {currentImage && !isCropping && (
            <div className="mt-8 w-full max-w-2xl">
              <div className="flex gap-4 justify-between overflow-x-auto pb-4 scrollbar-hide px-2">
                {FILTERS.map((f) => (
                  <button
                    key={f.name}
                    onClick={() => applyFilter(f.filter)}
                    disabled={status !== 'idle'}
                    className="flex flex-col items-center gap-2 group min-w-[64px]"
                  >
                    <div className="w-14 h-14 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center group-hover:border-cyan-500/50 group-hover:bg-slate-800 transition-all text-slate-500 group-hover:text-cyan-400 shadow-lg">
                      <i className={`fas ${f.icon} text-lg`}></i>
                    </div>
                    <span className="text-[10px] font-black uppercase text-slate-600 group-hover:text-slate-300 tracking-wider">
                      {f.name}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {error && (
            <div className="mt-6 p-4 bg-red-500/10 border border-red-500/30 rounded-2xl text-red-400 text-xs font-bold flex items-center gap-3 max-w-2xl w-full animate-in slide-in-from-bottom-2">
              <i className="fas fa-triangle-exclamation text-lg"></i>
              <p>{error}</p>
              <button onClick={() => setError(null)} className="ml-auto opacity-50 hover:opacity-100"><i className="fas fa-times"></i></button>
            </div>
          )}
        </div>

        {/* Input Bar */}
        <footer className="p-6 sticky bottom-0 bg-[#020617]/90 backdrop-blur-2xl border-t border-slate-800 z-40">
          <form onSubmit={handleSubmit} className="max-w-4xl mx-auto flex flex-col sm:flex-row gap-4">
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              accept="image/*"
              onChange={handleFileUpload}
            />
            <div className="flex-1 relative group">
              <div className="absolute -inset-1 bg-gradient-to-r from-cyan-500/20 to-purple-500/20 rounded-2xl blur opacity-0 group-focus-within:opacity-100 transition-opacity"></div>
              <input 
                type="text"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={currentImage ? "Direct ONIX Core to modify image..." : "Manifest something extraordinary..."}
                className="relative w-full bg-slate-900/50 border border-slate-800 rounded-2xl px-6 py-5 focus:outline-none focus:border-cyan-500/50 transition-all text-lg placeholder:text-slate-600 font-medium"
                disabled={status === 'generating' || status === 'editing'}
              />
              <div className="absolute right-5 top-1/2 -translate-y-1/2 flex items-center gap-3 text-slate-600">
                 <kbd className="hidden sm:inline-flex px-1.5 py-0.5 rounded border border-slate-700 text-[10px] font-black">ENT</kbd>
              </div>
            </div>
            <button 
              type="submit" 
              disabled={status === 'generating' || status === 'editing' || (!prompt && !currentImage)}
              className="relative h-[68px] sm:w-52 group overflow-hidden rounded-2xl bg-white text-black font-black uppercase tracking-[0.15em] text-sm transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:scale-100"
            >
               <div className="absolute inset-0 bg-gradient-to-r from-cyan-400 to-purple-400 opacity-0 group-hover:opacity-10 transition-opacity"></div>
               <span className="relative flex items-center justify-center gap-2">
                 {status === 'idle' ? (
                   <>
                    {currentImage ? 'Apply Edit' : 'Manifest'}
                    <i className="fas fa-arrow-right text-[10px]"></i>
                   </>
                 ) : (
                   <i className="fas fa-spinner animate-spin"></i>
                 )}
               </span>
            </button>
          </form>
          <div className="max-w-4xl mx-auto mt-4 flex justify-between items-center text-[10px] text-slate-600 uppercase font-black tracking-[0.2em]">
            <div className="flex gap-4">
              <span className="flex items-center gap-1.5"><i className="fas fa-microchip text-cyan-500/50"></i> Neural Engine v2.5</span>
              <span className="flex items-center gap-1.5"><i className="fas fa-crop text-cyan-500/50"></i> Smart Crop Active</span>
            </div>
            <div className="hidden sm:block">
              Proprietary Tech by Aditya Narayan Rautaray
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
};

export default App;
