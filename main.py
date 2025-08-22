# Main.py (fixed with markdown)

import json
import os
import pathlib
from textwrap import dedent
from typing import List, Dict, Optional

from ddgs import DDGS
from fastapi import FastAPI, Request, Form
from fastapi.responses import StreamingResponse, HTMLResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from openai import OpenAI
from pydantic import BaseModel
from dotenv import load_dotenv

# Import các thư viện từ agno
from agno.agent import Agent
from agno.models.openai import OpenAIChat

# Import công cụ DuckDuckGoTools đã được sửa lỗi
from DuckDuckGoTools import DuckDuckGoTools

# Load environment variables từ file .env
load_dotenv()

# Các Pydantic model để xác thực dữ liệu từ request
class ChatRequest(BaseModel):
    message: str
    session_id: str = ""
    use_search: Optional[bool] = False

class SearchRequest(BaseModel):
    query: str
    max_results: Optional[int] = 5

# Khởi tạo FastAPI app
app = FastAPI(title="Restaurant AI Agent", version="1.0.0")

# Cấu hình CORS để cho phép các domain khác truy cập API
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

# Khởi tạo OpenAI client
client = OpenAI(api_key=api_key)

# Khởi tạo công cụ DuckDuckGoTools
ddg_tools = DuckDuckGoTools(search=True, news=False, verify_ssl=False, region="vn-vi")

# Định nghĩa Agent chính để xử lý các truy vấn tìm kiếm
# Agent này sẽ tự động gọi Tool dựa trên instructions
duck_agent = Agent(
    # Sử dụng mô hình gpt-4o-mini
    model=OpenAIChat(id="gpt-4.1"),
    instructions=dedent("""
    Bạn là một AI Agent chatbot hỗ trợ phần mề quản lý nhà hàng. Phần mềm tên CUKCUK. thuộc công ty MISA.
        Bạn là trợ lý web search. Khi người dùng hỏi và bật search,
        hãy gọi tool duckduckgo.duckduckgo_search để lấy kết quả liên quan.
        Sau đó, tóm tắt ngắn gọn kết quả và đưa ra 2-3 liên kết hữu ích.
        Sử dụng định dạng Markdown để trình bày kết quả.
        Tóm tắt phải **ngắn gọn, xúc tích** và các liên kết phải được liệt kê bằng dấu gạch đầu dòng.
        Ví dụ:
        **[Tiêu đề tóm tắt]**
        - [Tên trang web]: [Link]
        - [Tên trang web]: [Link]
    """),
    tools=[ddg_tools],
    show_tool_calls=True,
    # Cần bật markdown=True để Agent trả về response có định dạng Markdown
    markdown=True,
)

def create_chat_prompt(message: str, context: str = "") -> str:
    """Tạo prompt cho AI Agent nhà hàng"""
    return f"""
Bạn là trợ lý AI cho nhà hàng. Dựa trên yêu cầu của người dùng, hãy trả lời một cách hữu ích và thân thiện.

Yêu cầu của người dùng: {message}

Ngữ cảnh trước đó: {context}

Hãy trả lời bằng tiếng Việt một cách tự nhiên và hữu ích.
"""

def event_stream(message: str, context: str = "", search_results: Optional[list] = None):
    """Stream response từ OpenAI"""
    try:
        prompt = create_chat_prompt(message, context)
        system_content = " Bạn là một AI Agent chatbot hỗ trợ phần mề quản lý nhà hàng. Phần mềm tên CUKCUK. thuộc công ty MISA."
        "Bạn là trợ lý AI thông minh cho nhà hàng. Trả lời bằng tiếng Việt."
        if search_results:
            system_content += f"\nsearch_results: {json.dumps(search_results, ensure_ascii=False)}"
        
        stream = client.chat.completions.create(
            model="gpt-4.1", 
            messages=[
                {"role": "system", "content": system_content},
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
    """API chat với streaming response, có thể kèm search tool"""
    if request.use_search and request.message:
        print("log chat tim kiem")
        def gen():
            try:
                # Agent sẽ tự động gọi tool và tạo ra câu trả lời theo instructions đã định nghĩa
                text = duck_agent.run(request.message)
                yield str(text.content)
            except Exception as e:
                yield f"Loi {str(e)}"
        return StreamingResponse(gen(), media_type="text/plain")
    else:
        print("log chat thuong")
        return StreamingResponse(
            event_stream(request.message, search_results=None),
            media_type="text/plain"
        )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
