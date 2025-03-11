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
  preferredGender?: 'male' | 'female' | 'lmnt';
  onLmntLoadingChange?: (isLoading: boolean) => void;
}

export default function useVoiceRecognition({ 
  onTranscript, 
  onListeningChange, 
  onSpeakingChange,
  preferredGender = 'male',
  onLmntLoadingChange
}: VoiceRecognitionProps) {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [recognition, setRecognition] = useState<SpeechRecognitionInstance | null>(null);
  const [temporaryTranscript, setTemporaryTranscript] = useState('');
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);
  
  // Use refs to store the callback functions
  const onTranscriptRef = useRef(onTranscript);
  const onListeningChangeRef = useRef(onListeningChange);
  const onSpeakingChangeRef = useRef(onSpeakingChange);
  const onLmntLoadingChangeRef = useRef(onLmntLoadingChange);
  
  // Update refs when props change
  useEffect(() => {
    onTranscriptRef.current = onTranscript;
    onListeningChangeRef.current = onListeningChange;
    onSpeakingChangeRef.current = onSpeakingChange;
    onLmntLoadingChangeRef.current = onLmntLoadingChange;
  }, [onTranscript, onListeningChange, onSpeakingChange, onLmntLoadingChange]);

  // Initialize audio element for LMNT
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const audio = new Audio();
      audio.addEventListener('ended', () => {
        onSpeakingChangeRef.current(false);
      });
      audio.addEventListener('error', () => {
        console.error('Audio playback error');
        onSpeakingChangeRef.current(false);
      });
      setAudioElement(audio);
    }
    
    return () => {
      if (audioElement) {
        audioElement.pause();
        audioElement.src = '';
      }
    };
  }, []);

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
  }, [sendFinalTranscript]);

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

  // Function to find the best voice based on gender preference
  const findVoiceByGender = useCallback((voices: SpeechSynthesisVoice[], gender: 'male' | 'female') => {
    console.log(`Looking for ${gender} voice among ${voices.length} voices`);
    
    // Keywords that might indicate gender in voice names
    const maleKeywords = ['male', 'guy', 'man', 'boy', 'david', 'james', 'tom', 'daniel'];
    const femaleKeywords = ['female', 'woman', 'girl', 'lady', 'samantha', 'victoria', 'linda', 'karen', 'lisa'];
    
    // First try to find a voice that explicitly mentions the gender
    const keywords = gender === 'male' ? maleKeywords : femaleKeywords;
    
    // Try to find a voice with the gender keyword in English
    let voice = voices.find(v => 
      v.lang.startsWith('en') && keywords.some(keyword => 
        v.name.toLowerCase().includes(keyword)
      )
    );
    
    // If no match, look for any language with the gender
    if (!voice) {
      voice = voices.find(v => 
        keywords.some(keyword => v.name.toLowerCase().includes(keyword))
      );
    }
    
    // If still no match, fallback to any English voice
    if (!voice) {
      voice = voices.find(v => v.lang.startsWith('en'));
    }
    
    // Last resort: just use the first voice
    if (!voice && voices.length > 0) {
      voice = voices[0];
    }
    
    if (voice) {
      console.log(`Selected ${gender} voice:`, voice.name);
    } else {
      console.log(`No suitable ${gender} voice found`);
    }
    
    return voice;
  }, []);

  // Function to use LMNT API for speech
  const speakWithLMNT = useCallback(async (text: string) => {
    if (!audioElement) return;
    
    try {
      console.log('Using Advanced voice for speech');
      onSpeakingChangeRef.current(true);
      
      // Notify that LMNT is loading
      if (onLmntLoadingChangeRef.current) {
        onLmntLoadingChangeRef.current(true);
      }
      
      // Stop any current playback
      audioElement.pause();
      
      // For iOS, try to unlock audio context first
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      if (isIOS) {
        try {
          // Create a short silent sound and play it to unlock audio
          const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
          const audioCtx = new AudioContext();
          const oscillator = audioCtx.createOscillator();
          oscillator.type = 'sine';
          oscillator.frequency.setValueAtTime(400, audioCtx.currentTime);
          oscillator.connect(audioCtx.destination);
          oscillator.start();
          oscillator.stop(audioCtx.currentTime + 0.01);
          
          if (audioCtx.state === 'suspended') {
            await audioCtx.resume();
          }
          
          console.log('iOS audio context unlocked for Advanced voice');
        } catch (e) {
          console.warn('Could not unlock iOS audio context:', e);
        }
      }
      
      // Call our API route
      const response = await fetch('/api/lmnt', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          text,
          voice: 'lily' // Default LMNT voice
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to generate speech with Advanced voice');
      }
      
      // Get the audio blob
      const audioBlob = await response.blob();
      
      // LMNT loading is complete
      if (onLmntLoadingChangeRef.current) {
        onLmntLoadingChangeRef.current(false);
      }
      
      // Create a URL for the blob
      const audioUrl = URL.createObjectURL(audioBlob);
      
      // Set the audio source and play
      audioElement.src = audioUrl;
      
      // For iOS, we need to handle play differently
      if (isIOS) {
        // Add event listeners for iOS
        const playHandler = () => {
          document.removeEventListener('touchend', playHandler);
          console.log('Playing audio on iOS after user interaction');
          audioElement.play().catch(e => console.error('iOS play error:', e));
        };
        
        // Try to play immediately
        const playPromise = audioElement.play();
        if (playPromise !== undefined) {
          playPromise.catch(error => {
            console.warn('iOS autoplay failed, waiting for user interaction:', error);
            // Set up listener for next user interaction
            document.addEventListener('touchend', playHandler, { once: true });
          });
        }
      } else {
        // Normal play for non-iOS devices
        const playPromise = audioElement.play();
        if (playPromise !== undefined) {
          playPromise.catch(error => {
            console.error('Error playing audio:', error);
            onSpeakingChangeRef.current(false);
          });
        }
      }
    } catch (error) {
      console.error('Advanced voice error:', error);
      onSpeakingChangeRef.current(false);
      
      // LMNT loading is complete (with error)
      if (onLmntLoadingChangeRef.current) {
        onLmntLoadingChangeRef.current(false);
      }
      
      // Fallback to browser TTS
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        try {
          console.log('Falling back to browser TTS');
          const utterance = new SpeechSynthesisUtterance(text);
          utterance.onend = () => onSpeakingChangeRef.current(false);
          utterance.onerror = () => onSpeakingChangeRef.current(false);
          window.speechSynthesis.speak(utterance);
        } catch (e) {
          console.error('Fallback TTS error:', e);
          onSpeakingChangeRef.current(false);
        }
      }
    }
  }, [audioElement]);

  // Text-to-speech function
  const speak = useCallback((text: string) => {
    // If LMNT is selected, use LMNT API
    if (preferredGender === 'lmnt') {
      speakWithLMNT(text);
      return;
    }
    
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
          
          // Try to find a voice - log all available voices for debugging
          const availableVoices = window.speechSynthesis.getVoices();
          console.log(`iOS available voices: ${availableVoices.length}`);
          if (availableVoices.length > 0) {
            console.log('iOS voices:');
            availableVoices.forEach((voice, index) => {
              console.log(`Voice ${index}: ${voice.name}, Lang: ${voice.lang}, Default: ${voice.default}`);
            });
            
            // Find voice based on gender preference for iOS
            const preferredVoice = findVoiceByGender(availableVoices, preferredGender as 'male' | 'female');
            if (preferredVoice) {
              console.log(`Using iOS ${preferredGender} voice:`, preferredVoice.name);
              iosUtterance.voice = preferredVoice;
            } else {
              // Fallback to any English voice if gender-specific not found
              const englishVoice = availableVoices.find(v => v.lang.startsWith('en'));
              if (englishVoice) {
                console.log(`Using iOS English voice:`, englishVoice.name);
                iosUtterance.voice = englishVoice;
              }
            }
          }
          
          // Basic settings - no frills
          iosUtterance.volume = 1.0;  // Maximum volume
          iosUtterance.rate = 0.9;    // Slightly slower rate for iOS
          
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
              console.log('iOS Audio context state:', audioCtx.state);
              
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
              // Check if we're still paused or pending
              const speechState = {
                paused: window.speechSynthesis.paused,
                pending: window.speechSynthesis.pending,
                speaking: window.speechSynthesis.speaking
              };
              console.log('iOS speech state after 250ms:', speechState);
              
              if (window.speechSynthesis.paused) {
                console.log('Speech synthesis was paused, resuming');
                window.speechSynthesis.resume();
              }
              
              // Force another pause/resume cycle if needed
              if (!window.speechSynthesis.speaking && window.speechSynthesis.pending) {
                console.log('Speech not started yet, trying pause/resume cycle');
                window.speechSynthesis.pause();
                setTimeout(() => window.speechSynthesis.resume(), 50);
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
        
        // Find voice based on gender preference
        const preferredVoice = findVoiceByGender(availableVoices, preferredGender as 'male' | 'female');
        
        if (preferredVoice) {
          console.log(`Using ${preferredGender} voice:`, preferredVoice.name);
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
          // More defensive error logging that works across browsers
          const errorDetails: Record<string, any> = {};
          
          // Safely extract properties
          try {
            if (event.hasOwnProperty('error')) errorDetails['error'] = event.error;
            if (event.hasOwnProperty('name')) errorDetails['name'] = event.name;
            if (event.hasOwnProperty('type')) errorDetails['type'] = event.type;
          } catch (e) {
            // If accessing properties fails, just log a simpler message
          }
          
          // Log the error with whatever details we could extract
          console.error('Speech synthesis error:', errorDetails);
          
          // Always ensure we update the speaking state
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
  }, [voices, findVoiceByGender, preferredGender, speakWithLMNT]);

  return {
    isListening,
    transcript,
    startListening,
    stopListening,
    speak,
    temporaryTranscript
  };
} 