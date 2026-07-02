import { useEffect, useState } from "react";
import EditCaptions from "../components/EditCaptions";
import EditStyles from "../components/EditStyles";
import { useVideo } from "../context/VideoContext";
import { useNavigate } from "react-router-dom";

type Page = "captions" | "styles";

const Edit = () => {
  const { state } = useVideo();
  const navigate = useNavigate();
  const [page, setPage] = useState<Page>(() => {
    const saved = localStorage.getItem("edit-page");
    return (saved === "captions" || saved === "styles") ? saved : "styles";
  });

  useEffect(() => {
    if(!state.file)
      navigate('/');

    if(!state.transcript)
      navigate('/transcribe');
  }, []);

  useEffect(() => {
    localStorage.setItem("edit-page", page);
  }, [page]);

  return (
    <div>
      <div className="w-full h-[10vh] flex items-center justify-center">
        <div
          className={`p-2 rounded-l-2xl text-center cursor-pointer hover:bg-blue-500 
            hover:text-white font-bold border-blue-500 border-2
            ${page === "styles" ? "bg-blue-500 text-white" : "bg-white text-blue-500"}`}
          onClick={() => setPage("styles")}
        >
          Edit Styles
        </div>

        <div
          className={`p-2 rounded-r-2xl text-center cursor-pointer hover:bg-blue-500 
            hover:text-white font-bold border-blue-500 border-2
            ${page === "captions" ? "bg-blue-500 text-white" : "bg-white text-blue-500"}`}
          onClick={() => setPage("captions")}
        >
          Edit Captions
        </div>
      </div>

      <div className="w-full h-[90vh]">
        {page === "styles" ? <EditStyles /> : <EditCaptions />}
      </div>
    </div>
  );
};

export default Edit;
