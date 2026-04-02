import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// In-memory sessions for demo purposes. Real app would use Redis or DB.
const sessions = {};

// Helper: Simulated LLM for dynamic follow-up generation
const generateMockLLMResponse = (transcript) => {
  const responses = [
    "That makes sense. Can you elaborate on the most challenging aspect you faced there?",
    "Interesting approach. How would you handle scaling that to millions of users?",
    "I see. What alternative architectures did you consider and why did you discard them?",
    "Good explanation. What would you do differently if you had to start this from scratch?",
    "Understandable. What testing strategies did you employ for this?"
  ];
  return responses[Math.floor(Math.random() * responses.length)];
};

// Start a new interview session
app.post('/api/interview/start', (req, res) => {
  const { candidateInfo } = req.body;
  const sessionId = uuidv4();
  
  sessions[sessionId] = {
    candidate: candidateInfo || "Unknown",
    history: [],
    suspiciousEvents: [],
    currentQuestionIndex: 0,
    startTime: Date.now(),
    baseQuestions: [
      "Welcome! Can you tell me about your background in software engineering?",
      "Could you explain the differences between React's state and props?",
      "How do you handle performance optimization in large web applications?",
      "If you had to build a real-time chat app, what system architecture would you choose?"
    ]
  };

  res.json({
    sessionId,
    message: "Interview started successfully.",
    firstQuestion: sessions[sessionId].baseQuestions[0]
  });
});

// Submit answer and get next question
app.post('/api/interview/answer', (req, res) => {
  const { sessionId, answer } = req.body;
  const session = sessions[sessionId];

  if (!session) {
    return res.status(404).json({ error: "Session not found" });
  }

  // Record candidate's answer
  session.history.push({ role: 'candidate', content: answer });

  // Generate next question (Either a follow-up or next base question)
  let nextQuestion = "";
  let isComplete = false;

  const isFollowUp = Math.random() > 0.5; // Simulate 50% chance of follow-up
  if (isFollowUp && session.history.length > 0) {
    // Generate simulated follow up based on previous answer
    nextQuestion = generateMockLLMResponse(answer);
  } else {
    // Move to next base question
    session.currentQuestionIndex++;
    if (session.currentQuestionIndex < session.baseQuestions.length) {
      nextQuestion = session.baseQuestions[session.currentQuestionIndex];
    } else {
      nextQuestion = "Thank you for sharing your thoughts. We have completed the technical portion. Do you have any questions for me?";
      isComplete = true;
    }
  }

  session.history.push({ role: 'interviewer', content: nextQuestion });

  res.json({
    nextQuestion,
    isComplete
  });
});

// Log suspicious event
app.post('/api/interview/log-event', (req, res) => {
  const { sessionId, eventType, timestamp } = req.body;
  const session = sessions[sessionId];

  if (!session) {
    return res.status(404).json({ error: "Session not found" });
  }

  session.suspiciousEvents.push({ type: eventType, timestamp: timestamp || new Date().toISOString() });
  
  res.json({ success: true, message: "Event logged securely." });
});

// Generate evaluation report
app.post('/api/interview/evaluate', (req, res) => {
  const { sessionId } = req.body;
  const session = sessions[sessionId];

  if (!session) {
    return res.status(404).json({ error: "Session not found" });
  }

  const durationSecs = Math.floor((Date.now() - session.startTime) / 1000);

  // Mock evaluation based on simple criteria
  const technicalScore = Math.min(100, 70 + session.history.length * 2);
  const commScore = Math.min(100, 80 + session.history.length);
  const systemDesign = 75;

  const evaluation = {
    candidate: session.candidate,
    duration: `${Math.floor(durationSecs / 60)}m ${durationSecs % 60}s`,
    securityFlags: session.suspiciousEvents,
    scores: [
      { label: 'Technical Depth', score: technicalScore },
      { label: 'System Design', score: systemDesign },
      { label: 'Communication Clarity', score: commScore },
      { label: 'Problem Solving', score: technicalScore - 5 }
    ],
    recommendation: session.suspiciousEvents.length > 2 
      ? 'REJECT (Suspicious Behavior Detected)' 
      : 'PROCEED TO ROUND 2'
  };

  res.json(evaluation);
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Backend Server running on port ${PORT}`);
  console.log(`Endpoints Available:`);
  console.log(`- POST /api/interview/start`);
  console.log(`- POST /api/interview/answer`);
  console.log(`- POST /api/interview/log-event`);
  console.log(`- POST /api/interview/evaluate`);
});
