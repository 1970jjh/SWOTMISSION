
import React, { useEffect, useRef, useState } from 'react';

interface PreviewProps {
  htmlCode: string;
  prdContent?: string;
  isAppBuilt: boolean;
  onReset: () => void;
  onBuildApp: () => void;
  onBack: () => void;
}

const Preview: React.FC<PreviewProps> = ({ htmlCode, prdContent, isAppBuilt, onReset, onBuildApp, onBack }) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [device, setDevice] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  const [downloadedHTML, setDownloadedHTML] = useState(false);
  const [downloadedPRD, setDownloadedPRD] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    if (iframeRef.current) {
      const doc = iframeRef.current.contentDocument;
      if (doc) {
        doc.open();
        doc.write(htmlCode);
        doc.close();
        // Apply initial theme state
        if (isDarkMode) {
            doc.documentElement.classList.add('dark');
        } else {
            doc.documentElement.classList.remove('dark');
        }
      }
    }
  }, [htmlCode]);

  // Toggle theme inside the iframe
  const toggleTheme = () => {
    if (iframeRef.current && iframeRef.current.contentDocument) {
        const doc = iframeRef.current.contentDocument;
        doc.documentElement.classList.toggle('dark');
        setIsDarkMode(doc.documentElement.classList.contains('dark'));
    }
  };

  const handleDownloadHTML = () => {
    const blob = new Blob([htmlCode], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = isAppBuilt ? 'web-app.html' : 'web-app-ui.html';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    if (!isAppBuilt) setDownloadedHTML(true);
  };

  const handleDownloadPRD = () => {
    if (!prdContent) return;
    const blob = new Blob([prdContent], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'product-requirements.md';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setDownloadedPRD(true);
  };

  const getWidthClass = () => {
    switch (device) {
      case 'mobile': return 'max-w-[375px]';
      case 'tablet': return 'max-w-[768px]';
      default: return 'max-w-full';
    }
  };

  const canBuild = downloadedHTML && downloadedPRD;

  return (
    <div className="w-full h-screen flex flex-col bg-slate-950 overflow-hidden">
      {/* Toolbar */}
      <header className="flex-none flex items-center justify-between px-6 py-4 bg-slate-900 border-b border-slate-800 relative h-20 z-30">
        <div className="flex items-center gap-4 z-20">
          <button onClick={onBack} className="text-gray-400 hover:text-white flex items-center gap-1 text-sm">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/></svg>
            Back
          </button>
          
          <div className="flex bg-slate-800 rounded-lg p-1 border border-slate-700">
            <button onClick={() => setDevice('desktop')} className={`p-2 rounded ${device === 'desktop' ? 'bg-indigo-600 text-white' : 'text-gray-400'}`}>💻</button>
            <button onClick={() => setDevice('tablet')} className={`p-2 rounded ${device === 'tablet' ? 'bg-indigo-600 text-white' : 'text-gray-400'}`}>ipad</button>
            <button onClick={() => setDevice('mobile')} className={`p-2 rounded ${device === 'mobile' ? 'bg-indigo-600 text-white' : 'text-gray-400'}`}>📱</button>
          </div>

          <button 
            onClick={toggleTheme}
            className={`p-2 rounded-lg border border-slate-700 transition-colors ${isDarkMode ? 'bg-indigo-900/50 text-yellow-300 border-indigo-500' : 'bg-slate-800 text-gray-400 hover:text-white'}`}
            title="Toggle Preview Dark/Light Mode"
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

        <div className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center z-10 pointer-events-none hidden md:block">
            <h1 className="text-xl md:text-2xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-pink-400">
              {isAppBuilt ? 'Functional Web App Build' : 'Web App UI Preview'}
            </h1>
        </div>

        <div className="flex gap-3 z-20">
          {!isAppBuilt ? (
            <>
                <button
                    onClick={handleDownloadPRD}
                    className={`px-3 py-2 text-sm md:text-base md:px-4 rounded-lg font-bold transition-all flex items-center gap-2 ${downloadedPRD ? 'bg-gray-700 text-green-400' : 'bg-blue-600 hover:bg-blue-500 text-white'}`}
                >
                    <span className="hidden md:inline">📄 PRD 다운로드</span>
                    <span className="md:hidden">PRD</span>
                    {downloadedPRD && "✓"}
                </button>
                <button
                    onClick={handleDownloadHTML}
                    className={`px-3 py-2 text-sm md:text-base md:px-4 rounded-lg font-bold transition-all flex items-center gap-2 ${downloadedHTML ? 'bg-gray-700 text-green-400' : 'bg-green-600 hover:bg-green-500 text-white'}`}
                >
                    <span className="hidden md:inline">🌐 UI 코드 다운로드</span>
                    <span className="md:hidden">UI</span>
                    {downloadedHTML && "✓"}
                </button>
                
                <button
                    onClick={onBuildApp}
                    disabled={!canBuild}
                    className={`px-4 py-2 text-sm md:text-base md:px-6 rounded-lg font-bold transition-all flex items-center gap-2 border ${
                        canBuild 
                        ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-[0_0_15px_rgba(236,72,153,0.5)] border-transparent hover:scale-105' 
                        : 'bg-transparent border-gray-700 text-gray-600 cursor-not-allowed'
                    }`}
                >
                    {canBuild ? <><span className="hidden md:inline">🚀 웹앱 BUILD (AI Studio)</span><span className="md:hidden">BUILD</span></> : "다운로드 후 Build"}
                </button>
            </>
          ) : (
            <>
                <button onClick={handleDownloadHTML} className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold">
                    최종 앱 다운로드
                </button>
                <button onClick={onReset} className="px-4 py-2 text-gray-400 hover:text-white">
                    처음으로
                </button>
            </>
          )}
        </div>
      </header>

      {/* Iframe Container */}
      <div className="flex-1 bg-gray-900 relative flex justify-center items-center p-4 sm:p-8 overflow-hidden z-10">
        <div className={`bg-white transition-all duration-300 shadow-2xl ${getWidthClass()} w-full h-full rounded-md border-4 border-slate-800 relative overflow-hidden`}>
          <iframe
            ref={iframeRef}
            title="Generated Preview"
            className="w-full h-full border-0 bg-white"
            sandbox="allow-scripts allow-forms allow-same-origin allow-popups"
          />
        </div>
      </div>
      
      <footer className="flex-none py-4 text-center border-t border-slate-800 bg-slate-950 z-20 text-xs text-gray-500">
        @ Copy right by JJ Creative 교육연구소
      </footer>
    </div>
  );
};

export default Preview;
