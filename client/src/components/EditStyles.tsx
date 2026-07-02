import { useEffect, useRef, useState } from "react";
import { type StyleOptions } from "../types/transcript";
import axios from "axios";
import { useVideo } from "../context/VideoContext";

const INITIAL_STYLES: StyleOptions = {
  font: "Arial",
  size: 24,
  primaryColor: "#ffffff",
  secondaryColor: "#ffffff",
  outlineColor: "#000000",
  backgroundColor: "#00000000",
  bold: false,
  italic: false,
  underline: false,
  outline: 0,
  position: { x: 0, y: 0 }
};

const EditStyles = () => {
  const API_URL = import.meta.env.VITE_API_URL;
  const { state, dispatch } = useVideo();
  const [fonts, setFonts]   = useState<string[]>([]);
  const [style, setStyle]   = useState<StyleOptions>(() => {
    const s = localStorage.getItem("style");
    return s ? JSON.parse(s) : INITIAL_STYLES;
  });
  const [applied, setApplied]       = useState<boolean>(false);
  const [showXGuide, setShowXGuide] = useState<boolean>(false);
  const [showYGuide, setShowYGuide] = useState<boolean>(false);
  const [videoNaturalSize, setVideoNaturalSize] 
                                    = useState<{ width: number, height: number }>({ width: 0, height: 0 });
  const textRef         = useRef<HTMLDivElement>(null);
  const videoRef        = useRef<HTMLVideoElement>(null);
  const dragOffset      = useRef({ x: 0, y: 0 });
  const SNAP_THRESHOLD  = 10;

  const displayToASS = (displayX: number, displayY: number) => {
    if (!videoRef.current || !textRef.current || videoNaturalSize.width === 0) 
      return { x: 0, y: 0 };
    
    const videoRect = videoRef.current.getBoundingClientRect();
    const textRect = textRef.current.getBoundingClientRect();
    
    const scaleX = videoNaturalSize.width / videoRect.width;
    const scaleY = videoNaturalSize.height / videoRect.height;
    
    const centerX = displayX + (textRect.width / 2);
    const centerY = displayY + (textRect.height / 2);
    
    return {
      x: Math.round(centerX * scaleX),
      y: Math.round(centerY * scaleY)
    };
  };

  const assToDisplay = (assX: number, assY: number) => {
    if (!videoRef.current || !textRef.current || videoNaturalSize.width === 0) 
      return { x: 0, y: 0 };
    
    const videoRect = videoRef.current.getBoundingClientRect();
    const textRect = textRef.current.getBoundingClientRect();
    
    const scaleX = videoRect.width / videoNaturalSize.width;
    const scaleY = videoRect.height / videoNaturalSize.height;
    
    const displayCenterX = assX * scaleX;
    const displayCenterY = assY * scaleY;
    
    return {
      x: displayCenterX - (textRect.width / 2),
      y: displayCenterY - (textRect.height / 2)
    };
  };

  const clampPosition = (x: number, y: number) => {
    if (!videoRef.current || !textRef.current) return { x, y };

    const videoRect = videoRef.current.getBoundingClientRect();
    const textRect = textRef.current.getBoundingClientRect();

    const maxX = videoRect.width - textRect.width;
    const maxY = videoRect.height - textRect.height;

    return {
      x: Math.min(Math.max(0, x), maxX),
      y: Math.min(Math.max(0, y), maxY),
    };
  };

  const snapPosition = (x: number, y: number) => {
    const videoRect = videoRef.current!.getBoundingClientRect();
    const textRect = textRef.current!.getBoundingClientRect();

    const videoCenterX = videoRect.width / 2;
    const videoCenterY = videoRect.height / 2;

    const textCenterX = x + textRect.width / 2;
    const textCenterY = y + textRect.height / 2;

    let snappedX = x;
    let snappedY = y;

    if (Math.abs(textCenterX - videoCenterX) < SNAP_THRESHOLD) {
      snappedX = videoCenterX - textRect.width / 2;
      setShowXGuide(true);
    } else {
      setShowXGuide(false);
    }

    if (Math.abs(textCenterY - videoCenterY) < SNAP_THRESHOLD) {
      snappedY = videoCenterY - textRect.height / 2;
      setShowYGuide(true);
    } else {
      setShowYGuide(false);
    }

    return { x: snappedX, y: snappedY };
  };
  
  useEffect(() => {
    const getFonts = async () => {
      try {
        const res = await axios.get(`${API_URL}/get-fonts`);
        if(res.data.ok) {
          setFonts(res.data.fonts);
        }
      } catch(err: any) {
        console.error(err);
      }
    }

    getFonts();
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleLoadedMetadata = () => {
      setVideoNaturalSize({
        width: video.videoWidth,
        height: video.videoHeight
      });
    };

    if (video.readyState >= 1) {
      handleLoadedMetadata();
    } else {
      video.addEventListener('loadedmetadata', handleLoadedMetadata);
    }

    return () => video.removeEventListener('loadedmetadata', handleLoadedMetadata);
  }, []);

  const onMouseDown = (e: React.MouseEvent) => {
    const displayPos = assToDisplay(style.position.x, style.position.y);

    dragOffset.current = {
      x: e.clientX - displayPos.x,
      y: e.clientY - displayPos.y,
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  };

  const onMouseMove = (e: MouseEvent) => {
    const rawX = e.clientX - dragOffset.current.x;
    const rawY = e.clientY - dragOffset.current.y;

    const snapped = snapPosition(rawX, rawY);
    const clamped = clampPosition(snapped.x, snapped.y);
    
    const assPos = displayToASS(clamped.x, clamped.y);
    updateStyle("position", assPos);
  };

  const onMouseUp = () => {
    setShowXGuide(false);
    setShowYGuide(false);
    window.removeEventListener("mousemove", onMouseMove);
    window.removeEventListener("mouseup", onMouseUp);
  };

  const alphaToHex = (a: number) =>
    Math.round(a * 255).toString(16).padStart(2, "0");

  const hexToAlpha = (hex?: string) =>
    hex && hex.length === 9
      ? parseInt(hex.slice(7, 9), 16) / 255
      : 1;

  useEffect(() => {
    if(!style?.font) return;

    const isFontLoaded = (fontName: string) => {
      return [...document.fonts].some(
        f => f.family.replace(/["']/g, "") === fontName
      );
    }

    const loadFont = async (fontName: string) => {
      const font = new FontFace( 
                    fontName, 
                    `url(${API_URL}/font/${encodeURIComponent(fontName)})`
                   );
      await font.load();
      document.fonts.add(font);
    }

    const ensureFont = async () => {
      if (!isFontLoaded(style.font)) {
        await loadFont(style.font);
      }
    };

    ensureFont();
  }, [style?.font]);

  const updateStyle = (field: keyof StyleOptions, raw: string | boolean | StyleOptions['position']) => {
    let value;
    if(field === "size" || field === "outline") {
      value = Number((raw as string).replace(/\D+/g, ""));
    } else if(field == "position") {
      value = { 
        x: Number((raw as StyleOptions['position']).x.toFixed(2)),
        y: Number((raw as StyleOptions['position']).y.toFixed(2)) 
      }
    } else {
      value = raw;
    }

    setStyle(prev => ({
      ...prev!,
      [field] : value
    }));
  }

  const handleApply = () => {
    setApplied(true);
    if(!style) return;

    dispatch({
      type: 'UPDATE_STYLES',
      payoad: { style }
    });
    localStorage.setItem('style', JSON.stringify(style));
    const s = localStorage.getItem('style');
    if(s) setStyle(JSON.parse(s));
    setTimeout(() => setApplied(false), 1000)
  }

  useEffect(() => console.log(applied), [applied])


  return (
    <div className="w-full h-full flex items-center justify-around">
      <div className="w-1/2 h-full flex flex-col items-center justify-center px-10 gap-5">
        <div className="w-full flex items-center justify-between">
          <label htmlFor="font">FONT:</label>
          <select
            name="font"
            id="font"
            value={style?.font}
            defaultValue={fonts[0]}
            onChange={(e) => updateStyle("font", e.target.value)}
            className="w-2/3 text-center cursor-pointer"
          >
            {fonts.map((f) => (
              <option 
                key={f} 
                value={f}
                className="text-black cursor-pointer"
              >
                {f}
              </option>
            ))}
          </select>
        </div>

        <div className="w-full flex items-center justify-between gap-5">
          <label htmlFor="size">FONT SIZE</label>
          <input 
            id="size"
            name="size"
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={style?.size}
            onChange={(e) => updateStyle("size", e.target.value)}
            className="bg-[#242424] p-1 w-2/3 text-center"
          />
        </div>

        <div className="w-full flex items-center justify-between gap-5">
          <label htmlFor="primaryColor">PRIMARY</label>

          <div className="w-2/3 flex items-center justify-center gap-4">
            <input
              id="primaryColor"
              type="color"
              value={style?.primaryColor.slice(0, 7)}
              onChange={(e) => {
                const alphaHex = alphaToHex(hexToAlpha(style?.primaryColor));
                updateStyle("primaryColor", `${e.target.value}${alphaHex}`);
              }}
              className="bg-[#242424] w-1/5 cursor-pointer"
            />

            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={hexToAlpha(style?.primaryColor)}
              onChange={(e) => {
                const alphaHex = alphaToHex(Number(e.target.value));
                updateStyle(
                  "primaryColor",
                  `${style!.primaryColor.slice(0, 7)}${alphaHex}`
                );
              }}
              className="w-1/4"
            />
          </div>
        </div>

        <div className="w-full flex items-center justify-between gap-5">
          <label htmlFor="secondaryColor">SECONDARY</label>

          <div className="w-2/3 flex items-center justify-center gap-4">
            <input
              id="secondaryColor"
              type="color"
              value={style?.secondaryColor.slice(0, 7)}
              onChange={(e) => {
                const alphaHex = alphaToHex(hexToAlpha(style?.secondaryColor));
                updateStyle("secondaryColor", `${e.target.value}${alphaHex}`);
              }}
              className="bg-[#242424] w-1/5 cursor-pointer"
            />

            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={hexToAlpha(style?.secondaryColor)}
              onChange={(e) => {
                const alphaHex = alphaToHex(Number(e.target.value));
                updateStyle(
                  "secondaryColor",
                  `${style!.secondaryColor.slice(0, 7)}${alphaHex}`
                );
              }}
              className="w-1/4"
            />
          </div>
        </div>

        <div className="w-full flex items-center justify-between gap-5">
          <label htmlFor="outlineColor">OUTLINE</label>

          <div className="w-2/3 flex items-center justify-center gap-4">
            <input
              id="outlineColor"
              type="color"
              value={style?.outlineColor.slice(0, 7)}
              onChange={(e) => {
                const alphaHex = alphaToHex(hexToAlpha(style?.outlineColor));
                updateStyle("outlineColor", `${e.target.value}${alphaHex}`);
              }}
              className="bg-[#242424] w-1/5 cursor-pointer"
            />

            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={hexToAlpha(style?.outlineColor)}
              onChange={(e) => {
                const alphaHex = alphaToHex(Number(e.target.value));
                updateStyle(
                  "outlineColor",
                  `${style!.outlineColor.slice(0, 7)}${alphaHex}`
                );
              }}
              className="w-1/4"
            />
          </div>
        </div>

        <div className="w-full flex items-center justify-between gap-5">
          <label htmlFor="backgroundColor">BACKGROUND</label>

          <div className="w-2/3 flex items-center justify-center gap-4">
            <input
              id="backgroundColor"
              type="color"
              value={style?.backgroundColor.slice(0, 7)}
              onChange={(e) => {
                const alphaHex = alphaToHex(hexToAlpha(style?.backgroundColor));
                updateStyle("backgroundColor", `${e.target.value}${alphaHex}`);
              }}
              className="bg-[#242424] w-1/5 cursor-pointer"
            />

            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={hexToAlpha(style?.backgroundColor)}
              onChange={(e) => {
                const alphaHex = alphaToHex(Number(e.target.value));
                updateStyle(
                  "backgroundColor",
                  `${style!.backgroundColor.slice(0, 7)}${alphaHex}`
                );
              }}
              className="w-1/4"
            />
          </div>
        </div>

        <div className="w-full flex items-center justify-between gap-5">
          <label htmlFor="outline">OUTLINE</label>
          <input 
            id="outline"
            name="outline"
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={style?.outline}
            onChange={(e) => updateStyle("outline", e.target.value)}
            className="bg-[#242424] p-1 w-2/3 text-center"
          />
        </div>

        <div className="w-full flex items-center justify-around">
          <div className="flex gap-2">
            <label htmlFor="x">X</label>
            <input 
              id="x"
              name="x"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={style?.position.x}
              onChange={e =>
                updateStyle("position", {
                  x: Number(e.target.value.replace(/\D+/g, "")),
                  y: style!.position.y
                })
              }
              className="bg-[#242424] p-1 w-2/3 text-center"
            />
          </div>
          <div className="flex gap-2">
            <label htmlFor="y">Y</label>
            <input 
              id="y"
              name="y"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={style?.position.y}
              onChange={e =>
                updateStyle("position", {
                  y: Number(e.target.value.replace(/\D+/g, "")), 
                  x: style!.position.x
                })
              }
              className="bg-[#242424] p-1 w-2/3 text-center"
            />
          </div>
        </div>

        <div className={`bg-white p-2 rounded-xl text-black hover:scale-110 transition-all font-bold 
          ${applied ? 'cursor-not-allowed bg-blue-500' : 'cursor-pointer hover:bg-blue-500'}`}
          onClick={handleApply}
        >
          { applied ? 'APPLIED' : 'APPLY' }
        </div>
      </div>

      <div className="w-1/2 h-full flex items-center justify-center text-center">
        {
          style && style.position && (
            <div className="w-1/2 relative">
              <video 
                className="w-full mx-auto"
                src={`${API_URL}/videos/${state.file?.name}`}
                ref={videoRef}
              />
              {videoNaturalSize.width > 0 && (
                <>
                  <div
                    ref={textRef}
                    className="absolute cursor-move select-none top-0 left-0"
                    style={{
                      transform: `translate(
                        ${assToDisplay(style.position.x, style.position.y).x}px,
                        ${assToDisplay(style.position.x, style.position.y).y}px)
                      `,
                      fontFamily: style.font,
                      fontSize: style.size,
                      color: style.primaryColor,
                      WebkitTextStrokeColor: style.outlineColor,
                      WebkitTextStrokeWidth: style.outline,
                      backgroundColor: style.backgroundColor,
                    }}
                    onMouseDown={onMouseDown}
                  >
                    HELLO, WORLD!
                  </div>

                  {showXGuide && (
                    <div className="absolute top-0 left-1/2 w-px h-full bg-red-500" />
                  )}

                  {showYGuide && (
                    <div className="absolute left-0 top-1/2 h-px w-full bg-red-500" />
                  )}
                </>
              )}
            </div>
          )
        }
      </div>
    </div>
  );
}

export default EditStyles;
