import getpass
from os import name
from typing import List, Optional
from dataclasses import dataclass
import re

title = ""
username = getpass.getuser()

@dataclass
class ScriptInfo:
  title                 : str;
  script                : str;
  translation           : str;
  editing               : str;
  timing                : str;
  updated               : str;
  details               : str;
  type                  : str;
  collissions           : str;
  resX                  : int;
  resY                  : int;
  timer                 : int;
  wrapStyle             : int;
  scaledBorderAndShadow : str;

SCRIPT_INFO = ScriptInfo(
  title                 = "",
  script                = username,
  translation           = "BOGUS CLIP",
  editing               = username,
  timing                = username,
  updated               = username,
  details               = "First",
  type                  = "v4.00+",
  collissions           = "Normal",
  resX                  = 1920,
  resY                  = 1080,
  timer                 = 100,
  wrapStyle             = 0,
  scaledBorderAndShadow = "yes"
)

@dataclass
class Style:
  name            : str;
  fontName        : str;
  fontSize        : int;
  primaryColor    : str;
  secondaryColor  : str;
  outlineColor    : str;
  backgroundColor : str;
  bold            : bool;
  italic          : bool;
  underline       : bool;
  strikeOut       : bool;
  scaleX          : int;
  scaleY          : int;
  spacing         : int;
  angle           : int;
  borderStyle     : int;
  outline         : int;
  shadow          : int;
  alignment       : int;
  marginL         : int;
  marginR         : int;
  marginV         : int;
  encoding        : str;

DEFAULT_STYLE = Style(
  name            = "Default",
  fontName        = "Segoe UI",
  fontSize        = 45,
  primaryColor    = "&HFFB0B0",
  secondaryColor  = "&HFFFF00",
  outlineColor    = "&H998877",
  backgroundColor = "",
  bold            = False,
  italic          = False,
  underline       = False,
  strikeOut       = False,
  scaleX          = 0,
  scaleY          = 0,
  spacing         = 0,
  angle           = 0,
  borderStyle     = 0,
  outline         = 0,
  shadow          = 0,
  alignment       = 2,
  marginL         = 0,
  marginR         = 0,
  marginV         = 0,
  encoding        = "0"
)

@dataclass
class Event:
  type    : str;
  layer   : int;
  start   : float;
  end     : float;
  style   : Style;
  name    : str;
  marginL : int;
  marginR : int;
  marginV : int;
  effect  : str;
  text    : str;
  pos     : Optional[tuple] = None;

@dataclass
class ASS:
  scriptInfo: ScriptInfo;
  styles: List[Style];
  events: List[Event];

def generateASSFileContent(ass: ASS) -> str:
  styles_block = ""
  for style in ass.styles:
    styles_block += (
      "Style: "
      f"{style.name},{style.fontName},{style.fontSize},"
      f"{style.primaryColor},{style.secondaryColor},{style.outlineColor},{style.backgroundColor},"
      f"{style.bold},{style.italic},{style.underline},{style.strikeOut},"
      f"{style.scaleX},{style.scaleY},{style.spacing},{style.angle},"
      f"{style.borderStyle},{style.outline},{style.shadow},{style.alignment},"
      f"{style.marginL},{style.marginR},{style.marginV},{style.encoding}\n"
    )

  events_block = ""
  for event in ass.events:
    override = ""
    if event.pos:
      override = f"\\pos({event.pos[0]},{event.pos[1]})"
    text = f"{{{override}}}{event.text}" if override else event.text
    events_block += (
      f"{event.type}: "
      f"{event.layer},{floatToASSTime(event.start)},{floatToASSTime(event.end)},"
      f"{event.style.name},{event.name},{event.marginL},"
      f"{event.marginR},{event.marginV},{event.effect},{text}\n"
    )

  ass_file_content = f'''
[Script Info]
Title: {SCRIPT_INFO.title}
Original Script: {SCRIPT_INFO.script}
Original Translation: {SCRIPT_INFO.translation}
Original Editing: BOGUS CLIP in association with {SCRIPT_INFO.editing}
Original Timing: BOGUS CLIP in association with {SCRIPT_INFO.timing}
Script Updated By: BOGUS CLIP in association with {SCRIPT_INFO.updated}
Update Details: {SCRIPT_INFO.details}
ScriptType: {SCRIPT_INFO.type}
Collisions: {SCRIPT_INFO.collissions}
PlayResX: {SCRIPT_INFO.resX}
PlayResY: {SCRIPT_INFO.resY}
Timer: {SCRIPT_INFO.timer}
WrapStyle: {SCRIPT_INFO.wrapStyle}
ScaledBorderAndShadow: {SCRIPT_INFO.scaledBorderAndShadow}

[V4+ Styles]
; Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Segoe UI,45,&HFFB0B0,&HFFFF00,&H998877,0,0,0,0,0,0,0,0,0,0,0,0,2,0,0,0,0
{styles_block}

[Events]
; Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
{events_block}
'''
  return ass_file_content


def floatToASSTime(seconds: float) -> str:
  hours = int(seconds // 3600)
  minutes = int((seconds % 3600) // 60)
  secs = int(seconds % 60)
  centis = int((seconds - int(seconds)) * 100)

  return f"{hours}:{minutes:02}:{secs:02}.{centis:02}"

def ASSToFloatTime(time: str) -> float:
  [h, m, s] = time.split(":")
  return int(h)*3600 + int(m)*60 + float(s)

def parseASSFileContent(ass_file_content: str) -> ASS:
  styles_pattern = re.compile(r"^Style\s*:(?P<style>.+)$", re.MULTILINE)
  matches = [m.group('style') for m in styles_pattern.finditer(ass_file_content)]
  styles: List[Style] = []
  for m in matches:
    parts = m.split(",")
    styles.append(
      Style(
        name            = parts[0],
        fontName        = parts[1],
        fontSize        = int(parts[2]),
        primaryColor    = parts[3],
        secondaryColor  = parts[4],
        outlineColor    = parts[5],
        backgroundColor = parts[6],
        bold            = bool(int(parts[7])),
        italic          = bool(int(parts[8])),
        underline       = bool(int(parts[9])),
        strikeOut       = bool(int(parts[10])),
        scaleX          = int(parts[11]),
        scaleY          = int(parts[12]),
        spacing         = int(parts[13]),
        angle           = int(parts[14]),
        borderStyle     = int(parts[15]),
        outline         = int(parts[16]),
        shadow          = int(parts[17]),
        alignment       = int(parts[18]),
        marginL         = int(parts[19]),
        marginR         = int(parts[20]),
        marginV         = int(parts[21]),
        encoding        = parts[22]
      )
    )

  events_pattern = re.compile(r"^(?P<type>Dialogue|Comment)\s*:\s*(?P<event>.+)$", re.MULTILINE)
  matches = [(m.group('type'), m.group('event')) for m in events_pattern.finditer(ass_file_content)]
  events: List[Event] = []
  for m in matches:
    parts = m[1].split(",",9)
    text = m[1][len((",").join(parts)):]
    style = next((s for s in styles if s.name == parts[3]), DEFAULT_STYLE)
    events.append(
      Event(
        type    = m[0],
        layer   = int(parts[0]),
        start   = ASSToFloatTime(parts[1]),
        end     = ASSToFloatTime(parts[2]),
        style   = style,
        name    = parts[4],
        marginL = int(parts[5]),
        marginR = int(parts[6]),
        marginV = int(parts[7]),
        effect  = parts[8],
        text    = text
      )
    )

  return ASS(scriptInfo=SCRIPT_INFO, styles=styles, events=events)

def hexToASSColor(hex_color: str) -> str:
  hex_color = hex_color.lstrip("#")
  if len(hex_color) == 8:
    a = hex_color[6:8]
    r = hex_color[0:2]
    g = hex_color[2:4]
    b = hex_color[4:6]
    return f"&H{a}{b}{g}{r}"
  elif len(hex_color) == 6:
    r = hex_color[0:2]
    g = hex_color[2:4]
    b = hex_color[4:6]
    return f"&H00{b}{g}{r}"
  return "&H00FFFFFF"
