import React, { useState, useEffect, useRef } from 'react';
import { dataService } from './services/dataService';
import { COLOR_PRESETS, getTodayDate, getEndOfWeekDate, playBeep } from './utils/helpers';
import Settings from './components/Settings';
import Tasks from './components/Tasks';
import Trackers from './components/Trackers';
import PinnedWidgets from './components/PinnedWidgets';

const DEFAULT_HOTKEYS = {
  newTask: 'n', toggleTab: 't', viewList: 'z', viewWeek: 'x', viewMonth: 'c', viewKanban: 'v',
  filterAll: 'q', filterToday: 'w', filterWeek: 'e', filterNone: 'r'
}

export default function App() {
  const [data, setData] = useState(() => {
    const loaded = dataService.load();
    let loadedCats = loaded.categories || [];
    if (loadedCats.length === 0) {
      loadedCats = [{ id: '1', name: 'Kategoria 1', color: COLOR_PRESETS[0], isVisible: true }];
    }
    const categories = loadedCats.map((c, idx) => ({
      ...c, isVisible: c.isVisible !== false, isDefault: idx === 0 
    }));
    
    const trackers = (loaded.trackers || []).map(t => ({
      ...t, type: t.type || 'quantity', goalTime: t.goalTime || 30
    }));

    const rawSettings = loaded.settings || {};
    const settings = {
      theme: window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light',
      deadlineFormat: 'countdown-h',
      filterDisplayMode: 'full',
      categoryDisplayMode: 'full',
      taskClickBehavior: 'expand',
      layoutWidth: 'default',
      defaultStartupView: 'list-today',
      pinnedTrackers: rawSettings.pinnedTrackers || [],
      ...rawSettings,
      hotkeys: { ...DEFAULT_HOTKEYS, ...(rawSettings.hotkeys || {}) }
    };

    return { ...loaded, categories, trackers, trackerLogs: loaded.trackerLogs || {}, settings };
  });

  const [activeTab, setActiveTab] = useState('tasks');
  const [isAppMenuOpen, setIsAppMenuOpen] = useState(false);
  const [isCategoryMenuOpen, setIsCategoryMenuOpen] = useState(false);
  
  const [activeTimer, setActiveTimer] = useState(() => data.settings.activeTimer || null); 
  const activeTimerRef = useRef(activeTimer);
  const dataRef = useRef(data);
  const [nowTick, setNowTick] = useState(Date.now());
  const [isMobile, setIsMobile] = useState(false);

  const todayStr = getTodayDate();
  const eowStr = getEndOfWeekDate();

  useEffect(() => { activeTimerRef.current = activeTimer; }, [activeTimer]);
  useEffect(() => { dataRef.current = data; }, [data]);

  // Awaryjne zapisywanie timera do local storage na wypadek zamknięcia karty
  useEffect(() => {
    const handleUnload = () => {
       const timer = activeTimerRef.current;
       if (timer) {
           const sessionSeconds = Math.floor((Date.now() - timer.start) / 1000);
           const currentData = dataRef.current;
           const savedData = JSON.parse(localStorage.getItem('rusz_dupe_data') || '{}');
           
           if (!savedData.trackerLogs) savedData.trackerLogs = currentData.trackerLogs || {};
           if (!savedData.trackerLogs[timer.dateStr]) savedData.trackerLogs[timer.dateStr] = {};
           
           const raw = savedData.trackerLogs[timer.dateStr][timer.id];
           const currentLogs = (raw && typeof raw === 'object') ? raw : { quantity: typeof raw === 'number' ? raw : 0, timeSpent: 0 };
           
           savedData.trackerLogs[timer.dateStr][timer.id] = { ...currentLogs, timeSpent: currentLogs.timeSpent + sessionSeconds };
           savedData.settings = { ...(currentData.settings || {}), activeTimer: null };
           
           localStorage.setItem('rusz_dupe_data', JSON.stringify(savedData));
       }
    };
    window.addEventListener('beforeunload', handleUnload);
    return () => window.removeEventListener('beforeunload', handleUnload);
  }, []);

// System tickania na żywo dla Timera i automatyczny zapis do state
  useEffect(() => {
    let int;
    if (activeTimer) {
      int = setInterval(() => {
         setNowTick(Date.now());
      }, 1000);
    }
    return () => clearInterval(int);
  }, [activeTimer]);

useEffect(() => {
    if (activeTimer && !activeTimer.alarmed) {
       const tracker = data.trackers.find(t => t.id === activeTimer.id);
       if (tracker) {
          const targetSeconds = (tracker.goalTime || 30) * 60;
          const r = data.trackerLogs?.[activeTimer.dateStr]?.[activeTimer.id];
          const currentTotal = (r && typeof r === 'object') ? r.timeSpent : 0;
          const sessionSecs = Math.floor((nowTick - activeTimer.start) / 1000);
          
          if (currentTotal + sessionSecs >= targetSeconds) {
             playBeep();
             setActiveTimer(p => {
                if(!p) return null;
                const newT = {...p, alarmed: true};
                setData(prev => ({...prev, settings: {...prev.settings, activeTimer: newT}}));
                return newT;
             });
          }
       }
    }
  }, [nowTick, activeTimer, data.trackers, data.trackerLogs]);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => { dataService.save(data); }, [data]);

  useEffect(() => {
    const root = document.documentElement;
    if (data.settings.theme === 'dark') { root.classList.add('dark'); root.style.colorScheme = 'dark'; }
    else { root.classList.remove('dark'); root.style.colorScheme = 'light'; }
  }, [data.settings.theme]);

  // Globalny skrót przełączania Tabów (reszta skrótów żyje w wtyczkach)
  useEffect(() => {
    const handleKeyDown = (e) => {
      const tag = e.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (isAppMenuOpen || isCategoryMenuOpen) return;

      const hk = data.settings.hotkeys || DEFAULT_HOTKEYS;
      if (e.key.toLowerCase() === hk.toggleTab) {
        e.preventDefault(); 
        setActiveTab(prev => prev === 'tasks' ? 'trackers' : 'tasks');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isAppMenuOpen, isCategoryMenuOpen, data.settings.hotkeys]);

  // Funkcje Globalne Trackerów przekazywane w dół
  const togglePin = (trackerId) => {
    setData(prev => {
      let pinned = [...(prev.settings.pinnedTrackers || [])];
      if (pinned.includes(trackerId)) {
        pinned = pinned.filter(id => id !== trackerId);
      } else {
        if (pinned.length >= 3) pinned.shift();
        pinned.push(trackerId);
      }
      return { ...prev, settings: { ...prev.settings, pinnedTrackers: pinned } };
    });
  };

  const getTrackerValueObj = (dateStr, trackerId) => {
    const raw = data.trackerLogs?.[dateStr]?.[trackerId];
    if (raw && typeof raw === 'object') return { quantity: Number(raw.quantity) || 0, timeSpent: Number(raw.timeSpent) || 0 };
    if (typeof raw === 'number') return { quantity: raw, timeSpent: 0 };
    return { quantity: 0, timeSpent: 0 };
  };

  const updateTrackerValue = (dateStr, trackerId, type, amount) => {
    setData(prev => {
      const currentLogsForDate = prev.trackerLogs[dateStr] || {};
      const cObj = currentLogsForDate[trackerId] || { quantity: 0, timeSpent: 0 };
      
      let nv = (cObj[type] || 0) + amount;
      if (nv < 0) nv = 0;

      return {
        ...prev,
        trackerLogs: {
          ...prev.trackerLogs,
          [dateStr]: {
            ...currentLogsForDate,
            [trackerId]: { ...cObj, [type]: nv }
          }
        }
      };
    });
  };

const toggleTimer = (dateStr, trackerId) => {
    setData(prevData => {
       const prevTimer = prevData.settings?.activeTimer;
       if (prevTimer?.id === trackerId && prevTimer?.dateStr === dateStr) {
           // WYŁĄCZENIE TIMERA I ZAPIS CZASU DO STANU
           const sessionSecs = Math.floor((Date.now() - prevTimer.start) / 1000);
           const currentLogsForDate = prevData.trackerLogs[dateStr] || {};
           const cObj = currentLogsForDate[trackerId] || { quantity: 0, timeSpent: 0 };
           
           setActiveTimer(null);
           return { 
             ...prevData, 
             settings: { ...prevData.settings, activeTimer: null },
             trackerLogs: {
               ...prevData.trackerLogs,
               [dateStr]: {
                 ...currentLogsForDate,
                 [trackerId]: { ...cObj, timeSpent: cObj.timeSpent + sessionSecs }
               }
             }
           };
       } else {
           // WŁĄCZENIE TIMERA
           const currentLogsForDate = prevData.trackerLogs[dateStr] || {};
           const cObj = currentLogsForDate[trackerId] || { quantity: 0, timeSpent: 0 };
           const accum = cObj.timeSpent || 0;
           
           const newTimer = { id: trackerId, start: Date.now(), accum, alarmed: false, dateStr };
           setActiveTimer(newTimer);
           
           return {
             ...prevData,
             settings: { ...prevData.settings, activeTimer: newTimer }
           };
       }
    });
  };

  const layoutContainerClass = data.settings.layoutWidth === 'full' && !isMobile ? 'w-full px-4 md:px-8 max-w-[2000px] mx-auto' : 'max-w-5xl mx-auto p-4';

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-zinc-950 text-gray-900 dark:text-zinc-100 font-sans transition-colors duration-200 selection:bg-orange-500/30">
      <style>{`
        @keyframes blinkOverdue { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.2; transform: scale(0.95); background-color: #ef4444; color: white; } }
        .blink-overdue { animation: blinkOverdue 0.6s ease-in-out 3; }
        @keyframes modalFadeIn { from { opacity: 0; transform: scale(0.95) translateY(10px); } to { opacity: 1; transform: scale(1) translateY(0); } }
        .modal-animate { animation: modalFadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .bg-gradient-color { background: conic-gradient(from 90deg, red, yellow, lime, aqua, blue, magenta, red); }
        @keyframes shine { 0% { left: -100%; } 100% { left: 100%; } }
        .animate-shine::after { content: ''; position: absolute; top: 0; left: -100%; width: 50%; height: 100%; background: linear-gradient(90deg, transparent, rgba(255,255,255,0.8), transparent); animation: shine 0.7s ease-out forwards; }
        .hide-scroll { -ms-overflow-style: none; scrollbar-width: none; }
        .hide-scroll::-webkit-scrollbar { display: none; }
      `}</style>

      {/* Pływające Widgety */}
      <PinnedWidgets 
         pinnedIds={data.settings.pinnedTrackers || []} trackers={data.trackers} 
         getTrackerValueObj={getTrackerValueObj} updateTrackerValue={updateTrackerValue} 
         activeTimer={activeTimer} toggleTimer={toggleTimer} togglePin={togglePin} 
         nowTick={nowTick} isMobile={isMobile} todayStr={todayStr}
      />

      <div className={`flex flex-col h-screen relative z-10 ${layoutContainerClass}`}>
        <header className="py-6 border-b border-gray-200 dark:border-zinc-900 flex justify-between items-center gap-4 shrink-0">
          <div className="flex items-center gap-4 md:gap-6 flex-1 min-w-0">
            <h1 className="text-2xl font-black tracking-tighter cursor-pointer shrink-0" onClick={() => setActiveTab('tasks')}>
              rusz <span className="text-orange-500">dupę.</span>
            </h1>
            <div className="flex bg-gray-200 dark:bg-zinc-900 p-1 rounded-lg shrink-0">
              <button onClick={() => setActiveTab('tasks')} className={`px-3 py-1.5 md:px-4 text-sm font-bold rounded-md transition-all ${activeTab === 'tasks' ? 'bg-white dark:bg-zinc-800 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-zinc-400 hover:text-gray-700 dark:hover:text-zinc-200'}`}>Zadania</button>
              <button onClick={() => setActiveTab('trackers')} className={`px-3 py-1.5 md:px-4 text-sm font-bold rounded-md transition-all ${activeTab === 'trackers' ? 'bg-white dark:bg-zinc-800 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-zinc-400 hover:text-gray-700 dark:hover:text-zinc-200'}`}>Trackery</button>
            </div>
          </div>
          <button onClick={() => setIsAppMenuOpen(true)} className="p-2 md:px-4 md:py-2 rounded-lg bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors text-sm font-medium shadow-sm shrink-0 flex items-center gap-2">
            <span className="hidden md:inline">⚙️ Ustawienia</span>
            <span className="md:hidden">⚙️</span>
          </button>
        </header>

        {activeTab === 'tasks' && (
          <Tasks 
             data={data} setData={setData} isMobile={isMobile} todayStr={todayStr} eowStr={eowStr} 
             openCategorySettings={() => setIsCategoryMenuOpen(true)}
             isAppMenuOpen={isAppMenuOpen} isCategoryMenuOpen={isCategoryMenuOpen} DEFAULT_HOTKEYS={DEFAULT_HOTKEYS}
          />
        )}

        {activeTab === 'trackers' && (
           <Trackers 
             data={data} setData={setData} isMobile={isMobile} todayStr={todayStr}
             getTrackerValueObj={getTrackerValueObj} updateTrackerValue={updateTrackerValue} 
             activeTimer={activeTimer} toggleTimer={toggleTimer} nowTick={nowTick} togglePin={togglePin}
             isAppMenuOpen={isAppMenuOpen} isCategoryMenuOpen={isCategoryMenuOpen} DEFAULT_HOTKEYS={DEFAULT_HOTKEYS}
           />
        )}
      </div>

      <Settings 
        data={data} setData={setData} 
        isAppMenuOpen={isAppMenuOpen} setIsAppMenuOpen={setIsAppMenuOpen}
        isCategoryMenuOpen={isCategoryMenuOpen} setIsCategoryMenuOpen={setIsCategoryMenuOpen}
        DEFAULT_HOTKEYS={DEFAULT_HOTKEYS}
      />
    </div>
  );
}