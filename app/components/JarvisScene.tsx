'use client';

import React, { useRef, useState, useEffect, Suspense } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Environment, PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';

// Fallback model if no custom model is available
function DefaultJarvisModel({ isListening, isSpeaking }: { isListening?: boolean; isSpeaking?: boolean }) {
  const [scale, setScale] = useState(1);
  const [color, setColor] = useState('#00a2ff');
  const groupRef = useRef<THREE.Group>(null);
  
  // Pulse effect when speaking
  useEffect(() => {
    if (isSpeaking) {
      const interval = setInterval(() => {
        setScale(prev => (prev === 1 ? 1.1 : 1));
      }, 300);
      
      return () => clearInterval(interval);
    } else {
      setScale(1);
    }
  }, [isSpeaking]);
  
  // Color effect when listening
  useEffect(() => {
    if (isListening) {
      setColor('#ff4040');
    } else {
      setColor('#00a2ff');
    }
  }, [isListening]);
  
  // Gentle floating animation
  useFrame(({ clock }) => {
    if (groupRef.current) {
      groupRef.current.position.y = Math.sin(clock.getElapsedTime() * 0.5) * 0.1;
      groupRef.current.rotation.y += 0.003;
    }
  });
  
  return (
    <group ref={groupRef}>
      {/* Core sphere */}
      <mesh scale={scale}>
        <sphereGeometry args={[1, 32, 32]} />
        <meshStandardMaterial 
          color={color} 
          emissive={isListening ? '#ff0000' : '#003a5c'} 
          emissiveIntensity={isSpeaking ? 2 : isListening ? 1.5 : 1}
          metalness={0.8}
          roughness={0.2}
        />
      </mesh>
      
      {/* Outer glow */}
      <mesh scale={1.2}>
        <sphereGeometry args={[1, 16, 16]} />
        <meshStandardMaterial 
          color={isListening ? '#ff8080' : '#4cc9ff'} 
          emissive={isListening ? '#ff8080' : '#4cc9ff'}
          emissiveIntensity={0.5}
          transparent={true}
          opacity={0.15}
        />
      </mesh>
      
      {/* Orbiting particles */}
      <group rotation={[0, Math.PI / 4, 0]}>
        <Particles 
          count={20} 
          radius={1.8} 
          isSpeaking={isSpeaking} 
          isListening={isListening} 
        />
      </group>
      
      {/* Sound waves when speaking */}
      {isSpeaking && <SoundWaves />}
      
      {/* Listening indicator */}
      {isListening && <ListeningIndicator />}
    </group>
  );
}

// Sound wave visualization
function SoundWaves() {
  const groupRef = useRef<THREE.Group>(null);
  
  useFrame(({ clock }) => {
    if (groupRef.current) {
      const t = clock.getElapsedTime();
      groupRef.current.scale.setScalar(1 + Math.sin(t * 3) * 0.1);
      groupRef.current.rotation.y += 0.01;
    }
  });
  
  return (
    <group ref={groupRef}>
      {[0, 1, 2].map((ring) => (
        <mesh key={ring} position={[0, 0, 0]} rotation={[Math.PI/2, 0, 0]}>
          <ringGeometry args={[1.5 + ring * 0.3, 1.6 + ring * 0.3, 32]} />
          <meshBasicMaterial color="#00a2ff" transparent opacity={0.2 - ring * 0.05} />
        </mesh>
      ))}
    </group>
  );
}

// Listening visualization
function ListeningIndicator() {
  const groupRef = useRef<THREE.Group>(null);
  
  useFrame(({ clock }) => {
    if (groupRef.current) {
      const t = clock.getElapsedTime() * 5;
      for (let i = 0; i < groupRef.current.children.length; i++) {
        const bar = groupRef.current.children[i];
        const scale = 0.5 + Math.sin(t + i * 0.5) * 0.5;
        if (bar.scale) {
          bar.scale.y = Math.max(0.1, scale);
        }
      }
    }
  });
  
  return (
    <group ref={groupRef} position={[0, -1.5, 0]}>
      {Array.from({ length: 5 }).map((_, i) => (
        <mesh key={i} position={[-0.6 + i * 0.3, 0.5, 0]}>
          <boxGeometry args={[0.1, 1, 0.1]} />
          <meshBasicMaterial color="#ff4040" />
        </mesh>
      ))}
    </group>
  );
}

// Orbiting particles component
function Particles({ 
  count, 
  radius, 
  isSpeaking, 
  isListening 
}: { 
  count: number; 
  radius: number; 
  isSpeaking?: boolean; 
  isListening?: boolean;
}) {
  const particles = useRef<THREE.Group>(null);
  
  useFrame(() => {
    if (particles.current) {
      const rotationSpeed = isSpeaking ? 0.01 : isListening ? 0.008 : 0.003;
      particles.current.rotation.y += rotationSpeed;
    }
  });
  
  return (
    <group ref={particles}>
      {Array.from({ length: count }).map((_, i) => {
        const angle = (i / count) * Math.PI * 2;
        const x = Math.cos(angle) * radius;
        const z = Math.sin(angle) * radius;
        const size = 0.05 + Math.random() * 0.1;
        
        return (
          <mesh key={i} position={[x, (Math.random() - 0.5) * 0.5, z]}>
            <sphereGeometry args={[size, 16, 16]} />
            <meshStandardMaterial 
              color={isListening ? '#ff8080' : '#80dfff'} 
              emissive={isListening ? '#ff8080' : '#80dfff'}
              emissiveIntensity={isSpeaking ? 2 : isListening ? 1.5 : 1}
            />
          </mesh>
        );
      })}
    </group>
  );
}

// Custom model loader
function JarvisModel({ isListening, isSpeaking }: { isListening?: boolean; isSpeaking?: boolean }) {
  // We'll use a placeholder sphere until we have a real model
  // When you have a model, uncomment this and replace with your model path
  // const { scene } = useGLTF('/models/jarvis.glb');
  // return <primitive object={scene} scale={[1, 1, 1]} position={[0, 0, 0]} />;
  
  return <DefaultJarvisModel isListening={isListening} isSpeaking={isSpeaking} />;
}

export default function JarvisScene({ isListening, isSpeaking }: { isListening?: boolean; isSpeaking?: boolean }) {
  // Track mounted state to prevent unmounting issues
  const [isMounted, setIsMounted] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Use a more mobile-friendly position for the camera
  const cameraPosition: [number, number, number] = [0, 0, 4.5]; // Typed as tuple
  
  // Wait for client-side mounting
  useEffect(() => {
    setIsMounted(true);
    
    // Add touch event listeners for mobile
    const touchHandler = (e: TouchEvent) => {
      if (e.touches.length > 1) {
        e.preventDefault(); // Prevent pinch zoom when interacting with canvas
      }
    };
    
    document.addEventListener('touchmove', touchHandler, { passive: false });
    
    // Cleanup function
    return () => {
      setIsMounted(false);
      document.removeEventListener('touchmove', touchHandler);
    };
  }, []);
  
  if (!isMounted) {
    return (
      <div className="w-full h-full bg-transparent flex items-center justify-center">
        <div className="text-blue-400">Loading 3D scene...</div>
      </div>
    );
  }
  
  return (
    <div 
      ref={containerRef}
      className="w-full h-full relative jarvis-3d-scene" 
    >
      <div className="jarvis-3d-container">
        <Canvas
          style={{ background: 'transparent' }}
          camera={{ 
            position: cameraPosition,
            fov: 50,
          }}
          gl={{ 
            antialias: true,
            preserveDrawingBuffer: true,
            alpha: true 
          }}
        >
          <Suspense fallback={null}>
            <PerspectiveCamera 
              makeDefault 
              position={cameraPosition} 
              fov={50}
            />
            <ambientLight intensity={0.4} />
            <pointLight position={[10, 10, 10]} intensity={0.5} />
            <directionalLight position={[-5, 5, 5]} intensity={0.5} />
            
            <JarvisModel isListening={isListening} isSpeaking={isSpeaking} />
            
            <OrbitControls 
              enableZoom={false}
              enablePan={false}
              rotateSpeed={0.3}
              maxPolarAngle={Math.PI / 1.5}
              minPolarAngle={Math.PI / 3}
            />
            
            <Environment preset="city" />
          </Suspense>
        </Canvas>
      </div>
    </div>
  );
} 