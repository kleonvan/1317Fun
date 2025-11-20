import React, { useState, useEffect, useRef, useMemo, memo } from 'react';
import { Crown, Skull, Settings, Save, ArrowDownUp, ChevronLeft, ChevronRight, XCircle, Trophy, Zap, History, AlertCircle, Clock, Smile, RotateCw, LogOut, Medal, Moon, Sun, Maximize, Minimize, User, Bomb } from 'lucide-react';

// --- CONSTANTS ---

const SUITS = ['♠', '♣', '♦', '♥']; 
const RANKS = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]; 
const RANK_NAMES = { 11: 'J', 12: 'Q', 13: 'K', 14: 'A', 15: '2' };

const CARD_BACKS = {
    red: "bg-red-900 border-[3px] border-white",
    blue: "bg-blue-900 border-[3px] border-white",
    black: "bg-zinc-900 border-[3px] border-gray-400",
    green: "bg-green-900 border-[3px] border-white"
};

const REACTIONS = {
    win: ['😎', '😆', '🔥', '🥳'],
    beat: ['😕', '😣', '😬', '😐', '🫠'],
    chop: ['🤬', '😭', '💀', '😤', '💔'],
    swap: ['🤔', '😏', '👀', '♻️']
};

const SPLASH_TEXTS = [
    "Now with 100% more 2s! Jk.",
    "Don't eat the 3 of Spades.",
    "Aaron is probably bluffing.",
    "Warning: Rotting 2s smell bad.",
    "Also known as 'Killer 13'.",
    "Swan is watching your soul.",
    "Instant 2-Buster enabled.",
    "Press Alt+F4 for Royal Flush.",
    "Did Aaron make big one?",
    "Tribunal-approved."
];

const getCardValue = (rank, suit) => rank * 4 + suit;

const createDeck = () => {
  const deck = [];
  RANKS.forEach(rank => {
    SUITS.forEach((suitSymbol, suitIdx) => {
      deck.push({
        rank,
        suit: suitIdx,
        suitSymbol,
        value: getCardValue(rank, suitIdx),
        id: `${rank}-${suitIdx}`
      });
    });
  });
  return deck;
};

const shuffleDeck = (deck) => {
  const newDeck = [...deck];
  for (let i = newDeck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newDeck[i], newDeck[j]] = [newDeck[j], newDeck[i]];
  }
  return newDeck;
};

// --- LOGIC ENGINE ---

const sortHandLogic = (hand) => [...hand].sort((a, b) => a.value - b.value);

const identifyHand = (cards) => {
  const sorted = sortHandLogic(cards);
  const len = sorted.length;
  if (len === 0) return { type: 'INVALID' };
  const ranks = sorted.map(c => c.rank);
  
  if (len === 1) return { type: 'SINGLE', value: sorted[len - 1].value, len: 1 };
  if (len === 2 && ranks[0] === ranks[1]) return { type: 'PAIR', value: sorted[len - 1].value, len: 2 };
  if (len === 3 && ranks[0] === ranks[1] && ranks[1] === ranks[2]) return { type: 'TRIPLE', value: sorted[len - 1].value, len: 3 };
  if (len === 4 && ranks[0] === ranks[3]) return { type: 'QUAD', value: sorted[len - 1].value, len: 4 };

  if (len >= 3) {
    let isStraight = true;
    if (ranks.includes(15)) isStraight = false; 
    else {
      for (let i = 0; i < len - 1; i++) {
        if (ranks[i] + 1 !== ranks[i + 1]) { isStraight = false; break; }
      }
    }
    if (isStraight) return { type: 'STRAIGHT', value: sorted[len - 1].value, len };
  }
  
  if (len >= 6 && len % 2 === 0) {
    let isSeqPairs = true;
    for (let i = 0; i < len; i += 2) if (ranks[i] !== ranks[i + 1]) isSeqPairs = false;
    if (isSeqPairs) {
      if (ranks.includes(15)) isSeqPairs = false;
      else {
        for (let i = 0; i < len - 2; i += 2) if (ranks[i] + 1 !== ranks[i + 2]) isSeqPairs = false;
      }
    }
    if (isSeqPairs) return { type: 'SEQ_PAIRS', value: sorted[len - 1].value, len };
  }
  return { type: 'INVALID' };
};

const getHandDescription = (cards) => {
    const ident = identifyHand(cards);
    if (ident.type === 'INVALID') return '';
    const highest = cards[cards.length - 1];
    const rankName = RANK_NAMES[highest.rank] || highest.rank;
    
    switch (ident.type) {
        case 'SINGLE': return `Single ${rankName}${highest.suitSymbol}`;
        case 'PAIR': return `Pair of ${rankName}s`;
        case 'TRIPLE': return `Triple ${rankName}s`;
        case 'QUAD': return `Four of a Kind ${rankName}s`;
        case 'STRAIGHT': return `Straight ${rankName}${highest.suitSymbol} High`;
        case 'SEQ_PAIRS': return `${ident.len / 2} Consecutive Pairs`;
        default: return '';
    }
};

const canBeat = (playCards, tableState) => {
  const play = identifyHand(playCards);
  if (play.type === 'INVALID') return false;
  if (!tableState) return true; 

  const table = identifyHand(tableState);

  if (play.type === table.type && play.len === table.len) return play.value > table.value;
  
  if (table.type === 'SINGLE' && tableState[0].rank === 15) {
      if (play.type === 'QUAD') return true;
      if (play.type === 'SEQ_PAIRS' && play.len >= 6) return true;
  }
  if (table.type === 'PAIR' && tableState[0].rank === 15) {
      if (play.type === 'QUAD') return true; 
      if (play.type === 'SEQ_PAIRS' && play.len >= 8) return true;
  }

  return false;
};

const getValidMoves = (hand, tableState) => {
    const validMoves = [];
    const sorted = sortHandLogic(hand);
    const n = sorted.length;
    const checkAndAdd = (subset) => { if (canBeat(subset, tableState)) validMoves.push(subset); };

    // 1. Singles
    for (let i = 0; i < n; i++) checkAndAdd([sorted[i]]);
    // 2. Pairs
    for (let i = 0; i < n - 1; i++) { if (sorted[i].rank === sorted[i + 1].rank) checkAndAdd([sorted[i], sorted[i + 1]]); }
    // 3. Triples
    for (let i = 0; i < n - 2; i++) { if (sorted[i].rank === sorted[i + 1].rank && sorted[i].rank === sorted[i + 2].rank) checkAndAdd([sorted[i], sorted[i + 1], sorted[i + 2]]); }
    // 4. Quads
    for (let i = 0; i < n - 3; i++) { if (sorted[i].rank === sorted[i+3].rank) checkAndAdd(sorted.slice(i, i+4)); }
    
    // 5. Straights & Consecutive Pairs
    const rankMap = {};
    sorted.forEach(c => {
        if (!rankMap[c.rank]) rankMap[c.rank] = [];
        rankMap[c.rank].push(c);
    });
    
    const uniqueRanks = Object.keys(rankMap).map(Number).sort((a,b)=>a-b);

    // Straights
    for (let i = 0; i < uniqueRanks.length; i++) {
        if (uniqueRanks[i] === 15) continue; 
        let currentRankSeq = [uniqueRanks[i]];
        for (let j = i + 1; j < uniqueRanks.length; j++) {
            if (uniqueRanks[j] === 15) break;
            if (uniqueRanks[j] === uniqueRanks[j-1] + 1) {
                currentRankSeq.push(uniqueRanks[j]);
                if (currentRankSeq.length >= 3) {
                    checkAndAdd(currentRankSeq.map(r => rankMap[r][rankMap[r].length - 1]));
                    checkAndAdd(currentRankSeq.map(r => rankMap[r][0]));
                }
            } else { break; }
        }
    }

    // Consecutive Pairs
    for (let i = 0; i < uniqueRanks.length; i++) {
        if (uniqueRanks[i] === 15) continue;
        if (rankMap[uniqueRanks[i]].length < 2) continue;
        let currentPairSeq = [uniqueRanks[i]];
        for (let j = i + 1; j < uniqueRanks.length; j++) {
            if (uniqueRanks[j] === 15) break;
            if (uniqueRanks[j] === uniqueRanks[j-1] + 1 && rankMap[uniqueRanks[j]].length >= 2) {
                currentPairSeq.push(uniqueRanks[j]);
                if (currentPairSeq.length >= 3) {
                    const seqHand = [];
                    currentPairSeq.forEach(r => {
                        seqHand.push(rankMap[r][0]);
                        seqHand.push(rankMap[r][1]);
                    });
                    checkAndAdd(seqHand);
                }
            } else { break; }
        }
    }

    return validMoves;
};

const analyzeHandStructure = (hand) => {
    const comboCards = new Set();
    const sorted = sortHandLogic(hand);
    const rankMap = {};
    sorted.forEach(c => {
        if (!rankMap[c.rank]) rankMap[c.rank] = [];
        rankMap[c.rank].push(c);
    });
    Object.values(rankMap).forEach(group => {
        if (group.length >= 2) group.forEach(c => comboCards.add(c.id));
    });
    const uniqueRanks = Object.keys(rankMap).map(Number).sort((a,b)=>a-b);
    let seq = [];
    for(let i=0; i<uniqueRanks.length; i++) {
        if(uniqueRanks[i] === 15) { seq = []; continue; }
        if(seq.length > 0 && uniqueRanks[i] !== seq[seq.length-1] + 1) seq = [];
        seq.push(uniqueRanks[i]);
        if(seq.length >= 3) {
            seq.forEach(r => rankMap[r].forEach(c => comboCards.add(c.id)));
        }
    }
    return comboCards;
};

// --- COMPONENTS ---

const Notification = memo(({ message }) => (
    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[60] pointer-events-none animate-in fade-in zoom-in duration-300">
        <div className="bg-black/80 text-white px-6 py-4 rounded-xl shadow-2xl border border-white/10 flex flex-col items-center gap-2 backdrop-blur-md">
            <AlertCircle className="text-yellow-400 w-8 h-8" />
            <span className="text-lg font-bold text-center whitespace-nowrap">{message}</span>
        </div>
    </div>
));

const ReactionBubble = memo(({ emoji }) => (
    <div className="absolute -top-12 left-1/2 -translate-x-1/2 text-5xl animate-bounce drop-shadow-2xl z-50">
        {emoji}
    </div>
));

const Confetti = memo(() => {
    const [particles, setParticles] = useState([]);

    useEffect(() => {
        const colors = ['#FFD700', '#FF0000', '#00FF00', '#0000FF', '#FF00FF', '#00FFFF'];
        const newParticles = Array.from({ length: 100 }).map((_, i) => ({
            id: i,
            x: Math.random() * 100,
            y: 100, // Start at bottom
            color: colors[Math.floor(Math.random() * colors.length)],
            size: Math.random() * 10 + 5,
            rotation: Math.random() * 360,
            delay: Math.random() * 2, 
            duration: Math.random() * 3 + 2,
            drift: Math.random() * 50 - 25
        }));
        setParticles(newParticles);
    }, []);

    return (
        <div className="absolute inset-0 pointer-events-none z-[80] overflow-hidden">
            {particles.map(p => (
                <div
                    key={p.id}
                    className="absolute rounded-sm animate-confetti-up"
                    style={{
                        left: `${p.x}%`,
                        bottom: '-20px',
                        width: `${p.size}px`,
                        height: `${p.size}px`,
                        backgroundColor: p.color,
                        transform: `rotate(${p.rotation}deg)`,
                        '--drift': `${p.drift}px`,
                        animationDuration: `${p.duration}s`,
                        animationDelay: `${p.delay}s`
                    }}
                />
            ))}
            <style>{`
                @keyframes confetti-up {
                    0% { transform: translateY(0) rotate(0deg); opacity: 1; }
                    50% { opacity: 1; }
                    100% { transform: translateY(-120vh) translateX(var(--drift)) rotate(720deg); opacity: 0; }
                }
                .animate-confetti-up {
                    animation-name: confetti-up;
                    animation-timing-function: cubic-bezier(0.25, 1, 0.5, 1);
                    animation-fill-mode: forwards;
                }
            `}</style>
        </div>
    );
});

const BombEffect = memo(() => (
    <div className="absolute inset-0 z-[70] flex items-center justify-center pointer-events-none">
        <div className="animate-in zoom-in spin-in duration-500 text-9xl drop-shadow-[0_0_50px_rgba(255,0,0,0.8)] animate-pulse">
            💣
        </div>
        <div className="absolute inset-0 bg-red-500/20 animate-pulse"></div>
    </div>
));

const Card = memo(({ card, index, totalCards, selected, onClick, playable = true, isPlayed = false, isPlayableHint = true, onDragStart, onDrop, onDragOver, scale = 1 }) => {
  const isRed = card.suit === 2 || card.suit === 3;
  const sizeClasses = isPlayed ? 'w-20 h-32 sm:w-24 sm:h-36 text-xl' : 'w-16 h-24 sm:w-20 sm:h-28 text-base sm:text-lg'; 
  const zStyle = index; 

  const visualState = !isPlayableHint && !isPlayed 
    ? 'brightness-[0.5] grayscale-[0.4]' 
    : 'brightness-100';

  return (
    <div
      draggable={playable}
      onDragStart={(e) => playable && onDragStart && onDragStart(e, card)}
      onDragOver={(e) => playable && onDragOver && onDragOver(e)}
      onDrop={(e) => playable && onDrop && onDrop(e, card)}
      onClick={() => playable && onClick && onClick(card)}
      className={`
        relative flex flex-col items-center justify-between p-[4%]
        bg-white rounded-lg shadow-md select-none transition-transform duration-150 ease-out
        border border-gray-400
        ${sizeClasses}
        ${selected ? '-translate-y-14 ring-4 ring-yellow-400 shadow-2xl z-50' : ''}
        ${playable ? 'cursor-pointer' : 'cursor-default'}
        ${visualState}
      `}
      style={{ 
          zIndex: zStyle,
          transform: `${selected ? 'translateY(-56px)' : ''} scale(${scale})`,
          transformOrigin: 'center bottom'
      }}
    >
      <div className={`self-start font-bold leading-none text-[1em] ${isRed ? 'text-red-600' : 'text-black'}`}>
        {RANK_NAMES[card.rank] || card.rank}
        <span className="block text-[0.6em]">{card.suitSymbol}</span>
      </div>
      <div className={`text-[2.5em] ${isRed ? 'text-red-600' : 'text-black'}`}>
        {card.suitSymbol}
      </div>
      <div className={`self-end rotate-180 font-bold leading-none text-[1em] ${isRed ? 'text-red-600' : 'text-black'}`}>
        {RANK_NAMES[card.rank] || card.rank}
        <span className="block text-[0.6em]">{card.suitSymbol}</span>
      </div>
    </div>
  );
});

const HiddenHand = memo(({ count, cardBackStyle, position, scale }) => {
    const justifyClass = position === 'right' ? 'justify-end' : 'justify-center';
    return (
        <div className={`relative flex flex-row items-center ${justifyClass}`} style={{ transform: `scale(${scale})` }}>
            {Array.from({ length: count }).map((_, i) => (
                <div 
                    key={i} 
                    className={`absolute w-10 h-14 sm:w-12 sm:h-16 rounded-md shadow-md ${CARD_BACKS[cardBackStyle]}`}
                    style={{ transform: `translateX(${(i - count/2) * 6}px)`, zIndex: i }}
                />
            ))}
        </div>
    );
});

const Opponent = memo(({ name, emoji, cardCount, isTurn, isPass, isWinner, finishedRank, position, cardBackStyle, activeReaction, isSwapping, scale }) => {
  let containerClasses = "absolute flex transition-all duration-300 gap-2 z-20";
  if (position === 'left') containerClasses += " left-4 top-[30%] flex-col items-start";
  if (position === 'right') containerClasses += " right-1 top-[30%] flex-col items-end"; 
  if (position === 'top') containerClasses += " top-[20%] left-1/2 -translate-x-1/2 flex-col items-center";

  return (
    <div className={containerClasses}>
        <div className={`relative flex flex-col items-center z-20 ${isPass ? 'opacity-30 grayscale' : ''}`}>
             {activeReaction && <ReactionBubble emoji={activeReaction} />}
             <div className={`text-5xl drop-shadow-lg transition-transform cursor-default ${isTurn ? 'scale-125' : 'scale-100'}`}>
                 {emoji}
             </div>
             
             {isWinner && <Crown className="absolute -top-6 text-yellow-400 animate-bounce" size={32} fill="currentColor"/>}
             
             {finishedRank && (
                <div className="absolute -top-6 bg-yellow-500 text-black font-black px-2 py-1 rounded border-2 border-white shadow-lg text-xs uppercase tracking-wider">
                    {finishedRank}{finishedRank === 1 ? 'st' : finishedRank === 2 ? 'nd' : finishedRank === 3 ? 'rd' : 'th'}
                </div>
             )}
             
             {isSwapping && isTurn && <div className="absolute -top-8 bg-blue-500 text-white text-[10px] px-2 py-1 rounded animate-pulse">Swapping...</div>}
             
             <div className={`bg-black/70 text-white text-[10px] sm:text-xs px-2 py-0.5 rounded mt-1 font-bold backdrop-blur-md whitespace-nowrap border ${isTurn ? 'border-yellow-400 text-yellow-300 shadow-[0_0_10px_rgba(250,204,21,0.5)]' : 'border-white/10'}`}>
                 {name} ({cardCount})
             </div>
        </div>
        <div className={`relative z-10 w-24 h-16 flex items-center justify-center mt-2`}>
             <HiddenHand count={cardCount} cardBackStyle={cardBackStyle} position={position} scale={scale} />
        </div>
    </div>
  );
});

const Scoreboard = memo(({ placementStats }) => {
    const totalGames = Object.values(placementStats).reduce((a, b) => a + b, 0);
    const avgRank = totalGames === 0 ? 0 : ((placementStats[1] * 1) + (placementStats[2] * 2) + (placementStats[3] * 3) + (placementStats[4] * 4)) / totalGames;

    return (
        <div className="absolute top-2 left-2 z-10 pointer-events-none opacity-90 transition-opacity">
            <div className="bg-black/60 backdrop-blur-md border border-white/20 rounded-xl p-2 sm:p-3 text-[10px] sm:text-xs text-white shadow-2xl min-w-[100px] sm:min-w-[120px]">
                <div className="font-black mb-2 uppercase tracking-widest text-gray-400 text-[8px] sm:text-[10px] border-b border-white/10 pb-1">Stats</div>
                <div className="grid grid-cols-2 gap-x-2 sm:gap-x-4 gap-y-1 mb-2 border-b border-white/10 pb-2">
                    <div className="flex justify-between gap-1 items-center">
                        <span className="text-yellow-400 font-bold flex items-center gap-0.5"><Crown size={10}/></span>
                        <span className="font-mono">{placementStats[1]}</span>
                    </div>
                    <div className="flex justify-between gap-1 items-center">
                        <span className="text-gray-300 font-bold">2nd</span>
                        <span className="font-mono">{placementStats[2]}</span>
                    </div>
                    <div className="flex justify-between gap-1 items-center">
                        <span className="text-orange-400 font-bold">3rd</span>
                        <span className="font-mono">{placementStats[3]}</span>
                    </div>
                    <div className="flex justify-between gap-1 items-center">
                        <span className="text-red-400 font-bold">4th</span>
                        <span className="font-mono">{placementStats[4]}</span>
                    </div>
                </div>
                <div className="flex justify-between gap-2 items-center">
                    <span className="text-blue-300 font-bold">Avg</span>
                    <span className="font-mono text-sm sm:text-lg">{avgRank > 0 ? avgRank.toFixed(1) : '-'}</span>
                </div>
            </div>
        </div>
    );
});

const Leaderboard = memo(({ players, playerWins }) => {
    return (
        <div className="absolute top-2 right-2 z-10 pointer-events-none opacity-90 transition-opacity">
            <div className="bg-black/60 backdrop-blur-md border border-white/20 rounded-xl p-2 sm:p-3 text-[10px] sm:text-xs text-white shadow-2xl min-w-[100px] sm:min-w-[120px]">
                <div className="font-black mb-2 uppercase tracking-widest text-gray-400 text-[8px] sm:text-[10px] border-b border-white/10 pb-1">Leaderboard</div>
                <div className="space-y-1">
                    {players.slice().sort((a,b) => (playerWins[b.id] || 0) - (playerWins[a.id] || 0)).map((p, i) => (
                        <div key={p.id} className="flex justify-between items-center gap-2 sm:gap-3">
                            <div className="flex items-center gap-1 overflow-hidden">
                                <span className={`font-bold w-3 ${i===0 ? 'text-yellow-400' : 'text-gray-500'}`}>{i+1}</span>
                                <span className="truncate max-w-[50px] sm:max-w-[60px]">{p.name}</span>
                            </div>
                            <div className="flex items-center gap-0.5">
                                <span className="font-mono font-bold text-yellow-200">{playerWins[p.id] || 0}</span>
                                <Crown size={9} className="text-yellow-500"/>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
});

const SettingsModal = ({ onClose, settings, setSettings, onExit }) => {
    const [tempSettings, setTempSettings] = useState(settings);
    const [activeTab, setActiveTab] = useState('players'); 

    const handleCpuChange = (id, field, value) => {
        setTempSettings(prev => ({ ...prev, cpuConfig: { ...prev.cpuConfig, [id]: { ...prev.cpuConfig[id], [field]: value } } }));
    };

    const handleToggle = (field) => {
        setTempSettings(prev => ({ ...prev, [field]: !prev[field] }));
    };

    return (
        <div className="absolute inset-0 z-[100] bg-black/90 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in zoom-in duration-200">
            <div className="bg-gray-800 border border-gray-600 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
                <div className="flex bg-gray-900 border-b border-gray-700">
                    <button onClick={() => setActiveTab('players')} className={`flex-1 py-4 font-bold ${activeTab === 'players' ? 'text-green-400 bg-gray-800' : 'text-gray-400'}`}>Players</button>
                    <button onClick={() => setActiveTab('design')} className={`flex-1 py-4 font-bold ${activeTab === 'design' ? 'text-green-400 bg-gray-800' : 'text-gray-400'}`}>Options</button>
                </div>

                <div className="p-6 overflow-y-auto flex-1">
                    {activeTab === 'players' && (
                        <div className="space-y-6">
                             <div className="p-2 bg-blue-900/40 rounded border border-blue-500/30 text-xs text-blue-200 text-center">
                                Customize your opponents. In Mode 17, only Left and Right players appear.
                            </div>
                            {[1, 2, 3].map(id => (
                                <div key={id} className="flex items-center gap-3">
                                    <div className="flex flex-col items-center gap-1">
                                        <span className="text-gray-500 text-xs uppercase font-bold">{id === 1 ? 'Left' : id === 2 ? 'Top' : 'Right'}</span>
                                        <input type="text" value={tempSettings.cpuConfig[id].emoji} onChange={(e) => handleCpuChange(id, 'emoji', e.target.value)} className="w-14 bg-black/40 border border-gray-600 rounded-lg p-2 text-center text-2xl focus:outline-none focus:border-green-500"/>
                                    </div>
                                    <input type="text" value={tempSettings.cpuConfig[id].name} onChange={(e) => handleCpuChange(id, 'name', e.target.value)} className="flex-1 h-12 bg-black/40 border border-gray-600 rounded-lg p-3 text-white focus:outline-none focus:border-green-500"/>
                                </div>
                            ))}
                        </div>
                    )}

                    {activeTab === 'design' && (
                        <div className="space-y-6">
                            <div className="bg-black/20 p-4 rounded-lg space-y-4">
                                <h3 className="text-white font-bold flex items-center gap-2"><Settings size={16}/> Game Toggles</h3>
                                <div className="flex justify-between items-center">
                                    <label className="text-gray-300 text-sm flex items-center gap-2"><Moon size={14}/> Night Mode</label>
                                    <button onClick={() => handleToggle('nightMode')} className={`w-12 h-6 rounded-full transition-colors relative ${tempSettings.nightMode ? 'bg-blue-500' : 'bg-gray-600'}`}>
                                        <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-transform ${tempSettings.nightMode ? 'left-7' : 'left-1'}`} />
                                    </button>
                                </div>
                                <div className="flex justify-between items-center">
                                    <label className="text-gray-300 text-sm flex items-center gap-2"><ArrowDownUp size={14}/> Auto-Skip Turn</label>
                                    <button onClick={() => handleToggle('autoSkip')} className={`w-12 h-6 rounded-full transition-colors relative ${tempSettings.autoSkip ? 'bg-green-500' : 'bg-gray-600'}`}>
                                        <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-transform ${tempSettings.autoSkip ? 'left-7' : 'left-1'}`} />
                                    </button>
                                </div>
                                <div className="flex justify-between items-center">
                                    <label className="text-gray-300 text-sm flex items-center gap-2"><Clock size={14}/> CPU Thinking Time</label>
                                    <button onClick={() => handleToggle('useFakeThinking')} className={`w-12 h-6 rounded-full transition-colors relative ${tempSettings.useFakeThinking ? 'bg-green-500' : 'bg-gray-600'}`}>
                                        <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-transform ${tempSettings.useFakeThinking ? 'left-7' : 'left-1'}`} />
                                    </button>
                                </div>
                            </div>

                            <div>
                                <h3 className="text-white font-bold mb-3 flex items-center gap-2"><Zap size={16} className="text-yellow-400"/> Game Speed</h3>
                                <input type="range" min="1" max="5" step="1" value={tempSettings.speed} onChange={(e) => setTempSettings(p => ({...p, speed: parseInt(e.target.value)}))} className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-green-500" />
                                <div className="flex justify-between text-xs text-gray-400 mt-1"><span>Slow</span><span>Normal</span><span>Fast</span><span>Instant</span></div>
                            </div>

                            <div>
                                <h3 className="text-white font-bold mb-3 flex items-center gap-2"><Maximize size={16} className="text-blue-400"/> Card Size</h3>
                                <input type="range" min="0.3" max="1.5" step="0.1" value={tempSettings.cardScale} onChange={(e) => setTempSettings(p => ({...p, cardScale: parseFloat(e.target.value)}))} className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-blue-500" />
                                <div className="flex justify-between text-xs text-gray-400 mt-1"><span>Tiny</span><span>Normal</span><span>Huge</span></div>
                            </div>
                            
                            <h3 className="text-white font-bold mb-3">Card Backs</h3>
                            <div className="grid grid-cols-2 gap-4">
                                {Object.keys(CARD_BACKS).map(style => (
                                    <button key={style} onClick={() => setTempSettings(p => ({...p, cardBack: style}))} className={`relative h-24 rounded-xl border-4 transition-all overflow-hidden ${CARD_BACKS[style]} ${tempSettings.cardBack === style ? 'border-yellow-400 scale-105 shadow-lg' : 'border-transparent opacity-70 hover:opacity-100'}`}>
                                        {tempSettings.cardBack === style && <div className="absolute inset-0 flex items-center justify-center"><div className="bg-black/50 rounded-full p-1"><div className="w-3 h-3 bg-yellow-400 rounded-full"></div></div></div>}
                                    </button>
                                ))}
                            </div>

                             <div className="pt-4 border-t border-gray-700">
                                <button onClick={onExit} className="w-full bg-red-900/50 hover:bg-red-800 text-red-200 font-bold py-3 rounded-xl flex items-center justify-center gap-2 border border-red-800">
                                    <LogOut size={18}/> Exit to Menu
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                <div className="p-4 border-t border-gray-700 flex gap-3">
                    <button onClick={onClose} className="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-3 rounded-xl font-bold">Cancel</button>
                    <button onClick={() => { setSettings(tempSettings); onClose(); }} className="flex-1 bg-green-600 hover:bg-green-500 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2"><Save size={18}/> Save</button>
                </div>
            </div>
        </div>
    );
};

// --- MAIN APP ---

export default function TienLenGame() {
  const [gameStatus, setGameStatus] = useState('menu'); 
  const [showSettings, setShowSettings] = useState(false);
  const [notification, setNotification] = useState(null); 
  const [bombTriggered, setBombTriggered] = useState(false);
  const [confettiTriggered, setConfettiTriggered] = useState(false);

  // Global Settings State
  const [settings, setSettings] = useState({
      cpuConfig: {
          1: { name: 'Aaron', emoji: '🚆' },
          2: { name: 'Swan', emoji: '🦢' },
          3: { name: 'Hannah', emoji: '❤️' }
      },
      cardBack: 'red',
      speed: 3,
      useFakeThinking: false,
      showReactions: true,
      autoSkip: false,
      nightMode: false,
      cardScale: 1.0
  });
  
  const [gameMode, setGameMode] = useState('13'); 
  const [placementStats, setPlacementStats] = useState({ 1: 0, 2: 0, 3: 0, 4: 0 });
  const [playerWins, setPlayerWins] = useState({ 0: 0, 1: 0, 2: 0, 3: 0 });
  const [players, setPlayers] = useState([]);
  const [turnIndex, setTurnIndex] = useState(0);
  const [tableCards, setTableCards] = useState(null); 
  const [playedPile, setPlayedPile] = useState([]); 
  const [selectedCards, setSelectedCards] = useState([]);
  const [passedPlayers, setPassedPlayers] = useState([]);
  const [gameLog, setGameLog] = useState([]);
  const [lastWinner, setLastWinner] = useState(null);
  const [isFirstGame, setIsFirstGame] = useState(true);
  const [dealtCount, setDealtCount] = useState(0); 
  const [splashText, setSplashText] = useState("");
  const [finishedPlayers, setFinishedPlayers] = useState([]);
  const [swapCard, setSwapCard] = useState(null);
  const [swapPasses, setSwapPasses] = useState(0);
  const [activeReactions, setActiveReactions] = useState({});
  const [mustPass, setMustPass] = useState(false);

  const timerRef = useRef(null);
  const reactionTimeoutRef = useRef({});

  useEffect(() => {
      setSplashText(SPLASH_TEXTS[Math.floor(Math.random() * SPLASH_TEXTS.length)]);
  }, []);

  const showNotification = (msg) => {
      setNotification(msg);
      setTimeout(() => setNotification(null), 2500);
  };

  const triggerReaction = (playerId, type) => {
      if (!settings.showReactions) return;
      if (playerId === 0) return; 
      
      if (type === 'beat' && tableCards) {
          const rank = identifyHand(tableCards).value;
          if (rank < 40) return; 
      }

      if (reactionTimeoutRef.current[playerId]) clearTimeout(reactionTimeoutRef.current[playerId]);
      const options = REACTIONS[type];
      const emoji = options[Math.floor(Math.random() * options.length)];
      setActiveReactions(prev => ({ ...prev, [playerId]: emoji }));
      reactionTimeoutRef.current[playerId] = setTimeout(() => {
          setActiveReactions(prev => {
              const next = { ...prev };
              delete next[playerId];
              return next;
          });
      }, 1500);
  };

  const humanPlayableCards = useMemo(() => {
      if (players.length === 0) return new Set();
      const human = players[0];
      if (gameStatus === 'swapping') return new Set(human.hand.map(c => c.id));
      if (turnIndex !== 0) return new Set(human.hand.map(c => c.id)); 
      let validMoves = getValidMoves(human.hand, tableCards);
      if (isFirstGame && !tableCards && gameLog.length === 0) {
          validMoves = validMoves.filter(move => move.some(c => c.rank === 3 && c.suit === 0));
      }
      const playableIds = new Set();
      validMoves.forEach(move => {
          move.forEach(c => playableIds.add(c.id));
      });
      return playableIds;
  }, [players, turnIndex, tableCards, isFirstGame, gameLog, gameStatus]);

  const startNewGame = () => {
    setGameStatus('dealing');
    setDealtCount(0);
    setNotification(null);
    setActiveReactions({});
    setMustPass(false);
    setSwapPasses(0);
    setFinishedPlayers([]);
    setConfettiTriggered(false);
    
    const newDeck = shuffleDeck(createDeck());
    
    let initialPlayers = [];
    if (gameMode === '13') {
        initialPlayers = [
            { id: 0, name: 'YOU', emoji: '👤', isHuman: true, hand: [] },
            { id: 1, ...settings.cpuConfig[1], isHuman: false, hand: [] },
            { id: 2, ...settings.cpuConfig[2], isHuman: false, hand: [] },
            { id: 3, ...settings.cpuConfig[3], isHuman: false, hand: [] }
        ];
    } else {
        initialPlayers = [
            { id: 0, name: 'YOU', emoji: '👤', isHuman: true, hand: [] },
            { id: 1, ...settings.cpuConfig[1], isHuman: false, hand: [] }, 
            { id: 2, ...settings.cpuConfig[3], isHuman: false, hand: [] }  
        ];
    }
    
    const handSize = gameMode === '13' ? 13 : 17;
    const numPlayers = initialPlayers.length;
    const fullHands = [];
    for(let i=0; i<numPlayers; i++) fullHands[i] = [];

    let dealStarter = 0;
    if (lastWinner !== null && lastWinner < numPlayers) dealStarter = lastWinner;
    
    let cardIdx = 0;
    for(let i=0; i<handSize * numPlayers; i++) {
        const targetPlayer = (dealStarter + i) % numPlayers;
        fullHands[targetPlayer].push(newDeck[i]);
        cardIdx++;
    }

    if (gameMode === '17') {
        setSwapCard(newDeck[cardIdx]); 
    }

    setPlayers(initialPlayers);
    setTableCards(null);
    setPlayedPile([]);
    setPassedPlayers([]);
    setSelectedCards([]);
    setGameLog([]);

    let dealIndex = 0;
    
    const dealInterval = setInterval(() => {
        if (dealIndex >= handSize * numPlayers) {
            clearInterval(dealInterval);
            const finalPlayers = initialPlayers.map((p, idx) => ({ ...p, hand: fullHands[idx] }));
            finalPlayers.forEach(p => { p.hand = sortHandLogic(p.hand); });
            setPlayers(finalPlayers);
            
            if (gameMode === '17') {
                setGameStatus('swapping');
                setTurnIndex(dealStarter); 
                addLog("Swap Phase Started");
            } else {
                setGameStatus('playing');
                let playStarter = 0;
                if (isFirstGame) {
                     fullHands.forEach((hand, idx) => {
                        if (hand.some(c => c.rank === 3 && c.suit === 0)) playStarter = idx;
                     });
                } else if (lastWinner !== null && lastWinner < numPlayers) playStarter = lastWinner;
                setTurnIndex(playStarter);
            }
            return;
        }

        const playerIdx = (dealStarter + dealIndex) % numPlayers;
        const cardToAdd = newDeck[dealIndex];
        
        setPlayers(prev => {
            const next = [...prev];
            next[playerIdx].hand = [...next[playerIdx].hand, cardToAdd];
            if(playerIdx === 0) next[playerIdx].hand = sortHandLogic(next[playerIdx].hand);
            return next;
        });
        setDealtCount(prev => prev + 1);
        dealIndex++;

    }, 80); 
  };

  const addLog = (msg) => setGameLog(prev => [msg, ...prev].slice(0, 4));

  // --- SWAP LOGIC ---
  useEffect(() => {
      if (gameStatus !== 'swapping') return;
      const currentPlayer = players[turnIndex];
      const delay = settings.speed === 5 ? 500 : 1500;
      if (!currentPlayer.isHuman) {
          timerRef.current = setTimeout(() => executeCpuSwap(currentPlayer), delay);
      }
      return () => clearTimeout(timerRef.current);
  }, [turnIndex, gameStatus, swapPasses]);

  const executeCpuSwap = (aiPlayer) => {
      const lowestCard = aiPlayer.hand[0]; 
      let shouldSwap = false;
      if (swapCard.rank === 15 && lowestCard.rank !== 15) shouldSwap = true;
      if (swapCard.rank === 14 && lowestCard.rank < 10) shouldSwap = true;
      if (aiPlayer.hand.some(c => c.rank === swapCard.rank)) shouldSwap = true;
      if (Math.random() > 0.7) shouldSwap = true;
      
      if (swapCard.rank < 6) shouldSwap = false;

      if (shouldSwap) {
          performSwap(aiPlayer.id, lowestCard);
      } else {
          passSwap(aiPlayer.id);
      }
  };

  const performSwap = (playerId, cardToGive) => {
      const newPlayers = [...players];
      const p = newPlayers.find(pl => pl.id === playerId);
      p.hand = p.hand.filter(c => c.id !== cardToGive.id);
      p.hand.push(swapCard);
      p.hand = sortHandLogic(p.hand);
      setSwapCard(cardToGive);
      setPlayers(newPlayers);
      setSwapPasses(0); 
      addLog(`${p.name} swapped`);
      if (playerId === 0) setSelectedCards([]);
      triggerReaction(playerId, 'swap');
      advanceSwapTurn();
  };

  const passSwap = (playerId) => {
      const newPasses = swapPasses + 1;
      setSwapPasses(newPasses);
      addLog(`${players[playerId].name} kept`);
      if (newPasses >= players.length) {
          setGameStatus('playing');
          addLog("Game Started!");
          let playStarter = 0;
          if (isFirstGame) {
                players.forEach((p, idx) => {
                if (p.hand.some(c => c.rank === 3 && c.suit === 0)) playStarter = idx;
                });
          } else if (lastWinner !== null && lastWinner < players.length) playStarter = lastWinner;
          setTurnIndex(playStarter);
      } else {
          advanceSwapTurn();
      }
  };

  const advanceSwapTurn = () => {
      setTurnIndex(prev => (prev + 1) % players.length);
  };

  // --- GAMEPLAY LOGIC ---

  useEffect(() => {
      if (gameStatus !== 'playing') return;
      const activePlayers = players.filter(p => p.hand.length > 0);
      if (activePlayers.length === 1) {
          const loser = activePlayers[0];
          const finalStandings = [...finishedPlayers, loser.id];
          setPlacementStats(prev => {
              const newStats = { ...prev };
              finalStandings.forEach((pid, index) => {
                  if (pid === 0) newStats[index + 1] = (newStats[index + 1] || 0) + 1;
              });
              return newStats;
          });
          if (finalStandings[0] === 0) setConfettiTriggered(true);
          setGameStatus('finished');
      }
  }, [finishedPlayers, players, gameStatus]);

  useEffect(() => {
    if (gameStatus !== 'playing') return;
    const neededPasses = Math.max(1, players.filter(p => p.hand.length > 0).length - 1);
    if (passedPlayers.length >= neededPasses && tableCards) {
        if (playedPile.length > 0) {
            const lastPlayerId = playedPile[playedPile.length-1].playerId;
            const lastPlayer = players.find(p => p.id === lastPlayerId);
            addLog(`Round won by ${lastPlayer.name}.`);
            
            if (lastPlayer.hand.length === 0) {
                 let nextIdx = (players.findIndex(p => p.id === lastPlayerId) + 1) % players.length;
                 while (finishedPlayers.includes(players[nextIdx].id) || players[nextIdx].hand.length === 0) {
                     nextIdx = (nextIdx + 1) % players.length;
                 }
                 setTurnIndex(nextIdx);
            } else {
                 setTurnIndex(players.findIndex(p => p.id === lastPlayerId));
            }
        }
        setTableCards(null); 
        setPlayedPile([]); 
        setPassedPlayers([]);
    }
  }, [passedPlayers, gameStatus, tableCards, players, turnIndex]); 

  useEffect(() => {
    if (gameStatus !== 'playing') return;
    const currentPlayer = players[turnIndex];
    if (currentPlayer.hand.length === 0) {
        nextTurn();
        return;
    }

    const delayMap = { 1: 2000, 2: 1500, 3: 1000, 4: 500, 5: 200 };
    let delay = delayMap[settings.speed] || 1000;

    if (settings.useFakeThinking && !currentPlayer.isHuman && tableCards) {
        const tableStrength = identifyHand(tableCards).value;
        if (tableStrength > 50) delay += 1500; 
        else if (tableStrength > 40) delay += 800;
    }

    if (!currentPlayer.isHuman) {
        setMustPass(false);
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => executeAITurn(currentPlayer), delay + Math.random() * (delay/2));
    } else {
        if (timerRef.current) clearTimeout(timerRef.current);
        const valid = getValidMoves(currentPlayer.hand, tableCards);
        let validMovesWithConstraint = valid;
        if (isFirstGame && !tableCards && gameLog.length === 0) {
            validMovesWithConstraint = valid.filter(move => move.some(c => c.rank === 3 && c.suit === 0));
        }
        
        if (validMovesWithConstraint.length === 0 && tableCards) {
            if (settings.autoSkip) {
                timerRef.current = setTimeout(() => {
                    showNotification("No playable cards! Skipped.");
                    handlePass(true); 
                }, delay + 1000);
            } else {
                setMustPass(true);
            }
        } else {
            setMustPass(false);
            if (!settings.autoSkip && validMovesWithConstraint.length === 1) {
                 setSelectedCards(validMovesWithConstraint[0]);
            }
        }
    }
    return () => clearTimeout(timerRef.current);
  }, [turnIndex, gameStatus, tableCards, settings]); 

  const executeAITurn = (aiPlayer) => {
    const lastPlayerId = playedPile.length > 0 ? playedPile[playedPile.length-1].playerId : null;
    const isLeading = !tableCards || lastPlayerId === aiPlayer.id;
    
    const currentTableState = isLeading ? null : tableCards;

    const validMoves = getValidMoves(aiPlayer.hand, currentTableState);
    let candidates = validMoves;
    
    if (isFirstGame && !tableCards && gameLog.length === 0) {
        candidates = validMoves.filter(move => move.some(c => c.rank === 3 && c.suit === 0));
    }

    if (passedPlayers.includes(aiPlayer.id)) { nextTurn(); return; }

    // Aggressive Two Strategy
    if (currentTableState) {
         const tableValue = identifyHand(currentTableState).value;
         if (tableValue >= 60) {
             const winningTwo = candidates.find(m => identifyHand(m).value > tableValue && m.length === 1 && m[0].rank === 15);
             if (winningTwo) {
                 submitMove(aiPlayer.id, winningTwo);
                 return;
             }
         }
    }

    // Hoarding Logic
    let twosPlayed = 0;
    playedPile.forEach(entry => { entry.cards.forEach(c => { if(c.rank === 15) twosPlayed++; }); });
    let myTwos = 0;
    aiPlayer.hand.forEach(c => { if(c.rank === 15) myTwos++; });
    const twosOutThere = 4 - twosPlayed - myTwos;

    if (isLeading && twosOutThere > 0) {
        candidates = candidates.filter(move => {
            const type = identifyHand(move).type;
            if (type === 'QUAD' || type === 'SEQ_PAIRS') return move.length === aiPlayer.hand.length;
            return true;
        });
    }

    // Smart Selection Logic
    if (!isLeading && tableCards) {
        const tableType = identifyHand(tableCards).type;
        if (tableType === 'PAIR' || tableType === 'TRIPLE' || tableType === 'STRAIGHT') {
             const matchingType = candidates.filter(c => identifyHand(c).type === tableType);
             if (matchingType.length > 0) {
                 submitMove(aiPlayer.id, matchingType[0]);
                 return;
             }
        }
    }

    if (!isLeading && candidates.length > 1) {
        const handStructure = analyzeHandStructure(aiPlayer.hand);
        const tableType = identifyHand(tableCards).type;
        if (tableType === 'SINGLE') {
            candidates.sort((a, b) => {
                const aIsStructural = handStructure.has(a[0].id) ? 1 : 0;
                const bIsStructural = handStructure.has(b[0].id) ? 1 : 0;
                if (aIsStructural !== bIsStructural) return aIsStructural - bIsStructural;
                return identifyHand(a).value - identifyHand(b).value;
            });
        } else {
            candidates.sort((a, b) => identifyHand(a).value - identifyHand(b).value);
        }
    } else {
         if (isLeading) {
            candidates.sort((a, b) => {
                const handA = identifyHand(a); const handB = identifyHand(b);
                if (handA.len !== handB.len) return handB.len - handA.len; 
                if (handA.type !== 'SINGLE' && handB.type === 'SINGLE') return -1;
                if (handA.type === 'SINGLE' && handB.type !== 'SINGLE') return 1;
                return handA.value - handB.value; 
            });
         } else {
             candidates.sort((a, b) => identifyHand(a).value - identifyHand(b).value);
         }
    }

    if (candidates.length > 0) {
        let chosenMove = candidates[0];
        submitMove(aiPlayer.id, chosenMove);
    } else {
        if (isLeading) {
             if (aiPlayer.hand.length > 0) {
                submitMove(aiPlayer.id, [aiPlayer.hand[0]]);
             } else {
                 setTableCards(null);
                 setPassedPlayers([]);
                 nextTurn(); 
             }
        } else {
            handlePass();
        }
    }
  };

  const submitMove = (playerId, cardsToPlay) => {
    if (playerId === 0) {
        if (!canBeat(cardsToPlay, tableCards)) {
            showNotification("Invalid Move: Cannot beat table");
            return;
        }
        const handId = identifyHand(cardsToPlay);
        if (handId.type === 'INVALID') {
            showNotification("Invalid Combination");
            return;
        }
        if (isFirstGame && !tableCards && gameLog.length === 0) {
             if (!cardsToPlay.some(c => c.rank === 3 && c.suit === 0)) {
                 showNotification("Must play 3♠ to start");
                 return;
             }
        }
    }

    const newPlayers = [...players];
    const player = newPlayers.find(p => p.id === playerId);
    player.hand = player.hand.filter(c => !cardsToPlay.some(played => played.id === c.id));
    const hasFinished = player.hand.length === 0;
    setPlayers(newPlayers);
    
    const prevOwnerId = playedPile.length > 0 ? playedPile[playedPile.length-1].playerId : null;
    const playType = identifyHand(cardsToPlay).type;
    let isChop = false;
    if (tableCards) {
        const tableType = identifyHand(tableCards).type;
        if (tableType === 'SINGLE' && tableCards[0].rank === 15 && (playType === 'QUAD' || playType === 'SEQ_PAIRS')) isChop = true;
    }

    if (prevOwnerId !== null && prevOwnerId !== playerId) {
        if (isChop) {
             triggerReaction(prevOwnerId, 'chop');
             setBombTriggered(true);
             setTimeout(() => setBombTriggered(false), 1000);
        }
        else triggerReaction(prevOwnerId, 'beat');
    }

    setTableCards(cardsToPlay);
    setPlayedPile(prev => [...prev, { cards: cardsToPlay, rotation: Math.random() * 20 - 10, playerId }]); 
    const typeName = playType === 'SEQ_PAIRS' ? '2-Buster!' : playType.charAt(0) + playType.slice(1).toLowerCase();
    
    addLog(`${player.name}: ${typeName}`);
    if (playerId === 0) setSelectedCards([]);

    if (hasFinished) {
        setFinishedPlayers(prev => [...prev, playerId]);
        triggerReaction(playerId, 'win');
        
        if (finishedPlayers.length === 0) {
             setLastWinner(playerId);
             setIsFirstGame(false);
             setPlayerWins(prev => ({ ...prev, [playerId]: prev[playerId] + 1 }));
        }
        nextTurn();
    }
    else {
        nextTurn();
    }
  };

  const handlePass = (isAuto = false) => {
    const player = players[turnIndex];
    if (isAuto) addLog(`${player.name}: Pass`);
    if (player.id === 0) setSelectedCards([]); 
    setPassedPlayers(prev => [...prev, turnIndex]);
    setMustPass(false);
    nextTurn();
  };

  const nextTurn = () => {
    let nextIndex = (turnIndex + 1) % players.length;
    let loopGuard = 0;
    while (
        (finishedPlayers.includes(nextIndex) || passedPlayers.includes(nextIndex)) 
        && loopGuard < players.length * 2
    ) { 
        nextIndex = (nextIndex + 1) % players.length; 
        loopGuard++; 
    }
    setTurnIndex(nextIndex);
  };

  const handleCardSelect = (card) => { 
      if (gameStatus === 'swapping' && turnIndex === 0) {
           setSelectedCards([card]); 
           return;
      }
      if (players[0].isPass || turnIndex !== 0) return; 
      
      const isSelected = selectedCards.some(c => c.id === card.id);
      if (isSelected) {
          setSelectedCards(selectedCards.filter(c => c.id !== card.id)); 
      } else {
          let newSelection = [...selectedCards, card];
          
          // Auto-select logic for straights/pairs
          if (tableCards && selectedCards.length === 0) {
               const tableHand = identifyHand(tableCards);
               const rank = card.rank;
               
               if (tableHand.type === 'PAIR') {
                    const pairMate = players[0].hand.find(c => c.rank === rank && c.id !== card.id);
                    if (pairMate) newSelection.push(pairMate);
               }
               else if (tableHand.type === 'TRIPLE') {
                    const mates = players[0].hand.filter(c => c.rank === rank && c.id !== card.id);
                    if (mates.length >= 2) newSelection = [...newSelection, ...mates.slice(0, 2)];
               }
               else if (tableHand.type === 'STRAIGHT') {
                   const L = tableHand.len;
                   const potentialStraight = [card];
                   let currentRank = rank;
                   for(let i=1; i<L; i++) {
                       const nextCard = players[0].hand.find(c => c.rank === currentRank + 1);
                       if (nextCard) {
                           potentialStraight.push(nextCard);
                           currentRank++;
                       }
                   }
                   if (potentialStraight.length === L) newSelection = potentialStraight;
               }
          }
          setSelectedCards(newSelection);
      }
  };
  const handleAutoSort = () => { const newPlayers = [...players]; newPlayers[0].hand = sortHandLogic(newPlayers[0].hand); setPlayers(newPlayers); };
  
  const onDragStart = (e, card) => { setDraggedCard(card); e.dataTransfer.effectAllowed = "move"; };
  const onDragOver = (e) => { e.preventDefault(); };
  const onDrop = (e, targetCard) => { e.preventDefault(); if (!draggedCard || draggedCard.id === targetCard.id) return; const hand = [...players[0].hand]; const fromIdx = hand.findIndex(c => c.id === draggedCard.id); const toIdx = hand.findIndex(c => c.id === targetCard.id); if (fromIdx !== -1 && toIdx !== -1) { const [moved] = hand.splice(fromIdx, 1); hand.splice(toIdx, 0, moved); const newPlayers = [...players]; newPlayers[0].hand = hand; setPlayers(newPlayers); } setDraggedCard(null); };

  const handleExit = () => {
      setGameStatus('menu');
      setPlayers([]);
      setTableCards(null);
      setPlayedPile([]);
      setShowSettings(false);
  };

  const bgClass = settings.nightMode ? 'bg-zinc-900' : 'bg-green-800';

  if (gameStatus === 'menu') {
    return (
      <div className={`h-screen w-full bg-gradient-to-br ${settings.nightMode ? 'from-zinc-900 to-black' : 'from-green-800 to-green-950'} flex flex-col items-center justify-center text-white p-6 relative font-sans`}>
        <button onClick={() => setShowSettings(true)} className="absolute top-6 right-6 p-3 bg-white/10 rounded-full hover:bg-white/20 transition-all"><Settings size={24}/></button>
        <h1 className="text-7xl font-black mb-4 text-yellow-400 tracking-tighter drop-shadow-2xl">Thirteen</h1>
        <div className="bg-yellow-400/20 text-yellow-200 px-4 py-1 rounded-full text-sm font-bold animate-pulse mb-12 text-center">
            {splashText}
        </div>
        
        <div className="flex gap-4 mb-8">
            <button onClick={() => setGameMode('13')} className={`px-8 py-6 rounded-2xl border-2 transition-all flex flex-col items-center w-40 ${gameMode === '13' ? 'bg-green-600 border-green-400 shadow-xl scale-110' : 'bg-black/40 border-gray-600 opacity-60 hover:opacity-100'}`}>
                <span className="text-3xl font-black">13</span>
                <span className="text-xs uppercase font-bold mt-1">Standard</span>
            </button>
            <button onClick={() => setGameMode('17')} className={`px-8 py-6 rounded-2xl border-2 transition-all flex flex-col items-center w-40 ${gameMode === '17' ? 'bg-purple-600 border-purple-400 shadow-xl scale-110' : 'bg-black/40 border-gray-600 opacity-60 hover:opacity-100'}`}>
                <span className="text-3xl font-black">17</span>
                <span className="text-xs uppercase font-bold mt-1">Swap Mode</span>
            </button>
        </div>

        <button onClick={startNewGame} className="bg-yellow-500 hover:bg-yellow-400 text-black font-black py-5 px-24 rounded-full text-2xl shadow-xl transform transition hover:scale-105 active:scale-95">PLAY NOW</button>
        {showSettings && <SettingsModal onClose={() => setShowSettings(false)} settings={settings} setSettings={setSettings} onExit={handleExit} />}
      </div>
    );
  }

  return (
    <div className={`h-screen w-full ${bgClass} relative overflow-hidden select-none font-sans`}>
      <div className="absolute inset-0 opacity-30 bg-[url('https://www.transparenttextures.com/patterns/felt.png')] pointer-events-none"></div>
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} settings={settings} setSettings={setSettings} onExit={handleExit} />}
      {notification && <Notification message={notification} />}
      {bombTriggered && <BombEffect />}
      {confettiTriggered && <Confetti />}
      <Scoreboard placementStats={placementStats} />
      <Leaderboard players={players} playerWins={playerWins} />
      
      {/* Players */}
      {gameMode === '13' ? (
          <>
            {players[1] && <Opponent {...players[1]} cardCount={players[1].hand.length} isTurn={turnIndex === 1} isPass={passedPlayers.includes(1)} isWinner={finishedPlayers.includes(1)} finishedRank={finishedPlayers.indexOf(1) + 1 || null} position="left" cardBackStyle={settings.cardBack} activeReaction={activeReactions[1]} scale={settings.cardScale} />}
            {players[2] && <Opponent {...players[2]} cardCount={players[2].hand.length} isTurn={turnIndex === 2} isPass={passedPlayers.includes(2)} isWinner={finishedPlayers.includes(2)} finishedRank={finishedPlayers.indexOf(2) + 1 || null} position="top" cardBackStyle={settings.cardBack} activeReaction={activeReactions[2]} scale={settings.cardScale} />}
            {players[3] && <Opponent {...players[3]} cardCount={players[3].hand.length} isTurn={turnIndex === 3} isPass={passedPlayers.includes(3)} isWinner={finishedPlayers.includes(3)} finishedRank={finishedPlayers.indexOf(3) + 1 || null} position="right" cardBackStyle={settings.cardBack} activeReaction={activeReactions[3]} scale={settings.cardScale} />}
          </>
      ) : (
          <>
            {players[1] && <Opponent {...players[1]} cardCount={players[1].hand.length} isTurn={turnIndex === 1} isPass={passedPlayers.includes(1)} isWinner={finishedPlayers.includes(1)} finishedRank={finishedPlayers.indexOf(1) + 1 || null} position="left" cardBackStyle={settings.cardBack} activeReaction={activeReactions[1]} isSwapping={gameStatus === 'swapping'} scale={settings.cardScale} />}
            {players[2] && <Opponent {...players[2]} cardCount={players[2].hand.length} isTurn={turnIndex === 2} isPass={passedPlayers.includes(2)} isWinner={finishedPlayers.includes(2)} finishedRank={finishedPlayers.indexOf(2) + 1 || null} position="right" cardBackStyle={settings.cardBack} activeReaction={activeReactions[2]} isSwapping={gameStatus === 'swapping'} scale={settings.cardScale} />}
          </>
      )}

      <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0">
        {gameStatus === 'dealing' && (
            <div className="relative z-50">
                {Array.from({ length: (gameMode==='13'?52:51) - dealtCount }).map((_, i) => (
                    <div key={i} className={`absolute top-0 left-0 w-16 h-24 rounded-lg border-2 border-white ${CARD_BACKS[settings.cardBack]}`} style={{ transform: `translate(-50%, -50%) translateY(${-i * 0.5}px)` }} />
                ))}
            </div>
        )}
        
        {/* SWAP UI (Mode 17) */}
        {gameStatus === 'swapping' && swapCard && (
            <div className="relative z-50 flex flex-col items-center gap-4 animate-in zoom-in">
                <div className="text-yellow-400 font-black text-2xl uppercase tracking-widest drop-shadow-md">Swap Phase</div>
                <div className="p-4 bg-white/10 rounded-2xl backdrop-blur-md border-2 border-white/20 shadow-2xl">
                    <Card card={swapCard} index={0} selected={false} playable={false} isPlayed={true} scale={settings.cardScale} />
                </div>
                {turnIndex === 0 && (
                    <div className="flex gap-4 pointer-events-auto">
                         <button onClick={() => passSwap(0)} className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-3 px-6 rounded-xl shadow-lg">Keep Hand</button>
                         <button disabled={selectedCards.length !== 1} onClick={() => performSwap(0, selectedCards[0])} className="bg-purple-600 hover:bg-purple-500 disabled:bg-gray-700 disabled:text-gray-400 text-white font-bold py-3 px-6 rounded-xl shadow-lg flex items-center gap-2"><RotateCw size={18}/> Swap Selected</button>
                    </div>
                )}
                {turnIndex !== 0 && <div className="text-white/50 text-sm animate-pulse">Waiting for opponents...</div>}
            </div>
        )}

        {/* PLAYING UI */}
        {gameStatus === 'playing' && (
            <>
                <div className="absolute top-[30%] z-40 animate-in zoom-in duration-300">
                    <div className="flex flex-col items-center bg-black/80 backdrop-blur-md rounded-xl border border-white/10 shadow-xl overflow-hidden min-w-[140px]">
                        <div className="w-full px-6 py-2 bg-white/5 border-b border-white/10 flex flex-col items-center">
                             <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Current Turn</div>
                             <div className={`font-black text-lg ${players[turnIndex].id === 0 ? 'text-yellow-400' : 'text-white'}`}>
                                 {players[turnIndex].name}
                             </div>
                        </div>
                        <div className="w-full px-6 py-2 flex flex-col items-center">
                            <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Last Action</div>
                            <div className="font-bold text-sm text-white text-center whitespace-nowrap">
                                 {playedPile.length > 0 ? `${players[playedPile[playedPile.length-1].playerId].name}` : (passedPlayers.length > 0 ? 'Pass' : '-')}
                            </div>
                             {playedPile.length > 0 && (
                                <div className="text-[10px] text-gray-400 text-center whitespace-nowrap mt-0.5">
                                    {getHandDescription(playedPile[playedPile.length-1].cards)}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {playedPile.length > 0 && (
                    <div className="relative w-full h-full flex items-center justify-center">
                        {playedPile.map((hand, handIdx) => (
                            <div key={handIdx} className={`absolute flex -space-x-12 transition-all duration-300`} style={{ zIndex: handIdx, transform: `scale(${handIdx === playedPile.length - 1 ? settings.cardScale : settings.cardScale * 0.85}) translateY(${handIdx === playedPile.length - 1 ? 0 : -10}px) rotate(${hand.rotation}deg)`, opacity: handIdx === playedPile.length - 1 ? 1 : 0.4, filter: handIdx === playedPile.length - 1 ? 'drop-shadow(0 10px 15px rgba(0,0,0,0.5))' : 'grayscale(60%) blur(0.5px)' }}>
                                {hand.cards.map((card, i) => <Card key={card.id} card={card} index={i} playable={false} isPlayed={true} scale={settings.cardScale} />)}
                            </div>
                        ))}
                    </div>
                )}
            </>
        )}
      </div>

      {/* Expanded bottom area to fit cards and controls with breathing room */}
      <div className="absolute bottom-0 left-0 right-0 h-80 bg-gradient-to-t from-black/90 to-transparent flex flex-col justify-end pb-8 z-20 pointer-events-none">
        
        {/* CARDS AREA (Top of the bottom section) with Extra Padding to ensure visibility */}
        <div className="w-full flex justify-center h-48 overflow-visible pointer-events-auto mb-4 px-4 sm:px-16 mx-auto max-w-[95%] sm:max-w-[80%] pb-12">
            <div className="flex items-end w-full justify-center">
                {players[0]?.hand.map((card, i) => (
                    <div key={card.id} className="-ml-8 sm:-ml-10 first:ml-0 transition-all duration-200">
                         <Card 
                            card={card} 
                            index={i}
                            totalCards={players[0].hand.length}
                            selected={selectedCards.some(c => c.id === card.id)}
                            onClick={handleCardSelect}
                            playable={(turnIndex === 0 || gameStatus === 'swapping') && !finishedPlayers.includes(0)}
                            isPlayableHint={gameStatus === 'swapping' || (turnIndex !== 0 || (turnIndex === 0 && (humanPlayableCards.size === 0 || humanPlayableCards.has(card.id))))}
                            onDragStart={onDragStart}
                            onDragOver={onDragOver}
                            onDrop={onDrop}
                            scale={gameMode === '17' ? settings.cardScale * 0.85 : settings.cardScale}
                        />
                    </div>
                ))}
            </div>
        </div>

        {/* CONTROLS AREA (Bottom of the section) */}
        {gameStatus !== 'dealing' && (
            <div className="w-full max-w-3xl mx-auto flex justify-between items-center px-4 sm:px-6 pointer-events-auto">
                <div className="flex items-center gap-2 sm:gap-3">
                    {/* Settings Button */}
                     <button onClick={() => setShowSettings(true)} className="w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center bg-white/10 rounded-xl hover:bg-white/20 backdrop-blur-sm text-white/80 hover:text-white border border-white/10 transition-all"><Settings size={20} className="sm:w-6 sm:h-6"/></button>
                    
                    {/* Sort Button */}
                    <button onClick={handleAutoSort} className="w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center bg-white/10 rounded-xl hover:bg-white/20 backdrop-blur-sm text-white border border-white/10 transition-all"><ArrowDownUp size={20} className="sm:w-6 sm:h-6"/></button>
                </div>

                {gameStatus === 'playing' && !finishedPlayers.includes(0) && (
                    <div className="flex gap-2 sm:gap-3">
                        <button 
                            disabled={turnIndex !== 0 || (!tableCards && passedPlayers.length >= players.length - 1 - finishedPlayers.length)}
                            onClick={() => handlePass(false)}
                            className={`
                                h-12 sm:h-14 min-w-[80px] sm:min-w-[100px] px-4 sm:px-6 flex items-center justify-center border text-white rounded-xl active:scale-95 disabled:opacity-20 disabled:grayscale transition-all font-black tracking-wide shadow-lg text-sm sm:text-base
                                ${mustPass ? 'bg-red-600 border-red-400 animate-pulse ring-4 ring-red-500/30' : 'bg-red-500/20 border-red-500/50 hover:bg-red-500/40'}
                            `}
                        >
                            PASS
                        </button>
                        <button 
                            disabled={selectedCards.length === 0 || turnIndex !== 0}
                            onClick={() => submitMove(0, selectedCards)}
                            className={`
                                h-12 sm:h-14 min-w-[120px] sm:min-w-[160px] px-4 sm:px-6 flex items-center justify-center bg-green-500 hover:bg-green-400 text-black rounded-xl shadow-[0_0_20px_rgba(34,197,94,0.4)] active:scale-95 disabled:opacity-20 disabled:shadow-none disabled:bg-gray-700 disabled:text-gray-400 transition-all font-black tracking-wide border-2 border-green-400 text-sm sm:text-base
                                ${selectedCards.length > 0 ? 'animate-bounce-slight' : ''}
                            `}
                        >
                            PLAY {selectedCards.length > 0 && `(${selectedCards.length})`}
                        </button>
                    </div>
                )}
                {finishedPlayers.includes(0) && (
                    <div className="text-yellow-400 font-black text-xl sm:text-2xl animate-pulse drop-shadow-md text-center">
                        YOU FINISHED {finishedPlayers.indexOf(0) + 1 === 1 ? '1ST' : finishedPlayers.indexOf(0) + 1 === 2 ? '2ND' : '3RD'}!
                    </div>
                )}
            </div>
        )}
      </div>

      {gameStatus === 'finished' && (
        <div className="absolute inset-0 z-50 bg-black/90 backdrop-blur-lg flex flex-col items-center justify-center p-8 text-center animate-in fade-in duration-500">
            <div className="mb-6 relative">
                {lastWinner === 0 
                    ? <div className="absolute inset-0 bg-yellow-500 blur-3xl opacity-20 rounded-full"></div> 
                    : <div className="absolute inset-0 bg-red-500 blur-3xl opacity-10 rounded-full"></div>
                }
                <Medal size={100} className={lastWinner === 0 ? "text-yellow-400" : "text-gray-500"} />
            </div>
            <h2 className="text-5xl font-black text-white mb-2 tracking-tight">
                {lastWinner === 0 ? "VICTORY" : "ROUND OVER"}
            </h2>
            <p className="text-white/60 text-lg mb-12">
                {lastWinner === 0 ? "You took 1st place!" : `${players[lastWinner].name} took 1st place.`}
            </p>
            
            {/* Session Standings Table */}
            <div className="w-full max-w-md bg-white/10 rounded-xl p-6 mb-8 border border-white/20">
                <h3 className="text-yellow-400 font-bold uppercase tracking-widest mb-4 text-sm border-b border-white/10 pb-2">Session Standings</h3>
                <div className="space-y-2">
                    {players.slice().sort((a,b) => (playerWins[b.id] || 0) - (playerWins[a.id] || 0)).map((p, i) => (
                        <div key={p.id} className="flex justify-between items-center">
                            <div className="flex items-center gap-2 text-white">
                                <span className={`font-black w-6 ${i===0 ? 'text-yellow-400' : 'text-gray-400'}`}>{i === 0 ? <Crown size={16}/> : `${i+1}.`}</span>
                                <span className="text-sm text-gray-300">{p.name}</span>
                            </div>
                            <div className="flex items-center gap-1">
                                <span className="font-mono text-white font-bold">{playerWins[p.id] || 0}</span>
                                <Crown size={12} className="text-yellow-500"/>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="flex gap-4">
                <button onClick={handleExit} className="px-8 py-4 rounded-2xl bg-gray-800 text-white font-bold hover:bg-gray-700 transition-all">Menu</button>
                <button onClick={startNewGame} className="px-8 py-4 rounded-2xl bg-white text-black font-black shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2 hover:bg-gray-100"><History size={24} /> NEXT ROUND</button>
            </div>
        </div>
      )}
    </div>
  );
}