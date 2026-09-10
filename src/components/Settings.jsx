import React, { useState, useEffect, useRef } from 'react';
import { getHexColor, COLOR_PRESETS } from '../utils/helpers';

export default function Settings({ 
  data, setData, 
  isAppMenuOpen, setIsAppMenuOpen, 
  isCategoryMenuOpen, setIsCategoryMenuOpen, 
  DEFAULT_HOTKEYS 
}) {
  const [listeningKeyFor, setListeningKeyFor] = useState(null);
  const [colorPickerTarget, setColorPickerTarget] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (listeningKeyFor) {
        e.preventDefault();
        if (e.key === 'Escape') { setListeningKeyFor(null); return; }
        setData(prev => ({ ...prev, settings: { ...prev.settings, hotkeys: { ...prev.settings.hotkeys, [listeningKeyFor]: e.key.toLowerCase() } } }));
        setListeningKeyFor(null);
        return;
      }
      if (e.key === 'Escape') {
        if (isAppMenuOpen) setIsAppMenuOpen(false);
        if (isCategoryMenuOpen) setIsCategoryMenuOpen(false);
        setColorPickerTarget(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [listeningKeyFor, isAppMenuOpen, isCategoryMenuOpen, setData, setIsAppMenuOpen, setIsCategoryMenuOpen]);

  const updateSetting = (key, value) => setData(prev => ({ ...prev, settings: { ...prev.settings, [key]: value } }));
  const resetHotkeys = () => setData(prev => ({ ...prev, settings: { ...prev.settings, hotkeys: DEFAULT_HOTKEYS } }));

  const toggleCatVisibility = (id) => setData(prev => ({ ...prev, categories: prev.categories.map(c => c.id === id ? { ...c, isVisible: !c.isVisible } : c) }));
  const renameCat = (id, newName) => setData(prev => ({ ...prev, categories: prev.categories.map(c => c.id === id ? { ...c, name: newName } : c) }));
  
  const deleteCat = (id) => { 
    const idx = data.categories.findIndex(c => c.id === id);
    if (idx === 0) { alert("Główna kategoria nie może zostać usunięta."); return; }
    if (window.confirm("Usunąć tę kategorię? Nie stracisz zadań (przejdą do braku kategorii).")) {
       setData(prev => ({ ...prev, categories: prev.categories.filter(c => c.id !== id), tasks: prev.tasks.map(t => t.categoryId === id ? { ...t, categoryId: null } : t) })); 
    }
  };
  
  const updateCategoryColor = (id, newColor, closePicker = true) => { setData(prev => ({ ...prev, categories: prev.categories.map(c => c.id === id ? { ...c, color: newColor } : c) })); if (closePicker) setColorPickerTarget(null); };
  const addNewCatFromSettings = () => setData(prev => ({ ...prev, categories: [...prev.categories, { id: crypto.randomUUID(), name: 'Nowa Kategoria', color: COLOR_PRESETS[0], isVisible: true, isDefault: false }] }));

  // --- LOGIKA JSON: EKSPORT ---
  const handleExportData = () => {
    const dataStr = JSON.stringify(data, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    const dateStamp = new Date().toISOString().split('T')[0];
    a.download = `rusz_dupe_backup_${dateStamp}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // --- LOGIKA JSON: IMPORT ---
  const handleImportData = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const importedData = JSON.parse(event.target.result);
        
        // Prosta walidacja, czy plik jest faktycznie backupem z naszej aplikacji
        if (importedData.tasks && importedData.categories && importedData.settings) {
          setData(importedData);
          alert("Dane zostały pomyślnie przywrócone!");
          // Twarde przeładowanie by wyczyścić interwały stoperów i stany
          window.location.reload(); 
        } else {
          alert("Plik jest uszkodzony lub nie pochodzi z tej aplikacji.");
        }
      } catch (error) {
        alert("Błąd podczas odczytywania pliku JSON.");
        console.error(error);
      }
    };
    reader.readAsText(file);
    // Reset inputu, aby móc wgrać ten sam plik ponownie w razie potrzeby
    e.target.value = null; 
  };

  return (
    <>
      {/* MODAL: USTAWIENIA GŁÓWNE APLIKACJI */}
      {isAppMenuOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 transition-opacity" onMouseDown={() => setIsAppMenuOpen(false)}>
          <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl w-full max-w-md p-6 shadow-2xl relative modal-animate max-h-[90vh] overflow-y-auto hide-scroll" onMouseDown={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Ustawienia Aplikacji</h2>
              <button onClick={() => setIsAppMenuOpen(false)} className="text-gray-400 hover:text-gray-700 dark:hover:text-zinc-300">✕</button>
            </div>

            <div className="mb-6">
              <label className="block text-xs font-bold text-gray-500 dark:text-zinc-400 mb-3 uppercase tracking-wider">Domyślny Widok Startowy</label>
              <div className="flex flex-col gap-2">
                <button onClick={() => updateSetting('defaultStartupView', 'list-all')} className={`w-full text-left px-4 py-2 rounded-lg text-sm font-medium transition-colors ${data.settings.defaultStartupView === 'list-all' ? 'bg-orange-50 dark:bg-orange-500/10 border border-orange-500 text-orange-600 dark:text-orange-400' : 'bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 text-gray-700 dark:text-zinc-300'}`}>Lista: Wszystkie</button>
                <button onClick={() => updateSetting('defaultStartupView', 'kanban')} className={`w-full text-left px-4 py-2 rounded-lg text-sm font-medium transition-colors ${data.settings.defaultStartupView === 'kanban' ? 'bg-orange-50 dark:bg-orange-500/10 border border-orange-500 text-orange-600 dark:text-orange-400' : 'bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 text-gray-700 dark:text-zinc-300'}`}>Tablica Kanban</button>
                <button onClick={() => updateSetting('defaultStartupView', 'list-today')} className={`w-full text-left px-4 py-2 rounded-lg text-sm font-medium transition-colors ${data.settings.defaultStartupView === 'list-today' ? 'bg-orange-50 dark:bg-orange-500/10 border border-orange-500 text-orange-600 dark:text-orange-400' : 'bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 text-gray-700 dark:text-zinc-300'}`}>Lista: Dzisiaj</button>
                <button onClick={() => updateSetting('defaultStartupView', 'list-week')} className={`w-full text-left px-4 py-2 rounded-lg text-sm font-medium transition-colors ${data.settings.defaultStartupView === 'list-week' ? 'bg-orange-50 dark:bg-orange-500/10 border border-orange-500 text-orange-600 dark:text-orange-400' : 'bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 text-gray-700 dark:text-zinc-300'}`}>Lista: W tym tygodniu</button>
                <button onClick={() => updateSetting('defaultStartupView', 'gantt')} className={`w-full text-left px-4 py-2 rounded-lg text-sm font-medium transition-colors ${data.settings.defaultStartupView === 'gantt' ? 'bg-orange-50 dark:bg-orange-500/10 border border-orange-500 text-orange-600 dark:text-orange-400' : 'bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 text-gray-700 dark:text-zinc-300'}`}>Harmonogram</button>
                <button onClick={() => updateSetting('defaultStartupView', 'month')} className={`w-full text-left px-4 py-2 rounded-lg text-sm font-medium transition-colors ${data.settings.defaultStartupView === 'month' ? 'bg-orange-50 dark:bg-orange-500/10 border border-orange-500 text-orange-600 dark:text-orange-400' : 'bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 text-gray-700 dark:text-zinc-300'}`}>Kalendarz</button>
              </div>
            </div>

            <div className="mb-6">
              <label className="block text-xs font-bold text-gray-500 dark:text-zinc-400 mb-3 uppercase tracking-wider">Szerokość Layoutu</label>
              <div className="flex gap-2">
                <button onClick={() => updateSetting('layoutWidth', 'default')} className={`flex-1 py-2 rounded-lg text-sm font-bold transition-colors ${data.settings.layoutWidth === 'default' ? 'bg-orange-500 text-white' : 'bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-zinc-400'}`}>Domyślny</button>
                <button onClick={() => updateSetting('layoutWidth', 'full')} className={`flex-1 py-2 rounded-lg text-sm font-bold transition-colors ${data.settings.layoutWidth === 'full' ? 'bg-orange-500 text-white' : 'bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-zinc-400'}`}>Pełna</button>
              </div>
            </div>

            <div className="mb-6">
              <label className="block text-xs font-bold text-gray-500 dark:text-zinc-400 mb-3 uppercase tracking-wider">Motyw</label>
              <div className="flex gap-2">
                <button onClick={() => updateSetting('theme', 'light')} className={`flex-1 py-2 rounded-lg text-sm font-bold transition-colors ${data.settings.theme === 'light' ? 'bg-orange-500 text-white' : 'bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-zinc-400'}`}>Jasny</button>
                <button onClick={() => updateSetting('theme', 'dark')} className={`flex-1 py-2 rounded-lg text-sm font-bold transition-colors ${data.settings.theme === 'dark' ? 'bg-orange-500 text-white' : 'bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-zinc-400'}`}>Ciemny</button>
              </div>
            </div>

            <div className="mb-6">
              <label className="block text-xs font-bold text-gray-500 dark:text-zinc-400 mb-3 uppercase tracking-wider">Zachowanie kliknięcia (Widok Listy)</label>
              <div className="flex gap-2">
                <button onClick={() => updateSetting('taskClickBehavior', 'expand')} className={`flex-1 py-2 rounded-lg text-sm font-bold transition-colors ${data.settings.taskClickBehavior === 'expand' ? 'bg-orange-500 text-white' : 'bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-zinc-400'}`}>Rozwija listę</button>
                <button onClick={() => updateSetting('taskClickBehavior', 'modal')} className={`flex-1 py-2 rounded-lg text-sm font-bold transition-colors ${data.settings.taskClickBehavior === 'modal' ? 'bg-orange-500 text-white' : 'bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-zinc-400'}`}>Otwiera kartę</button>
              </div>
            </div>

            <div className="mb-6">
              <label className="block text-xs font-bold text-gray-500 dark:text-zinc-400 mb-3 uppercase tracking-wider">Wygląd filtrów czasu</label>
              <div className="flex flex-col gap-2">
                <button onClick={() => updateSetting('filterDisplayMode', 'full')} className={`w-full text-left px-4 py-2 rounded-lg text-sm font-medium transition-colors ${data.settings.filterDisplayMode === 'full' ? 'bg-orange-50 dark:bg-orange-500/10 border border-orange-500 text-orange-600 dark:text-orange-400' : 'bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 text-gray-700 dark:text-zinc-300'}`}>Pełny</button>
                <button onClick={() => updateSetting('filterDisplayMode', 'compact')} className={`w-full text-left px-4 py-2 rounded-lg text-sm font-medium transition-colors ${data.settings.filterDisplayMode === 'compact' ? 'bg-orange-50 dark:bg-orange-500/10 border border-orange-500 text-orange-600 dark:text-orange-400' : 'bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 text-gray-700 dark:text-zinc-300'}`}>Tylko aktywne tekst</button>
                <button onClick={() => updateSetting('filterDisplayMode', 'minimal')} className={`w-full text-left px-4 py-2 rounded-lg text-sm font-medium transition-colors ${data.settings.filterDisplayMode === 'minimal' ? 'bg-orange-50 dark:bg-orange-500/10 border border-orange-500 text-orange-600 dark:text-orange-400' : 'bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 text-gray-700 dark:text-zinc-300'}`}>Same ikony</button>
              </div>
            </div>

            <div className="mb-6">
              <label className="block text-xs font-bold text-gray-500 dark:text-zinc-400 mb-3 uppercase tracking-wider">Wygląd kategorii</label>
              <div className="flex flex-col gap-2">
                <button onClick={() => updateSetting('categoryDisplayMode', 'full')} className={`w-full text-left px-4 py-2 rounded-lg text-sm font-medium transition-colors ${data.settings.categoryDisplayMode === 'full' ? 'bg-orange-50 dark:bg-orange-500/10 border border-orange-500 text-orange-600 dark:text-orange-400' : 'bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 text-gray-700 dark:text-zinc-300'}`}>Pełny</button>
                <button onClick={() => updateSetting('categoryDisplayMode', 'compact')} className={`w-full text-left px-4 py-2 rounded-lg text-sm font-medium transition-colors ${data.settings.categoryDisplayMode === 'compact' ? 'bg-orange-50 dark:bg-orange-500/10 border border-orange-500 text-orange-600 dark:text-orange-400' : 'bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 text-gray-700 dark:text-zinc-300'}`}>Tylko aktywne tekst</button>
                <button onClick={() => updateSetting('categoryDisplayMode', 'minimal')} className={`w-full text-left px-4 py-2 rounded-lg text-sm font-medium transition-colors ${data.settings.categoryDisplayMode === 'minimal' ? 'bg-orange-50 dark:bg-orange-500/10 border border-orange-500 text-orange-600 dark:text-orange-400' : 'bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 text-gray-700 dark:text-zinc-300'}`}>Same kropki</button>
              </div>
            </div>

            <div className="mb-8">
              <label className="block text-xs font-bold text-gray-500 dark:text-zinc-400 mb-3 uppercase tracking-wider">Wygląd deadline'ów</label>
              <div className="flex flex-col gap-2">
                <button onClick={() => updateSetting('deadlineFormat', 'datetime')} className={`w-full text-left px-4 py-3 rounded-lg text-sm font-medium transition-colors ${data.settings.deadlineFormat === 'datetime' ? 'bg-orange-50 dark:bg-orange-500/10 border border-orange-500 text-orange-600 dark:text-orange-400' : 'bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 text-gray-700 dark:text-zinc-300'}`}>
                  Data i godzina (np. 15.08.2026, 12:00)
                </button>
                <button onClick={() => updateSetting('deadlineFormat', 'countdown-h')} className={`w-full text-left px-4 py-3 rounded-lg text-sm font-medium transition-colors ${data.settings.deadlineFormat === 'countdown-h' ? 'bg-orange-50 dark:bg-orange-500/10 border border-orange-500 text-orange-600 dark:text-orange-400' : 'bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 text-gray-700 dark:text-zinc-300'}`}>
                  Odliczanie: Dni i Godziny (np. 2d 4h)
                </button>
                <button onClick={() => updateSetting('deadlineFormat', 'countdown-hm')} className={`w-full text-left px-4 py-3 rounded-lg text-sm font-medium transition-colors ${data.settings.deadlineFormat === 'countdown-hm' ? 'bg-orange-50 dark:bg-orange-500/10 border border-orange-500 text-orange-600 dark:text-orange-400' : 'bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 text-gray-700 dark:text-zinc-300'}`}>
                  Odliczanie: Dni, Godz., Minuty (np. 2d 4h 15m)
                </button>
              </div>
            </div>

            {/* SEKCJA SKRÓTÓW KLAWISZOWYCH */}
            <div className="border-t border-gray-200 dark:border-zinc-800 pt-6">
              <div className="flex justify-between items-center mb-4">
                <label className="block text-xs font-bold text-gray-500 dark:text-zinc-400 uppercase tracking-wider">Skróty klawiszowe</label>
                <button onClick={resetHotkeys} className="text-[10px] uppercase font-bold text-orange-500 hover:underline">Przywróć Domyślne</button>
              </div>

              <div className="space-y-2">
                {[
                  { key: 'newTask', label: 'Dodaj zadanie/tracker' },
                  { key: 'toggleTab', label: 'Przełącz Zadania / Trackery' },
                  { key: 'filterAll', label: 'Filtr: Wszystkie daty' },
                  { key: 'filterToday', label: 'Filtr: Dzisiaj' },
                  { key: 'filterWeek', label: 'Filtr: W tym tygodniu' },
                  { key: 'filterNone', label: 'Wyczyść filtry kategorii' },
                  { key: 'viewList', label: 'Widok Listy' },
                  { key: 'viewKanban', label: 'Tablica Kanban' },
                  { key: 'viewWeek', label: 'Harmonogram' },
                  { key: 'viewMonth', label: 'Kalendarz' }
                ].map(hotkey => (
                  <div key={hotkey.key} className="flex justify-between items-center bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 p-2.5 rounded-lg">
                    <span className="text-xs font-medium text-gray-700 dark:text-zinc-300">{hotkey.label}</span>
                    <button 
                      onClick={() => setListeningKeyFor(hotkey.key)}
                      className={`w-8 h-6 flex items-center justify-center rounded border font-bold uppercase transition-all text-[10px] ${listeningKeyFor === hotkey.key ? 'bg-orange-500 border-orange-500 text-white animate-pulse' : 'bg-white dark:bg-zinc-800 border-gray-300 dark:border-zinc-700 text-gray-900 dark:text-white hover:border-orange-500'}`}
                    >
                      {listeningKeyFor === hotkey.key ? '?' : (data.settings.hotkeys[hotkey.key] || '-')}
                    </button>
                  </div>
                ))}
                {listeningKeyFor && <p className="text-xs text-orange-500 font-bold mt-2 text-center animate-pulse">Wciśnij dowolny klawisz (lub ESC)...</p>}
              </div>
            </div>
            
            {/* SEKCJA JSON: BACKUPY */}
            <div className="border-t border-gray-200 dark:border-zinc-800 pt-6 mt-6">
              <label className="block text-xs font-bold text-gray-500 dark:text-zinc-400 mb-3 uppercase tracking-wider">Kopia Zapasowa (JSON)</label>
              <div className="flex gap-2">
                <button 
                  onClick={handleExportData}
                  className="flex-1 px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-gray-700 dark:text-zinc-300 text-sm font-bold rounded-lg transition-colors border border-gray-200 dark:border-zinc-700 shadow-sm"
                >
                  📥 Pobierz dane
                </button>
                <input 
                  type="file" 
                  accept=".json" 
                  ref={fileInputRef} 
                  style={{ display: 'none' }} 
                  onChange={handleImportData}
                />
                <button 
                  onClick={() => fileInputRef.current.click()}
                  className="flex-1 px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-gray-700 dark:text-zinc-300 text-sm font-bold rounded-lg transition-colors border border-gray-200 dark:border-zinc-700 shadow-sm"
                >
                  📤 Wgraj dane
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* MODAL: USTAWIENIA KATEGORII */}
      {isCategoryMenuOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 transition-opacity" onMouseDown={() => setIsCategoryMenuOpen(false)}>
          <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl relative modal-animate" onMouseDown={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Zarządzaj Kategoriami</h2>
              <button onClick={() => setIsCategoryMenuOpen(false)} className="text-gray-400 hover:text-gray-700 dark:hover:text-zinc-300">✕</button>
            </div>
            <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2 pb-32 hide-scroll">
              {data.categories.map((cat, idx) => (
                <div key={cat.id} className={`flex items-center gap-3 p-3 rounded-lg border relative ${cat.isVisible ? 'border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-950/50' : 'border-gray-100 dark:border-zinc-900/50 opacity-60'}`}>
                  <button onClick={() => toggleCatVisibility(cat.id)} className="text-gray-400 hover:text-orange-500 transition-colors" title="Ukryj/Pokaż w filtrach">{cat.isVisible ? '👁️' : '🔒'}</button>
                  <div className="relative">
                    <button onClick={(e) => { e.stopPropagation(); setColorPickerTarget(colorPickerTarget === cat.id ? null : cat.id); }} style={{ backgroundColor: getHexColor(cat.color) }} className="w-6 h-6 rounded-full shadow-inner border border-black/10 dark:border-white/10" />
                    {colorPickerTarget === cat.id && (
                      <div className="absolute top-8 left-0 bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 p-2 rounded-lg shadow-xl flex gap-1.5 z-50">
                        {COLOR_PRESETS.map(preset => ( <button key={preset} onClick={() => updateCategoryColor(cat.id, preset, true)} style={{ backgroundColor: preset }} className="w-5 h-5 rounded-full hover:scale-110 transition-transform" /> ))}
                        <label className="w-5 h-5 rounded-full bg-gradient-color cursor-pointer hover:scale-110 transition-transform relative overflow-hidden">
                          <input type="color" value={getHexColor(cat.color)} onChange={(e) => updateCategoryColor(cat.id, e.target.value, false)} className="absolute w-[200%] h-[200%] opacity-0 cursor-pointer" />
                        </label>
                      </div>
                    )}
                  </div>
                  <input type="text" value={cat.name} onChange={(e) => renameCat(cat.id, e.target.value)} className="flex-1 bg-transparent border-b border-transparent focus:border-orange-500 outline-none text-sm font-medium dark:text-white" />
                  <button onClick={() => deleteCat(cat.id)} disabled={idx === 0} className={`p-1.5 rounded ${idx === 0 ? 'text-gray-300 dark:text-zinc-700 cursor-not-allowed' : 'text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors'}`}>{idx === 0 ? "🔒" : "🗑️"}</button>
                </div>
              ))}
            </div>
            <button onClick={addNewCatFromSettings} className="mt-2 w-full py-2.5 border-2 border-dashed border-gray-300 dark:border-zinc-700 rounded-xl text-gray-500 dark:text-zinc-400 hover:text-orange-500 hover:border-orange-500 transition-colors text-sm font-bold uppercase tracking-wider">+ Dodaj Nową</button>
          </div>
        </div>
      )}
    </>
  );
}