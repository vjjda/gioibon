# Path: src/data_builder/labeler.py
import re
from typing import Dict

__all__ = ["ContentLabeler"]

class ContentLabeler:
    # Bản đồ ánh xạ Heading 1 sang Prefix label
    SECTION_MAP: Dict[str, str] = {
        "THUYẾT GIỚI TRIỆT KHAI": "pj",
        "THUYẾT GIỚI TĂNG TÀNG": "ss",
        "THUYẾT GIỚI BẤT ĐỊNH": "ay",
        "THUYẾT GIỚI ƯNG XẢ ĐỐI TRỊ": "np",
        "THUYẾT GIỚI ƯNG ĐỐI TRỊ": "pc",
        "THUYẾT GIỚI ƯNG PHÁT LỘ": "pd",
        "THUYẾT GIỚI ƯNG HỌC PHÁP": "sk",
        "THUYẾT GIỚI DÀN XẾP TRANH TỤNG": "as"
    }

    def __init__(self):
        self.current_main_section = ""
        self.current_prefix = ""
        self.in_rule_zone = False
        self.nidana_sub_section = "" # "opening", "main", "ending"

    def update_context(self, heading_text: str, level: int):
        clean_heading = heading_text.strip().upper()
        
        if level == 1:
            if "MỞ ĐẦU" in clean_heading:
                self.current_main_section = "nidana"
                self.nidana_sub_section = "opening"
            elif "KẾT THÚC" in clean_heading:
                self.current_main_section = "end"
            elif clean_heading in self.SECTION_MAP:
                self.current_main_section = self.SECTION_MAP[clean_heading]
                self.in_rule_zone = False
            else:
                self.current_main_section = "other"
            self.current_prefix = self.current_main_section
            
        elif level == 2 and self.current_main_section == "nidana":
            if "TỤNG PHẦN MỞ ĐẦU" in clean_heading:
                self.nidana_sub_section = "main"
            elif "KẾT PHẦN MỞ ĐẦU" in clean_heading:
                self.nidana_sub_section = "ending"

    def get_label(self, is_rule: bool = False, rule_no: str = "") -> str:
        if self.current_main_section == "nidana":
            return f"nidana-{self.nidana_sub_section}" if self.nidana_sub_section != "main" else "nidana"
        
        if self.current_main_section == "end":
            return "end"

        if is_rule:
            self.in_rule_zone = True
            # Format: Pj 1, Ss 1...
            return f"{self.current_prefix.capitalize()} {rule_no}"
        
        if not self.in_rule_zone:
            return f"{self.current_prefix}-opening"
        else:
            return f"{self.current_prefix}-ending"