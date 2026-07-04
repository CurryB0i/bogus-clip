import Transcriber from "./pages/Transcriber";
import VideoUploader from "./pages/VideoUploader";
import Edit from "./pages/Edit";
import { useVideo } from "./context/VideoContext";
import { Routes, Route } from "react-router-dom";
import { useLayoutEffect } from "react";
import axios from "axios";

const App = () => {
  const { state, dispatch } = useVideo();

  useLayoutEffect(() => {
    if (!state.file && location.pathname !== "/") {
      dispatch({ type: "RESET" });
      return;
    }

    const checkFileExists = async () => {
      try {
        const res = await axios.get(`/api/exists/${state.file?.name}`);
        if (!res.data.exists) dispatch({ type: "RESET" });
      } catch (err) {
        console.error(err);
        dispatch({ type: "RESET" });
      }
    };

    checkFileExists();
  }, [state]);

  return (
    <div className="max-w-screen min-h-screen">
      <Routes>
        <Route path="/" element={<VideoUploader />} />
        <Route path="/transcribe" element={<Transcriber />} />
        <Route path="/edit" element={<Edit />} />
      </Routes>
    </div>
  );
};

export default App;
