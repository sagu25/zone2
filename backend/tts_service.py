"""
Azure TTS Service — wraps Azure Cognitive Services Speech REST API.
Returns MP3 bytes for a given agent + text.
Falls back gracefully (returns None) if keys not configured.
"""
import os
import requests

AZURE_SPEECH_KEY    = os.environ.get("AZURE_SPEECH_KEY", "")
AZURE_SPEECH_REGION = os.environ.get("AZURE_SPEECH_REGION", "eastus")

# Per-agent Azure Neural voice + SSML prosody
# Each agent gets a distinct voice character matching their role
AGENT_VOICES = {
    # Zone 3 — Reef
    "KORAL":    {"voice": "en-GB-SoniaNeural",    "rate": "+10%", "pitch": "+10%"},  # sharp, observant female
    "MAREA":    {"voice": "en-IE-EmilyNeural",     "rate": "0%",   "pitch": "-5%"},   # measured analytical female (Irish)
    "TASYA":    {"voice": "en-US-AvaNeural",       "rate": "-5%",  "pitch": "+5%"},   # context-aware female
    "NEREUS":   {"voice": "en-US-DavisNeural",     "rate": "-12%", "pitch": "-15%"},  # deep, authoritative male

    # Zone 2 — Shelf
    "ECHO":     {"voice": "en-AU-NatashaNeural",   "rate": "+10%", "pitch": "+10%"},  # clear diagnostic female
    "SIMAR":    {"voice": "en-US-EricNeural",      "rate": "+5%",  "pitch": "0%"},    # confident simulation male
    "NAVIS":    {"voice": "en-US-JennyNeural",     "rate": "0%",   "pitch": "-5%"},   # structured planning female
    "RISKADOR": {"voice": "en-GB-OliverNeural",    "rate": "-5%",  "pitch": "-10%"},  # measured risk male

    # Zone 1 — Trench
    "TRITON":   {"voice": "en-US-ChristopherNeural","rate": "+10%", "pitch": "-10%"},  # decisive executor male
    "AEGIS":    {"voice": "en-US-DavisNeural",     "rate": "-15%", "pitch": "-20%"},  # deep safety validator
    "TEMPEST":  {"voice": "en-GB-MaisieNeural",    "rate": "+20%", "pitch": "+5%"},   # alert, fast female
    "LEVIER":   {"voice": "en-US-AmberNeural",     "rate": "-10%", "pitch": "0%"},    # calm rollback female

    # Zone 4
    "BARRIER":  {"voice": "en-US-GuyNeural",       "rate": "-15%", "pitch": "-25%"},  # commanding enforcement

    # Cinematic intro narrator — natural conversational male
    "NARRATOR": {"voice": "en-US-AndrewNeural",    "rate": "+2%",  "pitch": "0%"},
}

_DEFAULT_VOICE = {"voice": "en-US-JennyNeural", "rate": "0%", "pitch": "0%"}


def is_configured() -> bool:
    return bool(AZURE_SPEECH_KEY)


def synthesize(agent: str, text: str) -> bytes | None:
    """
    Call Azure TTS REST API. Returns MP3 bytes or None if not configured / on error.
    Runs synchronously — call from a thread executor in async contexts.
    """
    if not is_configured():
        return None

    region  = AZURE_SPEECH_REGION or "eastus"
    url     = f"https://{region}.tts.speech.microsoft.com/cognitiveservices/v1"
    profile = AGENT_VOICES.get(agent.upper(), _DEFAULT_VOICE)

    ssml = (
        "<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='en-US'>"
        f"<voice name='{profile['voice']}'>"
        f"<prosody rate='{profile['rate']}' pitch='{profile['pitch']}'>{text}</prosody>"
        "</voice></speak>"
    )

    try:
        resp = requests.post(
            url,
            headers={
                "Ocp-Apim-Subscription-Key": AZURE_SPEECH_KEY,
                "Content-Type":              "application/ssml+xml",
                "X-Microsoft-OutputFormat":  "audio-24khz-48kbitrate-mono-mp3",
                "User-Agent":                "TARE-AEGIS",
            },
            data=ssml.encode("utf-8"),
            timeout=8,
        )
        if resp.status_code == 200:
            return resp.content
        print(f"[Azure TTS] Error {resp.status_code}: {resp.text[:200]}")
    except Exception as e:
        print(f"[Azure TTS] Request failed: {e}")
    return None
