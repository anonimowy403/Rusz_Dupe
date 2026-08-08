import { useState, useEffect } from 'react';

export function useCountdown(deadlineInfo) {
  const [timeLeft, setTimeLeft] = useState({ isOverdue: false, d: 0, h: 0, m: 0 });
  useEffect(() => {
    if (!deadlineInfo) return;
    const calcTimeLeft = () => {
      const diff = new Date(deadlineInfo) - new Date();
      const isOverdue = diff <= 0;
      const abs = Math.abs(diff);
      const d = Math.floor(abs / (1000 * 60 * 60 * 24));
      const h = Math.floor((abs / (1000 * 60 * 60)) % 24);
      const m = Math.floor((abs / 1000 / 60) % 60);
      return { isOverdue, d, h, m };
    };
    setTimeLeft(calcTimeLeft());
    const timer = setInterval(() => setTimeLeft(calcTimeLeft()), 60000);
    return () => clearInterval(timer);
  }, [deadlineInfo]);
  return timeLeft;
}