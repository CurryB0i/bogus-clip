import axios from "axios";
import { LoaderCircle, Upload } from "lucide-react";
import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { useVideo } from "../context/VideoContext";
import { useNavigate } from "react-router-dom";

const VideoUploader = () => {
  const [progress, setProgress] = useState<number>(0);
  const [uploading, setUploading] = useState<boolean>(false);
  const [flag, setFlag] = useState<boolean>(false);
  const fileUploaderRef = useRef<HTMLInputElement | null>(null);
  const { state, dispatch } = useVideo();
  const navigate = useNavigate();
  const API_URL = import.meta.env.VITE_API_URL;

  useEffect(() => {
    const interval = setInterval(() => {
      setFlag(prev => !prev);
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if(state.file) {
      navigate("/transcribe");
    }
  }, [state.file])

  const handleUploadClick = () => {
    if(!uploading) {
      fileUploaderRef.current?.click();
    }
  }
  
  const handleFileUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    setUploading(true);
    const file = e.target?.files?.[0];
    const formData = new FormData();
    formData.append("file", file as File);
    try {
      const res = await axios.post(`${API_URL}/upload`, formData, {
        headers: {
        'Content-Type': 'multipart/form-data'
        },
        onUploadProgress: (e) => {
          const percent = e.total ? Math.round((e.loaded * 100) / e.total) : 0;
          setProgress(percent);
        }
      })
      
      if(res.data.ok) {
        const file = res.data.file;
        console.log(file)
        dispatch({
          type: 'UPDATE_FILENAME',
          payload: {
            file
          }
        });
        localStorage.setItem('file', JSON.stringify(file));
      }
    } catch (err: any) {
      console.error(err);
    } finally {
      setProgress(0);
      setUploading(false);
    }
  }

  return (
    <div className="w-screen h-full flex flex-col items-center justify-center">
      <div className="text-center font-bold text-[5rem] p-10 flex items-center justify-center gap-3">
        <span className={`${flag ? 'text-blue-500' : 'text-white'}`}>BOGUS</span>
        <span className={`${flag ? 'text-white' : 'text-blue-500'}`}>CLIP</span>
      </div>
      <button 
        onClick={handleUploadClick}
        disabled={uploading}
        className={`w-1/4 p-10 mx-auto text-2xl text-center rounded-lg flex
         font-black justify-center gap-5 border-solid border-blue-400 border-4 transition-all
         ${!uploading ? 
           "bg-gray-300 text blue-500 hover:bg-blue-500 hover:text-white hover:border-white hover:scale-[1.01] cursor-pointer" :
           "bg-blue-500 text-white cursor-not-allowed"}`}
      >
        {
          uploading ? 
            <>
              UPLOADING
              <LoaderCircle className="animate-spin" strokeWidth={'4px'} />
            </> :
            <>
              UPLOAD FILE
              <Upload strokeWidth={'5px'}/>
            </>
        }
      </button>
      {
        uploading && 
          <div className="h-3 w-1/3 bg-gray-50 my-10">
            <div className="h-full bg-green-500 transition-all" style={{ width: `${progress}%` }}></div>
          </div>
      }
      <input 
        onChange={handleFileUpload}
        type="file"
        disabled={uploading}
        className="hidden"
        ref={fileUploaderRef}
      />
    </div>
  )
}

export default VideoUploader;
