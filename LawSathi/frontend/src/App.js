import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import './App.css';
import Login from './components/Login';
import { Button } from './components/ui/button';
import { Input } from './components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from './components/ui/card';
import { Badge } from './components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './components/ui/tabs';
import { ScrollArea } from './components/ui/scroll-area';
import { Alert, AlertDescription } from './components/ui/alert';
import { Mic, MicOff, Send, Upload, Volume2, VolumeX, User, Bot, FileText, Languages, LogOut } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

function App() {
  const [user, setUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [language, setLanguage] = useState('english');
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [popularTopics, setPopularTopics] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const recognitionRef = useRef(null);

  // Check for existing user session on app load
  useEffect(() => {
    const storedUser = localStorage.getItem('lawsathi_user');
    if (storedUser) {
      try {
        const userData = JSON.parse(storedUser);
        setUser(userData);
      } catch (error) {
        console.error('Error parsing stored user data:', error);
        localStorage.removeItem('lawsathi_user');
      }
    }
  }, []);

  // Initialize session and load popular topics when user logs in
  useEffect(() => {
    if (user) {
      const newSessionId = generateSessionId();
      setSessionId(newSessionId);
      loadPopularTopics();
      addWelcomeMessage();
      initializeSpeechRecognition();
    }
  }, [user, language]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const generateSessionId = () => {
    return 'session_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const initializeSpeechRecognition = () => {
    // Initialize speech recognition
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = language === 'hindi' ? 'hi-IN' : 'en-IN';
      
      recognitionRef.current.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        setInputMessage(transcript);
        setIsListening(false);
      };
      
      recognitionRef.current.onerror = () => {
        setIsListening(false);
      };
      
      recognitionRef.current.onend = () => {
        setIsListening(false);
      };
    }
  };

  const addWelcomeMessage = () => {
    const welcomeMessage = {
      id: 'welcome',
      type: 'bot',
      content: language === 'hindi' 
        ? `नमस्ते ${user?.name || 'उपयोगकर्ता'}! मैं LawSathi हूं, आपका कानूनी सहायक। मैं भारतीय कानून, सरकारी योजनाओं और आपके अधिकारों के बारे में किसी भी प्रश्न का उत्तर दे सकता हूं। आप मुझसे कुछ भी पूछ सकते हैं!`
        : `Hello ${user?.name || 'User'}! I am LawSathi, your legal assistant. I can answer any questions about Indian laws, government schemes, and your rights. Feel free to ask me anything!`,
      timestamp: new Date().toISOString(),
      messageType: 'text'
    };
    setMessages([welcomeMessage]);
  };

  const loadPopularTopics = async () => {
    try {
      const response = await axios.get(`${API}/popular-topics`);
      setPopularTopics(response.data.topics);
    } catch (error) {
      console.error('Failed to load popular topics:', error);
    }
  };

  const handleLogin = (userData) => {
    setUser(userData);
  };

  const handleLogout = () => {
    localStorage.removeItem('lawsathi_user');
    setUser(null);
    setMessages([]);
    setSessionId('');
    setInputMessage('');
  };

  const sendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return;

    const userMessage = {
      id: Date.now().toString(),
      type: 'user',
      content: inputMessage,
      timestamp: new Date().toISOString(),
      messageType: 'text'
    };

    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);
    
    const currentMessage = inputMessage;
    setInputMessage('');

    try {
      const response = await axios.post(`${API}/chat`, {
        message: currentMessage,
        session_id: sessionId,
        language: language
      });

      const botMessage = {
        id: Date.now().toString() + '_bot',
        type: 'bot',
        content: response.data.response,
        timestamp: response.data.timestamp,
        messageType: 'text',
        sources: response.data.sources || []
      };

      setMessages(prev => [...prev, botMessage]);
      
      // Auto-speak response if text-to-speech is available
      if ('speechSynthesis' in window && !isSpeaking) {
        speakText(response.data.response);
      }
    } catch (error) {
      console.error('Chat error:', error);
      const errorMessage = {
        id: Date.now().toString() + '_error',
        type: 'bot',
        content: language === 'hindi' 
          ? 'क्षमा करें, कुछ गलत हुआ है। कृपया पुनः प्रयास करें।'
          : 'Sorry, something went wrong. Please try again.',
        timestamp: new Date().toISOString(),
        messageType: 'error'
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const startListening = () => {
    if (recognitionRef.current && !isListening) {
      setIsListening(true);
      recognitionRef.current.start();
    }
  };

  const stopListening = () => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    }
  };

  const speakText = (text) => {
    if ('speechSynthesis' in window) {
      // Stop any current speech
      window.speechSynthesis.cancel();
      
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = language === 'hindi' ? 'hi-IN' : 'en-IN';
      utterance.rate = 0.8;
      
      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);
      
      window.speechSynthesis.speak(utterance);
    }
  };

  const stopSpeaking = () => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }
  };

  const handleFileUpload = async (file) => {
    if (!file) return;

    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('session_id', sessionId);
    formData.append('language', language);

    // Add user message for file upload
    const uploadMessage = {
      id: Date.now().toString(),
      type: 'user',
      content: `📄 Uploaded document: ${file.name}`,
      timestamp: new Date().toISOString(),
      messageType: 'document'
    };
    setMessages(prev => [...prev, uploadMessage]);

    try {
      const response = await axios.post(`${API}/upload-document`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      const botMessage = {
        id: Date.now().toString() + '_doc',
        type: 'bot',
        content: response.data.explanation,
        timestamp: new Date().toISOString(),
        messageType: 'document',
        extractedText: response.data.extracted_text
      };

      setMessages(prev => [...prev, botMessage]);
      
      // Auto-speak document explanation
      if ('speechSynthesis' in window && !isSpeaking) {
        speakText(response.data.explanation);
      }
    } catch (error) {
      console.error('Document upload error:', error);
      const errorMessage = {
        id: Date.now().toString() + '_doc_error',
        type: 'bot',
        content: language === 'hindi' 
          ? 'दस्तावेज़ अपलोड करने में समस्या हुई। कृपया पुनः प्रयास करें।'
          : 'Failed to process document. Please try again.',
        timestamp: new Date().toISOString(),
        messageType: 'error'
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsUploading(false);
      setSelectedFile(null);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleTopicClick = (question) => {
    setInputMessage(question);
  };

  // Show login page if user is not logged in
  if (!user) {
    return <Login onLogin={handleLogin} language={language} setLanguage={setLanguage} />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <header className="bg-white shadow-md border-b border-gray-200">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-full flex items-center justify-center">
                <Bot className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">LawSathi</h1>
                <p className="text-sm text-gray-600">
                  {language === 'hindi' ? 'आपका कानूनी सहायक' : 'Your Legal Assistant'}
                </p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">
                {language === 'hindi' ? 'नमस्ते' : 'Hello'}, {user.name}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setLanguage(language === 'english' ? 'hindi' : 'english')}
                className="flex items-center space-x-2"
              >
                <Languages className="w-4 h-4" />
                <span>{language === 'english' ? 'हिंदी' : 'English'}</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleLogout}
                className="flex items-center space-x-2"
              >
                <LogOut className="w-4 h-4" />
                <span>{language === 'hindi' ? 'लॉग आउट' : 'Logout'}</span>
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6 max-w-4xl">
        <Tabs defaultValue="chat" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="chat">
              {language === 'hindi' ? 'चैट' : 'Chat'}
            </TabsTrigger>
            <TabsTrigger value="topics">
              {language === 'hindi' ? 'लोकप्रिय विषय' : 'Popular Topics'}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="chat" className="space-y-4">
            {/* Chat Interface with Fixed Layout */}
            <Card className="chat-container">
              <CardHeader className="pb-3 flex-shrink-0">
                <CardTitle className="text-lg flex items-center space-x-2">
                  <Bot className="w-5 h-5" />
                  <span>{language === 'hindi' ? 'कानूनी सहायक चैट' : 'Legal Assistant Chat'}</span>
                </CardTitle>
              </CardHeader>
              
              {/* Messages Area with Fixed Height and Scroll */}
              <div className="chat-messages">
                <div className="space-y-4">
                  {messages.map((message) => (
                    <div key={message.id} className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[85%] rounded-lg p-3 message-bubble ${
                        message.type === 'user' 
                          ? 'bg-blue-600 text-white' 
                          : message.messageType === 'error'
                          ? 'bg-red-100 border border-red-300 text-red-800'
                          : 'bg-gray-100 border border-gray-200 text-gray-900'
                      }`}>
                        <div className="flex items-start space-x-2">
                          {message.type === 'bot' && (
                            <Bot className="w-4 h-4 mt-1 flex-shrink-0" />
                          )}
                          {message.type === 'user' && (
                            <User className="w-4 h-4 mt-1 flex-shrink-0" />
                          )}
                          <div className="flex-1 message-content">
                            <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
                            {message.messageType === 'document' && message.extractedText && (
                              <details className="mt-2">
                                <summary className="cursor-pointer text-xs opacity-75">
                                  {language === 'hindi' ? 'मूल पाठ देखें' : 'View extracted text'}
                                </summary>
                                <p className="text-xs mt-1 p-2 bg-white/20 rounded break-words">{message.extractedText}</p>
                              </details>
                            )}
                            {message.sources && message.sources.length > 0 && (
                              <div className="mt-2 flex flex-wrap gap-1">
                                {message.sources.map((source, idx) => (
                                  <Badge key={idx} variant="secondary" className="text-xs">
                                    {source}
                                  </Badge>
                                ))}
                              </div>
                            )}
                            {message.type === 'bot' && message.messageType !== 'error' && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="mt-2 p-1 h-auto"
                                onClick={() => isSpeaking ? stopSpeaking() : speakText(message.content)}
                                disabled={!('speechSynthesis' in window)}
                              >
                                {isSpeaking ? (
                                  <VolumeX className="w-3 h-3" />
                                ) : (
                                  <Volume2 className="w-3 h-3" />
                                )}
                              </Button>
                            )}
                          </div>
                        </div>
                        <div className="text-xs opacity-75 mt-1 text-right">
                          {new Date(message.timestamp).toLocaleTimeString()}
                        </div>
                      </div>
                    </div>
                  ))}
                  {isLoading && (
                    <div className="flex justify-start">
                      <div className="bg-gray-100 rounded-lg p-3 flex items-center space-x-2">
                        <Bot className="w-4 h-4" />
                        <div className="flex space-x-1">
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                <div ref={messagesEndRef} />
              </div>

              {/* Input Area - Fixed at Bottom */}
              <div className="chat-input-area">
                <div className="flex space-x-2">
                  <div className="flex-1 relative">
                    <Input
                      value={inputMessage}
                      onChange={(e) => setInputMessage(e.target.value)}
                      onKeyPress={handleKeyPress}
                      placeholder={language === 'hindi' ? 'अपना कानूनी प्रश्न यहाँ लिखें...' : 'Type your legal question here...'}
                      disabled={isLoading || isUploading}
                      className="pr-24 chat-input"
                    />
                    <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex space-x-1">
                      {/* Voice Input Button */}
                      {'webkitSpeechRecognition' in window && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={isListening ? stopListening : startListening}
                          disabled={isLoading || isUploading}
                          className={`p-1 h-auto ${isListening ? 'text-red-600 listening-pulse' : ''}`}
                        >
                          {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                        </Button>
                      )}
                      
                      {/* File Upload Button */}
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isLoading || isUploading}
                        className="p-1 h-auto"
                      >
                        <Upload className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  
                  <Button 
                    onClick={sendMessage} 
                    disabled={!inputMessage.trim() || isLoading || isUploading}
                    className="px-4"
                  >
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
                
                {/* Status Alerts */}
                {isUploading && (
                  <Alert className="mt-2">
                    <FileText className="w-4 h-4" />
                    <AlertDescription>
                      {language === 'hindi' ? 'दस्तावेज़ संसाधित हो रहा है...' : 'Processing document...'}
                    </AlertDescription>
                  </Alert>
                )}
                
                {isListening && (
                  <Alert className="mt-2">
                    <Mic className="w-4 h-4" />
                    <AlertDescription>
                      {language === 'hindi' ? 'सुन रहा हूँ... बोलिए' : 'Listening... Please speak'}
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            </Card>

            {/* Hidden File Input */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,image/*"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  handleFileUpload(file);
                }
              }}
              className="hidden"
            />
          </TabsContent>

          <TabsContent value="topics" className="space-y-4">
            {/* Popular Topics */}
            <div className="grid gap-6">
              {popularTopics.map((topic, index) => (
                <Card key={index}>
                  <CardHeader>
                    <CardTitle className="text-lg">{topic.category}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {topic.questions.map((question, qIndex) => (
                        <Button
                          key={qIndex}
                          variant="outline"
                          className="w-full text-left justify-start h-auto py-3 px-4"
                          onClick={() => {
                            handleTopicClick(question);
                            // Switch to chat tab safely
                            const chatTab = document.querySelector('[value="chat"]');
                            if (chatTab) {
                              chatTab.click();
                            }
                          }}
                        >
                          <span className="text-sm break-words">{question}</span>
                        </Button>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

export default App;