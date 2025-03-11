'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import JarvisScene from './JarvisScene';
import useVoiceRecognition from './VoiceRecognition';

// Define a type for conversation messages
interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
}

// Welcome message that Jarvis will display and speak
const WELCOME_MESSAGE = "Hello! I'm Jarvis. How are you today?";

export default function JarvisInterface() {
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [userMessage, setUserMessage] = useState('');
  const [, setJarvisResponse] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasGreeted, setHasGreeted] = useState(false);
  
  // Conversation history
  const [conversationHistory, setConversationHistory] = useState<Message[]>([]);
  const conversationEndRef = useRef<HTMLDivElement>(null);
  
  // Track if a message has been processed
  const [messageProcessed, setMessageProcessed] = useState(false);
  const lastProcessedMessage = useRef('');
  
  // Use refs to store the speak function from the hook
  const speakRef = useRef<((text: string) => void) | null>(null);
  
  // Memoize callback functions to prevent infinite loops
  const onTranscript = useCallback((text: string) => {
    console.log("Received transcript:", text);
    if (text && text.trim()) {
      setUserMessage(text);
      setMessageProcessed(false);
    }
  }, []);
  
  const onListeningChange = useCallback((isListening: boolean) => {
    console.log("Listening state changed:", isListening);
    setIsListening(isListening);
  }, []);
  
  const onSpeakingChange = useCallback((isSpeaking: boolean) => {
    setIsSpeaking(isSpeaking);
  }, []);
  
  // Get voice recognition functions
  const { 
    startListening, 
    stopListening, 
    speak
  } = useVoiceRecognition({
    onTranscript,
    onListeningChange,
    onSpeakingChange
  });
  
  // Store the speak function in a ref
  speakRef.current = speak;
  
  // Speak welcome message when component mounts
  useEffect(() => {
    // Add a short delay to make sure the speech synthesis is initialized
    const welcomeTimer = setTimeout(() => {
      if (!hasGreeted && speakRef.current) {
        console.log("Speaking welcome message:", WELCOME_MESSAGE);
        
        // Add Jarvis welcome message to conversation history
        const assistantMsg: Message = {
          role: 'assistant',
          content: WELCOME_MESSAGE,
          timestamp: new Date()
        };
        
        setConversationHistory(prev => [...prev, assistantMsg]);
        setJarvisResponse(WELCOME_MESSAGE); // Set response so UI updates
        
        try {
          // Use a small additional delay to ensure voice synthesis is ready
          setTimeout(() => {
            if (speakRef.current) {
              speakRef.current(WELCOME_MESSAGE);
            }
          }, 500);
        } catch (error) {
          console.error("Error speaking welcome message:", error);
        }
        
        setHasGreeted(true);
      }
    }, 1500); // Increased delay for better initialization
    
    return () => clearTimeout(welcomeTimer);
  }, [hasGreeted, conversationHistory.length]);
  
  // Replacing the useEffect event handlers with direct onClick handlers
  useEffect(() => {
    if (conversationEndRef.current) {
      conversationEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [conversationHistory]);
  
  // Handle user message
  const handleUserMessage = useCallback(async (message: string) => {
    if (!message.trim() || loading || message === lastProcessedMessage.current) return;
    
    lastProcessedMessage.current = message;
    const currentMessage = message; // Store the current message to compare later
    setLoading(true);
    setError(null);
    
    // Add user message to conversation history
    const userMsg: Message = {
      role: 'user',
      content: message,
      timestamp: new Date()
    };
    
    setConversationHistory(prev => [...prev, userMsg]);
    
    try {
      // Convert conversation history to the format expected by the API
      const apiMessages = conversationHistory.map(msg => ({
        role: msg.role,
        content: msg.content
      }));
      
      // Add the current message which isn't in the history yet
      apiMessages.push({
        role: 'user',
        content: message
      });
      
      // Add system message at the beginning (it will be handled properly by the API route)
      const systemMessage = {
        role: 'system' as const,
        content: "You are Jarvis, an advanced AI assistant with a 3D visual representation. Be helpful, informative, and maintain a slightly formal but friendly tone similar to Jarvis from Iron Man."
      };
      
      // Take the most recent messages but ensure system message is included
      // We want 9 most recent messages plus the system message (10 total)
      const recentMessages = apiMessages.length > 9 
        ? apiMessages.slice(-9) 
        : apiMessages;
      
      // Combine system message with recent messages
      const limitedMessages = [systemMessage, ...recentMessages];
      
      const response = await fetch('/api/openai', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ messages: limitedMessages }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to get response from OpenAI');
      }
      
      const data = await response.json();
      
      // Extract the response text from the OpenAI API response
      // This handles both direct API calls and SDK responses
      let responseText;
      if (data.choices && data.choices[0]) {
        if (data.choices[0].message) {
          // Handle standard format (gpt-3.5-turbo)
          responseText = data.choices[0].message.content || 'Sorry, I could not process that.';
        } else if (data.choices[0].message === null && data.choices[0].content) {
          // Handle o3-mini format where content might be directly on the choice
          const content = data.choices[0].content;
          if (Array.isArray(content) && content[0] && content[0].text) {
            responseText = content[0].text;
          } else if (typeof content === 'string') {
            responseText = content;
          } else {
            responseText = 'Sorry, I could not process that.';
          }
        } else {
          // Fallback for unknown format
          responseText = 'Sorry, I could not understand the response format.';
        }
      } else {
        responseText = 'Sorry, I did not receive a proper response.';
      }
      
      // Add the assistant's response to the conversation history
      const assistantMessage: Message = {
        role: 'assistant',
        content: responseText,
        timestamp: new Date(),
      };
      
      setConversationHistory(prev => [...prev, assistantMessage]);
      setJarvisResponse(responseText);
      setMessageProcessed(true);
      
      // Clear input if the message is still the same (hasn't been changed during processing)
      if (userMessage === currentMessage) {
        setUserMessage('');
      }
      
      // Use the ref to access the speak function
      if (speakRef.current) {
        speakRef.current(responseText);
      }
      
    } catch (err) {
      console.error('Error getting response:', err);
      setError('Error communicating with Jarvis. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [loading, userMessage, conversationHistory]);

  // Process transcript when it changes
  useEffect(() => {
    // Only process messages when we have a message, it's not processed, we're not loading, and we're not currently listening
    if (userMessage && !messageProcessed && !loading && !isListening) {
      console.log("Processing user message:", userMessage);
      handleUserMessage(userMessage);
    }
  }, [userMessage, handleUserMessage, messageProcessed, loading, isListening]);

  // Handle manual text input
  const handleTextSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (userMessage.trim()) {
      console.log("Text submitted via form:", userMessage);
      setMessageProcessed(false);
      handleUserMessage(userMessage);
    }
  };

  // Handle input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUserMessage(e.target.value);
  };

  // Format timestamp
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Handle chat container click for mobile expanded state
  const handleChatContainerClick = () => {
    if (window.innerWidth < 768 && 
        document.getElementById('chat-container')?.classList.contains('chat-minimized')) {
      document.getElementById('chat-container')?.classList.remove('chat-minimized');
    }
  };

  // Effect to handle chat container toggle state
  useEffect(() => {
    const chatContainer = document.getElementById('chat-container');
    const toggleMobileBtn = document.querySelector('.mobile-toggle-btn');
    const toggleDesktopBtn = document.querySelector('.desktop-toggle-btn');
    const chatHeaderTitle = document.querySelector('.desktop-chat-header-title');
    
    if (!chatContainer || !toggleMobileBtn || !toggleDesktopBtn) return;
    
    // Mobile toggle handler
    const handleMobileToggle = (e: Event) => {
      e.stopPropagation();
      chatContainer.classList.toggle('chat-minimized');
    };
    
    // Desktop toggle handler
    const handleDesktopToggle = (e: Event) => {
      e.stopPropagation();
      chatContainer.classList.toggle('desktop-minimized');
    };
    
    // Chat container click handler (for mobile)
    const handleChatContainerClick = () => {
      if (window.innerWidth < 768 && chatContainer.classList.contains('chat-minimized')) {
        chatContainer.classList.remove('chat-minimized');
      }
    };
    
    // Add click listeners
    toggleMobileBtn.addEventListener('click', handleMobileToggle);
    toggleDesktopBtn.addEventListener('click', handleDesktopToggle);
    chatContainer.addEventListener('click', handleChatContainerClick);
    
    // Also allow clicking anywhere on the minimized chat to expand it
    if (chatHeaderTitle) {
      chatHeaderTitle.addEventListener('click', () => {
        chatContainer.classList.remove('desktop-minimized');
      });
    }
    
    return () => {
      // Cleanup listeners
      toggleMobileBtn.removeEventListener('click', handleMobileToggle);
      toggleDesktopBtn.removeEventListener('click', handleDesktopToggle);
      chatContainer.removeEventListener('click', handleChatContainerClick);
      
      if (chatHeaderTitle) {
        chatHeaderTitle.removeEventListener('click', () => {
          chatContainer.classList.remove('desktop-minimized');
        });
      }
    };
  }, []);

  return (
    <div className="flex flex-col h-screen w-full overflow-hidden relative">
      {/* Animated background elements */}
      <div className="absolute inset-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[5%] w-[40%] h-[40%] bg-gradient-radial from-[#001e4d20] to-transparent rounded-full mix-blend-overlay animate-pulse-slow"></div>
        <div className="absolute top-[60%] right-[10%] w-[30%] h-[30%] bg-gradient-radial from-[#0a142260] to-transparent rounded-full mix-blend-overlay animate-pulse-slower"></div>
      </div>
      
      {/* 3D Scene Container with explicit height and styling */}
      <div 
        className="w-full relative flex-none z-1" 
        style={{ 
          height: '60vh', 
          minHeight: '250px', 
          position: 'relative',
          zIndex: 1,
          overflow: 'hidden',
        }}
      >
        <JarvisScene isListening={isListening} isSpeaking={isSpeaking} />
        
        {/* Status Indicators - increased z-index to ensure visibility */}
        <div className="absolute top-4 right-4 flex gap-2 z-10">
          {isListening && (
            <div className="bg-blue-600/90 text-white px-3 py-1 rounded-full text-sm font-semibold animate-pulse backdrop-blur-sm shadow-lg shadow-blue-500/20">
              Listening...
            </div>
          )}
          {isSpeaking && (
            <div className="bg-blue-600/90 text-white px-3 py-1 rounded-full text-sm font-semibold backdrop-blur-sm shadow-lg shadow-blue-500/20">
              Speaking...
            </div>
          )}
          {loading && (
            <div className="bg-amber-500/90 text-white px-3 py-1 rounded-full text-sm font-semibold backdrop-blur-sm shadow-lg shadow-amber-500/20">
              Thinking...
            </div>
          )}
        </div>
        
        {/* Title Overlay - increased z-index to ensure visibility */}
        <div className="absolute top-4 left-4 z-10">
          <h1 className="text-2xl font-bold text-blue-400 drop-shadow-lg">Jarvis 3D</h1>
          <p className="text-gray-400 text-sm">Voice-Activated AI Assistant</p>
        </div>
      </div>
      
      {/* Chat Interface - Mobile Responsive */}
      <div className="flex-1 p-2 sm:p-4 flex flex-col min-h-0 relative z-1" style={{
        background: 'transparent'
      }}>
        {/* Mobile toggle button outside of chat container */}
        <button 
          onClick={() => {
            const chatContainer = document.getElementById('chat-container');
            if (chatContainer) {
              chatContainer.classList.toggle('chat-minimized');
            }
          }}
          className="md:hidden fixed bottom-16 right-4 bg-blue-600/90 text-white p-2 rounded-full z-50 shadow-lg shadow-blue-500/20 mobile-toggle-btn-outside"
          aria-label="Toggle Chat"
        >
          <span className="sr-only">Toggle Chat</span>
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        
        {/* Main chat container */}
        <div 
          id="chat-container" 
          className="chat-container flex flex-col h-full md:h-auto md:max-w-md md:absolute md:bottom-4 md:right-4 md:rounded-lg md:shadow-lg w-full"
          style={{ 
            background: 'rgba(5, 10, 20, 0.75)',
            transition: 'transform 0.3s ease, max-height 0.3s ease, opacity 0.3s ease'
          }}
          onClick={handleChatContainerClick}
        >
          {/* Mobile toggle button inside the chat container */}
          <button 
            onClick={(e) => {
              e.stopPropagation();
              const chatContainer = document.getElementById('chat-container');
              if (chatContainer) {
                chatContainer.classList.toggle('chat-minimized');
              }
            }}
            className="md:hidden absolute top-3 right-3 bg-blue-600/90 text-white p-2 rounded-full z-20 shadow-lg shadow-blue-500/20 mobile-toggle-btn"
            aria-label="Minimize Chat"
          >
            <span className="sr-only">Minimize Chat</span>
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {/* Chat expansion hint for mobile minimized state */}
          <div className="md:hidden chat-expand-hint">
            <span>Tap to chat with Jarvis</span>
          </div>
          
          {/* Desktop chat header - only visible when minimized on desktop */}
          <div className="desktop-chat-header hidden">
            <span 
              className="desktop-chat-header-title cursor-pointer"
              onClick={() => {
                const chatContainer = document.getElementById('chat-container');
                if (chatContainer) {
                  chatContainer.classList.remove('desktop-minimized');
                }
              }}
            >
              Jarvis Chat
            </span>
            <button 
              onClick={(e) => {
                e.stopPropagation();
                const chatContainer = document.getElementById('chat-container');
                if (chatContainer) {
                  chatContainer.classList.toggle('desktop-minimized');
                }
              }}
              className="desktop-header-toggle-btn text-white"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>
          
          {error && (
            <div className="bg-red-500/90 text-white p-2 mb-2 rounded backdrop-blur-sm">
              {error}
            </div>
          )}
          
          {/* Conversation History with better scrolling */}
          <div className="flex-grow overflow-y-auto mb-2 p-2 sm:p-3 rounded shadow-inner max-h-[30vh] md:max-h-[250px] bg-gray-900/30">
            {conversationHistory.length === 0 ? (
              <div className="text-gray-400 text-center py-6">
                <div className="text-3xl sm:text-5xl mb-2">👋</div>
                <div className="text-lg sm:text-xl font-medium">Hello! I&apos;m Jarvis</div>
                <div className="text-xs sm:text-sm mt-1">How can I assist you today?</div>
              </div>
            ) : (
              conversationHistory.map((msg, index) => (
                <div 
                  key={index} 
                  className={`mb-2 ${msg.role === 'user' ? 'text-right' : 'text-left'}`}
                >
                  <div 
                    className={`inline-block max-w-[85%] px-3 py-1.5 rounded-lg shadow-md text-sm ${
                      msg.role === 'user' 
                        ? 'bg-blue-600/90 text-white rounded-tr-none' 
                        : 'bg-gray-800/90 text-blue-300 rounded-tl-none'
                    }`}
                  >
                    <div className="text-xs font-medium mb-0.5">
                      {msg.role === 'user' ? 'You' : 'Jarvis'} • {formatTime(msg.timestamp)}
                    </div>
                    <div className="whitespace-pre-wrap text-sm">{msg.content}</div>
                  </div>
                </div>
              ))
            )}
            <div ref={conversationEndRef} />
          </div>
          
          {/* Input Area - Compact for Mobile */}
          <div className="flex gap-1 sm:gap-2">
            <button
              onClick={isListening ? stopListening : startListening}
              className={`flex items-center justify-center px-2 sm:px-4 py-2 rounded-full ${
                isListening 
                  ? 'bg-red-600 text-white' 
                  : 'bg-blue-600 text-white'
              }`}
              disabled={loading}
            >
              {isListening ? (
                <>
                  <span className="hidden sm:inline mr-1">Stop</span>
                  <span className="sr-only">Stop listening</span>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 001-1V8a1 1 0 00-1-1H8z" />
                  </svg>
                </>
              ) : (
                <>
                  <span className="hidden sm:inline mr-1">Talk</span>
                  <span className="sr-only">Start listening</span>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" />
                  </svg>
                </>
              )}
            </button>
            
            <form onSubmit={handleTextSubmit} className="flex-1 flex gap-1">
              <input
                type="text"
                placeholder="Type your message..."
                className="flex-1 py-2 px-3 bg-gray-800/70 text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={userMessage}
                onChange={handleInputChange}
                disabled={loading || isListening}
              />
              <button
                type="submit"
                className="bg-blue-600 text-white p-2 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={loading || !userMessage.trim() || isListening}
              >
                <span className="sr-only">Send message</span>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 012 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
                </svg>
              </button>
            </form>
          </div>
          
          {/* Loading state indicator */}
          {loading && (
            <div className="absolute inset-0 bg-gray-900/50 backdrop-blur-sm flex items-center justify-center">
              <div className="text-center">
                <div className="animate-spin h-10 w-10 border-t-2 border-b-2 border-blue-500 rounded-full mx-auto mb-3"></div>
                <p className="text-blue-400">Jarvis is thinking...</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 