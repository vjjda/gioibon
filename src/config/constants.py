# Path: src/config/constants.py
from pathlib import Path

# Base Directories
# src/config/constants.py -> src/config -> src -> project_root
PROJECT_ROOT = Path(__file__).parent.parent.parent.resolve()
DATA_DIR = PROJECT_ROOT / "data"
WEB_DIR = PROJECT_ROOT / "web"

# Input/Output Paths
INPUT_MARKDOWN_PATTERN = str(DATA_DIR / "Gioi bon Viet/*.md")
OUTPUT_JSON_PATH = str(WEB_DIR / "data/content.json")

# Regex Patterns
RULE_PATTERN_REGEX = r'^\s*(\d+)(?:\|\.)\.\s+(.*)'
TITLE_MATCH_REGEX = r'^#\s+(.*)'

# Special Rule Identifiers
RULE_24_IDENTIFIER = "(Biết rằng): 'Mùa nóng còn lại là một tháng' vị tỳ khưu nên tìm kiếm y choàng tắm mưa."
