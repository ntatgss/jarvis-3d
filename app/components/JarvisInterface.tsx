"use client"

import type React from "react"
import { useState, useCallback, useRef, useEffect } from "react"
import JarvisScene from "./JarvisScene"
import useVoiceRecognition from "./VoiceRecognition"
import { Mic, MicOff, Send, UserIcon as Male, UserIcon as Female, X, Maximize, Minimize } from "lucide-react"

// Define a type for conversation messages
interface Message {
  role: "user" | "assistant" | "system"
  content: string
  timestamp: Date
}

// Component to help initialize audio on iOS
const IOSAudioUnlock = () => {
  const [isIOS, setIsIOS] = useState(false)
  const [audioUnlocked, setAudioUnlocked] = useState(false)

  useEffect(() => {
    // Check if this is iOS
    if (typeof navigator !== "undefined") {
      const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent)
      setIsIOS(isIOSDevice)
    }
  }, [])

  const unlockAudio = () => {
    if (typeof window !== "undefined") {
      try {
        // Create and play a silent audio context
        const AudioContext = window.AudioContext || (window as any).webkitAudioContext
        const audioCtx = new AudioContext()
        console.log("iOS audio context state:", audioCtx.state)

        // Create a silent oscillator
        const oscillator = audioCtx.createOscillator()
        oscillator.type = "sine"
        oscillator.frequency.setValueAtTime(400, audioCtx.currentTime)

        // Connect to audio output
        oscillator.connect(audioCtx.destination)

        // Play for a very short time
        oscillator.start()
        oscillator.stop(audioCtx.currentTime + 0.01)

        // Resume audio context if suspended
        if (audioCtx.state === "suspended") {
          audioCtx.resume()
        }

        // Also unblock speech synthesis
        if (window.speechSynthesis) {
          // Create a short utterance
          const unblockUtterance = new SpeechSynthesisUtterance("")
          unblockUtterance.volume = 0 // Silent
          unblockUtterance.rate = 1
          window.speechSynthesis.speak(unblockUtterance)
        }

        console.log("iOS audio unlocked")
        setAudioUnlocked(true)
      } catch (e) {
        console.error("Error unlocking iOS audio:", e)
      }
    }
  }

  if (!isIOS || audioUnlocked) return null

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 bg-black/80 text-white px-4 py-3 rounded-xl shadow-lg z-50 backdrop-blur-sm">
      <button
        onClick={unlockAudio}
        className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg font-medium transition-colors"
      >
        Enable Jarvis Voice
      </button>
    </div>
  )
}

// No welcome message - user will start first
// const WELCOME_MESSAGE = "Hello! I'm Jarvis. How are you today?";

export default function JarvisInterface() {
  const [isListening, setIsListening] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [userMessage, setUserMessage] = useState("")
  const [, setJarvisResponse] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasGreeted, setHasGreeted] = useState(true) // Set to true to prevent greeting
  const [voiceGender, setVoiceGender] = useState<"male" | "female" | "lmnt">("male") // Default to male voice
  const [isChatMinimized, setIsChatMinimized] = useState(false)
  const [isLmntLoading, setIsLmntLoading] = useState(false) // New state for LMNT loading

  // Conversation history
  const [conversationHistory, setConversationHistory] = useState<Message[]>([])
  const conversationEndRef = useRef<HTMLDivElement>(null)

  // Track if a message has been processed
  const [messageProcessed, setMessageProcessed] = useState(false)
  const lastProcessedMessage = useRef("")

  // Use refs to store the speak function from the hook
  const speakRef = useRef<((text: string) => void) | null>(null)

  // Memoize callback functions to prevent infinite loops
  const onTranscript = useCallback((text: string) => {
    console.log("Received transcript:", text)
    if (text && text.trim()) {
      setUserMessage(text)
      setMessageProcessed(false)
    }
  }, [])

  const onListeningChange = useCallback((isListening: boolean) => {
    console.log("Listening state changed:", isListening)
    setIsListening(isListening)
  }, [])

  const onSpeakingChange = useCallback((isSpeaking: boolean) => {
    setIsSpeaking(isSpeaking)
  }, [])

  // Get voice recognition functions with gender preference
  const { startListening, stopListening, speak } = useVoiceRecognition({
    onTranscript,
    onListeningChange,
    onSpeakingChange,
    preferredGender: voiceGender,
    onLmntLoadingChange: (isLoading) => setIsLmntLoading(isLoading), // New callback
  })

  // Store the speak function in a ref
  speakRef.current = speak

  // Auto-scroll to bottom of conversation
  useEffect(() => {
    if (conversationEndRef.current) {
      conversationEndRef.current.scrollIntoView({ behavior: "smooth" })
    }
  }, [conversationHistory])

  // Handle user message
  const handleUserMessage = useCallback(
    async (message: string) => {
      if (!message.trim() || loading || message === lastProcessedMessage.current) return

      lastProcessedMessage.current = message
      const currentMessage = message // Store the current message to compare later
      setLoading(true)
      setError(null)

      // Add user message to conversation history
      const userMsg: Message = {
        role: "user",
        content: message,
        timestamp: new Date(),
      }

      setConversationHistory((prev) => [...prev, userMsg])

      try {
        // Convert conversation history to the format expected by the API
        const apiMessages = conversationHistory.map((msg) => ({
          role: msg.role,
          content: msg.content,
        }))

        // Add the current message which isn't in the history yet
        apiMessages.push({
          role: "user",
          content: message,
        })

        // Add system message at the beginning (it will be handled properly by the API route)
        const systemMessage = {
          role: "system" as const,
          content:
            "You are Jarvis, an advanced AI assistant with a 3D visual representation. Be helpful, informative, and maintain a slightly formal but friendly tone similar to Jarvis from Iron Man.",
        }

        // Take the most recent messages but ensure system message is included
        // We want 9 most recent messages plus the system message (10 total)
        const recentMessages = apiMessages.length > 9 ? apiMessages.slice(-9) : apiMessages

        // Combine system message with recent messages
        const limitedMessages = [systemMessage, ...recentMessages]

        const response = await fetch("/api/openai", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ messages: limitedMessages }),
        })

        if (!response.ok) {
          throw new Error("Failed to get response from OpenAI")
        }

        const data = await response.json()

        // Extract the response text from the OpenAI API response
        // This handles both direct API calls and SDK responses
        let responseText
        if (data.choices && data.choices[0]) {
          if (data.choices[0].message) {
            // Handle standard format (gpt-3.5-turbo)
            responseText = data.choices[0].message.content || "Sorry, I could not process that."
          } else if (data.choices[0].message === null && data.choices[0].content) {
            // Handle o3-mini format where content might be directly on the choice
            const content = data.choices[0].content
            if (Array.isArray(content) && content[0] && content[0].text) {
              responseText = content[0].text
            } else if (typeof content === "string") {
              responseText = content
            } else {
              responseText = "Sorry, I could not process that."
            }
          } else {
            // Fallback for unknown format
            responseText = "Sorry, I could not understand the response format."
          }
        } else {
          responseText = "Sorry, I did not receive a proper response."
        }

        // Add the assistant's response to the conversation history
        const assistantMessage: Message = {
          role: "assistant",
          content: responseText,
          timestamp: new Date(),
        }

        setConversationHistory((prev) => [...prev, assistantMessage])
        setJarvisResponse(responseText)
        setMessageProcessed(true)

        // Clear input if the message is still the same (hasn't been changed during processing)
        if (userMessage === currentMessage) {
          setUserMessage("")
        }

        // Use the ref to access the speak function
        if (speakRef.current) {
          speakRef.current(responseText)
        }
      } catch (err) {
        console.error("Error getting response:", err)
        setError("Error communicating with Jarvis. Please try again.")
      } finally {
        setLoading(false)
      }
    },
    [loading, userMessage, conversationHistory],
  )

  // Process transcript when it changes
  useEffect(() => {
    // Only process messages when we have a message, it's not processed, we're not loading, and we're not currently listening
    if (userMessage && !messageProcessed && !loading && !isListening) {
      console.log("Processing user message:", userMessage)
      handleUserMessage(userMessage)
    }
  }, [userMessage, handleUserMessage, messageProcessed, loading, isListening])

  // Handle manual text input
  const handleTextSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (userMessage.trim()) {
      console.log("Text submitted via form:", userMessage)
      setMessageProcessed(false)
      handleUserMessage(userMessage)
    }
  }

  // Handle input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUserMessage(e.target.value)
  }

  // Format timestamp
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  }

  // Toggle voice gender
  const toggleVoiceGender = useCallback(() => {
    setVoiceGender((prev) => {
      if (prev === "male") return "female"
      if (prev === "female") return "lmnt"
      return "male"
    })
    console.log(`Voice gender switched to ${voiceGender === "male" ? "female" : voiceGender === "female" ? "lmnt" : "male"}`)
  }, [voiceGender])

  // Toggle chat minimized state
  const toggleChatMinimized = () => {
    setIsChatMinimized(!isChatMinimized)
  }

  return (
    <div className="flex flex-col h-screen w-full overflow-hidden relative bg-gradient-to-b from-gray-900 to-black">
      <IOSAudioUnlock />

      {/* Animated background elements */}
      <div className="absolute inset-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[5%] w-[40%] h-[40%] bg-gradient-radial from-blue-900/20 to-transparent rounded-full mix-blend-overlay animate-pulse-slow"></div>
        <div className="absolute top-[60%] right-[10%] w-[30%] h-[30%] bg-gradient-radial from-indigo-900/20 to-transparent rounded-full mix-blend-overlay animate-pulse-slower"></div>
        <div className="absolute bottom-[20%] left-[20%] w-[25%] h-[25%] bg-gradient-radial from-cyan-900/10 to-transparent rounded-full mix-blend-overlay animate-pulse"></div>
      </div>

      {/* Title Overlay - moved to higher z-index and positioned absolutely */}
      <div className="absolute top-0 left-0 right-0 z-30 p-4 md:p-0 md:top-4 md:left-4 md:right-auto">
        <div className="max-w-[280px] mx-auto md:mx-0">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-cyan-300 bg-clip-text text-transparent drop-shadow-md">
            Jarvis AI
          </h1>
          <p className="text-gray-400 text-sm">Voice-Activated Assistant</p>

          {/* Voice gender toggle */}
          <button
            onClick={toggleVoiceGender}
            className="mt-2 w-full md:w-auto bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 shadow-lg transition-all duration-300 justify-center md:justify-start"
            title={`Switch to ${voiceGender === "male" ? "female" : voiceGender === "female" ? "Advanced" : "male"} voice`}
          >
            {voiceGender === "male" ? <Male className="w-3.5 h-3.5" /> : 
             voiceGender === "female" ? <Female className="w-3.5 h-3.5" /> : 
             <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-3.5 h-3.5">
               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
             </svg>}
            <span>{voiceGender === "male" ? "Male Voice" : voiceGender === "female" ? "Female Voice" : "Advanced Voice (Lily)"}</span>
          </button>

          {/* LMNT voice info - only show when LMNT is selected */}
          {voiceGender === "lmnt" && (
            <div className="mt-2 text-xs text-gray-400 max-w-[280px]">
              Advanced voice provides high-quality AI voice synthesis. Generation may take a moment.
            </div>
          )}

          {/* Test voice button */}
          {!hasGreeted && !isListening && !isSpeaking && !loading && (
            <button
              onClick={() => {
                if (speakRef.current) {
                  console.log("Testing Jarvis voice...")
                  try {
                    speakRef.current(`Jarvis voice system test with ${voiceGender} voice. I am now online.`)
                  } catch (error) {
                    console.error("Error in test speech:", error)
                  }
                }
              }}
              className="mt-2 w-full md:w-auto bg-gradient-to-r from-green-600 to-green-500 hover:from-green-500 hover:to-green-400 text-white px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 shadow-lg transition-all duration-300 justify-center md:justify-start"
            >
              Test Voice
            </button>
          )}
        </div>
      </div>

      {/* 3D Scene Container - adjusted to be centered vertically */}
      <div
        className="w-full relative flex-none z-10 flex items-center justify-center"
        style={{
          height: "45vh", // Reduced from 55vh to give more space for chat on mobile
          minHeight: "200px", // Reduced from 250px
          marginTop: "calc(80px + 1rem)", // Account for title height on mobile
          marginBottom: "0.5rem", // Reduced from 1rem
        }}
      >
        <JarvisScene isListening={isListening} isSpeaking={isSpeaking} />

        {/* Status Indicators - moved to top center for better visibility */}
        <div className="absolute top-0 left-1/2 transform -translate-x-1/2 flex gap-2 z-20 mt-4 md:mt-0">
          {isListening && (
            <div className="bg-gradient-to-r from-blue-600 to-blue-500 text-white px-4 py-2 rounded-full text-sm font-medium animate-pulse backdrop-blur-sm shadow-lg shadow-blue-500/20 flex items-center gap-2">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-white"></span>
              </span>
              Listening
            </div>
          )}
          {isSpeaking && (
            <div className="bg-gradient-to-r from-indigo-600 to-indigo-500 text-white px-4 py-2 rounded-full text-sm font-medium backdrop-blur-sm shadow-lg shadow-indigo-500/20 flex items-center gap-2">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-white"></span>
              </span>
              {voiceGender === "lmnt" && isLmntLoading ? "Generating Advanced Voice" : "Speaking"}
            </div>
          )}
          {loading && (
            <div className="bg-gradient-to-r from-amber-600 to-amber-500 text-white px-4 py-2 rounded-full text-sm font-medium backdrop-blur-sm shadow-lg shadow-amber-500/20 flex items-center gap-2">
              <svg
                className="animate-spin h-4 w-4 text-white"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
              Thinking
            </div>
          )}
        </div>
      </div>

      {/* Chat Interface */}
      <div className="flex-1 p-4 flex flex-col min-h-0 relative z-10">
        {/* Mobile toggle button (visible when minimized) */}
        {isChatMinimized && (
          <button
            onClick={toggleChatMinimized}
            className="md:hidden fixed bottom-6 right-6 bg-gradient-to-r from-blue-600 to-blue-500 text-white p-3 rounded-full z-50 shadow-lg"
            aria-label="Open Chat"
          >
            <Maximize className="w-5 h-5" />
          </button>
        )}

        {/* Main chat container */}
        <div
          className={`transition-all duration-300 ease-in-out ${
            isChatMinimized ? "md:max-w-[300px] md:h-[50px] md:overflow-hidden" : "md:max-w-md md:h-auto"
          } bg-gray-900/80 backdrop-blur-md rounded-xl shadow-xl border border-gray-800 w-full md:absolute md:bottom-4 md:right-4 flex flex-col ${
            isChatMinimized && "md:cursor-pointer"
          }`}
          onClick={() => {
            if (isChatMinimized) {
              toggleChatMinimized()
            }
          }}
        >
          {/* Chat header */}
          <div className="flex items-center justify-between p-3 border-b border-gray-800">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-500"></div>
              <h2 className="font-medium text-gray-200">Jarvis Chat</h2>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation()
                toggleChatMinimized()
              }}
              className="text-gray-400 hover:text-white transition-colors"
              aria-label={isChatMinimized ? "Expand Chat" : "Minimize Chat"}
            >
              {isChatMinimized ? <Maximize className="w-4 h-4" /> : <Minimize className="w-4 h-4" />}
            </button>
          </div>

          {!isChatMinimized && (
            <>
              {/* Error message */}
              {error && (
                <div className="bg-red-500/90 text-white p-3 m-3 rounded-lg backdrop-blur-sm">
                  <div className="flex items-center gap-2">
                    <X className="w-4 h-4" />
                    <span>{error}</span>
                  </div>
                </div>
              )}

              {/* Conversation History - reduced max height on mobile */}
              <div className="flex-grow overflow-y-auto p-3 space-y-3 max-h-[25vh] md:max-h-[300px] scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent">
                {conversationHistory.length === 0 ? (
                  <div className="text-gray-400 text-center py-8 flex flex-col items-center justify-center h-full">
                    <div className="text-5xl mb-3">👋</div>
                    <div className="text-xl font-medium text-gray-300">Hello! I'm Jarvis</div>
                    <div className="text-sm mt-1 max-w-xs">
                      Ask me anything or use the microphone button to speak with me
                    </div>
                  </div>
                ) : (
                  conversationHistory.map((msg, index) => (
                    <div key={index} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                      <div
                        className={`max-w-[85%] px-4 py-2 rounded-2xl shadow-md ${
                          msg.role === "user"
                            ? "bg-gradient-to-r from-blue-600 to-blue-500 text-white rounded-tr-none"
                            : "bg-gray-800 text-gray-200 rounded-tl-none border border-gray-700"
                        }`}
                      >
                        <div className="text-xs font-medium mb-1 flex justify-between items-center gap-2">
                          <span>{msg.role === "user" ? "You" : "Jarvis"}</span>
                          <span className="text-gray-400">{formatTime(msg.timestamp)}</span>
                        </div>
                        <div className="whitespace-pre-wrap text-sm">{msg.content}</div>
                      </div>
                    </div>
                  ))
                )}
                <div ref={conversationEndRef} />
              </div>

              {/* Input Area - improved for mobile */}
              <div className="p-3 border-t border-gray-800">
                <div className="flex gap-2">
                  <button
                    onClick={isListening ? stopListening : startListening}
                    className={`flex-none flex items-center justify-center p-2 rounded-full transition-colors ${
                      isListening ? "bg-red-600 text-white" : "bg-blue-600 hover:bg-blue-500 text-white"
                    }`}
                    disabled={loading}
                    title={isListening ? "Stop listening" : "Start listening"}
                    aria-label={isListening ? "Stop listening" : "Start listening"}
                  >
                    {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                  </button>

                  <form onSubmit={handleTextSubmit} className="flex-1 flex gap-2">
                    <input
                      type="text"
                      placeholder="Type your message..."
                      className="flex-1 py-2 px-3 bg-gray-800 text-white rounded-lg border border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      value={userMessage}
                      onChange={handleInputChange}
                      disabled={loading || isListening}
                    />
                    <button
                      type="submit"
                      className="flex-none bg-blue-600 hover:bg-blue-500 text-white p-2 rounded-lg transition-colors flex items-center justify-center"
                      disabled={loading || !userMessage.trim() || isListening}
                      title="Send message"
                      aria-label="Send message"
                    >
                      <Send className="w-5 h-5" />
                    </button>
                  </form>
                </div>
              </div>

              {/* Loading overlay */}
              {loading && (
                <div className="absolute inset-0 bg-gray-900/70 backdrop-blur-sm flex items-center justify-center rounded-xl">
                  <div className="text-center">
                    <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-blue-400 font-medium">Jarvis is thinking...</p>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Global styles */}
      <style jsx global>{`
        @keyframes pulse-slow {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 0.7; }
        }
        
        @keyframes pulse-slower {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 0.6; }
        }
        
        .animate-pulse-slow {
          animation: pulse-slow 8s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
        
        .animate-pulse-slower {
          animation: pulse-slower 12s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
        
        .scrollbar-thin::-webkit-scrollbar {
          width: 4px;
        }
        
        .scrollbar-thin::-webkit-scrollbar-track {
          background: transparent;
        }
        
        .scrollbar-thin::-webkit-scrollbar-thumb {
          background: #4b5563;
          border-radius: 20px;
        }
      `}</style>
    </div>
  )
} 