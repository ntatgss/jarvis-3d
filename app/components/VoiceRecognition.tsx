'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

// Define proper types for SpeechRecognition
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
}

interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onstart: (event: Event) => void;
  onend: (event: Event) => void;
  onresult: (event: SpeechRecognitionEvent) => void;
  onerror: (event: SpeechRecognitionErrorEvent) => void;
}

interface VoiceRecognitionProps {
  onTranscript: (text: string) => void;
  onListeningChange: (isListening: boolean) => void;
  onSpeakingChange: (isSpeaking: boolean) => void;
}

export default function useVoiceRecognition({ 
  onTranscript, 
  onListeningChange, 
  onSpeakingChange 
}: VoiceRecognitionProps) {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [recognition, setRecognition] = useState<SpeechRecognitionInstance | null>(null);
  const [temporaryTranscript, setTemporaryTranscript] = useState('');
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  
  // Use refs to store the callback functions
  const onTranscriptRef = useRef(onTranscript);
  const onListeningChangeRef = useRef(onListeningChange);
  const onSpeakingChangeRef = useRef(onSpeakingChange);
  
  // Update refs when props change
  useEffect(() => {
    onTranscriptRef.current = onTranscript;
    onListeningChangeRef.current = onListeningChange;
    onSpeakingChangeRef.current = onSpeakingChange;
  }, [onTranscript, onListeningChange, onSpeakingChange]);

  // Initialize speech synthesis voices
  useEffect(() => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      // Initialize voices
      const loadVoices = () => {
        const availableVoices = window.speechSynthesis.getVoices();
        if (availableVoices.length > 0) {
          setVoices(availableVoices);
          console.log('Voices loaded:', availableVoices.length);
        }
      };
      
      // Load voices initially
      loadVoices();
      
      // Chrome loads voices asynchronously
      window.speechSynthesis.onvoiceschanged = loadVoices;
      
      return () => {
        window.speechSynthesis.onvoiceschanged = null;
      };
    }
  }, []);

  // Function to send the transcript
  const sendFinalTranscript = useCallback((text: string) => {
    if (text && text.trim()) {
      console.log('Sending final transcript:', text);
      setTranscript(text);
      onTranscriptRef.current(text);
    }
  }, []);
  
  // Initialize speech recognition
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // Use type assertion for browser-specific API
      const SpeechRecognition = 
        (window as unknown as { SpeechRecognition?: { new(): SpeechRecognitionInstance } }).SpeechRecognition || 
        (window as unknown as { webkitSpeechRecognition?: { new(): SpeechRecognitionInstance } }).webkitSpeechRecognition;
      
      if (SpeechRecognition) {
        try {
          const recognitionInstance = new SpeechRecognition();
          recognitionInstance.continuous = false;
          recognitionInstance.interimResults = false;
          recognitionInstance.lang = 'en-US';
          
          recognitionInstance.onstart = () => {
            console.log('Speech recognition started');
            setIsListening(true);
            onListeningChangeRef.current(true);
          };
          
          recognitionInstance.onend = () => {
            console.log('Speech recognition ended');
            setIsListening(false);
            onListeningChangeRef.current(false);
          };
          
          recognitionInstance.onresult = (event: SpeechRecognitionEvent) => {
            if (event.results && event.results.length > 0) {
              const result = event.results[event.results.length - 1];
              if (result.isFinal) {
                const transcriptText = result[0].transcript;
                console.log('Final transcript:', transcriptText);
                setTemporaryTranscript(transcriptText);
                sendFinalTranscript(transcriptText);
              }
            }
          };
          
          recognitionInstance.onerror = (event: SpeechRecognitionErrorEvent) => {
            console.error('Speech recognition error:', event.error);
            setIsListening(false);
            onListeningChangeRef.current(false);
          };
          
          setRecognition(recognitionInstance);
        } catch (e) {
          console.error('Error initializing speech recognition:', e);
        }
      } else {
        console.error('Speech recognition not supported in this browser');
      }
    }
    
    return () => {
      if (recognition) {
        try {
          recognition.stop();
        } catch {
          // Ignore errors on cleanup
        }
      }
    };
  }, [sendFinalTranscript, recognition]);

  // Function to start listening
  const startListening = useCallback(() => {
    if (recognition) {
      try {
        // Always stop before starting to reset any state
        try {
          recognition.stop();
        } catch {
          // Ignore stop errors
        }
        
        // Clear any temporary transcript
        setTemporaryTranscript('');
        
        // Short timeout to ensure stop completes
        setTimeout(() => {
          try {
            recognition.start();
            console.log('Started speech recognition');
          } catch (e) {
            console.error('Error starting speech recognition:', e);
          }
        }, 100);
      } catch (e) {
        console.error('Error in startListening:', e);
      }
    } else {
      console.error('Speech recognition not initialized');
    }
  }, [recognition]);

  // Function to stop listening
  const stopListening = useCallback(() => {
    if (recognition) {
      try {
        recognition.stop();
        console.log('Stopped speech recognition');
      } catch (e) {
        console.error('Error stopping speech recognition:', e);
      }
    }
  }, [recognition]);

  // Text-to-speech function
  const speak = useCallback((text: string) => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      console.log('Speaking:', text);
      onSpeakingChangeRef.current(true);
      
      // Simple browser detection - only care about iOS
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      console.log(`Device detected: ${isIOS ? 'iOS' : 'Other'}`);
      
      if (isIOS) {
        // ULTRA SIMPLIFIED iOS APPROACH
        try {
          console.log('Using simplified iOS approach');
          
          // First, make sure any existing speech is canceled
          window.speechSynthesis.cancel();
          
          // Create the simplest possible utterance
          const iosUtterance = new SpeechSynthesisUtterance(text);
          
          // Basic settings - no frills
          iosUtterance.volume = 1.0;  // Maximum volume
          iosUtterance.rate = 1.0;    // Default rate
          
          // Critical: Set onend and onerror handlers
          iosUtterance.onend = () => {
            console.log('iOS speech ended');
            onSpeakingChangeRef.current(false);
          };
          
          iosUtterance.onerror = (event) => {
            console.error('iOS speech error:', event.type);
            onSpeakingChangeRef.current(false);
          };
          
          // On iOS, try to force audio context to become active
          if (typeof AudioContext !== 'undefined' || typeof (window as any).webkitAudioContext !== 'undefined') {
            // Create a short beep to "wake up" the audio system
            try {
              const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
              const audioCtx = new AudioContextClass();
              const oscillator = audioCtx.createOscillator();
              oscillator.type = 'sine';
              oscillator.frequency.setValueAtTime(500, audioCtx.currentTime);
              oscillator.connect(audioCtx.destination);
              oscillator.start();
              oscillator.stop(audioCtx.currentTime + 0.01);
              
              console.log('Audio context initialized');
              
              // If audio context is suspended (common on iOS), try to resume it
              if (audioCtx.state === 'suspended') {
                audioCtx.resume().then(() => {
                  console.log('Audio context resumed');
                });
              }
            } catch (e) {
              console.log('Audio context initialization failed, but continuing');
            }
          }
          
          console.log('Attempting iOS speech');
          
          // Force a small delay
          setTimeout(() => {
            window.speechSynthesis.speak(iosUtterance);
            console.log('Speech command executed on iOS');
            
            // iOS often needs another nudge after a short delay
            setTimeout(() => {
              if (window.speechSynthesis.paused) {
                console.log('Speech synthesis was paused, resuming');
                window.speechSynthesis.resume();
              }
            }, 250);
          }, 100);
          
        } catch (e) {
          console.error('Error in iOS speech:', e);
          onSpeakingChangeRef.current(false);
        }
      } else {
        // NON-iOS BROWSERS
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'en-US';
        utterance.rate = 1.0;
        utterance.pitch = 1.0;
        utterance.volume = 1.0;
        
        // Get available voices
        const availableVoices = voices.length > 0 ? voices : window.speechSynthesis.getVoices();
        console.log(`Available voices: ${availableVoices.length}`);
        
        // Try to find a good voice
        let preferredVoice = availableVoices.find(voice => 
          voice.name.includes('Google') && voice.lang.startsWith('en')
        );
        
        if (!preferredVoice) {
          preferredVoice = availableVoices.find(voice => 
            voice.lang.startsWith('en') && (voice.name.includes('Male') || voice.name.includes('English'))
          );
        }
        
        if (!preferredVoice && availableVoices.length > 0) {
          // Fallback to any English voice
          preferredVoice = availableVoices.find(voice => voice.lang.startsWith('en'));
        }
        
        if (preferredVoice) {
          console.log('Using voice:', preferredVoice.name);
          utterance.voice = preferredVoice;
        } else if (availableVoices.length > 0) {
          console.log('Using default voice:', availableVoices[0].name);
          utterance.voice = availableVoices[0];
        }
        
        utterance.onend = () => {
          console.log('Speech ended');
          onSpeakingChangeRef.current(false);
        };
        
        utterance.onerror = (event) => {
          console.error('Speech synthesis error:', {
            error: event.error,
            name: event.name,
            type: event.type
          });
          onSpeakingChangeRef.current(false);
        };
        
        // Standard approach for other browsers
        window.speechSynthesis.cancel();
        
        if (window.speechSynthesis.paused) {
          window.speechSynthesis.resume();
        }
        
        setTimeout(() => {
          try {
            window.speechSynthesis.speak(utterance);
          } catch (e) {
            console.error('Error during speak call:', e);
            onSpeakingChangeRef.current(false);
          }
        }, 250);
      }
    } else {
      console.error('Speech synthesis not supported in this browser');
      onSpeakingChangeRef.current(false);
    }
  }, [voices]);

  return {
    isListening,
    transcript,
    startListening,
    stopListening,
    speak,
    temporaryTranscript
  };
} 