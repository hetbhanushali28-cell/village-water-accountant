import React, { useState, useEffect, useRef } from 'react';
import { parseVoiceCommand } from '../utils/voiceParser';

const VoiceAssistant = ({ onCommand }) => {
    const [isListening, setIsListening] = useState(false);
    const [transcript, setTranscript] = useState('');
    const [feedback, setFeedback] = useState('');
    const recognitionRef = useRef(null);

    useEffect(() => {
        // Initialize Speech Recognition
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

        if (SpeechRecognition) {
            const recognition = new SpeechRecognition();
            recognition.continuous = false;
            recognition.interimResults = false;
            recognition.lang = 'en-IN'; // Indian English

            recognition.onstart = () => {
                setIsListening(true);
                setFeedback('Listening...');
                setTranscript('');
            };

            recognition.onend = () => {
                setIsListening(false);
                // Don't auto-restart, let user click again for next command
            };

            recognition.onresult = (event) => {
                const text = event.results[0][0].transcript;
                setTranscript(text);
                setFeedback('Processing...');

                // Parse and execute
                const command = parseVoiceCommand(text);

                // Show what was understood
                let understood = [];
                if (command.crop) understood.push(`Crop: ${command.crop}`);
                if (command.soil) understood.push(`Soil: ${command.soil}`);
                if (command.location) understood.push(`Loc: ${command.location}`);

                if (understood.length > 0) {
                    setFeedback(`✅ Detected: ${understood.join(', ')}`);
                    onCommand(command);
                } else if (command.action) {
                    setFeedback(`✅ Action: ${command.action}`);
                    onCommand(command);
                } else {
                    setFeedback(`❓ Could not understand: "${text}"`);
                }

                // Clear feedback after 3 seconds
                setTimeout(() => setFeedback(''), 3000);
            };

            recognition.onerror = (event) => {
                console.error('Speech recognition error', event.error);
                setIsListening(false);
                setFeedback('❌ Error listening. Try again.');
            };

            recognitionRef.current = recognition;
        } else {
            console.warn("Web Speech API not supported in this browser.");
        }
    }, [onCommand]);

    const toggleListening = () => {
        if (!recognitionRef.current) {
            alert("Voice recognition is not supported in this browser. Try Chrome or Edge.");
            return;
        }

        if (isListening) {
            recognitionRef.current.stop();
        } else {
            recognitionRef.current.start();
        }
    };

    if (!recognitionRef.current) return null; // Don't render if not supported

    return (
        <div className="voice-assistant-container">
            {/* Feedback Popup */}
            {feedback && (
                <div className="voice-feedback">
                    {feedback}
                </div>
            )}

            {/* Floating Microphone Button */}
            <button
                className={`voice-fab ${isListening ? 'listening' : ''}`}
                onClick={toggleListening}
                aria-label="Voice Assistant"
            >
                {isListening ? (
                    <span className="mic-icon animate-pulse">🎤</span>
                ) : (
                    <span className="mic-icon">🎙️</span>
                )}
            </button>

            <style>{`
        .voice-assistant-container {
          position: fixed;
          bottom: 20px;
          right: 20px;
          z-index: 2000;
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 10px;
        }

        .voice-fab {
          width: 56px;
          height: 56px;
          border-radius: 50%;
          background: var(--primary-color, #2E7D32);
          color: white;
          border: none;
          box-shadow: 0 4px 12px rgba(0,0,0,0.3);
          cursor: pointer;
          font-size: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .voice-fab:hover {
          transform: scale(1.1);
          box-shadow: 0 6px 16px rgba(0,0,0,0.4);
        }

        .voice-fab.listening {
          background: #D32F2F; /* Red when recording */
          animation: pulse-ring 2s infinite;
        }

        .voice-feedback {
          background: white;
          padding: 8px 16px;
          border-radius: 20px;
          font-size: 0.9rem;
          font-weight: 500;
          color: #333;
          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
          white-space: nowrap;
          animation: slideInRight 0.3s ease-out;
          border: 1px solid #eee;
        }

        @keyframes pulse-ring {
          0% { box-shadow: 0 0 0 0 rgba(211, 47, 47, 0.7); }
          70% { box-shadow: 0 0 0 10px rgba(211, 47, 47, 0); }
          100% { box-shadow: 0 0 0 0 rgba(211, 47, 47, 0); }
        }

        @keyframes slideInRight {
          from { opacity: 0; transform: translateX(20px); }
          to { opacity: 1; transform: translateX(0); }
        }

        .animate-pulse {
          animation: pulse 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: .5; }
        }
      `}</style>
        </div>
    );
};

export default VoiceAssistant;
