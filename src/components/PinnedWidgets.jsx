import React, { useState } from 'react';
import { getHexColor, formatTimeFromSeconds } from '../utils/helpers';

export default function PinnedWidgets({ 
  pinnedIds, trackers, getTrackerValueObj, updateTrackerValue, 
  activeTimer, toggleTimer, togglePin, nowTick, isMobile, todayStr 
}) {
  const [mobileIndex, setMobileIndex] = useState(0);

  const validPinned = pinnedIds.map(id => trackers.find(t => t.id === id)).filter(Boolean);
  if (validPinned.length === 0) return null;

  if (isMobile) {
    const currentTracker = validPinned[mobileIndex % validPinned.length];
    if (!currentTracker) return null;

    const vals = getTrackerValueObj(todayStr, currentTracker.id);
    const isTime = currentTracker.type === 'time';
    const isTimerActive = activeTimer?.id === currentTracker.id;
    
    let sessionSecs = 0;
    if (isTimerActive) sessionSecs = Math.floor((nowTick - activeTimer.start) / 1000);
    const totalTimeSecs = vals.timeSpent + sessionSecs;
    
    const pCent = isTime 
        ? Math.min((totalTimeSecs / ((currentTracker.goalTime || 1)*60)) * 100, 100) 
        : Math.min((vals.quantity / (currentTracker.goal || 1)) * 100, 100);

    const handleNext = () => setMobileIndex(p => (p + 1) % validPinned.length);
    const handlePrev = () => setMobileIndex(p => (p - 1 + validPinned.length) % validPinned.length);

    return (
      <div className="fixed bottom-0 left-0 w-full bg-white dark:bg-zinc-950 border-t-2 border-gray-100 dark:border-zinc-900 z-[90] pointer-events-auto pb-safe shadow-[0_-4px_10px_rgba(0,0,0,0.1)]">
        <div className="flex items-center justify-between p-3">
          {validPinned.length > 1 ? (
             <button onClick={handlePrev} className="px-3 text-3xl font-light text-gray-400 hover:text-orange-500">&lsaquo;</button>
          ) : <div className="w-10" />}
          
          <div className="flex-1 flex flex-col px-2 min-w-0">
             <div className="flex justify-between items-end mb-1">
                <span className="text-[10px] font-black uppercase truncate pr-2 tracking-widest" style={{color: getHexColor(currentTracker.color)}}>{currentTracker.name}</span>
                <button onClick={() => togglePin(currentTracker.id)} className="text-gray-400 text-[10px] font-bold">✕ ODEPNIJ</button>
             </div>
             
             <div className="flex items-center justify-between gap-3">
                 <div className="flex items-baseline gap-1 shrink-0">
                     <span className="text-xl font-black text-gray-900 dark:text-white leading-none">
                         {isTime ? Math.floor(totalTimeSecs/60) : vals.quantity}
                     </span>
                     <span className="text-xs font-bold text-gray-400">/ {isTime ? currentTracker.goalTime : currentTracker.goal} {isTime && 'm'}</span>
                 </div>
                 
                 <div className="flex-1 h-2.5 bg-gray-200 dark:bg-zinc-800 rounded-full overflow-hidden">
                     <div className="h-full transition-all duration-300" style={{ width: `${pCent}%`, backgroundColor: getHexColor(currentTracker.color) }} />
                 </div>

                     <div className="flex items-center gap-1 shrink-0 ml-2">
                        {isTime ? (
                           <button onClick={() => toggleTimer(todayStr, currentTracker.id)} className="w-12 h-9 rounded-lg text-white font-black text-sm shadow-sm" style={{ backgroundColor: getHexColor(currentTracker.color) }}>
                              {isTimerActive ? '||' : '▶'}
                           </button>
                        ) : (
                           <>
                              <button onClick={() => updateTrackerValue(todayStr, currentTracker.id, 'quantity', -1)} className="w-10 h-9 rounded-lg bg-gray-200 dark:bg-zinc-800 text-gray-600 dark:text-zinc-300 font-bold text-xl flex items-center justify-center leading-none pb-1 transition-transform active:scale-95">−</button>
                              <button onClick={() => updateTrackerValue(todayStr, currentTracker.id, 'quantity', 1)} className="w-12 h-9 rounded-lg text-white font-black text-xl flex items-center justify-center leading-none shadow-sm transition-transform active:scale-95" style={{ backgroundColor: getHexColor(currentTracker.color) }}>+</button>
                           </>
                        )}
                     </div>
             </div>
          </div>

          {validPinned.length > 1 ? (
             <button onClick={handleNext} className="px-3 text-3xl font-light text-gray-400 hover:text-orange-500">&rsaquo;</button>
          ) : <div className="w-10" />}
        </div>
      </div>
    );
  }

  // WIDOK DESKTOP: Bąbelki po lewej stronie
  return (
    <div className="fixed bottom-10 left-6 md:left-8 z-[90] flex flex-col gap-5 pointer-events-none">
       {validPinned.map(tracker => {
          const vals = getTrackerValueObj(todayStr, tracker.id);
          const isTime = tracker.type === 'time';
          const isTimerActive = activeTimer?.id === tracker.id;
          let sessionSecs = 0;
          if (isTimerActive) sessionSecs = Math.floor((nowTick - activeTimer.start) / 1000);
          const totalTimeSecs = vals.timeSpent + sessionSecs;
          const pCent = isTime 
              ? Math.min((totalTimeSecs / ((tracker.goalTime || 1)*60)) * 100, 100) 
              : Math.min((vals.quantity / (tracker.goal || 1)) * 100, 100);

          return (
            <div key={tracker.id} className="pointer-events-auto flex items-center gap-5 bg-white/95 dark:bg-zinc-900/95 py-3 pl-3 pr-4 rounded-[50px] shadow-2xl backdrop-blur-md border border-gray-200 dark:border-zinc-800">
               <div className="relative w-[84px] h-[84px] flex-shrink-0">
                  <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                     <circle cx="50" cy="50" r="44" className="stroke-gray-100 dark:stroke-zinc-800" strokeWidth="8" fill="none" />
                     <circle cx="50" cy="50" r="44" stroke={getHexColor(tracker.color)} strokeWidth="8" fill="none" strokeDasharray="276" strokeDashoffset={276 - (pCent * 276 / 100)} strokeLinecap="round" className="transition-all duration-500" />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-2">
                     <span className="text-[8px] font-black uppercase text-gray-800 dark:text-zinc-200 leading-tight mb-0.5 line-clamp-2">{tracker.name}</span>
                     <span className="text-xl font-black leading-none" style={{ color: getHexColor(tracker.color) }}>
                        {isTime ? Math.floor(totalTimeSecs / 60) : vals.quantity}
                     </span>
                     <span className="text-[9px] font-bold text-gray-400">/{isTime ? tracker.goalTime : tracker.goal}{isTime && 'm'}</span>
                  </div>
               </div>
               <div className="flex flex-col items-center gap-1.5 h-full justify-center pb-1">
                   <button onClick={() => togglePin(tracker.id)} className="text-gray-400 hover:text-red-500 text-xl leading-none self-end mb-1 transition-colors" title="Odepnij">×</button>
                   {isTime ? (
                      <button onClick={() => toggleTimer(todayStr, tracker.id)} className="w-12 h-12 rounded-full flex items-center justify-center text-white shadow-lg active:scale-95 transition-transform" style={{ backgroundColor: getHexColor(tracker.color) }}>
                         {isTimerActive ? <span className="font-black text-lg">||</span> : <span className="font-black text-lg ml-1">▶</span>}
                      </button>
                   ) : (
                      <div className="flex flex-col items-center gap-1.5">
                         <button onClick={() => updateTrackerValue(todayStr, tracker.id, 'quantity', -1)} className="w-8 h-8 rounded-full bg-gray-200 dark:bg-zinc-800 text-gray-600 dark:text-zinc-300 flex items-center justify-center font-bold text-lg active:scale-95 transition-transform pb-1">−</button>
                         <button onClick={() => updateTrackerValue(todayStr, tracker.id, 'quantity', 1)} className="w-12 h-12 rounded-full text-white flex items-center justify-center font-black text-2xl shadow-lg active:scale-95 transition-transform" style={{ backgroundColor: getHexColor(tracker.color) }}>+</button>
                      </div>
                   )}
                </div>
            </div>
          )
       })}
    </div>
  );
}