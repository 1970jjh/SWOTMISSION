import React, { useState } from 'react';
import { ADDITIONAL_FEATURES } from '../constants';
import { FeatureItem } from '../types';

interface FeatureSelectorProps {
  onNext: (selectedFeatures: string[]) => void;
  onBack: () => void;
}

interface FeaturePreviewProps {
  feature: FeatureItem;
  isSelected: boolean;
  onToggle: (id: string) => void;
}

const FeaturePreview: React.FC<FeaturePreviewProps> = ({ feature, isSelected, onToggle }) => {
  // Mini visual simulation components based on feature ID
  const renderVisual = () => {
    switch (feature.id) {
      case 'scrollytelling':
        return (
          <div className="h-20 bg-slate-800 rounded-lg overflow-hidden relative flex flex-col gap-2 p-2">
            <div className="h-2 w-1/2 bg-slate-600 rounded animate-[fadeInUp_1.5s_infinite]"></div>
            <div className="h-2 w-3/4 bg-slate-700 rounded animate-[fadeInUp_1.5s_infinite_0.3s]"></div>
            <div className="h-2 w-full bg-slate-700 rounded animate-[fadeInUp_1.5s_infinite_0.6s]"></div>
          </div>
        );
      case 'parallax-scrolling':
        return (
          <div className="h-20 bg-slate-800 rounded-lg overflow-hidden relative flex items-center justify-center group">
            <div className="absolute inset-0 bg-[url('https://picsum.photos/seed/bg/100/100')] opacity-30 bg-cover group-hover:scale-110 transition-transform duration-[2s]"></div>
            <div className="w-8 h-8 bg-indigo-500 rounded shadow-lg z-10 group-hover:-translate-y-2 transition-transform duration-1000"></div>
          </div>
        );
      case 'svg-morphing':
        return (
          <div className="h-20 flex items-center justify-center">
             <div className="w-12 h-12 bg-indigo-500 rounded-md hover:rounded-full hover:bg-pink-500 transition-all duration-500 cursor-pointer flex items-center justify-center text-xs text-white">
               Hover
             </div>
          </div>
        );
      case 'kinetic-typography':
        return (
          <div className="h-20 bg-slate-800 rounded-lg overflow-hidden flex items-center relative">
             <div className="whitespace-nowrap animate-[marquee_5s_linear_infinite] text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-400 opacity-50">
                SCROLL SCROLL SCROLL SCROLL
             </div>
             <style>{`
               @keyframes marquee {
                 0% { transform: translateX(0); }
                 100% { transform: translateX(-100%); }
               }
             `}</style>
          </div>
        );
      case 'magnetic-buttons':
        return (
          <div className="h-20 flex items-center justify-center" onMouseMove={(e) => {
             const btn = e.currentTarget.querySelector('button');
             if(btn) {
                const rect = e.currentTarget.getBoundingClientRect();
                const x = e.clientX - rect.left - rect.width/2;
                const y = e.clientY - rect.top - rect.height/2;
                btn.style.transform = `translate(${x/3}px, ${y/3}px)`;
             }
          }} onMouseLeave={(e) => {
             const btn = e.currentTarget.querySelector('button');
             if(btn) btn.style.transform = 'translate(0,0)';
          }}>
             <button className="px-4 py-1 bg-indigo-500 rounded-full text-xs text-white transition-transform duration-100 pointer-events-none">
               Magnetic
             </button>
          </div>
        );
      case '3d-tilt':
        return (
           <div className="h-20 flex items-center justify-center perspective-[500px] group">
              <div className="w-16 h-12 bg-gradient-to-br from-slate-700 to-slate-900 border border-slate-600 rounded shadow-xl transform transition-transform duration-300 group-hover:rotate-x-12 group-hover:rotate-y-12 flex items-center justify-center text-[10px] text-gray-400">
                 Card
              </div>
           </div>
        );
      case 'custom-cursor':
        return (
          <div className="h-20 bg-slate-800 rounded-lg relative overflow-hidden cursor-none group">
             <div className="absolute top-1/2 left-1/2 w-3 h-3 bg-white rounded-full mix-blend-difference pointer-events-none group-hover:scale-[3] transition-transform duration-200"></div>
             <div className="absolute inset-0 flex items-center justify-center text-xs text-gray-500">
                Hover Me
             </div>
          </div>
        );
      case 'dark-mode':
        return (
          <div className="h-20 rounded-lg flex items-center justify-center transition-colors duration-500 bg-white text-black hover:bg-slate-900 hover:text-white cursor-pointer relative group">
             <span className="text-xs font-bold">Toggle</span>
             <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-yellow-400 group-hover:bg-slate-700"></div>
          </div>
        );
      case 'skeleton-loading':
        return (
          <div className="h-20 bg-slate-800 rounded-lg p-3 space-y-2">
             <div className="h-2 w-1/3 bg-slate-700 rounded animate-pulse"></div>
             <div className="h-2 w-full bg-slate-700 rounded animate-pulse"></div>
             <div className="h-2 w-2/3 bg-slate-700 rounded animate-pulse"></div>
          </div>
        );
      default:
        return <div className="h-20 bg-slate-800 rounded-lg"></div>;
    }
  };

  return (
    <div 
      onClick={() => onToggle(feature.id)}
      className={`relative border rounded-xl p-4 cursor-pointer transition-all duration-200 group overflow-hidden ${
        isSelected 
          ? 'bg-indigo-900/20 border-indigo-500 ring-1 ring-indigo-500' 
          : 'bg-slate-900 border-slate-700 hover:border-slate-500'
      }`}
    >
      <div className="flex justify-between items-start mb-3">
        <h3 className={`font-bold text-sm ${isSelected ? 'text-indigo-400' : 'text-white'}`}>
          {feature.name}
        </h3>
        <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${
          isSelected ? 'bg-indigo-500 border-indigo-500' : 'border-slate-600 bg-slate-800'
        }`}>
          {isSelected && (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 text-white" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          )}
        </div>
      </div>
      
      {/* Visual Preview Area */}
      <div className="mb-3 pointer-events-none">
        {renderVisual()}
      </div>

      <p className="text-xs text-gray-400 leading-relaxed">
        {feature.description}
      </p>
    </div>
  );
};

const FeatureSelector: React.FC<FeatureSelectorProps> = ({ onNext, onBack }) => {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const toggleFeature = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const categories = [
    { id: 'Motion', title: 'Motion & Animation', desc: '움직임과 전환으로 시선을 사로잡습니다.' },
    { id: 'Interaction', title: 'Micro-interactions', desc: '사용자의 행동에 반응하는 디테일입니다.' },
    { id: 'Utility', title: 'Functional Utility', desc: '웹사이트의 편의성을 높여주는 기능입니다.' },
  ];

  return (
    <div className="w-full max-w-6xl mx-auto px-4 py-8">
      <div className="text-center mb-10">
        <h2 className="text-3xl font-bold text-white mb-3">추가 기능 선택</h2>
        <p className="text-gray-400">
          웹사이트에 적용하고 싶은 특별한 인터랙션과 기능을 선택해주세요. (복수 선택 가능)
        </p>
      </div>

      <div className="space-y-12">
        {categories.map((cat) => (
          <div key={cat.id} className="animate-fade-in-up">
            <div className="mb-6 flex items-end gap-3 border-b border-slate-800 pb-2">
              <h3 className="text-xl font-bold text-indigo-400">{cat.title}</h3>
              <span className="text-sm text-gray-500 mb-1">{cat.desc}</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {ADDITIONAL_FEATURES.filter(f => f.category === cat.id).map(feature => (
                <FeaturePreview 
                  key={feature.id} 
                  feature={feature} 
                  isSelected={selectedIds.includes(feature.id)}
                  onToggle={toggleFeature}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-slate-950/90 backdrop-blur-md border-t border-slate-800 z-50">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="text-sm text-gray-400">
            <span className="text-white font-bold text-lg mr-1">{selectedIds.length}</span>개의 기능 선택됨
          </div>
          <div className="flex gap-4">
            <button
              onClick={onBack}
              className="px-6 py-2 border border-slate-700 text-gray-300 rounded-lg hover:bg-slate-800 transition-colors"
            >
              이전 단계
            </button>
            <button
              onClick={() => onNext(selectedIds)}
              className="px-8 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold shadow-lg shadow-indigo-600/30 transition-all flex items-center gap-2"
            >
              다음: 상세 내용 입력
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </button>
          </div>
        </div>
      </div>
      <div className="h-20"></div> {/* Spacer for fixed bottom bar */}
    </div>
  );
};

export default FeatureSelector;