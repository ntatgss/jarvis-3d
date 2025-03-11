'use client';

import React, { useRef, useState, useEffect, useMemo } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { 
  OrbitControls, 
  Text, 
  useTexture, 
  Environment, 
  MeshDistortMaterial, 
  GradientTexture,
  Trail
} from '@react-three/drei';
import { EffectComposer, Bloom, Noise } from '@react-three/postprocessing';
import * as THREE from 'three';
import { Vector3, Group, Mesh, Object3D } from 'three';

// Iron Man UI themes
const IRONMAN_BLUE = '#00a2ff';
const IRONMAN_RED = '#ff4040';
const IRONMAN_GOLD = '#ffcc00';
const DARK_BLUE = '#003366';
const LIGHT_BLUE = '#4cc9ff';

// Visual style options
const VISUAL_STYLES = {
  CLASSIC: 'classic',
  HOLOGRAM: 'hologram',
  ENERGY_CORE: 'energy_core',
  NANOTECH: 'nanotech',
  MARK85: 'mark85'
} as const;

type VisualStyle = typeof VISUAL_STYLES[keyof typeof VISUAL_STYLES];

interface HolographicCoreProps {
  isListening: boolean;
  isSpeaking: boolean;
  visualStyle?: VisualStyle;
}

interface EnergyBeamsProps {
  color: string;
  count?: number;
}

interface NanoParticleCloudProps {
  count: number;
  radius: number;
  color: string;
  isActive: boolean;
}

interface ParticlesProps {
  count: number;
  radius: number;
  isSpeaking: boolean;
  isListening: boolean;
  color?: string;
}

interface AdvancedHUDProps {
  isListening: boolean;
  isSpeaking: boolean;
  style: VisualStyle;
}

interface CircularHUDElementProps {
  position: [number, number, number];
  radius?: number;
  segments?: number;
  active?: boolean;
  color?: string;
}

interface SidePanelProps {
  position: [number, number, number];
  width?: number;
  height?: number;
  active?: boolean;
  isLeft?: boolean;
  color?: string;
}

interface JarvisSceneProps {
  isListening: boolean;
  isSpeaking: boolean;
  visualStyle?: VisualStyle;
}

// Core holographic interface component
function HolographicCore({ 
  isListening, 
  isSpeaking, 
  visualStyle = VISUAL_STYLES.HOLOGRAM
}: HolographicCoreProps) {
  const groupRef = useRef<Group>(null);
  const coreRef = useRef<Mesh>(null);
  const ringRef = useRef<Mesh>(null);
  const time = useRef(0);
  
  // Calculate current state color
  const color = isListening ? IRONMAN_RED : isSpeaking ? IRONMAN_BLUE : IRONMAN_GOLD;
  const secondaryColor = isListening ? '#ff8080' : '#4cc9ff';
  
  // Animation settings based on state
  const rotationSpeed = isSpeaking ? 0.5 : isListening ? 0.3 : 0.1;
  const pulseIntensity = isSpeaking ? 0.3 : isListening ? 0.2 : 0.1;
  
  // Animation loop
  useFrame((state, delta) => {
    time.current += delta;
    
    if (groupRef.current) {
      // Base rotation
      groupRef.current.rotation.y += delta * rotationSpeed;
      
      // State-based animations
      const pulse = Math.sin(time.current * 3) * pulseIntensity + 1;
      
      if (coreRef.current) {
        coreRef.current.scale.set(pulse, pulse, pulse);
        
        // Update material based on state
        if (coreRef.current.material instanceof THREE.MeshStandardMaterial) {
          coreRef.current.material.emissiveIntensity = isSpeaking ? 2.5 + Math.sin(time.current * 5) * 0.5 : 
                                                      isListening ? 2.0 : 1.5;
        }
      }
      
      if (ringRef.current) {
        ringRef.current.rotation.z += delta * (isListening ? 0.2 : 0.1);
        ringRef.current.rotation.x += delta * 0.05;
      }
    }
  });
  
  // Different core visuals based on style
  const renderCoreVisual = () => {
    switch(visualStyle) {
      case VISUAL_STYLES.HOLOGRAM:
        return (
          <>
            {/* Main holographic sphere */}
            <mesh ref={coreRef}>
              <sphereGeometry args={[1, 64, 64]} />
              <MeshDistortMaterial
                color={color}
                emissive={color}
                emissiveIntensity={2}
                distort={0.4}
                speed={2}
                transparent={true}
                opacity={0.9}
                metalness={0.8}
                roughness={0.2}
              />
            </mesh>
            
            {/* Outer glow */}
            <mesh scale={1.3}>
              <sphereGeometry args={[1, 32, 32]} />
              <meshBasicMaterial 
                color={secondaryColor} 
                transparent={true}
                opacity={0.15}
              />
            </mesh>
            
            {/* Rotating ring */}
            <mesh ref={ringRef} rotation={[Math.PI/2, 0, 0]}>
              <torusGeometry args={[1.5, 0.06, 16, 100]} />
              <meshStandardMaterial 
                color={color} 
                emissive={color}
                emissiveIntensity={1.5}
                metalness={0.9}
                roughness={0.1}
              />
            </mesh>
          </>
        );
        
      case VISUAL_STYLES.ENERGY_CORE:
        return (
          <>
            {/* Energy core */}
            <mesh ref={coreRef}>
              <dodecahedronGeometry args={[0.8, 2]} />
              <meshStandardMaterial 
                color={color} 
                emissive={color}
                emissiveIntensity={2}
                wireframe={true}
              />
            </mesh>
            
            {/* Inner glow */}
            <mesh>
              <sphereGeometry args={[0.6, 32, 32]} />
              <meshBasicMaterial 
                color={color}
                transparent={true}
                opacity={0.8}
              />
            </mesh>
            
            {/* Outer energy field */}
            <mesh ref={ringRef}>
              <sphereGeometry args={[1.2, 32, 32]} />
              <meshStandardMaterial 
                color={secondaryColor}
                emissive={secondaryColor}
                wireframe={true}
                transparent={true}
                opacity={0.4}
              />
            </mesh>
            
            {/* Arc reactor rings */}
            <group>
              {[1.4, 1.6, 1.8].map((radius, i) => (
                <mesh 
                  key={i} 
                  rotation={[Math.PI/2, 0, i * Math.PI/4]}
                >
                  <torusGeometry args={[radius, 0.03, 8, 64]} />
                  <meshStandardMaterial 
                    color={i === 1 ? IRONMAN_GOLD : color}
                    emissive={i === 1 ? IRONMAN_GOLD : color}
                    emissiveIntensity={1.5}
                  />
                </mesh>
              ))}
            </group>
          </>
        );
        
      case VISUAL_STYLES.NANOTECH:
        return (
          <>
            {/* Nanotech core structure */}
            <mesh ref={coreRef}>
              <octahedronGeometry args={[0.8, 2]} />
              <meshStandardMaterial 
                color={color} 
                emissive={color}
                emissiveIntensity={2}
                metalness={1}
                roughness={0.3}
              />
            </mesh>
            
            {/* Nano-particle cloud */}
            <NanoParticleCloud 
              count={200} 
              radius={1.5} 
              color={color} 
              isActive={isSpeaking || isListening} 
            />
            
            {/* Triangular panels */}
            <mesh rotation={[0, time.current * 0.1, 0]}>
              <torusGeometry args={[1.2, 0.4, 3, 3]} />
              <meshStandardMaterial 
                color={IRONMAN_GOLD} 
                emissive={IRONMAN_GOLD}
                emissiveIntensity={1}
                transparent={true}
                opacity={0.7}
                side={THREE.DoubleSide}
              />
            </mesh>
          </>
        );
        
      case VISUAL_STYLES.MARK85:
        return (
          <>
            {/* Mark 85 style arc reactor */}
            <group>
              {/* Core light */}
              <mesh ref={coreRef}>
                <cylinderGeometry args={[0.6, 0.6, 0.2, 32]} />
                <meshStandardMaterial 
                  color={'#ffffff'} 
                  emissive={'#ffffff'}
                  emissiveIntensity={3}
                />
              </mesh>
              
              {/* Concentric rings */}
              {[0.7, 0.9, 1.1, 1.3].map((radius, i) => (
                <mesh 
                  key={i} 
                  position={[0, 0, -0.05 * i]}
                  rotation={[Math.PI/2, 0, time.current * (0.1 - i * 0.02)]}
                >
                  <ringGeometry args={[radius, radius + 0.1, 32]} />
                  <meshStandardMaterial 
                    color={i % 2 === 0 ? color : IRONMAN_GOLD}
                    emissive={i % 2 === 0 ? color : IRONMAN_GOLD}
                    emissiveIntensity={1.5 - i * 0.2}
                    metalness={0.9}
                    roughness={0.1}
                    side={THREE.DoubleSide}
                    transparent={true}
                    opacity={0.9 - i * 0.15}
                  />
                </mesh>
              ))}
              
              {/* Outer energy field */}
              <mesh rotation={[Math.PI/2, 0, 0]}>
                <torusGeometry args={[1.6, 0.08, 16, 100]} />
                <meshStandardMaterial 
                  color={IRONMAN_RED} 
                  emissive={IRONMAN_RED}
                  emissiveIntensity={1.5}
                />
              </mesh>
              
              {/* Triangular mechanical sections */}
              <group rotation={[0, time.current * 0.1, 0]}>
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <mesh 
                    key={i} 
                    rotation={[0, (i / 6) * Math.PI * 2, 0]}
                    position={[Math.cos((i / 6) * Math.PI * 2) * 1.4, Math.sin((i / 6) * Math.PI * 2) * 1.4, 0]}
                  >
                    <boxGeometry args={[0.3, 0.3, 0.1]} />
                    <meshStandardMaterial 
                      color={IRONMAN_GOLD} 
                      metalness={1}
                      roughness={0.3}
                    />
                  </mesh>
                ))}
              </group>
            </group>
            
            {/* Energy beams */}
            {isSpeaking && (
              <EnergyBeams color={color} count={8} />
            )}
          </>
        );
      
      // Default/Classic style  
      default:
        return (
          <>
            {/* Core sphere */}
            <mesh ref={coreRef}>
              <sphereGeometry args={[1, 32, 32]} />
              <meshStandardMaterial 
                color={color} 
                emissive={isListening ? IRONMAN_RED : '#003a5c'} 
                emissiveIntensity={isSpeaking ? 2 : isListening ? 1.5 : 1}
                metalness={0.8}
                roughness={0.2}
              />
            </mesh>
            
            {/* Outer glow */}
            <mesh scale={1.2}>
              <sphereGeometry args={[1, 16, 16]} />
              <meshStandardMaterial 
                color={secondaryColor} 
                emissive={secondaryColor}
                emissiveIntensity={0.5}
                transparent={true}
                opacity={0.15}
              />
            </mesh>
            
            {/* Arc reactor core */}
            <mesh position={[0, 0, 0.8]} rotation={[0, 0, 0]} scale={0.35}>
              <ringGeometry args={[0.4, 0.7, 32]} />
              <meshStandardMaterial 
                color={IRONMAN_BLUE} 
                emissive={IRONMAN_BLUE}
                emissiveIntensity={2}
                metalness={1}
                roughness={0.2}
              />
            </mesh>
            
            {/* Central triangular element */}
            <mesh position={[0, 0, 0.8]} rotation={[0, 0, Math.PI / 4]} scale={0.2}>
              <ringGeometry args={[0.1, 0.5, 3]} />
              <meshStandardMaterial 
                color={IRONMAN_GOLD} 
                emissive={IRONMAN_GOLD}
                emissiveIntensity={3}
              />
            </mesh>
          </>
        );
    }
  };
  
  return (
    <group ref={groupRef}>
      {renderCoreVisual()}
      
      {/* Display appropriate state effects */}
      {isSpeaking && <SoundWaves color={color} />}
      {isListening && <ListeningIndicator color={IRONMAN_RED} />}
      
      {/* Orbiting particles for all styles */}
      <Particles 
        count={visualStyle === VISUAL_STYLES.NANOTECH ? 10 : 20} 
        radius={visualStyle === VISUAL_STYLES.MARK85 ? 2.2 : 1.8} 
        isSpeaking={isSpeaking} 
        isListening={isListening} 
        color={color}
      />
    </group>
  );
}

// Energy beams for Mark85 style
function EnergyBeams({ color, count = 6 }: EnergyBeamsProps) {
  const beams = useMemo(() => {
    return Array.from({ length: count }).map((_, i) => {
      const angle = (i / count) * Math.PI * 2;
      return {
        x: Math.cos(angle) * 0.1,
        y: Math.sin(angle) * 0.1,
        z: 0,
        length: Math.random() * 0.5 + 0.5,
        speed: Math.random() * 0.5 + 0.5
      };
    });
  }, [count]);
  
  return (
    <group>
      {beams.map((beam, i) => (
        <Trail
          key={i}
          width={0.1}
          length={10}
          color={color}
          attenuation={(t) => t * t}
        >
          <mesh position={[beam.x, beam.y, beam.z]}>
            <sphereGeometry args={[0.05, 8, 8]} />
            <meshBasicMaterial color={color} />
          </mesh>
        </Trail>
      ))}
    </group>
  );
}

// Nano-particle cloud for nanotech style
function NanoParticleCloud({ count, radius, color, isActive }: NanoParticleCloudProps) {
  const particlesRef = useRef<Group>(null);
  const particles = useMemo(() => {
    return Array.from({ length: count }).map(() => ({
      position: new Vector3(
        (Math.random() - 0.5) * radius * 2,
        (Math.random() - 0.5) * radius * 2,
        (Math.random() - 0.5) * radius * 2
      ),
      velocity: new Vector3(
        (Math.random() - 0.5) * 0.02,
        (Math.random() - 0.5) * 0.02,
        (Math.random() - 0.5) * 0.02
      ),
      size: Math.random() * 0.04 + 0.02
    }));
  }, [count, radius]);
  
  useFrame(() => {
    if (particlesRef.current && particlesRef.current.children) {
      const speed = isActive ? 1 : 0.2;
      
      particlesRef.current.children.forEach((particle, i) => {
        if (particles[i]) {
          // Update position
          particle.position.x += particles[i].velocity.x * speed;
          particle.position.y += particles[i].velocity.y * speed;
          particle.position.z += particles[i].velocity.z * speed;
          
          // Boundary check - if too far, reset position
          const dist = particle.position.length();
          if (dist > radius) {
            const factor = (radius * 0.8) / dist;
            particle.position.multiplyScalar(factor);
            particles[i].velocity.multiplyScalar(-1); // Reverse direction
          }
        }
      });
    }
  });
  
  return (
    <group ref={particlesRef}>
      {particles.map((particle, i) => (
        <mesh key={i} position={particle.position.toArray()}>
          <boxGeometry args={[particle.size, particle.size, particle.size]} />
          <meshBasicMaterial 
            color={color} 
            transparent 
            opacity={0.7} 
          />
        </mesh>
      ))}
    </group>
  );
}

// Sound wave visualization
function SoundWaves({ color = IRONMAN_BLUE }: { color?: string }) {
  const groupRef = useRef<Group>(null);
  
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
          <meshBasicMaterial color={color} transparent opacity={0.2 - ring * 0.05} />
        </mesh>
      ))}
    </group>
  );
}

// Listening visualization
function ListeningIndicator({ color = IRONMAN_RED }: { color?: string }) {
  const groupRef = useRef<Group>(null);
  
  useFrame(({ clock }) => {
    if (groupRef.current) {
      const t = clock.getElapsedTime() * 5;
      for (let i = 0; i < groupRef.current.children.length; i++) {
        const bar = groupRef.current.children[i];
        const scale = 0.5 + Math.sin(t + i * 0.5) * 0.5;
        if (bar instanceof Mesh) {
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
          <meshBasicMaterial color={color} />
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
  isListening,
  color = IRONMAN_BLUE
}: ParticlesProps) {
  const particlesRef = useRef<Group>(null);
  
  useFrame(() => {
    if (particlesRef.current) {
      const rotationSpeed = isSpeaking ? 0.015 : isListening ? 0.01 : 0.005;
      particlesRef.current.rotation.y += rotationSpeed;
    }
  });
  
  return (
    <group ref={particlesRef}>
      {Array.from({ length: count }).map((_, i) => {
        const angle = (i / count) * Math.PI * 2;
        const x = Math.cos(angle) * radius;
        const z = Math.sin(angle) * radius;
        const variant = Math.floor(Math.random() * 3);
        
        if (variant === 0) {
          // Standard sphere particles
          const size = 0.05 + Math.random() * 0.1;
          return (
            <mesh key={i} position={[x, (Math.random() - 0.5) * 0.5, z]}>
              <sphereGeometry args={[size, 16, 16]} />
              <meshStandardMaterial 
                color={isListening ? IRONMAN_RED : color} 
                emissive={isListening ? IRONMAN_RED : color}
                emissiveIntensity={isSpeaking ? 2 : isListening ? 1.5 : 1}
              />
            </mesh>
          );
        } else if (variant === 1) {
          // Data cube particles (Iron Man HUD style)
          const size = 0.08 + Math.random() * 0.05;
          return (
            <mesh key={i} position={[x, (Math.random() - 0.5) * 0.5, z]} rotation={[Math.random(), Math.random(), Math.random()]}>
              <boxGeometry args={[size, size, size]} />
              <meshStandardMaterial 
                color={i % 3 === 0 ? IRONMAN_GOLD : isListening ? IRONMAN_RED : color} 
                emissive={i % 3 === 0 ? IRONMAN_GOLD : isListening ? IRONMAN_RED : color}
                emissiveIntensity={1.5}
                transparent={true}
                opacity={0.7}
              />
            </mesh>
          );
        } else {
          // Data point particles
          return (
            <group key={i} position={[x, (Math.random() - 0.5) * 0.5, z]}>
              <mesh>
                <sphereGeometry args={[0.03, 8, 8]} />
                <meshBasicMaterial color={i % 5 === 0 ? IRONMAN_GOLD : color} />
              </mesh>
              {/* Small connecting line */}
              <mesh position={[0, 0.1, 0]}>
                <boxGeometry args={[0.01, 0.2, 0.01]} />
                <meshBasicMaterial color={color} transparent opacity={0.5} />
              </mesh>
            </group>
          );
        }
      })}
    </group>
  );
}

// HUD elements for the advanced Jarvis interface
function AdvancedHUD({ isListening, isSpeaking, style }: AdvancedHUDProps) {
  const hudRef = useRef<Group>(null);
  const { camera } = useThree();
  const [visible, setVisible] = useState(true);
  const activeState = isListening ? "Input" : isSpeaking ? "Output" : "Standby";
  
  // Keep HUD always facing the camera
  useFrame(() => {
    if (hudRef.current) {
      hudRef.current.quaternion.copy(camera.quaternion);
    }
  });
  
  return (
    <group ref={hudRef}>
      {/* Status Display */}
      <group position={[0, 2.5, 0]}>
        <Text
          position={[0, 0, 0]}
          fontSize={0.15}
          color={isListening ? IRONMAN_RED : isSpeaking ? IRONMAN_BLUE : IRONMAN_GOLD}
          anchorX="center"
          anchorY="middle"
          font="/Share_Tech_Mono/ShareTechMono-Regular.ttf"
        >
          {`JARVIS ${activeState.toUpperCase()}`}
        </Text>
        
        <mesh position={[0, -0.15, 0]}>
          <planeGeometry args={[1.5, 0.04]} />
          <meshBasicMaterial color={isListening ? IRONMAN_RED : isSpeaking ? IRONMAN_BLUE : IRONMAN_GOLD} />
        </mesh>
      </group>
      
      {/* Circular interface elements */}
      {style !== VISUAL_STYLES.CLASSIC && (
        <>
          <CircularHUDElement
            position={[2.4, 0, 0]}
            radius={0.8}
            segments={32}
            active={isListening || isSpeaking}
            color={isListening ? IRONMAN_RED : IRONMAN_BLUE}
          />
          
          <CircularHUDElement
            position={[-2.4, 0, 0]}
            radius={0.8}
            segments={32}
            active={isListening || isSpeaking}
            color={isListening ? IRONMAN_RED : IRONMAN_BLUE}
          />
          
          {/* Advanced side panels */}
          <SidePanel
            position={[3.5, 0, 0]}
            width={1.2}
            height={2.5}
            active={isListening || isSpeaking}
            isLeft={false}
            color={isListening ? IRONMAN_RED : IRONMAN_BLUE}
          />
          
          <SidePanel
            position={[-3.5, 0, 0]}
            width={1.2}
            height={2.5}
            active={isListening || isSpeaking}
            isLeft={true}
            color={isListening ? IRONMAN_RED : IRONMAN_BLUE}
          />
        </>
      )}
      
      {/* Bottom status indicators */}
      <group position={[0, -2.2, 0]}>
        <Text
          position={[0, 0, 0]}
          fontSize={0.12}
          color={isListening ? IRONMAN_RED : isSpeaking ? IRONMAN_BLUE : '#ffffff'}
          anchorX="center"
          anchorY="middle"
          font="/Share_Tech_Mono/ShareTechMono-Regular.ttf"
        >
          {isListening ? "VOICE RECOGNITION ACTIVE" : 
           isSpeaking ? "SPEECH SYNTHESIS ACTIVE" : 
           "SYSTEM READY"}
        </Text>
        
        {/* Status bars */}
        <group position={[0, -0.2, 0]}>
          {[0, 1, 2, 3, 4].map((i) => (
            <mesh key={i} position={[-1 + i * 0.5, 0, 0]}>
              <boxGeometry args={[0.4, 0.05, 0.01]} />
              <meshBasicMaterial 
                color={i < 3 ? IRONMAN_GOLD : IRONMAN_BLUE} 
                opacity={isListening || isSpeaking ? 0.9 : 0.4}
                transparent 
              />
            </mesh>
          ))}
        </group>
      </group>
    </group>
  );
}

// Circular HUD Element (improved)
function CircularHUDElement({
  position,
  radius = 1,
  segments = 32,
  active = false,
  color = IRONMAN_BLUE
}: CircularHUDElementProps) {
  const ringRef = useRef<Mesh>(null);
  const innerRingRef = useRef<Mesh>(null);
  const time = useRef(0);
  
  useFrame((state, delta) => {
    time.current += delta;
    
    if (ringRef.current) {
      ringRef.current.rotation.z += delta * (active ? 0.5 : 0.1);
      
      if (ringRef.current.material instanceof THREE.MeshBasicMaterial) {
        const material = ringRef.current.material;
        material.opacity = active ? 
          0.4 + Math.sin(time.current * 3) * 0.2 : 
          0.2;
      }
    }
    
    if (innerRingRef.current) {
      innerRingRef.current.rotation.z -= delta * (active ? 0.3 : 0.05);
    }
  });
  
  return (
    <group position={position}>
      {/* Main ring */}
      <mesh ref={ringRef}>
        <ringGeometry args={[radius - 0.1, radius, segments]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.3}
          side={THREE.DoubleSide}
        />
      </mesh>
      
      {/* Inner ring */}
      <mesh ref={innerRingRef}>
        <ringGeometry args={[radius - 0.3, radius - 0.25, segments]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.5}
          side={THREE.DoubleSide}
        />
      </mesh>
      
      {/* Inner element */}
      <mesh rotation={[0, 0, Math.PI / 4]}>
        <ringGeometry args={[radius - 0.5, radius - 0.45, 4]} />
        <meshBasicMaterial
          color={IRONMAN_GOLD}
          transparent
          opacity={active ? 0.7 : 0.3}
          side={THREE.DoubleSide}
        />
      </mesh>
      
      {/* Indicators */}
      {active && (
        <group>
          {Array.from({ length: 12 }).map((_, i) => {
            const angle = (i / 12) * Math.PI * 2;
            const x = Math.cos(angle) * (radius - 0.05);
            const y = Math.sin(angle) * (radius - 0.05);
            
            return (
              <mesh key={i} position={[x, y, 0]}>
                <sphereGeometry args={[0.03, 8, 8]} />
                <meshBasicMaterial color={i % 3 === 0 ? IRONMAN_GOLD : color} />
              </mesh>
            );
          })}
        </group>
      )}
    </group>
  );
}

// Side Panels for advanced design
function SidePanel({
  position,
  width = 1,
  height = 2,
  active = false,
  isLeft = false,
  color = IRONMAN_BLUE
}: SidePanelProps) {
  const panelRef = useRef<Group>(null);
  const time = useRef(0);
  
  useFrame((state, delta) => {
    time.current += delta;
    
    if (panelRef.current) {
      // Subtle movement
      panelRef.current.position.x = position[0] + (isLeft ? -1 : 1) * Math.sin(time.current * 0.5) * 0.05;
    }
  });
  
  return (
    <group ref={panelRef} position={position}>
      {/* Main panel frame */}
      <mesh>
        <planeGeometry args={[width, height]} />
        <meshBasicMaterial 
          color={color}
          transparent 
          opacity={0.1}
          side={THREE.DoubleSide}
        />
      </mesh>
      
      {/* Top and bottom borders */}
      <mesh position={[0, height/2 - 0.05, 0]}>
        <planeGeometry args={[width, 0.05]} />
        <meshBasicMaterial color={color} transparent opacity={0.7} />
      </mesh>
      
      <mesh position={[0, -height/2 + 0.05, 0]}>
        <planeGeometry args={[width, 0.05]} />
        <meshBasicMaterial color={color} transparent opacity={0.7} />
      </mesh>
      
      {/* Side border (thicker on the outer edge) */}
      <mesh position={[isLeft ? width/2 - 0.05 : -width/2 + 0.05, 0, 0]}>
        <planeGeometry args={[0.1, height]} />
        <meshBasicMaterial color={color} transparent opacity={0.5} />
      </mesh>
      
      {/* Data visualization */}
      {active && (
        <group>
          {/* Data rows */}
          {Array.from({ length: 10 }).map((_, i) => (
            <mesh 
              key={i} 
              position={[
                isLeft ? -0.1 : 0.1, 
                height/2 - 0.3 - i * 0.2, 
                0.01
              ]}
            >
              <planeGeometry args={[width * 0.7, 0.08]} />
              <meshBasicMaterial 
                color={i % 4 === 0 ? IRONMAN_GOLD : color} 
                transparent 
                opacity={0.2 + Math.sin(time.current * 2 + i * 0.4) * 0.15 + 0.15} 
              />
            </mesh>
          ))}
          
          {/* Animated indicator */}
          <mesh 
            position={[
              isLeft ? width * 0.25 : -width * 0.25, 
              Math.sin(time.current) * (height/2 - 0.3), 
              0.01
            ]}
          >
            <circleGeometry args={[0.08, 16]} />
            <meshBasicMaterial color={IRONMAN_GOLD} />
          </mesh>
        </group>
      )}
    </group>
  );
}

// Main component
export default function JarvisScene({ 
  isListening, 
  isSpeaking,
  visualStyle = VISUAL_STYLES.HOLOGRAM
}: JarvisSceneProps) {
  const [isMounted, setIsMounted] = useState(false);
  const [currentVisualStyle, setCurrentVisualStyle] = useState<VisualStyle>(visualStyle);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // More mobile-friendly camera position
  const cameraPosition: [number, number, number] = [0, 0, 5.5];
  
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
  
  // UI for style switching
  const styleOptions = [
    { id: VISUAL_STYLES.CLASSIC, label: 'Classic' },
    { id: VISUAL_STYLES.HOLOGRAM, label: 'Hologram' },
    { id: VISUAL_STYLES.ENERGY_CORE, label: 'Energy Core' },
    { id: VISUAL_STYLES.NANOTECH, label: 'Nanotech' },
    { id: VISUAL_STYLES.MARK85, label: 'Mark 85' }
  ];
  
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
      {/* Style selector */}
      <div className="absolute bottom-4 left-4 z-10 flex flex-wrap gap-2">
        {styleOptions.map(style => (
          <button
            key={style.id}
            className={`px-3 py-1 text-xs rounded-full transition-colors ${
              currentVisualStyle === style.id
                ? 'bg-blue-600 text-white'
                : 'bg-gray-800/70 text-gray-300 hover:bg-gray-700'
            }`}
            onClick={() => setCurrentVisualStyle(style.id)}
          >
            {style.label}
          </button>
        ))}
      </div>
      
      {/* Iron Man-style circular targeting UI elements (CSS overlay) */}
      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-64 h-64 pointer-events-none">
        <div className={`absolute inset-0 border-2 border-blue-400 rounded-full opacity-20 ${isListening ? 'border-red-500' : ''}`}></div>
        <div className={`absolute inset-2 border border-blue-400 rounded-full opacity-30 ${isListening ? 'border-red-500' : ''}`}></div>
        <div className={`absolute inset-6 border border-blue-400 rounded-full opacity-20 ${isListening ? 'border-red-500' : ''}`}></div>
        
        {/* Targeting crosshairs */}
        <div className={`absolute top-1/2 left-0 w-4 h-px bg-blue-400 ${isListening ? 'bg-red-500' : ''}`}></div>
        <div className={`absolute top-1/2 right-0 w-4 h-px bg-blue-400 ${isListening ? 'bg-red-500' : ''}`}></div>
        <div className={`absolute left-1/2 top-0 h-4 w-px bg-blue-400 ${isListening ? 'bg-red-500' : ''}`}></div>
        <div className={`absolute left-1/2 bottom-0 h-4 w-px bg-blue-400 ${isListening ? 'bg-red-500' : ''}`}></div>
      </div>

      {/* Three.js Canvas */}
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
            alpha: true,
            premultipliedAlpha: false,
            stencil: false,
            depth: true
          }}
        >
          {/* Main Jarvis Visual */}
          <HolographicCore 
            isListening={isListening} 
            isSpeaking={isSpeaking}
            visualStyle={currentVisualStyle}
          />
          
          {/* Advanced HUD Elements */}
          <AdvancedHUD 
            isListening={isListening} 
            isSpeaking={isSpeaking}
            style={currentVisualStyle}
          />
          
          {/* Ambient light */}
          <ambientLight intensity={0.3} />
          
          {/* Add some directional lights for better visualization */}
          <directionalLight position={[5, 5, 5]} intensity={0.5} color="#ffffff" />
          <directionalLight position={[-5, 5, 5]} intensity={0.3} color="#4cc9ff" />
          
          {/* Add environment for reflections */}
          <Environment preset="city" />
          
          {/* Post-processing effects */}
          <EffectComposer>
            <Bloom 
              luminanceThreshold={0.2} 
              luminanceSmoothing={0.9} 
              intensity={0.8} 
            />
            <Noise opacity={0.025} />
          </EffectComposer>
          
          {/* Rotating controls (limited) */}
          <OrbitControls 
            enablePan={false}
            enableZoom={false}
            maxPolarAngle={Math.PI / 1.5}
            minPolarAngle={Math.PI / 3}
            rotateSpeed={0.5}
          />
        </Canvas>
      </div>
      
      {/* Version Indicator */}
      <div className="absolute bottom-4 right-4 text-xs text-blue-400/70">
        Jarvis Interface v2.0
      </div>
      
      {/* Status text overlay */}
      <div className="absolute top-4 right-4 flex flex-col items-end space-y-1">
        {isListening && (
          <div className="bg-red-500/80 text-white px-3 py-1 rounded-full text-sm font-mono animate-pulse">
            LISTENING...
          </div>
        )}
        {isSpeaking && (
          <div className="bg-blue-500/80 text-white px-3 py-1 rounded-full text-sm font-mono">
            SPEAKING...
          </div>
        )}
      </div>
    </div>
  );
}