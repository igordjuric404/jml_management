"use client";

import { useState, useRef, useEffect } from "react";
import { useChatMutation } from "@/hooks/use-api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Send, MessageCircle } from "lucide-react";
import Link from "next/link";

interface Message {
  role: "user" | "assistant";
  content: string;
  sources?: { title: string; url: string }[];
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const chatMutation = useChatMutation();

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || chatMutation.isPending) return;

    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: text }]);

    chatMutation.mutate(text, {
      onSuccess: (data) => {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: data.reply ?? "",
            sources: data.sources,
          },
        ]);
      },
      onError: () => {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: "Sorry, something went wrong. Please try again.",
          },
        ]);
      },
    });
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">AI Chat</h1>
        <p className="text-muted-foreground">
          Ask questions about OGM, cases, findings, and remediation
        </p>
      </div>

      <Card className="flex flex-col h-[600px]">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <MessageCircle className="h-5 w-5" />
            Chat
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col min-h-0 p-0">
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 && (
              <div className="text-center text-muted-foreground py-12">
                <MessageCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Start a conversation. Ask about cases, findings, or remediation.</p>
              </div>
            )}
            {messages.map((m, i) => (
              <div
                key={i}
                className={`flex ${
                  m.role === "user" ? "justify-end" : "justify-start"
                }`}
              >
                <div
                  className={`max-w-[85%] rounded-lg px-4 py-2 ${
                    m.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted"
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap">{m.content}</p>
                  {m.sources && m.sources.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-border/50">
                      <p className="text-xs font-medium mb-1">Sources:</p>
                      <div className="flex flex-wrap gap-1">
                        {m.sources.map((s, j) => (
                          <Link
                            key={j}
                            href={s.url}
                            className="text-xs text-primary hover:underline underline-offset-2"
                          >
                            {s.title}
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {chatMutation.isPending && (
              <div className="flex justify-start">
                <div className="bg-muted rounded-lg px-4 py-2 flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm">Thinking...</span>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          <form
            onSubmit={handleSubmit}
            className="flex gap-2 p-4 border-t"
          >
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask a question..."
              disabled={chatMutation.isPending}
              className="flex-1"
            />
            <Button type="submit" disabled={!input.trim() || chatMutation.isPending}>
              {chatMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
