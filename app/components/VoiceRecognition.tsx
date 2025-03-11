'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { isMobileDevice, isIOSDevice, supportsSpeechSynthesis } from '../utils/deviceDetection';
import { callLMNT } from '../utils/apiUtils';
import { 
  DISABLE_LMNT_ON_MOBILE, 
  DEFAULT_LMNT_VOICE,
  FETCH_TIMEOUT
} from '../utils/config';

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

  // LMNT speech function
  const speakWithLMNT = useCallback(async (text: string) => {
    if (!audioElement) return;
    
    // Detect iOS devices using our utility
    const isIOS = isIOSDevice();
    
    console.log('Speaking with LMNT:', text);
    onSpeakingChangeRef.current(true);
    
    // Signal that LMNT is loading
    if (onLmntLoadingChangeRef.current) {
      onLmntLoadingChangeRef.current(true);
    }
    
    try {
      console.log('Using Advanced voice for speech');
      
      // Stop any current playback
      audioElement.pause();
      
      // For mobile devices, try to unlock audio context first
      const isMobile = isMobileDevice();
      
      if (isMobile) {
        try {
          console.log('Attempting to unlock audio on mobile device');
          
          // Create a short silent sound and play it to unlock audio
          const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
          const audioCtx = new AudioContext();
          console.log('Mobile audio context state:', audioCtx.state);
          
          const oscillator = audioCtx.createOscillator();
          oscillator.type = 'sine';
          oscillator.frequency.setValueAtTime(400, audioCtx.currentTime);
          oscillator.connect(audioCtx.destination);
          oscillator.start();
          oscillator.stop(audioCtx.currentTime + 0.01);
          
          if (audioCtx.state === 'suspended') {
            await audioCtx.resume();
            console.log('Resumed audio context, new state:', audioCtx.state);
          }
          
          // For iOS, we need an additional step with user interaction
          if (isIOS) {
            // Create a temporary button for user interaction
            const tempButton = document.createElement('button');
            tempButton.style.position = 'fixed';
            tempButton.style.top = '0';
            tempButton.style.left = '0';
            tempButton.style.width = '100%';
            tempButton.style.height = '100%';
            tempButton.style.backgroundColor = 'rgba(0,0,0,0.01)';
            tempButton.style.zIndex = '9999';
            tempButton.style.border = 'none';
            tempButton.style.outline = 'none';
            tempButton.style.cursor = 'pointer';
            tempButton.textContent = 'Tap to enable audio';
            
            // Add click handler to unlock audio
            const clickHandler = () => {
              document.body.removeChild(tempButton);
              audioCtx.resume().then(() => {
                console.log('iOS audio context resumed after user interaction');
              });
            };
            
            tempButton.addEventListener('click', clickHandler, { once: true });
            document.body.appendChild(tempButton);
            
            // Auto-remove after 5 seconds if not clicked
            setTimeout(() => {
              if (document.body.contains(tempButton)) {
                document.body.removeChild(tempButton);
              }
            }, 5000);
          }
          
          console.log('Mobile audio context initialized');
        } catch (e) {
          console.warn('Could not unlock mobile audio context:', e);
        }
      }
      
      try {
        // Start a timer to measure response time
        const startTime = performance.now();
        
        // Use our utility function to call the LMNT API
        const audioBuffer = await callLMNT(text, DEFAULT_LMNT_VOICE, { timeout: FETCH_TIMEOUT });
        
        // Log response time for analytics
        const responseTime = performance.now() - startTime;
        console.log(`LMNT API response time: ${responseTime.toFixed(0)}ms`);
        
        // LMNT loading is complete
        if (onLmntLoadingChangeRef.current) {
          onLmntLoadingChangeRef.current(false);
        }
        
        // Create a URL for the blob
        const audioBlob = new Blob([audioBuffer], { type: 'audio/mpeg' });
        const audioUrl = URL.createObjectURL(audioBlob);
        
        // Set the audio source
        audioElement.src = audioUrl;
        audioElement.load(); // Important for mobile
        
        // Preload the audio
        audioElement.preload = 'auto';
        
        // For mobile devices, we need special handling
        if (isMobile) {
          console.log('Setting up mobile audio playback');
          
          // Set up event listeners
          audioElement.oncanplaythrough = () => {
            console.log('Audio can play through, attempting playback');
            const playPromise = audioElement.play();
            if (playPromise !== undefined) {
              playPromise.then(() => {
                console.log('Mobile audio playback started successfully');
              }).catch(error => {
                console.warn('Mobile autoplay failed, waiting for user interaction:', error);
                
                // Create a play button that follows iOS rules
                const playButton = document.createElement('button');
                playButton.innerText = 'Tap to Play Voice';
                playButton.style.position = 'fixed';
                playButton.style.bottom = '20px';
                playButton.style.left = '50%';
                playButton.style.transform = 'translateX(-50%)';
                playButton.style.zIndex = '9999';
                playButton.style.padding = '10px 20px';
                playButton.style.backgroundColor = '#0066ff';
                playButton.style.color = 'white';
                playButton.style.border = 'none';
                playButton.style.borderRadius = '20px';
                playButton.style.boxShadow = '0 2px 10px rgba(0,0,0,0.2)';
                
                playButton.onclick = () => {
                  audioElement.play().then(() => {
                    document.body.removeChild(playButton);
                  }).catch(e => {
                    console.error('Play failed even with user interaction:', e);
                    document.body.removeChild(playButton);
                    onSpeakingChangeRef.current(false);
                  });
                };
                
                document.body.appendChild(playButton);
                
                // Auto-remove after 10 seconds
                setTimeout(() => {
                  if (document.body.contains(playButton)) {
                    document.body.removeChild(playButton);
                    onSpeakingChangeRef.current(false);
                  }
                }, 10000);
              });
            }
          };
          
          // Handle errors
          audioElement.onerror = (e) => {
            console.error('Mobile audio error:', e);
            onSpeakingChangeRef.current(false);
          };
        } else {
          // For desktop, just play
          audioElement.play().catch(e => {
            console.error('Desktop audio playback error:', e);
            onSpeakingChangeRef.current(false);
          });
        }
      } catch (e) {
        console.error('Error fetching LMNT speech:', e);
        
        // LMNT loading failed
        if (onLmntLoadingChangeRef.current) {
          onLmntLoadingChangeRef.current(false);
        }
        
        // Fall back to browser TTS
        console.log('Falling back to browser TTS');
        try {
          const utterance = new SpeechSynthesisUtterance(text);
          
          // Find a good voice
          const voices = window.speechSynthesis.getVoices();
          const englishVoice = voices.find(v => v.lang.startsWith('en'));
          if (englishVoice) {
            utterance.voice = englishVoice;
          }
          
          // Set up event listeners
          utterance.onend = () => {
            onSpeakingChangeRef.current(false);
          };
          
          utterance.onerror = () => {
            console.error('Fallback TTS error');
            onSpeakingChangeRef.current(false);
          };
          
          utterance.volume = 1.0;
          utterance.rate = 0.9;
          
          window.speechSynthesis.speak(utterance);
        } catch (e) {
          console.error('Fallback TTS error:', e);
          onSpeakingChangeRef.current(false);
        }
      }
    } catch (e) {
      console.error('LMNT speech error:', e);
      onSpeakingChangeRef.current(false);
      
      // LMNT loading failed
      if (onLmntLoadingChangeRef.current) {
        onLmntLoadingChangeRef.current(false);
      }
    }
  }, [audioElement]);

  // Helper function to get iOS voices by gender
  const getIOSVoiceByGender = useCallback((gender: 'male' | 'female') => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return null;
    
    // Force load voices
    const voices = window.speechSynthesis.getVoices();
    console.log(`Getting iOS ${gender} voice from ${voices.length} voices`);
    
    // iOS has specific voice names we can target
    if (gender === 'male') {
      // First try to find specific male voices by name
      const maleVoices = [
        'Daniel', 'Alex', 'Fred', 'Tom', 'Arthur', 'Aaron', 'Albert', 'Bruce',
        'Male', 'Guy', 'en-US-ArrowNeural', 'en-GB-RyanNeural'
      ];
      
      // Try each male voice name
      for (const maleName of maleVoices) {
        const voice = voices.find(v => 
          v.name.toLowerCase().includes(maleName.toLowerCase())
        );
        if (voice) {
          console.log(`Found iOS male voice: ${voice.name}`);
          return voice;
        }
      }
    } else {
      // First try to find specific female voices by name
      const femaleVoices = [
        'Samantha', 'Karen', 'Moira', 'Tessa', 'Veena', 'Victoria', 'Fiona',
        'Female', 'Woman', 'en-US-JennyNeural', 'en-GB-SoniaNeural'
      ];
      
      // Try each female voice name
      for (const femaleName of femaleVoices) {
        const voice = voices.find(v => 
          v.name.toLowerCase().includes(femaleName.toLowerCase())
        );
        if (voice) {
          console.log(`Found iOS female voice: ${voice.name}`);
          return voice;
        }
      }
    }
    
    // If no specific voice found, try to find any English voice
    const englishVoice = voices.find(v => v.lang.startsWith('en'));
    if (englishVoice) {
      console.log(`Using generic English voice for ${gender}: ${englishVoice.name}`);
      return englishVoice;
    }
    
    // Last resort: use any available voice
    if (voices.length > 0) {
      console.log(`Using first available voice for ${gender}: ${voices[0].name}`);
      return voices[0];
    }
    
    return null;
  }, []);

  // Text-to-speech function
  const speak = useCallback((text: string) => {
    // Detect mobile devices using our utility
    const isMobile = isMobileDevice();
    
    // If LMNT is selected AND not on mobile, use LMNT API
    if (preferredGender === 'lmnt' && !isMobile) {
      speakWithLMNT(text);
      return;
    }
    
    if (supportsSpeechSynthesis()) {
      console.log('Speaking with browser TTS:', text, 'Preferred gender:', preferredGender);
      onSpeakingChangeRef.current(true);
      
      // Simple browser detection - only care about iOS
      const isIOS = isIOSDevice();
      
      // Force load voices if needed
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        // Force load voices
        window.speechSynthesis.getVoices();
      }
      
      const utterance = new SpeechSynthesisUtterance(text);
      
      // For iOS, we need special handling
      if (isIOS) {
        console.log('iOS detected, using special voice handling');
        
        // Force a specific voice for each gender on iOS
        const genderToUse = preferredGender === 'lmnt' ? 'female' : preferredGender;
        console.log('Using gender on iOS:', genderToUse);
        
        // Set voice properties based on gender
        if (genderToUse === 'male') {
          // Force male voice characteristics
          utterance.pitch = 0.7;  // Lower pitch for male voice
          utterance.rate = 0.9;   // Slightly slower rate
        } else {
          // Force female voice characteristics
          utterance.pitch = 1.2;  // Higher pitch for female voice
          utterance.rate = 1.0;   // Normal rate
        }
        
        // Use our helper to find the best voice
        const selectedVoice = getIOSVoiceByGender(genderToUse);
        if (selectedVoice) {
          console.log(`Using iOS ${genderToUse} voice:`, selectedVoice.name);
          utterance.voice = selectedVoice;
        }
        
        // Set volume to maximum
        utterance.volume = 1.0;
      } else {
        // NON-iOS BROWSERS
        const availableVoices = voices.length > 0 ? voices : window.speechSynthesis.getVoices();
        console.log(`Available voices: ${availableVoices.length}`);
        
        // Find voice based on gender preference
        // If we were using LMNT but on mobile, default to female voice
        const genderToUse = preferredGender === 'lmnt' ? 'female' : preferredGender;
        const preferredVoice = findVoiceByGender(availableVoices, genderToUse as 'male' | 'female');
        
        if (preferredVoice) {
          console.log(`Using ${genderToUse} voice:`, preferredVoice.name);
          utterance.voice = preferredVoice;
        } else if (availableVoices.length > 0) {
          console.log('Using default voice:', availableVoices[0].name);
          utterance.voice = availableVoices[0];
        }
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
    } else {
      console.error('Speech synthesis not supported in this browser');
      onSpeakingChangeRef.current(false);
    }
  }, [voices, findVoiceByGender, preferredGender, speakWithLMNT, getIOSVoiceByGender]);

  return {
    isListening,
    transcript,
    startListening,
    stopListening,
    speak,
    temporaryTranscript
  };
} 