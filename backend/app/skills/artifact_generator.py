# backend/app/skills/artifact_generator.py
import re
from typing import List, Dict, Any

ARTIFACT_REGEX = re.compile(
    r'<artifact\s+type=[\'"](html|markdown)[\'"]\s+title=[\'"]([^\'"]+)[\'"]\s*>(.*?)</artifact>',
    re.DOTALL | re.IGNORECASE
)

def extract_artifacts_from_text(text: str) -> List[Dict[str, str]]:
    """
    Scans a generated response for <artifact type="..." title="...">...</artifact> tags.
    Returns a list of extracted artifact dicts: [{artifact_type, title, content}].
    """
    artifacts = []
    matches = ARTIFACT_REGEX.findall(text)
    for match in matches:
        artifact_type = match[0].lower()
        title = match[1].strip()
        content = match[2].strip()
        artifacts.append({
            "artifact_type": artifact_type,
            "title": title,
            "content": content
        })
    return artifacts

def clean_response_text(text: str) -> str:
    """
    Strips raw <artifact...>...</artifact> container tags from conversational text
    so that only polished narrative is displayed in the chat bubble.
    """
    cleaned = re.sub(r'<artifact\s+type=[\'"][^\'"]*[\'"]\s+title=[\'"][^\'"]*[\'"]\s*>', '', text, flags=re.IGNORECASE)
    cleaned = re.sub(r'<artifact[^>]*>', '', cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r'</artifact>', '', cleaned, flags=re.IGNORECASE)
    return cleaned.strip()
