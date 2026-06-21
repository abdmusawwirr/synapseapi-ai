import Link from "next/link";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { BotIcon, LoaderIcon, RadioIcon, RadioTowerIcon } from "lucide-react";
import {
  CallControls,
  SpeakerLayout,
} from "@stream-io/video-react-sdk";

import { Button } from "@/components/ui/button";

interface Props {
  onLeave: () => void;
  meetingName: string;
};

export const CallActive = ({ onLeave, meetingName }: Props) => {
  const [assistantEnabled, setAssistantEnabled] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastTranscript, setLastTranscript] = useState("");
  const [lastResponse, setLastResponse] = useState("");
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const isProcessingRef = useRef(false);

  useEffect(() => {
    isProcessingRef.current = isProcessing;
  }, [isProcessing]);

  useEffect(() => {
    if (!assistantEnabled) {
      mediaRecorderRef.current?.stop();
      mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
      mediaRecorderRef.current = null;
      mediaStreamRef.current = null;
      return;
    }

    let cancelled = false;

    const startAssistant = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
        });

        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        mediaStreamRef.current = stream;
        const recorder = new MediaRecorder(stream, {
          mimeType: MediaRecorder.isTypeSupported("audio/webm")
            ? "audio/webm"
            : undefined,
        });

        recorder.ondataavailable = async (event) => {
          if (
            cancelled ||
            event.data.size < 2000 ||
            isProcessingRef.current
          ) {
            return;
          }

          isProcessingRef.current = true;
          setIsProcessing(true);

          try {
            const formData = new FormData();
            formData.append("audio", event.data, "speech.webm");
            formData.append("meetingName", meetingName);

            const response = await fetch("/api/groq/live-audio", {
              method: "POST",
              body: formData,
            });

            if (!response.ok) {
              throw new Error("Groq live assistant request failed");
            }

            const data = (await response.json()) as {
              transcript?: string;
              response?: string;
            };

            setLastTranscript(data.transcript ?? "");

            if (data.response) {
              setLastResponse(data.response);
              window.speechSynthesis.cancel();
              window.speechSynthesis.speak(
                new SpeechSynthesisUtterance(data.response)
              );
            }
          } catch {
            setLastResponse("I could not process that audio.");
          } finally {
            isProcessingRef.current = false;
            setIsProcessing(false);
          }
        };

        recorder.start(6000);
        mediaRecorderRef.current = recorder;
      } catch {
        setAssistantEnabled(false);
        setLastResponse("Microphone access is needed for Groq live responses.");
      }
    };

    startAssistant();

    return () => {
      cancelled = true;
      mediaRecorderRef.current?.stop();
      mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
      mediaRecorderRef.current = null;
      mediaStreamRef.current = null;
    };
  }, [assistantEnabled, meetingName]);

  return (
    <div className="flex flex-col justify-between p-4 h-full text-white">
      <div className="bg-[#101213] rounded-full p-4 flex items-center gap-4">
        <Link href="/" className="flex items-center justify-center p-1 bg-white/10 rounded-full w-fit">
          <Image src="/logo.svg" width={22} height={22} alt="Logo" />
        </Link>
        <h4 className="text-base">
          {meetingName}
        </h4>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={() => setAssistantEnabled((current) => !current)}
          className="ml-auto rounded-full bg-white/10 text-white hover:bg-white/20"
        >
          {assistantEnabled ? (
            <RadioTowerIcon className="size-4" />
          ) : (
            <RadioIcon className="size-4" />
          )}
          Groq Live
        </Button>
      </div>
      <SpeakerLayout />
      {assistantEnabled || lastResponse ? (
        <div className="fixed right-4 bottom-24 z-10 w-[320px] rounded-lg border border-white/10 bg-[#101213]/95 p-4 shadow-lg">
          <div className="flex items-center gap-2 text-sm font-medium">
            <BotIcon className="size-4" />
            <span>Groq Live</span>
            {isProcessing ? (
              <LoaderIcon className="ml-auto size-4 animate-spin" />
            ) : null}
          </div>
          {lastTranscript ? (
            <p className="mt-3 line-clamp-2 text-xs text-white/60">
              {lastTranscript}
            </p>
          ) : null}
          {lastResponse ? (
            <p className="mt-2 text-sm text-white">
              {lastResponse}
            </p>
          ) : null}
        </div>
      ) : null}
      <div className="bg-[#101213] rounded-full px-4">
        <CallControls onLeave={onLeave} />
      </div>
    </div>
  );
};
