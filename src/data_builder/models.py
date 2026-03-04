# Path: src/data_builder/models.py
from pydantic import BaseModel, Field

__all__ = ["SourceSegmentData", "SegmentData"]

class SourceSegmentData(BaseModel):
    html: str = Field(description="Template HTML với placeholder {}")
    label: str = Field(description="Nhãn phân loại nội dung (ví dụ: pj-opening, pj1, nidana)")
    segment: str = Field(description="Nội dung văn bản của segment")

class SegmentData(SourceSegmentData):
    uid: int = Field(description="ID duy nhất của segment")
    audio: str = Field(description="Tên file audio (ví dụ: 001_title_1.mp3)")
    segment_html: str = Field(description="Nội dung văn bản đã làm giàu (thẻ b, span...) để hiển thị")
    has_hint: int = Field(description="Cờ hiệu có hỗ trợ hint hay không (0 hoặc 1)")
