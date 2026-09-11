'use client';
import { useEffect, useState } from 'react';
import { Loader, remainingFullLoaderTime, finishFullLoader } from './components/loader';
export default function Template({ children }: { children: React.ReactNode }) {
  const [revealing, setRevealing] = useState(true);
  useEffect(() => {
    const timer = setTimeout(() => { finishFullLoader(); setRevealing(false); }, remainingFullLoaderTime());
    return () => clearTimeout(timer);
  }, []);
  return (
    <>
      {revealing && <Loader size="full" />}
      {children}
    </>
  );
}
