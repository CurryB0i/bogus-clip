/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useMemo, useReducer, type ReactNode } from "react"
import type { Transcript, Waveform, File, StyleOptions } from "../types/transcript";
import { addTranscriptToDB, addWaveformToDB, getTranscriptFromDB, getWaveformFromDB } from "../utils/db";
import axios from "axios";

type VideoState = {
  file  : File | null;
  transcript: Transcript | null;
  waveform  : Waveform | null;
  style: StyleOptions | null;
}

type VideoAction = 
  | { type: "UPDATE_FILENAME"; payload: { file: File } }
  | { type: "UPDATE_TRANSCRIPT_WAVEFORM"; 
      payload: { transcript: Transcript, waveform?: Waveform } }
  | { type: "UPDATE_STYLES"; payload : { style: StyleOptions } }
  | { type: "RESET" }

const initialVideoState: VideoState = {
  file  : null,
  transcript: null,
  waveform  : null,
  style: null
}

const videoReducer = (state: VideoState, action: VideoAction): VideoState => {
  switch(action.type) {
    case 'UPDATE_FILENAME' :
      return {
        ...state,
        file: action.payload.file
      };

    case 'UPDATE_TRANSCRIPT_WAVEFORM' :
      return {
      ...state,
      transcript: action.payload.transcript,
      waveform  : action.payload.waveform ?? state.waveform
    }

    case 'UPDATE_STYLES' : 
      return {
        ...state,
        style: action.payload.style
      }

    case 'RESET' :
      return initialVideoState;

    default: 
      return state;
  }
}

type VideoContextType = {
  state: VideoState,
  dispatch: React.Dispatch<VideoAction>
}

const VideoContext = createContext<VideoContextType>({
  state: initialVideoState,
  dispatch: () => {
    console.warn("dispatch called outside of provider");
  }
})

export const VideoProvider = ({children} : {children: ReactNode}) => {
  const [state, dispatch] = useReducer(videoReducer, initialVideoState, () => {
    const file = JSON.parse(localStorage.getItem("file") ?? "{}");
    const style = JSON.parse(localStorage.getItem("style") ?? "{}");
    return { 
      file: Object.keys(file).length > 0 ? file : null,
      style: Object.keys(style).length > 0 ? style : null,
      transcript: null,
      waveform  : null
    }
  });

  useEffect(() => {
    const loadTranscript = async () => {
      if (!state.file) return;

      const withoutExt = state.file.name.substring(0, state.file.name.lastIndexOf("."));
      const transcript = await getTranscriptFromDB("T_" + withoutExt + "_draft");
      const waveform   = await getWaveformFromDB("W_" + withoutExt);
      if (transcript && waveform) {
        dispatch({
          type: "UPDATE_TRANSCRIPT_WAVEFORM",
          payload: {
            transcript,
            waveform
          }
        });
      } else {
        const res = await axios.get(`/get_transcript_waveform/${state.file.name}`);
        if(!res.data.ok) return;

        const transcript = res.data.transcript;
        const waveform   = res.data.waveform;
        const originalTranscript: Transcript = {
          ...transcript,
          id: transcript.id + "_original",
        };

        const draftTranscript: Transcript = {
          ...transcript,
          id: transcript.id + "_draft",
        };

        await addTranscriptToDB(originalTranscript);
        await addTranscriptToDB(draftTranscript);
        await addWaveformToDB(waveform);

        dispatch({
          type: "UPDATE_TRANSCRIPT_WAVEFORM",
          payload: {
            transcript: draftTranscript,
            waveform
          },
        });
      }
    };

    loadTranscript();
  }, [state.file]);

  const value = useMemo(() => ({ state, dispatch }), [state, dispatch]);
  return (
    <VideoContext.Provider value={value}>
      {children}
    </VideoContext.Provider>
  )
}

export const useVideo = () => useContext(VideoContext);
