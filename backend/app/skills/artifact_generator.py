# backend/app/skills/artifact_generator.py
import re
from typing import List, Dict, Any

# 1. Closed artifact regex (handles standard <artifact>, bolded **<artifact...>** or **artifact type=...**)
ARTIFACT_REGEX = re.compile(
    r'(?:\*{0,3}|`{0,3}|\[)?\s*<artifact\s+type=[\'"](html|markdown)[\'"]\s+title=[\'"]([^\'"]+)[\'"]\s*>(?:\*{0,3}|`{0,3}|\])?\s*(.*?)\s*(?:\*{0,3}|`{0,3}|\[)?\s*</artifact\s*>(?:\*{0,3}|`{0,3}|\])?',
    re.DOTALL | re.IGNORECASE
)

# 2. Relaxed unbracketed closed regex e.g. ** artifact type="markdown" title="..."** ... </artifact>
RELAXED_ARTIFACT_REGEX = re.compile(
    r'(?:\*{1,3}|`{1,3})\s*artifact\s+type=[\'"](html|markdown)[\'"]\s+title=[\'"]([^\'"]+)[\'"]\s*(?:\*{1,3}|`{1,3})\s*(.*?)\s*(?:</artifact\s*>\s*(?:\*{0,3}|`{0,3})?|(?=\n\n|\Z))',
    re.DOTALL | re.IGNORECASE
)

# 3. Partial unclosed artifact regex
PARTIAL_ARTIFACT_REGEX = re.compile(
    r'(?:\*{0,3}|`{0,3}|\[)?\s*<artifact\s+type=[\'"](html|markdown)[\'"]\s+title=[\'"]([^\'"]+)[\'"]\s*>(?:\*{0,3}|`{0,3}|\])?\s*(.*)',
    re.DOTALL | re.IGNORECASE
)

PARTIAL_RELAXED_REGEX = re.compile(
    r'(?:\*{1,3}|`{1,3})\s*artifact\s+type=[\'"](html|markdown)[\'"]\s+title=[\'"]([^\'"]+)[\'"]\s*(?:\*{1,3}|`{1,3})\s*(.*)',
    re.DOTALL | re.IGNORECASE
)

def clean_artifact_content(content: str) -> str:
    """
    Strips raw XML/artifact tags, bold wrappers, and improper markdown underlines from artifact body.
    """
    if not content:
        return ""
    cleaned = content.strip()
    
    # Strip any leading artifact tag variants
    cleaned = re.sub(r'^(?:\*{0,3}|`{0,3}|\[)?\s*<artifact\s+type=[\'"][^\'"]*[\'"]\s+title=[\'"][^\'"]*[\'"]\s*>(?:\*{0,3}|`{0,3}|\])?\s*', '', cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r'^(?:\*{1,3}|`{1,3})\s*artifact\s+type=[\'"][^\'"]*[\'"]\s+title=[\'"][^\'"]*[\'"]\s*(?:\*{1,3}|`{1,3})\s*', '', cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r'^<artifact[^>]*>\s*', '', cleaned, flags=re.IGNORECASE)
    
    # Strip any trailing </artifact> variants
    cleaned = re.sub(r'\s*(?:\*{0,3}|`{0,3}|\[)?\s*</artifact\s*>(?:\*{0,3}|`{0,3}|\])?\s*$', '', cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r'</artifact\s*>', '', cleaned, flags=re.IGNORECASE)

    # Strip malformed double underline lines at start
    cleaned = re.sub(r'^\s*={3,}\s*\n', '', cleaned)
    cleaned = re.sub(r'^\s*-{3,}\s*\n', '', cleaned)
    
    return cleaned.strip()

def extract_artifacts_from_text(text: str) -> List[Dict[str, str]]:
    """
    Scans a generated response for artifact tags (standard & bolded/relaxed variants).
    Returns a list of extracted artifact dicts: [{artifact_type, title, content}].
    """
    if not text:
        return []

    artifacts = []
    # 1. Closed standard & bolded artifacts
    matches = ARTIFACT_REGEX.findall(text)
    for match in matches:
        artifact_type = match[0].lower()
        title = match[1].strip()
        content = clean_artifact_content(match[2])
        if len(content) > 3:
            artifacts.append({
                "artifact_type": artifact_type,
                "title": title,
                "content": content
            })

    # 2. Relaxed unbracketed artifacts (e.g. ** artifact type="markdown" title="..."**)
    if not artifacts:
        relaxed_matches = RELAXED_ARTIFACT_REGEX.findall(text)
        for match in relaxed_matches:
            artifact_type = match[0].lower()
            title = match[1].strip()
            content = clean_artifact_content(match[2])
            if len(content) > 3:
                artifacts.append({
                    "artifact_type": artifact_type,
                    "title": title,
                    "content": content
                })

    # 3. Partial / unclosed standard artifact
    if not artifacts:
        partial = PARTIAL_ARTIFACT_REGEX.search(text)
        if partial:
            artifact_type = partial.group(1).lower()
            title = partial.group(2).strip()
            content = clean_artifact_content(partial.group(3))
            if len(content) > 3:
                artifacts.append({
                    "artifact_type": artifact_type,
                    "title": title,
                    "content": content
                })

    # 4. Partial / unclosed relaxed artifact
    if not artifacts:
        partial_rel = PARTIAL_RELAXED_REGEX.search(text)
        if partial_rel:
            artifact_type = partial_rel.group(1).lower()
            title = partial_rel.group(2).strip()
            content = clean_artifact_content(partial_rel.group(3))
            if len(content) > 3:
                artifacts.append({
                    "artifact_type": artifact_type,
                    "title": title,
                    "content": content
                })

    return artifacts

def clean_response_text(text: str) -> str:
    """
    Strips raw <artifact...>...</artifact> container tags and unbracketed artifact leaks
    from conversational text so that only polished narrative is displayed in the chat bubble.
    """
    if not text:
        return ""

    # Remove complete artifact blocks
    cleaned = ARTIFACT_REGEX.sub('', text)
    cleaned = RELAXED_ARTIFACT_REGEX.sub('', cleaned)

    # Remove unclosed artifact tag and trailing body
    cleaned = PARTIAL_ARTIFACT_REGEX.sub('', cleaned)
    cleaned = PARTIAL_RELAXED_REGEX.sub('', cleaned)

    # Clean stray residual tags
    cleaned = re.sub(r'(?:\*{0,3}|`{0,3}|\[)?\s*<artifact[^>]*>(?:\*{0,3}|`{0,3}|\])?', '', cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r'(?:\*{0,3}|`{0,3}|\[)?\s*</artifact\s*>(?:\*{0,3}|`{0,3}|\])?', '', cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r'(?:\*{1,3}|`{1,3})\s*artifact\s+type=[\'"][^\'"]*[\'"]\s+title=[\'"][^\'"]*[\'"]\s*(?:\*{1,3}|`{1,3})', '', cleaned, flags=re.IGNORECASE)

    # Strip any dangling artifact lead-in headers left behind (e.g. "**Artifact:", "**Artifact:**", "### Artifact:", "Artifact:")
    cleaned = re.sub(r'(?:\n+|^)\s*(?:\*{0,3}|#{1,6}\s*)?Artifact(?:\s+created)?(?::|\*{0,2})?\s*$', '', cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r'\*{1,3}Artifact:?\*{0,3}\s*$', '', cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r'Artifact:\s*$', '', cleaned, flags=re.IGNORECASE)

    return cleaned.strip()
