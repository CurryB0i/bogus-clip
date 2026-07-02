from functools import lru_cache
from typing import List
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from starlette.responses import FileResponse
from dotenv import load_dotenv
import os
import whisperx
from whisperx.diarize import DiarizationPipeline
import torch
from pydantic import BaseModel
from pathlib import Path
import gc
import aiofiles
import uuid
import ffmpeg
import json
import numpy as p
import librosa
from fontTools.ttLib import TTFont
import platform
import subprocess

load_dotenv()

system = platform.system()
if system == "Windows":
    import winreg

app = FastAPI()
origins = [
  "http://localhost:5173"
]

app.add_middleware(
  CORSMiddleware,
  allow_origins=origins,
  allow_credentials=True,
  allow_methods=["*"],
  allow_headers=["*"],
)

VIDEO_DIR = Path("videos")
AUDIO_DIR = Path("audios")
TRANSCRIPT_DIR = Path("transcripts")
WAVEFORM_DIR = Path("waveforms")
VIDEO_DIR.mkdir(exist_ok=True)
AUDIO_DIR.mkdir(exist_ok=True)
TRANSCRIPT_DIR.mkdir(exist_ok=True)
WAVEFORM_DIR.mkdir(exist_ok=True)
app.mount("/videos", StaticFiles(directory=VIDEO_DIR), name="videos")
app.mount("/audios", StaticFiles(directory=AUDIO_DIR), name="audios")

device = "cuda"
compute_type = "float16"
batch_size = 8
num = 10000
hf_token = os.getenv("HF_TOKEN")
model = whisperx.load_model("base", device, compute_type=compute_type)
model_a, metadata = whisperx.load_align_model(language_code="en", device=device)
diarize_model = DiarizationPipeline(
  use_auth_token=hf_token,
  device=device
)

DEFAULT_STYLES = {
  "default": {
    "font"            : "Arial",
    "size"            : 36,
    "primaryColor"    : "#ffffff",
    "secondaryColor"  : "#00ffff",
    "outlineColor"    : "#000000",
    "backgroundColor" : "transparent",
    "bold"            : False,
    "italic"          : False,
    "underline"       : False,
    "scaleX"          : 100,
    "scaleY"          : 100,
    "outline"         : 2,
    "align"           : 2
  }
}

class TranscribeRequest(BaseModel):
  filename: str

@app.get("/")
async def root():
  return { "message" : "ABSOLUTELY BOGUS!" }

@app.post("/upload")
async def video(file: UploadFile = File(...)):
  if file is None:
    raise HTTPException(status_code=400, detail="Missing File.")

  filename = file.filename if file.filename else "pray"
  ext = Path(filename).suffix
  safe_name = f"{uuid.uuid4().hex}{ext}"
  dest = VIDEO_DIR / safe_name
  async with aiofiles.open(dest, "wb") as out_file:
    while chunk := await file.read(1024 * 1024):
      await out_file.write(chunk)

  probe = ffmpeg.probe(str(dest))
  stream = next(
    (s for s in probe["streams"] if s["codec_type"] == "video"),
    None
  )

  if stream is None:
    raise HTTPException(status_code=400, detail="No Video stream found.")
  
  resX = stream["width"]
  resY = stream["height"]
  duration = float(probe["format"]["duration"])

  return { 
    "ok": True, 
    "file": {
      "name": safe_name,
      "resX": resX,
      "resY": resY,
      "size": dest.stat().st_size,
      "duration": duration
    }
  }

@app.get("/exists/{name}")
async def exists(name: str):
  p = VIDEO_DIR / name
  return { "exists": p.exists(), "size": p.stat().st_size if p.exists() else 0 }

@app.post("/transcribe")
async def transcribe(req: TranscribeRequest):
  filename = req.filename
  if filename is None:
    raise HTTPException(status_code=400, detail="Missing Filename.")

  video = VIDEO_DIR / filename
  if not video.exists():
    raise HTTPException(status_code=404, detail="File does not exist.")

  try:
    audio_file = AUDIO_DIR / (Path(filename).stem + ".wav")
    audio_path = str(audio_file)
    (
      ffmpeg
      .input(video)
      .output(audio_path, ac=1, ar=16000, format="wav")
      .overwrite_output()
      .run()
    )

    y, sr = librosa.load(audio_file, sr=None, mono=True)
    samples_per_peak = len(y) // num
    peaks = np.zeros(num, dtype=np.float32)

    for i in range(num):
        start = i * samples_per_peak
        end = start + samples_per_peak
        chunk = y[start:end]
        if len(chunk):
            peaks[i] = np.max(np.abs(chunk))
    peaks /= np.max(peaks)
    waveform = {
      "id"        : "W_"+Path(filename).stem,
      "peaks"     : [peaks.tolist()],
      "duration"  : float(len(y) / sr),
      "sampleRate": int(sr)
    }

    result = model.transcribe(audio_path, batch_size=batch_size)
    result = whisperx.align(result["segments"], model_a, metadata, audio_path, device, return_char_alignments=False)
    diarize_segments = diarize_model(audio_path)
    result = whisperx.assign_word_speakers(diarize_segments, result)

    events = []
    id = 0
    for segment in result["segments"]:
      num_words = len(segment.get("words", []))
      words = segment["text"].strip().split(" ")
      for i in range(num_words // 4):
        idx = i*4
        events.append({
          "id"    : "seg_"+str(id),
          "start" : round(segment["words"][idx]["start"],2),
          "end"   : round(segment["words"][idx+3]["end"],2),
          "style" : "default",
          "text"  : (" ").join(words[idx:idx+4]),
          "words" : [
            {
              "t" : segment["words"][idx+j]["word"],
              "s" : round(segment["words"][idx+j]["start"],2),
              "e" : round(segment["words"][idx+j]["end"],2)
            } for j in range(4)
          ]
        })
        id += 1

      if num_words == 0 or num_words%4 != 0:
        idx = num_words - num_words%4
        events.append({
          "id"    : "seg_"+str(id),
          "start" : round(segment['start'] if num_words == 0 else segment['words'][idx]['start'],2),
          "end"   : round(segment["end"],2),
          "style" : "default",
          "text"  : (' ').join(words[idx:]),
          "words" : [
            { 
              "t" : segment["words"][idx+j]["word"],
              "s" : round(segment["words"][idx+j]["start"],2),
              "e" : round(segment["words"][idx+j]["end"],2)
            } for j in range(num_words%4)
          ]
        })
        id += 1

    transcript = {
      "id"      : "T_"+Path(filename).stem,
      "styles"  : DEFAULT_STYLES,
      "events"  : events
    }
    waveform_file = Path(filename).stem + "_waveform.json"
    transcript_file = Path(filename).stem + "_transcript.json"
    w_dest = WAVEFORM_DIR / waveform_file
    t_dest = TRANSCRIPT_DIR / transcript_file
    with open(w_dest, "w+") as file:
      json.dump(waveform, file, indent=4)
      file.close()
    with open(t_dest, "w+") as file:
      json.dump(transcript, file, indent=4)
      file.close()
    gc.collect()
    torch.cuda.empty_cache()

    return { "ok": True, "transcript": transcript, "waveform": waveform }

  except Exception as e:
    print(e)
    raise HTTPException(status_code=500, detail="Internal Server Error (Probably CUDA ran out of memory)")

@app.get('/get_transcript_waveform/{filename}')
async def get_transcript(filename: str):
  if filename is None:
    raise HTTPException(status_code=400, detail="Missing Filename.")

  transcript_file = Path(filename).stem + "_transcript.json"
  waveform_file = Path(filename).stem + "_waveform.json"
  t_dest = TRANSCRIPT_DIR / transcript_file
  w_dest = WAVEFORM_DIR / waveform_file
  if not w_dest.exists() or not t_dest.exists():
    return { "ok": False }

  transcript = {}
  with open(t_dest, "r") as file:
    transcript = json.loads(file.read())
    file.close()
  waveform = {}
  with open(w_dest, "r") as file:
    waveform = json.loads(file.read())
    file.close()

  return { "ok": True, "transcript": transcript, "waveform": waveform }

@lru_cache
def get_system_font_dirs() -> List[Path]:
  if system == "Windows":
    with winreg.OpenKey(
      winreg.HKEY_LOCAL_MACHINE,
      r"SOFTWARE\Microsoft\Windows NT\CurrentVersion"
    ) as key:
      windows_dir, _ = winreg.QueryValueEx(key, "SystemRoot")
      return [Path(windows_dir) / "Fonts"]

  elif system == "Darwin":
    return [
      Path("/System/Library/Fonts"),
      Path("/Library/Fonts"),
      Path.home() / "Library/Fonts"
    ]

  else:
    try:
      out = subprocess.check_output(["fc-list", "--format=%{file}\n"])
      return sorted({Path(line.decode()).parent for line in out.splitlines()})
    except Exception:
      return [
        Path("/usr/share/fonts"),
        Path("/usr/local/share/fonts"),
        Path.home() / ".fonts"
      ]

def get_system_fonts():
  fonts = []
  for font_dir in get_system_font_dirs():
    if not font_dir.exists():
      continue

    for path in font_dir.rglob("*"):
      if path.suffix.lower() in (".ttf", ".otf"):
        try:
          font = TTFont(path)
          name = (
            font["name"].getDebugName(4)
            or font["name"].getDebugName(1)
          )
          fonts.append({
            "name" : name,
            "path" : path
          })
        except Exception as e:
          print(e)
          pass

  return fonts

@app.get('/get-fonts')
async def get_fonts():
  return { "ok": True, "fonts": [f["name"] for f in get_system_fonts()]}

@app.get('/font/{font_name}')
async def serve_font(font_name: str):
  font_map = {f["name"]: f["path"] for f in get_system_fonts()}
  
  if font_name not in font_map:
    raise HTTPException(status_code=404, detail="Font not found")

  path = font_map[font_name]

  return FileResponse(
    path, 
    filename=path.name, 
    media_type="font/ttf"
  )
