import { useRef, useState, useCallback } from "react";
import type React from "react";
import type { ContentType, Visibility } from "@snc/shared";

// ── Public Types ──

export interface ContentFormFields {
  // Form fields
  readonly type: ContentType;
  readonly title: string;
  readonly description: string;
  readonly visibility: Visibility;
  readonly body: string;

  // Field setters
  readonly setType: (v: ContentType) => void;
  readonly setTitle: (v: string) => void;
  readonly setDescription: (v: string) => void;
  readonly setVisibility: (v: Visibility) => void;
  readonly setBody: (v: string) => void;

  // File input refs
  readonly mediaRef: React.RefObject<HTMLInputElement | null>;
  readonly coverArtRef: React.RefObject<HTMLInputElement | null>;
  readonly thumbnailRef: React.RefObject<HTMLInputElement | null>;

  // File display names
  readonly mediaFileName: string;
  readonly coverArtFileName: string;
  readonly thumbnailFileName: string;
  readonly setMediaFileName: (v: string) => void;
  readonly setCoverArtFileName: (v: string) => void;
  readonly setThumbnailFileName: (v: string) => void;

  // File clear actions
  readonly clearMedia: () => void;
  readonly clearCoverArt: () => void;
  readonly clearThumbnail: () => void;

  // Reset all fields
  readonly resetForm: () => void;
}

// ── Public API ──

export function useContentFormFields(): ContentFormFields {
  const [type, setType] = useState<ContentType>("audio");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<Visibility>("public");
  const [body, setBody] = useState("");

  const mediaRef = useRef<HTMLInputElement>(null);
  const coverArtRef = useRef<HTMLInputElement>(null);
  const thumbnailRef = useRef<HTMLInputElement>(null);

  const [mediaFileName, setMediaFileName] = useState("");
  const [coverArtFileName, setCoverArtFileName] = useState("");
  const [thumbnailFileName, setThumbnailFileName] = useState("");

  const clearMedia = useCallback(() => {
    if (mediaRef.current) mediaRef.current.value = "";
    setMediaFileName("");
  }, []);

  const clearCoverArt = useCallback(() => {
    if (coverArtRef.current) coverArtRef.current.value = "";
    setCoverArtFileName("");
  }, []);

  const clearThumbnail = useCallback(() => {
    if (thumbnailRef.current) thumbnailRef.current.value = "";
    setThumbnailFileName("");
  }, []);

  const resetForm = useCallback(() => {
    setTitle("");
    setDescription("");
    setBody("");
    setVisibility("public");
    if (mediaRef.current) mediaRef.current.value = "";
    if (coverArtRef.current) coverArtRef.current.value = "";
    if (thumbnailRef.current) thumbnailRef.current.value = "";
    setMediaFileName("");
    setCoverArtFileName("");
    setThumbnailFileName("");
  }, []);

  return {
    type,
    title,
    description,
    visibility,
    body,
    setType,
    setTitle,
    setDescription,
    setVisibility,
    setBody,
    mediaRef,
    coverArtRef,
    thumbnailRef,
    mediaFileName,
    coverArtFileName,
    thumbnailFileName,
    setMediaFileName,
    setCoverArtFileName,
    setThumbnailFileName,
    clearMedia,
    clearCoverArt,
    clearThumbnail,
    resetForm,
  };
}
