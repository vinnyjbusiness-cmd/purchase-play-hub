import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useTeamMember } from "@/hooks/useTeamMember";
import { PERMISSION_PAGES, getPageDescription } from "@/lib/permissions";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CheckCircle, MessageSquare, Send, BookOpen, ArrowRight, Sparkles, GraduationCap } from "lucide-react";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";

type Msg = { role: "user" | "assistant"; content: string };

export default function TrainingDashboard() {
  const { teamMember, refetch } = useTeamMember();
  const navigate = useNavigate();

  const accessiblePages = PERMISSION_PAGES.filter(
    (p) => teamMember?.permissions?.[p.key]
  );

  const [currentIdx, setCurrentIdx] = useState(0);
  const [progress, setProgress] = useState<Record<string, boolean>>(
    () => teamMember?.training_progress || {}
  );
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Find first incomplete page
  useEffect(() => {
    const firstIncomplete = accessiblePages.findIndex((p) => !progress[p.key]);
    if (firstIncomplete >= 0) setCurrentIdx(firstIncomplete);
  }, []);

  const currentPage = accessiblePages[currentIdx];
  const completedCount = accessiblePages.filter((p) => progress[p.key]).length;
  const allDone = completedCount === accessiblePages.length;
  const progressPercent = accessiblePages.length > 0 ? (completedCount / accessiblePages.length) * 100 : 0;

  // Reset messages when page changes
  useEffect(() => {
    if (!currentPage) return;
    setMessages([{
      role: "assistant",
      content: `Welcome! Let me walk you through the **${currentPage.label}** page. Ask me anything about it!\n\n${getPageDescription(currentPage.key)}`,
    }]);
  }, [currentIdx]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || isStreaming || !currentPage) return;
    const userMsg: Msg = { role: "user", content: input.trim() };
    const allMsgs = [...messages, userMsg];
    setMessages(allMsgs);
    setInput("");
    setIsStreaming(true);

    let assistantSoFar = "";
    try {
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/training-chat`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            messages: allMsgs.map((m) => ({ role: m.role, content: m.content })),
            pageName: currentPage.label,
            pageDescription: getPageDescription(currentPage.key),
          }),
        }
      );

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: "Unknown error" }));
        toast.error(err.error || "Failed to get response");
        setIsStreaming(false);
        return;
      }

      const reader = resp.body!.getReader();
      const decoder = new TextDecoder();
      let textBuffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") break;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              assistantSoFar += content;
              setMessages((prev) => {
                const last = prev[prev.length - 1];
                if (last?.role === "assistant" && prev.length > allMsgs.length) {
                  return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: assistantSoFar } : m);
                }
                return [...prev, { role: "assistant", content: assistantSoFar }];
              });
            }
          } catch { /* partial JSON */ }
        }
      }
    } catch (e) {
      console.error(e);
      toast.error("Connection error");
    }
    setIsStreaming(false);
  };

  const markUnderstood = async () => {
    if (!currentPage || !teamMember) return;
    const newProgress = { ...progress, [currentPage.key]: true };
    setProgress(newProgress);

    await supabase
      .from("team_members")
      .update({ training_progress: newProgress as any })
      .eq("id", teamMember.id);

    const nextIncomplete = accessiblePages.findIndex((p, i) => i > currentIdx && !newProgress[p.key]);
    if (nextIncomplete >= 0) {
      setCurrentIdx(nextIncomplete);
    } else {
      const anyLeft = accessiblePages.findIndex((p) => !newProgress[p.key]);
      if (anyLeft >= 0) setCurrentIdx(anyLeft);
    }
  };

  const completeTraining = async () => {
    if (!teamMember) return;
    await supabase
      .from("team_members")
      .update({ training_completed: true, training_progress: progress as any })
      .eq("id", teamMember.id);
    toast.success("Training complete! Welcome aboard 🎉");
    refetch();
    navigate("/");
  };

  if (!accessiblePages.length) {
    return (
      <div className="flex items-center justify-center min-h-screen p-6">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center space-y-3">
            <GraduationCap className="h-12 w-12 text-muted-foreground mx-auto" />
            <p className="text-muted-foreground">No pages have been assigned to you yet. Contact your admin.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card px-6 py-4 space-y-3 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <GraduationCap className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-bold">Training Dashboard</h1>
              <p className="text-sm text-muted-foreground">
                {completedCount} of {accessiblePages.length} pages completed
              </p>
            </div>
          </div>
          {allDone && (
            <Button onClick={completeTraining} className="gap-2">
              <Sparkles className="h-4 w-4" /> Complete Training
            </Button>
          )}
        </div>
        <Progress value={progressPercent} className="h-2" />
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar - page list */}
        <div className="w-64 border-r bg-card overflow-y-auto shrink-0 hidden md:block">
          <div className="p-3 space-y-1">
            {accessiblePages.map((page, idx) => (
              <button
                key={page.key}
                onClick={() => setCurrentIdx(idx)}
                className={`w-full flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors text-left ${
                  idx === currentIdx
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted"
                }`}
              >
                {progress[page.key] ? (
                  <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />
                ) : (
                  <div className="h-4 w-4 rounded-full border-2 border-muted-foreground/30 shrink-0" />
                )}
                <span className="truncate">{page.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Main content - Chat */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Current page header */}
          <div className="px-6 py-3 border-b flex items-center justify-between bg-muted/30">
            <div className="flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-primary" />
              <span className="font-semibold text-sm">{currentPage?.label}</span>
              {progress[currentPage?.key] && (
                <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20 text-xs">
                  Completed
                </Badge>
              )}
            </div>
            {!progress[currentPage?.key] && (
              <Button size="sm" variant="outline" onClick={markUnderstood} className="gap-1">
                <CheckCircle className="h-3.5 w-3.5" /> Mark as Understood
              </Button>
            )}
          </div>

          {/* Chat messages */}
          <ScrollArea ref={scrollRef} className="flex-1 p-4">
            <div className="max-w-2xl mx-auto space-y-4">
              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-card border"
                    }`}
                  >
                    {msg.role === "assistant" ? (
                      <div className="prose prose-sm dark:prose-invert max-w-none">
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                      </div>
                    ) : (
                      msg.content
                    )}
                  </div>
                </div>
              ))}
              {isStreaming && messages[messages.length - 1]?.role !== "assistant" && (
                <div className="flex justify-start">
                  <div className="bg-card border rounded-2xl px-4 py-3">
                    <div className="flex gap-1">
                      <div className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-bounce" />
                      <div className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:0.1s]" />
                      <div className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:0.2s]" />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>

          {/* Chat input */}
          <div className="border-t p-4 bg-card">
            <div className="max-w-2xl mx-auto flex gap-2">
              <Input
                placeholder="Ask about this page..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
                disabled={isStreaming}
              />
              <Button onClick={sendMessage} disabled={isStreaming || !input.trim()} size="icon">
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
