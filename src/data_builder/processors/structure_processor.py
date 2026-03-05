# Path: src/data_builder/processors/structure_processor.py
import re
import csv
from typing import List, Dict, Optional, Tuple

from src.data_builder.models import RuleData, HeadingData
from src.data_builder.processors.base import strip_html_tags

__all__ = ["StructureProcessor"]

class StructureProcessor:
    """Quản lý và theo dõi cấu trúc phân cấp Heading và Rule."""

    def __init__(self, rule_groups_path: str):
        self.rules: List[RuleData] = []
        self.headings: List[HeadingData] = []
        
        self.current_heading_path: List[HeadingData] = []
        self.current_heading_id: Optional[int] = None
        self.current_rule_id: Optional[str] = None
        
        self._load_rule_groups(rule_groups_path)

    def _load_rule_groups(self, path: str):
        """Nạp danh sách Rule Groups từ file TSV."""
        try:
            with open(path, 'r', encoding='utf-8') as f:
                reader = csv.DictReader(f, delimiter='\t')
                for row in reader:
                    self.rules.append(RuleData(
                        id=row['id'],
                        type=int(row['type']),
                        acronym=row.get('acronym', ''),
                        pali=row['pali'],
                        viet=row['viet'],
                        group=row['group'] if row['group'] else None
                    ))
        except FileNotFoundError:
            import logging
            logger = logging.getLogger(__name__)
            logger.warning(f"Không tìm thấy file {path}. Bỏ qua nạp Rule Groups.")

    def process_segment(self, uid: int, html_template: str, label: str, raw_text: str) -> Tuple[Optional[int], Optional[str]]:
        """
        Xử lý từng segment để trích xuất Heading và Rule.
        Trả về (heading_id, rule_id) cho segment hiện tại.
        """
        # Nếu là thẻ heading (h1-h6)
        heading_match = re.match(r'^<h([1-6])', html_template, re.IGNORECASE)
        if heading_match:
            level = int(heading_match.group(1))
            clean_text = strip_html_tags(raw_text).strip()
            
            # Cập nhật heading path (bỏ các heading có level >= level hiện tại)
            self.current_heading_path = [h for h in self.current_heading_path if h.level < level]
            
            parent_uid = self.current_heading_path[-1].uid if self.current_heading_path else None
            
            # Tạo breadcrumbs
            path_texts = [h.text for h in self.current_heading_path] + [clean_text]
            breadcrumbs = " > ".join(path_texts)
            
            heading_data = HeadingData(
                uid=uid,
                text=clean_text,
                level=level,
                parent_uid=parent_uid,
                breadcrumbs=breadcrumbs
            )
            self.headings.append(heading_data)
            self.current_heading_path.append(heading_data)
            self.current_heading_id = uid
            
            # Nếu Heading là một Rule name
            if label.endswith('-name'):
                self._extract_rule(label, clean_text)
            elif level <= 2:
                # Thường khi chuyển sang chapter mới (h1, h2), rule_id sẽ bị reset
                self.current_rule_id = None
                
        # Nếu là rule-name nhưng không phải heading (ít xảy ra)
        elif label.endswith('-name'):
            clean_text = strip_html_tags(raw_text).strip()
            self._extract_rule(label, clean_text)

        return self.current_heading_id, self.current_rule_id

    def _extract_rule(self, label: str, raw_text: str):
        """Trích xuất Rule từ nhãn -name."""
        rule_id = label.replace('-name', '')
        
        # Tìm group bằng cách lấy chữ cái đầu
        group_match = re.match(r'^([a-z]+)', rule_id, re.IGNORECASE)
        group = group_match.group(1) if group_match else None
        
        # Tạo acronym (VD: ss1 -> Ss 1)
        acronym = ""
        acronym_match = re.match(r'^([a-z]+)(\d+)?$', rule_id, re.IGNORECASE)
        if acronym_match:
            prefix = acronym_match.group(1).capitalize()
            number = f" {acronym_match.group(2)}" if acronym_match.group(2) else ""
            acronym = f"{prefix}{number}"
        
        # Trích xuất pali và viet
        # Format thường gặp: Pj 1. Tên Tiếng Việt (Pali Name)
        m = re.match(r'^(?:.*?\.\s*)?(.*?)(?:\s*\((.*?)\))?$', raw_text)
        viet = raw_text
        pali = ""
        if m:
            viet = m.group(1).strip() if m.group(1) else raw_text
            pali = m.group(2).strip() if m.group(2) else ""
            
        self.rules.append(RuleData(
            id=rule_id,
            type=1, # 1: rule
            acronym=acronym,
            pali=pali,
            viet=viet,
            group=group
        ))
        self.current_rule_id = rule_id

    def get_rules(self) -> List[RuleData]:
        return self.rules

    def get_headings(self) -> List[HeadingData]:
        return self.headings
