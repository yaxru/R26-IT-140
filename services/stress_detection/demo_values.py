import hashlib


def demo_pressure(session_id: str, phase: str) -> float:
    digest = hashlib.sha256(f"{session_id}:{phase}".encode()).digest()
    fraction = int.from_bytes(digest[:4], "big") / 0xFFFFFFFF
    return round(0.25 + fraction * 0.5, 3)


def demo_peak_pressure(session_id: str, phase: str, average: float) -> float:
    digest = hashlib.sha256(f"{session_id}:{phase}:peak".encode()).digest()
    fraction = int.from_bytes(digest[:4], "big") / 0xFFFFFFFF
    return round(min(0.99, max(average, average + 0.05 + fraction * 0.1)), 3)
