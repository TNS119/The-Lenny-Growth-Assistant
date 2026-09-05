try:
    import pytest
except ImportError:
    class MockPytest:
        class mark:
            @staticmethod
            def asyncio(fn):
                return fn
    pytest = MockPytest()
from app.skills.artifact_generator import extract_artifacts_from_text, clean_response_text, clean_artifact_content

def test_standard_artifact_extraction():
    raw = (
        "Here is an overview.\n"
        "<artifact type=\"markdown\" title=\"Ship 30 Essay: High Agency\">\n"
        "# High Agency PM\n"
        "- **Speed:** Move fast.\n"
        "</artifact>\n"
        "Let me know what you think!"
    )
    artifacts = extract_artifacts_from_text(raw)
    assert len(artifacts) == 1
    assert artifacts[0]["artifact_type"] == "markdown"
    assert artifacts[0]["title"] == "Ship 30 Essay: High Agency"
    assert "High Agency PM" in artifacts[0]["content"]

    cleaned_text = clean_response_text(raw)
    assert "<artifact" not in cleaned_text
    assert "</artifact>" not in cleaned_text
    assert "Here is an overview." in cleaned_text

def test_bolded_artifact_extraction():
    raw = (
        "Here is the strategy:\n"
        "** artifact type=\"markdown\" title=\"Ship 30 Essay: Unlocking Product Success\"** With these strategies in place, you will be well on your way.\n"
        "# Unlocking Product Success\n"
        "- **Focus on Customer Education:** Train your users.\n"
        "</artifact>"
    )
    artifacts = extract_artifacts_from_text(raw)
    assert len(artifacts) == 1
    assert artifacts[0]["title"] == "Ship 30 Essay: Unlocking Product Success"
    assert "Focus on Customer Education" in artifacts[0]["content"]

    cleaned_text = clean_response_text(raw)
    assert "artifact type=" not in cleaned_text
    assert "Here is the strategy:" in cleaned_text

def test_clean_artifact_content():
    dirty = (
        "<artifact type=\"markdown\" title=\"Test Title\">\n"
        "# Actual Content\n"
        "</artifact>"
    )
    cleaned = clean_artifact_content(dirty)
    assert cleaned == "# Actual Content"
