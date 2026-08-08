import React, { useState, useEffect } from 'react';
import { getHexColor, getPast7Days, formatTimeFromSeconds, COLOR_PRESETS } from '../utils/helpers';

export default function Trackers({ 
  data, setData, isMobile, todayStr,
  getTrackerValueObj, updateTrackerValue, activeTimer, toggleTimer, nowTick, togglePin,
  isAppMenuOpen, isCategoryMenuOpen, DEFAULT_HOTKEYS
}) {
  const [trackerDate, setTrackerDate] = useState(todayStr);
  const [isAddingTracker, setIsAddingTracker] = useState(false);
  const [editingTrackerId, setEditingTrackerId] = useState(null);
  const [expandedTrackerId, setExpandedTrackerId] = useState(null);
  const [goalReachedId, setGoalReachedId] = useState(null);
  const [newTracker, setNewTracker] = useState({ name: '', goal: 10, unit: 'szt.', color: COLOR_PRESETS[0], type: 'quantity', goalTime: 30 });

  // Nasłuchiwanie skrótu "N" dla trackerów
  useEffect(() => {
    const handleKeyDown = (e) => {
      const tag = e.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      if (e.key === 'Escape') {
        if (isAddingTracker) { setIsAddingTracker(false); setEditingTrackerId(null); }
        setExpandedTrackerId(null);
        return;
      }

      if (isAppMenuOpen || isCategoryMenuOpen || isAddingTracker) return;

      const hk = data.settings.hotkeys || DEFAULT_HOTKEYS;
      if (e.key.toLowerCase() === hk.newTask) {
        e.preventDefault();
        setIsAddingTracker(true);
        setEditingTrackerId(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isAddingTracker, isAppMenuOpen, isCategoryMenuOpen, data.settings.hotkeys, DEFAULT_HOTKEYS]);

  useEffect(() => {
    if (isAddingTracker) {
      if (editingTrackerId) {
        const tr = data.trackers.find(t => t.id === editingTrackerId);
        if (tr) setNewTracker({...tr});
      } else {
        setNewTracker({ name: '', goal: 10, unit: 'szt.', color: COLOR_PRESETS[0], type: 'quantity', goalTime: 30 });
      }
    }
  }, [isAddingTracker, editingTrackerId, data.trackers]);

  const handleDateChange = (daysOff, reset = false) => {
    if (reset) {
       setTrackerDate(todayStr);
    } else {
       const d = new Date(trackerDate);
       d.setDate(d.getDate() + daysOff);
       const tzOffset = d.getTimezoneOffset() * 60000;
       setTrackerDate((new Date(d - tzOffset)).toISOString().split('T')[0]);
    }
  };

  const handleTrackerSubmit = (e) => {
    e.preventDefault();
    if (!newTracker.name.trim()) return;
    const g = Number(newTracker.goal) || 1;
    const tG = Number(newTracker.goalTime) || 30;
    
    if (editingTrackerId) {
      setData(prev => ({ ...prev, trackers: prev.trackers.map(t => t.id === editingTrackerId ? { ...t, name: newTracker.name, goal: g, unit: newTracker.unit || '', color: newTracker.color, type: newTracker.type, goalTime: tG } : t) }));
    } else {
      setData(prev => ({ ...prev, trackers: [...prev.trackers, { id: crypto.randomUUID(), name: newTracker.name, goal: g, unit: newTracker.unit || '', color: newTracker.color, type: newTracker.type, goalTime: tG }] }));
    }
    setIsAddingTracker(false);
    setEditingTrackerId(null);
  };

  const deleteTracker = (id) => { 
    if(window.confirm("Usunąć tracker i całą jego historię?")) {
      setData(prev => ({ ...prev, trackers: prev.trackers.filter(t => t.id !== id) })); 
    }
  };

  const isPinned = (id) => data.settings.pinnedTrackers?.includes(id);
  const hasPinned = data.settings.pinnedTrackers?.length > 0;
  const fabBottom = isMobile && hasPinned ? 'bottom-[5.5rem]' : 'bottom-8';

  return (
    <div className="flex-1 flex flex-col pt-4 relative">
      <div className="flex justify-between items-center bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 p-2 rounded-xl shadow-sm mb-6 shrink-0">
        <button onClick={() => handleDateChange(-1)} className="px-4 py-2 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg text-gray-600 dark:text-zinc-400 transition-colors font-bold">&lsaquo; Wczoraj</button>
        <div className="flex flex-col items-center">
          <span className="text-sm font-black text-gray-900 dark:text-white tracking-wide">{trackerDate === todayStr ? 'DZISIAJ' : trackerDate}</span>
          {trackerDate !== todayStr && <button onClick={() => handleDateChange(0, true)} className="text-[10px] text-orange-500 font-bold uppercase hover:underline mt-0.5">Wróć do dziś</button>}
        </div>
        <button onClick={() => handleDateChange(1)} disabled={trackerDate === todayStr} className={`px-4 py-2 rounded-lg font-bold transition-colors ${trackerDate === todayStr ? 'text-gray-300 dark:text-zinc-700 cursor-not-allowed' : 'text-gray-600 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-800'}`}>Jutro &rsaquo;</button>
      </div>

      <div className={`flex-1 overflow-y-auto pb-32 pr-2 hide-scroll ${data.settings?.layoutWidth === 'full' ? 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 content-start' : 'space-y-4'}`}>
        {data.trackers.length === 0 && (
          <div className="text-center mt-20 col-span-full">
            <p className="text-gray-500 dark:text-zinc-500 text-lg font-medium">Nie masz jeszcze żadnych trackerów.</p>
            <p className="text-gray-400 dark:text-zinc-600 text-sm mt-1">Naciśnij plus na dole, aby wyznaczyć pierwszy cel.</p>
          </div>
        )}

        {data.trackers.map(tracker => {
          const vals = getTrackerValueObj(trackerDate, tracker.id);
          const isExpanded = expandedTrackerId === tracker.id;
          const isTimerActive = activeTimer?.id === tracker.id;
          const isTime = tracker.type === 'time';
          const progQty = !isTime ? Math.min((vals.quantity / (tracker.goal || 1)) * 100, 100) : 0;
          
          let sessionSecs = 0;
          if (isTimerActive) sessionSecs = Math.floor((nowTick - activeTimer.start) / 1000);
          const totalTimeSecs = vals.timeSpent + sessionSecs;
          const targetSecs = (tracker.goalTime || 30) * 60;
          const progTime = isTime ? Math.min((totalTimeSecs / targetSecs) * 100, 100) : 0;
          const goalMet = isTime ? progTime >= 100 : progQty >= 100;

          return (
            <div key={tracker.id} className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-sm hover:shadow transition-shadow h-max relative">
              <div className="p-5 flex flex-col xl:flex-row xl:items-center gap-4 cursor-pointer" onClick={() => setExpandedTrackerId(isExpanded ? null : tracker.id)}>
                <div className="flex-1 pr-4">
                  <div className="flex justify-between items-end mb-2">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                      <span style={{ backgroundColor: getHexColor(tracker.color) }} className="inline-block w-3 h-3 rounded-full shrink-0"></span>
                      {tracker.name}
                      {goalMet && <span className="text-sm select-none" title="Cel osiągnięty!">✅</span>}
                    </h3>
                  </div>
                  
                  <div className="flex flex-col gap-2">
                     {!isTime ? (
                        <div className="flex items-center justify-between gap-4">
                          <div className="w-full h-3 bg-gray-100 dark:bg-zinc-950 rounded-full overflow-hidden relative">
                            <div className="h-full transition-all duration-500 ease-out relative overflow-hidden" style={{ width: `${progQty}%`, backgroundColor: getHexColor(tracker.color) }} />
                          </div>
                          <div className="text-right shrink-0 whitespace-nowrap min-w-[70px]">
                            <span className="text-lg font-black text-gray-900 dark:text-white leading-none">{vals.quantity}</span>
                            <span className="text-xs font-medium text-gray-500 dark:text-zinc-500 ml-1">/ {tracker.goal} {tracker.unit}</span>
                          </div>
                        </div>
                     ) : (
                        <div className="flex items-center justify-between gap-4">
                          <div className="w-full h-3 bg-gray-100 dark:bg-zinc-950 rounded-full overflow-hidden relative">
                            <div className="h-full transition-all duration-500 ease-out relative overflow-hidden" style={{ width: `${progTime}%`, backgroundColor: getHexColor(tracker.color), opacity: 0.8 }} />
                          </div>
                          <div className="text-right shrink-0 whitespace-nowrap min-w-[70px]">
                            <span className="text-lg font-black text-gray-900 dark:text-white leading-none">{formatTimeFromSeconds(totalTimeSecs)}</span>
                            <span className="text-xs font-medium text-gray-500 dark:text-zinc-500 ml-1">/ {tracker.goalTime}m</span>
                          </div>
                        </div>
                     )}
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end xl:self-auto shrink-0 z-20" onClick={(e) => e.stopPropagation()}>
                  {!isTime ? (
                      <>
                        <button onClick={() => updateTrackerValue(trackerDate, tracker.id, 'quantity', -1)} className="w-10 h-10 flex items-center justify-center bg-gray-100 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 rounded-lg text-lg font-bold text-gray-600 dark:text-zinc-400 hover:bg-gray-200 dark:hover:bg-zinc-800 transition-colors">–</button>
                        <button onClick={() => updateTrackerValue(trackerDate, tracker.id, 'quantity', 1)} className="w-12 h-10 flex items-center justify-center bg-gray-900 dark:bg-zinc-100 text-white dark:text-black rounded-lg text-xl font-black hover:scale-105 active:scale-95 transition-all shadow-md">+</button>
                      </>
                  ) : (
                      <button onClick={() => toggleTimer(trackerDate, tracker.id)} className={`w-14 h-10 flex items-center justify-center rounded-lg text-xl font-black hover:scale-105 active:scale-95 transition-all shadow-md ml-1 ${isTimerActive ? 'bg-orange-500 text-white' : 'bg-gray-900 dark:bg-zinc-100 text-white dark:text-black'}`}>
                        {isTimerActive ? '⏸' : '▶'}
                      </button>
                  )}
                </div>
              </div>

              {isExpanded && (
                <div className="border-t border-gray-100 dark:border-zinc-800 bg-gray-50/50 dark:bg-zinc-950/50 p-5 cursor-default">
                  <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
                    <h4 className="text-xs font-bold text-gray-500 dark:text-zinc-400 uppercase tracking-wider">Ostatnie 7 dni</h4>
                    <div className="flex gap-4 items-center">
                      <button onClick={() => togglePin(tracker.id)} className="text-xs text-orange-500 font-bold hover:underline">
                        {isPinned(tracker.id) ? 'Odepnij Tracker' : '📌 Przypnij Tracker'}
                      </button>
                      <button onClick={() => { setIsAddingTracker(true); setEditingTrackerId(tracker.id); }} className="text-xs text-blue-500 font-bold hover:underline">Edytuj Tracker</button>
                      <button onClick={() => deleteTracker(tracker.id)} className="text-xs text-red-500 font-bold hover:underline">Usuń Tracker</button>
                    </div>
                  </div>
                  
                  <div className="flex justify-between items-end h-28 gap-1 md:gap-2 mt-4 w-full">
                    {getPast7Days(trackerDate).map((dayStr) => {
                       const pastVals = getTrackerValueObj(dayStr, tracker.id);
                       const pCentQty = !isTime ? Math.min((pastVals.quantity / (tracker.goal || 1)) * 100, 100) : 0;
                       const pCentTime = isTime ? Math.min((pastVals.timeSpent / ((tracker.goalTime || 1)*60)) * 100, 100) : 0;
                       const isCurrentViewedDay = dayStr === trackerDate;
                       
                       return (
                         <div key={dayStr} className="flex-1 flex flex-col items-center justify-end gap-1 group relative h-full">
                            <div className="opacity-0 group-hover:opacity-100 absolute -top-10 text-[10px] bg-black dark:bg-white text-white dark:text-black px-1.5 py-0.5 rounded transition-opacity whitespace-nowrap z-10 font-bold flex flex-col items-center pointer-events-none">
                              {!isTime && <span>{pastVals.quantity} {tracker.unit}</span>}
                              {isTime && <span className="text-[8px] text-gray-300 dark:text-gray-600">{formatTimeFromSeconds(pastVals.timeSpent)}</span>}
                            </div>
                            <div className={`w-full max-w-[24px] bg-gray-200 dark:bg-zinc-800 rounded-t-sm relative flex flex-col justify-end h-full ${isCurrentViewedDay ? 'ring-2 ring-orange-500 ring-offset-1 dark:ring-offset-zinc-950' : ''}`}>
                               {isTime && <div className="w-full transition-all" style={{ height: `${pCentTime}%`, backgroundColor: getHexColor(tracker.color), opacity: isCurrentViewedDay ? 0.7 : 0.4 }} />}
                               {!isTime && <div className="w-full transition-all" style={{ height: `${pCentQty}%`, backgroundColor: getHexColor(tracker.color), opacity: isCurrentViewedDay ? 1 : 0.6 }} />}
                            </div>
                            <span className={`text-[9px] font-medium mt-1 ${isCurrentViewedDay ? 'text-orange-500 font-bold' : 'text-gray-400 dark:text-zinc-600'}`}>
                              {dayStr.slice(5).replace('-', '.')}
                            </span>
                         </div>
                       )
                    })}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* PRZYCISK FAB DLA TRACKERÓW */}
      {!isAddingTracker && !isAppMenuOpen && !isCategoryMenuOpen && (
        <div className={`fixed ${fabBottom} right-4 md:right-8 flex items-center gap-3 z-[80] pointer-events-none transition-all`}>
          <span className="hidden sm:inline-block pointer-events-auto text-xs font-medium bg-white/90 dark:bg-zinc-800/90 backdrop-blur px-3 py-1.5 rounded-lg text-gray-500 dark:text-zinc-400 shadow-sm border border-gray-200 dark:border-zinc-700">
            <strong>{(data.settings.hotkeys?.newTask || 'N').toUpperCase()}</strong>: Nowy | <strong>{(data.settings.hotkeys?.toggleTab || 'T').toUpperCase()}</strong>: Zmiana
          </span>
          <button 
            onClick={() => { setIsAddingTracker(true); setEditingTrackerId(null); }} 
            className="w-14 h-14 bg-orange-500 hover:bg-orange-600 text-black rounded-full flex items-center justify-center text-3xl font-light shadow-xl hover:scale-105 transition-all pointer-events-auto"
          >
            +
          </button>
        </div>
      )}

      {/* MODAL DODAWANIA/EDYCJI TRACKERA */}
      {isAddingTracker && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 transition-opacity" onMouseDown={() => {setIsAddingTracker(false); setEditingTrackerId(null);}}>
          <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl w-full max-w-md p-6 shadow-2xl relative modal-animate" onMouseDown={(e) => e.stopPropagation()}>
            <form onSubmit={handleTrackerSubmit} className="flex flex-col gap-4">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-bold text-gray-500 dark:text-zinc-400 uppercase tracking-wider">{editingTrackerId ? 'Edytuj Tracker' : 'Nowy Tracker'}</span>
                <button type="button" onClick={() => {setIsAddingTracker(false); setEditingTrackerId(null);}} className="text-gray-400 hover:text-gray-700 dark:hover:text-zinc-300" tabIndex={-1}>✕</button>
              </div>
              
              <div>
                <label className="block text-xs font-bold text-gray-500 dark:text-zinc-500 mb-1 ml-1 uppercase">Co chcesz śledzić?</label>
                <input autoFocus required type="text" placeholder="np. Wypita woda, Nauka języka" value={newTracker.name} onChange={(e) => setNewTracker(prev => ({...prev, name: e.target.value}))} className="w-full bg-gray-50 dark:bg-zinc-950 border border-gray-300 dark:border-zinc-700 rounded-lg px-4 py-3 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-zinc-600 focus:outline-none focus:border-orange-500 transition-colors"/>
              </div>

              <div className="flex flex-col gap-2">
                <label className="block text-xs font-bold text-gray-500 dark:text-zinc-500 ml-1 uppercase">Typ Trackera</label>
                <div className="flex bg-gray-100 dark:bg-zinc-950 p-1 rounded-lg">
                  <button type="button" onClick={() => setNewTracker(prev => ({...prev, type: 'quantity'}))} className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${newTracker.type === 'quantity' ? 'bg-white dark:bg-zinc-800 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:text-zinc-400 dark:hover:text-zinc-200'}`}>Ilościowy</button>
                  <button type="button" onClick={() => setNewTracker(prev => ({...prev, type: 'time'}))} className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${newTracker.type === 'time' ? 'bg-white dark:bg-zinc-800 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:text-zinc-400 dark:hover:text-zinc-200'}`}>Czasowy</button>
                </div>
              </div>

              <div className="flex gap-3 mt-1">
                {newTracker.type === 'quantity' && (
                  <>
                    <div className="flex-1">
                      <label className="block text-xs font-bold text-gray-500 dark:text-zinc-500 mb-1 ml-1 uppercase">Cel (Ilość)</label>
                      <input required type="number" min="1" placeholder="np. 10" value={newTracker.goal} onChange={(e) => setNewTracker(prev => ({...prev, goal: e.target.value}))} className="w-full bg-gray-50 dark:bg-zinc-950 border border-gray-300 dark:border-zinc-700 rounded-lg px-3 py-2.5 text-gray-900 dark:text-white focus:outline-none focus:border-orange-500 transition-colors"/>
                    </div>
                    <div className="w-20">
                      <label className="block text-xs font-bold text-gray-500 dark:text-zinc-500 mb-1 ml-1 uppercase">Jedn.</label>
                      <input type="text" placeholder="szt" value={newTracker.unit} onChange={(e) => setNewTracker(prev => ({...prev, unit: e.target.value}))} className="w-full bg-gray-50 dark:bg-zinc-950 border border-gray-300 dark:border-zinc-700 rounded-lg px-3 py-2.5 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-zinc-600 focus:outline-none focus:border-orange-500 transition-colors"/>
                    </div>
                  </>
                )}
                {newTracker.type === 'time' && (
                  <div className="flex-1">
                    <label className="block text-xs font-bold text-gray-500 dark:text-zinc-500 mb-1 ml-1 uppercase">Czas (minuty)</label>
                    <input required type="number" min="1" placeholder="np. 30" value={newTracker.goalTime} onChange={(e) => setNewTracker(prev => ({...prev, goalTime: e.target.value}))} className="w-full bg-gray-50 dark:bg-zinc-950 border border-gray-300 dark:border-zinc-700 rounded-lg px-3 py-2.5 text-gray-900 dark:text-white focus:outline-none focus:border-orange-500 transition-colors"/>
                  </div>
                )}
              </div>

              <div className="mt-1">
                <label className="block text-xs font-bold text-gray-500 dark:text-zinc-400 mb-2 ml-1 uppercase">Wybierz kolor</label>
                <div className="flex gap-2 relative mt-1">
                    {COLOR_PRESETS.map(preset => (
                      <button type="button" key={preset} onClick={() => setNewTracker(prev => ({...prev, color: preset}))} style={{ backgroundColor: preset }} className={`w-6 h-6 md:w-8 md:h-8 rounded-full transition-transform ${newTracker.color === preset ? 'ring-2 ring-offset-2 ring-gray-900 dark:ring-zinc-100 scale-110' : 'hover:scale-110'}`} />
                    ))}
                </div>
              </div>

              <button type="submit" className="mt-2 w-full bg-orange-500 hover:bg-orange-600 text-black font-bold px-6 py-3 rounded-lg transition-colors shadow-md">{editingTrackerId ? 'Zapisz zmiany' : 'Utwórz Tracker'}</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}