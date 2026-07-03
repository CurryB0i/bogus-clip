import { useCallback, useEffect, useRef, useState, type ChangeEvent } from "react";
import { useVideo } from "../context/VideoContext";
import { List } from 'react-window';
import EventRow from "./EventRow";
import { type Transcript, type Event as TranscriptEvent } from "../types/transcript";
import { addTranscriptToDB, getTranscriptFromDB } from "../utils/db";
import { useNavigate } from "react-router-dom";

export type Event = {
  id      : number,
  wordIds : number[];
};

export type Word = {
  id    : number;
  text  : string;
  start : number;
  end   : number;
};

export type CanonicalState = {
  events      : Record<number, Event>;
  wordsById   : Record<number, Word>;
  eventOrder  : number[];
}

const EditCaptions = () => {
  const [canonical, setCanonical]       = useState<CanonicalState | null>(null);
  const [draftWords, setDraftWords]     = useState<Record<number, Partial<Word>>>({});
  const [focusedEvent, setFocusedEvent] = useState<Event | null>(null);
  const [activeEvent, setActiveEvent]   = useState<TranscriptEvent | null>(null);
  const [time, setTime]                 = useState<number>(0);
  const [updated, setUpdated]           = useState<boolean>(false);
  const [videoDisplaySize, setVideoDisplaySize] = useState<{width: number, height: number}>({width: 0, height: 0});
  const [videoNaturalSize, setVideoNaturalSize] = useState<{width: number, height: number}>({width: 0, height: 0});
  const videoRef                        = useRef<HTMLVideoElement>(null);
  const eventsRef                       = useRef<HTMLDivElement>(null);
  const focusedEventRef                 = useRef<HTMLDivElement>(null);
  const { state, dispatch }             = useVideo();
  const navigate                        = useNavigate();

  useEffect(() => {
    const handleMouseClick = (e: MouseEvent) => {
      if(!focusedEventRef.current?.contains(e.target as Node)) {
        setFocusedEvent(null);
      }
    }

    const handleKeyPress = (e: KeyboardEvent) => {
      if(!focusedEventRef.current?.contains(e.target as Node) &&
         !videoRef.current?.contains(e.target as Node) &&
         e.code === "Space") {
        e.preventDefault();
        if(videoRef.current?.paused) {
          videoRef.current.play();
        } else {
          videoRef.current?.pause();
        }
      }
    }

    const video = videoRef.current;
    if(!video) return;

    const updateTime = () => {
      setTime(video.currentTime);
    }

    const handleLoadedMetadata = () => {
      setVideoNaturalSize({
        width: video.videoWidth,
        height: video.videoHeight
      });
    };

    const updateSize = () => {
      const rect = video.getBoundingClientRect();
      setVideoDisplaySize({ width: rect.width, height: rect.height });
    };

    if (video.readyState >= 1) {
      handleLoadedMetadata();
    } else {
      video.addEventListener('loadedmetadata', handleLoadedMetadata);
    }

    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(video);

    window.addEventListener('keydown', handleKeyPress);
    video.addEventListener('timeupdate', updateTime);
    window.addEventListener('mousedown', handleMouseClick);
    return () => {
      window.removeEventListener('keydown', handleKeyPress);
      window.removeEventListener('mousedown', handleMouseClick)
      video.removeEventListener('timeupdate', updateTime);
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      observer.disconnect();
    }
  }, [videoRef.current]);

  useEffect(() => {
    if(!state.file) {
      navigate("/");
      return;
    }

    if(!state.transcript) {
      navigate("/transcribe");
      return;
    }

    let wordId = 0;
    const events: Record<number, Event> = {};
    const wordsById: Record<number, Word> = {};
    const eventOrder: number[] = [];
    state.transcript.events.forEach((event, idx) => {
      const ids: number[] = [];
      event.words.forEach((word) => {
        wordsById[wordId] = {
          id: wordId,
          text: word.t,
          start: word.s,
          end: word.e
        };
        ids.push(wordId);
        wordId++;
      })
      events[idx] = {id: idx, wordIds: ids};
      eventOrder.push(idx);
    });
    setUpdated(false);
    setCanonical({events, wordsById, eventOrder });
  }, [state.transcript, state.file]);

  useEffect(() => {
    if(!state.transcript) return;
    const event = state.transcript.events.find(e => time >= e.start && time <= e.end) ?? null;
    setActiveEvent(event);
  }, [time, state.transcript]);

  const assToDisplay = (assX: number, assY: number) => {
    if (videoNaturalSize.width === 0 || videoDisplaySize.width === 0) 
      return { x: 0, y: 0 };
    
    const scaleX = videoDisplaySize.width / videoNaturalSize.width;
    const scaleY = videoDisplaySize.height / videoNaturalSize.height;
    
    return {
      x: assX * scaleX,
      y: assY * scaleY
    };
  };


  const getWord = useCallback(
    (id: number): Word => ({
      ...canonical!.wordsById[id],
      ...draftWords[id]
    }),
    [canonical, draftWords]
  );

  const handleEventClick = useCallback((event: Event) => {
    if(videoRef.current && canonical) {
      videoRef.current.currentTime = canonical.wordsById[event.wordIds[0]].start;;
    } 
  }, [canonical]);

  const handleEventDoubleClick = useCallback((event: Event) => {
    if(videoRef.current && canonical) {
      videoRef.current.currentTime = canonical.wordsById[event.wordIds[0]].start;
    } 
  }, [canonical]);

  const updateWord = (id: number, e: ChangeEvent<HTMLInputElement>) => {
    const { name, value: raw } = e.target;

    const value =
      name === "text"
        ? raw
        : raw
            .replace(/[^0-9.]/g, "")
            .replace(/(\..*)\./g, "$1");

    setDraftWords(prev => ({
      ...prev,
      [id]: {
        ...prev[id],
        [name]: value,
      },
    }));
  };

  const handleAddEvent = useCallback((event: Event) => {
    setUpdated(true);
    setCanonical(prev => {
      if (!prev) return prev;

      const events = { ...prev.events };
      const wordsById = { ...prev.wordsById };
      const eventOrder = [...prev.eventOrder];

      const newWordId =
        Math.max(...Object.keys(wordsById).map(Number)) + 1;

      const newEventId =
        Math.max(...Object.keys(events).map(Number)) + 1;

      const start = wordsById[event.wordIds.at(-1)!].end;

      const insertIndex = eventOrder.indexOf(event.id) + 1;
      const nextEventId = eventOrder[insertIndex];

      const end =
        nextEventId !== undefined
          ? wordsById[events[nextEventId].wordIds[0]].start
          : start;

      wordsById[newWordId] = {
        id: newWordId,
        text: "",
        start,
        end
      };

      events[newEventId] = { id: newEventId, wordIds: [newWordId] };
      eventOrder.splice(insertIndex, 0, newEventId);

      return {
        events,
        wordsById,
        eventOrder
      };
    });
  }, [canonical]);

  const handleDeleteEvent = useCallback((event: Event) => {
    setUpdated(true);
    if (focusedEvent?.id === event.id) {
      setFocusedEvent(null);
    }

    setCanonical(prev => {
      if (!prev) return prev;

      const events = { ...prev.events };
      const wordsById = { ...prev.wordsById };
      const eventOrder = [...prev.eventOrder].filter(id => id !== event.id);
      
      event.wordIds.forEach((id) => {
        delete wordsById[id];
      })
      delete events[event.id];
      return { 
        events,
        wordsById,
        eventOrder
      };
    });
  }, [canonical, focusedEvent]);

  const handleBlur = useCallback((event: Event) => {
    if(!canonical) return;
    setUpdated(true);

    const eventId = event.id;
    const newEvents: Record<number, Event> = {
      ...canonical.events,
      [eventId]: {
        ...canonical.events[eventId],
        wordIds: [...canonical.events[eventId].wordIds]
      }
    };
    const newWordsById: Record<number, Word> = { ...canonical.wordsById };
    const newWordIds = newEvents[eventId].wordIds;
    let maxWordId    = Math.max(...Object.keys(newWordsById).map(Number)) + 1;

    event.wordIds.forEach(id => {
      const wordsSplit = getWord(id).text.split(' ');
      const index      = newEvents[eventId].wordIds.indexOf(id);
      if(index == -1) return;

      const start   = newWordsById[id].start;
      const end     = newWordsById[id].end;
      
      const offset  = (end - start) / wordsSplit.length;
      for(let i=1; i<wordsSplit.length; i++) {
        if(wordsSplit[i] === "") continue;

        const wordId = maxWordId++;
        newEvents[eventId].wordIds.splice(index + i, 0, wordId);
        newWordsById[wordId] = {
          id: wordId,
          start: Number((start + offset*i).toFixed(2)),
          end: Number((start + offset*(i+1)).toFixed(2)),
          text: wordsSplit[i]
        }
      }

      const cleaned = wordsSplit.filter(Boolean);
      if (cleaned.length === 0) {
        if(event.wordIds.length > 1) {
          delete newWordsById[id];
          newWordIds.splice(index, 1);
        }
      } else {
        newWordsById[id].text = cleaned[0];
        if(cleaned.length > 1) {
          const nextWord = newEvents[eventId].wordIds[newEvents[eventId].wordIds.indexOf(id) + 1];
          newWordsById[id].end = newWordsById[nextWord].start;
        }
      }

    });

    const updatedEvent  = newEvents[eventId];
    const eventIndex    = canonical.eventOrder.indexOf(event.id);
    const prevEventId   = canonical.eventOrder[eventIndex - 1];
    const prevWordId    = prevEventId === undefined
                            ? -1
                            : newEvents[prevEventId].wordIds.at(-1)!;
    const nextEventId   = canonical.eventOrder[eventIndex + 1];
    const nextWordId    = nextEventId === undefined 
                          ? -1 
                          : newEvents[nextEventId].wordIds[0];
    const start         = prevWordId  === -1 ? 0 : newWordsById[prevWordId].end;
    const end           = nextWordId  === -1 ? videoRef.current!.duration  : newWordsById[nextWordId].start;
    const draftStart    = Number({ 
                            ...newWordsById[updatedEvent.wordIds[0]],
                            ...getWord(updatedEvent.wordIds[0]) 
                          }.start);
    const draftEnd      = Number({
                            ...newWordsById[updatedEvent.wordIds.at(-1)!],
                            ...getWord(updatedEvent.wordIds.at(-1)!)
                          }.end);

    if(draftStart < start) {
      newWordsById[updatedEvent.wordIds.at(-1)!].start = start;
    } else if(draftStart > draftEnd) {
      newWordsById[updatedEvent.wordIds[0]].start = newWordsById[updatedEvent.wordIds[0]!].start;
    } else {
      newWordsById[updatedEvent.wordIds[0]].start = draftStart;
    }
    if(draftEnd < draftStart) {
      newWordsById[updatedEvent.wordIds.at(-1)!].end = newWordsById[updatedEvent.wordIds.at(-1)!].end;
    } else if(draftEnd > end) {
      newWordsById[updatedEvent.wordIds.at(-1)!].end = end;
    } else {
      newWordsById[updatedEvent.wordIds.at(-1)!].end = draftEnd;
    }

    setCanonical(prev => {
      if(!prev) return prev;

      const events      = { ...newEvents };
      const eventOrder  = [ ...prev.eventOrder ];
      const wordsById   = { ...newWordsById };

      return {
        events,
        wordsById,
        eventOrder
      };

    });
    setDraftWords({});
    setFocusedEvent(null);
  }, [canonical, getWord]);

  useEffect(() => {
    if(!canonical || !state.transcript || !updated) return;

    const events = canonical.eventOrder.map(eventId => {
      const event = canonical.events[eventId];
      const start = canonical.wordsById[event.wordIds[0]].start;
      const end   = canonical.wordsById[event.wordIds.at(-1)!].end;
      let text: string = "";
      const words = event.wordIds.map(wid => {
        const word = canonical.wordsById[wid];
        text += word.text + " ";
        return {
          t: word.text,
          s: word.start,
          e: word.end
        }
      })

      const e = state.transcript!.events[eventId];
      return {
        id: `seg_${eventId}`,
        start,
        end,
        style: e ? e.style : "Default",
        text,
        words
      }
    })

    const newTranscript: Transcript = {
      id      : state.transcript.id,
      styles  : state.transcript.styles,
      events
    };

    dispatch({
      type: 'UPDATE_TRANSCRIPT_WAVEFORM',
      payload: {
        transcript: newTranscript
      }
    });

    (async() => addTranscriptToDB(newTranscript))();
  }, [canonical]);

  const handleReset = async () => {
    if (!state.file || !state.transcript) return;

    const withoutExt = state.file.name.substring(0, state.file.name.lastIndexOf("."));
    const orgTranscript = await getTranscriptFromDB("T_" + withoutExt + "_original");
    if(orgTranscript) {
      const newTranscript: Transcript = {
        ...orgTranscript,
        id: state.transcript.id
      };
      dispatch({
        type: 'UPDATE_TRANSCRIPT_WAVEFORM',
        payload: {
          transcript: newTranscript
        }
      });

      (async() => addTranscriptToDB(newTranscript))();
    }
  }

  return (
    <div
      className="w-full h-[90%] flex flex-col items-center justify-center"
    >
      <div className="w-full h-full flex items-center justify-center">
        <div
          className="w-[60%] h-full flex border-4 border-blue-500 py-5 rounded-lg"
        >
          <div 
            style={{scrollbarWidth: "none"}}
            className="w-full flex flex-col p-5 gap-5 overflow-y-scroll relative"
            ref={eventsRef}
          >
            {canonical && (
              <List
                rowComponent={EventRow}
                rowCount={canonical.eventOrder.length}
                overscanCount={5}
                rowHeight={100}
                style={{
                  scrollbarWidth: 'none',
                }}
                rowProps={{
                  canonical,
                  focusedEvent,
                  focusedEventRef,
                  getWord,
                  updateWord,
                  handleEventClick,
                  handleEventDoubleClick,
                  handleAddEvent,
                  handleDeleteEvent,
                  setFocusedEvent,
                  handleBlur
                }}
              />
            )}
          </div>
        </div>
        <div 
          className="relative w-1/3 flex items-center justify-center"
        >
          <video
            className="w-2/3 border-4 border-blue-500 rounded-2xl"
            src={`/videos/${state.file!.name}`}
            ref={videoRef}
            controls
            loop
          />
          <div className="absolute top-0 left-0">
          {
            activeEvent && state.style && (
              <div
                style={{
                  transform: `translate(
                    ${assToDisplay(state.style.position.x, state.style.position.y).x}px,
                    ${assToDisplay(state.style.position.x, state.style.position.y).y}px)
                  `,
                  fontFamily: state.style.font,
                  fontSize: state.style.size,
                  color: state.style.primaryColor,
                  WebkitTextStrokeColor: state.style.outlineColor,
                  WebkitTextStrokeWidth: state.style.outline,
                  backgroundColor: state.style.backgroundColor,
                  fontWeight: state.style.bold ? 'bold' : 'normal',
                  fontStyle: state.style.italic ? 'italic' : 'normal',
                  textDecoration: state.style.underline ? 'underline' : 'none',
                }}
              >
                { activeEvent.text }
              </div>
            )
          }
          </div>
          <div className="absolute -bottom-15 font-bold bg-white p-2 border-2
            border-red-500 hover:bg-red-500 hover:border-white cursor-pointer
            transition-all rounded-xl text-red-500 hover:text-white"
            onClick={handleReset}
          >
            RESET
          </div>
        </div>
      </div>
    </div>
  )
}

export default EditCaptions;
