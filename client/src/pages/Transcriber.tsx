import axios from "axios";
import { useVideo } from "../context/VideoContext";
import { useEffect, useState } from "react";
import { LoaderCircle } from "lucide-react";
import { addTranscriptToDB, addWaveformToDB } from "../utils/db";
import { useNavigate } from "react-router-dom";
import type { Transcript } from "../types/transcript";

const Transcriber = () => {
  const API_URL = import.meta.env.VITE_API_URL;
  const { state, dispatch } = useVideo();
  const navigate = useNavigate();
  const [transcribing, setTranscribing] = useState<boolean>(false);

  useEffect(() => {
    if(!state.file) {
      navigate("/");
      return;
    }

    if(state.transcript) {
      navigate("/edit");
    }
  }, [state.transcript, state.file]);

  const handleTranscribe = async () => {
    try {
      setTranscribing(true);
      const res = await axios.post(`${API_URL}/transcribe`, { filename: state.file!.name });
      if(res.data.ok) {
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
    } catch(err: any) {
      console.error(err);
    } finally {
      setTranscribing(false);
    }
  }

  return (
    <div className="w-full h-screen flex flex-col gap-5 items-center justify-center">
      <div className="w-1/5 rounded-2xl overflow-hidden border-solid border-2 border-white">
        <video
          className="w-full h-full"
          src={`${API_URL}/videos/${state.file?.name}`}
          controls
          loop
        />
      </div>
      <button
        disabled={transcribing}
        className={`p-5 text-2xl font-bold rounded-xl text-center transition-all flex items-center justify-center gap-5
          ${!transcribing ? 
            "hover:scale-105 hover:bg-blue-500 hover:text-white cursor-pointer bg-white text-blue-500" : 
            "bg-blue-500 text-white cursor-not-allowed"}`}
        onClick={handleTranscribe}
      >
        {
          transcribing ? 
            <>
              TRASNCRIBING
              <LoaderCircle className="animate-spin" strokeWidth={'4px'} />
            </> :
            <>
              TRANSCRIBE
            </>
        }
      </button>
    </div>
  )
}

export default Transcriber;
