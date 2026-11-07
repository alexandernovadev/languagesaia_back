"""
Says a list of words with a cloned voice and checks each one by listening to it.
Run by scripts/generate-word-audio.ts: details in docs/AUDIO-LOCAL.md.

  python word-audio.py <language> <words.json> <out-dir>

Prints one JSON line per word as soon as its MP3 is ready.
"""
import difflib, json, os, re, subprocess, sys, unicodedata, wave
import mlx.core as mx
import numpy as np
from mlx_audio.stt.utils import load_model as load_stt
from mlx_audio.tts.utils import load_model as load_tts

LAB = os.path.expanduser("~/.cache/glota-audio")
TTS_MODEL = "mlx-community/Qwen3-TTS-12Hz-1.7B-Base-8bit"
STT_MODEL = os.path.join(LAB, "whisper")  # mlx weights plus the tokenizer files of openai/whisper-large-v3-turbo
LANGUAGE = {"en": "English", "pt": "Portuguese"}
TRIES = 3
MIN_MATCH = 0.6
SILENCE = 0.02  # of the loudest sample
PADDING_SECONDS = 0.08
PEAK = 0.9


def trim(audio, rate):
    """Cuts the silence around the word and evens out the volume between words."""
    loud = np.flatnonzero(np.abs(audio) > SILENCE * np.abs(audio).max())
    if loud.size == 0:
        return audio
    pad = int(PADDING_SECONDS * rate)
    cut = audio[max(loud[0] - pad, 0) : loud[-1] + pad]
    return cut * (PEAK / np.abs(cut).max())


def too_long(word, seconds):
    return seconds > 0.9 + 0.13 * len(word)


def plain(text):
    text = unicodedata.normalize("NFD", text.lower())
    return re.sub(r"[^a-z0-9]", "", "".join(c for c in text if not unicodedata.combining(c)))


def save_wav(path, audio, rate):
    with wave.open(path, "wb") as file:
        file.setnchannels(1)
        file.setsampwidth(2)
        file.setframerate(rate)
        file.writeframes((np.clip(audio, -1, 1) * 32767).astype("<i2").tobytes())


def main():
    language, words_file, out_dir = sys.argv[1:4]
    ref = json.load(open(os.path.join(LAB, "refs.json")))[language]
    words = json.load(open(words_file))
    os.makedirs(out_dir, exist_ok=True)
    tts, stt = load_tts(TTS_MODEL), load_stt(STT_MODEL)
    rate = tts.sample_rate
    wav = os.path.join(out_dir, f"_{language}.wav")

    for item in words:
        word, best = item["word"], None
        for attempt in range(1, TRIES + 1):
            pieces = tts.generate(text=word, ref_audio=ref["audio"], ref_text=ref["text"], lang_code=LANGUAGE[language], verbose=False)
            audio = trim(np.concatenate([np.array(p.audio) for p in pieces]), rate)
            seconds = len(audio) / rate
            save_wav(wav, audio, rate)
            heard = stt.generate(wav, language=language, verbose=False).text.strip()
            match = difflib.SequenceMatcher(None, plain(word), plain(heard)).ratio()
            score = match - (1 if too_long(word, seconds) else 0)
            if best is None or score > best["score"]:
                best = dict(score=score, audio=audio, seconds=seconds, heard=heard, match=match, attempt=attempt)
            if score >= MIN_MATCH:
                break
            mx.clear_cache()

        save_wav(wav, best["audio"], rate)
        mp3 = os.path.join(out_dir, f"{item['id']}.mp3")
        subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", wav, "-b:a", "96k", mp3], check=True)
        print(json.dumps({
            "id": item["id"], "word": word, "file": mp3, "seconds": round(best["seconds"], 2), "heard": best["heard"],
            "match": round(best["match"], 2), "attempts": attempt, "review": best["score"] < MIN_MATCH,
        }, ensure_ascii=False), flush=True)


main()
