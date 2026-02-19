# Path: src/data_builder/rule_mapper.py
import re
import logging
from typing import Dict

logger = logging.getLogger(__name__)

__all__ = ["RuleMapper"]

class RuleMapper:
    # Ánh xạ từ khóa category tiếng Pali sang Prefix chuẩn
    PREFIX_MAP: Dict[str, str] = {
        "Pārājika": "Pj",
        "Saṅghādisesa": "Ss",
        "Aniyata": "Ay",
        "Nissaggiya Pācittiya": "Np",
        "Pācittiya": "Pc",
        "Pāṭidesanīya": "Pd",
        "Sekhiya": "Sk",
        "Adhikaraṇasamatha": "As"
    }

    def __init__(self, pali_file_path: str):
        self.rule_names: Dict[str, str] = {}
        self._load_and_parse(pali_file_path)

    def _load_and_parse(self, filepath: str) -> None:
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                content = f.read()
        except FileNotFoundError:
            logger.error(f"❌ Không tìm thấy file Pali: {filepath}. Bỏ qua việc tạo nhãn tên Rule.")
            return

        # Phân tích từng dòng để tìm Heading Level 4
        for line in content.split('\n'):
            line = line.strip()
            if line.startswith("#### "):
                text = line[5:].strip() # Loại bỏ "#### "
                
                # Bắt mẫu: Category + Số + (Tùy chọn: Dấu chấm và Tên)
                # Ví dụ 1: "Pārājika 1. Methunadhamma"
                # Ví dụ 2: "Sekhiya 2."
                # Ví dụ 3: "Adhikaraṇasamatha 1"
                match = re.match(r'^([^\d]+)\s+(\d+)(?:\.\s*(.*))?$', text)
                if match:
                    category = match.group(1).strip()
                    number = match.group(2).strip()
                    name = match.group(3).strip() if match.group(3) else ""

                    if category in self.PREFIX_MAP:
                        prefix = self.PREFIX_MAP[category]
                        label = f"{prefix.lower()}{number}" # VD: pj1, ss2
                        
                        if name:
                            formatted_name = f"{prefix} {number}. {name}"
                        else:
                            formatted_name = f"{prefix} {number}"
                            
                        self.rule_names[label] = formatted_name

    def get_rule_name(self, label: str) -> str:
        """Trả về tên định dạng của rule dựa trên label, trả về chuỗi rỗng nếu không có."""
        return self.rule_names.get(label, "")