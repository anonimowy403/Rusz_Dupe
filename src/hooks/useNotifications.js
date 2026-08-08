import { useEffect, useRef } from 'react';
import { playBeep } from '../utils/helpers';

export function useNotifications(tasks, settings) {
  const notifiedRef = useRef(new Set());

  useEffect(() => {
    if (settings.notificationsEnabled !== true) return;

    const checkInterval = setInterval(() => {
      const now = new Date();
      
      tasks.forEach(task => {
        // Ignorujemy zrobione zadania, bez deadline'u lub bez przypomnienia
        if (task.isDone || !task.deadline || !task.reminder || task.reminder === 'none') return;
        
        const deadlineTime = new Date(task.deadline).getTime();
        const reminderOffset = parseInt(task.reminder, 10) * 60000; // w milisekundach
        const alarmTime = deadlineTime - reminderOffset;
        
        // Unikalny klucz alarmu, aby nie spamować powiadomieniami dla tego samego zadania
        const alarmKey = `${task.id}-${task.deadline}-${task.reminder}`;

        if (now.getTime() >= alarmTime && !notifiedRef.current.has(alarmKey)) {
          notifiedRef.current.add(alarmKey);
          
          // Odtwarzanie dźwięku
          try {
            if (settings.notificationSound && settings.notificationSound !== 'beep') {
              const audio = new Audio(`/sounds/${settings.notificationSound}.mp3`);
              audio.play().catch(() => playBeep()); // Fallback do standardowego Beepu jeśli brak pliku
            } else {
              playBeep();
            }
          } catch (e) {
            playBeep();
          }

          // Wyświetlanie powiadomienia systemowego
          if (Notification.permission === 'granted') {
            new Notification('Rusz Dupę - Przypomnienie!', {
              body: `Zadanie: ${task.title}\nCzas: ${new Date(task.deadline).toLocaleTimeString('pl-PL', {hour: '2-digit', minute:'2-digit'})}`,
              icon: '/favicon.svg'
            });
          }
        }
      });
    }, 30000); // Sprawdzamy co 30 sekund

    return () => clearInterval(checkInterval);
  }, [tasks, settings.notificationsEnabled, settings.notificationSound]);
}