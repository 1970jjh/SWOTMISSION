
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Room, Team, ADMIN_PW, Match, RoundStrategy, RoundResult, CARDS, TOTAL_ROUNDS, TOTAL_CHIPS } from './types';
import { generateSWOTAnalysis, generateWinnerPoster, getGameAdvice } from './services/geminiService';
import { saveRoomsToFirebase, subscribeToRooms, isFirebaseConfigured } from './services/firebase';
import MatrixBackground from './components/MatrixBackground';

declare var html2pdf: any; // Declare global for CDN library

// --- Helper Functions ---
// Note: saveRooms now uses Firebase for real-time sync across devices
const saveRooms = (rooms: Room[]) => {
    // Save to Firebase (async) - this will sync across all devices
    saveRoomsToFirebase(rooms);
};

// getRooms is now only used for initial load fallback
// Real-time updates come through subscribeToRooms
const getRooms = (): Room[] => {
    try {
        const data = localStorage.getItem('swot_game_rooms');
        return data ? JSON.parse(data) : [];
    } catch {
        return [];
    }
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
    onDragStart,
    onCardDoubleClick
}: {
    strategy: RoundStrategy[],
    onSetChips?: (r: number, d: number) => void,
    readOnly: boolean,
    opponentName?: string,
    currentRound?: number,
    blindMode?: boolean,
    revealedHistory?: number[],
    onDragStart?: (e: React.PointerEvent, card: number, source: string) => void,
    onCardDoubleClick?: (roundIdx: number) => void
}) => {

    return (
        <div className={`w-full h-full flex flex-col`}>
            {opponentName && (
                <div className="text-center py-0.5 flex items-center justify-center shrink-0">
                    <span className="bg-red-600 text-white text-[10px] px-2 py-0.5 rounded-full font-bold shadow-lg">VS {opponentName}</span>
                </div>
            )}
            <div className={`flex-1 bg-blue-600/90 backdrop-blur-sm rounded-lg p-1 shadow-2xl border-2 ${opponentName ? 'border-red-400 bg-red-900/40' : 'border-blue-400'} relative flex flex-col overflow-hidden`}>
                <div className="flex flex-1 gap-px overflow-x-auto items-stretch z-10 no-scrollbar">
                    {strategy.map((round, idx) => {
                        const isRoundActive = currentRound === (idx + 1);
                        const isPast = currentRound && (idx + 1) < currentRound;
                        const isRevealed = revealedHistory.includes(idx + 1);
                        const shouldHideNumber = blindMode && !isRevealed;

                        return (
                            <div
                                key={round.round}
                                className={`relative flex-1 min-w-[32px] flex flex-col items-center justify-evenly py-0.5 px-0.5 rounded border
                                    ${isRoundActive ? 'bg-yellow-500/30 border-yellow-400 ring-1 ring-yellow-400 z-20' : 'bg-blue-700/50 border-blue-500/30'}
                                    ${isPast ? 'opacity-50 grayscale' : ''}
                                `}
                                data-drop-zone="round"
                                data-round-index={idx}
                            >
                                {/* Round Number */}
                                <div className={`font-bold text-[8px] leading-none shrink-0 ${isRoundActive ? 'text-yellow-300' : 'text-blue-100'}`}>
                                    R{round.round}
                                </div>

                                {/* Card Slot */}
                                <div
                                    onPointerDown={(e) => {
                                        if(!readOnly && round.card !== -1 && onDragStart) {
                                            onDragStart(e, round.card, idx.toString());
                                        }
                                    }}
                                    onDoubleClick={() => {
                                        if(!readOnly && round.card !== -1 && onCardDoubleClick) {
                                            onCardDoubleClick(idx);
                                        }
                                    }}
                                    className={`
                                        w-6 h-8 rounded flex items-center justify-center shadow-md border select-none shrink-0
                                        ${getCardStyle(round.card, false, shouldHideNumber)}
                                        ${!readOnly && round.card !== -1 ? 'cursor-pointer hover:ring-2 hover:ring-red-400' : ''}
                                        ${!readOnly ? 'cursor-grab active:cursor-grabbing' : ''}
                                    `}
                                    title={!readOnly && round.card !== -1 ? "더블클릭으로 카드 제거" : ""}
                                >
                                    {round.card !== -1 ? (
                                        shouldHideNumber ? (
                                            <span className="text-[10px] opacity-50">?</span>
                                        ) : (
                                            <span className="text-sm font-black">{round.card}</span>
                                        )
                                    ) : (
                                        <span className="text-sm font-bold opacity-20"></span>
                                    )}
                                </div>

                                {/* Chips */}
                                <div className="flex flex-col items-center w-full gap-px shrink-0">
                                    <div className="w-5 h-5 rounded-full bg-gradient-to-r from-yellow-400 to-yellow-600 border border-white/30 shadow flex items-center justify-center">
                                        <span className="text-[8px] font-black text-black leading-none">{round.chips}</span>
                                    </div>

                                    {!readOnly && onSetChips && (
                                        <div className="flex items-center gap-px bg-blue-800/60 rounded-full p-px border border-blue-400/30">
                                            <button
                                                onClick={() => onSetChips(idx, -1)}
                                                className="w-4 h-4 rounded-full bg-blue-900 text-white flex items-center justify-center text-[9px] font-bold hover:bg-blue-800"
                                            >
                                                -
                                            </button>
                                            <button
                                                onClick={() => onSetChips(idx, 1)}
                                                className="w-4 h-4 rounded-full bg-indigo-500 text-white flex items-center justify-center text-[9px] font-bold hover:bg-indigo-400"
                                            >
                                                +
                                            </button>
                                        </div>
                                    )}
                                    {readOnly && (
                                        <div className="text-[7px] font-bold text-yellow-300">{round.chips}억</div>
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

const AdminDashboard = ({ room, onUpdate, onBack, onEnterTeam, onDelete }: { room: Room, onUpdate: (r: Room) => void, onBack: () => void, onEnterTeam: (teamId: string) => void, onDelete: (id: string) => void }) => {
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
                margin: [0.3, 0.3, 0.3, 0.3],
                filename: `SWOT_Analysis_${room.name}.pdf`,
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: {
                    scale: 2,
                    useCORS: true,
                    logging: false,
                    letterRendering: true
                },
                jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' },
                pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
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

    // Helper to calculate rounds won for each team
    const getTeamRoundsWon = (teamId: string): { count: number, rounds: number[] } => {
        const wonRounds: number[] = [];

        room.matches.forEach(match => {
            const isTeamA = match.teamAId === teamId;
            const isTeamB = match.teamBId === teamId;

            if (!isTeamA && !isTeamB) return;

            match.history?.forEach(h => {
                const teamWon = (isTeamA && (h.result === 'A_WON' || h.result === 'B_FOLDED')) ||
                               (isTeamB && (h.result === 'B_WON' || h.result === 'A_FOLDED'));
                if (teamWon) {
                    wonRounds.push(h.round);
                }
            });
        });

        return { count: wonRounds.length, rounds: wonRounds.sort((a, b) => a - b) };
    };

    // Download poster image
    const handleDownloadPoster = () => {
        if (room.winnerPosterUrl) {
            const link = document.createElement('a');
            link.href = room.winnerPosterUrl;
            link.download = `Winner_Poster_${room.name}.png`;
            link.click();
        }
    };

    return (
        <div className="p-4 md:p-8 max-w-[1600px] mx-auto animate-fade-in pb-20 relative z-10">
            <header className="flex justify-between items-center mb-6">
                <h2 className="text-xl md:text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-500 to-pink-500">SWOT 전략 미션 - {room.name}</h2>
                <div className="flex gap-2">
                    <button onClick={() => onDelete(room.id)} className="text-red-500 hover:text-white hover:bg-red-500 border border-red-500/30 px-3 py-1 rounded-lg text-sm transition-colors">방 삭제</button>
                    <button onClick={onBack} className="text-gray-500 dark:text-gray-400 border border-slate-300 dark:border-slate-700 bg-white/50 dark:bg-slate-900/50 px-3 py-1 rounded-lg text-sm">나가기</button>
                </div>
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
                                        <span className={`text-xs font-bold px-2 py-1 rounded ${isMatchActive ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                                            {isMatchActive ? `R${match.currentRound} 진행중` : 'Finished'}
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
                <div className="space-y-4">
                     <div className="bg-slate-100/80 dark:bg-slate-800/80 backdrop-blur-md p-6 rounded-xl border border-slate-300 dark:border-slate-700">
                         <div className="flex justify-between items-center mb-4">
                             <h3 className="text-lg font-bold text-slate-900 dark:text-white">🏆 우승팀 포스터 & 피드백</h3>
                             <div className="flex gap-2">
                                 {room.winnerPosterUrl && (
                                     <button onClick={handleDownloadPoster} className="bg-purple-600 text-white px-3 py-1 rounded text-sm hover:bg-purple-500">포스터 다운로드</button>
                                 )}
                                 <button onClick={handleDownloadPDF} className="bg-slate-700 text-white px-3 py-1 rounded text-sm hover:bg-slate-600">PDF 다운로드</button>
                             </div>
                         </div>

                         {/* PDF Export Container */}
                         <div id="report-container" className="bg-white p-4 rounded-xl text-black">
                             {/* PAGE 1: Final Standings + Winner Poster */}
                             <div style={{ pageBreakInside: 'avoid', pageBreakAfter: room.feedback ? 'always' : 'auto' }}>
                                 {/* Team Standings Table */}
                                 <div className="mb-4" style={{ pageBreakInside: 'avoid' }}>
                                     <h4 className="text-xl font-bold text-slate-900 mb-3 border-b-2 border-slate-200 pb-1">📊 최종 성적 (Final Standings)</h4>
                                     <table className="w-full text-sm text-left border-collapse">
                                         <thead>
                                             <tr className="bg-slate-100 text-slate-700">
                                                 <th className="p-2 border">Rank</th>
                                                 <th className="p-2 border">Team</th>
                                                 <th className="p-2 border">Members</th>
                                                 <th className="p-2 border">Winnings (억)</th>
                                                 <th className="p-2 border">Rounds Won</th>
                                             </tr>
                                         </thead>
                                         <tbody>
                                             {[...room.teams].sort((a,b) => b.winnings - a.winnings).map((team, idx) => {
                                                 const roundsData = getTeamRoundsWon(team.id);
                                                 return (
                                                     <tr key={team.id} className="border-b">
                                                         <td className="p-2 border font-bold text-center">{idx+1}</td>
                                                         <td className="p-2 border font-bold">{team.name}</td>
                                                         <td className="p-2 border text-gray-600">{team.members.join(', ')}</td>
                                                         <td className="p-2 border font-bold text-yellow-700">{team.winnings}</td>
                                                         <td className="p-2 border">
                                                             <span className="font-bold text-blue-600">{roundsData.count}승</span>
                                                             {roundsData.rounds.length > 0 && (
                                                                 <span className="text-gray-500 text-xs ml-1">
                                                                     (R{roundsData.rounds.join(', R')})
                                                                 </span>
                                                             )}
                                                         </td>
                                                     </tr>
                                                 );
                                             })}
                                         </tbody>
                                     </table>
                                 </div>

                                 {/* Winner Poster - Always show if exists */}
                                 {room.winnerPosterUrl && (
                                     <div className="text-center mt-4" style={{ pageBreakInside: 'avoid' }}>
                                         <h4 className="text-2xl font-black text-slate-900 mb-3">🏆 WINNER POSTER</h4>
                                         <img src={room.winnerPosterUrl} alt="Winner" style={{ maxWidth: '380px', maxHeight: '500px', objectFit: 'contain', pageBreakInside: 'avoid' }} className="mx-auto rounded-xl shadow-2xl border-4 border-yellow-500" />
                                     </div>
                                 )}
                             </div>

                             {/* PAGE 2+: AI Strategy Analysis */}
                             {room.feedback && (
                                 <div className="mt-6" style={{ pageBreakBefore: 'always' }}>
                                     <h4 className="text-xl font-bold text-slate-900 mb-3 border-b-2 border-slate-200 pb-1" style={{ pageBreakAfter: 'avoid' }}>🤖 AI Strategy Analysis</h4>
                                     <div
                                         dangerouslySetInnerHTML={{ __html: room.feedback }}
                                         className="prose max-w-none font-sans text-sm leading-relaxed pdf-analysis-content"
                                         style={{
                                             lineHeight: '1.6',
                                             wordBreak: 'keep-all',
                                             overflowWrap: 'break-word'
                                         }}
                                     />
                                 </div>
                             )}
                         </div>

                         {/* Control Panel (Hidden in PDF via ID separation) */}
                         <div className="mt-6 bg-white/70 dark:bg-slate-900/70 p-4 rounded-lg print:hidden border border-slate-300 dark:border-slate-600">
                             <div className="flex gap-4">
                                 <div className="flex-1">
                                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-2">우승팀 사진 (다중 선택 가능)</label>
                                    <FileUpload onUpload={setPhotos} />
                                    <div className="flex gap-1 mt-2 overflow-x-auto">
                                        {photos.map((p, i) => <img key={i} src={p} className="h-10 w-10 object-cover rounded border border-slate-600" />)}
                                    </div>
                                 </div>
                                 <div className="flex-1">
                                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">팀원 이름 (포스터에 표시됨)</label>
                                    <input className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-3 py-2 text-slate-900 dark:text-white" placeholder="예: 홍길동, 김철수, 이영희" value={winnerNames} onChange={e=>setWinnerNames(e.target.value)} />
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
    const [neededChips, setNeededChips] = useState(0);
    const [submitConfirmOpen, setSubmitConfirmOpen] = useState(false);
    
    // Multi-Round Steal Logic State
    const [stealModalOpen, setStealModalOpen] = useState(false);
    const [tempStrategy, setTempStrategy] = useState<RoundStrategy[]>([]); // To track changes in modal before confirming

    const currentDragItem = useRef<DragItem | null>(null);

    // Derived State Variables - Define BEFORE usage
    const isMyTurn = myMatch?.turnOwner === teamId;
    const isBlindMode = true; 
    const revealedRounds = myMatch?.history?.map(h => h.round) || [];
    
    // Add current round to revealed if shown
    if (myMatch && (myMatch.roundStatus === 'SHOWDOWN' || myMatch.roundStatus === 'FINISHED')) {
        if (myMatch.currentRound && !revealedRounds.includes(myMatch.currentRound)) {
            revealedRounds.push(myMatch.currentRound);
        }
    }

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

    // ... (Game Engine Logic, Update Functions, Actions same as before) ...
    // Only Team A triggers state transitions to prevent race conditions
    useEffect(() => {
        if (room.status !== 'PLAYING' || !myMatch || !team || !opponentTeam) return;
        // Only Team A handles state transitions from READY to DECISION/SHOWDOWN
        if (!isTeamA) return;

        const myStrat = team.strategy![myMatch.currentRound - 1];
        const oppStrat = opponentTeam.strategy![myMatch.currentRound - 1];

        if (myMatch.roundStatus === 'READY') {
            // Small delay to ensure Firebase sync is complete
            const timer = setTimeout(() => {
                if (myStrat.chips === oppStrat.chips) {
                    updateMatchState({ roundStatus: 'SHOWDOWN' });
                } else {
                    const fewerChipsTeamId = myStrat.chips < oppStrat.chips ? team.id : opponentTeam.id;
                    updateMatchState({ roundStatus: 'DECISION', turnOwner: fewerChipsTeamId });
                }
            }, 100);
            return () => clearTimeout(timer);
        }
    }, [room.status, myMatch?.currentRound, myMatch?.roundStatus, myMatch?.pot, isTeamA]);

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
        const updatedTeams = room.teams.map(t => t.id === opponentTeam!.id ? updatedOpponent : t);
        // Go to RESULT status for both teams to confirm
        updateTeamsAndMatch(updatedTeams, {
            roundStatus: 'RESULT',
            turnOwner: undefined,
            lastAction: { teamId, action: 'FOLD' },
            lastRoundResult: historyItem as any,
            resultConfirmed: {},
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
            updateTeamsAndMatch(updatedTeams, {
                roundStatus: 'SHOWDOWN',
                turnOwner: undefined,
                lastAction: { teamId, action: 'CALL' }
            });
        } else {
            setNeededChips(diff - winnings);
            setTempStrategy(JSON.parse(JSON.stringify(team!.strategy))); // Clone for modal
            setStealModalOpen(true);
        }
    };

    const adjustTempChips = (roundIdx: number, delta: number) => {
        setTempStrategy(prev => {
            const next = [...prev];
            const current = next[roundIdx].chips;
            const newVal = current + delta;
            if (newVal < 1) return prev; // Cannot go below 1 chip

            // Prevent stealing more than needed
            if (delta < 0) {
                // Calculate current stolen amount with this change
                let wouldSteal = 0;
                next[roundIdx] = { ...next[roundIdx], chips: newVal };
                team!.strategy!.forEach((s, i) => {
                    if (i >= myMatch.currentRound && next[i]) {
                        wouldSteal += (s.chips - next[i].chips);
                    }
                });
                // If stealing would exceed needed amount, prevent it
                if (wouldSteal > neededChips) {
                    return prev;
                }
            }

            next[roundIdx] = { ...next[roundIdx], chips: newVal };
            return next;
        });
    };

    const confirmSteal = () => {
        // Calculate total stolen from future rounds
        const currentRoundIdx = myMatch.currentRound - 1;
        let stolenTotal = 0;
        team!.strategy!.forEach((s, i) => {
            if (i > currentRoundIdx) {
                const diff = s.chips - tempStrategy[i].chips;
                if (diff > 0) stolenTotal += diff;
            }
        });

        // Winnings + Stolen must cover neededChips
        const totalAvailable = (team!.winnings || 0) + stolenTotal;
        const diff = (opponentTeam!.strategy![currentRoundIdx].chips - team!.strategy![currentRoundIdx].chips);
        
        // Final update to current round chips
        const newCurrentChips = tempStrategy[currentRoundIdx].chips + diff;
        const updatedStrategy = [...tempStrategy];
        updatedStrategy[currentRoundIdx].chips = newCurrentChips;

        const updatedTeam = {
            ...team!,
            winnings: 0, // Drained winnings
            strategy: updatedStrategy
        };
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
        else {
            // Draw - chips carry over to next round, or return on last round
            if (currentRound === TOTAL_ROUNDS) {
                // Last round draw: each team takes back their own chips
                winningsA += stratA.chips + ((myMatch.carryOver || 0) / 2);
                winningsB += stratB.chips + ((myMatch.carryOver || 0) / 2);
            } else {
                carryOver = pot;
            }
        }
        const historyItem = { round: currentRound, teamACard: stratA.card, teamBCard: stratB.card, teamAChips: stratA.chips, teamBChips: stratB.chips, result: winner === 'A' ? 'A_WON' : (winner === 'B' ? 'B_WON' : 'DRAW'), potWon: winner === 'DRAW' ? 0 : pot };
        const updatedTeamA = { ...teamA, winnings: winningsA };
        const updatedTeamB = { ...teamB, winnings: winningsB };
        const updatedTeams = room.teams.map(t => t.id === teamA.id ? updatedTeamA : (t.id === teamB.id ? updatedTeamB : t));

        // Go to RESULT status for both teams to confirm
        updateTeamsAndMatch(updatedTeams, {
            roundStatus: 'RESULT',
            turnOwner: undefined,
            pot: 0,
            carryOver,
            teamAScore: scoreA,
            teamBScore: scoreB,
            lastRoundResult: historyItem as any,
            resultConfirmed: {},
            history: [...(myMatch.history || []), historyItem as any]
        });
    };

    // Confirm round result and proceed to next round when both teams confirm
    const handleConfirmResult = () => {
        const confirmed = { ...(myMatch.resultConfirmed || {}), [teamId]: true };
        const bothConfirmed = confirmed[myMatch.teamAId] && confirmed[myMatch.teamBId];
        const nextRound = myMatch.currentRound + 1;
        const isGameEnd = nextRound > TOTAL_ROUNDS;

        if (bothConfirmed) {
            // Both teams confirmed, move to next round
            updateMatchState({
                currentRound: isGameEnd ? myMatch.currentRound : nextRound,
                roundStatus: isGameEnd ? 'FINISHED' : 'READY',
                resultConfirmed: {},
                lastRoundResult: undefined,
                lastAction: undefined
            });
        } else {
            // Just mark this team as confirmed
            updateMatchState({ resultConfirmed: confirmed });
        }
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

    // Double-click to remove card from round
    const handleCardDoubleClick = (roundIdx: number) => {
        if (room.status !== 'PREPARING' && !isAdminMode) return;
        setStrategy(prev => {
            const next = prev.map(p => ({...p}));
            next[roundIdx].card = -1;
            return next;
        });
    };

    if (!team) return <div>Loading...</div>;

    // Calculate stolen amount for modal
    const calculateStolenAmount = () => {
        if (!team?.strategy || !myMatch || tempStrategy.length === 0) return 0;
        let total = 0;
        team.strategy.forEach((s, i) => {
            if (i >= myMatch.currentRound && tempStrategy[i]) {
                total += (s.chips - tempStrategy[i].chips);
            }
        });
        return total;
    };
    const currentStolen = calculateStolenAmount();
    const canConfirmSteal = currentStolen >= neededChips;

    return (
        <div className="w-full max-w-7xl mx-auto min-h-screen h-[100dvh] flex flex-col p-2 md:p-4 overflow-hidden bg-slate-50/80 dark:bg-slate-950/80 backdrop-blur-sm relative touch-none selection:bg-none transition-colors z-10" onPointerUp={handleDrop}>
            <DragOverlay />
            
            {/* ... (Header, PREPARING view, Game View same as before) ... */}
            <header className="flex justify-between items-start mb-2 shrink-0 pl-8">
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
                    {room.status === 'PLAYING' && opponentTeam && (
                        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 px-2 py-1 rounded-lg text-[10px] sm:text-xs font-bold">
                            <span className="text-red-500">{opponentTeam.name?.slice(0,4)}: <span className="text-red-600 dark:text-red-400">{opponentTeam.winnings || 0}억</span></span>
                            <span className="text-gray-400 mx-0.5">vs</span>
                            <span className="text-blue-500">나: <span className="text-blue-600 dark:text-blue-400 font-black">{team.winnings || 0}억</span></span>
                        </div>
                    )}
                    {room.status === 'PREPARING' && (
                        <span className="px-2 py-1 rounded-full text-[10px] font-bold bg-yellow-100 dark:bg-yellow-500/20 text-yellow-600 dark:text-yellow-500">
                            {room.status}
                        </span>
                    )}
                </div>
            </header>

            {room.status === 'PREPARING' && (
                <div className="flex-1 flex flex-col min-h-0">
                     {/* Stats Bar */}
                     <div className="grid grid-cols-3 gap-1 sm:gap-2 mb-1 shrink-0">
                        <div className="bg-white/80 dark:bg-slate-800/80 p-1.5 sm:p-2 rounded-xl border border-slate-200 dark:border-slate-700 text-center shadow-sm">
                            <span className="text-[9px] sm:text-[10px] text-gray-500 dark:text-gray-400">자본금 잔액</span>
                            <div className={`text-base sm:text-xl font-black ${remainingChips < 0 ? 'text-red-500' : 'text-slate-900 dark:text-white'}`}>{remainingChips}억</div>
                        </div>
                        <div className="bg-white/80 dark:bg-slate-800/80 p-1.5 sm:p-2 rounded-xl border border-slate-200 dark:border-slate-700 text-center shadow-sm">
                             <span className="text-[9px] sm:text-[10px] text-gray-500 dark:text-gray-400">카드 사용</span>
                             <div className="text-base sm:text-xl font-black text-slate-900 dark:text-white">{usedCards.length}/10</div>
                        </div>
                        <button
                            onClick={handleSubmitStrategy}
                            className={`rounded-xl font-bold text-xs sm:text-sm shadow-xl flex flex-col items-center justify-center transition-all ${team.isReady ? 'bg-green-100 dark:bg-green-600/20 text-green-600 dark:text-green-500 border-2 border-green-500' : 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:scale-105 active:scale-95'}`}
                        >
                            <span>{team.isReady ? "제출 완료" : "전략 제출"}</span>
                            <span className="text-[9px] sm:text-[10px] font-normal opacity-80">Ready to Go</span>
                        </button>
                    </div>

                    {/* Game Board */}
                    <div className="flex-1 min-h-[120px] max-h-[200px] sm:max-h-[280px] mb-1">
                        <BlueGameBoard strategy={strategy} onSetChips={handleSetChips} readOnly={team.isReady && !isAdminMode} onDragStart={handleDragStart} onCardDoubleClick={handleCardDoubleClick} />
                    </div>

                    {/* Card Deck - Fixed at bottom */}
                    {(!team.isReady || isAdminMode) && (
                        <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur border-t border-slate-200 dark:border-slate-800 p-2 rounded-t-xl shrink-0 z-20">
                            <div className="flex justify-between gap-0.5 sm:gap-1 max-w-3xl mx-auto">
                                {CARDS.map(c => {
                                    const isUsed = usedCards.includes(c);
                                    return <div key={c} onPointerDown={(e) => !isUsed && handleDragStart(e, c, 'deck')} className={`flex-1 aspect-[2/3] max-w-[36px] sm:max-w-[50px] rounded font-bold text-base sm:text-xl shadow-md flex items-center justify-center transition-all ${getCardStyle(c, true)} ${isUsed ? 'opacity-20 cursor-default' : 'cursor-grab active:cursor-grabbing'}`}>{c}</div>;
                                })}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {(room.status === 'PLAYING' || room.status === 'FINISHED') && opponentTeam && myMatch && (
                <div className="flex-1 flex flex-col min-h-0 relative">
                    {/* Status overlay - only during active game */}
                    {myMatch.roundStatus !== 'FINISHED' && myMatch.roundStatus !== 'RESULT' && (
                        <div className="absolute top-[40%] left-1/2 -translate-x-1/2 -translate-y-1/2 z-30 pointer-events-none w-full text-center px-4">
                             {myMatch.roundStatus === 'DECISION' && <div className="bg-black/80 backdrop-blur-md text-white py-2 px-4 rounded-full inline-block border border-yellow-500 animate-pulse text-xs sm:text-sm">{isMyTurn ? "당신의 결정 차례입니다!" : `${opponentTeam.name}의 결정을 기다리는 중...`}</div>}
                             {myMatch.roundStatus === 'SHOWDOWN' && <button onClick={handleShowdown} className="pointer-events-auto bg-red-600 text-white font-black text-sm sm:text-xl py-2 px-4 sm:py-3 sm:px-8 rounded-full shadow-[0_0_20px_rgba(220,38,38,0.6)] animate-bounce border-2 sm:border-4 border-white">SHOWDOWN!</button>}
                        </div>
                    )}

                    {/* Opponent Action Notification */}
                    {myMatch.lastAction && myMatch.lastAction.teamId !== teamId && myMatch.roundStatus === 'SHOWDOWN' && (
                        <div className="absolute top-2 left-1/2 -translate-x-1/2 z-40 animate-bounce">
                            <div className={`px-4 py-2 rounded-full text-white text-sm font-bold shadow-lg ${myMatch.lastAction.action === 'FOLD' ? 'bg-gray-600' : 'bg-red-600'}`}>
                                {myMatch.lastAction.action === 'FOLD'
                                    ? `🏳️ ${opponentTeam.name}이(가) 포기했습니다!`
                                    : `⚔️ ${opponentTeam.name}이(가) 승부를 선택했습니다!`}
                            </div>
                        </div>
                    )}

                    {/* Game Boards Container - Scrollable */}
                    <div className="flex-1 flex flex-col gap-1 overflow-y-auto min-h-0 pb-1">
                        {/* Game Finished Header */}
                        {myMatch.roundStatus === 'FINISHED' && (
                            <div className="text-center py-2 shrink-0">
                                <span className="text-sm font-bold text-yellow-600 dark:text-yellow-400 bg-yellow-100 dark:bg-yellow-900/50 px-4 py-1.5 rounded-full shadow">🏆 경기 종료 - 전체 결과 🏆</span>
                            </div>
                        )}

                        {/* Opponent Board */}
                        <div className={`${myMatch.roundStatus === 'FINISHED' ? 'min-h-[120px]' : 'flex-1 min-h-[100px] max-h-[140px] sm:max-h-[180px]'} bg-slate-100/50 dark:bg-slate-900/50 backdrop-blur rounded-xl border border-red-500/30 overflow-hidden relative`}>
                             <div className="absolute top-1 right-2 z-20"><span className="text-[9px] sm:text-[10px] bg-slate-900/70 text-white px-2 py-0.5 rounded-full border border-red-500/30">상대: <span className="text-yellow-400 font-bold">{opponentTeam.winnings}억</span></span></div>
                             <BlueGameBoard
                                 strategy={opponentTeam.strategy || []}
                                 readOnly={true}
                                 opponentName={opponentTeam.name}
                                 currentRound={myMatch.roundStatus === 'FINISHED' ? undefined : myMatch.currentRound}
                                 blindMode={myMatch.roundStatus === 'FINISHED' ? false : isBlindMode}
                                 revealedHistory={myMatch.roundStatus === 'FINISHED' ? [1,2,3,4,5,6,7,8,9,10] : revealedRounds}
                             />
                        </div>

                        {/* POT Info - Only during active game */}
                        {myMatch.roundStatus !== 'FINISHED' && (
                            <div className="h-7 flex items-center justify-between px-3 bg-white/90 dark:bg-slate-900/90 backdrop-blur shrink-0 border border-slate-200 dark:border-slate-700 rounded-lg">
                                 <div className="text-gray-500 dark:text-gray-400 text-[10px] font-medium">R{myMatch.currentRound}/10</div>
                                 <div className="flex items-center gap-1">
                                     <span className="text-[10px] text-gray-500">POT:</span>
                                     <span className="text-yellow-600 dark:text-yellow-400 font-black text-sm">{(team.strategy![myMatch.currentRound-1].chips + opponentTeam.strategy![myMatch.currentRound-1].chips + (myMatch.carryOver||0))}억</span>
                                 </div>
                                 <div className="text-gray-500 dark:text-gray-400 text-[10px]">Carry: {myMatch.carryOver || 0}</div>
                            </div>
                        )}

                        {/* My Board */}
                        <div className={`${myMatch.roundStatus === 'FINISHED' ? 'min-h-[120px]' : 'flex-1 min-h-[100px] max-h-[140px] sm:max-h-[180px]'} bg-slate-100/50 dark:bg-slate-900/50 backdrop-blur rounded-xl border border-blue-500/30 overflow-hidden relative`}>
                            <div className="absolute top-1 right-2 z-20"><span className="text-[9px] sm:text-[10px] bg-slate-900/70 text-white px-2 py-0.5 rounded-full border border-blue-500/30">나: <span className="text-yellow-400 font-bold">{team.winnings}억</span></span></div>
                            <BlueGameBoard
                                strategy={team.strategy || []}
                                readOnly={true}
                                currentRound={myMatch.roundStatus === 'FINISHED' ? undefined : myMatch.currentRound}
                                blindMode={false}
                                revealedHistory={myMatch.roundStatus === 'FINISHED' ? [1,2,3,4,5,6,7,8,9,10] : revealedRounds}
                            />
                        </div>

                        {/* Game Results Section - Scrollable at bottom when FINISHED */}
                        {myMatch.roundStatus === 'FINISHED' && (
                            <div className="bg-gradient-to-r from-yellow-500/20 via-amber-500/20 to-yellow-500/20 backdrop-blur rounded-xl border-2 border-yellow-500 p-4 mt-2">
                                <div className="text-center mb-3">
                                    <span className="text-sm font-bold text-slate-900 dark:text-white">📊 최종 결과</span>
                                </div>
                                <div className="flex items-center justify-between gap-3">
                                    {/* Opponent Result */}
                                    <div className={`flex-1 p-3 rounded-xl text-center ${(opponentTeam.winnings || 0) > (team.winnings || 0) ? 'bg-red-500/30 border-2 border-red-500 ring-2 ring-red-400' : 'bg-slate-200/50 dark:bg-slate-700/50 border border-slate-300 dark:border-slate-600'}`}>
                                        <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">{opponentTeam.name}</div>
                                        <div className={`text-2xl font-black ${(opponentTeam.winnings || 0) > (team.winnings || 0) ? 'text-red-600 dark:text-red-400' : 'text-slate-600 dark:text-slate-300'}`}>
                                            {opponentTeam.winnings || 0}억
                                        </div>
                                        {(opponentTeam.winnings || 0) > (team.winnings || 0) && <div className="text-xs text-red-500 font-bold mt-1">🥇 승리</div>}
                                        {(opponentTeam.winnings || 0) === (team.winnings || 0) && <div className="text-xs text-gray-500 font-bold mt-1">🤝 무승부</div>}
                                        {(opponentTeam.winnings || 0) < (team.winnings || 0) && <div className="text-xs text-gray-400 mt-1">패배</div>}
                                    </div>

                                    <div className="text-2xl font-black text-gray-400">VS</div>

                                    {/* My Result */}
                                    <div className={`flex-1 p-3 rounded-xl text-center ${(team.winnings || 0) > (opponentTeam.winnings || 0) ? 'bg-blue-500/30 border-2 border-blue-500 ring-2 ring-blue-400' : 'bg-slate-200/50 dark:bg-slate-700/50 border border-slate-300 dark:border-slate-600'}`}>
                                        <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">{team.name} (나)</div>
                                        <div className={`text-2xl font-black ${(team.winnings || 0) > (opponentTeam.winnings || 0) ? 'text-blue-600 dark:text-blue-400' : 'text-slate-600 dark:text-slate-300'}`}>
                                            {team.winnings || 0}억
                                        </div>
                                        {(team.winnings || 0) > (opponentTeam.winnings || 0) && <div className="text-xs text-blue-500 font-bold mt-1">🥇 승리</div>}
                                        {(team.winnings || 0) === (opponentTeam.winnings || 0) && <div className="text-xs text-gray-500 font-bold mt-1">🤝 무승부</div>}
                                        {(team.winnings || 0) < (opponentTeam.winnings || 0) && <div className="text-xs text-gray-400 mt-1">패배</div>}
                                    </div>
                                </div>
                                <div className="text-center mt-3 text-xs text-gray-500 dark:text-gray-400">
                                    전체 {myMatch.history?.length || 0}라운드 완료 | 차이: {Math.abs((team.winnings || 0) - (opponentTeam.winnings || 0))}억
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Action Bar - Only during active game */}
                    {myMatch.roundStatus !== 'FINISHED' && (
                        <div className="h-12 sm:h-14 bg-white/95 dark:bg-slate-800/95 backdrop-blur shrink-0 flex items-center justify-between px-2 gap-2 border-t border-slate-200 dark:border-slate-700 rounded-t-lg mt-1">
                            <button onClick={handleAIHelp} className={`flex flex-col items-center justify-center w-10 sm:w-14 h-full text-[8px] sm:text-[10px] ${aiLoading ? 'opacity-50' : ''} ${(myMatch.aiHelps?.[teamId]||0) >= 3 ? 'grayscale opacity-50' : 'text-cyan-600 dark:text-cyan-400'}`}>
                                <span className="text-base sm:text-xl">🤖</span>
                                <span className="hidden sm:inline">AI 헬프 ({(3 - (myMatch.aiHelps?.[teamId]||0))})</span>
                                <span className="sm:hidden">({(3 - (myMatch.aiHelps?.[teamId]||0))})</span>
                            </button>
                            {isMyTurn && myMatch.roundStatus === 'DECISION' ? (
                                <div className="flex-1 flex gap-2 h-9 sm:h-10">
                                    <button onClick={handleFold} className="flex-1 bg-slate-600 hover:bg-slate-500 text-white rounded font-bold text-xs sm:text-sm">포기</button>
                                    <button onClick={handleCall} className="flex-[2] bg-red-600 hover:bg-red-500 text-white rounded font-bold shadow-lg shadow-red-500/30 text-xs sm:text-sm">승부 (Call)</button>
                                </div>
                            ) : (
                                <div className="flex-1 text-center text-gray-500 text-xs flex items-center justify-center bg-slate-100 dark:bg-slate-900/50 h-9 sm:h-10 rounded">{myMatch.roundStatus === 'SHOWDOWN' ? '결과 확인 대기' : '대기 중...'}</div>
                            )}
                        </div>
                    )}
                </div>
            )}
            
            {/* AI Loading Modal */}
            {aiLoading && (
                <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
                    <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-cyan-500 shadow-[0_0_30px_rgba(6,182,212,0.5)] animate-pulse">
                        <div className="flex flex-col items-center gap-4">
                            <div className="text-4xl animate-bounce">🤖</div>
                            <div className="text-cyan-600 dark:text-cyan-400 font-bold text-lg text-center">
                                AI헬프 작동 중<br/>잠시만 기다리세요...
                            </div>
                            <div className="flex gap-1">
                                <div className="w-2 h-2 bg-cyan-500 rounded-full animate-bounce" style={{animationDelay: '0ms'}}></div>
                                <div className="w-2 h-2 bg-cyan-500 rounded-full animate-bounce" style={{animationDelay: '150ms'}}></div>
                                <div className="w-2 h-2 bg-cyan-500 rounded-full animate-bounce" style={{animationDelay: '300ms'}}></div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* AI Advice Modal (Synced) */}
            {activeAdvice && !aiLoading && (
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

            {/* Round Result Modal - Both teams must confirm */}
            {myMatch?.roundStatus === 'RESULT' && myMatch.lastRoundResult && (
                <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/90 p-4 backdrop-blur-md">
                    <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl max-w-sm w-full border-2 border-yellow-500 shadow-[0_0_40px_rgba(234,179,8,0.4)] animate-scale-up">
                        <div className="text-center mb-4">
                            <div className="text-4xl mb-2">
                                {myMatch.lastRoundResult.result === 'A_FOLDED' || myMatch.lastRoundResult.result === 'B_FOLDED' ? '🏳️' :
                                 myMatch.lastRoundResult.result === 'DRAW' ? '🤝' : '⚔️'}
                            </div>
                            <h3 className="text-xl font-black text-slate-900 dark:text-white">
                                Round {myMatch.lastRoundResult.round} 결과
                            </h3>
                        </div>

                        {/* Cards Comparison */}
                        <div className="flex items-center justify-center gap-4 mb-4">
                            <div className="text-center">
                                <div className="text-xs text-gray-500 mb-1">{isTeamA ? team.name : opponentTeam?.name}</div>
                                <div className={`w-12 h-16 rounded-lg flex items-center justify-center text-2xl font-black shadow-lg border-2 ${myMatch.lastRoundResult.teamACard % 2 === 0 ? 'bg-slate-900 text-white border-white' : 'bg-white text-slate-900 border-slate-300'}`}>
                                    {myMatch.lastRoundResult.teamACard}
                                </div>
                                <div className="text-xs text-yellow-600 mt-1">{myMatch.lastRoundResult.teamAChips}억</div>
                            </div>
                            <div className="text-2xl font-black text-gray-400">VS</div>
                            <div className="text-center">
                                <div className="text-xs text-gray-500 mb-1">{isTeamA ? opponentTeam?.name : team.name}</div>
                                <div className={`w-12 h-16 rounded-lg flex items-center justify-center text-2xl font-black shadow-lg border-2 ${myMatch.lastRoundResult.teamBCard % 2 === 0 ? 'bg-slate-900 text-white border-white' : 'bg-white text-slate-900 border-slate-300'}`}>
                                    {myMatch.lastRoundResult.teamBCard}
                                </div>
                                <div className="text-xs text-yellow-600 mt-1">{myMatch.lastRoundResult.teamBChips}억</div>
                            </div>
                        </div>

                        {/* Result */}
                        <div className={`text-center py-3 rounded-xl mb-4 ${
                            (myMatch.lastRoundResult.result === 'A_WON' && isTeamA) || (myMatch.lastRoundResult.result === 'B_WON' && !isTeamA) ||
                            (myMatch.lastRoundResult.result === 'B_FOLDED' && isTeamA) || (myMatch.lastRoundResult.result === 'A_FOLDED' && !isTeamA)
                                ? 'bg-green-100 dark:bg-green-900/30 border border-green-500'
                                : myMatch.lastRoundResult.result === 'DRAW'
                                    ? 'bg-gray-100 dark:bg-gray-700/30 border border-gray-400'
                                    : 'bg-red-100 dark:bg-red-900/30 border border-red-500'
                        }`}>
                            <div className="text-lg font-black">
                                {(myMatch.lastRoundResult.result === 'A_WON' && isTeamA) || (myMatch.lastRoundResult.result === 'B_WON' && !isTeamA)
                                    ? <span className="text-green-600">🎉 승리! +{myMatch.lastRoundResult.potWon}억</span>
                                    : (myMatch.lastRoundResult.result === 'B_FOLDED' && isTeamA) || (myMatch.lastRoundResult.result === 'A_FOLDED' && !isTeamA)
                                        ? <span className="text-green-600">🎉 상대 포기! +{myMatch.lastRoundResult.potWon}억</span>
                                        : myMatch.lastRoundResult.result === 'DRAW'
                                            ? <span className="text-gray-600">무승부 (다음 라운드로 이월)</span>
                                            : (myMatch.lastRoundResult.result === 'A_FOLDED' && isTeamA) || (myMatch.lastRoundResult.result === 'B_FOLDED' && !isTeamA)
                                                ? <span className="text-red-600">😢 포기함 -{myMatch.lastRoundResult.potWon}억</span>
                                                : <span className="text-red-600">😢 패배 -{myMatch.lastRoundResult.potWon}억</span>
                                }
                            </div>
                        </div>

                        {/* Confirmation Status */}
                        <div className="flex justify-center gap-4 mb-4 text-xs">
                            <div className={`px-3 py-1 rounded-full ${myMatch.resultConfirmed?.[myMatch.teamAId] ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                                {isTeamA ? '나' : opponentTeam?.name?.slice(0,4)} {myMatch.resultConfirmed?.[myMatch.teamAId] ? '✓ 확인' : '대기중'}
                            </div>
                            <div className={`px-3 py-1 rounded-full ${myMatch.resultConfirmed?.[myMatch.teamBId] ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                                {!isTeamA ? '나' : opponentTeam?.name?.slice(0,4)} {myMatch.resultConfirmed?.[myMatch.teamBId] ? '✓ 확인' : '대기중'}
                            </div>
                        </div>

                        <button
                            onClick={handleConfirmResult}
                            disabled={myMatch.resultConfirmed?.[teamId]}
                            className={`w-full py-3 rounded-xl font-bold text-white transition-all ${
                                myMatch.resultConfirmed?.[teamId]
                                    ? 'bg-gray-400 cursor-not-allowed'
                                    : 'bg-yellow-500 hover:bg-yellow-400 shadow-lg'
                            }`}
                        >
                            {myMatch.resultConfirmed?.[teamId] ? '상대팀 확인 대기중...' : '확인 (다음 라운드)'}
                        </button>
                    </div>
                </div>
            )}

            {/* Steal Chips Modal (Multi-Round Selection) */}
            {stealModalOpen && (
                <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/90 p-6 backdrop-blur-sm">
                    <div className="bg-slate-900 p-6 rounded-2xl w-full max-w-lg border border-red-500 shadow-2xl animate-scale-up max-h-[90vh] overflow-hidden flex flex-col">
                        <h3 className="text-white font-bold text-lg mb-2 flex items-center gap-2">
                            <span className="text-red-500">⚠️</span> 자금 부족! ({neededChips}억 필요)
                        </h3>
                        <p className="text-gray-400 text-sm mb-4">
                            미래 라운드에서 칩을 가져와야 합니다.<br/>
                            <span className="text-green-400">현재 확보: {currentStolen}억</span> / <span className="text-red-400">목표: {neededChips}억</span>
                        </p>
                        
                        <div className="flex-1 overflow-y-auto pr-2 grid grid-cols-3 sm:grid-cols-4 gap-2 mb-4">
                            {tempStrategy.map((s, idx) => { 
                                // Only future rounds
                                if (idx < (myMatch?.currentRound || 0)) return null; 
                                const originalChips = team.strategy![idx].chips;
                                const isModified = s.chips < originalChips;
                                return ( 
                                    <div key={s.round} className={`p-2 rounded border flex flex-col items-center justify-between ${isModified ? 'border-red-500 bg-red-900/20' : 'border-slate-700 bg-slate-800'}`}>
                                        <span className="text-xs text-gray-400 mb-1">R{s.round}</span>
                                        <div className="text-2xl font-black text-white mb-1">{s.chips}</div>
                                        <button 
                                            onClick={() => adjustTempChips(idx, -1)}
                                            className="w-full bg-red-600 hover:bg-red-500 text-white text-xs py-1 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                                            disabled={s.chips <= 1} // Min 1 chip rule
                                        >
                                            -1 억
                                        </button>
                                    </div> 
                                ) 
                            })}
                        </div>
                        
                        <div className="flex gap-2 shrink-0">
                            <button onClick={() => setStealModalOpen(false)} className="flex-1 py-3 bg-slate-700 text-gray-300 rounded-lg font-bold">취소</button>
                            <button 
                                onClick={confirmSteal} 
                                disabled={!canConfirmSteal}
                                className={`flex-1 py-3 rounded-lg font-bold transition-all ${canConfirmSteal ? 'bg-green-600 text-white hover:bg-green-500' : 'bg-slate-800 text-gray-500 cursor-not-allowed'}`}
                            >
                                {canConfirmSteal ? "확정 및 승부 (Confirm)" : "자금 부족"}
                            </button>
                        </div>
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
        // Subscribe to real-time updates from Firebase
        // This will sync data across all devices (PC admin + mobile users)
        const unsubscribe = subscribeToRooms((updatedRooms) => {
            setRooms(Array.isArray(updatedRooms) ? updatedRooms : []);
        });

        // Safe localStorage access
        try {
            const storedAuth = localStorage.getItem('swot_admin_auth');
            if (storedAuth === 'true') setIsAdminAuthenticated(true);
        } catch {
            // localStorage not available
        }

        // Show connection status
        if (isFirebaseConfigured()) {
            console.log('🔥 Firebase 실시간 동기화 활성화됨');
        } else {
            console.log('⚠️ Firebase 미설정 - localStorage 모드 (같은 브라우저에서만 동기화)');
        }

        return () => unsubscribe();
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
            try { localStorage.setItem('swot_admin_auth', 'true'); } catch {}
            setView('ADMIN_DASH');
        } else {
            alert('비밀번호가 틀렸습니다.');
        }
    };

    const handleAdminLogout = () => {
        try { localStorage.removeItem('swot_admin_auth'); } catch {}
        setIsAdminAuthenticated(false);
        setAdminInput('');
        setView('LANDING');
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
        let defaultName = '';
        try {
            const session = localStorage.getItem('swot_user_session');
            if (session) {
                const parsed = JSON.parse(session);
                if (parsed.roomId === roomId && parsed.teamId === teamId) {
                    defaultName = parsed.userName;
                }
            }
        } catch {}
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
        try { localStorage.setItem('swot_user_session', JSON.stringify({ roomId: currentRoomId, teamId: pendingTeamId, userName: joinName })); } catch {}

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
                return <AdminDashboard room={room} onUpdate={updateRoom} onBack={() => setCurrentRoomId(null)} onEnterTeam={(teamId) => { setCurrentTeamId(teamId); setIsAdminVisiting(true); setView('USER_GAME'); }} onDelete={deleteRoom} />;
            }
            return (
                <div className="max-w-4xl mx-auto p-4 mt-8 animate-fade-in pb-20 relative z-10">
                    <div className="flex justify-between items-center mb-8">
                        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">게임방 관리</h2>
                        <div className="flex gap-2">
                            <button onClick={() => setView('LANDING')} className="text-sm border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white px-4 py-2 rounded bg-white/50 dark:bg-slate-900/50">메인으로</button>
                            <button onClick={handleAdminLogout} className="text-sm border border-red-400 text-red-500 hover:bg-red-500 hover:text-white px-4 py-2 rounded bg-white/50 dark:bg-slate-900/50 transition-colors">로그아웃</button>
                        </div>
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
                                <button onClick={(e) => { e.stopPropagation(); deleteRoom(room.id); }} className="absolute top-4 right-4 text-gray-400 hover:text-red-500" title="방 삭제">🗑</button>
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
             {/* Global Theme Toggle - Top Left for Mobile */}
             <div className="fixed top-2 left-2 z-[9999]">
                <button
                    onClick={() => setDarkMode(!darkMode)}
                    className="p-1.5 rounded-full bg-white/30 dark:bg-slate-800/50 backdrop-blur-md border border-white/30 dark:border-slate-600/50 text-xs font-bold hover:bg-white/50 dark:hover:bg-slate-700/50 transition-all text-slate-800 dark:text-white shadow-md"
                >
                    {darkMode ? '☀️' : '🌙'}
                </button>
             </div>
            {renderContent()}
        </div>
    );
};

export default App;
