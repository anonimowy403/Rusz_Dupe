// src/services/dataService.js
const STORAGE_KEY = 'rusz_dupe_data';

const defaultState = {
  categories: [
    { id: '1', name: 'Praca', color: 'bg-orange-500' },
    { id: '2', name: 'Personalne', color: 'bg-emerald-500' }
  ],
  tasks: []
};

export const dataService = {
  load: () => {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      return data ? JSON.parse(data) : defaultState;
    } catch (e) {
      console.error("Błąd ładowania danych", e);
      return defaultState;
    }
  },
  save: (data) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      console.error("Błąd zapisu danych", e);
    }
  }
};