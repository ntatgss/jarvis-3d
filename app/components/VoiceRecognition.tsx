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

  // LMNT speech function
  const speakWithLMNT = useCallback(async (text: string) => {
    if (!audioElement) return;
    
    // Detect iOS devices
    const isIOS = typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    
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
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      
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
      
      // Call our API route with a longer timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
      
      try {
        const response = await fetch('/api/lmnt', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ 
            text,
            voice: 'lily' // Default LMNT voice
          }),
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          throw new Error(`Failed to generate speech with Advanced voice: ${response.status}`);
        }
        
        // Get the audio blob
        const audioBlob = await response.blob();
        
        // LMNT loading is complete
        if (onLmntLoadingChangeRef.current) {
          onLmntLoadingChangeRef.current(false);
        }
        
        // Create a URL for the blob
        const audioUrl = URL.createObjectURL(audioBlob);
        
        // Set the audio source
        audioElement.src = audioUrl;
        audioElement.load(); // Important for mobile
        
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
          
          // Handle completion
          audioElement.onended = () => {
            console.log('Mobile audio playback completed');
            onSpeakingChangeRef.current(false);
          };
        } else {
          // Normal play for desktop devices
          const playPromise = audioElement.play();
          if (playPromise !== undefined) {
            playPromise.catch(error => {
              console.error('Error playing audio:', error);
              onSpeakingChangeRef.current(false);
            });
          }
        }
      } catch (fetchError) {
        clearTimeout(timeoutId);
        throw fetchError;
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
          
          // For iOS, we need to use a different voice
          if (isIOS) {
            // Get available voices
            const voices = window.speechSynthesis.getVoices();
            // Try to find an English voice
            const englishVoice = voices.find(v => v.lang.startsWith('en'));
            if (englishVoice) {
              utterance.voice = englishVoice;
            }
          }
          
          utterance.onend = () => onSpeakingChangeRef.current(false);
          utterance.onerror = () => onSpeakingChangeRef.current(false);
          
          // Set a volume and rate that works well on mobile
          utterance.volume = 1.0;
          utterance.rate = 0.9;
          
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
      const isIOS = typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
      
      const utterance = new SpeechSynthesisUtterance(text);
      
      // For iOS, we need to use a different voice
      if (isIOS) {
        // Get available voices
        const voices = window.speechSynthesis.getVoices();
        // Try to find an English voice
        const englishVoice = voices.find(v => v.lang.startsWith('en'));
        if (englishVoice) {
          utterance.voice = englishVoice;
        }
      } else if (preferredGender === 'male') {
        // NON-iOS BROWSERS
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