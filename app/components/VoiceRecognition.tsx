'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

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
  const [recognition, setRecognition] = useState<any>(null);
  const [temporaryTranscript, setTemporaryTranscript] = useState('');
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  
  // Use refs to store the callback functions
  const onTranscriptRef = useRef(onTranscript);
  const onListeningChangeRef = useRef(onListeningChange);
  const onSpeakingChangeRef = useRef(onSpeakingChange);
  const pauseTimerRef = useRef<NodeJS.Timeout | null>(null);
  
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
      const SpeechRecognition = (window as any).SpeechRecognition || 
                               (window as any).webkitSpeechRecognition;
      
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
          
          recognitionInstance.onresult = (event: any) => {
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
          
          recognitionInstance.onerror = (event: any) => {
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
        } catch (e) {
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
        } catch (e) {
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
      
      // Try to find a good voice from our stored voices
      const availableVoices = voices.length > 0 ? voices : window.speechSynthesis.getVoices();
      const preferredVoice = availableVoices.find(voice => 
        voice.name.includes('Google') || voice.name.includes('English') || voice.name.includes('Male')
      );
      
      if (preferredVoice) {
        console.log('Using voice:', preferredVoice.name);
        utterance.voice = preferredVoice;
      }
      
      utterance.onend = () => {
        console.log('Speech ended');
        onSpeakingChangeRef.current(false);
      };
      
      utterance.onerror = (event) => {
        console.error('Speech synthesis error:', event);
        onSpeakingChangeRef.current(false);
      };
      
      // Cancel any previous speech
      window.speechSynthesis.cancel();
      
      // Then speak the new text
      setTimeout(() => {
        window.speechSynthesis.speak(utterance);
      }, 100);
    } else {
      console.error('Speech synthesis not supported in this browser');
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