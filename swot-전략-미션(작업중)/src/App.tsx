
import React, { useState, useEffect, useRef } from 'react';
import { Room, Team, ADMIN_PW, Match, RoundStrategy, RoundResult, CARDS, TOTAL_ROUNDS, TOTAL_CHIPS } from './types';
import { generateSWOTAnalysis, generateWinnerPoster, getGameAdvice } from './services/geminiService';
import MatrixBackground from './components/MatrixBackground';

declare var html2pdf: any; // Declare global for CDN library

// --- Helper Functions ---
const saveRooms = (rooms: Room[]) => {
    localStorage.setItem('swot_game_rooms', JSON.stringify(rooms));
    window.dispatchEvent(new Event('storage')); // Trigger update in other tabs
};

const getRooms = (): Room[] => {
    const data = localStorage.getItem('swot_game_rooms');
    return data ? JSON.parse(data) : [];
};

const speak = (text: string) => {
    if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = /[ㄱ-ㅎ|ㅏ-ㅣ|가-힣]/.test(text) ? 'ko-KR' : 'en-US';
        utterance.rate = 1.0;
        utterance.pitch = 1.0;
        window.speechSynthesis.speak(utterance);
    }
};

// --- Custom Drag & Drop Hooks & Components ---
interface DragItem {
    type: 'CARD' | 'TEAM';
    data: any;
    source?: string; // 'deck' or round index (0-9)
}

const DragOverlay = () => {
    const [pos, setPos] = useState({ x: 0, y: 0 });
    const [item, setItem] = useState<DragItem | null>(null);

    useEffect(() => {
        const handleMove = (e: PointerEvent) => {
            if (item) setPos({ x: e.clientX, y: e.clientY });
        };
        const handleUp = () => setItem(null);

        window.addEventListener('pointermove', handleMove);
        window.addEventListener('pointerup', handleUp);
        return () => {
            window.removeEventListener('pointermove', handleMove);
            window.removeEventListener('pointerup', handleUp);
        };
    }, [item]);

    useEffect(() => {
        const startHandler = (e: any) => {
            if (e.detail) {
                setItem(e.detail.item);
                setPos({ x: e.detail.x, y: e.detail.y });
            }
        };
        window.addEventListener('swot-drag-start', startHandler);
        return () => window.removeEventListener('swot-drag-start', startHandler);
    }, []);

    if (!item) return null;

    return (
        <div 
            className="fixed pointer-events-none z-[9999] opacity-90"
            style={{ 
                left: pos.x, 
                top: pos.y, 
                transform: 'translate(-50%, -50%)' 
            }}
        >
            {item.type === 'CARD' && (
                 <div className={`w-14 h-20 rounded-md shadow-2xl flex items-center justify-center text-3xl font-black ${item.data % 2 === 0 ? 'bg-slate-900 text-white border-2 border-white' : 'bg-white text-slate-900 border-2 border-slate-300'}`}>
                    {item.data}
                </div>
            )}
            {item.type === 'TEAM' && (
                <div className="px-4 py-2 bg-indigo-600 text-white font-bold rounded-lg shadow-xl">
                    {item.data.name}
                </div>
            )}
        </div>
    );
};

// --- Sub-Components ---

const FileUpload = ({ onUpload }: { onUpload: (base64s: string[]) => void }) => {
    const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (files && files.length > 0) {
            const promises = Array.from(files).map(file => {
                return new Promise<string>((resolve) => {
                    const reader = new FileReader();
                    reader.onloadend = () => resolve(reader.result as string);
                    reader.readAsDataURL(file);
                });
            });
            const results = await Promise.all(promises);
            onUpload(results);
        }
    };

    return (
        <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-indigo-500/50 border-dashed rounded-xl cursor-pointer bg-slate-50/50 dark:bg-slate-800/50 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-all">
            <div className="flex flex-col items-center justify-center pt-5 pb-6">
                <svg className="w-8 h-8 mb-2 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path></svg>
                <p className="text-sm text-gray-500 dark:text-gray-400"><span className="font-semibold">클릭하여 사진 업로드 (다중 가능)</span></p>
            </div>
            <input type="file" className="hidden" accept="image/*" multiple onChange={handleFile} />
        </label>
    );
};

const getCardStyle = (num: number, isSelectionArea = false, hidden = false) => {
    if (num === -1) return 'bg-slate-200/80 dark:bg-slate-700/50 text-slate-400 dark:text-slate-500 border-slate-300 dark:border-slate-600 border-dashed'; 
    const isEven = num % 2 === 0;
    let style = "";
    if (isEven) {
        style = 'bg-slate-900 text-white border-slate-600';
        if (isSelectionArea) style += ' border-2 border-white/80';
        if (hidden) style += ' border-2 border-white/20';
    } else {
        style = 'bg-white text-slate-900 border-slate-300';
    }
    return style;
};

// --- Blue Game Board Component ---
const BlueGameBoard = ({ 
    strategy, 
    onSetChips, 
    readOnly,
    opponentName,
    currentRound,
    blindMode,
    revealedHistory = [],
    onDragStart
}: { 
    strategy: RoundStrategy[], 
    onSetChips?: (r: number, d: number) => void,
    readOnly: boolean,
    opponentName?: string,
    currentRound?: number,
    blindMode?: boolean,
    revealedHistory?: number[],
    onDragStart?: (e: React.PointerEvent, card: number, source: string) => void
}) => {
    
    return (
        <div className={`w-full h-full flex flex-col ${opponentName ? 'scale-[0.98] origin-top' : ''}`}>
            {opponentName && (
                <div className="text-center mb-1 flex items-center justify-center gap-2">
                    <span className="bg-red-600 text-white text-xs px-2 py-0.5 rounded font-bold">VS {opponentName}</span>
                </div>
            )}
            <div className={`flex-1 bg-blue-600/90 backdrop-blur-sm rounded-xl p-1 md:p-3 shadow-2xl border-4 ${opponentName ? 'border-red-400 bg-red-900/40' : 'border-blue-400'} relative flex flex-col overflow-hidden`}>
                <div className="flex flex-1 gap-1 overflow-x-auto items-stretch z-10 px-1 no-scrollbar">
                    {strategy.map((round, idx) => {
                        const isRoundActive = currentRound === (idx + 1);
                        const isPast = currentRound && (idx + 1) < currentRound;
                        const isRevealed = revealedHistory.includes(idx + 1);
                        const shouldHideNumber = blindMode && !isRevealed;

                        return (
                            <div 
                                key={round.round} 
                                className={`relative flex-1 min-w-[34px] md:min-w-[50px] flex flex-col items-center justify-between p-0.5 rounded-lg border 
                                    ${isRoundActive ? 'bg-yellow-500/30 border-yellow-400 ring-2 ring-yellow-400 z-20' : 'bg-blue-700/50 border-blue-500/30'}
                                    ${isPast ? 'opacity-50 grayscale' : ''}
                                `}
                                data-drop-zone="round"
                                data-round-index={idx}
                            >
                                <div className={`font-bold text-[10px] md:text-xs mb-1 ${isRoundActive ? 'text-yellow-300' : 'text-blue-100'}`}>
                                    R{round.round}
                                </div>
                                
                                {/* Card Slot */}
                                <div
                                    onPointerDown={(e) => {
                                        if(!readOnly && round.card !== -1 && onDragStart) {
                                            onDragStart(e, round.card, idx.toString());
                                        }
                                    }}
                                    className={`
                                        w-8 h-12 md:w-12 md:h-16 rounded md:rounded-md flex items-center justify-center shadow-md transition-transform border mb-1 select-none
                                        ${getCardStyle(round.card, false, shouldHideNumber)}
                                        ${!readOnly ? 'cursor-grab active:cursor-grabbing' : ''}
                                    `}
                                >
                                    {round.card !== -1 ? (
                                        shouldHideNumber ? (
                                            <span className="text-xs opacity-50">?</span>
                                        ) : (
                                            <span className="text-lg md:text-2xl font-black">{round.card}</span>
                                        )
                                    ) : (
                                        <span className="text-lg font-bold opacity-20"></span>
                                    )}
                                </div>

                                {/* Chips */}
                                <div className="flex flex-col items-center justify-end w-full gap-1 mt-auto">
                                    <div className="relative w-full flex items-center justify-center mb-1">
                                        <div className="w-6 h-6 md:w-8 md:h-8 rounded-full bg-gradient-to-r from-yellow-400 to-yellow-600 border border-white/30 shadow-lg flex items-center justify-center z-10">
                                            <span className="text-[10px] md:text-xs font-black text-black leading-none">{round.chips}</span>
                                        </div>
                                    </div>
                                    
                                    {!readOnly && onSetChips && (
                                        <div className="flex items-center gap-0.5 bg-blue-800/60 rounded-full p-0.5 border border-blue-400/30">
                                            <button 
                                                onClick={() => onSetChips(idx, -1)}
                                                className="w-4 h-4 md:w-5 md:h-5 rounded-full bg-blue-900 text-white flex items-center justify-center text-[10px] font-bold hover:bg-blue-800"
                                            >
                                                -
                                            </button>
                                            <button 
                                                onClick={() => onSetChips(idx, 1)}
                                                className="w-4 h-4 md:w-5 md:h-5 rounded-full bg-indigo-500 text-white flex items-center justify-center text-[10px] font-bold hover:bg-indigo-400"
                                            >
                                                +
                                            </button>
                                        </div>
                                    )}
                                    {readOnly && (
                                        <div className="text-[9px] font-bold text-yellow-300">{round.chips}억</div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

// --- Matchmaking & Admin Components ---
const MatchMaker = ({ teams, matches, onUpdateMatches }: { teams: Team[], matches: Match[], onUpdateMatches: (matches: Match[]) => void }) => {
    // ... (MatchMaker same as before) ...
    const [selectingSlot, setSelectingSlot] = useState<{idx: number, position: 'A' | 'B'} | null>(null);

    const assignTeam = (teamId: string, matchIdx: number, position: 'A' | 'B') => {
        const newMatches = [...matches];
        if (!newMatches[matchIdx]) {
             newMatches[matchIdx] = {
                id: `m_${Date.now()}_${matchIdx}`,
                teamAId: '', teamBId: '', teamAScore: 0, teamBScore: 0, 
                currentRound: 1, roundStatus: 'READY', pot: 0, carryOver: 0, history: [], aiHelps: {}
             };
        }
        if (teamId) {
            newMatches.forEach((m, mIdx) => {
                if (m.teamAId === teamId) m.teamAId = '';
                if (m.teamBId === teamId) m.teamBId = '';
            });
        }
        if (position === 'A') newMatches[matchIdx].teamAId = teamId;
        else newMatches[matchIdx].teamBId = teamId;
        onUpdateMatches(newMatches);
    };
    
    const autoMatch = () => {
        const shuffled = [...teams].sort(() => 0.5 - Math.random());
        const newMatches: Match[] = [];
        for (let i = 0; i < shuffled.length; i += 2) {
            if (i + 1 < shuffled.length) {
                newMatches.push({
                    id: `m_${Date.now()}_${i}`,
                    teamAId: shuffled[i].id,
                    teamBId: shuffled[i+1].id,
                    teamAScore: 0,
                    teamBScore: 0,
                    currentRound: 1, roundStatus: 'READY', pot: 0, carryOver: 0, history: [], aiHelps: {}
                });
            }
        }
        onUpdateMatches(newMatches);
    };

    return (
        <div className="space-y-6 select-none relative">
             <div className="flex justify-between items-center">
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">대진표 편성 (Matchmaking)</h3>
                <div className="flex gap-2">
                    <button onClick={() => onUpdateMatches([])} className="px-3 py-2 bg-red-600/80 rounded-lg text-sm font-bold text-white hover:bg-red-500">초기화</button>
                    <button onClick={autoMatch} className="px-4 py-2 bg-green-600 rounded-lg text-sm font-bold text-white hover:bg-green-500">자동 편성</button>
                </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 {Array.from({ length: Math.ceil(teams.length / 2) }).map((_, idx) => {
                     const match = matches[idx] || { teamAId: '', teamBId: '' };
                     const teamA = teams.find(t => t.id === match.teamAId);
                     const teamB = teams.find(t => t.id === match.teamBId);
                     return (
                         <div key={idx} className="bg-slate-100/80 dark:bg-slate-800/80 p-3 rounded-xl border border-slate-300 dark:border-slate-600 flex items-center justify-between gap-2 shadow-sm">
                             <div 
                                onClick={() => setSelectingSlot({idx, position: 'A'})}
                                className={`flex-1 h-12 rounded-lg border-2 border-dashed flex items-center justify-center cursor-pointer transition-all hover:border-indigo-400 hover:bg-indigo-50 dark:hover:bg-slate-700 ${teamA?'border-indigo-500 bg-indigo-500/10 dark:bg-indigo-900/20':'border-slate-300 dark:border-slate-600'}`}
                             >
                                 {teamA ? (
                                     <span className="text-slate-900 dark:text-white text-sm font-bold">{teamA.name}</span>
                                 ) : (
                                     <span className="text-xs text-gray-400 font-medium">+ Select Team A</span>
                                 )}
                             </div>
                             <span className="text-xs font-bold text-gray-500">VS</span>
                             <div 
                                onClick={() => setSelectingSlot({idx, position: 'B'})}
                                className={`flex-1 h-12 rounded-lg border-2 border-dashed flex items-center justify-center cursor-pointer transition-all hover:border-pink-400 hover:bg-pink-50 dark:hover:bg-slate-700 ${teamB?'border-pink-500 bg-pink-500/10 dark:bg-pink-900/20':'border-slate-300 dark:border-slate-600'}`}
                             >
                                 {teamB ? (
                                     <span className="text-slate-900 dark:text-white text-sm font-bold">{teamB.name}</span>
                                 ) : (
                                     <span className="text-xs text-gray-400 font-medium">+ Select Team B</span>
                                 )}
                             </div>
                         </div>
                     );
                 })}
            </div>
            {selectingSlot && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in" onClick={() => setSelectingSlot(null)}>
                    <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 w-full max-w-2xl shadow-2xl border border-slate-200 dark:border-slate-700 animate-scale-up" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                                {selectingSlot.position === 'A' ? 'Team A' : 'Team B'} 선택 (Match {selectingSlot.idx + 1})
                            </h3>
                            <button onClick={() => setSelectingSlot(null)} className="text-gray-500 hover:text-white">✕</button>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 mb-6 max-h-[60vh] overflow-y-auto p-1">
                            <button 
                                onClick={() => { assignTeam('', selectingSlot.idx, selectingSlot.position); setSelectingSlot(null); }}
                                className="p-3 rounded-xl border-2 border-dashed border-red-300 hover:border-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500 font-bold transition-all"
                            >
                                (비우기)
                            </button>
                            {teams.map(team => {
                                let assignedLocation = null;
                                matches.forEach((m, mIdx) => {
                                    if (m.teamAId === team.id) assignedLocation = `M${mIdx+1}-A`;
                                    if (m.teamBId === team.id) assignedLocation = `M${mIdx+1}-B`;
                                });
                                const isCurrent = matches[selectingSlot.idx]?.[selectingSlot.position === 'A' ? 'teamAId' : 'teamBId'] === team.id;
                                return (
                                    <button
                                        key={team.id}
                                        onClick={() => { assignTeam(team.id, selectingSlot.idx, selectingSlot.position); setSelectingSlot(null); }}
                                        className={`p-3 rounded-xl border flex flex-col items-center justify-center transition-all ${
                                            isCurrent 
                                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg' 
                                            : assignedLocation 
                                                ? 'bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700 opacity-60 hover:opacity-100' 
                                                : 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 hover:border-indigo-500 hover:shadow-md dark:text-white'
                                        }`}
                                    >
                                        <span className="font-bold text-sm truncate w-full text-center">{team.name}</span>
                                        {assignedLocation && !isCurrent && <span className="text-[10px] text-gray-500 mt-1">in {assignedLocation}</span>}
                                        {isCurrent && <span className="text-[10px] text-indigo-200 mt-1">선택됨</span>}
                                    </button>
                                );
                            })}
                        </div>
                        <div className="flex justify-end">
                            <button onClick={() => setSelectingSlot(null)} className="px-5 py-2 rounded-lg bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-gray-300 font-bold">취소</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const AdminDashboard = ({ room, onUpdate, onBack, onEnterTeam }: { room: Room, onUpdate: (r: Room) => void, onBack: () => void, onEnterTeam: (teamId: string) => void }) => {
    useEffect(() => {
        if (room.status === 'FINISHED' && room.teams.length > 0) {
            const sortedTeams = [...room.teams].sort((a, b) => b.winnings - a.winnings);
            const winner = sortedTeams[0];
            speak(`${winner.name} Wins!`);
        }
    }, [room.status]);

    const [posterLoading, setPosterLoading] = useState(false);
    const [swotLoading, setSwotLoading] = useState(false);
    const [winnerNames, setWinnerNames] = useState('');
    const [photos, setPhotos] = useState<string[]>([]);

    const handleCreatePoster = async () => {
        setPosterLoading(true);
        const winner = room.teams.sort((a,b) => b.winnings - a.winnings)[0];
        try {
            const url = await generateWinnerPoster(winner, photos, winnerNames);
            onUpdate({ ...room, winnerPosterUrl: url });
        } catch(e) { alert("Poster Gen Failed"); }
        setPosterLoading(false);
    };

    const handleCreateSWOT = async () => {
        setSwotLoading(true);
        try {
            const result = await generateSWOTAnalysis(room);
            onUpdate({ ...room, feedback: result });
        } catch(e) { alert("SWOT Failed"); }
        setSwotLoading(false);
    };

    const handleDownloadPDF = () => {
        const element = document.getElementById('report-container');
        if (element && typeof html2pdf !== 'undefined') {
            const opt = {
                margin: 0.5,
                filename: `SWOT_Analysis_${room.name}.pdf`,
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: { scale: 2 },
                jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' }
            };
            html2pdf().set(opt).from(element).save();
        } else {
            alert('PDF 라이브러리 로드 중...');
        }
    };

    // Helper to calculate rank
    const getTeamRank = (teamId: string) => {
        const sorted = [...room.teams].sort((a, b) => b.winnings - a.winnings);
        return sorted.findIndex(t => t.id === teamId) + 1;
    };

    return (
        <div className="p-4 md:p-8 max-w-[1600px] mx-auto animate-fade-in pb-20 relative z-10">
            <header className="flex justify-between items-center mb-6">
                <h2 className="text-xl md:text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-500 to-pink-500">SWOT 전략 미션 - {room.name}</h2>
                <button onClick={onBack} className="text-gray-500 dark:text-gray-400 border border-slate-300 dark:border-slate-700 bg-white/50 dark:bg-slate-900/50 px-3 py-1 rounded-lg text-sm">나가기</button>
            </header>

            {room.status === 'PREPARING' && (
                <div className="mb-8 glass-panel p-6 rounded-xl border border-indigo-500/30">
                    <MatchMaker teams={room.teams} matches={room.matches || []} onUpdateMatches={(matches) => onUpdate({...room, matches})} />
                    <button onClick={() => onUpdate({...room, status: 'PLAYING'})} className="w-full mt-4 py-4 bg-green-600 rounded-lg font-bold text-white text-lg hover:bg-green-500 shadow-lg transform transition-transform hover:scale-[1.01]">게임 시작 (PLAYING)</button>
                </div>
            )}
            
            {room.status === 'PLAYING' && (
                 <div className="mb-8 p-6 bg-slate-100/80 dark:bg-slate-800/80 backdrop-blur-md rounded-xl border border-yellow-500/30 flex justify-between items-center shadow-lg">
                     <div>
                         <h3 className="text-2xl text-yellow-600 dark:text-yellow-400 font-bold mb-1">⚡️ 경기 진행 중 (LIVE)</h3>
                         <p className="text-sm text-gray-500 dark:text-gray-400">각 팀의 화면에서 라운드가 진행됩니다. 아래에서 실시간 현황을 확인하세요.</p>
                     </div>
                     <button onClick={() => onUpdate({...room, status: 'FINISHED'})} className="px-6 py-3 bg-red-600 rounded-lg text-white font-bold text-sm shadow-md hover:bg-red-500 transition-colors">미션 종료 & AI분석 (Mission Finish)</button>
                 </div>
            )}

            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-4">실시간 현황 (Control Center)</h3>
            
            <div className="space-y-4 mb-8">
                {room.matches && room.matches.length > 0 ? (
                    <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                        {room.matches.map((match, idx) => {
                            const teamA = room.teams.find(t => t.id === match.teamAId);
                            const teamB = room.teams.find(t => t.id === match.teamBId);
                            const isMatchActive = match.roundStatus !== 'FINISHED';
                            return (
                                <div key={match.id} className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-md rounded-2xl border border-slate-300 dark:border-slate-700 overflow-hidden shadow-xl">
                                    <div className="bg-slate-100 dark:bg-slate-900/50 p-3 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
                                        <span className="font-bold text-indigo-600 dark:text-indigo-400">MATCH {idx + 1}</span>
                                        <span className={`text-xs font-bold px-2 py-1 rounded ${isMatchActive ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'}`}>
                                            {isMatchActive ? `R${match.currentRound} 진행중` : '종료됨'}
                                        </span>
                                    </div>
                                    <div className="p-4 flex items-center justify-between gap-4">
                                        <div className="flex-1 text-center">
                                            {teamA ? (
                                                <div onClick={() => onEnterTeam(teamA.id)} className={`cursor-pointer p-3 rounded-xl transition-all ${teamA.isReady && room.status==='PREPARING' ? 'bg-green-50 dark:bg-green-900/20 ring-2 ring-green-500' : 'hover:bg-slate-100 dark:hover:bg-slate-700'}`}>
                                                    <div className="font-black text-lg text-slate-900 dark:text-white truncate">{teamA.name}</div>
                                                    <div className="text-xs text-gray-500 dark:text-gray-400 mb-2 truncate max-w-[120px] mx-auto">{teamA.members?.join(', ') || '팀원 없음'}</div>
                                                    <div className="text-sm font-bold text-yellow-600 dark:text-yellow-500">{teamA.winnings}억</div>
                                                    <div className="text-[10px] text-gray-400">Rank: {getTeamRank(teamA.id)}위</div>
                                                    {room.status === 'PREPARING' && teamA.isReady && <div className="mt-2 text-xs bg-green-500 text-white py-1 px-2 rounded-full font-bold animate-pulse">Ready to Go</div>}
                                                </div>
                                            ) : <div className="text-gray-400 text-sm">Empty</div>}
                                        </div>
                                        <div className="font-black text-xl text-gray-300">VS</div>
                                        <div className="flex-1 text-center">
                                            {teamB ? (
                                                <div onClick={() => onEnterTeam(teamB.id)} className={`cursor-pointer p-3 rounded-xl transition-all ${teamB.isReady && room.status==='PREPARING' ? 'bg-green-50 dark:bg-green-900/20 ring-2 ring-green-500' : 'hover:bg-slate-100 dark:hover:bg-slate-700'}`}>
                                                    <div className="font-black text-lg text-slate-900 dark:text-white truncate">{teamB.name}</div>
                                                    <div className="text-xs text-gray-500 dark:text-gray-400 mb-2 truncate max-w-[120px] mx-auto">{teamB.members?.join(', ') || '팀원 없음'}</div>
                                                    <div className="text-sm font-bold text-yellow-600 dark:text-yellow-500">{teamB.winnings}억</div>
                                                    <div className="text-[10px] text-gray-400">Rank: {getTeamRank(teamB.id)}위</div>
                                                    {room.status === 'PREPARING' && teamB.isReady && <div className="mt-2 text-xs bg-green-500 text-white py-1 px-2 rounded-full font-bold animate-pulse">Ready to Go</div>}
                                                </div>
                                            ) : <div className="text-gray-400 text-sm">Empty</div>}
                                        </div>
                                    </div>
                                    <div className="bg-slate-50 dark:bg-slate-900/30 p-2 text-center text-xs text-gray-500 border-t border-slate-200 dark:border-slate-700">
                                        Current Pot: {match.pot}억 | Carry Over: {match.carryOver}억
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="text-center p-8 bg-slate-100 dark:bg-slate-800 rounded-xl text-gray-500">대진표가 아직 생성되지 않았습니다.</div>
                )}
            </div>
            
            {room.status === 'FINISHED' && (
                <div className="space-y-4" id="report-container">
                     <div className="bg-slate-100/80 dark:bg-slate-800/80 backdrop-blur-md p-6 rounded-xl border border-slate-300 dark:border-slate-700">
                         <div className="flex justify-between items-center mb-4">
                             <h3 className="text-lg font-bold text-slate-900 dark:text-white">🏆 우승팀 포스터 & 피드백</h3>
                             <button onClick={handleDownloadPDF} className="bg-slate-700 text-white px-3 py-1 rounded text-sm hover:bg-slate-600">PDF 다운로드</button>
                         </div>
                         
                         {/* Analysis & Poster Section */}
                         <div className="space-y-6">
                             {/* Poster Generation Control */}
                             <div className="bg-white/70 dark:bg-slate-900/70 p-4 rounded-lg print:hidden">
                                 <div className="flex gap-4">
                                     <div className="flex-1">
                                        <label className="block text-xs text-gray-500 dark:text-gray-400 mb-2">우승팀 사진 (다중 선택 가능)</label>
                                        <FileUpload onUpload={setPhotos} />
                                        <div className="flex gap-1 mt-2 overflow-x-auto">
                                            {photos.map((p, i) => <img key={i} src={p} className="h-10 w-10 object-cover rounded border border-slate-600" />)}
                                        </div>
                                     </div>
                                     <div className="flex-1">
                                        <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">팀원 이름</label>
                                        <input className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-3 py-2 text-slate-900 dark:text-white" value={winnerNames} onChange={e=>setWinnerNames(e.target.value)} />
                                        <div className="flex gap-2 mt-2">
                                            <button onClick={handleCreatePoster} disabled={posterLoading || photos.length === 0} className="flex-1 py-3 bg-purple-600 rounded-lg text-white font-bold disabled:opacity-50 text-xs">
                                                {posterLoading ? '생성 중...' : '포스터 생성'}
                                            </button>
                                            <button onClick={handleCreateSWOT} disabled={swotLoading} className="flex-1 py-3 bg-blue-600 rounded-lg text-white font-bold disabled:opacity-50 text-xs">
                                                {swotLoading ? '분석 중...' : '결과 집계'}
                                            </button>
                                        </div>
                                     </div>
                                 </div>
                             </div>
                             
                             {room.winnerPosterUrl && (
                                 <div className="mt-4 text-center">
                                     <h4 className="text-slate-900 dark:text-white font-bold mb-2">WINNER POSTER</h4>
                                     <div className="relative inline-block group">
                                         <img src={room.winnerPosterUrl} alt="Winner" className="max-w-md w-full rounded-xl shadow-2xl border-4 border-yellow-500/50" />
                                         <a href={room.winnerPosterUrl} download={`Winner_Poster_${room.name}.png`} className="absolute bottom-4 right-4 bg-white text-black px-4 py-2 rounded-full font-bold shadow-lg opacity-0 group-hover:opacity-100 transition-opacity">다운로드</a>
                                     </div>
                                 </div>
                             )}
                             
                             {room.feedback && (
                                 <div className="mt-6 bg-white dark:bg-slate-900 p-6 rounded-xl text-slate-800 dark:text-gray-200 text-sm leading-relaxed shadow-inner border border-slate-200 dark:border-slate-700">
                                     {/* Render HTML from Gemini safely */}
                                     <div dangerouslySetInnerHTML={{ __html: room.feedback }} className="prose dark:prose-invert max-w-none font-sans" />
                                 </div>
                             )}
                         </div>
                     </div>
                </div>
            )}
        </div>
    );
};

const UserGameView = ({ room, teamId, onUpdate, isAdminMode, onBackToDash }: { room: Room, teamId: string, onUpdate: (r: Room) => void, isAdminMode?: boolean, onBackToDash?: () => void }) => {
    const team = room.teams.find(t => t.id === teamId);
    
    // Determine Opponent & Match
    const myMatchIdx = room.matches.findIndex(m => m.teamAId === teamId || m.teamBId === teamId);
    const myMatch = room.matches[myMatchIdx];
    
    const isTeamA = myMatch?.teamAId === teamId;
    const opponentId = isTeamA ? myMatch?.teamBId : myMatch?.teamAId;
    const opponentTeam = room.teams.find(t => t.id === opponentId);

    // Initial Setup Logic (Drag & Drop)
    const initialStrategy = (team?.strategy && team.strategy.length === TOTAL_ROUNDS) 
        ? team.strategy 
        : Array(TOTAL_ROUNDS).fill(null).map((_, i) => ({ round: i + 1, card: -1, chips: 1 }));
    const [strategy, setStrategy] = useState<RoundStrategy[]>(initialStrategy);
    
    // Playing State
    const [aiLoading, setAiLoading] = useState(false);
    const [stealModalOpen, setStealModalOpen] = useState(false);
    const [neededChips, setNeededChips] = useState(0);
    const [submitConfirmOpen, setSubmitConfirmOpen] = useState(false);

    // IMPORTANT: Ref for Drag Item to be accessible in Drop Handler
    const currentDragItem = useRef<DragItem | null>(null);

    // Update strategy to match team state
    useEffect(() => {
        if(team?.strategy && team.strategy.length === TOTAL_ROUNDS) setStrategy(team.strategy);
    }, [team]);

    // Derived States
    const usedChips = strategy.reduce((acc, s) => acc + s.chips, 0);
    const remainingChips = TOTAL_CHIPS - usedChips;
    const usedCards = strategy.map(s => s.card).filter(c => c !== -1);
    const allRoundsHaveChips = strategy.every(s => s.chips > 0);
    const isSetupComplete = remainingChips === 0 && usedCards.length === TOTAL_ROUNDS && allRoundsHaveChips;
    
    // AI Advice Sync
    const activeAdvice = myMatch?.aiAdvice?.[teamId];

    // Derived State Variables - Define BEFORE usage
    const isMyTurn = myMatch?.turnOwner === teamId;
    const isBlindMode = true; // DEFINED EXPLICITLY HERE to fix ReferenceError
    const revealedRounds = myMatch?.history?.map(h => h.round) || [];
    
    // Add current round to revealed if shown
    if (myMatch && (myMatch.roundStatus === 'SHOWDOWN' || myMatch.roundStatus === 'FINISHED')) {
        if (myMatch.currentRound && !revealedRounds.includes(myMatch.currentRound)) {
            revealedRounds.push(myMatch.currentRound);
        }
    }

    // ... (Game Engine Logic, Update Functions, Actions same as before) ...
    useEffect(() => {
        if (room.status !== 'PLAYING' || !myMatch || !team || !opponentTeam) return;

        const myStrat = team.strategy![myMatch.currentRound - 1];
        const oppStrat = opponentTeam.strategy![myMatch.currentRound - 1];

        if (myMatch.roundStatus === 'READY') {
            if (myStrat.chips === oppStrat.chips) {
                updateMatchState({ roundStatus: 'SHOWDOWN' });
            } else {
                const fewerChipsTeamId = myStrat.chips < oppStrat.chips ? team.id : opponentTeam.id;
                updateMatchState({ roundStatus: 'DECISION', turnOwner: fewerChipsTeamId });
            }
        }
    }, [room.status, myMatch?.currentRound, myMatch?.roundStatus, myMatch?.pot]);

    const updateMatchState = (updates: Partial<Match>) => {
        const newMatches = [...room.matches];
        newMatches[myMatchIdx] = { ...myMatch, ...updates };
        onUpdate({ ...room, matches: newMatches });
    };

    const updateTeamsAndMatch = (updatedTeams: Team[], matchUpdates: Partial<Match>) => {
        const newMatches = [...room.matches];
        newMatches[myMatchIdx] = { ...myMatch, ...matchUpdates };
        onUpdate({ ...room, teams: updatedTeams, matches: newMatches });
    };

    const handleSubmitStrategy = () => {
        if (!isAdminMode) {
            // Strict Validation
            if (usedCards.length !== 10) {
                alert("모든 10장의 카드를 사용해야 합니다.");
                return;
            }
            if (remainingChips !== 0) {
                alert(`자본금 잔액이 ${remainingChips}억 남았습니다. 0억이 되어야 합니다.`);
                return;
            }
            setSubmitConfirmOpen(true);
        } else {
            // Admin bypass
            confirmSubmit();
        }
    };

    const confirmSubmit = () => {
        const updatedTeams = room.teams.map(t => t.id === teamId ? { ...t, isReady: true, strategy } : t);
        onUpdate({ ...room, teams: updatedTeams });
        setSubmitConfirmOpen(false);
    };

    const handleAIHelp = async () => {
        if (aiLoading || (myMatch.aiHelps?.[teamId] || 0) >= 3) return;
        setAiLoading(true);
        try {
            const advice = await getGameAdvice(team!, opponentTeam!, myMatch);
            // Sync Advice to Match
            const newCounts = { ...myMatch.aiHelps, [teamId]: (myMatch.aiHelps?.[teamId] || 0) + 1 };
            const newAdvice = { ...myMatch.aiAdvice, [teamId]: advice };
            updateMatchState({ aiHelps: newCounts, aiAdvice: newAdvice });
        } catch(e) { alert("AI 조언 실패"); }
        setAiLoading(false);
    };

    const closeAIHelp = () => {
        // Clear advice for team
        if (myMatch?.aiAdvice?.[teamId]) {
            const newAdvice = { ...myMatch.aiAdvice };
            delete newAdvice[teamId];
            updateMatchState({ aiAdvice: newAdvice });
        }
    };

    // Game Action Handlers (Fold, Call, Steal, Showdown...)
    const handleFold = () => {
        if (!isMyTurn) return;
        const currentRound = myMatch.currentRound;
        const myStrat = team!.strategy![currentRound - 1];
        const oppStrat = opponentTeam!.strategy![currentRound - 1];
        const pot = myStrat.chips + oppStrat.chips + (myMatch.carryOver || 0);
        const updatedOpponent = { ...opponentTeam!, winnings: (opponentTeam!.winnings || 0) + pot };
        const historyItem = {
            round: currentRound,
            teamACard: isTeamA ? myStrat.card : oppStrat.card,
            teamBCard: isTeamA ? oppStrat.card : myStrat.card,
            teamAChips: isTeamA ? myStrat.chips : oppStrat.chips,
            teamBChips: isTeamA ? oppStrat.chips : myStrat.chips,
            result: isTeamA ? 'A_FOLDED' : 'B_FOLDED',
            potWon: pot
        };
        const nextRound = currentRound + 1;
        const isGameEnd = nextRound > TOTAL_ROUNDS;
        const updatedTeams = room.teams.map(t => t.id === opponentTeam!.id ? updatedOpponent : t);
        updateTeamsAndMatch(updatedTeams, {
            currentRound: isGameEnd ? currentRound : nextRound,
            roundStatus: isGameEnd ? 'FINISHED' : 'READY',
            turnOwner: undefined, pot: 0, carryOver: 0,
            history: [...(myMatch.history || []), historyItem as any]
        });
    };

    const handleCall = () => {
        if (!isMyTurn) return;
        const currentRound = myMatch.currentRound;
        const myStrat = team!.strategy![currentRound - 1];
        const oppStrat = opponentTeam!.strategy![currentRound - 1];
        const diff = oppStrat.chips - myStrat.chips;
        let winnings = team!.winnings || 0;
        if (winnings >= diff) {
            const updatedTeam = { 
                ...team!, 
                winnings: winnings - diff,
                strategy: team!.strategy!.map((s, i) => i === currentRound - 1 ? { ...s, chips: s.chips + diff } : s)
            };
            const updatedTeams = room.teams.map(t => t.id === teamId ? updatedTeam : t);
            updateTeamsAndMatch(updatedTeams, { roundStatus: 'SHOWDOWN', turnOwner: undefined });
        } else {
            setNeededChips(diff - winnings);
            setStealModalOpen(true);
        }
    };

    const handleStealChips = (sourceRoundIdx: number) => {
        const currentRound = myMatch.currentRound;
        const myStrat = team!.strategy![currentRound - 1];
        const oppStrat = opponentTeam!.strategy![currentRound - 1];
        const totalDiff = oppStrat.chips - myStrat.chips;
        const currentWinnings = team!.winnings || 0;
        const sourceChips = team!.strategy![sourceRoundIdx].chips;
        const chipsToSteal = totalDiff - currentWinnings;
        if (sourceChips <= chipsToSteal) { alert("선택한 라운드의 칩이 부족합니다."); return; }
        const updatedStrategy = team!.strategy!.map((s, i) => {
            if (i === currentRound - 1) return { ...s, chips: s.chips + totalDiff };
            if (i === sourceRoundIdx) return { ...s, chips: s.chips - chipsToSteal };
            return s;
        });
        const updatedTeam = { ...team!, winnings: 0, strategy: updatedStrategy };
        const updatedTeams = room.teams.map(t => t.id === teamId ? updatedTeam : t);
        setStealModalOpen(false);
        updateTeamsAndMatch(updatedTeams, { roundStatus: 'SHOWDOWN', turnOwner: undefined });
    };

    const handleShowdown = () => {
        if (myMatch.roundStatus !== 'SHOWDOWN') return;
        const currentRound = myMatch.currentRound;
        const teamA = room.teams.find(t => t.id === myMatch.teamAId)!;
        const teamB = room.teams.find(t => t.id === myMatch.teamBId)!;
        const stratA = teamA.strategy![currentRound - 1];
        const stratB = teamB.strategy![currentRound - 1];
        const pot = stratA.chips + stratB.chips + (myMatch.carryOver || 0);
        let winner: 'A' | 'B' | 'DRAW' = 'DRAW';
        let carryOver = 0;
        let winningsA = teamA.winnings || 0;
        let winningsB = teamB.winnings || 0;
        let scoreA = myMatch.teamAScore;
        let scoreB = myMatch.teamBScore;
        if (stratA.card > stratB.card) { winner = 'A'; winningsA += pot; scoreA += 1; }
        else if (stratB.card > stratA.card) { winner = 'B'; winningsB += pot; scoreB += 1; }
        else { if (currentRound === TOTAL_ROUNDS) { winningsA += pot / 2; winningsB += pot / 2; } else { carryOver = pot; } }
        const historyItem = { round: currentRound, teamACard: stratA.card, teamBCard: stratB.card, teamAChips: stratA.chips, teamBChips: stratB.chips, result: winner === 'A' ? 'A_WON' : (winner === 'B' ? 'B_WON' : 'DRAW'), potWon: winner === 'DRAW' ? 0 : pot };
        const updatedTeamA = { ...teamA, winnings: winningsA };
        const updatedTeamB = { ...teamB, winnings: winningsB };
        const updatedTeams = room.teams.map(t => t.id === teamA.id ? updatedTeamA : (t.id === teamB.id ? updatedTeamB : t));
        const nextRound = currentRound + 1;
        const isGameEnd = nextRound > TOTAL_ROUNDS;
        updateTeamsAndMatch(updatedTeams, { currentRound: isGameEnd ? currentRound : nextRound, roundStatus: isGameEnd ? 'FINISHED' : 'READY', turnOwner: undefined, pot: 0, carryOver, teamAScore: scoreA, teamBScore: scoreB, history: [...(myMatch.history || []), historyItem as any] });
    };

    // ... (Drag & Drop Logic same as before) ...
    const handleSetChips = (roundIdx: number, delta: number) => {
        if (room.status !== 'PREPARING' && !isAdminMode) return;
        setStrategy(prev => {
             const next = prev.map(p => ({...p}));
             const currentChips = next[roundIdx].chips;
             const newChips = currentChips + delta;
             if (newChips < 1) return prev;
             const currentTotal = next.reduce((acc, s) => acc + s.chips, 0);
             if (delta > 0 && currentTotal >= TOTAL_CHIPS) return prev;
             next[roundIdx].chips = newChips;
             return next;
        });
    };
    const handleDragStart = (e: React.PointerEvent, card: number, source: string) => {
         if (room.status !== 'PREPARING' && !isAdminMode) return;
         if (card === -1) return;
         window.dispatchEvent(new CustomEvent('swot-drag-start', { detail: { item: {type:'CARD',data:card,source}, x: e.clientX, y: e.clientY } }));
         currentDragItem.current = { type: 'CARD', data: card, source };
    };
    const handleDrop = (e: React.PointerEvent) => {
        if (room.status !== 'PREPARING' && !isAdminMode) return;
        const item = currentDragItem.current;
        if (!item || item.type !== 'CARD') return;
        const target = document.elementFromPoint(e.clientX, e.clientY);
        const dropZone = target?.closest('[data-drop-zone="round"]');
        if (dropZone) {
             const targetRoundIdx = parseInt(dropZone.getAttribute('data-round-index') || '-1');
             if (targetRoundIdx !== -1) {
                 setStrategy(prev => {
                     const next = prev.map(p => ({...p}));
                     if (item.source === 'deck') { next[targetRoundIdx].card = item.data; } 
                     else { const sourceRoundIdx = parseInt(item.source || '-1'); if (sourceRoundIdx !== -1 && sourceRoundIdx !== targetRoundIdx) { const targetCard = next[targetRoundIdx].card; next[targetRoundIdx].card = item.data; next[sourceRoundIdx].card = targetCard; } }
                     return next;
                 });
             }
        } else { if (item.source !== 'deck') { const sourceRoundIdx = parseInt(item.source || '-1'); if (sourceRoundIdx !== -1) { setStrategy(prev => { const next = prev.map(p => ({...p})); next[sourceRoundIdx].card = -1; return next; }); } } }
        currentDragItem.current = null;
    };
    
    if (!team) return <div>Loading...</div>;

    return (
        <div className="w-full max-w-7xl mx-auto h-screen flex flex-col p-2 md:p-4 overflow-hidden bg-slate-50/80 dark:bg-slate-950/80 backdrop-blur-sm relative touch-none selection:bg-none transition-colors z-10" onPointerUp={handleDrop}>
            <DragOverlay />
            
            <header className="flex justify-between items-start mb-2 shrink-0">
                <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                        {isAdminMode && <button onClick={onBackToDash} className="bg-slate-200 dark:bg-slate-700 px-2 py-1 rounded text-xs text-slate-800 dark:text-white">Back</button>}
                        <h1 className="text-lg font-bold text-slate-900 dark:text-white">{team.name}</h1>
                    </div>
                    <div className="text-xs text-indigo-600 dark:text-indigo-300 font-medium">
                        {team.members?.length > 0 ? team.members.join(', ') : "팀원 대기중..."}
                    </div>
                </div>
                <div className="flex gap-2 items-center">
                    {room.status === 'PLAYING' && (
                        <div className="bg-yellow-100 dark:bg-yellow-600/30 border border-yellow-500 text-yellow-800 dark:text-yellow-300 px-3 py-1 rounded-full text-xs font-bold">
                             💰 확보 자금: {team.winnings || 0}억
                        </div>
                    )}
                    <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${room.status === 'PREPARING' ? 'bg-yellow-100 dark:bg-yellow-500/20 text-yellow-600 dark:text-yellow-500' : 'bg-green-100 dark:bg-green-500/20 text-green-600 dark:text-green-500'}`}>
                        {room.status}
                    </span>
                </div>
            </header>

            {room.status === 'PREPARING' && (
                <>
                     <div className="grid grid-cols-3 gap-2 mb-2 shrink-0">
                        <div className="bg-white/80 dark:bg-slate-800/80 p-2 rounded-xl border border-slate-200 dark:border-slate-700 text-center shadow-sm">
                            <span className="text-[10px] text-gray-500 dark:text-gray-400">자본금 잔액</span>
                            <div className={`text-xl font-black ${remainingChips < 0 ? 'text-red-500' : 'text-slate-900 dark:text-white'}`}>{remainingChips}억</div>
                        </div>
                        <div className="bg-white/80 dark:bg-slate-800/80 p-2 rounded-xl border border-slate-200 dark:border-slate-700 text-center shadow-sm">
                             <span className="text-[10px] text-gray-500 dark:text-gray-400">카드 사용</span>
                             <div className="text-xl font-black text-slate-900 dark:text-white">{usedCards.length}/10</div>
                        </div>
                        <button 
                            onClick={handleSubmitStrategy}
                            className={`rounded-xl font-bold text-sm shadow-xl flex flex-col items-center justify-center transition-all ${team.isReady ? 'bg-green-100 dark:bg-green-600/20 text-green-600 dark:text-green-500 border-2 border-green-500' : 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:scale-105 active:scale-95'}`}
                        >
                            <span>{team.isReady ? "제출 완료" : "전략 제출"}</span>
                            <span className="text-[10px] font-normal opacity-80">Ready to Go</span>
                        </button>
                    </div>
                    <div className="flex-1 min-h-0 mb-4">
                        <BlueGameBoard strategy={strategy} onSetChips={handleSetChips} readOnly={team.isReady && !isAdminMode} onDragStart={handleDragStart} />
                    </div>
                    {(!team.isReady || isAdminMode) && (
                        <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur border-t border-slate-200 dark:border-slate-800 p-2 md:p-4 rounded-t-xl shrink-0 z-20">
                            <div className="flex justify-between gap-1 max-w-3xl mx-auto">
                                {CARDS.map(c => {
                                    const isUsed = usedCards.includes(c);
                                    return <div key={c} onPointerDown={(e) => !isUsed && handleDragStart(e, c, 'deck')} className={`flex-1 aspect-[2/3] max-w-[50px] rounded font-bold text-xl shadow-md flex items-center justify-center transition-all ${getCardStyle(c, true)} ${isUsed ? 'opacity-20 cursor-default' : 'cursor-grab active:cursor-grabbing'}`}>{c}</div>;
                                })}
                            </div>
                        </div>
                    )}
                </>
            )}

            {(room.status === 'PLAYING' || room.status === 'FINISHED') && opponentTeam && myMatch && (
                <div className="flex-1 flex flex-col gap-2 min-h-0 relative">
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-30 pointer-events-none w-full text-center">
                         {myMatch.roundStatus === 'DECISION' && <div className="bg-black/70 backdrop-blur-md text-white py-2 px-6 rounded-full inline-block border border-yellow-500 animate-pulse">{isMyTurn ? "당신의 결정 차례입니다!" : `${opponentTeam.name}의 결정을 기다리는 중...`}</div>}
                         {myMatch.roundStatus === 'SHOWDOWN' && <button onClick={handleShowdown} className="pointer-events-auto bg-red-600 text-white font-black text-xl py-3 px-8 rounded-full shadow-[0_0_20px_rgba(220,38,38,0.6)] animate-bounce border-4 border-white">SHOWDOWN! (카드 오픈)</button>}
                    </div>

                    <div className="flex-1 min-h-0 bg-slate-100/50 dark:bg-slate-900/50 backdrop-blur rounded-xl border border-red-500/20 overflow-hidden relative">
                         <div className="absolute top-1 right-2 z-20"><span className="text-[10px] bg-slate-900/50 text-white px-2 py-0.5 rounded-full border border-red-500/30">상대 수익: <span className="text-yellow-400 font-bold">{opponentTeam.winnings}억</span></span></div>
                         <BlueGameBoard strategy={opponentTeam.strategy || []} readOnly={true} opponentName={opponentTeam.name} currentRound={myMatch.currentRound} blindMode={isBlindMode} revealedHistory={revealedRounds} />
                    </div>
                    
                    <div className="h-10 flex items-center justify-between px-4 bg-white/80 dark:bg-slate-900/80 backdrop-blur shrink-0 relative border-y border-slate-200 dark:border-slate-800">
                         <div className="text-gray-500 dark:text-gray-400 text-xs">R{myMatch.currentRound}/10</div>
                         <div className="flex flex-col items-center">
                             <div className="text-[10px] text-gray-500">CURRENT POT</div>
                             <div className="text-yellow-600 dark:text-yellow-400 font-black text-lg">{(team.strategy![myMatch.currentRound-1].chips + opponentTeam.strategy![myMatch.currentRound-1].chips + (myMatch.carryOver||0))}억</div>
                         </div>
                         <div className="text-gray-500 dark:text-gray-400 text-xs">Carry: {myMatch.carryOver || 0}</div>
                    </div>

                    <div className="flex-1 min-h-0 bg-slate-100/50 dark:bg-slate-900/50 backdrop-blur rounded-xl border border-blue-500/20 overflow-hidden relative">
                        <BlueGameBoard strategy={team.strategy || []} readOnly={true} currentRound={myMatch.currentRound} revealedHistory={revealedRounds} />
                    </div>

                    <div className="h-16 bg-white/80 dark:bg-slate-800/80 backdrop-blur shrink-0 flex items-center justify-between px-4 gap-4 border-t border-slate-200 dark:border-slate-700">
                        <button onClick={handleAIHelp} className={`flex flex-col items-center justify-center w-14 h-full text-[10px] ${aiLoading ? 'opacity-50' : ''} ${(myMatch.aiHelps?.[teamId]||0) >= 3 ? 'grayscale opacity-50' : 'text-cyan-600 dark:text-cyan-400'}`}>
                            <span className="text-xl">🤖</span>AI 헬프 ({(3 - (myMatch.aiHelps?.[teamId]||0))})
                        </button>
                        {isMyTurn && myMatch.roundStatus === 'DECISION' ? (
                            <div className="flex-1 flex gap-2 h-10">
                                <button onClick={handleFold} className="flex-1 bg-slate-600 hover:bg-slate-500 text-white rounded font-bold">포기 (Fold)</button>
                                <button onClick={handleCall} className="flex-[2] bg-red-600 hover:bg-red-500 text-white rounded font-bold shadow-lg shadow-red-500/30">승부 (Call)</button>
                            </div>
                        ) : (
                            <div className="flex-1 text-center text-gray-500 text-sm flex items-center justify-center bg-slate-100 dark:bg-slate-900/50 h-10 rounded">{myMatch.roundStatus === 'SHOWDOWN' ? '결과 확인 대기' : '대기 중...'}</div>
                        )}
                    </div>
                </div>
            )}
            
            {/* AI Advice Modal (Synced) */}
            {activeAdvice && (
                <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 p-6 backdrop-blur-sm" onClick={closeAIHelp}>
                    <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl max-w-md w-full border border-cyan-500 shadow-[0_0_30px_rgba(6,182,212,0.3)] animate-scale-up flex flex-col max-h-[80vh]" onClick={e=>e.stopPropagation()}>
                        <h3 className="text-cyan-600 dark:text-cyan-400 font-bold text-xl mb-4 flex items-center gap-2 shrink-0">🤖 Gemini Strategy Advisor</h3>
                        <div className="text-slate-900 dark:text-white whitespace-pre-wrap leading-relaxed overflow-y-auto pr-2">
                            {/* Render AI help which is plain text now */}
                            {activeAdvice}
                        </div>
                        <button onClick={closeAIHelp} className="mt-6 w-full py-3 bg-cyan-100 dark:bg-cyan-900/50 text-cyan-800 dark:text-cyan-300 rounded-lg hover:bg-cyan-200 dark:hover:bg-cyan-900 transition-colors shrink-0">닫기</button>
                    </div>
                </div>
            )}

            {/* Steal Chips Modal */}
            {stealModalOpen && (
                <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/90 p-6">
                    <div className="bg-slate-900 p-6 rounded-xl w-full max-w-lg border border-red-500">
                        <h3 className="text-white font-bold text-lg mb-2">자금 부족! ({neededChips}억 필요)</h3>
                        <p className="text-gray-400 text-sm mb-4">보유 자금(Winnings)을 모두 사용했습니다. 미래 라운드에서 칩을 가져와야 합니다.</p>
                        <div className="grid grid-cols-5 gap-2 mb-4">
                            {team.strategy?.map((s, idx) => { if (idx < (myMatch?.currentRound || 0)) return null; const canSteal = s.chips > neededChips; return ( <button key={s.round} onClick={() => canSteal && handleStealChips(idx)} className={`p-2 rounded border flex flex-col items-center ${canSteal ? 'border-green-500 bg-green-900/20 hover:bg-green-900/40' : 'border-slate-700 opacity-50 cursor-not-allowed'}`}><span className="text-xs text-gray-400">R{s.round}</span><span className="text-white font-bold">{s.chips}</span></button> ) })}
                        </div>
                        <button onClick={() => setStealModalOpen(false)} className="w-full py-2 bg-slate-700 text-white rounded">취소</button>
                    </div>
                </div>
            )}

            {/* Submit Confirmation Modal */}
            {submitConfirmOpen && (
                 <div className="absolute inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-6">
                     <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl max-w-sm w-full border border-indigo-500 shadow-2xl animate-scale-up">
                         <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">전략 제출 확인</h3>
                         <p className="text-gray-600 dark:text-gray-300 mb-6 text-sm">제출 완료 이후에는 수정이 불가능합니다.<br/>정말 제출하시겠습니까?</p>
                         <div className="flex gap-3">
                             <button onClick={() => setSubmitConfirmOpen(false)} className="flex-1 py-3 bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-gray-300 rounded-lg font-bold">NO (취소)</button>
                             <button onClick={confirmSubmit} className="flex-1 py-3 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-500">YES (제출)</button>
                         </div>
                     </div>
                 </div>
            )}
        </div>
    );
};

// ... (App Component unchanged except for imports/styles if needed) ...
const App: React.FC = () => {
    // Initial theme based on system preference
    const [darkMode, setDarkMode] = useState(() => {
        if (typeof window !== 'undefined') {
            return window.matchMedia('(prefers-color-scheme: dark)').matches;
        }
        return true;
    });

    const [view, setView] = useState<'LANDING' | 'ADMIN_LOGIN' | 'ADMIN_DASH' | 'USER_GAME'>('LANDING');
    const [rooms, setRooms] = useState<Room[]>([]);
    const [tab, setTab] = useState<'JOIN' | 'ADMIN'>('JOIN');
    
    const [adminInput, setAdminInput] = useState('');
    const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
    const [currentRoomId, setCurrentRoomId] = useState<string | null>(null);
    const [currentTeamId, setCurrentTeamId] = useState<string | null>(null);
    const [isAdminVisiting, setIsAdminVisiting] = useState(false);

    // Join Flow State
    const [pendingTeamId, setPendingTeamId] = useState<string | null>(null);
    const [joinName, setJoinName] = useState('');
    const [showNameModal, setShowNameModal] = useState(false);

    useEffect(() => {
        setRooms(getRooms());
        const handleStorage = () => setRooms(getRooms());
        window.addEventListener('storage', handleStorage);
        const storedAuth = localStorage.getItem('swot_admin_auth');
        if (storedAuth === 'true') setIsAdminAuthenticated(true);
        
        // Auto-reconnect check
        const session = localStorage.getItem('swot_user_session');
        if (session) {
            // Optional: You can auto-join here if you want
        }

        return () => window.removeEventListener('storage', handleStorage);
    }, []);

    useEffect(() => {
        if (darkMode) {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
    }, [darkMode]);

    const updateRoom = (updatedRoom: Room) => {
        const newRooms = rooms.map(r => r.id === updatedRoom.id ? updatedRoom : r);
        setRooms(newRooms);
        saveRooms(newRooms);
    };

    const deleteRoom = (roomId: string) => {
        if (window.confirm("정말로 이 게임방을 삭제하시겠습니까? 복구할 수 없습니다.")) {
            const newRooms = rooms.filter(r => r.id !== roomId);
            setRooms(newRooms);
            saveRooms(newRooms);
            if(currentRoomId === roomId) setCurrentRoomId(null);
        }
    };

    const handleAdminLogin = () => {
        if(adminInput === ADMIN_PW) {
            setIsAdminAuthenticated(true);
            localStorage.setItem('swot_admin_auth', 'true');
            setView('ADMIN_DASH');
        } else {
            alert('비밀번호가 틀렸습니다.');
        }
    };

    const createRoom = (name: string, teamCount: number) => {
        const newTeams: Team[] = Array.from({ length: teamCount }, (_, i) => ({
            id: `t_${Date.now()}_${i}`,
            name: `Team ${i+1}`,
            roomId: '',
            isReady: false,
            score: 0,
            winnings: 0,
            members: []
        }));

        const newRoom: Room = {
            id: `r_${Date.now()}`,
            name,
            totalTeams: teamCount,
            currentRound: 1,
            status: 'PREPARING',
            teams: newTeams,
            matches: []
        };
        newRoom.teams.forEach(t => t.roomId = newRoom.id);
        const updatedRooms = [...rooms, newRoom];
        setRooms(updatedRooms);
        saveRooms(updatedRooms);
        setCurrentRoomId(newRoom.id);
        setView('ADMIN_DASH');
    };

    const handleJoinClick = (roomId: string, teamId: string) => {
        setPendingTeamId(teamId);
        setCurrentRoomId(roomId);
        
        // Check for existing session for this room/team
        const session = localStorage.getItem('swot_user_session');
        let defaultName = '';
        if (session) {
            const parsed = JSON.parse(session);
            if (parsed.roomId === roomId && parsed.teamId === teamId) {
                defaultName = parsed.userName;
            }
        }
        setJoinName(defaultName);
        setShowNameModal(true);
    };

    const confirmJoin = () => {
        if (!joinName.trim()) { alert("이름을 입력해주세요."); return; }
        if (!currentRoomId || !pendingTeamId) return;

        const room = rooms.find(r => r.id === currentRoomId);
        if (!room) return;
        
        const team = room.teams.find(t => t.id === pendingTeamId);
        if (!team) return;

        // Add member if not exists
        let updatedTeam = team;
        if (!team.members?.includes(joinName)) {
             updatedTeam = { ...team, members: [...(team.members || []), joinName] };
             const updatedRooms = rooms.map(r => r.id === currentRoomId ? { ...r, teams: r.teams.map(t => t.id === team.id ? updatedTeam : t) } : r);
             setRooms(updatedRooms);
             saveRooms(updatedRooms);
        }

        // Save session
        localStorage.setItem('swot_user_session', JSON.stringify({ roomId: currentRoomId, teamId: pendingTeamId, userName: joinName }));
        
        setCurrentTeamId(pendingTeamId);
        setIsAdminVisiting(false);
        setShowNameModal(false);
        setView('USER_GAME');
    };

    const renderContent = () => {
        if (view === 'LANDING') {
            return (
                <div className="flex flex-col h-full overflow-hidden relative transition-colors duration-500">
                    <div className="max-w-md mx-auto w-full p-6 z-10 flex flex-col h-full">
                        <div className="text-center mt-10 mb-8">
                            <h1 className="text-4xl font-black mb-2 tracking-tight">
                                <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-500">SWOT 전략 미션</span>
                            </h1>
                            <p className="text-gray-500 dark:text-gray-400 text-sm font-light tracking-widest">STRATEGIC STRENGTH DEVELOPMENT</p>
                        </div>
                        <div className="flex p-1 bg-white/50 dark:bg-slate-900/50 rounded-xl mb-8 border border-slate-200 dark:border-slate-800 backdrop-blur-sm">
                            <button onClick={() => setTab('JOIN')} className={`flex-1 py-3 rounded-lg text-sm font-bold transition-all ${tab === 'JOIN' ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-white shadow-md' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}>Join Room</button>
                            <button onClick={() => setTab('ADMIN')} className={`flex-1 py-3 rounded-lg text-sm font-bold transition-all ${tab === 'ADMIN' ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-white shadow-md' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}>Admin Create</button>
                        </div>
                        <div className="flex-1 bg-white/70 dark:bg-slate-900/50 backdrop-blur-md rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl p-1 overflow-hidden flex flex-col">
                            {tab === 'JOIN' ? (
                                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                                    <div className="text-center text-xs text-gray-500 mb-2 uppercase tracking-wider font-bold">Open Rooms</div>
                                    {rooms.filter(r => r.status !== 'FINISHED').map(room => (
                                        <div key={room.id} className="bg-white/80 dark:bg-slate-800/80 rounded-xl p-4 border border-slate-200 dark:border-slate-700 hover:border-indigo-500/50 transition-all group shadow-sm">
                                            <div className="flex justify-between items-center mb-3">
                                                <h3 className="font-bold text-slate-800 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">{room.name}</h3>
                                                <span className="text-[10px] bg-green-100 dark:bg-green-900 text-green-600 dark:text-green-300 px-2 py-0.5 rounded-full">{room.status}</span>
                                            </div>
                                            <div className="grid grid-cols-2 gap-2">
                                                {room.teams.map(team => (
                                                    <button 
                                                        key={team.id}
                                                        onClick={() => handleJoinClick(room.id, team.id)}
                                                        className={`text-xs p-2 rounded text-center truncate transition-colors ${team.isReady ? 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-white' : 'bg-indigo-600 hover:bg-indigo-500 text-white'}`}
                                                    >
                                                        {team.name} {team.isReady && "✓"}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                    {rooms.length === 0 && <div className="text-center p-4 text-gray-500">개설된 방이 없습니다.</div>}
                                </div>
                            ) : (
                                <div className="flex-1 p-6 flex flex-col justify-center">
                                    {isAdminAuthenticated ? (
                                        <div className="text-center">
                                            <h3 className="text-slate-900 dark:text-white font-bold text-lg mb-4">관리자 로그인 완료</h3>
                                            <button onClick={() => setView('ADMIN_DASH')} className="w-full py-3 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-500 transition-all">대시보드 입장</button>
                                        </div>
                                    ) : (
                                        <div className="space-y-4">
                                            <input type="password" className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg px-4 py-3 text-slate-900 dark:text-white outline-none" placeholder="관리자 비밀번호" value={adminInput} onChange={e => setAdminInput(e.target.value)} />
                                            <button onClick={handleAdminLogin} className="w-full py-3 bg-indigo-600 text-white rounded-lg font-bold">Login</button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Join Modal */}
                    {showNameModal && (
                        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/50 dark:bg-black/80 backdrop-blur-sm p-6">
                            <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl w-full max-w-sm border border-indigo-500/50 shadow-2xl animate-slide-up">
                                <h3 className="text-slate-900 dark:text-white font-bold text-xl mb-4">참가자 이름 입력</h3>
                                <input 
                                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg px-4 py-3 text-slate-900 dark:text-white mb-4 focus:border-indigo-500 outline-none" 
                                    placeholder="이름을 입력하세요"
                                    value={joinName}
                                    onChange={e => setJoinName(e.target.value)}
                                    autoFocus
                                />
                                <div className="flex gap-2">
                                    <button onClick={() => setShowNameModal(false)} className="flex-1 py-3 bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-gray-400 rounded-lg font-bold">취소</button>
                                    <button onClick={confirmJoin} className="flex-1 py-3 bg-indigo-600 text-white rounded-lg font-bold">입장하기</button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            );
        }

        if (view === 'ADMIN_DASH') {
            if (currentRoomId) {
                const room = rooms.find(r => r.id === currentRoomId);
                if (!room) return <div className="p-10 text-slate-900 dark:text-white">Room not found</div>;
                return <AdminDashboard room={room} onUpdate={updateRoom} onBack={() => setCurrentRoomId(null)} onEnterTeam={(teamId) => { setCurrentTeamId(teamId); setIsAdminVisiting(true); setView('USER_GAME'); }} />;
            }
            return (
                <div className="max-w-4xl mx-auto p-4 mt-8 animate-fade-in pb-20 relative z-10">
                    <div className="flex justify-between items-center mb-8">
                        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">게임방 관리</h2>
                        <button onClick={() => setView('LANDING')} className="text-sm border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white px-4 py-2 rounded bg-white/50 dark:bg-slate-900/50">메인으로</button>
                    </div>
                    <div className="glass-panel p-6 rounded-2xl mb-8 border border-slate-300 dark:border-slate-700 shadow-xl bg-white/50 dark:bg-slate-900/50">
                        <h3 className="text-lg font-bold text-indigo-600 dark:text-indigo-400 mb-4">새 게임방 만들기</h3>
                        <form onSubmit={(e) => {
                            e.preventDefault();
                            const form = e.target as HTMLFormElement;
                            const name = (form.elements.namedItem('roomName') as HTMLInputElement).value;
                            const teams = parseInt((form.elements.namedItem('teamCount') as HTMLSelectElement).value);
                            createRoom(name, teams);
                            form.reset();
                        }} className="flex flex-col md:flex-row gap-4 items-end">
                            <div className="flex-1 w-full">
                                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">방 이름</label>
                                <input name="roomName" required className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white outline-none" placeholder="예: 1반 전략게임" />
                            </div>
                            <div className="w-full md:w-32">
                                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">팀 수 (짝수)</label>
                                <select name="teamCount" className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white outline-none">
                                    {[2, 4, 6, 8, 10, 12, 14, 16, 18, 20].map(n => <option key={n} value={n}>{n}팀</option>)}
                                </select>
                            </div>
                            <button type="submit" className="px-6 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg font-bold">생성</button>
                        </form>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {rooms.map(room => (
                            <div key={room.id} className="relative group p-5 bg-white/80 dark:bg-slate-800/80 rounded-xl border border-slate-300 dark:border-slate-700 hover:border-indigo-500 transition-all cursor-pointer shadow-sm backdrop-blur-sm" onClick={() => setCurrentRoomId(room.id)}>
                                <div className="font-bold text-lg text-slate-900 dark:text-white flex justify-between">{room.name} <span className="text-xs bg-slate-200 dark:bg-slate-700 px-2 py-1 rounded">{room.status}</span></div>
                                <div className="text-sm text-gray-500 dark:text-gray-400 mt-2">Teams: {room.teams.length}</div>
                                <button onClick={(e) => { e.stopPropagation(); deleteRoom(room.id); }} className="absolute top-4 right-4 text-gray-400 hover:text-red-500">🗑</button>
                            </div>
                        ))}
                    </div>
                </div>
            );
        }

        if (view === 'USER_GAME' && currentRoomId && currentTeamId) {
            const room = rooms.find(r => r.id === currentRoomId);
            if (room) {
                return <UserGameView room={room} teamId={currentTeamId} onUpdate={updateRoom} isAdminMode={isAdminVisiting} onBackToDash={() => setView(isAdminVisiting ? 'ADMIN_DASH' : 'LANDING')} />;
            }
        }
        return <div>Error</div>;
    };

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white font-sans selection:bg-indigo-500 selection:text-white overflow-x-hidden touch-manipulation transition-colors duration-500 relative">
             <MatrixBackground isDarkMode={darkMode} />
             {/* Global Theme Toggle - Moved to Bottom Right for Mobile Landscape Safety */}
             <div className="fixed bottom-4 right-4 z-[9999]">
                <button 
                    onClick={() => setDarkMode(!darkMode)}
                    className="p-2 rounded-full bg-white/20 backdrop-blur-md border border-white/20 text-xs font-bold hover:bg-white/30 transition-all text-slate-800 dark:text-white shadow-lg"
                >
                    {darkMode ? '☀️ Light' : '🌙 Dark'}
                </button>
             </div>
            {renderContent()}
        </div>
    );
};

export default App;
