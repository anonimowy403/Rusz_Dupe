import React, { useState, useEffect, useRef } from 'react';
import { safeSubstring, getHexColor, getDayName, generateScheduleDays, getMonthGrid, isTaskOverdueCheck, calculateNextDeadline, getTodayDate, getEndOfWeekDate } from '../utils/helpers';
import { DeadlineBadge } from './DeadlineBadge';

// Generowanie przedziałów czasowych co 15 minut
const timeOptions = [''];
for (let i = 0; i < 24; i++) {
  for (let j = 0; j < 60; j += 15) {
    timeOptions.push(`${i.toString().padStart(2, '0')}:${j.toString().padStart(2, '0')}`);
  }
}

// Odchaczenie taska dźwięk

// Załadowanie dźwięków do pamięci od razu przy starcie (brak opóźnień)
const taskSound = new Audio('/task-done.mp3');
const nukeSound = new Audio('/nuke-done.mp3');

const playTaskSound = () => {
  try { 
    taskSound.currentTime = 0; // Cofnięcie do początku, na wypadek szybkiego "przeklikiwania"
    taskSound.play(); 
  } catch (e) {}
};

const playNukeSound = () => {
  try { 
    nukeSound.currentTime = 0; 
    nukeSound.play(); 
  } catch (e) {}
};

export default function Tasks({
  data, setData, isMobile, todayStr, eowStr, openCategorySettings,
  isAppMenuOpen, isCategoryMenuOpen, DEFAULT_HOTKEYS 
}) {
  const [taskView, setTaskView] = useState(() => {
    // Odczytujemy ustawienie domyślne. Jeśli to kanban, gantt lub kalendarz - ustawiamy je. W przeciwnym razie lista.
    const view = data.settings.defaultStartupView;
    if (view === 'kanban') return 'kanban';
    if (view === 'gantt') return 'week';
    if (view === 'month') return 'month';
    return 'list';
  });
  const [activeDateFilter, setActiveDateFilter] = useState(() => data.settings.defaultStartupView === 'list-all' ? 'all' : (data.settings.defaultStartupView === 'list-week' ? 'week' : 'today')); 
  const [activeCategoryFilter, setActiveCategoryFilter] = useState(null); 
  const [expandedTaskId, setExpandedTaskId] = useState(null);
  const [focusedTaskId, setFocusedTaskId] = useState(null); 
  const [weekOffset, setWeekOffset] = useState(0); 
  const [calendarMonthOffset, setCalendarMonthOffset] = useState(0); 

  // Add Task State
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [newTask, setNewTask] = useState('');
  const [deadlineDate, setDeadlineDate] = useState(getTodayDate());
  const [deadlineTime, setDeadlineTime] = useState('');
  
  // Pamięć ostatniej kategorii
  const [lastUsedCategory, setLastUsedCategory] = useState(localStorage.getItem('rusz_dupe_last_category') || '');
  const [selectedCategory, setSelectedCategory] = useState('');
  
  const [isNewTaskPriority, setIsNewTaskPriority] = useState(false);
  const [repeatType, setRepeatType] = useState('none');
  const [repeatEndType, setRepeatEndType] = useState('never'); 
  const [repeatEndDate, setRepeatEndDate] = useState('');
  const [repeatCount, setRepeatCount] = useState(1);

  // UI Toggles
  const [isCalendarOpen, setIsCalendarOpen] = useState(false); // Dla AddTask
  const [expandedCalendarTaskId, setExpandedCalendarTaskId] = useState(null); // Dla EditTask
  const [inlineExpandedSubtasks, setInlineExpandedSubtasks] = useState([]); // Array ID tasków z rozwiniętym mini-podglądem
  
  const [editingDescId, setEditingDescId] = useState(null);
  const [addingSubtaskId, setAddingSubtaskId] = useState(null);
  const [subtaskInput, setSubtaskInput] = useState({ title: '', deadlineDate: '', deadlineTime: '' });
  const [draggedTaskId, setDraggedTaskId] = useState(null);
  const [explodingTasks, setExplodingTasks] = useState({});

  const scrollRef = useRef(null);
  const scheduleScrollRef = useRef(null);
  const dragState = useRef({ isDragging: false, startX: 0, scrollLeft: 0 });

  useEffect(() => {
    const handleKeyDown = (e) => {
      // ESCAPE priorytetem numer jeden, musi działać nawet jak jesteśmy wewnątrz inputu
      if (e.key === 'Escape') {
        document.activeElement?.blur(); // Zrzucenie focusu z pól tekstowych
        if (focusedTaskId) { setFocusedTaskId(null); setExpandedTaskId(null); return; }
        if (isAddingTask) { setIsAddingTask(false); return; }
        setEditingDescId(null); setAddingSubtaskId(null); setExpandedCalendarTaskId(null);
        return;
      }

      const tag = e.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (isAppMenuOpen || isCategoryMenuOpen || isAddingTask || focusedTaskId) return;

      if (taskView === 'week') {
          if (e.key === 'ArrowLeft') { e.preventDefault(); setWeekOffset(p => p - 1); return; }
          if (e.key === 'ArrowRight') { e.preventDefault(); setWeekOffset(p => p + 1); return; }
       }
       if (taskView === 'month') {
          if (e.key === 'ArrowLeft') { e.preventDefault(); setCalendarMonthOffset(p => p - 1); return; }
          if (e.key === 'ArrowRight') { e.preventDefault(); setCalendarMonthOffset(p => p + 1); return; }
      }

      const hk = data.settings.hotkeys || DEFAULT_HOTKEYS;
      const key = e.key.toLowerCase();

      if (key === hk.newTask) { e.preventDefault(); openAddTask(); }
      if (key === hk.viewList) { e.preventDefault(); setTaskView('list'); }
      if (key === hk.viewKanban) { e.preventDefault(); setTaskView('kanban'); }
      if (key === hk.viewWeek) { e.preventDefault(); setTaskView('week'); }
      if (key === hk.viewMonth) { e.preventDefault(); setTaskView('month'); }
      
      if (taskView === 'list') {
        if (key === hk.filterAll) { e.preventDefault(); setActiveDateFilter('all'); }
        if (key === hk.filterToday) { e.preventDefault(); setActiveDateFilter('today'); }
        if (key === hk.filterWeek) { e.preventDefault(); setActiveDateFilter('week'); }
      }
      
      if (key === hk.filterNone) { e.preventDefault(); setActiveCategoryFilter(null); }
      if (key >= '1' && key <= '9') {
        const idx = parseInt(key, 10) - 1;
        const visibleCats = data.categories.filter(c => c.isVisible !== false);
        if (visibleCats[idx]) setActiveCategoryFilter(prev => prev === visibleCats[idx].id ? null : visibleCats[idx].id);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isAddingTask, isAppMenuOpen, isCategoryMenuOpen, focusedTaskId, taskView, data.categories, isMobile, data.settings.hotkeys, DEFAULT_HOTKEYS]);

  useEffect(() => {
    if (activeCategoryFilter && scrollRef.current && !isMobile) {
      const el = document.getElementById(`cat-${activeCategoryFilter}`);
      if (el) {
        const container = scrollRef.current;
        const scrollPos = el.offsetLeft - container.offsetLeft - (container.clientWidth / 2) + (el.clientWidth / 2);
        container.scrollTo({ left: scrollPos, behavior: 'smooth' });
      }
    }
  }, [activeCategoryFilter, isMobile]);

  useEffect(() => {
    if (isAddingTask) {
        // Domyślna kategoria: Ostatnio używana -> Jeśli nie istnieje, bierzemy z filtra -> Jeśli brak, bierzemy pierwszą
        let defaultCat = lastUsedCategory;
        if (!data.categories.find(c => c.id === defaultCat)) defaultCat = activeCategoryFilter;
        if (!data.categories.find(c => c.id === defaultCat)) defaultCat = data.categories.find(c => c.isVisible !== false)?.id || '';
        
        setSelectedCategory(defaultCat);
        setDeadlineDate(getTodayDate()); 
        setDeadlineTime(''); setIsNewTaskPriority(false); 
        setRepeatType('none'); setRepeatEndType('never'); setRepeatCount(1);
        setIsCalendarOpen(false); // Reset widoku
    }
  }, [isAddingTask, activeCategoryFilter, data.categories, lastUsedCategory]);

  const handleCatMouseDown = (e) => { dragState.current.isDragging = true; dragState.current.startX = e.pageX - scrollRef.current.offsetLeft; dragState.current.scrollLeft = scrollRef.current.scrollLeft; };
  const handleCatMouseLeave = () => { dragState.current.isDragging = false; };
  const handleCatMouseUp = () => { dragState.current.isDragging = false; };
  const handleCatMouseMove = (e) => { if (!dragState.current.isDragging) return; e.preventDefault(); const x = e.pageX - scrollRef.current.offsetLeft; const walk = (x - dragState.current.startX) * 1.5; scrollRef.current.scrollLeft = dragState.current.scrollLeft - walk; };

  const getTaskCount = (dateFilt, catFilt) => data.tasks.filter(t => { 
    if (t.isDone) return false; 
    if (catFilt !== null && t.categoryId !== catFilt) return false;
    if (dateFilt === 'today') return t.deadline && t.deadline.startsWith(todayStr); 
    if (dateFilt === 'week') return t.deadline && t.deadline.split('T')[0] >= todayStr && t.deadline.split('T')[0] <= eowStr; 
    return true; 
  }).length;
  
  const openAddTask = (prefillDate = null) => {
    setDeadlineDate(prefillDate || getTodayDate()); 
    setIsAddingTask(true);
  };

  const addTask = (e) => {
    e.preventDefault();
    if (!newTask.trim() || !selectedCategory) return;
    
    // Zapisywanie do localStorage pamięci kategorii
    localStorage.setItem('rusz_dupe_last_category', selectedCategory);
    setLastUsedCategory(selectedCategory);

    let finalDeadline = null;
    if (deadlineDate) {
       const timeToUse = deadlineTime || '23:59';
       finalDeadline = new Date(`${deadlineDate}T${timeToUse}:00`).toISOString();
    }
    
    const newTaskObj = { 
      id: crypto.randomUUID(), title: newTask, description: '', categoryId: selectedCategory, 
      deadline: finalDeadline, createdAt: new Date().toISOString(), isDone: false, isPriority: isNewTaskPriority, 
      subtasks: [], repeat: repeatType, repeatEndDate: repeatEndType === 'date' ? repeatEndDate : null, 
      repeatCount: repeatEndType === 'count' ? parseInt(repeatCount) : null 
    };

    setData(prev => ({ ...prev, tasks: [...prev.tasks, newTaskObj] }));
    setNewTask(''); setIsNewTaskPriority(false); setIsAddingTask(false);
  };
  
  const toggleTask = (e, id) => { 
    e.stopPropagation(); 
    setData(prev => {
      const newTasks = [...prev.tasks];
      const idx = newTasks.findIndex(t => t.id === id);
      if (idx === -1) return prev;

  const task = { ...newTasks[idx] };
      const willBeDone = !task.isDone;
      
      if (willBeDone) {
         const type = task.isPriority ? 'nuke' : 'normal';
         setExplodingTasks(prev => ({ ...prev, [task.id]: type }));
         
         if (type === 'nuke') playNukeSound();
         else playTaskSound();
         
         // Zwiększyliśmy czas dla atomówki do 3 sekund, aby film miał czas wybrzmieć. 
         // Zmień tę wartość (3000), jeśli Twój filmik jest dłuższy/krótszy.
         setTimeout(() => {
           setExplodingTasks(prev => {
             const newObj = { ...prev };
             delete newObj[task.id];
             return newObj;
           });
         }, type === 'nuke' ? 3000 : 600);
      }

      if (willBeDone && task.repeat && task.repeat !== 'none') {
        let shouldRepeat = true;
        if (task.repeatCount !== null && task.repeatCount !== undefined) {
           if (task.repeatCount <= 1) shouldRepeat = false;
        }
        if (task.repeatEndDate) {
           if (new Date() > new Date(task.repeatEndDate)) shouldRepeat = false;
        }

        if (shouldRepeat) {
          const nextDeadline = calculateNextDeadline(task.deadline, task.repeat);
          const duplicatedTask = {
            ...task,
            id: crypto.randomUUID(),
            isDone: false,
            deadline: nextDeadline,
            repeatCount: task.repeatCount ? task.repeatCount - 1 : null,
            createdAt: new Date().toISOString(),
            subtasks: task.subtasks?.map(st => ({ ...st, id: crypto.randomUUID(), isDone: false })) || []
          };
          newTasks.push(duplicatedTask);
        }
        task.repeat = 'none'; 
      }

      task.isDone = willBeDone;
      newTasks[idx] = task;
      return { ...prev, tasks: newTasks };
    });
  };

  const deleteTask = (e, id) => { 
    e.stopPropagation(); 
    if(window.confirm("Na pewno usunąć to zadanie?")) {
      setData(prev => ({ ...prev, tasks: prev.tasks.filter(t => t.id !== id) })); 
      if (focusedTaskId === id) { setFocusedTaskId(null); setExpandedTaskId(null); } 
    }
  };

  const updateTaskField = (id, field, value) => { setData(prev => ({ ...prev, tasks: prev.tasks.map(t => t.id === id ? { ...t, [field]: value } : t) })); };
  
  // Pomocnicza funkcja do edytowania tylko wybranego fragmentu deadline'u na żywo
  const updateTaskDeadlineParts = (taskId, taskObj, newDateStr, newTimeStr) => {
     let finalVal = null;
     if (newDateStr) {
       const t = newTimeStr || '23:59';
       finalVal = new Date(`${newDateStr}T${t}:00`).toISOString();
     }
     updateTaskField(taskId, 'deadline', finalVal);
  };

  const toggleTaskPriority = (id) => { setData(prev => ({ ...prev, tasks: prev.tasks.map(t => t.id === id ? { ...t, isPriority: !t.isPriority } : t) })); };
  
  const handleAddSubtask = (taskId) => {
    if (!subtaskInput.title.trim()) return;
    let finalDeadline = null;
    if (subtaskInput.deadlineDate) finalDeadline = new Date(`${subtaskInput.deadlineDate}T${subtaskInput.deadlineTime || '23:59'}:00`).toISOString();
    setData(prev => ({ ...prev, tasks: prev.tasks.map(t => t.id === taskId ? { ...t, subtasks: [...(t.subtasks || []), { id: crypto.randomUUID(), title: subtaskInput.title, isDone: false, deadline: finalDeadline }] } : t) }));
    setSubtaskInput({ title: '', deadlineDate: '', deadlineTime: '' }); setAddingSubtaskId(null);
  };
  const toggleSubtask = (taskId, subtaskId) => {
    setData(prev => {
      const task = prev.tasks.find(t => t.id === taskId);
      const subtask = task?.subtasks?.find(st => st.id === subtaskId);
      
      if (subtask && !subtask.isDone) {
         setExplodingTasks(prevExp => ({ ...prevExp, [subtaskId]: 'normal' }));
         playTaskSound();
         setTimeout(() => {
           setExplodingTasks(prevExp => {
             const newObj = { ...prevExp };
             delete newObj[subtaskId];
             return newObj;
           });
         }, 600);
      }

      return {
        ...prev,
        tasks: prev.tasks.map(t => t.id === taskId ? {
          ...t,
          subtasks: (t.subtasks || []).map(st => st.id === subtaskId ? { ...st, isDone: !st.isDone } : st)
        } : t)
      };
    });
  };
  const deleteSubtask = (taskId, subtaskId) => setData(prev => ({ ...prev, tasks: prev.tasks.map(t => t.id === taskId ? { ...t, subtasks: (t.subtasks || []).filter(st => st.id !== subtaskId) } : t) }));
  const updateSubtaskField = (taskId, subtaskId, field, value) => {
    setData(prev => ({
      ...prev,
      tasks: prev.tasks.map(t => t.id === taskId ? { ...t, subtasks: (t.subtasks || []).map(st => st.id === subtaskId ? { ...st, [field]: value } : st) } : t)
    }));
  };

  const handleDragEnd = () => setDraggedTaskId(null);
  const handleDrop = (e, targetId) => {
    e.preventDefault();
    if (!draggedTaskId || draggedTaskId === targetId) { setDraggedTaskId(null); return; }
    setData(prev => {
      const draggedTask = prev.tasks.find(t => t.id === draggedTaskId);
      const targetTask = prev.tasks.find(t => t.id === targetId);
      if (!draggedTask || !targetTask || draggedTask.isPriority !== targetTask.isPriority) return prev;
      const newTasks = [...prev.tasks];
      const draggedIndex = newTasks.findIndex(t => t.id === draggedTaskId);
      const targetIndex = newTasks.findIndex(t => t.id === targetId);
      if (draggedIndex === -1 || targetIndex === -1) return prev;
      const [removedTask] = newTasks.splice(draggedIndex, 1);
      newTasks.splice(targetIndex, 0, removedTask);
      return { ...prev, tasks: newTasks };
    });
    setDraggedTaskId(null);
  };

  // Funkcja obsługująca upuszczenie zadania na konkretną kolumnę w widoku Kanban
  const handleKanbanColumnDrop = (e, targetCategoryId) => {
    e.preventDefault(); // Przeglądarka musi wiedzieć, że pozwalamy tu upuścić element
    if (!draggedTaskId) return; // Jeśli nic nie przeciągamy, anuluj
    
    // Używamy gotowej funkcji updateTaskField aby nadpisać categoryId
    // na ID kategorii reprezentowanej przez kolumnę.
    updateTaskField(draggedTaskId, 'categoryId', targetCategoryId);
    setDraggedTaskId(null); // Resetujemy stan przeciągania
  };

  const visibleCategories = data.categories.filter(c => c.isVisible !== false);
  let baseFilteredTasks = data.tasks.filter(t => {
    if (activeCategoryFilter !== null && t.categoryId !== activeCategoryFilter) return false;
    if (taskView === 'list') {
      if (activeDateFilter === 'today') return t.deadline && t.deadline.startsWith(todayStr);
      if (activeDateFilter === 'week') return t.deadline && (t.deadline.split('T')[0] >= todayStr && t.deadline.split('T')[0] <= eowStr);
    }
    return true;
  });

  baseFilteredTasks.sort((a, b) => {
    if (a.isPriority && !b.isPriority) return -1;
    if (!a.isPriority && b.isPriority) return 1;
    return 0;
  });

  // --- KARTA ZADANIA WIDOK ---
  const renderTaskCard = (task, isModalView = false) => {
    if (!task) return null;
    const category = data.categories.find(c => c.id === task.categoryId);
    const isExpanded = isModalView ? true : expandedTaskId === task.id;
    const isDragged = draggedTaskId === task.id;
    const isOverdue = isTaskOverdueCheck(task.deadline);
    const categoryColor = getHexColor(category?.color);
    
    let cardBgClass = 'bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-800';
    if (task.isDone) cardBgClass = 'bg-gray-50 dark:bg-zinc-950/50 border-gray-200 dark:border-zinc-900';
    else if (task.isPriority && isOverdue) cardBgClass = 'bg-red-50 dark:bg-red-950/30 border-[2px] border-red-500';
    else if (isOverdue) cardBgClass = 'bg-gray-100 dark:bg-zinc-800/60 border-gray-200 dark:border-zinc-700/50';
    else if (task.isPriority) cardBgClass = 'bg-white dark:bg-zinc-900 border-[2px] border-orange-500';

    // Extrakcja Daty i Czasu dla okna edycji
    const tDateObj = task.deadline ? new Date(task.deadline) : null;
    const dStrLocal = tDateObj ? `${tDateObj.getFullYear()}-${String(tDateObj.getMonth()+1).padStart(2,'0')}-${String(tDateObj.getDate()).padStart(2,'0')}` : '';
    const tStrLocal = tDateObj ? `${String(tDateObj.getHours()).padStart(2,'0')}:${String(tDateObj.getMinutes()).padStart(2,'0')}` : '';

    return (
      <div key={task.id} 
              // 1. ZEZWOLENIE NA DRAG & DROP W KANBANIE:
              // Dodaliśmy taskView === 'kanban' do warunków draggable i onDragStart.
              draggable={(taskView === 'list' || taskView === 'kanban') && !isModalView && !task.isPriority} 
              onDragStart={(e) => { 
                if((taskView === 'list' || taskView === 'kanban') && !isModalView && !task.isPriority){ 
                  setDraggedTaskId(task.id); 
                  e.dataTransfer.effectAllowed = "move";
                } 
              }} 
              onDragEnd={handleDragEnd} 
              onDragOver={(e) => e.preventDefault()} 
              onDrop={(e) => handleDrop(e, task.id)}
              onClick={(e) => {
                e.stopPropagation();
                if (!isModalView) {
                 // 2. WYMUSZENIE WIDOKU MODAL (KARTY) DLA KANBANA:
                 // Jeśli jesteśmy w widoku Kanban, zawszę otwieramy pełną kartę (setFocusedTaskId).
                 // Zapobiega to psuciu układu kolumn przez rozwijające się w pionie zadania.
                 if (taskView === 'kanban' || (data.settings.taskClickBehavior === 'modal' && taskView === 'list')) {
                   setFocusedTaskId(task.id);
                  } else {
                   setExpandedTaskId(isExpanded ? null : task.id);
                    if (!isExpanded) setExpandedCalendarTaskId(null);
                 }
               }
             }}
              className={`relative overflow-hidden rounded-xl border transition-all ${((taskView === 'list' || taskView === 'kanban') && !isModalView && !task.isPriority) ? 'cursor-grab active:cursor-grabbing' : ''} ${isDragged ? 'opacity-40 scale-[0.99]' : 'opacity-100'} ${cardBgClass} shadow-sm hover:shadow h-max`}>
                  
                  {/* Efekt Hitmarkera dla głównego zadania */}
                  {explodingTasks[task.id] === 'normal' && (
                     <div className="absolute inset-0 m-auto pointer-events-none z-50 w-16 h-16 flex items-center justify-center">
                        <video src="/hitmarker.webm" autoPlay muted playsInline className="w-full h-full object-contain mix-blend-screen" />
                     </div>
                  )}

                  {!task.isDone && task.isPriority && ( <div className="absolute inset-0 pointer-events-none z-0" style={{ background: `linear-gradient(to top, ${categoryColor}15, transparent)` }} /> )}

        <div className="p-3 pl-4 relative z-10 flex flex-col gap-1.5">
          <div className="flex justify-between items-start gap-2">
            <div className="flex items-center gap-2.5 flex-1 min-w-0">
              <input type="checkbox" checked={task.isDone} onClick={e => e.stopPropagation()} onChange={(e) => toggleTask(e, task.id)} className="w-5 h-5 accent-orange-500 rounded border-gray-300 dark:border-zinc-700 cursor-pointer shrink-0"/>
              {isExpanded && !task.isDone ? (
                <input
                    type="text" value={task.title}
                    onClick={e => e.stopPropagation()}
                    onChange={(e) => updateTaskField(task.id, 'title', e.target.value)}
                    className={`bg-transparent outline-none border-b border-transparent focus:border-orange-500 flex-1 min-w-0 truncate ${task.isPriority ? 'font-black' : 'font-medium'} ${task.isDone ? 'line-through text-gray-400' : 'text-gray-900 dark:text-zinc-200'}`}
                    style={{ color: (!task.isDone && task.isPriority) ? categoryColor : undefined }}
                  />
              ) : (
                <p className={`text-base truncate ${task.isPriority ? 'font-black' : 'font-medium'} ${task.isDone ? 'line-through text-gray-400 dark:text-zinc-600' : 'text-gray-900 dark:text-zinc-200'}`} style={{ color: (!task.isDone && task.isPriority) ? categoryColor : undefined }}>
                  {task.title}
                </p>
              )}
            </div>
            
            {/* Edycja lub Podgląd Daty */}
            {!task.isDone && isExpanded ? ( 
                <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                  <div className="flex bg-white dark:bg-zinc-950 border border-gray-200 dark:border-zinc-700 rounded overflow-hidden">
                    <input type="date" value={dStrLocal} onChange={(e) => updateTaskDeadlineParts(task.id, task, e.target.value, tStrLocal)} className="bg-transparent px-2 py-1 text-xs text-gray-700 dark:text-zinc-300 focus:outline-none focus:border-orange-500 cursor-pointer" />
                    <div className="w-px bg-gray-200 dark:bg-zinc-800"></div>
                    <select value={tStrLocal} onChange={(e) => updateTaskDeadlineParts(task.id, task, dStrLocal, e.target.value)} className="bg-transparent px-2 py-1 text-xs text-gray-700 dark:text-zinc-300 focus:outline-none focus:border-orange-500 cursor-pointer w-20 appearance-none text-center">
                       <option value="" disabled>--:--</option>
                       {!timeOptions.includes(tStrLocal) && tStrLocal !== '' && <option value={tStrLocal}>{tStrLocal}</option>}
                       {timeOptions.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <button onClick={() => setExpandedCalendarTaskId(p => p === task.id ? null : task.id)} className={`p-1.5 rounded transition-colors text-sm ${expandedCalendarTaskId === task.id ? 'bg-orange-500 text-white' : 'bg-gray-100 hover:bg-gray-200 dark:bg-zinc-800 dark:hover:bg-zinc-700'}`}>📅</button>
                </div>
            ) : ( task.deadline && !task.isDone && <DeadlineBadge deadline={task.deadline} format={data.settings?.deadlineFormat} /> )}
          </div>
          
          {(!isExpanded && task.description) && <p className={`text-sm mt-0.5 line-clamp-1 ${task.isDone ? 'text-gray-400 dark:text-zinc-700' : 'text-gray-500 dark:text-zinc-500'}`}>{task.description}</p>}
          
          {/* Mini Podgląd Subtasków Inline (na zamkniętej karcie) */}
          {!isExpanded && task.subtasks?.length > 0 && (
            <div className="mt-1 flex flex-col gap-1 items-start">
               <button 
                 onClick={(e) => { e.stopPropagation(); setInlineExpandedSubtasks(p => p.includes(task.id) ? p.filter(id => id !== task.id) : [...p, task.id]); }}
                 className="text-[10px] font-bold text-gray-500 dark:text-zinc-400 bg-gray-100 dark:bg-zinc-800/80 px-2 py-1 rounded hover:text-orange-500 transition-colors"
               >
                 + {task.subtasks.filter(st => st.isDone).length}/{task.subtasks.length} subtaski
               </button>
               {inlineExpandedSubtasks.includes(task.id) && (
                 <div className="flex flex-col gap-1 mt-1 pl-2 border-l-2 border-gray-200 dark:border-zinc-700 w-full">
                    {task.subtasks.map(sub => (
                      <div key={sub.id} className="relative flex items-center gap-2 py-0.5" onClick={e => e.stopPropagation()}>
                         {/* Efekt Hitmarkera dla mini podglądu subtaska */}
                         {explodingTasks[sub.id] === 'normal' && (
                           <div className="absolute -left-2 top-1/2 -translate-y-1/2 pointer-events-none z-50 w-8 h-8 flex items-center justify-center">
                             <video src="/hitmarker.webm" autoPlay muted playsInline className="w-full h-full object-contain mix-blend-screen" />
                           </div>
                         )}
                         <input type="checkbox" checked={sub.isDone} onChange={() => toggleSubtask(task.id, sub.id)} className="w-3.5 h-3.5 accent-orange-500 cursor-pointer shrink-0 relative z-10"/>
                         <span className={`text-xs truncate ${sub.isDone ? 'line-through text-gray-400 dark:text-zinc-600' : 'text-gray-600 dark:text-zinc-300'}`}>{sub.title}</span>
                      </div>
                    ))}
                 </div>
               )}
            </div>
          )}

          {isExpanded && (
            <div className="mt-2 cursor-default relative z-20 flex flex-col gap-3" onClick={e => e.stopPropagation()}>
              <div>
                {editingDescId === task.id && !task.isDone ? ( 
                  <textarea autoFocus placeholder="Wpisz opis zadania..." value={task.description || ''} onChange={(e) => updateTaskField(task.id, 'description', e.target.value)} onBlur={() => setEditingDescId(null)} className="w-full bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 rounded-lg p-3 text-sm text-gray-700 dark:text-zinc-300 placeholder-gray-400 dark:placeholder-zinc-600 focus:outline-none focus:border-orange-500 resize-none h-20" /> 
                ) : (
                  <div onClick={(e) => { if (!task.isDone) { e.stopPropagation(); setEditingDescId(task.id); } }} className={`p-2 -mx-2 rounded transition-colors border border-transparent border-dashed ${!task.isDone ? 'cursor-text hover:bg-gray-50 dark:hover:bg-zinc-900/50 hover:border-gray-200 dark:hover:border-zinc-800' : ''}`}>
                    {task.description ? ( <p className={`text-sm whitespace-pre-wrap leading-relaxed ${task.isDone ? 'text-gray-400 dark:text-zinc-600' : 'text-gray-600 dark:text-zinc-300'}`}>{task.description}</p> ) : ( !task.isDone && <span className="text-sm font-medium text-gray-400 dark:text-zinc-600 hover:text-orange-500 transition-colors">+ Dodaj opis zadania</span> )}
                  </div>
                )}
              </div>

              {/* Ukryte Menu Kalendarza/Powtarzania w Edycji */}
              {!task.isDone && expandedCalendarTaskId === task.id && (
                <div className="p-3 bg-gray-50 dark:bg-zinc-950/80 rounded-lg border border-gray-200 dark:border-zinc-800/80 flex flex-col gap-3">
                  <div className="flex gap-2 overflow-x-auto hide-scroll">
                    <button type="button" onClick={() => updateTaskDeadlineParts(task.id, task, getTodayDate(), tStrLocal)} className="px-3 py-1 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 hover:border-orange-500 rounded text-xs font-medium text-gray-600 dark:text-zinc-400 transition-colors whitespace-nowrap">🔥 Dziś</button>
                    <button type="button" onClick={() => { const d = new Date(); d.setDate(d.getDate() + 1); const tz = d.getTimezoneOffset() * 60000; updateTaskDeadlineParts(task.id, task, (new Date(d - tz)).toISOString().split('T')[0], tStrLocal); }} className="px-3 py-1 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 hover:border-orange-500 rounded text-xs font-medium text-gray-600 dark:text-zinc-400 transition-colors whitespace-nowrap">☀️ Jutro</button>
                    <button type="button" onClick={() => updateTaskDeadlineParts(task.id, task, getEndOfWeekDate(), tStrLocal)} className="px-3 py-1 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 hover:border-orange-500 rounded text-xs font-medium text-gray-600 dark:text-zinc-400 transition-colors whitespace-nowrap">🍺 Koniec tyg.</button>
                    <button type="button" onClick={() => { const d = new Date(); d.setDate(d.getDate() + 7); const tz = d.getTimezoneOffset() * 60000; updateTaskDeadlineParts(task.id, task, (new Date(d - tz)).toISOString().split('T')[0], tStrLocal); }} className="px-3 py-1 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 hover:border-orange-500 rounded text-xs font-medium text-gray-600 dark:text-zinc-400 transition-colors whitespace-nowrap">📅 Za tydzień</button>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-gray-500 dark:text-zinc-400 uppercase tracking-wider shrink-0">Powtarzaj:</span>
                    <select value={task.repeat || 'none'} onChange={(e) => updateTaskField(task.id, 'repeat', e.target.value)} className="bg-white dark:bg-zinc-900 border border-gray-300 dark:border-zinc-700 rounded px-2 py-1 text-xs text-gray-700 dark:text-zinc-300 focus:outline-none focus:border-orange-500">
                      <option value="none">Brak (jednorazowe)</option>
                      <option value="daily">Codziennie</option>
                      <option value="weekly">Co tydzień</option>
                      <option value="monthly">Co miesiąc</option>
                    </select>
                    {task.repeat && task.repeat !== 'none' && (
                      <>
                        <select value={task.repeatEndDate ? 'date' : (task.repeatCount ? 'count' : 'never')} onChange={(e) => {
                          const val = e.target.value;
                          if(val === 'never') { updateTaskField(task.id, 'repeatEndDate', null); updateTaskField(task.id, 'repeatCount', null); }
                          if(val === 'date') { updateTaskField(task.id, 'repeatEndDate', getTodayDate()); updateTaskField(task.id, 'repeatCount', null); }
                          if(val === 'count') { updateTaskField(task.id, 'repeatEndDate', null); updateTaskField(task.id, 'repeatCount', 2); }
                        }} className="bg-white dark:bg-zinc-900 border border-gray-300 dark:border-zinc-700 rounded px-2 py-1 text-xs text-gray-700 dark:text-zinc-300 focus:outline-none focus:border-orange-500">
                          <option value="never">Zawsze</option>
                          <option value="date">Do daty...</option>
                          <option value="count">Ilość razy...</option>
                        </select>
                        {task.repeatEndDate && <input type="date" value={task.repeatEndDate} onChange={(e) => updateTaskField(task.id, 'repeatEndDate', e.target.value)} className="bg-white dark:bg-zinc-900 border border-gray-300 dark:border-zinc-700 rounded px-2 py-1 text-xs text-gray-700 dark:text-zinc-300 focus:outline-none focus:border-orange-500" />}
                        {task.repeatCount && <input type="number" min="1" value={task.repeatCount} onChange={(e) => updateTaskField(task.id, 'repeatCount', parseInt(e.target.value))} className="w-16 bg-white dark:bg-zinc-900 border border-gray-300 dark:border-zinc-700 rounded px-2 py-1 text-xs text-center text-gray-700 dark:text-zinc-300 focus:outline-none focus:border-orange-500" />}
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* Edytowalne Subtaski */}
              <div className="space-y-1 mb-2 border-l-2 border-gray-100 dark:border-zinc-800/80 pl-3">
                  {(task.subtasks || []).map(sub => (
                  <div key={sub.id} className="relative flex items-center flex-wrap gap-2 hover:bg-gray-50 dark:hover:bg-zinc-950/50 p-1.5 -ml-1.5 rounded">
                    {/* Efekt Hitmarkera dla rozwiniętego subtaska */}
                    {explodingTasks[sub.id] === 'normal' && (
                      <div className="absolute -left-1.5 top-1/2 -translate-y-1/2 pointer-events-none z-50 w-10 h-10 flex items-center justify-center">
                        <video src="/hitmarker.webm" autoPlay muted playsInline className="w-full h-full object-contain mix-blend-screen" />
                      </div>
                    )}
                    <input type="checkbox" checked={sub.isDone} onChange={() => toggleSubtask(task.id, sub.id)} className="w-4 h-4 accent-orange-500 rounded cursor-pointer shrink-0 relative z-10"/>
                    {!task.isDone ? (
                        <input type="text" value={sub.title} onChange={(e) => updateSubtaskField(task.id, sub.id, 'title', e.target.value)} className={`bg-transparent outline-none border-b border-transparent focus:border-orange-500 flex-1 text-sm ${sub.isDone ? 'line-through text-gray-400' : 'text-gray-700 dark:text-zinc-300'}`} />
                    ) : (
                        <span className={`text-sm flex-1 ${sub.isDone ? 'line-through text-gray-400 dark:text-zinc-600' : 'text-gray-700 dark:text-zinc-300'}`}>{sub.title}</span>
                    )}
                    <button onClick={() => deleteSubtask(task.id, sub.id)} className="text-gray-400 hover:text-red-500 ml-2">✕</button>
                  </div>
                ))}
              </div>
              
              {!task.isDone && addingSubtaskId === task.id && (
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input autoFocus type="text" placeholder="Nowy subtask (Enter aby dodać)" value={subtaskInput.title} onChange={(e) => setSubtaskInput(prev => ({ ...prev, title: e.target.value }))} onKeyDown={(e) => e.key === 'Enter' && handleAddSubtask(task.id)} className="flex-1 bg-transparent border-b border-gray-200 dark:border-zinc-800 py-1 text-sm text-gray-700 dark:text-zinc-300 focus:outline-none focus:border-orange-500" />
                    <button onClick={() => handleAddSubtask(task.id)} className="px-3 py-1 bg-gray-200 dark:bg-zinc-800 hover:bg-orange-500 hover:text-white dark:hover:text-black rounded text-xs font-bold transition-colors">Dodaj</button>
                  </div>
              )}

              <hr className="border-gray-200 dark:border-zinc-800/80 my-1" />
              <div className="flex justify-between items-center text-xs">
                {!task.isDone ? (
                   <button onClick={() => { setAddingSubtaskId(task.id); setSubtaskInput({ title: '', deadlineDate: '', deadlineTime: '' }); }} className="font-bold text-gray-500 dark:text-zinc-500 hover:text-orange-500 dark:hover:text-orange-500 transition-colors uppercase tracking-wider">
                     + Nowy subtask
                   </button>
                ) : <span/>}
                
                <div className="flex gap-4">
                  <label className="flex items-center gap-1.5 cursor-pointer text-gray-500 dark:text-zinc-500 hover:text-orange-500 dark:hover:text-orange-500 transition-colors font-bold uppercase tracking-wider">
                    <input type="checkbox" checked={task.isPriority || false} onChange={() => toggleTaskPriority(task.id)} className="w-3.5 h-3.5 accent-orange-500 cursor-pointer"/>
                    Priorytet
                  </label>
                  <button onClick={(e) => deleteTask(e, task.id)} className="text-red-400 hover:text-red-600 transition-colors font-bold uppercase tracking-wider">
                    🗑️ Usuń
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  const FilterBtn = ({ active, onClick, icon, label, hotkey }) => {
    const mode = data.settings.filterDisplayMode || 'full';
    const showLabel = mode === 'full' || (mode === 'compact' && active);
    return (
      <button onClick={onClick} title={`${label} (${hotkey?.toUpperCase() || '-'})`} className={`flex items-center px-3 md:px-4 py-1.5 rounded-full text-sm font-bold border transition-colors whitespace-nowrap shrink-0 select-none ${active ? 'bg-orange-500 text-white border-orange-500' : 'bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-800 hover:bg-gray-100 dark:hover:bg-zinc-800'}`}>
        <span className="text-base leading-none">{icon}</span>
        {showLabel && ( <span className="ml-1.5 flex items-center">{label}</span> )}
      </button>
    );
  };

  const CatFilterBtn = ({ active, onClick, color, label, count }) => {
    const mode = data.settings.categoryDisplayMode || 'full';
    const showLabel = mode === 'full' || (mode === 'compact' && active);
    return (
      <button id={`cat-${label}`} onClick={onClick} title={label} className={`flex items-center px-3 md:px-4 py-1.5 rounded-full text-sm font-medium border transition-colors whitespace-nowrap shrink-0 select-none ${active ? 'bg-gray-200 dark:bg-zinc-800 border-gray-400 dark:border-zinc-600' : 'bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-800 hover:border-gray-300 dark:hover:border-zinc-700'}`}>
        <span style={{ backgroundColor: color }} className="inline-block w-2.5 h-2.5 rounded-full shrink-0" />
        {showLabel && ( <span className="ml-2 flex items-center">{label} <span className="ml-1 opacity-50 font-normal">({count})</span></span> )}
      </button>
    );
  };

  const renderListTaskView = () => {
    const isFullWidth = data.settings.layoutWidth === 'full' && !isMobile;
    const gridClass = isFullWidth ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 content-start space-y-0" : "space-y-3";
return (
      <div className={`flex-1 overflow-y-auto py-2 pb-32 pr-2 hide-scroll ${gridClass}`}>
        {baseFilteredTasks.length === 0 && (
          <div className="text-center mt-20 col-span-full">
            <p className="text-gray-500 dark:text-zinc-500 text-lg font-medium">Brak zadań.</p>
            <p className="text-gray-400 dark:text-zinc-600 text-sm mt-1">Czas na odpoczynek lub nowe wyzwania.</p>
          </div>
        )}
        {baseFilteredTasks.map(t => renderTaskCard(t, false))}
      </div>
    );
  };

  // Nowy widok: Tablica Kanban (Kolumny to Kategorie)
  const renderKanbanTaskView = () => {
    // Dodajemy "kolumnę zastępczą" dla zadań bez przypisanej kategorii
    const kanbanColumns = [
      ...visibleCategories, 
      { id: null, name: 'Brak kategorii', color: '#9ca3af' }
    ];

    return (
      // Dodano w-full, aby kontener zajął pełną dostępną szerokość ekranu
      <div className="flex-1 w-full flex gap-4 overflow-x-auto hide-scroll py-2 pb-32 snap-x snap-mandatory">
        {kanbanColumns.map(col => {
          // Filtrujemy zadania pasujące do danej kategorii
          const tasksInColumn = baseFilteredTasks.filter(t => t.categoryId === col.id || (col.id === null && !t.categoryId));
          const color = getHexColor(col.color);

          return (
            <div 
              key={col.id || 'uncategorized'} 
              // 4. NAPRAWA SCROLLOWANIA KANBANA:
              // Dodano `shrink-0` (odpowiednik CSS: flex-shrink: 0). Bez tego flexbox zgniatał
              // kolumny aby zmieściły się na ekranie (więc nie pojawiał się pasek przewijania).
              // Z `shrink-0` kolumny twardo trzymają swoją szerokość min-w-[300px], wypychając kontener.
              className="snap-start shrink-0 min-w-[300px] max-w-[300px] flex flex-col h-full bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 rounded-2xl overflow-hidden"
              // API HTML5 Drag&Drop: onDragOver pozwala elementowi na przyjęcie upuszczonego zadania
              onDragOver={(e) => e.preventDefault()} 
              // onDrop przechwytuje moment puszczenia myszki i przypisuje ID kategorii tej kolumny do zadania
              onDrop={(e) => handleKanbanColumnDrop(e, col.id)}
            >
              {/* Nagłówek kolumny */}
              <div className="p-4 border-b border-gray-200 dark:border-zinc-800 flex justify-between items-center bg-white dark:bg-zinc-900 shrink-0">
                <div className="flex items-center gap-2">
                  <span style={{ backgroundColor: color }} className="w-3 h-3 rounded-full shadow-sm" />
                  <h3 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-wider">{col.name}</h3>
                </div>
                <span className="text-xs font-bold text-gray-400 bg-gray-100 dark:bg-zinc-800 px-2 py-1 rounded-md">{tasksInColumn.length}</span>
              </div>
              
              {/* Lista zadań w kolumnie */}
              <div className="flex-1 overflow-y-auto p-3 space-y-3 hide-scroll">
                {tasksInColumn.length === 0 ? (
                  <div className="h-full flex items-center justify-center">
                    <p className="text-xs text-gray-400 dark:text-zinc-600 font-medium text-center border-2 border-dashed border-gray-200 dark:border-zinc-800 rounded-xl p-4 w-full">Przeciągnij zadania tutaj</p>
                  </div>
                ) : (
                  tasksInColumn.map(t => renderTaskCard(t, false))
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderWeekTaskView = () => {
    const numDays = 14; 
    const days = generateScheduleDays(weekOffset, numDays); 
    return (
      <div className="flex-1 flex flex-col py-2 pb-24 overflow-hidden">
        <div className="flex justify-between items-center mb-4 px-2 shrink-0">
          <button onClick={() => setWeekOffset(p => p - 1)} className="px-4 py-2 hover:bg-gray-100 dark:bg-zinc-800 rounded-lg text-gray-600 dark:text-zinc-400 transition-colors font-bold">&lsaquo; Wstecz</button>
          <button onClick={() => { setWeekOffset(0); scheduleScrollRef.current?.scrollTo({ left: 0, behavior: 'smooth' }); }} className="text-[10px] text-orange-500 font-bold uppercase hover:underline">Wróć do dziś</button>
          <button onClick={() => setWeekOffset(p => p + 1)} className="px-4 py-2 hover:bg-gray-100 dark:bg-zinc-800 rounded-lg text-gray-600 dark:text-zinc-400 transition-colors font-bold">Dalej &rsaquo;</button>
        </div>
        <div ref={scheduleScrollRef} className="flex-1 flex gap-4 overflow-x-auto hide-scroll px-2 snap-x snap-mandatory scroll-smooth pb-4" style={{ overflowAnchor: 'none' }}>
          {days.map(dayStr => {
            const isToday = dayStr === todayStr;
            const tasksForDay = baseFilteredTasks.filter(t => t.deadline && t.deadline.startsWith(dayStr));
            return (
              <div key={dayStr} className={`snap-start min-w-[280px] md:min-w-[300px] flex flex-col h-full border border-gray-200 dark:border-zinc-800/50 rounded-2xl bg-white dark:bg-zinc-900/30 overflow-hidden`}>
                <div className={`p-4 border-b-2 ${isToday ? 'border-orange-500 bg-orange-50 dark:bg-orange-500/5' : 'border-gray-100 dark:border-zinc-800 bg-gray-50/50 dark:bg-zinc-900/50'} flex justify-between items-center shrink-0`}>
                  <h3 className={`text-lg font-black tracking-tighter ${isToday ? 'text-orange-500' : 'text-gray-500 dark:text-zinc-400'}`}>{getDayName(dayStr)}</h3>
                  <span className={`text-sm font-bold ${isToday ? 'text-orange-500' : 'text-gray-400 dark:text-zinc-600'}`}>{dayStr.slice(5).replace('-', '.')}</span>
                </div>
                <div className="flex-1 overflow-y-auto p-3 space-y-3 hide-scroll">
                  {tasksForDay.length === 0 ? ( <p className="text-xs text-gray-400 dark:text-zinc-600 font-medium text-center mt-6">Brak zadań na ten dzień</p> ) : (
                    tasksForDay.map(t => {
                      const catColor = getHexColor(data.categories.find(c => c.id === t.categoryId)?.color);
                      return (
                        <div key={t.id} onClick={() => { setFocusedTaskId(t.id); setExpandedTaskId(t.id); }} className={`p-3 rounded-xl border cursor-pointer hover:shadow-md transition-all ${t.isDone ? 'bg-gray-50 dark:bg-zinc-950/50 border-gray-200 dark:border-zinc-900 opacity-60' : 'bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-800'}`} style={{ borderLeftWidth: t.isPriority ? '1px' : '4px', borderLeftColor: t.isPriority ? undefined : catColor }}>
                          <p className={`text-sm ${t.isPriority ? 'font-black' : 'font-medium'} ${t.isDone ? 'line-through text-gray-400 dark:text-zinc-600' : 'text-gray-800 dark:text-zinc-200'}`} style={{ color: (!t.isDone && t.isPriority) ? catColor : undefined }}>
                            {t.title}
                          </p>
                        </div>
                      )
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderMonthTaskView = () => {
    const todayObj = new Date();
    const targetMonth = new Date(todayObj.getFullYear(), todayObj.getMonth() + calendarMonthOffset, 1);
    const gridDays = getMonthGrid(targetMonth.getFullYear(), targetMonth.getMonth());
    return (
      <div className="flex-1 flex flex-col py-2 pb-32 overflow-hidden">
        <div className="flex justify-between items-center mb-4 px-2 shrink-0">
          <button onClick={() => setCalendarMonthOffset(p => p - 1)} className="w-8 h-8 flex items-center justify-center bg-gray-200 dark:bg-zinc-800 rounded-lg font-bold hover:bg-orange-500 hover:text-white transition-colors">&lsaquo;</button>
          <div className="flex flex-col items-center">
            <h2 className="text-lg font-black uppercase tracking-widest">{targetMonth.toLocaleDateString('pl-PL', { month: 'long', year: 'numeric' })}</h2>
            {calendarMonthOffset !== 0 && <button onClick={() => setCalendarMonthOffset(0)} className="text-[10px] text-orange-500 font-bold uppercase hover:underline mt-0.5">Wróć do obecnego</button>}
          </div>
          <button onClick={() => setCalendarMonthOffset(p => p + 1)} className="w-8 h-8 flex items-center justify-center bg-gray-200 dark:bg-zinc-800 rounded-lg font-bold hover:bg-orange-500 hover:text-white transition-colors">&rsaquo;</button>
        </div>
        <div className="grid grid-cols-7 gap-1 md:gap-2 flex-1 overflow-y-auto hide-scroll p-1">
          {['PN', 'WT', 'ŚR', 'CZW', 'PT', 'SOB', 'ND'].map(d => <div key={d} className="text-center text-[10px] md:text-xs font-black text-gray-400 dark:text-zinc-500 mb-1">{d}</div> )}
          {gridDays.map((dayObj, idx) => {
             const isToday = dayObj.date === todayStr;
             const tasksForDay = baseFilteredTasks.filter(t => t.deadline && t.deadline.startsWith(dayObj.date));
             return (
               <div key={idx} onClick={() => { 
                 if(isMobile) {
                   const diffTime = Date.parse(dayObj.date) - Date.parse(todayStr);
                   const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
                   setTaskView('week');
                   setTimeout(() => {
                      if(scheduleScrollRef.current) scheduleScrollRef.current.scrollTo({ left: Math.max(0, diffDays * (isMobile ? 296 : 316)), behavior: 'smooth' });
                   }, 100);
                 } else {
                   if(dayObj.isCurrentMonth && tasksForDay.length === 0) openAddTask(dayObj.date); 
                 }
               }} className={`min-h-[70px] md:min-h-[90px] p-1 md:p-1.5 border rounded-lg flex flex-col gap-1 overflow-hidden transition-colors ${dayObj.isCurrentMonth ? 'bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-800 hover:border-orange-500/50 cursor-pointer' : 'bg-gray-50 dark:bg-zinc-950/30 border-gray-100 dark:border-zinc-900/50 opacity-40'} ${isToday ? 'ring-2 ring-orange-500 ring-inset' : ''}`}>
                 <span className={`text-[10px] md:text-xs font-bold self-end px-1.5 py-0.5 mb-1 ${isToday ? 'bg-orange-500 text-white rounded' : 'text-gray-500 dark:text-zinc-500'}`}>{dayObj.date.split('-')[2]}</span>
                 {isMobile ? (
                   <div className="flex flex-wrap gap-1 justify-end p-1">
                     {tasksForDay.map(t => <div key={t.id} className="w-2 h-2 rounded-full" style={{backgroundColor: getHexColor(data.categories.find(c=>c.id===t.categoryId)?.color)}} />)}
                   </div>
                 ) : (
                   <div className="flex flex-col gap-1 overflow-y-auto hide-scroll">
                     {tasksForDay.slice(0, 3).map(t => {
                       const catColor = getHexColor(data.categories.find(c => c.id === t.categoryId)?.color);
                       return (
                         <div key={t.id} onClick={(e) => { e.stopPropagation(); setFocusedTaskId(t.id); setExpandedTaskId(t.id); }} className={`text-[9px] md:text-[10px] font-medium truncate px-1.5 py-0.5 rounded-[4px] border-l-[3px] transition-opacity hover:opacity-75 ${t.isDone ? 'line-through text-gray-400 dark:text-zinc-600 bg-gray-100 dark:bg-zinc-800/50' : 'text-gray-800 dark:text-zinc-200 bg-gray-100 dark:bg-zinc-800'}`} style={{ borderLeftColor: catColor }}>
                           {t.isPriority && <span className="text-orange-500 mr-0.5 font-black">!</span>}{t.title}
                         </div>
                       );
                     })}
                     {tasksForDay.length > 3 && <span className="text-[9px] text-gray-400 font-bold text-center mt-0.5">+{tasksForDay.length - 3}</span>}
                   </div>
                 )}
               </div>
             )
          })}
        </div>
      </div>
    );
  };

  return (
    <>
      {Object.values(explodingTasks).includes('nuke') && (
         <div className="fixed inset-0 z-[200] pointer-events-none flex items-center justify-center">
           <video src="/nuke.webm" autoPlay muted playsInline className="w-full h-full object-cover" />
         </div>
      )}
      <div className="flex w-full items-center py-4 shrink-0 overflow-hidden relative">
        <div className="flex gap-2 items-center pr-4 border-r border-gray-200 dark:border-zinc-800 shrink-0 relative z-10 bg-gray-50 dark:bg-zinc-950">
          {taskView === 'list' && (
            <>
              <FilterBtn active={activeDateFilter === 'all'} onClick={() => setActiveDateFilter('all')} icon={<img src="/icon-all.svg" alt="Wszystko" className="w-5 h-5 object-contain" />} label="Wszystko" hotkey={data.settings.hotkeys?.filterAll} />
              <FilterBtn active={activeDateFilter === 'today'} onClick={() => setActiveDateFilter('today')} icon={<img src="/icon-today.svg" alt="Dziś" className="w-5 h-5 object-contain" />} label="Dziś" hotkey={data.settings.hotkeys?.filterToday} />
              <FilterBtn active={activeDateFilter === 'week'} onClick={() => setActiveDateFilter('week')} icon={<img src="/icon-week.svg" alt="Tydzień" className="w-5 h-5 object-contain" />} label="Tyg." hotkey={data.settings.hotkeys?.filterWeek} />
            </>
          )}
          {taskView !== 'list' && !isMobile && (
            <span className="text-xs font-bold text-gray-400 dark:text-zinc-600 uppercase tracking-wider px-2">Kategorie:</span>
          )}
        </div>

{/* 3. UKRYCIE FILTRÓW KATEGORII W WIDOKU KANBAN: 
            Kategorie w Kanbanie to kolumny, więc dodatkowy pasek filtrów był zbędny.
            Wyświetlamy go tylko, gdy widok jest INNY niż 'kanban'. */}
        {taskView !== 'kanban' && (
          isMobile ? (
            <div className="flex-1 px-4">
              <select 
                 value={activeCategoryFilter || 'null'} 
                 onChange={(e) => setActiveCategoryFilter(e.target.value === 'null' ? null : e.target.value)}
                className="w-full bg-white dark:bg-zinc-900 border border-gray-300 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm font-bold text-gray-700 dark:text-zinc-300 focus:outline-none focus:border-orange-500"
              >
                <option value="null">Wszystkie kategorie</option>
                {visibleCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          ) : (
            <div ref={scrollRef} onMouseDown={handleCatMouseDown} onMouseLeave={handleCatMouseLeave} onMouseUp={handleCatMouseUp} onMouseMove={handleCatMouseMove} className="flex-1 flex gap-2 overflow-x-auto hide-scroll cursor-grab active:cursor-grabbing px-4">
              {visibleCategories.map(cat => (
                <CatFilterBtn key={cat.id} active={activeCategoryFilter === cat.id} onClick={() => setActiveCategoryFilter(activeCategoryFilter === cat.id ? null : cat.id)} color={getHexColor(cat.color)} label={cat.name} count={getTaskCount(taskView === 'list' ? activeDateFilter : 'all', cat.id)} />
              ))}
            </div>
          )
        )}
        
        {/* Wypełniacz pustej przestrzeni. Gdy ukryjemy filtry, ta pusta ramka wypycha przycisk zębatek (ustawień) całkowicie na prawą krawędź ekranu, zachowując spójny layout */}
        {taskView === 'kanban' && <div className="flex-1"></div>}

        <div className="pl-4 border-l border-gray-200 dark:border-zinc-800 shrink-0 relative z-10 bg-gray-50 dark:bg-zinc-950 flex items-center gap-2">
          <button onClick={() => openCategorySettings()} className="p-2 rounded-full text-gray-500 hover:bg-gray-200 dark:hover:bg-zinc-800 transition-colors" title="Zarządzaj kategoriami">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path d="M5 4a1 1 0 00-2 0v7.268a2 2 0 000 3.464V16a1 1 0 102 0v-1.268a2 2 0 000-3.464V4zM11 4a1 1 0 10-2 0v1.268a2 2 0 000 3.464V16a1 1 0 102 0V8.732a2 2 0 000-3.464V4zM16 3a1 1 0 011 1v7.268a2 2 0 010 3.464V16a1 1 0 11-2 0v-1.268a2 2 0 010-3.464V4a1 1 0 011-1z" />
            </svg>
          </button>
        </div>
      </div>

      {taskView === 'list' && renderListTaskView()}
      {taskView === 'kanban' && renderKanbanTaskView()}
      {taskView === 'week' && renderWeekTaskView()}
      {taskView === 'month' && renderMonthTaskView()}

      {/* PŁYWAJĄCY PRZYCISK ZMIANY WIDOKU */}
      {!isAddingTask && !isAppMenuOpen && !isCategoryMenuOpen && !focusedTaskId && (
        <>
          <button 
            // Rozszerzony cykl: Lista -> Kanban -> Harmonogram -> Kalendarz -> Lista
            onClick={() => setTaskView(prev => prev === 'list' ? 'kanban' : prev === 'kanban' ? 'week' : prev === 'week' ? 'month' : 'list')}
            className="fixed bottom-[5.5rem] right-6 md:right-10 w-10 h-10 bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 text-gray-600 dark:text-zinc-300 rounded-full flex items-center justify-center text-lg shadow-lg hover:scale-105 transition-all z-[80]"
            title={`Zmień widok (${data.settings.hotkeys?.viewList}/${data.settings.hotkeys?.viewKanban}/${data.settings.hotkeys?.viewWeek}/${data.settings.hotkeys?.viewMonth})`}
          >
            👁️
          </button>

          <div className="fixed bottom-8 right-4 md:right-8 flex items-center gap-3 z-[80] pointer-events-none transition-all">
            <span className="hidden sm:inline-block pointer-events-auto text-xs font-medium bg-white/90 dark:bg-zinc-800/90 backdrop-blur px-3 py-1.5 rounded-lg text-gray-500 dark:text-zinc-400 shadow-sm border border-gray-200 dark:border-zinc-700">
              <strong>{(data.settings.hotkeys?.newTask || 'N').toUpperCase()}</strong>: Nowy | <strong>{(data.settings.hotkeys?.toggleTab || 'T').toUpperCase()}</strong>: Zmiana
            </span>
            <button 
              onClick={() => openAddTask()} 
              className="w-14 h-14 bg-orange-500 hover:bg-orange-600 text-black rounded-full flex items-center justify-center text-3xl font-light shadow-xl hover:scale-105 transition-all pointer-events-auto"
            >
              +
            </button>
          </div>
        </>
      )}

      {/* MODAL PODGLĄDU/EDYCJI KARTY */}
      {focusedTaskId && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 transition-opacity" onMouseDown={() => { setFocusedTaskId(null); setExpandedTaskId(null); setExpandedCalendarTaskId(null); }}>
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto hide-scroll rounded-xl" onMouseDown={e => e.stopPropagation()}>
              {renderTaskCard(data.tasks.find(t => t.id === focusedTaskId), true)}
          </div>
        </div>
      )}

      {/* ODCHUDZONY MODAL DODAWANIA ZADANIA */}
      {isAddingTask && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 transition-opacity" onMouseDown={() => setIsAddingTask(false)}>
          <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl w-full max-w-2xl p-6 shadow-2xl relative modal-animate" onMouseDown={(e) => e.stopPropagation()}>
            <form onSubmit={addTask} className="flex flex-col gap-4">
              <div className="flex justify-between items-center mb-1">
                <span className="text-sm font-bold text-gray-500 dark:text-zinc-400 uppercase tracking-wider">Nowe Zadanie (ESC aby wyjść)</span>
                <button type="button" onClick={() => setIsAddingTask(false)} className="text-gray-400 hover:text-gray-700 dark:hover:text-zinc-300" tabIndex={-1}>✕</button>
              </div>
              
              <input autoFocus tabIndex={1} type="text" placeholder="Co masz do zrobienia?" value={newTask} onChange={(e) => setNewTask(e.target.value)} className="w-full bg-transparent border-b border-gray-300 dark:border-zinc-700 py-2 text-xl font-medium text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-zinc-600 focus:outline-none focus:border-orange-500 transition-colors"/>
              
              <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between mt-2">
                <div className="flex gap-2 w-full md:w-auto items-center">
                  <div className="flex bg-gray-50 dark:bg-zinc-950 border border-gray-300 dark:border-zinc-700 rounded-lg overflow-hidden flex-1 md:flex-none">
                    <input tabIndex={2} type="date" value={deadlineDate} onChange={(e) => setDeadlineDate(e.target.value)} className="bg-transparent px-3 py-2 text-sm text-gray-700 dark:text-zinc-300 focus:outline-none focus:border-orange-500 cursor-pointer" title="Data"/>
                    <div className="w-px bg-gray-300 dark:bg-zinc-700"></div>
                    <select tabIndex={3} value={deadlineTime} onChange={(e) => setDeadlineTime(e.target.value)} className="bg-transparent px-3 py-2 text-sm text-gray-700 dark:text-zinc-300 focus:outline-none focus:border-orange-500 cursor-pointer w-24 appearance-none text-center">
                       <option value="" disabled>--:--</option>
                       {timeOptions.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  
                  <button type="button" onClick={() => setIsCalendarOpen(!isCalendarOpen)} className={`p-2 rounded-lg transition-colors ${isCalendarOpen ? 'bg-orange-500 text-white' : 'bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700'}`}>📅</button>

                  <button tabIndex={4} type="submit" className="bg-orange-500 hover:bg-orange-600 text-black font-bold px-6 py-2 rounded-lg transition-colors whitespace-nowrap shadow-md ml-2">Dodaj</button>
                  
                  <label className="flex items-center cursor-pointer select-none ml-2 gap-1.5" title="Wysoki priorytet">
                    <input type="checkbox" checked={isNewTaskPriority} onChange={(e) => setIsNewTaskPriority(e.target.checked)} className="w-4 h-4 accent-orange-500 cursor-pointer shrink-0" tabIndex={5}/>
                    <span className="text-xs font-bold uppercase tracking-wider text-orange-500 hidden sm:inline">Priorytet</span>
                  </label>
                </div>
              </div>

              {isCalendarOpen && (
                <div className="p-4 bg-gray-50 dark:bg-zinc-950/80 border border-gray-200 dark:border-zinc-800 rounded-lg flex flex-col gap-4 mt-2">
                  <div className="flex gap-2 overflow-x-auto w-full hide-scroll">
                    <button type="button" onClick={() => { setDeadlineDate(getTodayDate()); setDeadlineTime(''); }} className="px-3 py-1.5 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 hover:border-orange-500 hover:text-orange-500 rounded-lg text-xs font-medium text-gray-600 dark:text-zinc-400 whitespace-nowrap transition-colors">🔥 Dziś</button>
                    <button type="button" onClick={() => { const d = new Date(); d.setDate(d.getDate() + 1); const tz = d.getTimezoneOffset() * 60000; setDeadlineDate((new Date(d - tz)).toISOString().split('T')[0]); setDeadlineTime(''); }} className="px-3 py-1.5 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 hover:border-orange-500 hover:text-orange-500 rounded-lg text-xs font-medium text-gray-600 dark:text-zinc-400 whitespace-nowrap transition-colors">☀️ Jutro</button>
                    <button type="button" onClick={() => { setDeadlineDate(getEndOfWeekDate()); setDeadlineTime(''); }} className="px-3 py-1.5 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 hover:border-orange-500 hover:text-orange-500 rounded-lg text-xs font-medium text-gray-600 dark:text-zinc-400 whitespace-nowrap transition-colors">🍺 Koniec tyg.</button>
                    <button type="button" onClick={() => { const d = new Date(); d.setDate(d.getDate() + 7); const tz = d.getTimezoneOffset() * 60000; setDeadlineDate((new Date(d - tz)).toISOString().split('T')[0]); setDeadlineTime(''); }} className="px-3 py-1.5 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 hover:border-orange-500 hover:text-orange-500 rounded-lg text-xs font-medium text-gray-600 dark:text-zinc-400 whitespace-nowrap transition-colors">📅 Za tydzień</button>
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="block text-xs font-bold text-gray-500 dark:text-zinc-500 uppercase">Powtarzanie</label>
                    <div className="flex gap-2 items-center flex-wrap">
                      <select value={repeatType} onChange={(e) => setRepeatType(e.target.value)} className="bg-white dark:bg-zinc-900 border border-gray-300 dark:border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-gray-700 dark:text-zinc-300 focus:outline-none focus:border-orange-500 cursor-pointer">
                        <option value="none">Brak (jednorazowe)</option>
                        <option value="daily">Codziennie</option>
                        <option value="weekly">Co tydzień</option>
                        <option value="monthly">Co miesiąc</option>
                      </select>

                      {repeatType !== 'none' && (
                        <select value={repeatEndType} onChange={(e) => setRepeatEndType(e.target.value)} className="bg-white dark:bg-zinc-900 border border-gray-300 dark:border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-gray-700 dark:text-zinc-300 focus:outline-none focus:border-orange-500 cursor-pointer">
                          <option value="never">Zawsze (brak końca)</option>
                          <option value="date">Do konkretnej daty...</option>
                          <option value="count">Określona ilość razy...</option>
                        </select>
                      )}

                      {repeatType !== 'none' && repeatEndType === 'date' && (
                        <input type="date" value={repeatEndDate} onChange={(e) => setRepeatEndDate(e.target.value)} className="bg-white dark:bg-zinc-900 border border-gray-300 dark:border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-gray-700 dark:text-zinc-300 focus:outline-none focus:border-orange-500 cursor-pointer"/>
                      )}

                      {repeatType !== 'none' && repeatEndType === 'count' && (
                        <div className="flex items-center gap-2">
                          <input type="number" min="1" value={repeatCount} onChange={(e) => setRepeatCount(e.target.value)} className="w-16 bg-white dark:bg-zinc-900 border border-gray-300 dark:border-zinc-700 rounded-lg px-2 py-1.5 text-sm text-center text-gray-700 dark:text-zinc-300 focus:outline-none focus:border-orange-500"/>
                          <span className="text-sm font-medium text-gray-500">razy</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <div className="mt-2">
                <select required tabIndex={6} value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)} className="bg-gray-50 dark:bg-zinc-950 border border-gray-300 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm text-gray-700 dark:text-zinc-300 focus:outline-none focus:border-orange-500 cursor-pointer w-full md:w-64">
                  <option value="" disabled hidden>Wybierz kategorię...</option>
                  {data.categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                </select>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}