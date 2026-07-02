import Transcriber from "./pages/Transcriber";
import VideoUploader from "./pages/VideoUploader";
import Edit from "./pages/Edit";
import { useVideo } from "./context/VideoContext";
import { Routes, Route } from "react-router-dom";
import { useLayoutEffect } from "react";
import axios from "axios";

const App = () => {
  const { state, dispatch } = useVideo();
  const API_URL = import.meta.env.VITE_API_URL;

  useLayoutEffect(() => {
    console.log(state)
    if(!state.file && location.pathname !== "/") {
      dispatch({ type: 'RESET' });
      return;
    }

    const checkFileExists = async () => {
      try {
        const res = await axios.get(`${API_URL}/exists/${state.file?.name}`);
        if(!res.data.exists) 
          dispatch({ type: 'RESET' });
      } catch (err: any) {
        console.error(err);
        dispatch({ type: 'RESET' });
      }
    }

    checkFileExists();
  }, [state]);

  return (
    <div className="max-w-screen min-h-screen">
      <Routes>
        <Route path="/" element={<VideoUploader/>} />
        <Route path="/transcribe" element={<Transcriber/>} />
        <Route path="/edit" element={<Edit/>} />
      </Routes>
    </div>
  )
}

export default App;
