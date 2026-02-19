# Path: src/data_builder/models.py
from typing import Optional
from pydantic import BaseModel, Field

__all__ = ["SegmentData"]

class SegmentData(BaseModel):
    uid: int = Field(description="ID duy nhất của segment")
    html: str = Field(description="Template HTML với placeholder {}")
    label: str = Field(description="Nhãn phân loại nội dung (ví dụ: pj-opening, Pj 1, nidana)")
    segment: str = Field(description="Nội dung văn bản của segment")