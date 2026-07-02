export type File = {
  name    : string;
  resX    : number;
  resY    : number;
  size    : number;
  duration: number;
};

export type StyleOptions = {
  font            : string;
  size            : number;
  primaryColor    : string;
  secondaryColor  : string;
  outlineColor    : string;
  backgroundColor : string;
  bold            : boolean;
  italic          : boolean;
  underline       : boolean;
  outline         : number;
  position        : { x: number, y: number };
};

export type Styles = Record<string, StyleOptions>;

export type Event = {
  id      : string;
  start   : number;
  end     : number;
  style   : keyof Styles;
  text    : string;
  words   : {
    t : string;
    s : number;
    e : number;
  }[];
};

export type Transcript = {
  id      : string;
  styles  : Styles;
  events  : Event[];
};

export type Waveform = {
  id        : string;
  peaks     : Array<Float32Array>;
  duration  : number;
  sampleRate: number;
};
