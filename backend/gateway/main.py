import os
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from livekit import api
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="AI Interview Gateway")

# Enable CORS for frontend connection
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # In production, replace with your frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class TokenRequest(BaseModel):
    room_name: str
    participant_name: str

@app.get("/")
async def root():
    return {"message": "AI Interview Gateway is running"}

@app.post("/token")
async def get_token(request: TokenRequest):
    """
    Generates a LiveKit access token for a candidate to join an interview room.
    """
    lk_api_key = os.getenv("LIVEKIT_API_KEY")
    lk_api_secret = os.getenv("LIVEKIT_API_SECRET")

    if not lk_api_key or not lk_api_secret:
        raise HTTPException(status_code=500, detail="LiveKit credentials not configured")

    # Create an access token
    token = api.AccessToken(lk_api_key, lk_api_secret) \
        .with_identity(request.participant_name) \
        .with_name(request.participant_name) \
        .with_grants(api.VideoGrants(
            room_join=True,
            room=request.room_name,
            can_publish=True,
            can_subscribe=True,
            can_publish_data=True
        ))

    return {"token": token.to_jwt()}

@app.get("/report/{candidate_name}")
async def get_report(candidate_name: str):
    """
    Placeholder for retrieving the interview report.
    """
    report_path = f"reports/{candidate_name}_report.json"
    if os.path.exists(report_path):
        with open(report_path, "r") as f:
            import json
            return json.load(f)
    return {"error": "Report not found"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
