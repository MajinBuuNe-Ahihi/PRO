import os
import json
from typing import Any, List, Dict, Optional
from bson import ObjectId
from dotenv import load_dotenv
import google.generativeai as genai

from agno.tools import Toolkit, tool
from config.connectdb import MongoDBBase

# ===============================
# Load API key Gemini
# ===============================
load_dotenv()
api_key = os.getenv("GEMINI_API_KEY")
genai.configure(api_key=api_key)

# Tạo model Gemini (chỉ nếu cần AI xử lý thêm)
model = genai.GenerativeModel("gemini-1.5-flash")


# ===============================
# Helper: convert ObjectId -> str
# ===============================
def convert_objectid(d):
    if isinstance(d, list):
        return [convert_objectid(item) for item in d]
    if isinstance(d, dict):
        return {
            k: (str(v) if isinstance(v, ObjectId) else convert_objectid(v))
            for k, v in d.items()
        }
    return d


# ===============================
# Lấy dữ liệu từ MongoDB
# ===============================
db = MongoDBBase()

customer: List[Dict] = db.find_all("customer")
customer_cleaned = convert_objectid(customer)

debtcustomer: List[Dict] = db.find_all("debtcustomer")
debtcustomer_cleaned = convert_objectid(debtcustomer)


# ===============================
# Định nghĩa Tool
# ===============================
class CustomerTools(Toolkit):
    def __init__(
        self,
        search: bool = True,
        news: bool = True,
        modifier: Optional[str] = None,
        fixed_max_results: Optional[int] = None,
        headers: Optional[Any] = None,
        proxy: Optional[str] = None,
        timeout: Optional[int] = 10,
        verify_ssl: bool = True,
        region: Optional[str] = "vn-vi",
        **kwargs,
        ):
        self.headers: Optional[Any] = headers
        self.proxy: Optional[str] = proxy
        self.timeout: Optional[int] = timeout
        self.fixed_max_results: Optional[int] = fixed_max_results
        self.modifier: Optional[str] = modifier
        self.verify_ssl: bool = verify_ssl
        self.region: Optional[str] = region

        tools: List[Any] = []
        if search:
            tools.append(self.debtcustomer_search)
        if news:
            tools.append(self.debtcustomer_search)

        super().__init__(name="duckduckgo", tools=tools, **kwargs)

    def debtcustomer_search(self, query: str, max_results: int = 5) -> str:
        """
        Tìm kiếm thông tin khách hàng đang nợ trong cơ sở dữ liệu nội bộ.
        - query: tên hoặc thông tin liên quan đến khách hàng
        - max_results: số kết quả tối đa cần trả về
        """
        print("hvmanh result: ",debtcustomer_cleaned)
        # Lọc dữ liệu trong bộ nhớ thay vì AI để đơn giản
        results = []
        for item in debtcustomer_cleaned:
            if query.lower() in json.dumps(item, ensure_ascii=False).lower():
                results.append(item)
            if len(results) >= max_results:
                break
        if not results:
            return json.dumps(
                {"message": "Không tìm thấy khách hàng nào phù hợp."},
                ensure_ascii=False,
                indent=2
            )

        return json.dumps(
            {"query": query, "results": results},
            ensure_ascii=False,
            indent=2
        )