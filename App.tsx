
import React, { useState, useCallback, useRef, useEffect } from 'react';
import ThreeViewer, { ViewerHandle } from './components/ThreeViewer';
import { AppState, ModelMetadata, ExportConfig, SceneSettings } from './types';

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>(AppState.IDLE);
  const [loadingStatus, setLoadingStatus] = useState<string>('');
  const [exportProgress, setExportProgress] = useState<number>(0);
  const [modelUrl, setModelUrl] = useState<string | null>(null);
  const [extension, setExtension] = useState<string | null>(null);
  const [metadata, setMetadata] = useState<ModelMetadata | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAboutModalOpen, setIsAboutModalOpen] = useState(false);
  const [isDonationModalOpen, setIsDonationModalOpen] = useState(false);
  
  const [sceneSettings, setSceneSettings] = useState<SceneSettings>({
    autoRotate: false,
    wireframe: false,
    showSkeleton: false,
    playAnimation: true,
    activeAnimationIndex: 0,
    pointSize: 0.05
  });

  const [exportSettings, setExportSettings] = useState<Omit<ExportConfig, 'fileName'>>({
    format: 'glb',
    draco: false,
    ktx2: false
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const viewerRef = useRef<ViewerHandle>(null);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const ext = file.name.split('.').pop()?.toLowerCase() || '';
      const url = URL.createObjectURL(file);
      
      setModelUrl(url);
      setExtension(ext);
      setAppState(AppState.LOADING);
      setMetadata({
        name: file.name,
        size: file.size,
        format: ext.toUpperCase(),
        vertices: 0,
        triangles: 0,
        meshes: 0,
        materials: 0,
        textures: 0,
        animations: []
      });
    }
  };

  const handleMetadataLoaded = useCallback((details: Partial<ModelMetadata>) => {
    setMetadata(prev => prev ? { ...prev, ...details } as ModelMetadata : null);
    setAppState(AppState.VIEWING);
    // Reset animation index when a new model loads
    setSceneSettings(s => ({ ...s, activeAnimationIndex: 0 }));
  }, []);

  const handleExport = async () => {
    if (!metadata || !viewerRef.current) return;
    setIsExportModalOpen(false);
    setAppState(AppState.OPTIMIZING);
    setExportProgress(0);

    const duration = exportSettings.ktx2 || exportSettings.draco ? 3500 : 1500;
    const intervalTime = 40;
    const steps = duration / intervalTime;
    const increment = 100 / steps;

    const timer = setInterval(() => {
      setExportProgress(prev => {
        if (prev >= 100) {
          clearInterval(timer);
          return 100;
        }
        return Math.min(prev + increment, 100);
      });
    }, intervalTime);

    setTimeout(async () => {
      try {
        await viewerRef.current?.exportModel({
          ...exportSettings,
          fileName: metadata.name
        } as ExportConfig);
        setAppState(AppState.VIEWING);
        setExportProgress(0);
      } catch (err) {
        console.error(err);
        setAppState(AppState.VIEWING);
        alert('Export failed.');
      }
    }, duration + 500);
  };

  const toggleDraco = () => setExportSettings(s => ({ ...s, draco: !s.draco, ktx2: false }));
  const toggleKTX2 = () => setExportSettings(s => ({ ...s, ktx2: !s.ktx2, draco: false }));

  const reset = () => {
    setModelUrl(null);
    setExtension(null);
    setMetadata(null);
    setAppState(AppState.IDLE);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="flex h-screen w-full overflow-hidden font-sans bg-slate-950 text-slate-200">
      {/* Sidebar */}
      <aside 
        style={{ width: isSidebarOpen ? '320px' : '80px' }}
        className="transition-all duration-500 bg-slate-900 border-r border-slate-800 flex flex-col z-20 shadow-2xl relative flex-shrink-0"
      >
        <div className="p-6 flex items-center justify-center min-h-[100px] border-b border-slate-800 flex-shrink-0">
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center shadow-xl transition-all ${!isSidebarOpen ? 'scale-90' : 'rotate-12'}`}>
              <i className="fas fa-layer-group text-white text-xl"></i>
            </div>
            {isSidebarOpen && (
              <div className="flex flex-col animate-in fade-in slide-in-from-left-4 duration-500">
                <h1 className="font-black text-2xl tracking-tighter text-white uppercase leading-none">PolyPress</h1>
                <span className="text-[10px] text-blue-400 font-bold tracking-widest uppercase mt-1">3D Viewer</span>
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-8 no-scrollbar">
          <div className="flex justify-center w-full mb-2">
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="w-12 h-12 rounded-2xl transition-all flex items-center justify-center border bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-400 shadow-xl"
            >
              <i className={`fas ${isSidebarOpen ? 'fa-angle-left' : 'fa-bars'} text-lg`}></i>
            </button>
          </div>

          <section className="space-y-4">
            <div className="space-y-3 flex flex-col items-center">
              <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".glb,.gltf,.obj,.ply,.pcd,.xyz" className="hidden" />
              <button onClick={() => fileInputRef.current?.click()} className={`${isSidebarOpen ? 'w-full py-4 px-6' : 'w-14 h-14'} bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-2xl border border-slate-700 flex items-center justify-center gap-3 overflow-hidden transition-all`}>
                <i className="fas fa-plus text-blue-400"></i>
                {isSidebarOpen && <span className="font-bold text-sm tracking-tight">Load 3D / PointCloud</span>}
              </button>
              
              {modelUrl && (
                <>
                  <button onClick={() => viewerRef.current?.frameModel()} className={`${isSidebarOpen ? 'w-full py-4 px-6' : 'w-14 h-14'} bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-2xl border border-slate-700 flex items-center justify-center gap-3 transition-all`}>
                    <i className="fas fa-expand text-emerald-400"></i>
                    {isSidebarOpen && <span className="font-bold text-sm tracking-tight">Frame View</span>}
                  </button>
                  <button onClick={reset} className={`${isSidebarOpen ? 'w-full py-4 px-6' : 'w-14 h-14'} bg-slate-800/50 hover:bg-red-900/20 hover:text-red-400 hover:border-red-900/50 text-slate-400 rounded-2xl flex items-center justify-center gap-3 transition-all`}>
                    <i className="fas fa-trash-alt"></i>
                    {isSidebarOpen && <span className="font-bold text-sm tracking-tight">Eject Model</span>}
                  </button>
                </>
              )}
            </div>
          </section>

          {metadata && isSidebarOpen && (
            <section className="space-y-4">
              <button onClick={() => setIsExportModalOpen(true)} className="w-full py-4 px-6 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-2xl shadow-xl transition-all flex items-center justify-center gap-3">
                <i className="fas fa-file-export"></i>
                <span className="font-black text-sm uppercase">Export 3D</span>
              </button>
            </section>
          )}

          {metadata && isSidebarOpen && (
            <section className="bg-slate-950/50 rounded-3xl p-5 border border-slate-800/50 space-y-4">
              {[
                { label: 'Format', value: metadata.format },
                { label: 'Complexity', value: metadata.triangles > 0 ? `${metadata.triangles.toLocaleString()} TRIS` : `${metadata.vertices.toLocaleString()} POINTS` },
                { label: 'Payload', value: `${(metadata.size / 1024 / 1024).toFixed(2)} MB` },
                { label: 'Animations', value: metadata.animations.length > 0 ? metadata.animations.length : 'None' }
              ].map((item, idx) => (
                <div key={idx} className="flex justify-between items-center text-[11px]">
                  <span className="text-slate-500 font-bold uppercase tracking-widest">{item.label}</span>
                  <span className="text-slate-200 font-mono font-bold">{item.value}</span>
                </div>
              ))}
            </section>
          )}
        </div>

        {/* Sidebar Footer Actions */}
        <div className="p-4 border-t border-slate-800 space-y-2 flex-shrink-0">
          <button 
            onClick={() => setIsDonationModalOpen(true)} 
            className={`${isSidebarOpen ? 'w-full py-3 px-4' : 'w-12 h-12'} bg-slate-800/50 hover:bg-pink-900/10 hover:text-pink-400 border border-slate-700 rounded-2xl flex items-center justify-center gap-3 transition-all`}
          >
            <i className="fas fa-heart"></i>
            {isSidebarOpen && <span className="font-bold text-xs uppercase tracking-tight">Donation</span>}
          </button>
          <button 
            onClick={() => setIsAboutModalOpen(true)} 
            className={`${isSidebarOpen ? 'w-full py-3 px-4' : 'w-12 h-12'} bg-slate-800/50 hover:bg-blue-900/10 hover:text-blue-400 border border-slate-700 rounded-2xl flex items-center justify-center gap-3 transition-all`}
          >
            <i className="fas fa-info-circle"></i>
            {isSidebarOpen && <span className="font-bold text-xs uppercase tracking-tight">About</span>}
          </button>
        </div>
      </aside>

      {/* Main Container */}
      <main className="flex-1 relative min-w-0 bg-slate-950">
        <header className="absolute top-0 left-0 p-6 z-10 pointer-events-none">
          {metadata && (
            <div className="pointer-events-auto bg-slate-900/80 backdrop-blur-xl border border-white/5 rounded-3xl px-6 py-3 flex items-center gap-4 shadow-2xl">
               <div className="w-10 h-10 bg-blue-600/20 rounded-xl flex items-center justify-center">
                  <i className="fas fa-cube text-blue-500"></i>
               </div>
               <div className="flex flex-col">
                 <span className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Active File</span>
                 <span className="text-sm font-bold text-white max-w-[200px] truncate">{metadata.name}</span>
               </div>
            </div>
          )}
        </header>

        {/* TOP RIGHT FOLDABLE SETTINGS */}
        <div className="absolute top-6 right-6 z-40 flex flex-col items-end pointer-events-none">
          <button 
            onClick={() => setIsSettingsOpen(!isSettingsOpen)}
            className="pointer-events-auto w-12 h-12 bg-slate-900/90 backdrop-blur-md border border-slate-800 rounded-2xl flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 transition-all shadow-xl"
          >
            <i className={`fas ${isSettingsOpen ? 'fa-times' : 'fa-cog'} text-lg transition-transform duration-500 ${isSettingsOpen ? 'rotate-180' : ''}`}></i>
          </button>

          <div className={`pointer-events-auto mt-3 overflow-hidden transition-all duration-500 ease-in-out bg-slate-900/90 backdrop-blur-xl border border-slate-800 rounded-3xl shadow-2xl ${
            isSettingsOpen ? 'max-h-[700px] opacity-100 w-[260px] p-6' : 'max-h-0 opacity-0 w-[0px] p-0'
          }`}>
            <h3 className="text-[10px] font-black text-blue-400 uppercase tracking-[0.2em] mb-4">Scene Controls</h3>
            <div className="space-y-5">
              <Toggle label="Auto Rotate" active={sceneSettings.autoRotate} onToggle={() => setSceneSettings(s => ({ ...s, autoRotate: !s.autoRotate }))} icon="rotate" />
              <Toggle label="Wireframe" active={sceneSettings.wireframe} onToggle={() => setSceneSettings(s => ({ ...s, wireframe: !s.wireframe }))} icon="border-all" />
              <Toggle label="Animation" active={sceneSettings.playAnimation} onToggle={() => setSceneSettings(s => ({ ...s, playAnimation: !s.playAnimation }))} icon="play" />
              <Toggle label="Skeleton" active={sceneSettings.showSkeleton} onToggle={() => setSceneSettings(s => ({ ...s, showSkeleton: !s.showSkeleton }))} icon="bone" />
              
              {metadata && metadata.animations.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-slate-800">
                  <div className="flex justify-between items-center text-[10px] text-slate-500 font-bold uppercase tracking-widest">
                    <span>Active Track</span>
                  </div>
                  <select 
                    value={sceneSettings.activeAnimationIndex}
                    onChange={(e) => setSceneSettings(s => ({ ...s, activeAnimationIndex: parseInt(e.target.value) }))}
                    className="w-full bg-slate-800 border border-slate-700 text-white text-[11px] rounded-lg p-2 focus:ring-1 focus:ring-blue-500 outline-none"
                  >
                    {metadata.animations.map((name, idx) => (
                      <option key={idx} value={idx}>{name}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="space-y-2 pt-2 border-t border-slate-800">
                 <div className="flex justify-between items-center text-[10px] text-slate-500 font-bold uppercase tracking-widest">
                    <span>Point Size</span>
                    <span className="text-blue-400">{sceneSettings.pointSize.toFixed(2)}</span>
                 </div>
                 <input 
                  type="range" min="0.01" max="0.5" step="0.01" 
                  value={sceneSettings.pointSize} 
                  onChange={(e) => setSceneSettings(s => ({ ...s, pointSize: parseFloat(e.target.value) }))}
                  className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
                 />
              </div>
            </div>
          </div>
        </div>

        <ThreeViewer 
          ref={viewerRef}
          modelUrl={modelUrl} 
          extension={extension} 
          settings={sceneSettings}
          onModelMetadata={handleMetadataLoaded} 
          onLoadingStatus={setLoadingStatus}
        />

        {/* Loading Overlay */}
        {appState === AppState.LOADING && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/95 backdrop-blur-2xl z-50">
            <div className="relative w-40 h-40 mb-10">
              <div className="absolute inset-0 border-[3px] border-blue-500/10 rounded-full"></div>
              <div className="absolute inset-0 border-[3px] border-t-blue-500 rounded-full animate-spin"></div>
              <div className="absolute inset-10 bg-blue-600/5 rounded-full flex items-center justify-center animate-pulse">
                <i className="fas fa-project-diagram text-4xl text-blue-500"></i>
              </div>
            </div>
            <h2 className="text-3xl font-black text-white mb-3 uppercase tracking-tighter">Hydrating Scene</h2>
            <p className="text-blue-400 font-mono text-sm tracking-widest uppercase">{loadingStatus}</p>
          </div>
        )}

        {/* Optimization Overlay */}
        {appState === AppState.OPTIMIZING && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-blue-950/90 backdrop-blur-3xl z-50">
            <div className="text-center p-12 bg-slate-900/90 border border-blue-500/20 rounded-[48px] shadow-2xl max-w-lg w-full">
               <div className="relative inline-block mb-10">
                 <i className="fas fa-microchip text-7xl text-blue-400 animate-pulse"></i>
               </div>
               <h2 className="text-3xl font-black text-white mb-2 tracking-tighter uppercase">Compressing Assets</h2>
               <div className="space-y-4 mb-8">
                 <div className="flex justify-between items-end mb-1">
                   <span className="text-2xl font-mono font-black text-white tracking-tighter">{Math.round(exportProgress)}%</span>
                 </div>
                 <div className="w-full h-4 bg-slate-800 rounded-full overflow-hidden">
                   <div className="h-full bg-blue-600 transition-all" style={{ width: `${exportProgress}%` }} />
                 </div>
               </div>
            </div>
          </div>
        )}

        {/* Export Modal */}
        {isExportModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-md" onClick={() => setIsExportModalOpen(false)} />
            <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-[32px] overflow-hidden shadow-2xl">
              <div className="p-8 border-b border-slate-800">
                <h2 className="text-2xl font-black text-white uppercase tracking-tighter">Export Config</h2>
                <p className="text-slate-500 text-xs">Target: <span className="text-blue-400 font-bold">GLB Binary</span></p>
              </div>
              <div className="p-8 space-y-6">
                <CompressionToggle label="Draco Geometry" active={exportSettings.draco} onToggle={toggleDraco} />
                <CompressionToggle label="KTX2 Textures" active={exportSettings.ktx2} onToggle={toggleKTX2} />
              </div>
              <div className="p-8 bg-slate-950/50 grid grid-cols-2 gap-4">
                <button onClick={() => setIsExportModalOpen(false)} className="py-4 bg-slate-800 rounded-2xl font-bold text-sm">Cancel</button>
                <button onClick={handleExport} className="py-4 bg-blue-600 text-white rounded-2xl font-bold text-sm">Confirm</button>
              </div>
            </div>
          </div>
        )}

        {/* About Modal */}
        {isAboutModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 animate-in fade-in duration-300">
            <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-md" onClick={() => setIsAboutModalOpen(false)} />
            <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-[32px] overflow-hidden shadow-2xl">
              <div className="p-8 border-b border-slate-800 bg-slate-900/50">
                <div className="flex items-center gap-4 mb-2">
                  <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center">
                    <i className="fas fa-info-circle text-white"></i>
                  </div>
                  <h2 className="text-2xl font-black text-white uppercase tracking-tighter">About PolyPress</h2>
                </div>
                <p className="text-slate-500 text-xs uppercase tracking-widest font-bold">Version 1.0</p>
              </div>
              <div className="p-8 space-y-6 text-slate-300">
                <p className="text-sm leading-relaxed">
                  This is a free software for public use. It can be used in its current state but no commercial use is allowed nor using it nor derivate work.
                </p>
                <div className="p-5 bg-slate-950/50 rounded-2xl border border-slate-800 space-y-3">
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Developer</span>
                    <a href="https://github.com/safouaneelg" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 font-bold flex items-center gap-2">
                      <i className="fab fa-github"></i> safouaneelg
                    </a>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Project</span>
                    <span className="text-white font-bold">PolyPress 3D Viewer</span>
                  </div>
                </div>
              </div>
              <div className="p-8 bg-slate-950/50 flex justify-end">
                <button onClick={() => setIsAboutModalOpen(false)} className="px-8 py-3 bg-slate-800 hover:bg-slate-700 rounded-xl font-bold text-sm transition-all">Close</button>
              </div>
            </div>
          </div>
        )}

        {/* Donation Modal */}
        {isDonationModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 animate-in fade-in zoom-in-95 duration-300">
            <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-md" onClick={() => setIsDonationModalOpen(false)} />
            <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-[32px] overflow-hidden shadow-2xl">
              <div className="p-8 text-center space-y-6">
                <div className="w-20 h-20 bg-pink-600/10 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
                  <i className="fas fa-heart text-3xl text-pink-500"></i>
                </div>
                <div>
                  <h2 className="text-3xl font-black text-white uppercase tracking-tighter mb-2">Support Development</h2>
                  <p className="text-slate-400 text-sm">If you enjoy using PolyPress 3D Viewer, consider supporting the developer to keep this project alive and free.</p>
                </div>
                <a 
                  href="https://www.paypal.com/donate/?hosted_button_id=P8RJ86X48N364" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="w-full py-4 bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-500 hover:to-rose-500 text-white rounded-2xl font-black uppercase tracking-widest shadow-xl flex items-center justify-center gap-3 transition-all"
                >
                  <i className="fab fa-paypal"></i>
                  Donate via PayPal
                </a>
              </div>
              <div className="p-6 bg-slate-950/50 text-center">
                <button onClick={() => setIsDonationModalOpen(false)} className="text-slate-500 hover:text-white text-xs font-bold uppercase tracking-widest transition-all">Maybe Later</button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

const Toggle = ({ label, active, onToggle, icon }: any) => (
  <button 
    onClick={onToggle}
    className="w-full flex items-center justify-between group cursor-pointer"
  >
    <div className="flex items-center gap-3">
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${active ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-500 group-hover:bg-slate-700'}`}>
        <i className={`fas fa-${icon} text-[11px]`}></i>
      </div>
      <span className={`text-[11px] font-bold tracking-tight uppercase transition-colors ${active ? 'text-white' : 'text-slate-500 group-hover:text-slate-400'}`}>{label}</span>
    </div>
    <div className={`w-8 h-4 rounded-full relative transition-colors ${active ? 'bg-blue-600' : 'bg-slate-800'}`}>
      <div className={`absolute top-1 w-2 h-2 bg-white rounded-full transition-all ${active ? 'left-5' : 'left-1'}`} />
    </div>
  </button>
);

const CompressionToggle = ({ label, active, onToggle }: any) => (
  <button onClick={onToggle} className={`w-full p-4 rounded-2xl border-2 flex items-center justify-between ${active ? 'border-blue-600 bg-blue-600/10' : 'border-slate-800 bg-slate-800/30'}`}>
    <span className={`text-xs font-bold ${active ? 'text-white' : 'text-slate-500'}`}>{label}</span>
    <div className={`w-10 h-5 rounded-full relative transition-colors ${active ? 'bg-blue-600' : 'bg-slate-700'}`}>
      <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${active ? 'left-6' : 'left-1'}`} />
    </div>
  </button>
);

export default App;
