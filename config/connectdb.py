from pymongo import MongoClient
from typing import Any, Dict, List, Optional
from urllib.parse import quote_plus

class MongoDBBase:
    def __init__(self):
        username = 'system'
        password = '123456@Abc'  # Có dấu @ nên phải encode
        username = quote_plus(username)
        password = quote_plus(password)
        uri = f'mongodb+srv://{username}:{password}@aiml.80jrsdf.mongodb.net/?retryWrites=true&w=majority&appName=AIML'
        self.client = MongoClient(uri)
        self.db = self.client['cukuck']

    def get_collection(self, collection_name: str):
        """Trả về collection"""
        return self.db[collection_name]

    def insert_one(self, collection_name: str, data: Dict[str, Any]) -> str:
        """Thêm 1 document"""
        result = self.get_collection(collection_name).insert_one(data)
        return str(result.inserted_id)

    def insert_many(self, collection_name: str, data_list: List[Dict[str, Any]]) -> List[str]:
        """Thêm nhiều document"""
        result = self.get_collection(collection_name).insert_many(data_list)
        return [str(_id) for _id in result.inserted_ids]

    def find(self, collection_name: str, query: Dict[str, Any] = {}, projection: Optional[Dict[str, int]] = None) -> List[Dict[str, Any]]:
        """Tìm nhiều document"""
        return list(self.get_collection(collection_name).find(query, projection))

    def find_one(self, collection_name: str, query: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Tìm 1 document"""
        return self.get_collection(collection_name).find_one(query)

    def update_one(self, collection_name: str, query: Dict[str, Any], new_values: Dict[str, Any]) -> int:
        """Cập nhật 1 document"""
        result = self.get_collection(collection_name).update_one(query, {"$set": new_values})
        return result.modified_count
    def find_all(self, collection_name: str, projection: Optional[Dict[str, int]] = None) -> List[Dict[str, Any]]:
        return list(self.get_collection(collection_name).find({}, projection))
    def delete_one(self, collection_name: str, query: Dict[str, Any]) -> int:
        """Xóa 1 document"""
        result = self.get_collection(collection_name).delete_one(query)
        return result.deleted_count

    def delete_many(self, collection_name: str, query: Dict[str, Any]) -> int:
        """Xóa nhiều document"""
        result = self.get_collection(collection_name).delete_many(query)
        return result.deleted_count