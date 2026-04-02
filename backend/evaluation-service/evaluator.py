import json
import logging
from typing import Dict, List, Optional
from datetime import datetime

logger = logging.getLogger("evaluator-service")

class InterviewEvaluator:
    """
    Tracks candidate performance and generates a final evaluation report.
    """
    def __init__(self, candidate_name: str = "Candidate", role: str = "Software Engineer"):
        self.candidate_name = candidate_name
        self.role = role
        self.start_time = datetime.now()
        self.scores = {
            "Technical Depth": 0,
            "Communication": 0,
            "Confidence": 0,
            "Answer Quality": 0
        }
        self.suspicious_events: List[Dict] = []
        self.transcript: List[Dict] = []
        self.feedback: List[str] = []

    def update_scores(self, new_scores: Dict[str, int]):
        """
        Updates the current scores based on the latest performance.
        """
        for key, value in new_scores.items():
            if key in self.scores:
                # Simple moving average or similar logic can be applied
                self.scores[key] = (self.scores[key] + value) / 2
        logger.info(f"Updated scores: {self.scores}")

    def add_suspicious_event(self, event_type: str, details: str):
        """
        Logs a suspicious event detected during the interview.
        """
        event = {
            "timestamp": datetime.now().isoformat(),
            "type": event_type,
            "details": details
        }
        self.suspicious_events.append(event)
        logger.warning(f"Suspicious event logged: {event}")

    def add_to_transcript(self, speaker: str, text: str):
        """
        Adds a turn to the interview transcript.
        """
        self.transcript.append({
            "timestamp": datetime.now().isoformat(),
            "speaker": speaker,
            "text": text
        })

    def generate_report(self) -> str:
        """
        Generates the final interview summary report.
        """
        duration = datetime.now() - self.start_time
        total_score = sum(self.scores.values()) / len(self.scores)
        
        report = {
            "candidate_name": self.candidate_name,
            "role": self.role,
            "duration_seconds": int(duration.total_seconds()),
            "score_breakdown": self.scores,
            "overall_score": round(total_score, 1),
            "suspicious_events": self.suspicious_events,
            "hiring_recommendation": "Strong Hire" if total_score >= 8 else "Hire" if total_score >= 6 else "No Hire",
            "timestamp": datetime.now().isoformat()
        }
        
        return json.dumps(report, indent=4)

    def save_report(self, file_path: str):
        """
        Saves the report to a file.
        """
        report_json = self.generate_report()
        with open(file_path, "w") as f:
            f.write(report_json)
        logger.info(f"Report saved to {file_path}")
