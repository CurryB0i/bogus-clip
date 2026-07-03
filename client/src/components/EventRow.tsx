import { useRef, useState, type ChangeEvent, type MouseEvent, type MutableRefObject } from "react";
import type { CanonicalState, Event, Word } from "./EditCaptions";
import Input from "./Input";
import { Plus, Trash2 } from "lucide-react";
import { type RowComponentProps } from "react-window";

type DataProps = {
  canonical: CanonicalState;
  focusedEvent: Event | null;
  focusedEventRef: MutableRefObject<HTMLDivElement | null>;
  getWord: (id: number) => Word;
  updateWord: (id: number, e: ChangeEvent<HTMLInputElement>) => void;
  handleEventClick: (event: Event) => void;
  handleEventDoubleClick: (event: Event) => void;
  handleAddEvent: (event: Event) => void;
  handleDeleteEvent: (event: Event) => void;
  setFocusedEvent: (event: Event) => void;
  handleBlur: (event: Event) => void;
};

const EventRow = ({
  index,
  style,
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
}: RowComponentProps<DataProps>) => {
  const eventId  = canonical.eventOrder[index];
  const event    = canonical.events[eventId];

  const [wordHover, setWordHover] = useState<number>(-1);
  const [mousePos, setMousePos]   = useState<{x: number, y: number}>({x: 0, y: 0});
  const rowRef = useRef<HTMLDivElement>(null);
  const inputRefs = useRef<Record<number, HTMLInputElement | null>>({});

  const handleMouseOver = (_e: MouseEvent, wid: number) => {
    const el = inputRefs.current[wid];
    const row = rowRef.current;
    if (!el || !row) return;

    const inputRect = el.getBoundingClientRect();
    const rowRect = row.getBoundingClientRect();

    const x = inputRect.left - rowRect.left + inputRect.width / 2;
    const y = inputRect.top - rowRect.top - 8;

    setMousePos({ x, y });
    setWordHover(wid);
  };


  return (
    <div className="overflow-hidden" style={style}>
    {
      <div
        className={`p-5 relative border-2 border-white cursor-pointer hover:bg-white 
          hover:text-black flex justify-between group`}
        key={eventId}
        ref={focusedEvent?.id === event.id ? focusedEventRef : null}
        onClick={() => handleEventClick(event)}
        onDoubleClick={() => handleEventDoubleClick(event)}
        onFocus={() => setFocusedEvent(event)}
        onBlur ={() => handleBlur(event)}
      >
        <div className="flex" ref={rowRef}>
          {
            event.wordIds.map(wid => (
              <div key={wid}>
                <Input
                  onChange={(e) => updateWord(wid, e)}
                  value={getWord(wid).text}
                  name="text"
                  ref={(el) => {
                    if (el) inputRefs.current[wid] = el;
                    else delete inputRefs.current[wid];
                  }}
                  onMouseOver={(e) => handleMouseOver(e, wid)}
                  onMouseLeave={() => setWordHover(-1)}
                />
                <div
                  className={`absolute bg-red-500 p-2 rounded-xl z-10 
                    ${wordHover === wid
                        ? 'visible pointer-events-auto' 
                        : 'invisible pointer-events-none'}`}
                  style={{
                    left: mousePos.x
                  }}
                >
                  {getWord(wid).start} <b>-</b> {getWord(wid).end} 
                </div>
              </div>
            ))
          }
        </div>
        <div>
          <Input
            onChange={(e) => updateWord(event.wordIds[0], e)}
            value={getWord(event.wordIds[0]).start.toString()}
            name="start"
          />
          <b>- </b>
          <Input
            onChange={(e) => updateWord(event.wordIds.at(-1)!, e)}
            value={getWord(event.wordIds.at(-1)!).end.toString()}
            name="end"
          />
        </div>
        <div 
          className="absolute left-1/2 -bottom-3 flex gap-2 opacity-0 group-hover:opacity-100
            transition-all pointer-events-none group-hover:pointer-events-auto group-hover:translate-y-1">
          <Plus
            className="text-blue-500 bg-white p-1 rounded-full border-2 border-black
              transition-all duration-75 hover:scale-110 hover:bg-blue-500
              hover:text-black"
            size={"28px"}
            onClick={() => handleAddEvent(event)}
          />
          <Trash2
            className="text-red-500 bg-white p-1 rounded-full border-2 border-black
              transition-all duration-75  hover:scale-110 hover:bg-red-500
              hover:text-black"
            size={"28px"}
            onClick={() => handleDeleteEvent(event)}
          />
        </div>
      </div>
    }
    </div>
  );
};

export default EventRow;
