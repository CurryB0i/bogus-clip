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
import numpy as np
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

class ASSExportRequest(BaseModel):
  filename: str
  styles: dict
  events: list
  position: dict = {}

BURN_DIR = Path("burned")
BURN_DIR.mkdir(exist_ok=True)

def build_ass(filename: str, styles_data: dict, events_data: list, position: dict = {}):
  from ass import ASS, ScriptInfo, Style, Event as ASSEvent, generateASSFileContent, SCRIPT_INFO, DEFAULT_STYLE, floatToASSTime, hexToASSColor

  video = VIDEO_DIR / filename
  if not video.exists():
    raise HTTPException(status_code=404, detail="File does not exist.")

  probe = ffmpeg.probe(str(video))
  stream = next(
    (s for s in probe["streams"] if s["codec_type"] == "video"),
    None
  )
  resX = stream["width"] if stream else 1920
  resY = stream["height"] if stream else 1080

  script_info = ScriptInfo(
    title=filename,
    script=SCRIPT_INFO.script,
    translation=SCRIPT_INFO.translation,
    editing=SCRIPT_INFO.editing,
    timing=SCRIPT_INFO.timing,
    updated=SCRIPT_INFO.updated,
    details=SCRIPT_INFO.details,
    type=SCRIPT_INFO.type,
    collissions=SCRIPT_INFO.collissions,
    resX=resX,
    resY=resY,
    timer=SCRIPT_INFO.timer,
    wrapStyle=SCRIPT_INFO.wrapStyle,
    scaledBorderAndShadow=SCRIPT_INFO.scaledBorderAndShadow
  )

  ass_styles = []
  for name, s in styles_data.items():
    primary_color = s.get("primaryColor", "#ffffff")
    secondary_color = s.get("secondaryColor", "#00ffff")
    outline_color = s.get("outlineColor", "#000000")
    bg_color = s.get("backgroundColor", "transparent")

    bg_is_transparent = (
      bg_color in ("transparent", "") or
      (len(bg_color.lstrip("#")) == 8 and bg_color.lstrip("#")[6:8] == "00")
    )

    outline_val = s.get("outline", 2)
    if outline_val > 0:
      outline_val = max(1, round(outline_val / 2))

    ass_styles.append(Style(
      name=name,
      fontName=s.get("font", "Arial"),
      fontSize=s.get("size", 36),
      primaryColor=hexToASSColor(primary_color) if primary_color not in ("transparent", "") else "&H00FFFFFF",
      secondaryColor=hexToASSColor(secondary_color) if secondary_color not in ("transparent", "") else "&H0000FFFF",
      outlineColor=hexToASSColor(outline_color) if outline_color not in ("transparent", "") else "&H00000000",
      backgroundColor=hexToASSColor(bg_color) if not bg_is_transparent else "&H00000000",
      bold=s.get("bold", False),
      italic=s.get("italic", False),
      underline=s.get("underline", False),
      strikeOut=False,
      scaleX=s.get("scaleX", 100),
      scaleY=s.get("scaleY", 100),
      spacing=0,
      angle=0,
      borderStyle=3 if not bg_is_transparent else 1,
      outline=0 if not bg_is_transparent else outline_val,
      shadow=0,
      alignment=7,
      marginL=10,
      marginR=10,
      marginV=10,
      encoding="1"
    ))

  if not ass_styles:
    ass_styles.append(DEFAULT_STYLE)

  pos = None
  if position and ("x" in position) and ("y" in position):
    pos = (int(position["x"]), int(position["y"]))

  ass_events = []
  for ev in events_data:
    style_name = ev.get("style", "Default")
    style_obj = next((s for s in ass_styles if s.name == style_name), ass_styles[0])
    ass_events.append(ASSEvent(
      type="Dialogue",
      layer=0,
      start=ev.get("start", 0),
      end=ev.get("end", 0),
      style=style_obj,
      name="",
      marginL=0,
      marginR=0,
      marginV=0,
      effect="",
      text=ev.get("text", ""),
      pos=pos
    ))

  ass = ASS(scriptInfo=script_info, styles=ass_styles, events=ass_events)
  return generateASSFileContent(ass)

@app.post("/export-ass")
async def export_ass(req: ASSExportRequest):
  content = build_ass(req.filename, req.styles, req.events, req.position)

  from fastapi.responses import Response
  return Response(
    content=content,
    media_type="text/plain",
    headers={
      "Content-Disposition": f"attachment; filename={Path(req.filename).stem}.ass"
    }
  )

@app.post("/burn-subtitles")
async def burn_subtitles(req: ASSExportRequest):
  content = build_ass(req.filename, req.styles, req.events, req.position)

  video = VIDEO_DIR / req.filename
  if not video.exists():
    raise HTTPException(status_code=404, detail="File does not exist.")

  stem = Path(req.filename).stem
  ass_path = BURN_DIR / f"{stem}.ass"
  out_path = BURN_DIR / f"{stem}_burned.mp4"

  with open(ass_path, "w", encoding="utf-8") as f:
    f.write(content)

  ass_filter_path = str(ass_path).replace("\\", "/").replace(":", "\\:")

  try:
    (
      ffmpeg
      .input(str(video))
      .output(
        str(out_path),
        vf=f"subtitles='{ass_filter_path}'",
        **{"c:v": "libx264", "c:a": "copy"}
      )
      .overwrite_output()
      .run()
    )
  except ffmpeg.Error as e:
    raise HTTPException(status_code=500, detail=f"ffmpeg error: {e.stderr.decode() if e.stderr else str(e)}")

  return FileResponse(
    str(out_path),
    media_type="video/mp4",
    filename=f"{stem}_burned.mp4"
  )

if __name__ == "__main__":
  import uvicorn
  uvicorn.run(app, host="0.0.0.0", port=8000)
