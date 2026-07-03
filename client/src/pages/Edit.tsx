import { useEffect, useState } from "react";
import EditCaptions from "../components/EditCaptions";
import EditStyles from "../components/EditStyles";
import { useVideo } from "../context/VideoContext";
import { useNavigate } from "react-router-dom";
import { Download, Flame, ArrowLeft } from "lucide-react";
import axios from "axios";
import { StepIndicator } from "../components/StepIndicator";
import { Toast } from "../components/Toast";

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

  const [burning, setBurning] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const handleExport = async () => {
    if (!state.file || !state.transcript) return;
    try {
      const res = await axios.post("/export-ass", {
        filename: state.file.name,
        styles: state.transcript.styles,
        events: state.transcript.events,
        position: state.style?.position
      }, { responseType: "blob" });

      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `${state.file.name.split(".")[0]}.ass`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      setToast({ message: "ASS file downloaded!", type: "success" });
    } catch (err) {
      console.error(err);
      setToast({ message: "Failed to export ASS file", type: "error" });
    }
  };

  const handleBurn = async () => {
    if (!state.file || !state.transcript) return;
    setBurning(true);
    try {
      const res = await axios.post("/burn-subtitles", {
        filename: state.file.name,
        styles: state.transcript.styles,
        events: state.transcript.events,
        position: state.style?.position
      }, { responseType: "blob" });

      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `${state.file.name.split(".")[0]}_burned.mp4`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      setToast({ message: "Video with burnt subtitles downloaded!", type: "success" });
    } catch (err) {
      console.error(err);
      setToast({ message: "Failed to burn subtitles", type: "error" });
    } finally {
      setBurning(false);
    }
  };

  const steps: Array<{ id: number; label: string; status: 'pending' | 'current' | 'completed' | 'loading' }> = [
    { id: 1, label: 'Upload', status: 'completed' },
    { id: 2, label: 'Transcribe', status: 'completed' },
    { id: 3, label: 'Edit', status: burning ? 'loading' : 'current' },
  ];

  return (
    <div className="w-full min-h-screen flex flex-col">
      <StepIndicator steps={steps} />
      <div className="w-full h-[calc(100vh-4rem)]">
        <div className="w-full h-[10vh] flex items-center justify-center gap-2">
          <button
            onClick={() => navigate('/transcribe')}
            className="absolute left-5 flex items-center gap-2 text-gray-400 hover:text-white transition-all"
          >
            <ArrowLeft size={20} />
            Back
          </button>
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

          <button
            className="p-2 rounded-2xl text-center cursor-pointer hover:bg-green-500 
              hover:text-white font-bold border-green-500 border-2 bg-white text-green-500
              flex items-center gap-1"
            onClick={handleExport}
          >
            <Download size={16} />
            Export ASS
          </button>

          <button
            className={`p-2 rounded-2xl text-center font-bold border-orange-500 border-2
              flex items-center gap-1
              ${burning 
                ? "bg-orange-500 text-white cursor-not-allowed" 
                : "bg-white text-orange-500 cursor-pointer hover:bg-orange-500 hover:text-white"}`}
            onClick={handleBurn}
            disabled={burning}
          >
            <Flame size={16} />
            {burning ? "Burning..." : "Burn Subs"}
          </button>
        </div>

        <div className="w-full h-[90vh]">
          {page === "styles" ? <EditStyles /> : <EditCaptions />}
        </div>
      </div>
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
};

export default Edit;
