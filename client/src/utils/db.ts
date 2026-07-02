import { openDB, deleteDB } from "idb";
import type { Transcript, Waveform } from "../types/transcript";

const openIDB = async () => {
  return openDB("bogus-clip", 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains("transcripts")) {
        db.createObjectStore("transcripts", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("waveforms")) {
        db.createObjectStore("waveforms", { keyPath: "id" });
      }
    }
  });
};

export const addWaveformToDB = async (waveform: Waveform) => {
  const db = await openIDB();
  const tx = db.transaction("waveforms", "readwrite");
  tx.store.put(waveform);
  await tx.done;
};

export const getWaveformFromDB = async (id: string): Promise<Waveform | null> => {
  const db = await openIDB();
  return (await db.get("waveforms", id)) ?? null;
};

export const deleteWaveformFromDB = async (id: string) => {
  const db = await openIDB();
  const tx = db.transaction("waveforms", "readwrite");
  tx.store.delete(id);
  await tx.done;
};

export const addTranscriptToDB = async (waveform: Transcript) => {
  const db = await openIDB();
  const tx = db.transaction("transcripts", "readwrite");
  tx.store.put(waveform);
  await tx.done;
};

export const getTranscriptFromDB = async (id: string): Promise<Transcript | null> => {
  const db = await openIDB();
  return (await db.get("transcripts", id)) ?? null;
};

export const deleteTranscriptFromDB = async (id: string) => {
  const db = await openIDB();
  const tx = db.transaction("transcripts", "readwrite");
  tx.store.delete(id);
  await tx.done;
};

export const deleteIDB = async () => {
  await deleteDB("bogus-clip");
};

