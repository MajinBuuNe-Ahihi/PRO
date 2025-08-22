from typing import List, Any
from datetime import datetime
class Customer:
    def __init__(self, data: dict):
        self.CustomerID = data.get("CustomerID")
        self.CustomerCode = data.get("CustomerCode")
        self.CustomerName = data.get("CustomerName")
        self.CustomerNameDisplay = data.get("CustomerNameDisplay")
        self.Tel = data.get("Tel")
        self.Inactive = data.get("Inactive")
        self.Amount = data.get("Amount")
        self.FirstName = data.get("FirstName")
        self.ContactPrefix = data.get("ContactPrefix")
        self.Is5FoodMember = data.get("Is5FoodMember")
        self.ImportListError = data.get("ImportListError", [])
        self.ImportRowIndex = data.get("ImportRowIndex")
        self.EditVersion = data.get("EditVersion")
        self.IsFristActive5food = data.get("IsFristActive5food")
        self.IsAddTo5Food = data.get("IsAddTo5Food")
        self.AddressNote = data.get("AddressNote")
        self.EditMode = data.get("EditMode")
        created_str = data.get("CreatedDate")
        self.CreatedDate = datetime.fromisoformat(created_str.replace("Z", "+00:00")) if created_str else None
        self.CreatedBy = data.get("CreatedBy")
        modified_str = data.get("ModifiedDate")
        self.ModifiedDate = datetime.fromisoformat(modified_str.replace("Z", "+00:00")) if modified_str else None
        self.ModifiedBy = data.get("ModifiedBy")
        self.IsGenerate = data.get("IsGenerate")
    def __repr__(self):
        return f"<Customer {self.CustomerCode} - {self.CustomerName}>"