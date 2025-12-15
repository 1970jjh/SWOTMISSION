

import React, { useState, useEffect } from 'react';
import { LANDING_PAGE_STYLES, TARGET_DEVICES } from '../constants';
import { LandingPageStyle } from '../types';

interface StyleSelectorProps {
  onSelect: (style: LandingPageStyle, devices: string[]) => void;
}

// Helper: Get Tailwind classes for specific styles
const getStyleTheme = (styleId: string) => {
  const base = {
    wrapper: "w-full h-full overflow-y-auto transition-colors duration-300 relative",
    nav: "w-full px-4 py-3 flex justify-between items-center",
    hero: "px-4 py-8 flex flex-col items-center text-center gap-4",
    cardContainer: "px-4 py-4 grid gap-3",
    card: "p-4 rounded-xl flex flex-col gap-2 min-h-[100px]",
    heading: "text-2xl font-bold",
    text: "text-sm opacity-80",
    button: "px-6 py-2 rounded-lg font-bold transition-transform active:scale-95",
    bottomNav: "h-16 w-full border-t flex justify-around items-center px-2",
    bgDecor: null as React.ReactNode,
  };

  switch (styleId) {
    case 'dynamic-glassmorphism':
      return {
        ...base,
        wrapper: "bg-white dark:bg-slate-900 text-slate-900 dark:text-white",
        bgDecor: (
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute top-[-10%] left-[-10%] w-[80%] h-[40%] bg-purple-600 rounded-full blur-[80px] opacity-20 dark:opacity-40 animate-pulse"></div>
            <div className="absolute bottom-[10%] right-[-10%] w-[80%] h-[40%] bg-blue-600 rounded-full blur-[80px] opacity-20 dark:opacity-40 animate-pulse delay-700"></div>
          </div>
        ),
        nav: "backdrop-blur-md bg-white/50 dark:bg-white/5 sticky top-0 z-20",
        card: "backdrop-blur-lg bg-white/40 dark:bg-white/10 border border-white/20 shadow-sm",
        bottomNav: "backdrop-blur-xl bg-white/60 dark:bg-black/40 border-t border-white/10 sticky bottom-0 z-20",
        button: "bg-indigo-600 dark:bg-white/20 text-white",
      };
    case 'ios-clean':
      return {
        ...base,
        wrapper: "bg-[#F2F2F7] dark:bg-black text-black dark:text-white",
        nav: "bg-white/90 dark:bg-[#1C1C1E]/90 backdrop-blur border-b border-gray-200 dark:border-gray-800 sticky top-0 z-20",
        card: "bg-white dark:bg-[#1C1C1E] rounded-2xl shadow-sm",
        bottomNav: "bg-white/90 dark:bg-[#1C1C1E]/90 backdrop-blur border-t border-gray-200 dark:border-gray-800 sticky bottom-0",
        button: "bg-[#007AFF] text-white rounded-full",
      };
    case 'material-3':
      return {
        ...base,
        wrapper: "bg-[#fffbfe] dark:bg-[#1c1b1f] text-[#1c1b1f] dark:text-[#e6e1e5]",
        nav: "bg-[#fffbfe] dark:bg-[#1c1b1f] sticky top-0 z-20",
        card: "bg-[#f3edf7] dark:bg-[#2a2930] rounded-[16px] shadow-sm",
        bottomNav: "bg-[#f3edf7] dark:bg-[#2a2930] sticky bottom-0",
        button: "bg-[#6750a4] text-white rounded-full",
      };
    case 'bento-mobile':
      return {
        ...base,
        wrapper: "bg-gray-50 dark:bg-[#111] text-gray-900 dark:text-white",
        card: "bg-white dark:bg-[#1e1e1e] rounded-3xl border border-gray-100 dark:border-[#333] shadow-sm",
        bottomNav: "bg-white dark:bg-[#1e1e1e] border-t border-gray-200 dark:border-[#333] sticky bottom-0",
        button: "bg-black dark:bg-white text-white dark:text-black rounded-full",
      };
    case 'dark-neon':
      return {
        ...base,
        wrapper: "bg-gray-100 dark:bg-black text-slate-900 dark:text-[#0ff]",
        nav: "bg-white dark:bg-black border-b border-gray-300 dark:border-[#0ff]/30 sticky top-0 z-20",
        card: "bg-white dark:bg-[#050505] border border-gray-300 dark:border-[#0ff]/50 shadow-[0_0_5px_rgba(0,0,0,0.1)] dark:shadow-[0_0_10px_#0ff]",
        bottomNav: "bg-white dark:bg-black border-t border-gray-300 dark:border-[#0ff]/30 sticky bottom-0",
        button: "bg-[#0ff] text-black font-bold",
      };
    case 'neumorphism':
        return {
          ...base,
          wrapper: "bg-[#e0e5ec] dark:bg-[#2d3436] text-[#4d5565] dark:text-[#dfe6e9]",
          nav: "bg-[#e0e5ec] dark:bg-[#2d3436] z-10 sticky top-0",
          card: "bg-[#e0e5ec] dark:bg-[#2d3436] rounded-[20px] shadow-[9px_9px_16px_rgb(163,177,198,0.6),-9px_-9px_16px_rgba(255,255,255,0.5)] dark:shadow-[5px_5px_10px_#222,-5px_-5px_10px_#3a3a3a]",
          bottomNav: "bg-[#e0e5ec] dark:bg-[#2d3436] sticky bottom-0 shadow-[0_-5px_10px_rgba(163,177,198,0.3)] dark:shadow-[0_-5px_10px_rgba(0,0,0,0.2)]",
          button: "bg-[#e0e5ec] dark:bg-[#2d3436] rounded-full shadow-[5px_5px_10px_#b8b9be,-5px_-5px_10px_#ffffff] dark:shadow-[5px_5px_10px_#222,-5px_-5px_10px_#3a3a3a] text-indigo-500",
        };
    default:
      return {
        ...base,
        wrapper: "bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white",
        nav: "bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 sticky top-0",
        card: "bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm",
        bottomNav: "bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 sticky bottom-0",
        button: "bg-indigo-600 text-white",
      };
  }
};

const StyleSimulation = ({ styleId, device, isDarkMode }: { styleId: string, device: 'mobile' | 'tablet' | 'desktop', isDarkMode: boolean }) => {
  const theme = getStyleTheme(styleId);

  // Device layout adjustments
  const getLayout = () => {
    switch (device) {
      case 'mobile':
        return {
          grid: "grid-cols-1",
          heroText: "text-2xl",
          container: "w-full",
        };
      case 'tablet':
        return {
          grid: "grid-cols-2",
          heroText: "text-3xl",
          container: "w-full",
        };
      case 'desktop':
        return {
          grid: "grid-cols-3",
          heroText: "text-4xl",
          container: "max-w-4xl mx-auto", // Center content on desktop like a web app
        };
    }
  };

  const layout = getLayout();

  return (
    // Wrap with conditional dark class
    <div className={`h-full w-full ${isDarkMode ? 'dark' : ''}`}>
        <div className={`${theme.wrapper} relative h-full flex flex-col`}>
        {theme.bgDecor}
        
        {/* Mobile App Header */}
        <nav className={theme.nav}>
            <div className="font-bold text-lg flex items-center gap-2">
                <span>MyApp</span>
            </div>
            <div className="flex gap-2">
                <div className="w-8 h-8 rounded-full bg-current opacity-10"></div>
            </div>
        </nav>

        {/* Scrollable Content Area */}
        <div className="flex-1 overflow-y-auto">
            {/* Hero / Welcome */}
            <header className={`${theme.hero}`}>
                <h1 className={`${theme.heading} ${layout.heroText}`}>
                Hello, User
                </h1>
                <p className={`${theme.text} max-w-xs mx-auto mb-2`}>
                Your daily feed looks great today.
                </p>
                <div className="flex gap-2 justify-center">
                    <button className={`${theme.button} text-xs`}>Action</button>
                    <button className={`opacity-60 text-xs px-4 py-2`}>Skip</button>
                </div>
            </header>

            {/* Content Grid */}
            <div className={`${theme.cardContainer} ${layout.grid} ${layout.container}`}>
                {[1, 2, 3, 4].map((i) => (
                <div key={i} className={theme.card}>
                    <div className="flex justify-between items-start">
                        <div className="w-8 h-8 rounded-lg bg-current opacity-20 mb-1"></div>
                        <div className="w-4 h-4 rounded-full bg-green-500 opacity-50"></div>
                    </div>
                    <h3 className="font-bold text-base">App Widget {i}</h3>
                    <p className={theme.text}>
                    Real-time data for mobile view.
                    </p>
                </div>
                ))}
            </div>
            <div className="h-4"></div>
        </div>
        
        {/* Bottom Navigation (Mobile First) */}
        <footer className={theme.bottomNav}>
            <div className="flex flex-col items-center opacity-100 text-indigo-500 dark:text-indigo-400">
                <div className="w-5 h-5 bg-current rounded-sm mb-1"></div>
                <span className="text-[10px] font-bold">Home</span>
            </div>
            <div className="flex flex-col items-center opacity-50">
                <div className="w-5 h-5 bg-current rounded-sm mb-1"></div>
                <span className="text-[10px]">Search</span>
            </div>
            <div className="flex flex-col items-center opacity-50">
                <div className="w-5 h-5 bg-current rounded-sm mb-1"></div>
                <span className="text-[10px]">Saved</span>
            </div>
            <div className="flex flex-col items-center opacity-50">
                <div className="w-5 h-5 bg-current rounded-full mb-1"></div>
                <span className="text-[10px]">Profile</span>
            </div>
        </footer>
        </div>
    </div>
  );
};

const StyleSelector: React.FC<StyleSelectorProps> = ({ onSelect }) => {
  const [previewStyle, setPreviewStyle] = useState<LandingPageStyle | null>(null);
  const [selectedDevices, setSelectedDevices] = useState<string[]>(['mobile']);
  const [previewDevice, setPreviewDevice] = useState<'mobile' | 'tablet' | 'desktop'>('mobile');
  const [isDarkMode, setIsDarkMode] = useState(false);

  const toggleDevice = (id: string) => {
    setSelectedDevices(prev => 
      prev.includes(id) ? prev.filter(d => d !== id) : [...prev, id]
    );
  };

  const handleConfirmSelect = () => {
    if (previewStyle) {
      if (selectedDevices.length === 0) {
        alert("최소 하나의 주된 사용 기기를 선택해주세요.");
        return;
      }
      onSelect(previewStyle, selectedDevices);
      setPreviewStyle(null);
    }
  };

  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    e.currentTarget.src = "https://placehold.co/600x400/1e293b/FFF?text=App+Style+Preview";
  };

  const getPreviewWidth = () => {
    switch (previewDevice) {
      case 'mobile': return 'w-[375px]';
      case 'tablet': return 'w-[768px]';
      default: return 'w-full';
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-4 py-8">
      {/* 1. Usage Instructions Section */}
      <div className="mb-16 bg-gradient-to-r from-slate-900 to-indigo-950/30 border border-slate-800 rounded-2xl p-8 relative overflow-hidden shadow-2xl">
        <div className="absolute top-0 right-0 p-4 opacity-10">
          <svg className="w-64 h-64 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M17 1.01L7 1c-1.1 0-2 .9-2 2v18c0 1.1.9 2 2 2h10c1.1 0 2-.9 2-2V3c0-1.1-.9-1.99-2-1.99zM17 19H7V5h10v14z"/></svg>
        </div>
        
        <div className="relative z-10">
          <h2 className="text-2xl font-bold text-white mb-6 text-center">📱 나만의 모바일 웹앱 만들기</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
            <div className="flex flex-col items-center">
              <div className="w-16 h-16 bg-indigo-600/20 text-indigo-400 rounded-2xl flex items-center justify-center mb-4 border border-indigo-500/30">
                <span className="text-2xl font-bold">1</span>
              </div>
              <h3 className="text-lg font-bold text-white mb-2">앱 스타일 & 테마</h3>
              <p className="text-gray-400 text-sm">모바일 앱 디자인 스타일과<br/>타겟 디바이스를 선택하세요.</p>
            </div>
            <div className="flex flex-col items-center">
              <div className="w-16 h-16 bg-purple-600/20 text-purple-400 rounded-2xl flex items-center justify-center mb-4 border border-purple-500/30">
                <span className="text-2xl font-bold">2</span>
              </div>
              <h3 className="text-lg font-bold text-white mb-2">앱 기능 정의</h3>
              <p className="text-gray-400 text-sm">앱 이름, 핵심 기능,<br/>다크모드 등 옵션을 설정하세요.</p>
            </div>
            <div className="flex flex-col items-center">
              <div className="w-16 h-16 bg-green-600/20 text-green-400 rounded-2xl flex items-center justify-center mb-4 border border-green-500/30">
                <span className="text-2xl font-bold">3</span>
              </div>
              <h3 className="text-lg font-bold text-white mb-2">앱 생성 & BUILD</h3>
              <p className="text-gray-400 text-sm">모바일 UI와 PRD를 생성하고<br/>작동하는 웹앱을 빌드하세요.</p>
            </div>
          </div>
        </div>
      </div>

      <div className="mb-10 text-center">
        <h2 className="text-3xl font-bold text-white mb-6">타겟 디바이스 (중복 가능)</h2>
        <div className="flex justify-center gap-4 flex-wrap">
          {TARGET_DEVICES.map((device) => (
             <button
               key={device.id}
               onClick={() => toggleDevice(device.id)}
               className={`flex items-center gap-3 px-6 py-4 rounded-xl border-2 transition-all duration-200 ${
                 selectedDevices.includes(device.id)
                   ? 'bg-indigo-600/20 border-indigo-500 text-white shadow-[0_0_15px_rgba(99,102,241,0.3)]'
                   : 'bg-slate-900 border-slate-700 text-gray-400 hover:border-slate-500'
               }`}
             >
                <span className="text-2xl">{device.icon}</span>
                <span className="font-bold">{device.label}</span>
                {selectedDevices.includes(device.id) && (
                   <div className="w-2 h-2 rounded-full bg-green-400 ml-2 animate-pulse"></div>
                )}
             </button>
          ))}
        </div>
      </div>

      <div className="mb-8 text-center border-t border-slate-800 pt-10">
        <h2 className="text-3xl font-bold text-white mb-3">모바일 앱 디자인 스타일</h2>
        <p className="text-gray-400">
          원하는 앱 테마를 선택하여 모바일/다크모드 미리보기를 확인하세요.
        </p>
      </div>

      {/* Style Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {LANDING_PAGE_STYLES.map((style) => (
          <div
            key={style.id}
            onClick={() => {
                setPreviewStyle(style);
                setIsDarkMode(false); // Reset to light mode default on open
            }}
            className="group cursor-pointer bg-slate-900 border border-slate-800 rounded-xl overflow-hidden hover:border-indigo-500 hover:shadow-lg hover:shadow-indigo-500/20 transition-all duration-300 transform hover:-translate-y-1"
          >
            <div className="h-48 overflow-hidden relative">
              <img
                src={style.imageUrl}
                alt={style.name}
                referrerPolicy="no-referrer"
                onError={handleImageError}
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110 opacity-80 group-hover:opacity-100"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-transparent to-transparent opacity-60" />
              <div className="absolute bottom-2 right-2 bg-black/60 backdrop-blur-sm px-2 py-1 rounded text-xs text-white">
                앱 미리보기
              </div>
            </div>
            <div className="p-5">
              <h3 className="text-xl font-bold text-white mb-2 group-hover:text-indigo-400 transition-colors">
                {style.name}
              </h3>
              <p className="text-sm text-gray-400 leading-relaxed line-clamp-2">
                {style.description}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* 2. Style Preview Modal */}
      {previewStyle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div 
            className="bg-slate-900 border border-slate-700 rounded-2xl max-w-6xl w-full h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-scale-up"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="bg-slate-800 px-4 py-3 flex items-center justify-between border-b border-slate-700 shrink-0">
               <div className="flex items-center gap-4">
                  <div className="flex gap-2">
                    <div className="w-3 h-3 rounded-full bg-red-500"></div>
                    <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                    <div className="w-3 h-3 rounded-full bg-green-500"></div>
                  </div>
                  <span className="text-sm font-mono text-gray-400 hidden sm:block">App Simulation</span>
               </div>

               {/* Center Controls */}
               <div className="flex items-center gap-4">
                   {/* Device Toggles */}
                   <div className="flex bg-slate-950 rounded-lg p-1 border border-slate-700">
                      <button onClick={() => setPreviewDevice('mobile')} className={`p-2 rounded ${previewDevice === 'mobile' ? 'bg-indigo-600 text-white' : 'text-gray-400'}`}>📱</button>
                      <button onClick={() => setPreviewDevice('tablet')} className={`p-2 rounded ${previewDevice === 'tablet' ? 'bg-indigo-600 text-white' : 'text-gray-400'}`}>ipad</button>
                      <button onClick={() => setPreviewDevice('desktop')} className={`p-2 rounded ${previewDevice === 'desktop' ? 'bg-indigo-600 text-white' : 'text-gray-400'}`}>💻</button>
                   </div>
                   
                   {/* Theme Toggle */}
                   <button 
                    onClick={() => setIsDarkMode(!isDarkMode)}
                    className={`p-2 rounded-lg border transition-colors ${isDarkMode ? 'bg-indigo-900/50 text-yellow-300 border-indigo-500' : 'bg-slate-200 text-gray-600 border-slate-300'}`}
                    title="Toggle Preview Theme"
                   >
                     {isDarkMode ? (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                        </svg>
                     ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                        </svg>
                     )}
                   </button>
               </div>

               <button 
                onClick={() => setPreviewStyle(null)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
              {/* Left: Responsive Mockup Renderer */}
              <div className="flex-1 bg-slate-950 relative border-b md:border-b-0 md:border-r border-slate-700 flex justify-center overflow-auto p-4 md:p-8">
                <div 
                    className={`transition-all duration-300 shadow-2xl overflow-hidden bg-white relative mx-auto ${getPreviewWidth()} aspect-[9/16] md:aspect-auto md:h-full border-[10px] border-slate-800 rounded-[30px]`}
                    style={{ minHeight: previewDevice === 'mobile' ? '667px' : previewDevice === 'tablet' ? '1024px' : 'auto' }}
                >
                    {/* Live Component Simulation */}
                    <StyleSimulation styleId={previewStyle.id} device={previewDevice} isDarkMode={isDarkMode} />
                </div>
              </div>

              {/* Right: Details & Action */}
              <div className="w-full md:w-[350px] p-6 flex flex-col bg-slate-900 overflow-y-auto shrink-0 border-l border-slate-800">
                <div className="mb-auto">
                  <span className="inline-block px-3 py-1 bg-indigo-500/10 text-indigo-400 rounded-full text-xs font-semibold mb-3 border border-indigo-500/20">
                    Selected Theme
                  </span>
                  <h2 className="text-xl md:text-2xl font-bold text-white mb-2">
                    {previewStyle.name}
                  </h2>
                  <p className="text-sm text-gray-300 leading-relaxed mb-6">
                    {previewStyle.description}
                  </p>
                  
                  <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700 mb-6">
                    <h4 className="text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider">Configuration</h4>
                    <div className="space-y-2">
                        <div className="flex justify-between text-sm text-gray-300">
                            <span>Target Devices:</span>
                            <span className="text-white font-bold">{selectedDevices.length} selected</span>
                        </div>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-3 pt-6 border-t border-slate-800">
                  <button
                    onClick={handleConfirmSelect}
                    className="w-full px-6 py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl transition-all font-bold shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 transform hover:scale-[1.02]"
                  >
                    <span>이 스타일로 앱 만들기</span>
                  </button>
                  <button
                    onClick={() => setPreviewStyle(null)}
                    className="w-full px-6 py-3 border border-slate-700 text-gray-400 rounded-xl hover:bg-slate-800 hover:text-white transition-colors font-medium text-sm"
                  >
                    다른 스타일 보기
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StyleSelector;