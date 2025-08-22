from fastapi import FastAPI, Request, Form
from fastapi.responses import StreamingResponse, HTMLResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from openai import OpenAI
from typing import List, Dict
from pydantic import BaseModel
from dotenv import load_dotenv
import json
import os
import pathlib

# Load environment variables
load_dotenv()

class ChatRequest(BaseModel):
    message: str
    session_id: str = ""

app = FastAPI(title="Restaurant AI Agent", version="1.0.0")

# Cấu hình CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Cấu hình templates và static files
current_dir = pathlib.Path(__file__).parent.parent
templates = Jinja2Templates(directory=str(current_dir / "templates"))
app.mount("/static", StaticFiles(directory=str(current_dir / "static")), name="static")

# Kiểm tra API key
api_key = os.getenv("OPENAI_API_KEY", "")
if not api_key:
    print("⚠️  Cảnh báo: Không tìm thấy OPENAI_API_KEY trong file .env")

client = OpenAI(api_key=api_key)

def create_chat_prompt(message: str, context: str = "") -> str:
    """Tạo prompt cho AI Agent nhà hàng"""
    return f"""
Bạn là trợ lý AI cho nhà hàng. Dựa trên yêu cầu của người dùng, hãy trả lời một cách hữu ích và thân thiện.

Yêu cầu của người dùng: {message}

Ngữ cảnh trước đó: {context}

Hãy trả lời bằng tiếng Việt một cách tự nhiên và hữu ích.
"""

def event_stream(message: str, context: str = ""):
    """Stream response từ OpenAI"""
    try:
        prompt = create_chat_prompt(message, context)
        
        stream = client.chat.completions.create(
            model="gpt-4.1",
            messages=[
                {"role": "system", "content": "Bạn là trợ lý AI thông minh cho nhà hàng. Trả lời bằng tiếng Việt."},
                {"role": "user", "content": prompt}
            ],
            stream=True,
            temperature=0.7
        )
        
        for chunk in stream:
            if chunk.choices[0].delta.content:
                yield chunk.choices[0].delta.content
                
    except Exception as e:
        yield f"Lỗi: {str(e)}"

@app.get("/")
async def home(request: Request):
    """Trang chủ với giao diện chat"""
    return templates.TemplateResponse("index.html", {"request": request})

@app.post("/chat")
def chat_stream(request: ChatRequest):
    """API chat với streaming response"""
    return StreamingResponse(
        event_stream(request.message),
        media_type="text/plain"
    )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
