# Real-Time AI Interview Agent
A scalable, modular, real-time AI Interview Agent built with modern AI, streaming, and microservice architecture principles.

## 🚀 Working Prototype Features
- **Real-Time Video/Audio Layer**: Streams live camera and audio natively in React.
- **Screen Monitoring**: Live Full-Screen Capture with unexpected termination logging.
- **Microphone STT Engine**: Leverages native Web Speech API for low-latency live visuals on screen AND native `.webm` recording blobs sent directly to **OpenAI Whisper STT API**.
- **LLM Agent Pipeline**: Built on FastAPI with strict JSON constraints. **GPT-4o-mini** dynamically generates deep-dive follow-up questions AND live supervisory "Agent Notes" to monitor the candidate's answers.
- **Real-Time Security Enforcement**: The UI logs all suspicious events (e.g. Tab Switching, Gaze shifting, Window minimizing) and immutably audits them.
- **Automated Interview Summary**: A final scoring rubric breaks down technical depth, duration, and spits out a binary `PROCEED / REJECT` score.

## 🏗 System Architecture Diagram

```mermaid
graph TD
    subgraph Frontend (React + Vite)
        A[Candidate Video Stream] --> C(Media Processing Layer)
        B[Full Screen Share] --> C
        C --> D[WebRTC / Local Recorder]
        M[Web Speech API] --> N(Live UI Visuals)
    end

    subgraph Audio Transfer
        D -- "POST Multipart (Audio Blob)" --> E
    end

    subgraph Backend Microservice (FastAPI Agent)
        E[FastAPI API Gateway] --> F{OpenAI Whisper STT}
        F -- Transcribed Text --> G[Orchestrator]
        G -- Prompt Injection --> H[OpenAI GPT-4o-mini]
        H -- "JSON {next_question, agent_notes}" --> G
        G -- Return Output Payload --> I[Frontend UI]
    end

    subgraph Real-Time Evaluation Engine
        I --> J[Sidebar: AI Notes Render]
        I --> K[TTS: Speech Synthesis Feedback] 
        I --> L[Auditing: Event Security Log]
    end
```

## 🎥 Walkthrough / Demo
1. Run `npm run dev` to start the frontend on `http://localhost:5173`.
2. Run `python agent.py` to start the FastAPI interviewing backend on `http://localhost:4000`.
3. Give Camera/Microphone/Screen Sharing permissions.
4. **Answer the AI**: The visual transcript dictates your words real-time. Hit **Submit & Next** to package the audio buffer uniquely to OpenAI Whisper!
5. **Watch the AI pivot**: OpenAI generates the response and outputs Live Notes analyzing your answer.
6. The UI speaks back to you. Click through until the final evaluation generates!

## 📊 Sample Generated Interview Report (JSON Output)
This corresponds to the structure generated globally during the final `CompleteInterview()` phase:

```json
{
  "candidate": "John Doe (Simulated)",
  "duration": "14m 23s",
  "securityFlags": [
    {
      "timestamp": "14:22:05",
      "type": "Browser window lost focus (Tab switch/minimize)"
    }
  ],
  "scores": [
    {
      "label": "Technical Depth",
      "score": 88
    },
    {
      "label": "Communication Clarity",
      "score": 92
    }
  ],
  "recommendation": "PROCEED"
}
```

## 📂 Code Repository Map
- `src/App.tsx`: Central orchestrator for the React layout, UI Hooks, Stream bindings, UI State, and Security Auditing blur triggers.
- `backend/interview-service/agent.py`: Python script utilizing OpenAI + FastAPI to drive dynamic stateful memory tracking, speech-to-text transcriptions, and LLM evaluations.
- `copy.js`: Pipeline copy script for avatars payload generation.
"# aiagentinterview" 
