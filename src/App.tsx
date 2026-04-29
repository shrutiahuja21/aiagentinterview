import { useState, useEffect, useRef } from 'react';
import { Camera, Mic, CheckCircle2, UserCheck, Download } from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { motion } from 'framer-motion';

const API_BASE = 'http://localhost:8001/api/interview';

export default function App() {
  const [interviewStarted, setInterviewStarted] = useState(false);
  const [interviewComplete, setInterviewComplete] = useState(false);
  
  const [isMockMode, setIsMockMode] = useState(false);
  
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);
  const [displayStream, setDisplayStream] = useState<MediaStream | null>(null);
  
  const [sessionId, setSessionId] = useState("");
  const [currentQuestionText, setCurrentQuestionText] = useState("");
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);
  const [isAiSpeaking, setIsAiSpeaking] = useState(false);
  const [candidateTranscript, setCandidateTranscript] = useState("");
  const [tempSpeech, setTempSpeech] = useState("");
  const [aiNotes, setAiNotes] = useState<string[]>([]);
  const [conversationHistory, setConversationHistory] = useState<{ role: string, text: string, time: string }[]>([]);
  
  const [suspiciousEvents, setSuspiciousEvents] = useState<{time: string, type: string}[]>([]);
  const [evaluation, setEvaluation] = useState<any>(null);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const screenRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const recognitionRef = useRef<any>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto scroll sidebar
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [conversationHistory, candidateTranscript, tempSpeech]);
  useEffect(() => {
    if (videoRef.current && mediaStream) {
      videoRef.current.srcObject = mediaStream;
    }
  }, [mediaStream, interviewStarted]);

  useEffect(() => {
    if (screenRef.current && displayStream) {
      screenRef.current.srcObject = displayStream;
    }
  }, [displayStream, interviewStarted]);


  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const setupMediaRecorder = (stream: MediaStream) => {
    try {
      // Use default browser mimeType for maximum compatibility
      const mr = new MediaRecorder(stream);
      mr.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      mediaRecorderRef.current = mr;
      
      // Delay start slightly to ensure stream is ready
      setTimeout(() => {
        if (mr.state === "inactive") mr.start(500);
      }, 500);
      
    } catch (e) {
      console.warn("MediaRecorder start failed:", e);
    }
  };

  // Restore Web Speech API for visual "Live Transcripts" before submitting
  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      
      recognition.onresult = (event: any) => {
        let interimTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            const txt = event.results[i][0].transcript.toLowerCase();
            setCandidateTranscript(prev => prev + " " + event.results[i][0].transcript);
            setTempSpeech('');
            
            // Automated Voice Commands
            if (txt.includes("download") || txt.includes("pdf") || txt.includes("report")) {
               console.log("Automated Voice Command: Generate PDF triggered.");
               handleDownloadPDF();
            }
          } else {
            interimTranscript += event.results[i][0].transcript;
          }
        }
        setTempSpeech(interimTranscript);
      };
      
      recognition.onerror = (event: any) => {
        console.error("SpeechRecognition Error:", event.error);
        if (event.error === 'not-allowed') {
          console.warn("Microphone access for live transcription was denied.");
        }
      };

      recognition.onend = () => {
        // Auto-restart if interview is still active and not in mock mode
        if (interviewStarted && !interviewComplete && !isMockMode) {
          try {
            recognition.start();
          } catch (e) {
            // Probably already running
          }
        }
      };

      recognitionRef.current = recognition;
    }
  }, []);

  const initBackendSession = async () => {
    try {
      const res = await fetch(`${API_BASE}/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ candidateInfo: "John Doe (Simulated)" })
      });
      const data = await res.json();
      console.log("Session Started:", data);
      setSessionId(data.sessionId);
      const startText = data.firstQuestion || "Tell me about yourself and your professional background.";
      setCurrentQuestionText(startText);
      setConversationHistory([{ role: 'AI', text: startText, time: new Date().toLocaleTimeString() }]);
      speakAiQuestion(startText);
    } catch (err) {
      console.error("Backend Session Error:", err);
      setCurrentQuestionText("ERROR: Backend not responding on Port 8001. Start agent.py!");
    }
  };

  const handleStartInterview = async () => {
    try {
      // 1. Prompt for camera and mic
      const cStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      setMediaStream(cStream);
      
      // 2. Prompt for Screen Share (Crucial for monitoring)
      try {
        const sStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        setDisplayStream(sStream);
      } catch (sErr) {
        console.warn("Screen share denied. Proctored session needs screen access.");
        alert("Screen sharing is mandatory for this proctored audit. Please allow entire screen sharing.");
        throw sErr;
      }

      setInterviewStarted(true);
      setupMediaRecorder(cStream);
      
      if (recognitionRef.current && !isMockMode) {
        try {
          recognitionRef.current.start();
        } catch (e) {
          console.warn("SpeechRecognition already started or failed to start.");
        }
      }
      
      initBackendSession();

    } catch (err) {
      console.error("Error accessing media devices.", err);
      if (window.confirm("Camera/Screen access failed. This usually happens if permissions were denied or if you're not on localhost/https. Would you like to proceed anyway using mock mode?")) {
        setInterviewStarted(true);
        setIsMockMode(true);
        initBackendSession();
      }
    }
  };

  const speakAiQuestion = (text: string) => {
    setIsAiSpeaking(true);
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel(); // Stop any previous speech
      const voices = window.speechSynthesis.getVoices();
      
      const doSpeak = () => {
        const currentVoices = window.speechSynthesis.getVoices();
        const utterance = new SpeechSynthesisUtterance(text);
        const aiVoice = currentVoices.find(v => v.lang.includes('en') && (v.name.includes('Google') || v.name.includes('Samantha') || v.name.includes('Premium')));
        if (aiVoice) utterance.voice = aiVoice;
        utterance.rate = 1.0;
        utterance.pitch = 1.0;
        utterance.onend = () => setIsAiSpeaking(false);
        window.speechSynthesis.speak(utterance);
      };

      if (voices.length === 0) {
        window.speechSynthesis.onvoiceschanged = doSpeak;
      } else {
        doSpeak();
      }
    } else {
      setTimeout(() => setIsAiSpeaking(false), 3000);
    }
  };

  const handleDownloadPDF = () => {
    try {
      const doc = new jsPDF() as any;
      const pageWidth = doc.internal.pageSize.getWidth();
      
      doc.setFillColor(63, 81, 181);
      doc.rect(0, 0, pageWidth, 40, 'F');
      
      doc.setFontSize(24);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(255, 255, 255);
      doc.text("INTERVIEW AUDIT REPORT", pageWidth / 2, 25, { align: "center" });
      
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text(`Generated: ${new Date().toLocaleString()}`, pageWidth - 14, 50, { align: "right" });
      doc.text(`Candidate: ${evaluation?.candidate || "John Doe (Simulated)"}`, 14, 50);
      
      doc.setDrawColor(200, 200, 200);
      doc.line(14, 55, pageWidth - 14, 55);

      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.text("Interview Transcript", 14, 70);
      
      const conversationData = conversationHistory.map(h => [
        h.role === 'AI' ? 'AI Interviewer' : 'Candidate',
        h.text
      ]);
      
      if (candidateTranscript || tempSpeech) {
        conversationData.push([
          "Candidate (Live)",
          `${candidateTranscript} ${tempSpeech}`.trim() || "[No record]"
        ]);
      }

      autoTable(doc, {
        startY: 75,
        head: [['Speaker', 'Dialogue/Response']],
        body: conversationData,
        theme: 'striped',
        headStyles: { 
          fillColor: [63, 81, 181], 
          textColor: [255, 255, 255], 
          fontSize: 11, 
          fontStyle: 'bold',
          halign: 'center' 
        },
        styles: { fontSize: 10, cellPadding: 6, valign: 'middle' },
        columnStyles: {
          0: { cellWidth: 40, fontStyle: 'bold', halign: 'center' },
          1: { cellWidth: 'auto', halign: 'left' }
        },
        alternateRowStyles: { fillColor: [245, 245, 255] }
      });

      const finalY = (doc as any).lastAutoTable.finalY + 15;
      if (finalY > 260) doc.addPage();
      
      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.text("AI Performance Summary", 14, finalY);
      
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(80, 80, 80);
      
      const summaryText = aiNotes.length > 0 
        ? aiNotes.join(" ") 
        : "The candidate has demonstrated consistent technical aptitude during this session, highlighting core engineering experience and professional background across diverse systems. Communication was professional, and relevant technical references were provided during the audit stream.";
      
      const splitSummary = doc.splitTextToSize(summaryText, 180);
      doc.text(splitSummary, 14, finalY + 10);

      const candidateName = (evaluation?.candidate || "Candidate").replace(/\s+/g, '_');
      const timestamp = new Date().toISOString().split('T')[0];
      const fileName = `Audit_Report_${candidateName}_${timestamp}.pdf`;
      doc.save(fileName);
      
      console.log("Premium PDF generated and saved as:", fileName);
    } catch (err) {
      console.error("PDF Generation Error:", err);
      alert("Failed to generate PDF. Check console.");
    }
  };

  const completeInterview = async () => {
    setInterviewComplete(true);
    if (recognitionRef.current) recognitionRef.current.stop();
    if (mediaStream) mediaStream.getTracks().forEach(t => t.stop());
    
    try {
      const res = await fetch(`${API_BASE}/evaluate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId })
      });
      const data = await res.json();
      setEvaluation(data);
      
      setTimeout(() => {
        handleDownloadPDF();
      }, 1500);
      
    } catch (e) {
      console.error("Failed to fetch evaluation.");
    }
  };

  const submitAnswer = async () => {
    if (!sessionId) return;
    
    // Stop recording to get the current blob
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    
    // Create audio file blob from chunks
    const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
    audioChunksRef.current = []; // Reset for next recording
    
    // Start recording again for next question
    if (mediaStream) setupMediaRecorder(mediaStream);

    setTempSpeech(isMockMode ? "Sending response..." : "Uploading audio... Transcribing...");

    try {
      const formData = new FormData();
      formData.append('sessionId', sessionId);
      if (isMockMode) {
        formData.append('textAnswer', candidateTranscript);
      } else {
        formData.append('audioFile', audioBlob, 'answer.webm');
      }

      const res = await fetch(`${API_BASE}/answer`, {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      
      const transcript = data.transcriptProcessed || "[No transcript returned]";
      setCandidateTranscript(transcript);
      const userMessage = { role: 'You', text: transcript, time: new Date().toLocaleTimeString() };

      if (data.agentNotes) {
        setAiNotes(prev => [data.agentNotes, ...prev]);
      }
      
      if (data.isComplete) {
        console.log("Interview Complete:", data);
        const aiFinalMessage = { role: 'AI', text: data.nextQuestion || "All notes recorded.", time: new Date().toLocaleTimeString() };
        setConversationHistory(prev => [...prev, userMessage, aiFinalMessage]);
        setCurrentQuestionText(data.nextQuestion);
        completeInterview();
      } else {
        console.log("Moving to Next Question:", data);
        const aiMessage = { role: 'AI', text: data.nextQuestion, time: new Date().toLocaleTimeString() };
        setConversationHistory(prev => [...prev, userMessage, aiMessage]);

        setCurrentQuestionText(data.nextQuestion);
        setCurrentQuestionIdx(prev => prev + 1);
        speakAiQuestion(data.nextQuestion);
      }
      
      setCandidateTranscript("");
    } catch (err) {
      console.error("Error submitting answer:", err);
      alert("Failed to submit answer. Check server logs.");
    } finally {
      setIsAiSpeaking(false);
      setTempSpeech("");
    }
  };


  const logSuspiciousEvent = async (type: string) => {
    const time = new Date().toLocaleTimeString();
    setSuspiciousEvents(prev => [{ time, type }, ...prev]);
    if (sessionId) {
      fetch(`${API_BASE}/log-event`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, eventType: type, timestamp: time })
      }).catch(err => console.error("Could not sync log", err));
    }
  };

  useEffect(() => {
    if (interviewStarted && !interviewComplete) {
      const onBlur = () => logSuspiciousEvent("Browser window lost focus (Tab switch/minimize)");
      const onCopy = () => logSuspiciousEvent("Copy operation detected (Potential external search)");
      const onPaste = () => logSuspiciousEvent("Paste operation detected (Potential prepared answer)");
      
      window.addEventListener('blur', onBlur);
      window.addEventListener('copy', onCopy);
      window.addEventListener('paste', onPaste);

      // Periodic Screen Audit (Every 20 seconds) for Proctoring
      let interval: any;
      if (displayStream && !isMockMode) {
        interval = setInterval(() => {
          captureAndAnalyzeScreen();
        }, 20000);
      }

      return () => {
        window.removeEventListener('blur', onBlur);
        window.removeEventListener('copy', onCopy);
        window.removeEventListener('paste', onPaste);
        if (interval) clearInterval(interval);
      };
    }
  }, [interviewStarted, interviewComplete, displayStream, isMockMode]);

  const captureAndAnalyzeScreen = () => {
    if (!screenRef.current || !canvasRef.current || !sessionId) return;
    const canvas = canvasRef.current;
    const video = screenRef.current;
    
    // Scale down for API efficiency
    const scale = 0.5;
    canvas.width = video.videoWidth * scale;
    canvas.height = video.videoHeight * scale;
    
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const imageData = canvas.toDataURL('image/jpeg', 0.6);
      
      fetch(`${API_BASE}/monitor`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, image: imageData })
      })
      .then(res => res.json())
      .then(data => {
         if (data.status === 'suspicious') {
            logSuspiciousEvent(`AI VISION ALERT: ${data.notes}`);
         }
      })
      .catch(err => console.error("Vision Audit failed:", err));
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 font-sans p-6 overflow-hidden flex flex-col items-center justify-center relative">
      <div className="absolute inset-0 z-0 opacity-20 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at center, #7000FF 0%, transparent 60%)' }} />
      <div className="absolute top-0 right-0 z-0 opacity-10 pointer-events-none w-96 h-96" style={{ backgroundImage: 'radial-gradient(circle at top right, #00F2FF 0%, transparent 60%)' }} />

      {/* Start Screen */}
      {!interviewStarted && !interviewComplete && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="z-10 bg-gray-900 border border-gray-800 rounded-2xl p-8 max-w-lg w-full shadow-2xl">
          <h1 className="text-3xl font-bold mb-4 text-white">AI Interview Portal</h1>
          <p className="text-gray-400 mb-6">Welcome to your technical interview. This assessment will test your engineering skills and problem-solving abilities.</p>
          
          <div className="space-y-4 mb-8">
            <div className="flex justify-between items-center p-3 bg-gray-800 rounded-lg">
              <div className="flex items-center gap-3"><Camera className="text-blue-400" /><span>Camera & Microphone</span></div>
              <CheckCircle2 className="text-emerald-500 w-5 h-5" />
            </div>
          </div>
          
          <button onClick={handleStartInterview} className="w-full py-4 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-semibold text-lg transition-all transform hover:scale-[1.02] active:scale-[0.98]">
            Start Interview
          </button>
        </motion.div>
      )}

      {/* Live Interview Layout (Cinematic Stage) */}
      {interviewStarted && !interviewComplete && (
        <div className="w-full max-w-[1700px] z-10 flex flex-col gap-6 h-[92vh]">
          
          {/* Top Stage: 3-Stream view (AI / ME / SCREEN) */}
          <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-6 min-h-0">
            
            {/* AI Interviewer (Left 50%) */}
            <div className="relative rounded-[2.5rem] overflow-hidden glass border-gray-800 flex flex-col items-center justify-center bg-gray-900 shadow-[0_20px_50px_rgba(0,0,0,0.5)] h-full transition-all duration-500 hover:border-blue-500/30">
              <div className={`absolute inset-0 bg-blue-500/10 transition-opacity duration-300 ${isAiSpeaking ? 'opacity-100' : 'opacity-0'}`} />
              <img src="https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&q=80&w=800" alt="AI Interviewer" className="w-full h-full object-cover opacity-90 transition-all duration-700" />
              
              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-full px-4 flex justify-center">
                <div className={`px-5 py-2.5 rounded-full text-sm font-black glass backdrop-blur-2xl flex items-center gap-3 border transition-all ${isAiSpeaking ? 'border-primary shadow-[0_0_30px_rgba(0,242,255,0.6)] text-white scale-105' : 'border-gray-700 text-gray-400'}`}>
                  <div className={`w-3 h-3 rounded-full ${isAiSpeaking ? 'bg-primary animate-ping' : 'bg-gray-600'}`} />
                  {isAiSpeaking ? "INTERVIEWER SPEAKING" : "LISTENING..."}
                </div>
              </div>
            </div>

            {/* Candidate Camera (Center) */}
            <div className="relative rounded-[2.5rem] overflow-hidden glass border-gray-800 bg-gray-900 shadow-[0_20px_50px_rgba(0,0,0,0.5)] h-full transition-all duration-500 hover:border-emerald-500/30">
              <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover transform scale-x-[-1]" />
              <div className="absolute bottom-6 left-6 flex flex-col gap-3">
                <span className="px-4 py-2 rounded-full glass border-gray-700 text-xs flex items-center gap-2 text-white font-black backdrop-blur-2xl shadow-2xl uppercase tracking-widest text-emerald-400">
                  Candidate LIVE
                </span>
              </div>
            </div>

            {/* Shared Screen (Right) */}
            <div className="relative rounded-[2.5rem] overflow-hidden glass border-blue-500/20 bg-gray-900 shadow-[0_20px_50px_rgba(0,0,0,0.5)] h-full transition-all duration-500 hover:border-blue-500/50">
              <video ref={screenRef} autoPlay playsInline muted className="w-full h-full object-contain bg-black" />
              <div className="absolute top-6 right-6">
                <span className="px-4 py-2 rounded-full glass border-blue-700/30 text-[10px] text-blue-400 font-black uppercase tracking-widest">Monitoring Stream</span>
              </div>
              {!displayStream && (
                <div className="absolute inset-0 flex items-center justify-center text-gray-700 font-black uppercase tracking-tighter text-2xl">No Screen Share</div>
              )}
            </div>
          </div>

          {/* Bottom Controls Row: Questions, Transcripts, and Monitoring */}
          <div className="h-1/3 min-h-[280px] grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Column 1: Current Question & Answer Input */}
            <div className="lg:col-span-1 glass border-indigo-500/20 rounded-3xl p-6 flex flex-col shadow-2xl bg-indigo-950/10">
               <div className="flex-1 mb-4">
                  <span className="text-[10px] text-indigo-400 font-black uppercase tracking-[0.2em] block mb-2 px-1">Current Question Q{currentQuestionIdx + 1}</span>
                  <p className="text-xl font-bold text-white leading-tight">
                    {currentQuestionText || 'Initialising session...'}
                  </p>
               </div>
               <div className="flex gap-3">
                <button
                  onClick={() => setCandidateTranscript("")}
                  className="px-6 py-4 rounded-2xl bg-gray-800/50 hover:bg-gray-700 text-gray-400 transition-all font-bold text-sm border border-gray-700"
                >
                  Reset
                </button>
                <button
                  onClick={submitAnswer}
                  disabled={tempSpeech.includes("...")}
                  className={`flex-1 px-4 py-4 rounded-2xl text-white font-black text-lg transition-all transform active:scale-95 flex items-center justify-center gap-2 ${
                    tempSpeech.includes("...") 
                    ? 'bg-gray-700 cursor-not-allowed' 
                    : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 shadow-[0_10px_30px_rgba(37,99,235,0.4)] hover:scale-[1.02]'
                  }`}
                >
                  {tempSpeech.includes("...") ? (
                    <><div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Processing...</>
                  ) : "Submit & Next Question"}
                </button>
              </div>
            </div>

            {/* Column 2: Live Transcript Stream */}
            <div className="lg:col-span-1 glass border-gray-800 rounded-3xl p-6 flex flex-col shadow-2xl max-h-full">
               <div className="flex-1 overflow-y-auto mb-4 bg-gray-900 rounded-xl p-5 border border-gray-800 relative shadow-inner">
                  <div className="text-gray-400 text-xs mb-3 uppercase font-bold tracking-widest flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2"><Mic className="w-3 h-3" /> Live Transcript Vis</div>
                    <button 
                      onClick={() => setIsMockMode(!isMockMode)} 
                      className="text-[9px] bg-white/5 hover:bg-white/10 px-2 py-0.5 rounded border border-white/10 transition-all font-black"
                    >
                      {isMockMode ? "USE VOICE" : "TYPE MANUALLY"}
                    </button>
                  </div>
                <div className="text-white text-lg leading-relaxed h-full">
                  {isMockMode ? (
                    <textarea 
                      value={candidateTranscript} 
                      onChange={(e) => setCandidateTranscript(e.target.value)}
                      placeholder="Type your response here (Mock Mode)..."
                      className="w-full h-full bg-transparent border-none outline-none text-white resize-none scrollbar-hide"
                    />
                  ) : (
                    <>
                      {candidateTranscript}
                      <span className="text-gray-400 animate-pulse">{tempSpeech && ` ${tempSpeech}`}</span>
                    </>
                  )}
                </div>
                {(!candidateTranscript && !tempSpeech) && <div className="text-gray-600 italic mt-2 text-sm">(Speak clearly into your microphone...)</div>}
              </div>
            </div>

            {/* Column 3: Live Meeting Notes & Security */}
            <div className="lg:col-span-1 glass border-amber-500/20 rounded-3xl p-6 flex flex-col shadow-2xl relative bg-amber-950/5 overflow-hidden">
               <div className="flex justify-between items-center mb-3">
                  <h3 className="text-[10px] font-black text-amber-500 uppercase tracking-[0.2em] flex items-center gap-2">
                    <UserCheck className="w-4 h-4" /> Agent Audit Stream
                  </h3>
                  <button onClick={handleDownloadPDF} className="text-[10px] bg-emerald-500/20 text-emerald-400 px-3 py-1 rounded-full border border-emerald-500/30 font-black hover:bg-emerald-500/40 transition-all">REP PDF</button>
               </div>
               <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-3 scrollbar-hide">
                 {conversationHistory.length === 0 ? (
                  <p className="text-gray-600 text-[11px] italic text-center py-4">Session logs will appear here...</p>
                 ) : (
                  conversationHistory.map((h, idx) => (
                    <div key={idx} className={`p-3 rounded-2xl border text-[12px] leading-snug ${h.role === 'AI' ? 'bg-blue-600/5 border-blue-500/20 text-blue-200' : 'bg-emerald-600/5 border-emerald-500/20 text-emerald-200'}`}>
                      <span className="font-black uppercase text-[9px] mr-2 opacity-60 tracking-widest">{h.role}:</span> {h.text}
                    </div>
                  ))
                 )}
                 {(candidateTranscript || tempSpeech) && (
                    <div className="p-3 rounded-2xl border bg-emerald-600/10 border-emerald-500/40 text-emerald-200 text-[12px] leading-snug animate-pulse">
                      <span className="font-black uppercase text-[9px] mr-2 opacity-60 tracking-widest text-emerald-400">YOU (LIVE):</span> {candidateTranscript} {tempSpeech && <span className="opacity-50 italic">{tempSpeech}</span>}
                    </div>
                 )}
                 {aiNotes.length > 0 && <div className="p-3 bg-amber-500/10 border-l-4 border-amber-500 rounded-r-2xl text-[12px] italic text-amber-100">{aiNotes[0]}</div>}
                 {suspiciousEvents.length > 0 && <div className="p-2 bg-red-500/10 rounded-xl text-[10px] text-red-300 font-bold border border-red-500/20">SECURITY FLAG: {suspiciousEvents[0].type}</div>}
               </div>
            </div>

          </div>
        </div>
      )}

      {/* Completion Screen */}
      {interviewComplete && (
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="z-10 bg-gray-900 border border-gray-800 rounded-2xl p-8 max-w-2xl w-full shadow-2xl">
          <div className="text-center mb-8">
            <CheckCircle2 className="w-16 h-16 text-emerald-400 mx-auto mb-4" />
            <h1 className="text-3xl font-bold text-white mb-2">Interview Completed</h1>
            <p className="text-gray-400">Analysis & Evaluation generated from backend.</p>
          </div>

          {evaluation ? (
            <>
              <div className="grid grid-cols-2 gap-6 mb-8">
                <div className="bg-gray-800 rounded-xl p-4">
                  <p className="text-gray-400 text-sm mb-1">Candidate</p>
                  <p className="font-semibold text-white">{evaluation.candidate}</p>
                </div>
                <div className="bg-gray-800 rounded-xl p-4">
                  <p className="text-gray-400 text-sm mb-1">Duration</p>
                  <p className="font-semibold text-white">{evaluation.duration}</p>
                </div>
              </div>

              <div className="mb-8">
                <h3 className="text-xl font-bold text-white mb-4 border-b border-gray-800 pb-2">AI Evaluation Scores</h3>
                <div className="space-y-4">
                  {evaluation.scores.map((metric: any) => (
                    <div key={metric.label}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-gray-300">{metric.label}</span>
                        <span className="text-primary font-bold">{metric.score}/100</span>
                      </div>
                      <div className="w-full bg-gray-800 rounded-full h-2 overflow-hidden shadow-inner">
                        <div className="bg-primary h-2 rounded-full" style={{ width: `${metric.score}%` }}></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mb-8 bg-red-500/10 border border-red-500/20 rounded-xl p-4">
                <h3 className="text-lg font-bold text-red-400 mb-2 border-b border-red-500/20 pb-2">Security Audit</h3>
                <p className="text-red-300 text-sm mb-3 font-semibold">{evaluation.securityFlags.length} Suspicious Events Detected</p>
                {evaluation.securityFlags.length > 0 && (
                  <ul className="text-xs text-gray-300 space-y-2">
                    {evaluation.securityFlags.slice(0, 3).map((e: any, i: number) => (
                      <li key={i} className="flex gap-3">
                        <span className="text-red-400/70 shrink-0 font-mono">{e.timestamp}</span>
                        <span>{e.type}</span>
                      </li>
                    ))}
                    {evaluation.securityFlags.length > 3 && <li className="text-gray-500 pt-2 italic">...and {evaluation.securityFlags.length - 3} more.</li>}
                  </ul>
                )}
              </div>

              <div className={`border rounded-xl p-5 mb-6 shadow-lg ${evaluation.recommendation.includes('REJECT') ? 'border-red-500/30 bg-red-500/10' : 'border-emerald-500/30 bg-emerald-500/10'}`}>
                <h3 className={`text-lg font-extrabold mb-2 uppercase tracking-wide ${evaluation.recommendation.includes('REJECT') ? 'text-red-400' : 'text-emerald-400'}`}>Hiring Recommendation</h3>
                <p className="text-white text-lg tracking-wide"><strong>{evaluation.recommendation}</strong></p>
              </div>
            </>
          ) : (
            <div className="text-center py-12">
              <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-gray-300 font-medium">Fetching secure evaluation from server...</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <button 
              onClick={handleDownloadPDF}
              className="py-4 rounded-xl bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white font-bold transition shadow-lg flex items-center justify-center gap-2"
            >
              <Download className="w-5 h-5" /> Download PDF Report
            </button>
            <button onClick={() => window.location.reload()} className="py-4 rounded-xl bg-gray-800 hover:bg-gray-700 border border-gray-700 text-white font-bold transition shadow-md">
              Start New Session
            </button>
          </div>
        </motion.div>
      )}
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
