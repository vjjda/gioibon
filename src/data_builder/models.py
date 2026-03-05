# Path: src/data_builder/models.py
from typing import List, Optional
from pydantic import BaseModel, Field

__all__ = ["SourceSegmentData", "SegmentData", "RuleData", "HeadingData"]

class SourceSegmentData(BaseModel):
    html: str = Field(description="Template HTML với placeholder {}")
    label: str = Field(description="Nhãn phân loại nội dung")
    segment: str = Field(description="Nội dung văn bản của segment")

class RuleData(BaseModel):
    id: str = Field(description="Mã định danh (VD: ss, ss1)")
    type: int = Field(description="0: group, 1: rule")
    pali: str = Field(description="Tên tiếng Pali")
    viet: str = Field(description="Tên tiếng Việt")
    group: Optional[str] = Field(None, description="Mã nhóm cha (nếu có)")

class HeadingData(BaseModel):
    uid: int = Field(description="UID của segment chứa tiêu đề này")
    text: str = Field(description="Nội dung văn bản thô của tiêu đề")
    level: int = Field(description="Cấp độ tiêu đề (1-4)")
    parent_uid: Optional[int] = Field(None, description="UID của tiêu đề cha")
    breadcrumbs: str = Field(description="Chuỗi đường dẫn phân cấp (VD: Tiền Sự > Tác Bạch)")

class SegmentData(SourceSegmentData):
    uid: int = Field(description="ID duy nhất của segment")
    audio: str = Field(description="Tên file audio")
    segment_html: str = Field(description="Nội dung văn bản hiển thị (HTML)")
    has_hint: int = Field(description="Cờ hiệu hint (0/1)")
    heading_id: Optional[int] = Field(None, description="ID tiêu đề trực thuộc")
    rule_id: Optional[str] = Field(None, description="ID luật trực thuộc")
