import { forwardRef, useLayoutEffect, useRef, useImperativeHandle, type ChangeEvent, type MouseEvent } from "react";

type Props = {
  value: string;
  name: string;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  onMouseOver?: (e: MouseEvent<HTMLInputElement>) => void;
  onMouseLeave?: (e: MouseEvent<HTMLInputElement>) => void;
};

const Input = forwardRef<HTMLInputElement, Props>(
  ({ value, name, onChange, onMouseOver, onMouseLeave }, ref) => {
    const inputRef = useRef<HTMLInputElement>(null);
    const mirrorRef = useRef<HTMLSpanElement>(null);

    useImperativeHandle(ref, () => inputRef.current!, []);

    useLayoutEffect(() => {
      if (!inputRef.current || !mirrorRef.current) return;

      mirrorRef.current.textContent = value || " ";
      inputRef.current.style.width =
        mirrorRef.current.offsetWidth + 10 + "px";
    }, [value]);

    return (
      <>
        <input
          ref={inputRef}
          value={value}
          onChange={onChange}
          name={name}
          type="text"
          className="box-border text-center cursor-pointer hover:bg-gray-200"
          onMouseOver={onMouseOver}
          onMouseLeave={onMouseLeave}
        />
        <span
          ref={mirrorRef}
          className="absolute invisible whitespace-pre"
          style={{ font: "inherit", padding: "inherit" }}
        />
      </>
    );
  }
);

export default Input;

