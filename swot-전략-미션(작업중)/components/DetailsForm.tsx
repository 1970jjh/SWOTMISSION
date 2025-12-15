

import React, { useState, useRef, useEffect } from 'react';
import { LandingPageStyle, UserRequirements, UploadedFile } from '../types';
import { AUTO_GEN_CATEGORIES } from '../constants';

interface DetailsFormProps {
  selectedStyle: LandingPageStyle;
  selectedDevices: string[];
  onSubmit: (data: UserRequirements) => void;
  onBack: () => void;
}

const DetailsForm: React.FC<DetailsFormProps> = ({ selectedStyle, selectedDevices, onSubmit, onBack }) => {
  // Default to selecting theme_system if not present
  const [formData, setFormData] = useState<UserRequirements>({
    appName: '',
    keyFeatures: '',
    targetUser: '',
    targetDevices: selectedDevices,
    autoGenerationOptions: ['theme_system'], // Default include Dark Mode support
    headerNavItems: '',
    referenceContent: '',
    otherRequests: '',
    uploadedFiles: [],
    selectedFeatureIds: [],
  });
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleCheckboxChange = (id: string) => {
    setFormData(prev => {
        const options = prev.autoGenerationOptions.includes(id)
            ? prev.autoGenerationOptions.filter(opt => opt !== id)
            : [...prev.autoGenerationOptions, id];
        return { ...prev, autoGenerationOptions: options };
    });
  };

  const readFileAsBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleFiles = async (files: FileList | null) => {
    if (!files) return;
    const newFiles = Array.from(files);
    if (formData.uploadedFiles.length + newFiles.length > 20) {
      alert('최대 20개 파일까지만 업로드 가능합니다.');
      return;
    }
    const processedFiles: UploadedFile[] = [];
    for (const file of newFiles) {
      try {
        const base64 = await readFileAsBase64(file);
        processedFiles.push({
          name: file.name,
          mimeType: file.type || 'application/octet-stream',
          data: base64,
        });
      } catch (err) {
        console.error("Error reading file", file.name, err);
      }
    }
    setFormData(prev => ({ ...prev, uploadedFiles: [...prev.uploadedFiles, ...processedFiles] }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFiles(e.target.files);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  };

  const handleRemoveFile = (index: number) => {
    setFormData(prev => ({
      ...prev,
      uploadedFiles: prev.uploadedFiles.filter((_, i) => i !== index)
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.appName) {
      alert('앱 이름은 필수 입력 항목입니다.');
      return;
    }
    if (!formData.targetUser) {
        alert('주된 사용자는 필수 입력 항목입니다.');
        return;
    }
    onSubmit(formData);
  };

  return (
    <div className="w-full max-w-4xl mx-auto px-4 py-8">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-xl">
        <div className="mb-8 text-center">
          <span className="inline-block px-3 py-1 bg-indigo-500/10 text-indigo-400 rounded-full text-xs font-semibold mb-3">
            선택된 스타일: {selectedStyle.name}
          </span>
          <h2 className="text-3xl font-bold text-white">모바일 앱 기획</h2>
          <p className="text-gray-400 mt-2">
            AI가 완벽한 앱(PWA)을 설계할 수 있도록 세부 정보를 알려주세요.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          
          {/* Section 1: Core Info */}
          <div className="space-y-4">
              <h3 className="text-lg font-bold text-white border-b border-slate-700 pb-2">기본 정보</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      앱 이름 (App Name) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="appName"
                      value={formData.appName}
                      onChange={handleChange}
                      placeholder="예: MyDailyHealth"
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      주된 사용자 (Target User) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="targetUser"
                      value={formData.targetUser}
                      onChange={handleChange}
                      placeholder="예: 20대 대학생, 배달 라이더, 헬스 매니아"
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                      required
                    />
                  </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  핵심 기능 및 서비스 설명
                </label>
                <textarea
                  name="keyFeatures"
                  value={formData.keyFeatures}
                  onChange={handleChange}
                  rows={3}
                  placeholder="예: 매일 마신 물 기록, 푸시 알림으로 물 마시기 알림, 주간 통계 그래프 확인"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
                />
              </div>
          </div>

          {/* Section 2: Auto Generation Options (Categorized) */}
          <div className="space-y-6">
              <h3 className="text-lg font-bold text-white border-b border-slate-700 pb-2">기능 및 연동 옵션 (모바일)</h3>
              <p className="text-sm text-gray-400">앱에 필요한 기능들을 선택하세요. (다크모드는 기본 권장사항입니다)</p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {AUTO_GEN_CATEGORIES.map(category => (
                    <div key={category.id} className="bg-slate-950/50 p-4 rounded-xl border border-slate-800">
                        <h4 className="text-sm font-bold text-indigo-400 mb-3 uppercase tracking-wider">{category.title}</h4>
                        <div className="grid grid-cols-1 gap-2">
                            {category.items.map(opt => (
                                <div 
                                    key={opt.id} 
                                    onClick={() => handleCheckboxChange(opt.id)}
                                    className={`cursor-pointer border rounded-lg p-3 text-xs flex items-center justify-between transition-all ${
                                        formData.autoGenerationOptions.includes(opt.id)
                                        ? 'bg-indigo-600 border-indigo-500 text-white font-semibold'
                                        : 'bg-slate-900 border-slate-700 text-gray-400 hover:border-slate-500 hover:bg-slate-800'
                                    }`}
                                >
                                    <span>{opt.label}</span>
                                    {formData.autoGenerationOptions.includes(opt.id) && (
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/></svg>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
              </div>
          </div>

          {/* Section 3: Detailed Content */}
          <div className="space-y-4">
              <h3 className="text-lg font-bold text-white border-b border-slate-700 pb-2">상세 내용 (선택)</h3>
              
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  앱 하단 탭 메뉴 (Bottom Navigation)
                </label>
                <input
                  type="text"
                  name="headerNavItems"
                  value={formData.headerNavItems}
                  onChange={handleChange}
                  placeholder="예: 홈, 검색, 기록, 내정보"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  참고 자료 텍스트
                </label>
                <textarea
                  name="referenceContent"
                  value={formData.referenceContent}
                  onChange={handleChange}
                  rows={4}
                  placeholder="앱에 들어갈 구체적인 텍스트 내용이나 설명을 자유롭게 입력하세요."
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  파일 업로드 (기획안, 로고 등)
                </label>
                <div
                  onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
                    isDragging 
                      ? 'border-indigo-500 bg-indigo-500/10' 
                      : 'border-slate-700 hover:border-indigo-400 hover:bg-slate-800'
                  }`}
                >
                  <input type="file" multiple ref={fileInputRef} onChange={handleFileChange} className="hidden" />
                  <p className="text-gray-400">파일 클릭 또는 드래그</p>
                </div>
                {formData.uploadedFiles.length > 0 && (
                  <div className="mt-2 text-sm text-indigo-400">
                    {formData.uploadedFiles.length}개 파일 업로드됨
                  </div>
                )}
              </div>
          </div>

          <div className="flex gap-4 pt-6 border-t border-slate-800">
            <button
              type="button"
              onClick={onBack}
              className="flex-1 px-6 py-3 border border-slate-700 text-gray-300 rounded-lg hover:bg-slate-800 transition-colors font-medium"
            >
              뒤로가기
            </button>
            <button
              type="submit"
              className="flex-1 px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-lg transition-all font-bold shadow-lg transform hover:translate-y-[-2px]"
            >
              모바일 앱 UI & PRD 생성 (Gemini 3.0)
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default DetailsForm;