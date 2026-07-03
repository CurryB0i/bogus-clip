import axios from "axios";
import { useVideo } from "../context/VideoContext";
import { useEffect, useState } from "react";
import { LoaderCircle, ArrowLeft } from "lucide-react";
import { addTranscriptToDB, addWaveformToDB } from "../utils/db";
import { useNavigate } from "react-router-dom";
import type { Transcript } from "../types/transcript";
import { StepIndicator } from "../components/StepIndicator";

const Transcriber = () => {
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
      const res = await axios.post(`/transcribe`, { filename: state.file!.name });
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
    } catch (err) {
      console.error(err);
    } finally {
      setTranscribing(false);
    }
  }

  const steps: Array<{ id: number; label: string; status: 'pending' | 'current' | 'completed' | 'loading' }> = [
    { id: 1, label: 'Upload', status: 'completed' },
    { id: 2, label: 'Transcribe', status: transcribing ? 'loading' : 'current' },
    { id: 3, label: 'Edit', status: 'pending' },
  ];

  return (
    <div className="w-full min-h-screen flex flex-col">
      <StepIndicator steps={steps} />
      <div className="w-full flex-1 flex flex-col gap-5 items-center justify-center p-10">
        <button
          onClick={() => navigate('/')}
          className="self-start flex items-center gap-2 text-gray-400 hover:text-white transition-all"
        >
          <ArrowLeft size={20} />
          Back
        </button>
        <div className="w-1/3 rounded-2xl overflow-hidden border-solid border-2 border-white">
          <video
            className="w-full h-full"
            src={`/videos/${state.file?.name}`}
            controls
            loop
          />
        </div>
        <div className="text-center">
          <p className="text-gray-400 mb-5">
            {transcribing 
              ? "Processing audio and generating subtitles..." 
              : "Click below to auto-generate subtitles using AI"}
          </p>
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
                  TRANSCRIBING
                  <LoaderCircle className="animate-spin" strokeWidth={'4px'} />
                </> :
                <>
                  TRANSCRIBE
                </>
            }
          </button>
        </div>
      </div>
    </div>
  )
}

export default Transcriber;
