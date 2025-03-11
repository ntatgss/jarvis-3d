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
      
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'en-US';
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;
      
      // Improved voice selection with better logging
      const availableVoices = voices.length > 0 ? voices : window.speechSynthesis.getVoices();
      console.log(`Available voices: ${availableVoices.length}`);
      
      // Try to find a good voice with more fallbacks
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
        // Last resort: use the first available voice
        console.log('Using default voice:', availableVoices[0].name);
        utterance.voice = availableVoices[0];
      } else {
        console.log('No voices available, using browser default');
      }
      
      utterance.onend = () => {
        console.log('Speech ended');
        onSpeakingChangeRef.current(false);
      };
      
      utterance.onerror = (event) => {
        // Improved error logging with more details
        console.error('Speech synthesis error:', {
          error: event.error,
          name: event.name,
          timeStamp: event.timeStamp,
          type: event.type
        });
        onSpeakingChangeRef.current(false);
      };
      
      // Cancel any previous speech
      window.speechSynthesis.cancel();
      
      // Check if synthesis is paused (common Chrome issue)
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
      }
      
      // Then speak the new text with better error handling
      setTimeout(() => {
        try {
          window.speechSynthesis.speak(utterance);
        } catch (e) {
          console.error('Error during speak call:', e);
          onSpeakingChangeRef.current(false);
        }
      }, 250); // Longer timeout to ensure cancel completes
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