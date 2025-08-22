from typing import Optional
class DebtCustomer:
    def __init__(self, data: dict):
        self.RowNum: Optional[int] = data.get("RowNum")
        self.CustomerID: Optional[str] = data.get("CustomerID")
        self.CustomerCode: Optional[str] = data.get("CustomerCode")
        self.CustomerName: Optional[str] = data.get("CustomerName")
        self.FirstDeptAmount: Optional[float] = data.get("FirstDeptAmount")
        self.IncreaseAmount: Optional[float] = data.get("IncreaseAmount")
        self.DecreaseAmount: Optional[float] = data.get("DecreaseAmount")
        self.LastDeptAmount: Optional[float] = data.get("LastDeptAmount")
    
    def __repr__(self):
        return (f"<DebtCustomer {self.CustomerCode} - {self.CustomerName} | "
                f"Debt: {self.LastDeptAmount}>")