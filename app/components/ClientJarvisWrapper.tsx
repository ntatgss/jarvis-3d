'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';

// Dynamically import the JarvisInterface component with no SSR
// This is necessary because it uses browser APIs that aren't available during server-side rendering
const JarvisInterface = dynamic(
  () => import('./JarvisInterface'),
  { 
    ssr: false,
    loading: () => (
      <div className="h-screen w-full flex items-center justify-center">
        <div className="text-center text-white">
          <div className="text-2xl mb-2">Loading Jarvis...</div>
          <div className="text-sm opacity-70">Initializing 3D environment</div>
        </div>
      </div>
    )
  }
);

export default function ClientJarvisWrapper() {
  // Use state to track if component is mounted
  const [isMounted, setIsMounted] = useState(false);
  
  // Only render on client side
  useEffect(() => {
    setIsMounted(true);
    
    // Add support for WebGL context loss recovery
    const handleContextLost = () => {
      console.log("WebGL context lost - reloading page");
      window.location.reload();
    };
    
    window.addEventListener('webglcontextlost', handleContextLost, false);
    
    return () => {
      window.removeEventListener('webglcontextlost', handleContextLost);
    };
  }, []);
  
  if (!isMounted) {
    return (
      <div className="h-screen w-full flex items-center justify-center">
        <div className="text-white">Loading Jarvis...</div>
      </div>
    );
  }
  
  return <JarvisInterface />;
}